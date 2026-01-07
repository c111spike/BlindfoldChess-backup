import { Chess, Move } from 'chess.js';
import { clientStockfish, TopMoveResult } from './stockfish';
import { getBookMoves, selectBookMoveByPersonality, loadBook, isOpeningPhase } from './polyglotBook';
import type { BotPersonality, BotDifficulty } from '@shared/botTypes';

// Interface for tracking opponent's last move (for recapture detection)
export interface LastMoveInfo {
  from: string;
  to: string;
  captured?: string;  // Piece type that was captured (p, n, b, r, q)
  capturedValue?: number;  // Material value of captured piece
}

// ============================================
// BOT DELAY HELPERS
// ============================================

/**
 * Count the number of pieces a bot has remaining on the board.
 * Used to determine game phase for delay calculation.
 * @param fen - Current board position in FEN notation
 * @param botColor - The bot's color ('white' or 'black')
 * @returns Number of pieces the bot has (1-16)
 */
export function countBotPieces(fen: string, botColor: 'white' | 'black'): number {
  // Extract just the position part of FEN (before first space)
  const position = fen.split(' ')[0];
  let count = 0;
  
  if (botColor === 'white') {
    // Count uppercase letters (white pieces)
    for (const char of position) {
      if (char >= 'A' && char <= 'Z') {
        count++;
      }
    }
  } else {
    // Count lowercase letters (black pieces)
    for (const char of position) {
      if (char >= 'a' && char <= 'z') {
        count++;
      }
    }
  }
  
  return count;
}

/**
 * Detect if a recapture opportunity exists.
 * Recaptures are quick reflexive moves, so bot should respond fast.
 * @param lastMove - Info about opponent's last move
 * @param fen - Current board position in FEN notation
 * @returns True if bot can recapture on the square where opponent just captured
 */
export function detectRecapture(lastMove: LastMoveInfo | undefined, fen: string): boolean {
  // No last move or opponent didn't capture anything
  if (!lastMove || !lastMove.captured) {
    return false;
  }
  
  try {
    const game = new Chess(fen);
    const legalMoves = game.moves({ verbose: true });
    
    // Check if any legal move captures on the square where opponent just captured
    const recaptureSquare = lastMove.to;
    return legalMoves.some(move => move.to === recaptureSquare && move.captured);
  } catch {
    return false;
  }
}

/**
 * Detect free piece captures (hanging pieces).
 * A capture is "free" if the opponent cannot recapture on that square.
 * @param fen - Current board position in FEN notation
 * @returns Array of moves that capture undefended pieces, with their values
 */
export function detectFreeCaptures(fen: string): { move: Move; capturedValue: number }[] {
  try {
    // Get legal moves from the original position
    const originalGame = new Chess(fen);
    const legalMoves = originalGame.moves({ verbose: true });
    const captures = legalMoves.filter(m => m.captured);
    const freeCaptures: { move: Move; capturedValue: number }[] = [];
    
    for (const capture of captures) {
      const capturedValue = capture.captured ? PIECE_VALUES[capture.captured] || 0 : 0;
      
      // Create a FRESH Chess instance for each simulation to avoid state corruption
      const simGame = new Chess(fen);
      
      // Simulate the capture
      simGame.move(capture);
      
      // Check if opponent can recapture on that square
      const opponentMoves = simGame.moves({ verbose: true });
      const canBeRecaptured = opponentMoves.some(om => om.to === capture.to && om.captured);
      
      // If piece is undefended (free), add to list
      if (!canBeRecaptured) {
        freeCaptures.push({ move: capture, capturedValue });
      }
    }
    
    // Sort by value (highest first)
    freeCaptures.sort((a, b) => b.capturedValue - a.capturedValue);
    
    return freeCaptures;
  } catch {
    return [];
  }
}

/**
 * Check if a specific move is a free capture.
 * Used for move ordering and delay calculation.
 * @param fen - Current board position in FEN notation
 * @param move - The move to check
 * @returns True if this move captures an undefended piece
 */
export function isFreeCapture(fen: string, move: Move): boolean {
  if (!move.captured) return false;
  
  try {
    // Create a fresh Chess instance for simulation
    const simGame = new Chess(fen);
    
    // Simulate the capture
    simGame.move(move);
    
    // Check if opponent can recapture on that square
    const opponentMoves = simGame.moves({ verbose: true });
    const canBeRecaptured = opponentMoves.some(om => om.to === move.to && om.captured);
    
    return !canBeRecaptured;
  } catch {
    return false;
  }
}

// Piece values for MVV-LVA ordering (opening/middlegame values)
const PIECE_VALUES: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

// Endgame piece values (knights less valuable, rooks more valuable)
const PIECE_VALUES_ENDGAME: Record<string, number> = {
  p: 120,  // Pawns more valuable in endgame
  n: 280,  // Knights less effective in open positions
  b: 350,  // Bishops shine in endgames
  r: 550,  // Rooks dominate open files
  q: 950,
  k: 20000,
};

// ============================================
// KILLER MOVE HEURISTIC
// ============================================
// Stores moves that caused beta cutoffs at each depth
// killerMoves[depth] = [move1, move2]
const MAX_DEPTH = 20;
const killerMoves: (string | null)[][] = Array.from({ length: MAX_DEPTH }, () => [null, null]);

function storeKillerMove(depth: number, move: string): void {
  if (depth >= MAX_DEPTH) return;
  // Don't store duplicates
  if (killerMoves[depth][0] === move) return;
  // Shift existing killer to slot 2
  killerMoves[depth][1] = killerMoves[depth][0];
  killerMoves[depth][0] = move;
}

function isKillerMove(depth: number, move: string): boolean {
  if (depth >= MAX_DEPTH) return false;
  return killerMoves[depth][0] === move || killerMoves[depth][1] === move;
}

function clearKillerMoves(): void {
  for (let i = 0; i < MAX_DEPTH; i++) {
    killerMoves[i][0] = null;
    killerMoves[i][1] = null;
  }
}

// ============================================
// HISTORY HEURISTIC
// ============================================
// Global table tracking moves that cause cutoffs
// history[fromSquareIndex][toSquareIndex] = score
const historyTable: number[][] = Array.from({ length: 64 }, () => Array(64).fill(0));

function squareToIndex(square: string): number {
  const file = square.charCodeAt(0) - 97; // a=0, h=7
  const rank = parseInt(square[1]) - 1;   // 1=0, 8=7
  return rank * 8 + file;
}

function updateHistory(from: string, to: string, depth: number): void {
  const fromIdx = squareToIndex(from);
  const toIdx = squareToIndex(to);
  // Score increases with depth squared (deeper cutoffs are more valuable)
  historyTable[fromIdx][toIdx] += depth * depth;
  // Prevent overflow by scaling down periodically
  if (historyTable[fromIdx][toIdx] > 10000) {
    for (let i = 0; i < 64; i++) {
      for (let j = 0; j < 64; j++) {
        historyTable[i][j] = Math.floor(historyTable[i][j] / 2);
      }
    }
  }
}

function getHistoryScore(from: string, to: string): number {
  const fromIdx = squareToIndex(from);
  const toIdx = squareToIndex(to);
  return historyTable[fromIdx][toIdx];
}

function clearHistory(): void {
  for (let i = 0; i < 64; i++) {
    for (let j = 0; j < 64; j++) {
      historyTable[i][j] = 0;
    }
  }
}

// ============================================
// ZOBRIST HASHING & TRANSPOSITION TABLE
// (Used only for Grandmaster difficulty)
// ============================================

// Zobrist random keys - initialized once at module load
// 12 piece types (6 per color) × 64 squares + castling + en passant + side to move
const ZOBRIST_PIECE_KEYS: bigint[][] = []; // [pieceIndex 0-11][square 0-63]
const ZOBRIST_CASTLING: bigint[] = []; // 4 castling rights
const ZOBRIST_EN_PASSANT: bigint[] = []; // 8 files for en passant
let ZOBRIST_SIDE_TO_MOVE: bigint;

// Simple PRNG for generating Zobrist keys (Mulberry32-based, extended to 64-bit)
function createZobristPRNG(seed: number): () => bigint {
  let a = seed >>> 0;
  return function(): bigint {
    // Generate two 32-bit numbers and combine to 64-bit
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    const low = (t ^ t >>> 14) >>> 0;
    
    a = a + 0x6D2B79F5 | 0;
    t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    const high = (t ^ t >>> 14) >>> 0;
    
    return (BigInt(high) << 32n) | BigInt(low);
  };
}

// Initialize Zobrist keys at module load
(function initZobrist() {
  const rng = createZobristPRNG(0xDEADBEEF); // Fixed seed for reproducibility
  
  // 12 pieces: wp, wn, wb, wr, wq, wk, bp, bn, bb, br, bq, bk
  for (let piece = 0; piece < 12; piece++) {
    ZOBRIST_PIECE_KEYS[piece] = [];
    for (let square = 0; square < 64; square++) {
      ZOBRIST_PIECE_KEYS[piece][square] = rng();
    }
  }
  
  // 4 castling rights (white kingside, white queenside, black kingside, black queenside)
  for (let i = 0; i < 4; i++) {
    ZOBRIST_CASTLING[i] = rng();
  }
  
  // 8 en passant files (a-h)
  for (let i = 0; i < 8; i++) {
    ZOBRIST_EN_PASSANT[i] = rng();
  }
  
  ZOBRIST_SIDE_TO_MOVE = rng();
})();

// Map piece character to index (0-11)
function pieceToZobristIndex(piece: string, color: 'w' | 'b'): number {
  const pieceOrder: Record<string, number> = { p: 0, n: 1, b: 2, r: 3, q: 4, k: 5 };
  const base = color === 'w' ? 0 : 6;
  return base + (pieceOrder[piece.toLowerCase()] ?? 0);
}

// Compute Zobrist hash for a chess position
function computeZobristHash(game: Chess): bigint {
  let hash = 0n;
  const board = game.board();
  
  // Hash all pieces on the board
  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const piece = board[rank][file];
      if (piece) {
        const squareIdx = rank * 8 + file;
        const pieceIdx = pieceToZobristIndex(piece.type, piece.color);
        hash ^= ZOBRIST_PIECE_KEYS[pieceIdx][squareIdx];
      }
    }
  }
  
  // Hash castling rights
  const fen = game.fen();
  const castling = fen.split(' ')[2];
  if (castling.includes('K')) hash ^= ZOBRIST_CASTLING[0];
  if (castling.includes('Q')) hash ^= ZOBRIST_CASTLING[1];
  if (castling.includes('k')) hash ^= ZOBRIST_CASTLING[2];
  if (castling.includes('q')) hash ^= ZOBRIST_CASTLING[3];
  
  // Hash en passant
  const epSquare = fen.split(' ')[3];
  if (epSquare !== '-') {
    const epFile = epSquare.charCodeAt(0) - 97;
    hash ^= ZOBRIST_EN_PASSANT[epFile];
  }
  
  // Hash side to move (XOR when it's black's turn)
  if (game.turn() === 'b') {
    hash ^= ZOBRIST_SIDE_TO_MOVE;
  }
  
  return hash;
}

// Transposition table entry flags
const TT_EXACT = 0;     // Score is exact
const TT_LOWERBOUND = 1; // Score is a lower bound (beta cutoff)
const TT_UPPERBOUND = 2; // Score is an upper bound (failed high)

interface TTEntry {
  hash: bigint;
  depth: number;
  score: number;
  flag: number;
  bestMove: string | null;
  age: number; // For aging scheme
}

// Transposition table - size should be power of 2 for efficient indexing
const TT_SIZE = 1 << 18; // ~262K entries
const TT_MASK = BigInt(TT_SIZE - 1);
const transpositionTable: (TTEntry | null)[] = new Array(TT_SIZE).fill(null);
let ttAge = 0;

function ttIndex(hash: bigint): number {
  return Number(hash & TT_MASK);
}

// Store position in transposition table (depth-preferred replacement)
function ttStore(hash: bigint, depth: number, score: number, flag: number, bestMove: string | null, plyFromRoot: number): void {
  const idx = ttIndex(hash);
  const existing = transpositionTable[idx];
  
  // Adjust mate scores for storage (store as distance from root)
  let adjustedScore = score;
  if (score > 90000) {
    adjustedScore = score + plyFromRoot;
  } else if (score < -90000) {
    adjustedScore = score - plyFromRoot;
  }
  
  // Replacement scheme: always replace if new entry has >= depth or entry is old
  if (!existing || existing.age !== ttAge || depth >= existing.depth) {
    transpositionTable[idx] = {
      hash,
      depth,
      score: adjustedScore,
      flag,
      bestMove,
      age: ttAge,
    };
  }
}

// Probe transposition table
function ttProbe(hash: bigint, depth: number, alpha: number, beta: number, plyFromRoot: number): { hit: boolean; score?: number; bestMove?: string | null } {
  const idx = ttIndex(hash);
  const entry = transpositionTable[idx];
  
  if (!entry || entry.hash !== hash) {
    return { hit: false };
  }
  
  // Adjust mate scores for retrieval (adjust back from root distance)
  let score = entry.score;
  if (score > 90000) {
    score = score - plyFromRoot;
  } else if (score < -90000) {
    score = score + plyFromRoot;
  }
  
  // Only use score if depth is sufficient
  if (entry.depth >= depth) {
    if (entry.flag === TT_EXACT) {
      return { hit: true, score, bestMove: entry.bestMove };
    } else if (entry.flag === TT_LOWERBOUND && score >= beta) {
      return { hit: true, score: beta, bestMove: entry.bestMove };
    } else if (entry.flag === TT_UPPERBOUND && score <= alpha) {
      return { hit: true, score: alpha, bestMove: entry.bestMove };
    }
  }
  
  // Return best move even if we can't use the score (for move ordering)
  return { hit: false, bestMove: entry.bestMove };
}

function clearTranspositionTable(): void {
  ttAge++;
  // Don't clear entries - just increment age for gradual replacement
}

// MVV-LVA score: Higher = search first
// Most Valuable Victim - Least Valuable Attacker
function getMvvLvaScore(move: Move): number {
  if (!move.captured) return 0;
  
  const victimValue = PIECE_VALUES[move.captured] || 0;
  const attackerValue = PIECE_VALUES[move.piece] || 0;
  
  // MVV-LVA: victim * 10 - attacker gives priority to low-value attackers capturing high-value victims
  return victimValue * 10 - attackerValue;
}

// Enhanced move ordering with killer moves and history heuristic
function orderMoves(
  moves: Move[], 
  bestMoveFromPrevious?: string,
  currentDepth?: number,
  useKillers: boolean = true,
  useHistory: boolean = true
): Move[] {
  const scored = moves.map(m => {
    let score = 0;
    
    // 1. Captures (MVV-LVA)
    score += getMvvLvaScore(m);
    
    // 2. Checks and checkmates
    if (m.san.includes('#')) score += 100000;
    else if (m.san.includes('+')) score += 500;
    
    // 3. Killer moves (moves that caused cutoffs at this depth)
    if (useKillers && currentDepth !== undefined && isKillerMove(currentDepth, m.san)) {
      // Only boost if not already a capture (captures already scored higher)
      if (!m.captured) score += 800;
    }
    
    // 4. History heuristic (moves that caused cutoffs across the search)
    if (useHistory) {
      const histScore = getHistoryScore(m.from, m.to);
      // Scale history score to be meaningful but not overwhelming
      score += Math.min(histScore / 10, 400);
    }
    
    // 5. Promotions
    if (m.promotion) {
      const promoValue = PIECE_VALUES[m.promotion] || 0;
      score += promoValue;
    }
    
    return { move: m, score };
  });
  
  scored.sort((a, b) => b.score - a.score);
  
  // If we have a best move from previous iteration, put it first
  if (bestMoveFromPrevious) {
    const idx = scored.findIndex(s => s.move.san === bestMoveFromPrevious);
    if (idx > 0) {
      const [best] = scored.splice(idx, 1);
      scored.unshift(best);
    }
  }
  
  return scored.map(s => s.move);
}

// ============================================
// PIECE-SQUARE TABLES (Opening/Middlegame)
// ============================================
const PST: Record<string, number[][]> = {
  p: [
    [0, 0, 0, 0, 0, 0, 0, 0],
    [50, 50, 50, 50, 50, 50, 50, 50],
    [10, 10, 20, 30, 30, 20, 10, 10],
    [5, 5, 10, 25, 25, 10, 5, 5],
    [0, 0, 0, 20, 20, 0, 0, 0],
    [5, -5, -10, 0, 0, -10, -5, 5],
    [5, 10, 10, -20, -20, 10, 10, 5],
    [0, 0, 0, 0, 0, 0, 0, 0],
  ],
  n: [
    [-50, -40, -30, -30, -30, -30, -40, -50],
    [-40, -20, 0, 0, 0, 0, -20, -40],
    [-30, 0, 10, 15, 15, 10, 0, -30],
    [-30, 5, 15, 20, 20, 15, 5, -30],
    [-30, 0, 15, 20, 20, 15, 0, -30],
    [-30, 5, 10, 15, 15, 10, 5, -30],
    [-40, -20, 0, 5, 5, 0, -20, -40],
    [-50, -40, -30, -30, -30, -30, -40, -50],
  ],
  b: [
    [-20, -10, -10, -10, -10, -10, -10, -20],
    [-10, 0, 0, 0, 0, 0, 0, -10],
    [-10, 0, 5, 10, 10, 5, 0, -10],
    [-10, 5, 5, 10, 10, 5, 5, -10],
    [-10, 0, 10, 10, 10, 10, 0, -10],
    [-10, 10, 10, 10, 10, 10, 10, -10],
    [-10, 5, 0, 0, 0, 0, 5, -10],
    [-20, -10, -10, -10, -10, -10, -10, -20],
  ],
  r: [
    [0, 0, 0, 0, 0, 0, 0, 0],
    [5, 10, 10, 10, 10, 10, 10, 5],
    [-5, 0, 0, 0, 0, 0, 0, -5],
    [-5, 0, 0, 0, 0, 0, 0, -5],
    [-5, 0, 0, 0, 0, 0, 0, -5],
    [-5, 0, 0, 0, 0, 0, 0, -5],
    [-5, 0, 0, 0, 0, 0, 0, -5],
    [0, 0, 0, 5, 5, 0, 0, 0],
  ],
  q: [
    [-20, -10, -10, -5, -5, -10, -10, -20],
    [-10, 0, 0, 0, 0, 0, 0, -10],
    [-10, 0, 5, 5, 5, 5, 0, -10],
    [-5, 0, 5, 5, 5, 5, 0, -5],
    [0, 0, 5, 5, 5, 5, 0, -5],
    [-10, 5, 5, 5, 5, 5, 0, -10],
    [-10, 0, 5, 0, 0, 0, 0, -10],
    [-20, -10, -10, -5, -5, -10, -10, -20],
  ],
  // King in middlegame: wants to castle and stay safe
  k: [
    [-30, -40, -40, -50, -50, -40, -40, -30],
    [-30, -40, -40, -50, -50, -40, -40, -30],
    [-30, -40, -40, -50, -50, -40, -40, -30],
    [-30, -40, -40, -50, -50, -40, -40, -30],
    [-20, -30, -30, -40, -40, -30, -30, -20],
    [-10, -20, -20, -20, -20, -20, -20, -10],
    [20, 20, 0, 0, 0, 0, 20, 20],
    [20, 30, 10, 0, 0, 10, 30, 20],
  ],
};

// ============================================
// ENDGAME PIECE-SQUARE TABLE FOR KING
// ============================================
// In endgame, king wants to be active and centralized
const PST_KING_ENDGAME: number[][] = [
  [-50, -40, -30, -20, -20, -30, -40, -50],
  [-30, -20, -10, 0, 0, -10, -20, -30],
  [-30, -10, 20, 30, 30, 20, -10, -30],
  [-30, -10, 30, 40, 40, 30, -10, -30],
  [-30, -10, 30, 40, 40, 30, -10, -30],
  [-30, -10, 20, 30, 30, 20, -10, -30],
  [-30, -30, 0, 0, 0, 0, -30, -30],
  [-50, -30, -30, -30, -30, -30, -30, -50],
];

// ============================================
// EVALUATION HELPER FUNCTIONS
// ============================================

// Calculate game phase (0 = endgame, 256 = opening/middlegame)
// Based on non-pawn material
function calculateGamePhase(game: Chess): number {
  const board = game.board();
  let phase = 0;
  
  // Phase values: N=1, B=1, R=2, Q=4
  const phaseValues: Record<string, number> = { n: 1, b: 1, r: 2, q: 4 };
  const maxPhase = 24; // 2*4 + 4*2 + 4*1 + 4*1 = 24
  
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece && piece.type !== 'p' && piece.type !== 'k') {
        phase += phaseValues[piece.type] || 0;
      }
    }
  }
  
  // Normalize to 0-256 range
  return Math.floor((phase * 256) / maxPhase);
}

// Find king position for a color
function findKingPosition(game: Chess, color: 'w' | 'b'): { row: number; col: number } | null {
  const board = game.board();
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece && piece.type === 'k' && piece.color === color) {
        return { row, col };
      }
    }
  }
  return null;
}

// Manhattan distance between two squares
function manhattanDistance(r1: number, c1: number, r2: number, c2: number): number {
  return Math.abs(r1 - r2) + Math.abs(c1 - c2);
}

// Get squares attacked by a piece from a given position
// Used by Tactician for fork detection
function getAttackedSquares(
  pieceType: string,
  row: number,
  col: number,
  board: ReturnType<Chess['board']>,
  _myColor: 'w' | 'b' // Unused but kept for potential future pawn attack direction
): { row: number; col: number }[] {
  const squares: { row: number; col: number }[] = [];
  
  if (pieceType === 'n') {
    // Knight moves in L-shape
    const knightOffsets = [
      [-2, -1], [-2, 1], [-1, -2], [-1, 2],
      [1, -2], [1, 2], [2, -1], [2, 1]
    ];
    for (const [dr, dc] of knightOffsets) {
      const r = row + dr;
      const c = col + dc;
      if (r >= 0 && r <= 7 && c >= 0 && c <= 7) {
        squares.push({ row: r, col: c });
      }
    }
  } else if (pieceType === 'b' || pieceType === 'r' || pieceType === 'q') {
    // Sliding pieces
    const directions = pieceType === 'r'
      ? [[0, 1], [0, -1], [1, 0], [-1, 0]]
      : pieceType === 'b'
      ? [[1, 1], [1, -1], [-1, 1], [-1, -1]]
      : [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    
    for (const [dr, dc] of directions) {
      for (let i = 1; i < 8; i++) {
        const r = row + dr * i;
        const c = col + dc * i;
        if (r < 0 || r > 7 || c < 0 || c > 7) break;
        
        squares.push({ row: r, col: c });
        
        // Stop at first piece (can attack it but not beyond)
        if (board[r]?.[c]) break;
      }
    }
  } else if (pieceType === 'k') {
    // King attacks adjacent squares
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const r = row + dr;
        const c = col + dc;
        if (r >= 0 && r <= 7 && c >= 0 && c <= 7) {
          squares.push({ row: r, col: c });
        }
      }
    }
  }
  // Pawns handled separately in fork logic since they only attack diagonally
  
  return squares;
}

// Distance from edge (0 = edge, 3 = center)
function distanceFromEdge(row: number, col: number): number {
  const rowDist = Math.min(row, 7 - row);
  const colDist = Math.min(col, 7 - col);
  return Math.min(rowDist, colDist);
}

// ============================================
// MOBILITY EVALUATION
// ============================================
function evaluateMobility(game: Chess, mobilityWeight: number): number {
  if (mobilityWeight === 0) return 0;
  
  const currentTurn = game.turn();
  
  // Count moves for current side
  const currentMoves = game.moves().length;
  
  // Switch turns to count opponent moves
  // This is a bit of a hack but works for mobility counting
  const fen = game.fen();
  const parts = fen.split(' ');
  parts[1] = currentTurn === 'w' ? 'b' : 'w';
  const oppFen = parts.join(' ');
  
  try {
    const oppGame = new Chess(oppFen);
    const oppMoves = oppGame.moves().length;
    
    // Mobility score: difference in available moves
    const mobilityDiff = currentMoves - oppMoves;
    
    // White to move: positive is good for white
    // Black to move: positive is good for black, so negate for white's perspective
    const score = currentTurn === 'w' ? mobilityDiff : -mobilityDiff;
    
    return score * mobilityWeight;
  } catch {
    // If FEN manipulation fails, just return current side's mobility
    return (currentTurn === 'w' ? currentMoves : -currentMoves) * mobilityWeight * 0.5;
  }
}

// ============================================
// KING SAFETY EVALUATION (Enhanced with GM features)
// ============================================
// Starting material for scaling (Queen=900, 2Rooks=1000, 2Bishops=660, 2Knights=640, 8Pawns=800)
const STARTING_MATERIAL = 4000; // Per side (excluding king)

function evaluateKingSafety(game: Chess, kingSafetyWeight: number): number {
  if (kingSafetyWeight === 0) return 0;
  
  const board = game.board();
  let whiteKingSafety = 0;
  let blackKingSafety = 0;
  
  const whiteKing = findKingPosition(game, 'w');
  const blackKing = findKingPosition(game, 'b');
  
  if (!whiteKing || !blackKing) return 0;
  
  // Count material for GM Scaling Factor
  let whiteMaterial = 0;
  let blackMaterial = 0;
  let whiteHasQueen = false;
  let blackHasQueen = false;
  
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece && piece.type !== 'k') {
        const value = PIECE_VALUES[piece.type] || 0;
        if (piece.color === 'w') {
          whiteMaterial += value;
          if (piece.type === 'q') whiteHasQueen = true;
        } else {
          blackMaterial += value;
          if (piece.type === 'q') blackHasQueen = true;
        }
      }
    }
  }
  
  // GM Scaling Factor: King safety matters less when queens are off or material is low
  // White's king safety scales with black's attacking material (and vice versa)
  const whiteScalingFactor = blackMaterial / STARTING_MATERIAL;
  const blackScalingFactor = whiteMaterial / STARTING_MATERIAL;
  
  // Extra reduction if opponent has no queen (primary attacker)
  const whiteQueenFactor = blackHasQueen ? 1.0 : 0.5;
  const blackQueenFactor = whiteHasQueen ? 1.0 : 0.5;
  
  // Detect opposite-side castling (kings on opposite wings)
  const whiteKingSide = whiteKing.col >= 4 ? 'kingside' : 'queenside';
  const blackKingSide = blackKing.col >= 4 ? 'kingside' : 'queenside';
  const oppositeSideCastling = whiteKingSide !== blackKingSide && 
    whiteKing.row >= 6 && blackKing.row <= 1; // Both castled
  
  // Pawn shield evaluation (for castled kings)
  function evaluatePawnShield(kingRow: number, kingCol: number, color: 'w' | 'b'): number {
    let shield = 0;
    const direction = color === 'w' ? -1 : 1;
    
    // Check 2nd and 3rd rank pawns in front of king
    for (let c = Math.max(0, kingCol - 1); c <= Math.min(7, kingCol + 1); c++) {
      // Ideal pawn position (2nd rank from king's perspective)
      const idealRow = kingRow + direction;
      // Advanced pawn position (3rd rank)
      const advancedRow = kingRow + direction * 2;
      
      if (idealRow >= 0 && idealRow <= 7) {
        const piece = board[idealRow][c];
        if (piece && piece.type === 'p' && piece.color === color) {
          shield += 20; // Strong bonus for pawn on 2nd rank
        }
      }
      
      if (advancedRow >= 0 && advancedRow <= 7) {
        const piece = board[advancedRow][c];
        if (piece && piece.type === 'p' && piece.color === color) {
          shield += 10; // Smaller bonus for pawn on 3rd rank (slightly advanced)
        }
      }
    }
    return shield;
  }
  
  // Open file near king penalty
  function evaluateOpenFilesNearKing(kingCol: number, color: 'w' | 'b'): number {
    let penalty = 0;
    
    for (let c = Math.max(0, kingCol - 1); c <= Math.min(7, kingCol + 1); c++) {
      let hasFriendlyPawn = false;
      let hasEnemyPawn = false;
      
      for (let r = 0; r < 8; r++) {
        const piece = board[r][c];
        if (piece && piece.type === 'p') {
          if (piece.color === color) hasFriendlyPawn = true;
          else hasEnemyPawn = true;
        }
      }
      
      // Semi-open file (no friendly pawn): -25
      // Open file (no pawns): -60 (rooks can attack king)
      if (!hasFriendlyPawn && !hasEnemyPawn) penalty -= 60;
      else if (!hasFriendlyPawn) penalty -= 25;
    }
    
    return penalty;
  }
  
  // Pawn storm detection: enemy pawns advancing toward our king
  function evaluatePawnStorm(kingRow: number, kingCol: number, color: 'w' | 'b'): number {
    let penalty = 0;
    const enemyColor = color === 'w' ? 'b' : 'w';
    
    // For white king, enemy pawns advance from low rows to high rows
    // For black king, enemy pawns advance from high rows to low rows
    for (let c = Math.max(0, kingCol - 1); c <= Math.min(7, kingCol + 1); c++) {
      let highestEnemyPawnRank = -1;
      let ourShieldPawnRow = -1;
      
      for (let r = 0; r < 8; r++) {
        const piece = board[r][c];
        if (piece && piece.type === 'p') {
          if (piece.color === enemyColor) {
            // Convert row to "rank toward king" (0-7 scale where higher = closer to king)
            const rankTowardKing = color === 'w' ? r : (7 - r);
            if (rankTowardKing > highestEnemyPawnRank) {
              highestEnemyPawnRank = rankTowardKing;
            }
          } else if (piece.color === color) {
            // Track our shield pawn for lever detection
            const distFromKing = Math.abs(r - kingRow);
            if (distFromKing <= 2) {
              ourShieldPawnRow = r;
            }
          }
        }
      }
      
      // Penalty for enemy pawns past halfway (rank 4+)
      // Rank 4 = 20, Rank 5 = 40, Rank 6 = 60
      if (highestEnemyPawnRank >= 4) {
        penalty -= (highestEnemyPawnRank - 3) * 20;
      }
      
      // LEVER DETECTION: Enemy pawn directly contacts our shield pawn
      // This means a pawn break is imminent, spike the penalty
      if (ourShieldPawnRow !== -1 && highestEnemyPawnRank >= 4) {
        const enemyPawnRow = color === 'w' ? highestEnemyPawnRank : (7 - highestEnemyPawnRank);
        const rowDiff = Math.abs(enemyPawnRow - ourShieldPawnRow);
        if (rowDiff <= 1) {
          penalty -= 30; // Lever bonus: imminent file opening
        }
      }
    }
    
    return penalty;
  }
  
  // White king safety
  if (whiteKing.row >= 6) { // King on back ranks (castled)
    whiteKingSafety += evaluatePawnShield(whiteKing.row, whiteKing.col, 'w');
    whiteKingSafety += evaluateOpenFilesNearKing(whiteKing.col, 'w');
    whiteKingSafety += evaluatePawnStorm(whiteKing.row, whiteKing.col, 'w');
  } else if (whiteKing.row >= 4) {
    // King in center is bad in opening/middlegame
    whiteKingSafety -= 30;
  }
  // King in endgame position (active) - no penalty
  
  // Black king safety
  if (blackKing.row <= 1) { // King on back ranks (castled)
    blackKingSafety += evaluatePawnShield(blackKing.row, blackKing.col, 'b');
    blackKingSafety += evaluateOpenFilesNearKing(blackKing.col, 'b');
    blackKingSafety += evaluatePawnStorm(blackKing.row, blackKing.col, 'b');
  } else if (blackKing.row <= 3) {
    blackKingSafety -= 30;
  }
  
  // Apply GM Scaling Factor: reduce king safety importance as material decreases
  whiteKingSafety *= whiteScalingFactor * whiteQueenFactor;
  blackKingSafety *= blackScalingFactor * blackQueenFactor;
  
  // Opposite-side castling bonus: both sides should value attacking more
  // (This is handled in personality scoring, but we note it here)
  
  return (whiteKingSafety - blackKingSafety) * kingSafetyWeight / 100;
}

// Helper to detect if position has opposite-side castling (used by personality scoring)
function detectOppositeSideCastling(game: Chess): boolean {
  const board = game.board();
  const whiteKing = findKingPosition(game, 'w');
  const blackKing = findKingPosition(game, 'b');
  
  if (!whiteKing || !blackKing) return false;
  
  // Check if both kings are castled (on back ranks)
  const whiteCastled = whiteKing.row >= 6;
  const blackCastled = blackKing.row <= 1;
  
  if (!whiteCastled || !blackCastled) return false;
  
  // Check if on opposite sides
  const whiteKingSide = whiteKing.col >= 4; // true = kingside
  const blackKingSide = blackKing.col >= 4;
  
  return whiteKingSide !== blackKingSide;
}

// ============================================
// MOP-UP ENDGAME HEURISTIC
// ============================================
// In winning endgames, push enemy king to edge and bring your king close
function evaluateMopUp(game: Chess, mopUpWeight: number): number {
  if (mopUpWeight === 0) return 0;
  
  const board = game.board();
  
  // Count material to determine if we're in a mop-up situation
  let whiteMaterial = 0;
  let blackMaterial = 0;
  
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece && piece.type !== 'k') {
        const value = PIECE_VALUES[piece.type] || 0;
        if (piece.color === 'w') whiteMaterial += value;
        else blackMaterial += value;
      }
    }
  }
  
  // Only apply mop-up if one side has significant material advantage
  const materialDiff = whiteMaterial - blackMaterial;
  const threshold = 400; // About a rook advantage
  
  if (Math.abs(materialDiff) < threshold) return 0;
  
  const whiteKing = findKingPosition(game, 'w');
  const blackKing = findKingPosition(game, 'b');
  
  if (!whiteKing || !blackKing) return 0;
  
  let score = 0;
  
  if (materialDiff > threshold) {
    // White is winning - push black king to edge, bring white king close
    const blackEdgeDist = distanceFromEdge(blackKing.row, blackKing.col);
    const kingDistance = manhattanDistance(whiteKing.row, whiteKing.col, blackKing.row, blackKing.col);
    
    // Reward pushing enemy king to edge (3 = center, 0 = edge)
    score += (3 - blackEdgeDist) * 20;
    // Reward bringing our king closer (max distance = 14, min = 1)
    score += (14 - kingDistance) * 5;
  } else if (materialDiff < -threshold) {
    // Black is winning - push white king to edge, bring black king close
    const whiteEdgeDist = distanceFromEdge(whiteKing.row, whiteKing.col);
    const kingDistance = manhattanDistance(whiteKing.row, whiteKing.col, blackKing.row, blackKing.col);
    
    score -= (3 - whiteEdgeDist) * 20;
    score -= (14 - kingDistance) * 5;
  }
  
  return score * mopUpWeight / 100;
}

// ============================================
// ADVANCED PAWN STRUCTURE EVALUATION
// (Used only for Grandmaster difficulty)
// ============================================

// Evaluate passed pawns, isolated pawns, doubled pawns
function evaluatePawnStructure(game: Chess): number {
  const board = game.board();
  let score = 0;
  
  // Track pawns by file for each color
  const whitePawnsByFile: number[][] = Array.from({ length: 8 }, () => []);
  const blackPawnsByFile: number[][] = Array.from({ length: 8 }, () => []);
  
  // Collect pawn positions
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece?.type === 'p') {
        if (piece.color === 'w') {
          whitePawnsByFile[col].push(row);
        } else {
          blackPawnsByFile[col].push(row);
        }
      }
    }
  }
  
  // Evaluate each white pawn
  // White pawns advance from row 6 (rank 2) toward row 0 (rank 8)
  for (let col = 0; col < 8; col++) {
    for (const row of whitePawnsByFile[col]) {
      // Passed pawn check: no enemy pawns ahead (lower row numbers) on same or adjacent files
      let isPassed = true;
      for (let checkCol = Math.max(0, col - 1); checkCol <= Math.min(7, col + 1); checkCol++) {
        // Check if any black pawn exists ahead of this white pawn (row < current row)
        if (blackPawnsByFile[checkCol].some(r => r < row)) {
          isPassed = false;
          break;
        }
      }
      if (isPassed) {
        // Bonus increases as pawn advances (row 1 is one step from promotion)
        score += 20 + (7 - row) * 10;
      }
      
      // Isolated pawn: no friendly pawns on adjacent files
      const hasAdjacentPawn = 
        (col > 0 && whitePawnsByFile[col - 1].length > 0) ||
        (col < 7 && whitePawnsByFile[col + 1].length > 0);
      if (!hasAdjacentPawn) {
        score -= 15;
      }
    }
    
    // Doubled pawns: penalty for multiple pawns on same file
    if (whitePawnsByFile[col].length > 1) {
      score -= 10 * (whitePawnsByFile[col].length - 1);
    }
  }
  
  // Evaluate each black pawn
  // Black pawns advance from row 1 (rank 7) toward row 7 (rank 1)
  for (let col = 0; col < 8; col++) {
    for (const row of blackPawnsByFile[col]) {
      // Passed pawn check: no enemy pawns ahead (higher row numbers) on same or adjacent files
      let isPassed = true;
      for (let checkCol = Math.max(0, col - 1); checkCol <= Math.min(7, col + 1); checkCol++) {
        // Check if any white pawn exists ahead of this black pawn (row > current row)
        if (whitePawnsByFile[checkCol].some(r => r > row)) {
          isPassed = false;
          break;
        }
      }
      if (isPassed) {
        // Bonus increases as pawn advances (row 6 is one step from promotion)
        score -= 20 + row * 10;
      }
      
      // Isolated pawn
      const hasAdjacentPawn = 
        (col > 0 && blackPawnsByFile[col - 1].length > 0) ||
        (col < 7 && blackPawnsByFile[col + 1].length > 0);
      if (!hasAdjacentPawn) {
        score += 15;
      }
    }
    
    // Doubled pawns
    if (blackPawnsByFile[col].length > 1) {
      score += 10 * (blackPawnsByFile[col].length - 1);
    }
  }
  
  return score;
}

// ============================================
// ENHANCED POSITION EVALUATION
// ============================================
// Evaluation weights that scale with difficulty
interface EvalWeights {
  mobility: number;      // 0-100%
  kingSafety: number;    // 0-100%
  mopUp: number;         // 0-100%
  useTaperedEval: boolean;
  usePawnStructure?: boolean; // For Grandmaster
}

const DEFAULT_EVAL_WEIGHTS: EvalWeights = {
  mobility: 100,
  kingSafety: 100,
  mopUp: 100,
  useTaperedEval: true,
};

function evaluatePosition(game: Chess, weights: EvalWeights = DEFAULT_EVAL_WEIGHTS): number {
  const board = game.board();
  const phase = calculateGamePhase(game);
  const endgamePhase = 256 - phase; // 0 in opening, 256 in endgame
  
  let mgScore = 0; // Middlegame score
  let egScore = 0; // Endgame score

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece) {
        const mgPieceValue = PIECE_VALUES[piece.type];
        const egPieceValue = weights.useTaperedEval ? PIECE_VALUES_ENDGAME[piece.type] : mgPieceValue;
        
        // Get PST values
        const tableRow = piece.color === 'w' ? 7 - row : row;
        let mgPositionValue = 0;
        let egPositionValue = 0;
        
        if (piece.type === 'k') {
          mgPositionValue = PST.k[tableRow][col];
          egPositionValue = weights.useTaperedEval ? PST_KING_ENDGAME[tableRow][col] : mgPositionValue;
        } else {
          const pst = PST[piece.type];
          mgPositionValue = pst ? pst[tableRow][col] : 0;
          egPositionValue = mgPositionValue; // Same PST for non-king pieces
        }
        
        const mgTotal = mgPieceValue + mgPositionValue;
        const egTotal = egPieceValue + egPositionValue;
        
        if (piece.color === 'w') {
          mgScore += mgTotal;
          egScore += egTotal;
        } else {
          mgScore -= mgTotal;
          egScore -= egTotal;
        }
      }
    }
  }
  
  // Tapered evaluation: blend mg and eg scores based on phase
  let score: number;
  if (weights.useTaperedEval) {
    score = ((mgScore * phase) + (egScore * endgamePhase)) / 256;
  } else {
    score = mgScore;
  }
  
  // Add mobility score
  if (weights.mobility > 0) {
    score += evaluateMobility(game, weights.mobility / 100 * 3); // Scale factor of 3 per move
  }
  
  // Add king safety (more important in middlegame)
  if (weights.kingSafety > 0 && phase > 64) { // Only in non-endgame
    score += evaluateKingSafety(game, weights.kingSafety);
  }
  
  // Add mop-up heuristic (only in endgame with material advantage)
  if (weights.mopUp > 0 && phase < 128) { // Only when approaching endgame
    score += evaluateMopUp(game, weights.mopUp);
  }
  
  // Add pawn structure evaluation (Grandmaster only)
  if (weights.usePawnStructure) {
    score += evaluatePawnStructure(game);
  }

  return score;
}

// Quiescence search with stand-pat rule
function quiescence(
  game: Chess, 
  alpha: number, 
  beta: number, 
  depth: number = 0,
  evalWeights: EvalWeights = DEFAULT_EVAL_WEIGHTS
): number {
  // Stand-pat: evaluate current position without forcing captures
  const standPat = evaluatePosition(game, evalWeights);
  
  // Beta cutoff: position is already too good
  if (standPat >= beta) {
    return beta;
  }
  
  // Update alpha if stand-pat is better
  if (standPat > alpha) {
    alpha = standPat;
  }
  
  // Don't go too deep in quiescence
  if (depth > 6) {
    return standPat;
  }
  
  // Only look at captures and checks
  const moves = game.moves({ verbose: true });
  const tacticalMoves = moves.filter(m => m.captured || m.san.includes('+'));
  
  // Order by MVV-LVA
  const orderedMoves = orderMoves(tacticalMoves);
  
  for (const move of orderedMoves) {
    game.move(move.san);
    const score = -quiescence(game, -beta, -alpha, depth + 1, evalWeights);
    game.undo();
    
    if (score >= beta) {
      return beta;
    }
    if (score > alpha) {
      alpha = score;
    }
  }
  
  return alpha;
}

// Enhanced minimax with alpha-beta pruning, killer moves, and history heuristic
interface MinimaxConfig {
  useKillers: boolean;
  useHistory: boolean;
  evalWeights: EvalWeights;
}

const DEFAULT_MINIMAX_CONFIG: MinimaxConfig = {
  useKillers: true,
  useHistory: true,
  evalWeights: DEFAULT_EVAL_WEIGHTS,
};

function minimax(
  game: Chess,
  depth: number,
  alpha: number,
  beta: number,
  maximizing: boolean,
  bestMoveFromPrevious?: string,
  maxDepth?: number,
  config: MinimaxConfig = DEFAULT_MINIMAX_CONFIG
): { score: number; bestMove?: string } {
  const currentDepth = maxDepth !== undefined ? maxDepth - depth : depth;
  
  if (depth === 0) {
    // Use quiescence search at leaf nodes with difficulty-scaled evaluation
    const qScore = maximizing 
      ? quiescence(game, alpha, beta, 0, config.evalWeights)
      : -quiescence(game, -beta, -alpha, 0, config.evalWeights);
    return { score: qScore };
  }
  
  if (game.isGameOver()) {
    if (game.isCheckmate()) {
      return { score: maximizing ? -99999 : 99999 };
    }
    return { score: 0 }; // Draw
  }

  const moves = game.moves({ verbose: true });
  const orderedMoves = orderMoves(
    moves, 
    bestMoveFromPrevious, 
    currentDepth,
    config.useKillers,
    config.useHistory
  );
  
  let bestMove = orderedMoves[0]?.san;

  if (maximizing) {
    let maxEval = -Infinity;
    for (const move of orderedMoves) {
      game.move(move.san);
      const result = minimax(game, depth - 1, alpha, beta, false, undefined, maxDepth, config);
      game.undo();
      
      if (result.score > maxEval) {
        maxEval = result.score;
        bestMove = move.san;
      }
      
      if (result.score >= beta) {
        // Beta cutoff - store killer move and update history
        if (!move.captured && config.useKillers) {
          storeKillerMove(currentDepth, move.san);
        }
        if (config.useHistory) {
          updateHistory(move.from, move.to, depth);
        }
        return { score: beta, bestMove };
      }
      
      alpha = Math.max(alpha, result.score);
    }
    return { score: maxEval, bestMove };
  } else {
    let minEval = Infinity;
    for (const move of orderedMoves) {
      game.move(move.san);
      const result = minimax(game, depth - 1, alpha, beta, true, undefined, maxDepth, config);
      game.undo();
      
      if (result.score < minEval) {
        minEval = result.score;
        bestMove = move.san;
      }
      
      if (result.score <= alpha) {
        // Alpha cutoff - store killer move and update history
        if (!move.captured && config.useKillers) {
          storeKillerMove(currentDepth, move.san);
        }
        if (config.useHistory) {
          updateHistory(move.from, move.to, depth);
        }
        return { score: alpha, bestMove };
      }
      
      beta = Math.min(beta, result.score);
    }
    return { score: minEval, bestMove };
  }
}

// ============================================
// TT-ENHANCED MINIMAX (Grandmaster Only)
// Uses transposition table for position caching
// ============================================
function minimaxWithTT(
  game: Chess,
  depth: number,
  alpha: number,
  beta: number,
  plyFromRoot: number,
  maxDepth: number,
  config: MinimaxConfig
): { score: number; bestMove?: string } {
  // Probe transposition table
  const hash = computeZobristHash(game);
  const ttResult = ttProbe(hash, depth, alpha, beta, plyFromRoot);
  
  if (ttResult.hit && ttResult.score !== undefined) {
    return { score: ttResult.score, bestMove: ttResult.bestMove ?? undefined };
  }
  
  // Base case: use quiescence search
  if (depth === 0) {
    const qScore = quiescence(game, alpha, beta, 0, config.evalWeights);
    ttStore(hash, 0, qScore, TT_EXACT, null, plyFromRoot);
    return { score: qScore };
  }
  
  // Game over check
  if (game.isGameOver()) {
    if (game.isCheckmate()) {
      const mateScore = -99999 + plyFromRoot;
      return { score: mateScore };
    }
    return { score: 0 }; // Draw
  }

  const moves = game.moves({ verbose: true });
  
  // Use TT best move for ordering if available
  const orderedMoves = orderMoves(
    moves, 
    ttResult.bestMove ?? undefined,
    maxDepth - depth,
    config.useKillers,
    config.useHistory
  );
  
  let bestMove = orderedMoves[0]?.san;
  let bestScore = -Infinity;
  let flag = TT_UPPERBOUND;

  for (const move of orderedMoves) {
    game.move(move.san);
    const result = minimaxWithTT(game, depth - 1, -beta, -alpha, plyFromRoot + 1, maxDepth, config);
    const score = -result.score;
    game.undo();
    
    if (score > bestScore) {
      bestScore = score;
      bestMove = move.san;
    }
    
    if (score >= beta) {
      // Beta cutoff
      if (!move.captured && config.useKillers) {
        storeKillerMove(maxDepth - depth, move.san);
      }
      if (config.useHistory) {
        updateHistory(move.from, move.to, depth);
      }
      ttStore(hash, depth, beta, TT_LOWERBOUND, bestMove, plyFromRoot);
      return { score: beta, bestMove };
    }
    
    if (score > alpha) {
      alpha = score;
      flag = TT_EXACT;
    }
  }
  
  ttStore(hash, depth, bestScore, flag, bestMove, plyFromRoot);
  return { score: bestScore, bestMove };
}

// Iterative deepening with TT for Grandmaster
function iterativeDeepeningWithTT(
  game: Chess,
  maxTimeMs: number,
  maxDepth: number,
  config: DifficultyConfig
): { bestMove: string; depth: number; score: number } {
  const startTime = Date.now();
  const moveOverhead = 100;
  const timeLimit = maxTimeMs - moveOverhead;
  
  clearKillerMoves();
  clearTranspositionTable();
  
  let bestMove = '';
  let bestScore = 0;
  let reachedDepth = 0;
  
  const minimaxConfig: MinimaxConfig = {
    useKillers: config.useKillers,
    useHistory: config.useHistory,
    evalWeights: {
      mobility: config.mobilityWeight,
      kingSafety: config.kingSafetyWeight,
      mopUp: config.mopUpWeight,
      useTaperedEval: config.useTaperedEval,
      usePawnStructure: true, // Grandmaster uses advanced pawn evaluation
    },
  };
  
  for (let depth = 1; depth <= maxDepth; depth++) {
    const elapsed = Date.now() - startTime;
    
    if (elapsed > timeLimit * 0.7 && depth > 1) {
      break;
    }
    
    const result = minimaxWithTT(game, depth, -Infinity, Infinity, 0, depth, minimaxConfig);
    
    if (result.bestMove) {
      bestMove = result.bestMove;
      bestScore = result.score;
      reachedDepth = depth;
    }
    
    if (Math.abs(result.score) > 90000) {
      break;
    }
  }
  
  return { bestMove, depth: reachedDepth, score: bestScore };
}

// Iterative deepening with time management
function iterativeDeepening(
  game: Chess,
  maxTimeMs: number,
  maxDepth: number = 10,
  config?: DifficultyConfig
): { bestMove: string; depth: number; score: number } {
  const startTime = Date.now();
  const moveOverhead = 100; // Buffer for network latency
  const timeLimit = maxTimeMs - moveOverhead;
  
  // Clear killer moves and history for new search
  clearKillerMoves();
  // Don't clear history - it accumulates across moves for better ordering
  
  let bestMove = '';
  let bestScore = 0;
  let reachedDepth = 0;
  
  const maximizing = game.turn() === 'w';
  
  // Build minimax config from difficulty config
  const minimaxConfig: MinimaxConfig = config ? {
    useKillers: config.useKillers,
    useHistory: config.useHistory,
    evalWeights: {
      mobility: config.mobilityWeight,
      kingSafety: config.kingSafetyWeight,
      mopUp: config.mopUpWeight,
      useTaperedEval: config.useTaperedEval,
    },
  } : DEFAULT_MINIMAX_CONFIG;
  
  for (let depth = 1; depth <= maxDepth; depth++) {
    const elapsed = Date.now() - startTime;
    
    // Stop if we've used 70% of time (to ensure we complete current depth)
    if (elapsed > timeLimit * 0.7 && depth > 1) {
      break;
    }
    
    const result = minimax(game, depth, -Infinity, Infinity, maximizing, bestMove, depth, minimaxConfig);
    
    if (result.bestMove) {
      bestMove = result.bestMove;
      bestScore = result.score;
      reachedDepth = depth;
    }
    
    // If we found a mate, stop searching
    if (Math.abs(result.score) > 90000) {
      break;
    }
  }
  
  return { bestMove, depth: reachedDepth, score: bestScore };
}

// Difficulty settings with evaluation weights
interface DifficultyConfig {
  elo: number;
  timePerMoveMs: number;
  maxDepth: number;
  multiPvCount: number;
  stockfishNodes: number;
  mistakeProbability: number;
  useStockfish: boolean;
  // New evaluation weights (0-100%)
  useKillers: boolean;       // Use killer move heuristic
  useHistory: boolean;       // Use history heuristic
  mobilityWeight: number;    // Mobility evaluation weight (0-100)
  kingSafetyWeight: number;  // King safety evaluation weight (0-100)
  mopUpWeight: number;       // Mop-up endgame weight (0-100)
  useTaperedEval: boolean;   // Use tapered evaluation
  // Draw-seeking behavior (survival mode)
  drawSeekThreshold: number; // Evaluation threshold to trigger draw-seeking (negative = losing)
  // Recapture awareness (0-1, probability of seeing recaptures)
  recaptureChance: number;   // Probability (0-1) that bot will prioritize recapturing valuable pieces
}

// ============================================
// DRAW-SEEKING / SURVIVAL MODE
// ============================================
// Position history for repetition detection
// Maps position hash (board + castling + en passant, NOT move count) to occurrence count
let positionHistory: Map<string, number> = new Map();

// Extract position key from FEN (excludes halfmove clock and fullmove number)
function getPositionKey(fen: string): string {
  // FEN format: pieces activeColor castling enPassant halfmoveClock fullmoveNumber
  // We want: pieces activeColor castling enPassant (to detect repetitions)
  const parts = fen.split(' ');
  return parts.slice(0, 4).join(' ');
}

// Record a position in history (call after each move)
export function recordPosition(fen: string): void {
  const key = getPositionKey(fen);
  const count = positionHistory.get(key) || 0;
  positionHistory.set(key, count + 1);
}

// Clear position history (call when starting a new game)
export function clearPositionHistory(): void {
  positionHistory = new Map();
}

// Check how many times a position has occurred
export function getPositionCount(fen: string): number {
  const key = getPositionKey(fen);
  return positionHistory.get(key) || 0;
}

// Check if a move would create a repeated position
function wouldRepeatPosition(game: Chess, move: Move): { repeats: boolean; count: number } {
  // Make the move on a copy
  const testGame = new Chess(game.fen());
  testGame.move(move.san);
  const newFen = testGame.fen();
  const count = getPositionCount(newFen);
  // If count >= 1, playing this move creates a position we've seen before
  // If count >= 2, this would be the 3rd occurrence (threefold repetition = draw)
  return { repeats: count >= 1, count: count + 1 };
}

// Check if bot should enter "survival mode" (seek draws when losing)
function shouldSeekDraw(
  evaluation: number, 
  difficulty: BotDifficulty, 
  moveCount: number,
  botColor: 'w' | 'b',
  personality: BotPersonality
): boolean {
  const config = DIFFICULTY_CONFIG[difficulty];
  
  // Safeguard 1: Only after move 20 to avoid early "draw cowardice"
  if (moveCount < 20) {
    return false;
  }
  
  // Safeguard 2: Only seek draws if below the difficulty's threshold
  // Evaluation is always from White's perspective, so adjust for bot's color
  const botEval = botColor === 'w' ? evaluation : -evaluation;
  
  // Tactician penalty: subtract 2.0 from threshold (fights harder, seeks draws less)
  // GM Tactician: -1.0 - 2.0 = -3.0 (fights until down a minor piece)
  const isTactician = personality === 'tactician';
  const tacticianPenalty = isTactician ? 2.0 : 0;
  const effectiveThreshold = config.drawSeekThreshold - tacticianPenalty;
  
  // Only enter survival mode if we're losing (botEval < threshold)
  const shouldSeek = botEval < effectiveThreshold;
  
  if (isTactician && shouldSeek) {
    console.log(`[DrawSeek] Tactician entering survival mode at eval ${botEval.toFixed(2)} (threshold: ${effectiveThreshold.toFixed(1)}, normal: ${config.drawSeekThreshold})`);
  }
  
  return shouldSeek;
}

const DIFFICULTY_CONFIG: Record<BotDifficulty, DifficultyConfig> = {
  // Patzer (400 Elo): The Blunderer - sees hanging pieces but often ignores them
  // MultiPV 3 with 50K nodes = Depth 2-3, believable mistakes
  patzer: { 
    elo: 400, timePerMoveMs: 500, maxDepth: 1, multiPvCount: 3, stockfishNodes: 50000, 
    mistakeProbability: 0.33, useStockfish: false,
    useKillers: false, useHistory: false,
    mobilityWeight: 0, kingSafetyWeight: 0, mopUpWeight: 0, useTaperedEval: false,
    drawSeekThreshold: -99, // Never seeks draws
    recaptureChance: 0.25   // 25% chance to see recaptures
  },
  // Novice (600 Elo): The Blunderer tier
  // MultiPV 3 with 50K nodes
  novice: { 
    elo: 600, timePerMoveMs: 1000, maxDepth: 1, multiPvCount: 3, stockfishNodes: 50000, 
    mistakeProbability: 0.25, useStockfish: false,
    useKillers: false, useHistory: false,
    mobilityWeight: 20, kingSafetyWeight: 10, mopUpWeight: 0, useTaperedEval: false,
    drawSeekThreshold: -99, // Never seeks draws
    recaptureChance: 0.5    // 50% chance to see recaptures
  },
  // Intermediate (800 Elo): The Blunderer tier
  // MultiPV 3 with 50K nodes
  intermediate: { 
    elo: 800, timePerMoveMs: 1500, maxDepth: 2, multiPvCount: 3, stockfishNodes: 50000, 
    mistakeProbability: 0.17, useStockfish: true,
    useKillers: false, useHistory: false,
    mobilityWeight: 40, kingSafetyWeight: 30, mopUpWeight: 20, useTaperedEval: false,
    drawSeekThreshold: -4.0,
    recaptureChance: 0.75    // 75% chance to see recaptures
  },
  // Improving (1000 Elo): The Casual - needs more nodes to not miss M1
  // MultiPV 3 with 150K nodes
  improving: { 
    elo: 1000, timePerMoveMs: 1500, maxDepth: 3, multiPvCount: 3, stockfishNodes: 150000, 
    mistakeProbability: 0.10, useStockfish: true,
    useKillers: true, useHistory: false,
    mobilityWeight: 40, kingSafetyWeight: 30, mopUpWeight: 20, useTaperedEval: false,
    drawSeekThreshold: -4.0,
    recaptureChance: 0.75
  },
  // Club (1200 Elo): The Casual tier
  // MultiPV 3 with 150K nodes
  club: { 
    elo: 1200, timePerMoveMs: 2000, maxDepth: 3, multiPvCount: 3, stockfishNodes: 150000, 
    mistakeProbability: 0.08, useStockfish: true,
    useKillers: true, useHistory: true,
    mobilityWeight: 60, kingSafetyWeight: 50, mopUpWeight: 50, useTaperedEval: true,
    drawSeekThreshold: -4.0,
    recaptureChance: 1.0     // 100% chance to see recaptures
  },
  // Advanced (1400 Elo): The Club Player - tunnel vision on 2 best moves
  // MultiPV 2 with 400K nodes = Depth 5-6, won't blunder Queen
  advanced: { 
    elo: 1400, timePerMoveMs: 2500, maxDepth: 4, multiPvCount: 2, stockfishNodes: 400000, 
    mistakeProbability: 0.06, useStockfish: true,
    useKillers: true, useHistory: true,
    mobilityWeight: 70, kingSafetyWeight: 60, mopUpWeight: 70, useTaperedEval: true,
    drawSeekThreshold: -3.5,
    recaptureChance: 1.0     // 100% chance to see recaptures
  },
  // Strong (1600 Elo): The Club Player tier
  // MultiPV 2 with 400K nodes
  strong: { 
    elo: 1600, timePerMoveMs: 2500, maxDepth: 5, multiPvCount: 2, stockfishNodes: 400000, 
    mistakeProbability: 0.04, useStockfish: true,
    useKillers: true, useHistory: true,
    mobilityWeight: 80, kingSafetyWeight: 70, mopUpWeight: 70, useTaperedEval: true,
    drawSeekThreshold: -3.5,
    recaptureChance: 1.0
  },
  // Expert (1800 Elo): The Expert - tactical monster, punishes every slip
  // MultiPV 1 with 2M nodes = pure depth
  expert: { 
    elo: 1800, timePerMoveMs: 3000, maxDepth: 6, multiPvCount: 1, stockfishNodes: 2000000, 
    mistakeProbability: 0.03, useStockfish: true,
    useKillers: true, useHistory: true,
    mobilityWeight: 90, kingSafetyWeight: 90, mopUpWeight: 90, useTaperedEval: true,
    drawSeekThreshold: -3.0,
    recaptureChance: 1.0     // 100% chance to see recaptures
  },
  // Master (2000 Elo): The Expert tier
  // MultiPV 1 with 2M nodes
  master: { 
    elo: 2000, timePerMoveMs: 4000, maxDepth: 7, multiPvCount: 1, stockfishNodes: 2000000, 
    mistakeProbability: 0.02, useStockfish: true,
    useKillers: true, useHistory: true,
    mobilityWeight: 95, kingSafetyWeight: 95, mopUpWeight: 95, useTaperedEval: true,
    drawSeekThreshold: -2.5,
    recaptureChance: 1.0     // 100% chance to see recaptures
  },
  // Candidate (2200 Elo): The Grandmaster - pure depth, essentially unbeatable
  // MultiPV 1 with 5M nodes = Depth 8-10
  candidate: { 
    elo: 2200, timePerMoveMs: 4000, maxDepth: 7, multiPvCount: 1, stockfishNodes: 5000000, 
    mistakeProbability: 0.01, useStockfish: true,
    useKillers: true, useHistory: true,
    mobilityWeight: 95, kingSafetyWeight: 100, mopUpWeight: 100, useTaperedEval: true,
    drawSeekThreshold: -2.5,
    recaptureChance: 1.0
  },
  // Elite (2400 Elo): The Grandmaster tier
  // MultiPV 1 with 5M nodes
  elite: { 
    elo: 2400, timePerMoveMs: 5000, maxDepth: 8, multiPvCount: 1, stockfishNodes: 5000000, 
    mistakeProbability: 0.0025, useStockfish: true,
    useKillers: true, useHistory: true,
    mobilityWeight: 100, kingSafetyWeight: 100, mopUpWeight: 100, useTaperedEval: true,
    drawSeekThreshold: -2.0,
    recaptureChance: 1.0
  },
  // Grandmaster (2600 Elo): The Grandmaster tier - maximum strength
  // MultiPV 1 with 5M nodes
  grandmaster: { 
    elo: 2600, timePerMoveMs: 5000, maxDepth: 8, multiPvCount: 1, stockfishNodes: 5000000, 
    mistakeProbability: 0.00001, useStockfish: true,
    useKillers: true, useHistory: true,
    mobilityWeight: 100, kingSafetyWeight: 100, mopUpWeight: 100, useTaperedEval: true,
    drawSeekThreshold: -2.0,
    recaptureChance: 1.0     // 100% chance to see recaptures
  },
};

// ============================================
// MATE VISION CONFIG
// ============================================
// Defines what checkmates each difficulty level can "see"
// mateInMax: Guaranteed to see mates up to this depth
// mateInProbability: { depth: probability } for probabilistic detection beyond mateInMax
interface MateVisionConfig {
  mateInMax: number;           // Always sees mates up to this depth
  mateInProbability: Record<number, number>; // depth -> probability (0-1) for deeper mates
}

const MATE_VISION_CONFIG: Record<BotDifficulty, MateVisionConfig> = {
  // Patzer: Only sees mate in 1
  patzer: { 
    mateInMax: 1, 
    mateInProbability: {} 
  },
  // Novice: Sees mate in 1, 50% chance to see mate in 2
  novice: { 
    mateInMax: 1, 
    mateInProbability: { 2: 0.5 } 
  },
  // Intermediate: Sees mate in 1-2
  intermediate: { 
    mateInMax: 2, 
    mateInProbability: {} 
  },
  // Improving: Same as intermediate (copied from old 900)
  improving: { 
    mateInMax: 2, 
    mateInProbability: {} 
  },
  // Club: Sees mate in 1-2, 50% chance to see mate in 3
  club: { 
    mateInMax: 2, 
    mateInProbability: { 3: 0.5 } 
  },
  // Advanced: Sees mate in 1-3, 25% chance to see mate in 4
  advanced: { 
    mateInMax: 3, 
    mateInProbability: { 4: 0.25 } 
  },
  // Strong: Same as advanced (copied from old 1500)
  strong: { 
    mateInMax: 3, 
    mateInProbability: { 4: 0.25 } 
  },
  // Expert: Sees all mates up to 4
  expert: { 
    mateInMax: 4, 
    mateInProbability: {} 
  },
  // Master: Sees all forced checkmates (no limit)
  master: { 
    mateInMax: Infinity, 
    mateInProbability: {} 
  },
  // Candidate: Same as master (copied from 2000)
  candidate: { 
    mateInMax: Infinity, 
    mateInProbability: {} 
  },
  // Elite: Same as grandmaster (copied from old 2500)
  elite: { 
    mateInMax: Infinity, 
    mateInProbability: {} 
  },
  // Grandmaster: Sees all forced checkmates (no limit)
  grandmaster: { 
    mateInMax: Infinity, 
    mateInProbability: {} 
  },
};

// Check if a bot can "see" a mate at a given depth based on difficulty and personality
function canSeeMate(mateIn: number, difficulty: BotDifficulty, personality: BotPersonality): boolean {
  const config = MATE_VISION_CONFIG[difficulty];
  
  // Tactician bonus: +1 to guaranteed mate depth
  const isTactician = personality === 'tactician';
  const effectiveMateInMax = isTactician ? config.mateInMax + 1 : config.mateInMax;
  
  // Always sees mates within guaranteed range
  if (mateIn <= effectiveMateInMax) {
    if (isTactician && mateIn > config.mateInMax) {
      console.log(`[MateVision] Tactician bonus: ${difficulty} sees mate in ${mateIn} (normally max ${config.mateInMax})`);
    }
    return true;
  }
  
  // Check probabilistic detection for deeper mates
  // For Tactician: shift existing probability up one level and add +25%
  // This is done at query-time: when checking mate in N, we look at the probability
  // that was configured for mate in (N-1) and add 25%. This effectively shifts the
  // entire probability table up by one level. For example:
  //   Club (mateInMax=2, prob={3: 0.5}) → Club Tactician:
  //   - Mate in 4: looks at prob[3]=0.5, adds 0.25 → 75% chance
  //   - Mate in 5: looks at prob[4]=undefined→0, adds 0.25 → 25% chance
  let probability = config.mateInProbability[mateIn];
  
  if (isTactician) {
    // Look up the probability from one level shallower and add the Tactician bonus
    const shiftedProbability = config.mateInProbability[mateIn - 1] || 0;
    const tacticianBonus = 0.25;
    probability = Math.min(1.0, shiftedProbability + tacticianBonus);
    
    if (probability > 0 && shiftedProbability > 0) {
      console.log(`[MateVision] Tactician bonus: mate in ${mateIn} probability ${(shiftedProbability * 100).toFixed(0)}% + 25% = ${(probability * 100).toFixed(0)}%`);
    } else if (probability > 0) {
      console.log(`[MateVision] Tactician bonus: mate in ${mateIn} gets +25% chance`);
    }
  }
  
  if (probability !== undefined && probability > 0) {
    // Roll the dice - this creates natural variation
    const roll = Math.random();
    const sees = roll < probability;
    console.log(`[MateVision] ${difficulty}${isTactician ? ' (Tactician)' : ''} rolling for mate in ${mateIn}: ${(probability * 100).toFixed(0)}% chance, rolled ${(roll * 100).toFixed(0)}% -> ${sees ? 'SEES IT!' : 'missed'}`);
    return sees;
  }
  
  // Can't see this mate
  return false;
}

// Find the best visible winning mate for a given difficulty and personality
// botColor is needed because evaluation is always from White's perspective:
// - White winning mate: evaluation > 0
// - Black winning mate: evaluation < 0
function findVisibleWinningMate(
  topMoves: TopMoveResult[], 
  difficulty: BotDifficulty,
  botColor: 'w' | 'b',
  personality: BotPersonality
): TopMoveResult | null {
  // Filter to winning mates only
  // isMate=true means forced mate exists
  // For White: evaluation > 0 means White delivers mate
  // For Black: evaluation < 0 means Black delivers mate
  const winningMates = topMoves.filter(m => {
    if (!m.isMate || m.mateIn === undefined) return false;
    // Check if this is a winning mate for the bot's color
    if (botColor === 'w') {
      return m.evaluation > 0; // Positive eval = White wins
    } else {
      return m.evaluation < 0; // Negative eval = Black wins
    }
  });
  
  if (winningMates.length === 0) {
    return null;
  }
  
  // Sort by shortest mate first
  winningMates.sort((a, b) => (a.mateIn || 999) - (b.mateIn || 999));
  
  // Find the shortest mate this difficulty can see
  for (const mate of winningMates) {
    if (canSeeMate(mate.mateIn!, difficulty, personality)) {
      console.log(`[MateVision] ${difficulty}${personality === 'tactician' ? ' (Tactician)' : ''} (${botColor}) can see mate in ${mate.mateIn} with ${mate.move}!`);
      return mate;
    }
  }
  
  // No visible mate
  return null;
}

// Personality-based move selection from MultiPV candidates
function selectMoveByPersonality(
  game: Chess,
  topMoves: TopMoveResult[],
  personality: BotPersonality,
  difficulty: BotDifficulty,
  lastMoveInfo?: LastMoveInfo,
  moveCount?: number
): TopMoveResult {
  if (topMoves.length === 0) {
    throw new Error('No moves available');
  }
  
  if (topMoves.length === 1) {
    return topMoves[0];
  }
  
  const config = DIFFICULTY_CONFIG[difficulty];
  const botColor = game.turn();
  
  // ============================================
  // BULLETPROOF CHECKMATE DETECTION - FIRST PRIORITY
  // ============================================
  // This happens BEFORE everything else - survival mode, recaptures, personality scoring
  // If the bot can "see" a winning checkmate based on their vision config, they ALWAYS play it
  const visibleMate = findVisibleWinningMate(topMoves, difficulty, botColor, personality);
  if (visibleMate) {
    console.log(`[ClientBot] CHECKMATE PRIORITY: ${difficulty}${personality === 'tactician' ? ' (Tactician)' : ''} (${botColor}) sees mate in ${visibleMate.mateIn}! Playing ${visibleMate.move} immediately - no exceptions.`);
    return visibleMate;
  }
  
  // Check if we should enter survival mode (draw-seeking)
  // Use the best move's evaluation to determine if we're losing
  const bestEval = topMoves[0].evaluation;
  const inSurvivalMode = moveCount !== undefined && 
    shouldSeekDraw(bestEval, difficulty, moveCount, botColor, personality);
  
  // CRITICAL RECAPTURE LOGIC: Prioritize recaptures of valuable pieces based on recaptureChance
  // If opponent just captured a piece worth 3+ points (bishop/knight or higher), we MUST recapture
  // unless doing so leads to a significantly worse position (checked via Stockfish eval)
  // 
  // IMPORTANT SURVIVAL MODE INTEGRATION:
  // - If eval AFTER recapture is ABOVE draw-seeking threshold → recapture and continue playing
  // - If eval AFTER recapture is BELOW draw-seeking threshold → skip recapture, look for draws
  // This ensures: Take their Queen back, see you're only at -0.5, keep crushing them.
  // But if you're still at -3.0 after recapturing, look for perpetual checks instead.
  // 
  // Uses recaptureChance: Patzer 25%, Novice 50%, Intermediate 75%, Club+ 100%
  const recaptureRoll = Math.random();
  const shouldAttemptRecapture = recaptureRoll < config.recaptureChance;
  
  if (shouldAttemptRecapture && lastMoveInfo?.captured && lastMoveInfo.capturedValue && lastMoveInfo.capturedValue >= 300) {
    const recaptureSquare = lastMoveInfo.to;
    const legalMoves = game.moves({ verbose: true });
    
    // Find moves that recapture on the same square
    const recaptureMoves = topMoves.filter(candidate => {
      const move = legalMoves.find(m => 
        m.from + m.to + (m.promotion || '') === candidate.move ||
        m.san === candidate.move
      );
      return move && move.to === recaptureSquare && move.captured;
    });
    
    if (recaptureMoves.length > 0) {
      // Find the best recapture (highest Stockfish eval, or if tied, by MVV-LVA)
      const bestRecapture = recaptureMoves.reduce((best, current) => {
        // If one leads to mate for us, pick it
        if (current.isMate && current.evaluation > 0) return current;
        if (best.isMate && best.evaluation > 0) return best;
        // Avoid moves that lead to us getting mated
        if (current.isMate && current.evaluation < 0) return best;
        if (best.isMate && best.evaluation < 0) return current;
        // Otherwise pick higher eval
        return current.evaluation > best.evaluation ? current : best;
      });
      
      // Only play the recapture if it doesn't lead to a significantly worse position
      // DYNAMIC THRESHOLD: Scale based on what was captured
      // - Queen (900): threshold = -9.0 (almost always recapture)
      // - Rook (500): threshold = -5.0
      // - Minor piece (300-330): threshold = -3.0
      // This ensures we always recapture queens unless it leads to immediate mate
      const capturedValue = lastMoveInfo.capturedValue || 300;
      const dynamicThreshold = -(capturedValue / 100);
      
      // Check if eval AFTER recapture would trigger survival mode
      // Adjust evaluation for bot's perspective
      const recaptureEvalForBot = botColor === 'w' ? bestRecapture.evaluation : -bestRecapture.evaluation;
      const wouldStillBeLosing = moveCount !== undefined && 
        moveCount >= 20 && 
        recaptureEvalForBot < config.drawSeekThreshold;
      
      // Always recapture if it's a winning mate, or if eval is above our dynamic threshold
      // Skip only if the recapture leads to US getting mated
      const isWinningMate = bestRecapture.isMate && bestRecapture.evaluation > 0;
      const isLosingMate = bestRecapture.isMate && bestRecapture.evaluation < 0;
      const evalAcceptable = bestRecapture.evaluation >= dynamicThreshold;
      
      if (isWinningMate || (evalAcceptable && !isLosingMate && !wouldStillBeLosing)) {
        // Recapture puts us in a good/okay position - play it!
        console.log(`[ClientBot] RECAPTURE PRIORITY: Playing ${bestRecapture.move} to recapture on ${recaptureSquare} (lost ${lastMoveInfo.captured}=${capturedValue}cp, eval: ${bestRecapture.evaluation.toFixed(2)}, threshold: ${dynamicThreshold.toFixed(1)})`);
        return bestRecapture;
      } else if (isLosingMate) {
        console.log(`[ClientBot] Recapture ${bestRecapture.move} leads to mate against us - skipping`);
      } else if (wouldStillBeLosing) {
        // Even after recapturing, we're still losing badly - look for draws instead!
        console.log(`[ClientBot] Recapture ${bestRecapture.move} eval ${bestRecapture.evaluation.toFixed(2)} still below survival threshold ${config.drawSeekThreshold} - seeking draws instead`);
      } else {
        console.log(`[ClientBot] Recapture on ${recaptureSquare} eval ${bestRecapture.evaluation.toFixed(2)} below threshold ${dynamicThreshold.toFixed(1)} - may be a trap`);
      }
    } else {
      // No recapture in topMoves - this should be handled by generateBotMoveClient's 
      // pre-evaluation pipeline, but log a warning if we reach here
      const anyRecapture = legalMoves.find(m => m.to === recaptureSquare && m.captured);
      if (anyRecapture) {
        // The pre-evaluation in generateBotMoveClient should have added this to topMoves
        // If we're here, it means evaluation failed or wasn't triggered
        console.warn(`[ClientBot] WARNING: Recapture ${anyRecapture.san} exists but not in topMoves. Pre-evaluation may have failed.`);
      }
    }
  }
  
  // Higher difficulty = more likely to pick the best move
  // Lower difficulty = more personality influence
  const personalityInfluence = Math.max(0.2, 1 - (config.elo / 2500));
  
  const moves = game.moves({ verbose: true });
  
  // Score each candidate move based on personality
  const scoredMoves = topMoves.map((candidate, index) => {
    const move = moves.find(m => 
      m.from + m.to + (m.promotion || '') === candidate.move ||
      m.san === candidate.move
    );
    
    // Base score from Stockfish (higher index = lower engine ranking)
    let score = (topMoves.length - index) * 100;
    
    // CRITICAL: Mate evaluations get extreme scores that can't be outranked
    // Winning mates (evaluation > 0) get huge positive scores
    // Losing mates (evaluation < 0) get huge negative scores
    if (candidate.isMate) {
      if (candidate.evaluation > 0) {
        // Winning mate: 100000 base score, shorter mates rank higher
        const mateDistance = candidate.mateIn || 1;
        score = 100000 - mateDistance;
        console.log(`[ClientBot] Winning mate in ${mateDistance} detected for ${candidate.move}, score: ${score}`);
      } else {
        // This move leads to us getting mated - avoid it
        const mateDistance = candidate.mateIn || 1;
        score = -100000 - mateDistance;
        console.log(`[ClientBot] Losing mate in ${mateDistance} detected for ${candidate.move}, score: ${score}`);
      }
      return { candidate, score };
    }
    
    if (!move) return { candidate, score };
    
    // ============================================
    // SURVIVAL MODE: DRAW-SEEKING BONUS
    // ============================================
    // When losing and in survival mode, massive bonus for moves that repeat positions
    // This creates "trolling" behavior where the bot forces perpetual checks
    if (inSurvivalMode && move) {
      const repetitionInfo = wouldRepeatPosition(game, move);
      
      if (repetitionInfo.repeats) {
        // Huge bonus for repetition moves - these lead to draws!
        // 3rd occurrence = threefold repetition = forced draw
        if (repetitionInfo.count >= 3) {
          // This move forces a draw! Massively boost it
          score += 50000; // Almost as good as winning (we're losing, so draw is great)
          console.log(`[ClientBot] DRAW ESCAPE: ${move.san} creates threefold repetition! (+50000)`);
        } else if (repetitionInfo.count === 2) {
          // 2nd occurrence - one more repetition needed for draw
          score += 10000;
          console.log(`[ClientBot] Repetition opportunity: ${move.san} (2nd occurrence, +10000)`);
        } else {
          // 1st repetition - potential draw path
          score += 2000;
          console.log(`[ClientBot] Repetition detected: ${move.san} (+2000)`);
        }
      }
      
      // Extra bonus for checks in survival mode (perpetual check hunting)
      if (move.san.includes('+')) {
        score += 500; // Checking moves are good for perpetuals
      }
    }
    
    // Detect opposite-side castling for GM awareness
    const isOppositeSideCastling = detectOppositeSideCastling(game);
    
    // Apply personality bonuses
    switch (personality) {
      case 'aggressive':
        {
          // ========== TAL ATTACKER PHILOSOPHY ==========
          // "A sacrifice is best refuted by accepting it" - Wilhelm Steinitz
          // But Tal made them accept... and then crushed them anyway.
          // This bot is a calculated aggressor that senses when the position is "ripe"
          
          const board = game.board();
          const myColor = game.turn();
          const enemyColor = myColor === 'w' ? 'b' : 'w';
          const enemyKing = findKingPosition(game, enemyColor);
          // Get move number from history length (ply / 2 + 1)
          const ply = game.history().length;
          const moveNumber = Math.floor(ply / 2) + 1;
          
          // Basic aggressive bonuses (unchanged)
          if (move.captured) score += 80 * personalityInfluence;
          if (move.san.includes('+')) score += 100 * personalityInfluence;
          // Prefer moves toward enemy king side
          if (myColor === 'w' && parseInt(move.to[1]) >= 5) score += 40 * personalityInfluence;
          if (myColor === 'b' && parseInt(move.to[1]) <= 4) score += 40 * personalityInfluence;
          
          // ============================================
          // 1. ATTACK UNIT DENSITY - "SENSE OF RIPENESS"
          // ============================================
          // Count attacking units within 3 squares of enemy king
          // Queen=4, Rook=3, Minor=2, Pawn=1 (attack units)
          let attackUnits = 0;
          if (enemyKing) {
            for (let r = 0; r < 8; r++) {
              for (let c = 0; c < 8; c++) {
                const piece = board[r]?.[c];
                if (piece && piece.color === myColor && piece.type !== 'k') {
                  const distance = Math.max(Math.abs(r - enemyKing.row), Math.abs(c - enemyKing.col));
                  if (distance <= 3) {
                    if (piece.type === 'q') attackUnits += 4;
                    else if (piece.type === 'r') attackUnits += 3;
                    else if (piece.type === 'n' || piece.type === 'b') attackUnits += 2;
                    else if (piece.type === 'p') attackUnits += 1;
                  }
                }
              }
            }
          }
          
          // The "Tal Moment" - enough firepower gathered!
          const isTalMoment = attackUnits >= 8;
          
          // ============================================
          // 2. INITIATIVE MULTIPLIER (SACRIFICE LOGIC)
          // ============================================
          // Real attackers don't mind losing material for tempo/attack
          // Give a flat bonus (not percentage-based) for "justified" sacrifices
          
          if (move.captured) {
            const pieceValues: Record<string, number> = { 'p': 1, 'n': 3, 'b': 3, 'r': 5, 'q': 9 };
            const capturedValue = pieceValues[move.captured] || 0;
            const movingPieceValue = pieceValues[move.piece] || 0;
            
            // Sacrifice detection: we're giving up more than we take
            if (movingPieceValue > capturedValue) {
              // Check if this sacrifice is "justified" by any of these conditions:
              let initiativeBonus = 0;
              
              // Check gives tempo - most valuable
              if (move.san.includes('+')) {
                initiativeBonus += 80; // Tempo bonus for checking sacrifices
              }
              
              // Tal Moment - position is ripe, sacrifice with confidence
              if (isTalMoment) {
                initiativeBonus += 100; // "The position is ripe!"
              }
              
              // Opens line toward enemy king (move to square closer to enemy king)
              if (enemyKing && !move.san.includes('+') && !isTalMoment) {
                const toCol = move.to.charCodeAt(0) - 97;
                const toRow = 8 - parseInt(move.to[1]);
                const distToKing = Math.max(Math.abs(toRow - enemyKing.row), Math.abs(toCol - enemyKing.col));
                
                // Only count as line-opening if we're getting very close to the king
                if (distToKing <= 2) {
                  initiativeBonus += 60; // Sacrifice near the king
                }
              }
              
              // Apply bonus only if any justification condition was met
              // Cap at 120 to prevent runaway scores
              if (initiativeBonus > 0) {
                score += Math.min(initiativeBonus, 120) * personalityInfluence;
              }
            }
          }
          
          // ============================================
          // 3. COORDINATION: THE "RELOAD" MECHANIC
          // ============================================
          // Bonus for having multiple pieces near the enemy king
          // Simplified: count pieces within 3 squares, bonus for density
          if (enemyKing) {
            const toCol = move.to.charCodeAt(0) - 97;
            const toRow = 8 - parseInt(move.to[1]);
            const distToKing = Math.max(Math.abs(toRow - enemyKing.row), Math.abs(toCol - enemyKing.col));
            
            // If this move lands near the enemy king (within 2 squares)
            if (distToKing <= 2) {
              // Reward for joining the attack - higher attack units = more coordination
              if (attackUnits >= 4) {
                score += 25 * personalityInfluence; // "Pieces are converging!"
              }
              if (attackUnits >= 6) {
                score += 35 * personalityInfluence; // "Battery building!"
              }
              if (isTalMoment) {
                score += 50 * personalityInfluence; // "All-out assault!"
              }
            }
          }
          
          // ============================================
          // 4. KING IN CENTER HUNTING
          // ============================================
          // If enemy king hasn't castled by move 12, go into "Kill Mode"
          // Triple bonus for center pawn breaks (d4, e4, d5, e5)
          if (enemyKing && moveNumber >= 12) {
            // Check if enemy king is still in center (e8/d8 for black, e1/d1 for white)
            const kingIsInCenter = 
              (enemyColor === 'b' && enemyKing.row === 0 && (enemyKing.col === 3 || enemyKing.col === 4)) ||
              (enemyColor === 'w' && enemyKing.row === 7 && (enemyKing.col === 3 || enemyKing.col === 4));
            
            if (kingIsInCenter) {
              // "KILL MODE" - center pawn breaks get 3x bonus
              const centerBreaks = ['d4', 'e4', 'd5', 'e5'];
              if (move.piece === 'p' && centerBreaks.includes(move.to)) {
                score += 90 * personalityInfluence; // 3x normal pawn break bonus!
              }
              
              // Any central piece activity gets bonus
              const centralSquares = ['c3', 'c4', 'c5', 'c6', 'd3', 'd4', 'd5', 'd6', 
                                     'e3', 'e4', 'e5', 'e6', 'f3', 'f4', 'f5', 'f6'];
              if (centralSquares.includes(move.to)) {
                score += 30 * personalityInfluence; // Hunt that king!
              }
            }
          }
          
          // PAWN STORM BONUS (3x multiplier for Aggressor) - original logic
          if (move.piece === 'p') {
            const toRank = parseInt(move.to[1]);
            const toFile = move.to[0];
            if (enemyKing) {
              const enemyKingFile = String.fromCharCode(97 + enemyKing.col);
              const adjacentFiles = [
                String.fromCharCode(enemyKingFile.charCodeAt(0) - 1),
                enemyKingFile,
                String.fromCharCode(enemyKingFile.charCodeAt(0) + 1)
              ];
              // Pawn advancing on enemy king's flank
              if (adjacentFiles.includes(toFile)) {
                // 3x storm bonus for Aggressor
                const stormBonus = (myColor === 'w' ? toRank - 2 : 9 - toRank) * 30 * personalityInfluence;
                score += stormBonus * 3;
              }
            }
          }
          
          // Extra bonus during Tal Moment for any aggressive move
          if (isTalMoment) {
            if (move.san.includes('+')) score += 50 * personalityInfluence; // Checks are gold
            if (move.captured) score += 30 * personalityInfluence; // Keep attacking!
          }
        }
        break;
        
      case 'tactician':
        {
          // ========== TACTICIAN: PATTERN RECOGNITION ENGINE ==========
          // Instead of searching deeper (causes node starvation), we give the engine
          // "Value Multipliers" for specific tactical geometries.
          
          const board = game.board();
          const myColor = game.turn();
          const enemyColor = myColor === 'w' ? 'b' : 'w';
          const pieceValues: Record<string, number> = { 'p': 100, 'n': 300, 'b': 300, 'r': 500, 'q': 900, 'k': 0 };
          
          // Basic tactical bonuses (kept from original)
          if (move.captured) score += PIECE_VALUES[move.captured] * 0.2 * personalityInfluence;
          if (move.san.includes('+')) score += 60 * personalityInfluence;
          if (move.san.includes('#')) score += 1000;
          
          // Get move destination info
          const toCol = move.to.charCodeAt(0) - 97;
          const toRow = 8 - parseInt(move.to[1]);
          const fromCol = move.from.charCodeAt(0) - 97;
          const fromRow = 8 - parseInt(move.from[1]);
          
          // ============================================
          // 1. FORK FINDER (+40)
          // ============================================
          // Bonus when this move attacks 2+ pieces of higher value simultaneously
          {
            const movingPieceValue = pieceValues[move.piece] || 0;
            let higherValueTargets = 0;
            
            // Get squares this piece attacks after the move
            let attackedSquares: { row: number; col: number }[] = [];
            
            if (move.piece === 'p') {
              // Pawns attack diagonally (critical for pawn forks!)
              const pawnDir = myColor === 'w' ? -1 : 1;
              const attackSquares = [
                { row: toRow + pawnDir, col: toCol - 1 },
                { row: toRow + pawnDir, col: toCol + 1 }
              ];
              attackedSquares = attackSquares.filter(sq => 
                sq.row >= 0 && sq.row <= 7 && sq.col >= 0 && sq.col <= 7
              );
            } else {
              attackedSquares = getAttackedSquares(move.piece, toRow, toCol, board, myColor);
            }
            
            for (const sq of attackedSquares) {
              const targetPiece = board[sq.row]?.[sq.col];
              if (targetPiece && targetPiece.color === enemyColor) {
                const targetValue = pieceValues[targetPiece.type] || 0;
                if (targetValue > movingPieceValue || targetPiece.type === 'k') {
                  higherValueTargets++;
                }
              }
            }
            
            if (higherValueTargets >= 2) {
              score += 40 * personalityInfluence; // Fork detected!
            }
          }
          
          // ============================================
          // 2. PIN/SKEWER BONUS (+30)
          // ============================================
          // Bonus for X-ray attacks through lower-value to higher-value piece
          if (move.piece === 'b' || move.piece === 'r' || move.piece === 'q') {
            const directions = move.piece === 'r' 
              ? [[0, 1], [0, -1], [1, 0], [-1, 0]]
              : move.piece === 'b'
              ? [[1, 1], [1, -1], [-1, 1], [-1, -1]]
              : [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]];
            
            for (const [dr, dc] of directions) {
              let firstPiece: { type: string; value: number } | null = null;
              let secondPiece: { type: string; value: number } | null = null;
              
              for (let i = 1; i < 8; i++) {
                const r = toRow + dr * i;
                const c = toCol + dc * i;
                if (r < 0 || r > 7 || c < 0 || c > 7) break;
                
                const piece = board[r]?.[c];
                if (piece) {
                  if (piece.color === enemyColor) {
                    if (!firstPiece) {
                      firstPiece = { type: piece.type, value: pieceValues[piece.type] || 0 };
                    } else {
                      secondPiece = { type: piece.type, value: pieceValues[piece.type] || 0 };
                      break;
                    }
                  } else {
                    break; // Blocked by own piece
                  }
                }
              }
              
              // Pin/Skewer: first piece is lower value than second (or second is king)
              if (firstPiece && secondPiece) {
                if (secondPiece.value > firstPiece.value || secondPiece.type === 'k') {
                  score += 30 * personalityInfluence; // Pin or skewer detected!
                  break;
                }
              }
            }
          }
          
          // ============================================
          // 3. DISCOVERY THREAT (+50)
          // ============================================
          // Bonus for moving a piece that unveils an attack from a sliding piece behind
          // Only applies if unveiled piece attacks king, queen, higher-value, OR undefended target
          {
            // Check if there's a sliding piece behind our from-square
            const directions = [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]];
            
            for (const [dr, dc] of directions) {
              // Look behind the from-square for our sliding piece
              let behindRow = fromRow + dr;
              let behindCol = fromCol + dc;
              
              // Skip if we moved in this direction (not a discovery)
              if (behindRow === toRow && behindCol === toCol) continue;
              
              while (behindRow >= 0 && behindRow <= 7 && behindCol >= 0 && behindCol <= 7) {
                const piece = board[behindRow]?.[behindCol];
                if (piece) {
                  if (piece.color === myColor) {
                    // Check if this is a sliding piece that can attack through our old square
                    const canSlide = 
                      (piece.type === 'r' && (dr === 0 || dc === 0)) ||
                      (piece.type === 'b' && (dr !== 0 && dc !== 0)) ||
                      (piece.type === 'q');
                    
                    if (canSlide) {
                      // Look in the opposite direction for targets
                      let targetRow = fromRow - dr;
                      let targetCol = fromCol - dc;
                      
                      while (targetRow >= 0 && targetRow <= 7 && targetCol >= 0 && targetCol <= 7) {
                        const target = board[targetRow]?.[targetCol];
                        if (target) {
                          if (target.color === enemyColor) {
                            const targetValue = pieceValues[target.type] || 0;
                            const attackerValue = pieceValues[piece.type] || 0;
                            
                            // Check if target is undefended by simulating the position
                            let isUndefended = false;
                            try {
                              const testGame = new Chess(game.fen());
                              testGame.move(move.san);
                              // Target square in algebraic notation
                              const targetSq = String.fromCharCode(97 + targetCol) + (8 - targetRow);
                              // Check if any enemy piece can recapture on target square
                              const opponentMoves = testGame.moves({ verbose: true });
                              const defenders = opponentMoves.filter(m => m.to === targetSq);
                              isUndefended = defenders.length === 0;
                            } catch {
                              // Move failed, assume defended
                            }
                            
                            // Bonus if target is king, queen, higher value, OR undefended
                            if (target.type === 'k' || target.type === 'q' || 
                                targetValue >= attackerValue || isUndefended) {
                              score += 50 * personalityInfluence; // Discovery threat!
                            }
                          }
                          break;
                        }
                        targetRow -= dr;
                        targetCol -= dc;
                      }
                    }
                  }
                  break; // Something in the way
                }
                behindRow += dr;
                behindCol += dc;
              }
            }
          }
          
          // ============================================
          // 4. KING SAFETY GHOST BONUS (+60)
          // ============================================
          // If enemy king has <2 pawn protectors, all attacking moves get bonus
          // Safety valve: only if move doesn't lose >100cp (1 pawn) - check if landing square is attacked
          {
            const enemyKing = findKingPosition(game, enemyColor);
            if (enemyKing) {
              // Count pawn protectors (pawns adjacent to enemy king)
              let pawnProtectors = 0;
              for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                  if (dr === 0 && dc === 0) continue;
                  const r = enemyKing.row + dr;
                  const c = enemyKing.col + dc;
                  const piece = board[r]?.[c];
                  if (piece && piece.type === 'p' && piece.color === enemyColor) {
                    pawnProtectors++;
                  }
                }
              }
              
              if (pawnProtectors < 2) {
                // Check if this is an "attacking" move (toward enemy king or a capture)
                const distToKing = Math.max(Math.abs(toRow - enemyKing.row), Math.abs(toCol - enemyKing.col));
                const isAttackingMove = distToKing <= 3 || move.captured || move.san.includes('+');
                
                // Safety valve: Simulate the move and check if piece can be recaptured
                // isSafe = true means the move doesn't lose more than ~1 pawn
                let isSafe = true;
                const movingValue = pieceValues[move.piece] || 0;
                const capturedValue = move.captured ? (pieceValues[move.captured] || 0) : 0;
                
                try {
                  const testGame = new Chess(game.fen());
                  testGame.move(move.san);
                  
                  // Check if opponent can capture on our landing square
                  const opponentMoves = testGame.moves({ verbose: true });
                  const recaptures = opponentMoves.filter(m => m.to === move.to);
                  
                  if (recaptures.length > 0) {
                    // We can be captured - calculate net material exchange
                    // Net loss = (our piece we lose) - (what we captured)
                    // If we captured something and lose the same piece type, it's even
                    const netLoss = movingValue - capturedValue;
                    
                    // Move is safe if:
                    // 1. We captured something of equal/greater value (netLoss <= 0), OR
                    // 2. We only lose up to 1 pawn worth of material (netLoss <= 100)
                    isSafe = netLoss <= 100;
                  }
                  // If no recaptures possible, the move is completely safe
                } catch {
                  // Move failed, assume safe
                }
                
                if (isAttackingMove && isSafe) {
                  score += 60 * personalityInfluence; // Ghost bonus for weak king!
                }
              }
            }
          }
          
          // ============================================
          // 5. COMPLEXITY WEIGHT / CHAOS MULTIPLIER (+20)
          // ============================================
          // Favor positions with more possible captures (high tension)
          // Tacticians win by making the game complicated
          {
            // Make the move temporarily to count captures in resulting position
            const testGame = new Chess(game.fen());
            try {
              testGame.move(move.san);
              const positionMoves = testGame.moves({ verbose: true });
              
              // Count captures available for both sides
              let captureCount = 0;
              for (const m of positionMoves) {
                if (m.captured) captureCount++;
              }
              
              // Bonus for maintaining tension (more captures = more tactical)
              if (captureCount >= 4) {
                score += 20 * personalityInfluence; // "Keep the tension!"
              }
              if (captureCount >= 6) {
                score += 15 * personalityInfluence; // Extra chaos bonus
              }
            } catch {
              // Move failed, skip complexity check
            }
          }
          
          // Original pawn storm logic (kept)
          if (move.piece === 'p') {
            const toRank = parseInt(move.to[1]);
            const toFile = move.to[0];
            const enemyKing = findKingPosition(game, enemyColor);
            if (enemyKing) {
              const enemyKingFile = String.fromCharCode(97 + enemyKing.col);
              const adjacentFiles = [
                String.fromCharCode(enemyKingFile.charCodeAt(0) - 1),
                enemyKingFile,
                String.fromCharCode(enemyKingFile.charCodeAt(0) + 1)
              ];
              if (adjacentFiles.includes(toFile)) {
                const stormBonus = (myColor === 'w' ? toRank - 2 : 9 - toRank) * 25 * personalityInfluence;
                score += stormBonus * 1.5;
              }
            }
          }
          
          // Lever positions are tactical gold - pawn exchanges open lines
          if (move.piece === 'p' && move.captured === 'p') {
            score += 40 * personalityInfluence;
          }
        }
        break;
        
      case 'defensive':
        // ========== FORTRESS DEFENDER PHILOSOPHY ==========
        // "The best defense is removing the opponent's attacking pieces"
        // This bot is a Simplification Machine that trades down, coordinates pieces
        // around the king, and punishes overextension with surgical counter-attacks.
        
        // 1. TRADE-SEEKING LOGIC: Actively seek equal trades to simplify
        // Remove attacking potential by trading pieces (especially heavy pieces)
        if (move.captured) {
          const pieceValues: Record<string, number> = { 'p': 1, 'n': 3, 'b': 3, 'r': 5, 'q': 9 };
          const capturedValue = pieceValues[move.captured] || 0;
          const movingPieceValue = pieceValues[move.piece] || 0;
          
          // Equal trades are GOLD for the Fortress - removes attacking potential
          if (Math.abs(capturedValue - movingPieceValue) <= 1) {
            score += 35 * personalityInfluence; // Love equal trades
            // Extra bonus for trading heavy pieces (Q, R) - biggest threat removal
            if (move.captured === 'q') score += 50 * personalityInfluence;
            if (move.captured === 'r') score += 25 * personalityInfluence;
          }
          // Winning trades are also good
          if (capturedValue > movingPieceValue) {
            score += 20 * personalityInfluence;
          }
        }
        
        // 2. CASTLING: Still love castling - King safety is paramount
        if (move.san === 'O-O' || move.san === 'O-O-O') score += 100 * personalityInfluence;
        
        // 3. ZONE DEFENSE: King-proximity bonus for minor pieces
        // Knights and Bishops get bonus for staying within 2-3 squares of own King
        if (move.piece === 'n' || move.piece === 'b') {
          const myKing = findKingPosition(game, game.turn());
          if (myKing) {
            const toCol = move.to.charCodeAt(0) - 97;
            const toRow = 8 - parseInt(move.to[1]);
            const distance = Math.max(Math.abs(toCol - myKing.col), Math.abs(toRow - myKing.row));
            
            // Bonus for pieces within 2-3 squares of king (bodyguard formation)
            if (distance <= 2) {
              score += 40 * personalityInfluence; // Close protection
            } else if (distance <= 3) {
              score += 20 * personalityInfluence; // Support range
            }
            // Penalty for pieces straying too far from king
            if (distance >= 5) {
              score -= 15 * personalityInfluence; // Too far from defensive duties
            }
          }
        }
        
        // 4. INFILTRATION DETECTION & RESPONSE: Enemy pieces in our territory are URGENT
        // If enemy pieces are on our 3rd/4th rank, we need to deal with them NOW
        {
          const board = game.board();
          const myColor = game.turn();
          const enemyColor = myColor === 'w' ? 'b' : 'w';
          const myKing = findKingPosition(game, myColor);
          
          // Define territory ranks (3rd and 4th for white, 5th and 6th for black)
          const territoryRanks = myColor === 'w' ? [5, 4] : [2, 3]; // 0-indexed rows
          
          // Count infiltrators (enemy N, R, Q in our territory) with proximity to king
          let infiltratorSquares: string[] = [];
          let infiltrationThreat = 0;
          const pieceThreats: Record<string, number> = { 'n': 30, 'r': 40, 'q': 60 };
          
          for (const rank of territoryRanks) {
            for (let col = 0; col < 8; col++) {
              const piece = board[rank][col];
              if (piece && piece.color === enemyColor && 
                  (piece.type === 'n' || piece.type === 'r' || piece.type === 'q')) {
                const square = String.fromCharCode(97 + col) + (8 - rank);
                infiltratorSquares.push(square);
                
                // Calculate threat based on piece type and proximity to king
                let threat = pieceThreats[piece.type] || 30;
                if (myKing) {
                  const dist = Math.max(Math.abs(col - myKing.col), Math.abs(rank - myKing.row));
                  // Closer to king = more dangerous
                  if (dist <= 2) threat *= 1.5;
                  else if (dist <= 3) threat *= 1.25;
                }
                infiltrationThreat += threat;
              }
            }
          }
          
          // INFILTRATION PENALTY: Apply negative weight when infiltrators exist
          // This makes ALL moves worse when enemies are in our territory,
          // UNLESS the move deals with the infiltration
          if (infiltratorSquares.length > 0) {
            // Base penalty for having infiltrators (creates urgency)
            score -= infiltrationThreat * personalityInfluence * 0.3;
          }
          
          // EVICTION BONUS: Capturing an infiltrator is HIGHEST priority
          if (move.captured && infiltratorSquares.includes(move.to)) {
            // Full counter-punch bonus + remove the penalty for this move
            score += 80 * personalityInfluence; // Strong eviction bonus
            score += infiltrationThreat * personalityInfluence * 0.3; // Restore penalty
          }
          
          // ATTACK INFILTRATOR BONUS: Moving to attack infiltrator squares
          // Check if our move threatens any infiltrator (piece can capture next turn)
          if (infiltratorSquares.length > 0) {
            const testGame = new Chess(game.fen());
            testGame.move(move.san);
            // Get all our legal moves after this move
            const followupMoves = testGame.moves({ verbose: true });
            let threateningInfiltrator = false;
            for (const followup of followupMoves) {
              if (infiltratorSquares.includes(followup.to)) {
                threateningInfiltrator = true;
                break;
              }
            }
            if (threateningInfiltrator) {
              score += 35 * personalityInfluence; // Threatening eviction
              score += infiltrationThreat * personalityInfluence * 0.15; // Partial penalty relief
            }
          }
        }
        
        // 5. IRON FORTRESS: Pawn shield protection (kept from original, 2x multiplier)
        if (move.piece === 'p') {
          const myKing = findKingPosition(game, game.turn());
          if (myKing) {
            const kingFile = String.fromCharCode(97 + myKing.col);
            const shieldFiles = [
              String.fromCharCode(kingFile.charCodeAt(0) - 1),
              kingFile,
              String.fromCharCode(kingFile.charCodeAt(0) + 1)
            ];
            const fromFile = move.from[0];
            // Penalize moving pawns in front of our own king (breaks shield)
            if (shieldFiles.includes(fromFile)) {
              score -= 60 * personalityInfluence * 2; // 2x penalty for Fortress
            }
          }
        }
        
        // 6. ROOK COORDINATION: Rooks should stay connected and on back ranks
        if (move.piece === 'r') {
          const toRank = parseInt(move.to[1]);
          const homeRanks = game.turn() === 'w' ? [1, 2] : [7, 8];
          if (homeRanks.includes(toRank)) {
            score += 20 * personalityInfluence; // Rooks defend from back ranks
          }
        }
        break;
        
      case 'positional':
        // Center control
        const centralSquares = ['c3', 'c4', 'c5', 'c6', 'd3', 'd4', 'd5', 'd6', 'e3', 'e4', 'e5', 'e6', 'f3', 'f4', 'f5', 'f6'];
        if (centralSquares.includes(move.to)) score += 50 * personalityInfluence;
        // Pawn structure (non-capturing pawn moves)
        if (move.piece === 'p' && !move.captured) score += 30 * personalityInfluence;
        // Piece development
        if ((move.piece === 'n' || move.piece === 'b') && move.from.includes(game.turn() === 'w' ? '1' : '8')) {
          score += 40 * personalityInfluence;
        }
        
        // PAWN STRUCTURE AWARENESS: Positional player values intact structures
        if (move.piece === 'p') {
          const myKing = findKingPosition(game, game.turn());
          if (myKing) {
            const kingFile = String.fromCharCode(97 + myKing.col);
            const shieldFiles = [
              String.fromCharCode(kingFile.charCodeAt(0) - 1),
              kingFile,
              String.fromCharCode(kingFile.charCodeAt(0) + 1)
            ];
            const fromFile = move.from[0];
            // Slight penalty for breaking own pawn shield (values structure)
            if (shieldFiles.includes(fromFile)) {
              score -= 30 * personalityInfluence;
            }
          }
          // Penalty only for captures that create doubled pawns
          // (capturing onto a file where we already have a pawn)
          if (move.captured) {
            const toFile = move.to[0];
            const board = game.board();
            const myColor = game.turn();
            let hasPawnOnFile = false;
            for (let r = 0; r < 8; r++) {
              const col = toFile.charCodeAt(0) - 97;
              const piece = board[r][col];
              if (piece && piece.type === 'p' && piece.color === myColor) {
                // Check it's not the pawn we're moving
                const fromCol = move.from[0].charCodeAt(0) - 97;
                const fromRow = 8 - parseInt(move.from[1]);
                if (r !== fromRow || col !== fromCol) {
                  hasPawnOnFile = true;
                  break;
                }
              }
            }
            if (hasPawnOnFile) {
              score -= 25 * personalityInfluence; // Dislikes creating doubled pawns
            }
          }
        }
        // PROPHYLAXIS: Aware of enemy pawn storms, values defensive preparation
        // Bonus for moves that consolidate defense against incoming storms
        if (move.san === 'O-O' || move.san === 'O-O-O') {
          score += 30 * personalityInfluence; // Castling is positionally important
        }
        
        // ========== PETROSIAN ENHANCEMENTS ==========
        
        // 1. EXCHANGE SACRIFICE AWARENESS (The Petrosian Special)
        // R for N/B is normally -2 material, but if it removes attackers or improves structure, it's worth it
        // +70 bonus (enough to override ~0.5 eval gap in MultiPV scenarios)
        if (move.piece === 'r' && (move.captured === 'n' || move.captured === 'b')) {
          const myKing = findKingPosition(game, game.turn());
          if (myKing) {
            // Check if the captured piece was near our king (removing an attacker)
            const capturedCol = move.to.charCodeAt(0) - 97;
            const capturedRow = 8 - parseInt(move.to[1]);
            const distToKing = Math.max(Math.abs(capturedCol - myKing.col), Math.abs(capturedRow - myKing.row));
            
            if (distToKing <= 3) {
              // Captured piece was threatening our king - exchange sacrifice is justified!
              score += 70 * personalityInfluence; // Strong enough to override 0.5 eval difference
            } else if (centralSquares.includes(move.to)) {
              // Captured piece was controlling center - structural improvement
              score += 50 * personalityInfluence;
            }
          }
        }
        
        // 2. BAD BISHOP TAX (The "Tall Pawn" Penalty)
        // Bishops blocked by own pawns on same color are nearly useless
        {
          const board = game.board();
          const myColor = game.turn();
          
          // Find our bishops and check if they're "bad"
          for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
              const piece = board[row][col];
              if (piece && piece.type === 'b' && piece.color === myColor) {
                // Determine bishop's color (light or dark square)
                const isLightSquare = (row + col) % 2 === 0;
                
                // Count our pawns on the same color squares
                let blockedPawns = 0;
                for (let pr = 0; pr < 8; pr++) {
                  for (let pc = 0; pc < 8; pc++) {
                    const pawn = board[pr][pc];
                    if (pawn && pawn.type === 'p' && pawn.color === myColor) {
                      const pawnOnLight = (pr + pc) % 2 === 0;
                      if (pawnOnLight === isLightSquare) {
                        blockedPawns++;
                      }
                    }
                  }
                }
                
                // If 4+ pawns block this bishop, it's a "bad bishop"
                // Penalty scales with blocked pawns: 4 pawns = -20, 5 = -30, 6+ = -40
                if (blockedPawns >= 4) {
                  const penalty = Math.min(40, (blockedPawns - 3) * 10);
                  score -= penalty * personalityInfluence * 0.5; // Applied per move evaluation
                }
              }
            }
          }
        }
        
        // 3. OVER-PROTECTION BONUS (The Nimzowitsch Logic)
        // Bonus for adding defenders to already-defended central pawns
        // This creates rock-solid structures that suffocate the opponent
        {
          const board = game.board();
          const myColor = game.turn();
          const enemyColor = myColor === 'w' ? 'b' : 'w';
          const centralPawnSquares = ['d4', 'd5', 'e4', 'e5', 'c4', 'c5', 'f4', 'f5'];
          
          // Check if move adds defense to a central pawn (only for piece moves, not captures)
          if (!move.captured && (move.piece === 'n' || move.piece === 'b' || move.piece === 'r' || move.piece === 'q')) {
            // Check if our destination square defends any central pawn
            const toCol = move.to.charCodeAt(0) - 97;
            const toRow = 8 - parseInt(move.to[1]);
            
            for (const sq of centralPawnSquares) {
              const pawnCol = sq.charCodeAt(0) - 97;
              const pawnRow = 8 - parseInt(sq[1]);
              const piece = board[pawnRow]?.[pawnCol];
              
              // If we have a pawn on this central square
              if (piece && piece.type === 'p' && piece.color === myColor) {
                // Check if our piece can defend this pawn from the destination square
                const colDiff = Math.abs(toCol - pawnCol);
                const rowDiff = Math.abs(toRow - pawnRow);
                
                let defends = false;
                if (move.piece === 'n') {
                  // Knight defends if L-shape away (no ray-tracing needed)
                  defends = (colDiff === 1 && rowDiff === 2) || (colDiff === 2 && rowDiff === 1);
                } else if (move.piece === 'b' || move.piece === 'r' || move.piece === 'q') {
                  // For sliding pieces, check geometry first then ray-trace for blockers
                  const isDiagonal = colDiff === rowDiff && colDiff > 0;
                  const isStraight = (colDiff === 0 || rowDiff === 0) && (colDiff + rowDiff > 0);
                  
                  if ((move.piece === 'b' && isDiagonal) ||
                      (move.piece === 'r' && isStraight) ||
                      (move.piece === 'q' && (isDiagonal || isStraight))) {
                    // Ray-trace to check for blockers between destination and pawn
                    const stepCol = pawnCol === toCol ? 0 : (pawnCol > toCol ? 1 : -1);
                    const stepRow = pawnRow === toRow ? 0 : (pawnRow > toRow ? 1 : -1);
                    let blocked = false;
                    let checkCol = toCol + stepCol;
                    let checkRow = toRow + stepRow;
                    while (checkCol !== pawnCol || checkRow !== pawnRow) {
                      const blocker = board[checkRow]?.[checkCol];
                      if (blocker) {
                        blocked = true;
                        break;
                      }
                      checkCol += stepCol;
                      checkRow += stepRow;
                    }
                    defends = !blocked;
                  }
                }
                
                if (defends) {
                  // Count existing defenders using temporary board swap
                  // Replace our pawn with enemy pawn, count our captures on that square
                  const testGame = new Chess(game.fen());
                  testGame.remove(sq as any);
                  testGame.put({ type: 'p', color: enemyColor }, sq as any);
                  
                  // Count how many of our pieces can capture this "enemy pawn"
                  const captureMoves = testGame.moves({ verbose: true });
                  let existingDefenders = 0;
                  for (const m of captureMoves) {
                    if (m.to === sq && m.captured && m.from !== move.from) {
                      existingDefenders++;
                    }
                  }
                  
                  // If pawn already has defenders, this is over-protection!
                  if (existingDefenders >= 1) {
                    score += 10 * personalityInfluence; // +10 for over-protecting
                  }
                }
              }
            }
          }
        }
        break;
        
      case 'bishop_lover':
        {
          const board = game.board();
          const myColor = game.turn();
          const enemyColor = myColor === 'w' ? 'b' : 'w';
          
          if (move.piece === 'b') score += 60 * personalityInfluence;
          // Long diagonals
          const longDiagonals = ['a1', 'b2', 'c3', 'd4', 'e5', 'f6', 'g7', 'h8', 'a8', 'b7', 'c6', 'd5', 'e4', 'f3', 'g2', 'h1'];
          if (move.piece === 'b' && longDiagonals.includes(move.to)) score += 40 * personalityInfluence;
          // Prefer trading knights for bishops
          if (move.captured === 'n' && move.piece !== 'n') score += 30 * personalityInfluence;
          
          // PAWN STORMS OPEN DIAGONALS: Bishop lover likes pawn advances that clear diagonals
          if (move.piece === 'p') {
            const toFile = move.to[0];
            // Central pawn advances open diagonals for bishops
            if (['d', 'e'].includes(toFile)) {
              score += 25 * personalityInfluence; // Central pawn pushes open bishop lines
            }
            // Fianchetto-supporting moves (b3/g3 or b6/g6)
            const fianchettoSquares = myColor === 'w' ? ['b3', 'g3'] : ['b6', 'g6'];
            if (fianchettoSquares.includes(move.to)) {
              score += 35 * personalityInfluence; // Love fianchetto setups
            }
          }
          
          // 1. SIDE-PAWN LEAD BONUS (Hypermodern Flank Attacks)
          // a4/h4 or a5/h5 pawns create Alekhine/Grunfeld-style flank pressure
          if (move.piece === 'p') {
            const flankPawnSquares = myColor === 'w' 
              ? ['a4', 'h4', 'a5', 'h5'] 
              : ['a5', 'h5', 'a4', 'h4'];
            if (flankPawnSquares.includes(move.to)) {
              score += 25 * personalityInfluence; // Side-pawn leads open diagonals
            }
          }
          
          // 2. BISHOP PAIR MULTIPLIER (+40 global bonus)
          // Having two bishops vs opponent's one or zero is a huge advantage
          {
            let myBishops = 0;
            let enemyBishops = 0;
            for (let r = 0; r < 8; r++) {
              for (let c = 0; c < 8; c++) {
                const piece = board[r]?.[c];
                if (piece && piece.type === 'b') {
                  if (piece.color === myColor) myBishops++;
                  else enemyBishops++;
                }
              }
            }
            // If we have the bishop pair advantage, boost ALL moves
            if (myBishops === 2 && enemyBishops <= 1) {
              score += 40 * personalityInfluence; // Global bonus for bishop pair
              // ANTI-TRADE: Strongly penalize trading one of our bishops
              if (move.piece === 'b' && move.captured) {
                score -= 60 * personalityInfluence; // Fight to keep the pair!
              }
            }
          }
          
          // 3. ANTI-BLOCKADE LOGIC
          // Penalty for pawns on same color squares as our bishop (blocking diagonals)
          if (move.piece === 'p') {
            // Find our bishops and check if this pawn move blocks them
            for (let r = 0; r < 8; r++) {
              for (let c = 0; c < 8; c++) {
                const piece = board[r]?.[c];
                if (piece && piece.type === 'b' && piece.color === myColor) {
                  const bishopOnLight = (r + c) % 2 === 0;
                  const toCol = move.to.charCodeAt(0) - 97;
                  const toRow = 8 - parseInt(move.to[1]);
                  const pawnOnLight = (toRow + toCol) % 2 === 0;
                  
                  // Penalty if pawn lands on same color as our bishop
                  if (pawnOnLight === bishopOnLight) {
                    score -= 20 * personalityInfluence; // Blocking our own bishop!
                  }
                }
              }
            }
          }
        }
        break;
        
      case 'knight_lover':
        {
          const board = game.board();
          const myColor = game.turn();
          const enemyColor = myColor === 'w' ? 'b' : 'w';
          
          if (move.piece === 'n') score += 60 * personalityInfluence;
          // Outpost squares (5th rank)
          const outposts5 = ['c5', 'd5', 'e5', 'f5'];
          const outposts4 = ['c4', 'd4', 'e4', 'f4'];
          if (move.piece === 'n' && outposts5.includes(move.to)) score += 50 * personalityInfluence;
          if (move.piece === 'n' && outposts4.includes(move.to)) score += 50 * personalityInfluence;
          // Prefer trading bishops for knights
          if (move.captured === 'b' && move.piece !== 'b') score += 30 * personalityInfluence;
          
          // CLOSED POSITIONS FAVOR KNIGHTS: Dislikes pawn advances that open the position
          if (move.piece === 'p') {
            // Penalty for pawn exchanges (opens the position, bad for knights)
            if (move.captured === 'p') {
              score -= 25 * personalityInfluence; // Dislikes opening pawn structures
            }
            // Central pawn pushes past 4th rank open the game too much
            const toFile = move.to[0];
            const toRank = parseInt(move.to[1]);
            if (['d', 'e'].includes(toFile)) {
              const advancedRank = myColor === 'w' ? 5 : 4;
              if ((myColor === 'w' && toRank >= advancedRank) || 
                  (myColor === 'b' && toRank <= advancedRank)) {
                score -= 20 * personalityInfluence; // Prefers blocked center for knight maneuvers
              }
            }
          }
          // Knights love maneuvering in closed positions - bonus for knight repositioning
          if (move.piece === 'n' && !move.captured) {
            score += 15 * personalityInfluence; // Values quiet knight moves
          }
          
          // 1. THE "OCTOPUS" KNIGHT (6th Rank = Devastating)
          // A Knight on the 6th rank is often worth more than a Rook
          if (move.piece === 'n') {
            const sixthRankSquares = myColor === 'w' 
              ? ['c6', 'd6', 'e6', 'f6']  // White's 6th rank
              : ['c3', 'd3', 'e3', 'f3']; // Black's 6th rank (3rd from black's view)
            if (sixthRankSquares.includes(move.to)) {
              score += 100 * personalityInfluence; // Double outpost bonus! The "Octopus"
            }
          }
          
          // 2. ANCHOR PAWN LOGIC
          // An outpost is only good if it's permanent (supported by pawn)
          if (move.piece === 'n') {
            const allOutposts = ['c4', 'c5', 'd4', 'd5', 'e4', 'e5', 'f4', 'f5'];
            if (allOutposts.includes(move.to)) {
              // Check if we have a pawn supporting this square
              const toCol = move.to.charCodeAt(0) - 97;
              const toRow = 8 - parseInt(move.to[1]);
              
              // Pawns that could support this square (diagonally behind)
              const supportRow = myColor === 'w' ? toRow + 1 : toRow - 1;
              const leftPawn = board[supportRow]?.[toCol - 1];
              const rightPawn = board[supportRow]?.[toCol + 1];
              
              const hasAnchor = (leftPawn && leftPawn.type === 'p' && leftPawn.color === myColor) ||
                               (rightPawn && rightPawn.type === 'p' && rightPawn.color === myColor);
              
              if (hasAnchor) {
                score += 30 * personalityInfluence; // Permanent outpost with anchor pawn!
              }
            }
          }
          
          // 3. FORK VISION (Tactical Geometry)
          // Knights are the kings of forks - bonus when Q/K are on same-color squares
          if (move.piece === 'n') {
            // Find enemy queen and king positions
            let enemyQueenPos: {row: number, col: number} | null = null;
            let enemyKingPos: {row: number, col: number} | null = null;
            
            for (let r = 0; r < 8; r++) {
              for (let c = 0; c < 8; c++) {
                const piece = board[r]?.[c];
                if (piece && piece.color === enemyColor) {
                  if (piece.type === 'q') enemyQueenPos = {row: r, col: c};
                  if (piece.type === 'k') enemyKingPos = {row: r, col: c};
                }
              }
            }
            
            if (enemyQueenPos && enemyKingPos) {
              // Check if Q and K are on same color squares (fork geometry favorable)
              const queenOnLight = (enemyQueenPos.row + enemyQueenPos.col) % 2 === 0;
              const kingOnLight = (enemyKingPos.row + enemyKingPos.col) % 2 === 0;
              
              if (queenOnLight === kingOnLight) {
                // Same color = fork-prone geometry! Apply 1.5x multiplier to knight moves
                score += 30 * personalityInfluence; // Fork vision bonus
                
                // Extra bonus if our knight move threatens both (actual fork check)
                const toCol = move.to.charCodeAt(0) - 97;
                const toRow = 8 - parseInt(move.to[1]);
                
                const knightOffsets = [
                  [-2, -1], [-2, 1], [-1, -2], [-1, 2],
                  [1, -2], [1, 2], [2, -1], [2, 1]
                ];
                
                let threatsQueen = false;
                let threatsKing = false;
                
                for (const [dr, dc] of knightOffsets) {
                  const tr = toRow + dr;
                  const tc = toCol + dc;
                  if (tr === enemyQueenPos.row && tc === enemyQueenPos.col) threatsQueen = true;
                  if (tr === enemyKingPos.row && tc === enemyKingPos.col) threatsKing = true;
                }
                
                if (threatsQueen && threatsKing) {
                  score += 200 * personalityInfluence; // Actual royal fork!
                } else if (threatsQueen || threatsKing) {
                  score += 40 * personalityInfluence; // Threatening one royal piece
                }
              }
            }
          }
        }
        break;
        
      case 'balanced':
      default:
        // Grandmaster-level awareness: In opposite-side castling, value pawn storms more
        if (isOppositeSideCastling && move.piece === 'p') {
          const toRank = parseInt(move.to[1]);
          const toFile = move.to[0];
          // Get enemy king position
          const enemyKing = findKingPosition(game, game.turn() === 'w' ? 'b' : 'w');
          if (enemyKing) {
            const enemyKingFile = String.fromCharCode(97 + enemyKing.col);
            const adjacentFiles = [
              String.fromCharCode(enemyKingFile.charCodeAt(0) - 1),
              enemyKingFile,
              String.fromCharCode(enemyKingFile.charCodeAt(0) + 1)
            ];
            // In opposite-side castling, pawn storms are safe and strong
            if (adjacentFiles.includes(toFile)) {
              // GM recognizes racing dynamics - boost storm value
              const stormBonus = (game.turn() === 'w' ? toRank - 2 : 9 - toRank) * 25 * personalityInfluence;
              score += stormBonus * 1.5; // 1.5x bonus in opposite-side castling positions
            }
          }
        }
        break;
    }
    
    return { candidate, score };
  });
  
  // Sort by personality-adjusted score
  scoredMoves.sort((a, b) => b.score - a.score);
  
  // Weighted random selection from top candidates
  // Higher difficulty = more deterministic (picks best)
  // Lower difficulty = more random among good options
  const topCount = Math.min(3, scoredMoves.length);
  const weights = scoredMoves.slice(0, topCount).map((_, i) => Math.pow(0.5, i));
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  
  let random = Math.random() * totalWeight;
  for (let i = 0; i < topCount; i++) {
    random -= weights[i];
    if (random <= 0) {
      return scoredMoves[i].candidate;
    }
  }
  
  return scoredMoves[0].candidate;
}

// Main bot move generation function
export async function generateBotMoveClient(
  fen: string,
  personality: BotPersonality,
  difficulty: BotDifficulty,
  remainingTimeMs?: number,
  moveCount?: number,
  lastMoveInfo?: LastMoveInfo
): Promise<{ move: string; from: string; to: string; promotion?: string; isFreeCapture?: boolean } | null> {
  // CPU Safety: Stop any previous search before starting a new one
  // Prevents "double-search" if user moves quickly or rapid game changes
  clientStockfish.stopAnalysis();
  
  const game = new Chess(fen);
  const moves = game.moves({ verbose: true });
  
  // Log recapture awareness for debugging
  if (lastMoveInfo?.captured) {
    console.log(`[ClientBot] Opponent captured ${lastMoveInfo.captured} (${lastMoveInfo.capturedValue} cp) on ${lastMoveInfo.to}`);
  }
  
  if (moves.length === 0) {
    return null;
  }
  
  // Only one legal move - play it immediately
  if (moves.length === 1) {
    const move = moves[0];
    return {
      move: move.san,
      from: move.from,
      to: move.to,
      promotion: move.promotion,
    };
  }
  
  const config = DIFFICULTY_CONFIG[difficulty];
  
  // ============================================
  // PRIORITY 1: IMMEDIATE CHECKMATE (Always take if available)
  // ============================================
  const checkmateMove = moves.find(m => m.san.includes('#'));
  if (checkmateMove) {
    console.log(`[ClientBot] CHECKMATE! Playing ${checkmateMove.san}`);
    return {
      move: checkmateMove.san,
      from: checkmateMove.from,
      to: checkmateMove.to,
      promotion: checkmateMove.promotion,
    };
  }
  
  // ============================================
  // PRIORITY 2: FREE PIECE CAPTURE (Clean material gain)
  // ============================================
  // Check for hanging pieces before any deep analysis
  // Uses same probability scaling as recaptures: Patzer 25%, Novice 50%, Intermediate 75%, Club+ 100%
  const freeCaptureRoll = Math.random();
  const shouldSeeFreeCaptures = freeCaptureRoll < config.recaptureChance;
  
  if (shouldSeeFreeCaptures) {
    const freeCaptures = detectFreeCaptures(fen);
    
    if (freeCaptures.length > 0) {
      // Take the highest-value free piece
      const bestFreeCapture = freeCaptures[0];
      const pieceNames: Record<string, string> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen' };
      const pieceName = bestFreeCapture.move.captured ? pieceNames[bestFreeCapture.move.captured] || 'piece' : 'piece';
      
      console.log(`[ClientBot] FREE PIECE DETECTED! Taking hanging ${pieceName} on ${bestFreeCapture.move.to} (${bestFreeCapture.capturedValue} cp)`);
      
      return {
        move: bestFreeCapture.move.san,
        from: bestFreeCapture.move.from,
        to: bestFreeCapture.move.to,
        promotion: bestFreeCapture.move.promotion,
        isFreeCapture: true,  // Flag for 2-second delay
      };
    }
  } else {
    // Log when bot "misses" a free piece due to probability roll
    const freeCaptures = detectFreeCaptures(fen);
    if (freeCaptures.length > 0) {
      const pieceNames: Record<string, string> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen' };
      const pieceName = freeCaptures[0].move.captured ? pieceNames[freeCaptures[0].move.captured] || 'piece' : 'piece';
      console.log(`[ClientBot] Missed free ${pieceName} (${(config.recaptureChance * 100).toFixed(0)}% chance, rolled ${(freeCaptureRoll * 100).toFixed(0)}%)`);
    }
  }
  
  // Tactician: No longer uses depth/node bonuses (causes node starvation at high depths)
  // Instead uses pattern recognition heuristics to prioritize tactical branches
  const effectiveMaxDepth = config.maxDepth;
  const effectiveStockfishNodes = config.stockfishNodes;
  
  // Calculate time budget
  let timeBudget = config.timePerMoveMs;
  if (remainingTimeMs !== undefined) {
    // Use 1/40th of remaining time with overhead buffer
    const moveOverhead = 100;
    timeBudget = Math.min(config.timePerMoveMs, Math.max(200, (remainingTimeMs / 40) - moveOverhead));
  }
  
  // Deliberate mistake logic (skip in opening to avoid terrible play early)
  const inOpening = isOpeningPhase(moveCount || 0);
  if (!inOpening && Math.random() < config.mistakeProbability) {
    console.log(`[ClientBot] Making deliberate mistake (${(config.mistakeProbability * 100).toFixed(0)}% chance)`);
    const randomIndex = Math.floor(Math.random() * Math.min(moves.length, 5));
    const move = moves[randomIndex];
    return {
      move: move.san,
      from: move.from,
      to: move.to,
      promotion: move.promotion,
    };
  }
  
  try {
    // Phase 1: Local Opening Book (offline, fast)
    if (inOpening) {
      try {
        const bookResult = await getBookMoves(fen);
        
        if (bookResult.moves.length > 0) {
          const selectedMove = selectBookMoveByPersonality(bookResult.moves, personality);
          
          if (selectedMove) {
            const matchingMove = moves.find(m => 
              m.from === selectedMove.from && 
              m.to === selectedMove.to &&
              (m.promotion || '') === (selectedMove.promotion || '')
            );
            
            if (matchingMove) {
              console.log(`[ClientBot] Playing opening book move: ${matchingMove.san} (${personality}, weight: ${selectedMove.weight})`);
              return {
                move: matchingMove.san,
                from: matchingMove.from,
                to: matchingMove.to,
                promotion: matchingMove.promotion,
              };
            }
          }
        }
      } catch (error) {
        console.warn('[ClientBot] Opening book lookup failed, continuing to engine:', error);
      }
    }
    
    // Phase 2: Engine evaluation
    // Use Stockfish for intermediate+ difficulty
    if (config.useStockfish) {
      console.log(`[ClientBot] Bot Config: ${difficulty} (${config.elo} Elo)`);
      console.log(`[ClientBot] Stockfish: ${effectiveStockfishNodes.toLocaleString()} nodes, MultiPV ${config.multiPvCount}, Depth ${config.maxDepth}`);
      console.log(`[ClientBot] Target time: ${config.timePerMoveMs}ms`);
      
      // Pass game.turn() to normalize evaluations to White's perspective
      // This ensures MateVision correctly identifies who is delivering vs receiving mate
      const botColor = game.turn();
      const topMoves = await clientStockfish.getTopMoves(fen, config.multiPvCount, effectiveStockfishNodes, botColor);
      
      // Pre-evaluate recaptures: If opponent captured a high-value piece and recapture
      // isn't in topMoves, explicitly evaluate it to prevent queen sacrifice blunders
      // Uses recaptureChance: Patzer 25%, Novice 50%, Intermediate 75%, Club+ 100%
      let enrichedTopMoves = [...topMoves];
      const recaptureRoll = Math.random();
      const shouldPreEvaluateRecaptures = recaptureRoll < config.recaptureChance;
      
      // Use a fixed small node count for quick recapture evaluation (~50-100ms)
      // This is enough to get a reliable +/- eval without causing noticeable delay
      const RECAPTURE_EVAL_NODES = 50000;
      
      // Log recapture roll result for debugging
      if (lastMoveInfo?.captured && lastMoveInfo.capturedValue !== undefined && lastMoveInfo.capturedValue >= 300) {
        if (shouldPreEvaluateRecaptures) {
          console.log(`[ClientBot] Recapture check passed (${(config.recaptureChance * 100).toFixed(0)}% chance, rolled ${(recaptureRoll * 100).toFixed(0)}%)`);
        } else {
          console.log(`[ClientBot] Missed recapture opportunity (${(config.recaptureChance * 100).toFixed(0)}% chance, rolled ${(recaptureRoll * 100).toFixed(0)}%)`);
        }
      }
      
      if (shouldPreEvaluateRecaptures && lastMoveInfo?.captured && lastMoveInfo.capturedValue !== undefined && lastMoveInfo.capturedValue >= 300) {
        const recaptureSquare = lastMoveInfo.to;
        const legalRecaptures = moves.filter(m => m.to === recaptureSquare && m.captured);
        
        if (legalRecaptures.length > 0) {
          // Check if any recapture is already in topMoves
          const recaptureInTopMoves = topMoves.some(tm => {
            const from = tm.move.slice(0, 2);
            const to = tm.move.slice(2, 4);
            return to === recaptureSquare;
          });
          
          if (!recaptureInTopMoves) {
            // Recapture NOT in topMoves - explicitly evaluate each recapture candidate
            console.log(`[ClientBot] Pre-evaluating ${legalRecaptures.length} recapture(s) to ${recaptureSquare} (not in topMoves)`);
            
            for (const recapture of legalRecaptures) {
              try {
                // Make the recapture move on a copy to get the resulting FEN
                const tempGame = new Chess(fen);
                tempGame.move({ from: recapture.from, to: recapture.to, promotion: recapture.promotion });
                const recaptureFen = tempGame.fen();
                
                // Evaluate the position after recapture using analyzePosition
                // After recapture, it's opponent's turn, so Stockfish eval is from opponent's perspective
                const recaptureEval = await clientStockfish.analyzePosition(recaptureFen, RECAPTURE_EVAL_NODES);
                
                // Negate the evaluation because we evaluated from opponent's perspective
                // If Stockfish says +2.0 (opponent up 2 pawns), that's -2.0 for us
                const ourEval = -recaptureEval.evaluation;
                const uciMove = recapture.from + recapture.to + (recapture.promotion || '');
                
                // Create a TopMoveResult for this recapture
                const recaptureResult: TopMoveResult = {
                  move: uciMove,
                  evaluation: ourEval,
                  isMate: recaptureEval.isMate,
                  mateIn: recaptureEval.mateIn,
                  principalVariation: [recapture.san]
                };
                
                // Add to enriched topMoves if evaluation is reasonable
                console.log(`[ClientBot] Recapture ${recapture.san} evaluated: ${ourEval.toFixed(2)} (mate: ${recaptureEval.isMate})`);
                enrichedTopMoves.push(recaptureResult);
              } catch (error) {
                console.warn(`[ClientBot] Failed to evaluate recapture ${recapture.san}:`, error);
              }
            }
          }
        }
      }
      
      if (enrichedTopMoves.length > 0) {
        const selected = selectMoveByPersonality(game, enrichedTopMoves, personality, difficulty, lastMoveInfo, moveCount);
        
        // Convert UCI move to our format
        const uciMove = selected.move;
        const from = uciMove.slice(0, 2);
        const to = uciMove.slice(2, 4);
        const promotion = uciMove.length > 4 ? uciMove[4] : undefined;
        
        // Find matching legal move for SAN
        const matchingMove = moves.find(m => 
          m.from === from && m.to === to && (m.promotion || '') === (promotion || '')
        );
        
        if (matchingMove) {
          console.log(`[ClientBot] Selected ${matchingMove.san} (${personality}) from ${topMoves.length} candidates`);
          return {
            move: matchingMove.san,
            from: matchingMove.from,
            to: matchingMove.to,
            promotion: matchingMove.promotion,
          };
        }
      }
    }
    
    // Fallback: Use iterative deepening minimax with enhanced heuristics
    console.log(`[ClientBot] Using minimax with depth ${effectiveMaxDepth}, time ${timeBudget}ms`);
    console.log(`[ClientBot] Heuristics: killers=${config.useKillers}, history=${config.useHistory}, mobility=${config.mobilityWeight}%, kingSafety=${config.kingSafetyWeight}%, mopUp=${config.mopUpWeight}%, tapered=${config.useTaperedEval}`);
    
    // Use standard iterative deepening for all difficulties
    // Note: TT-enhanced search was removed for Grandmaster because the overhead
    // of transposition table operations + heavy pawn structure evaluation
    // actually made it slower than the simpler, more efficient minimax.
    // Grandmaster still benefits from higher depth/nodes/time limits.
    const result = iterativeDeepening(game, timeBudget, effectiveMaxDepth, config);
    
    if (result.bestMove) {
      const matchingMove = moves.find(m => m.san === result.bestMove);
      
      if (matchingMove) {
        console.log(`[ClientBot] Minimax found ${matchingMove.san} at depth ${result.depth}`);
        return {
          move: matchingMove.san,
          from: matchingMove.from,
          to: matchingMove.to,
          promotion: matchingMove.promotion,
        };
      }
    }
    
    // Last resort: random move
    const randomMove = moves[Math.floor(Math.random() * moves.length)];
    return {
      move: randomMove.san,
      from: randomMove.from,
      to: randomMove.to,
      promotion: randomMove.promotion,
    };
    
  } catch (error) {
    console.error('[ClientBot] Error generating move:', error);
    
    // Emergency fallback
    const randomMove = moves[Math.floor(Math.random() * moves.length)];
    return {
      move: randomMove.san,
      from: randomMove.from,
      to: randomMove.to,
      promotion: randomMove.promotion,
    };
  }
}

// Export difficulty config for UI display
export function getBotElo(difficulty: BotDifficulty): number {
  return DIFFICULTY_CONFIG[difficulty].elo;
}

export function getThinkTime(difficulty: BotDifficulty): { min: number; max: number } {
  const config = DIFFICULTY_CONFIG[difficulty];
  return {
    min: Math.floor(config.timePerMoveMs * 0.5),
    max: config.timePerMoveMs,
  };
}
