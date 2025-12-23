import { Chess, Move } from 'chess.js';
import { clientStockfish, TopMoveResult } from './stockfish';
import { getLichessOpeningMoves, selectOpeningMoveByPersonality, isOpeningPhase } from './lichessOpenings';
import type { BotPersonality, BotDifficulty } from '@shared/botTypes';

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
}

const DIFFICULTY_CONFIG: Record<BotDifficulty, DifficultyConfig> = {
  // Beginner (400 Elo): No advanced heuristics, basic evaluation
  beginner: { 
    elo: 400, timePerMoveMs: 500, maxDepth: 2, multiPvCount: 5, stockfishNodes: 10000, 
    mistakeProbability: 0.4, useStockfish: false,
    useKillers: false, useHistory: false,
    mobilityWeight: 0, kingSafetyWeight: 0, mopUpWeight: 0, useTaperedEval: false
  },
  // Novice (600 Elo): Minimal heuristics, slight mobility awareness
  novice: { 
    elo: 600, timePerMoveMs: 1000, maxDepth: 3, multiPvCount: 5, stockfishNodes: 50000, 
    mistakeProbability: 0.2, useStockfish: false,
    useKillers: false, useHistory: false,
    mobilityWeight: 20, kingSafetyWeight: 10, mopUpWeight: 0, useTaperedEval: false
  },
  // Intermediate (900 Elo): Basic search heuristics, growing positional awareness
  intermediate: { 
    elo: 900, timePerMoveMs: 1500, maxDepth: 4, multiPvCount: 4, stockfishNodes: 100000, 
    mistakeProbability: 0.1, useStockfish: true,
    useKillers: true, useHistory: false,
    mobilityWeight: 40, kingSafetyWeight: 30, mopUpWeight: 20, useTaperedEval: false
  },
  // Club (1200 Elo): Full search heuristics, decent evaluation
  club: { 
    elo: 1200, timePerMoveMs: 2000, maxDepth: 5, multiPvCount: 4, stockfishNodes: 200000, 
    mistakeProbability: 0.01, useStockfish: true,
    useKillers: true, useHistory: true,
    mobilityWeight: 60, kingSafetyWeight: 50, mopUpWeight: 50, useTaperedEval: true
  },
  // Advanced (1500 Elo): Strong heuristics, good evaluation
  advanced: { 
    elo: 1500, timePerMoveMs: 2500, maxDepth: 6, multiPvCount: 3, stockfishNodes: 500000, 
    mistakeProbability: 0.005, useStockfish: true,
    useKillers: true, useHistory: true,
    mobilityWeight: 80, kingSafetyWeight: 70, mopUpWeight: 70, useTaperedEval: true
  },
  // Expert (1800 Elo): Full strength heuristics
  expert: { 
    elo: 1800, timePerMoveMs: 3000, maxDepth: 8, multiPvCount: 3, stockfishNodes: 1000000, 
    mistakeProbability: 0.001, useStockfish: true,
    useKillers: true, useHistory: true,
    mobilityWeight: 90, kingSafetyWeight: 90, mopUpWeight: 90, useTaperedEval: true
  },
  // Master (2000 Elo): Maximum strength
  master: { 
    elo: 2000, timePerMoveMs: 4000, maxDepth: 10, multiPvCount: 3, stockfishNodes: 2000000, 
    mistakeProbability: 0.00025, useStockfish: true,
    useKillers: true, useHistory: true,
    mobilityWeight: 100, kingSafetyWeight: 100, mopUpWeight: 100, useTaperedEval: true
  },
  // Grandmaster (2500 Elo): Uses transposition tables and advanced pawn evaluation
  grandmaster: { 
    elo: 2500, timePerMoveMs: 5000, maxDepth: 12, multiPvCount: 3, stockfishNodes: 3000000, 
    mistakeProbability: 0.00001, useStockfish: true,
    useKillers: true, useHistory: true,
    mobilityWeight: 100, kingSafetyWeight: 100, mopUpWeight: 100, useTaperedEval: true
  },
};

// Personality-based move selection from MultiPV candidates
function selectMoveByPersonality(
  game: Chess,
  topMoves: TopMoveResult[],
  personality: BotPersonality,
  difficulty: BotDifficulty
): TopMoveResult {
  if (topMoves.length === 0) {
    throw new Error('No moves available');
  }
  
  if (topMoves.length === 1) {
    return topMoves[0];
  }
  
  const config = DIFFICULTY_CONFIG[difficulty];
  
  // CRITICAL: For Master/Grandmaster level, immediately return any winning mate
  // This ensures forced mates are never missed due to personality scoring
  // Note: isMate=true, evaluation>0 means WE deliver mate; evaluation<0 means we GET mated
  if (difficulty === 'grandmaster' || difficulty === 'master' || difficulty === 'expert') {
    const winningMate = topMoves.find(m => m.isMate && m.evaluation > 0);
    if (winningMate) {
      console.log(`[ClientBot] Found forced mate in ${winningMate.mateIn}! Playing ${winningMate.move} immediately.`);
      return winningMate;
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
    
    // Detect opposite-side castling for GM awareness
    const isOppositeSideCastling = detectOppositeSideCastling(game);
    
    // Apply personality bonuses
    switch (personality) {
      case 'aggressive':
        if (move.captured) score += 80 * personalityInfluence;
        if (move.san.includes('+')) score += 100 * personalityInfluence;
        // Prefer moves toward enemy king side
        if (game.turn() === 'w' && parseInt(move.to[1]) >= 5) score += 40 * personalityInfluence;
        if (game.turn() === 'b' && parseInt(move.to[1]) <= 4) score += 40 * personalityInfluence;
        
        // PAWN STORM BONUS (3x multiplier for Aggressor)
        // Bonus for advancing pawns on the enemy king's flank
        if (move.piece === 'p') {
          const toRank = parseInt(move.to[1]);
          const toFile = move.to[0];
          // Get enemy king position to determine attack direction
          const enemyKing = findKingPosition(game, game.turn() === 'w' ? 'b' : 'w');
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
              const stormBonus = (game.turn() === 'w' ? toRank - 2 : 9 - toRank) * 30 * personalityInfluence;
              score += stormBonus * 3;
            }
          }
        }
        break;
        
      case 'tactician':
        if (move.captured) score += PIECE_VALUES[move.captured] * 0.2 * personalityInfluence;
        if (move.san.includes('+')) score += 60 * personalityInfluence;
        if (move.san.includes('#')) score += 1000;
        // Love sacrifices (giving up material for attack)
        if (move.captured && move.piece !== 'p') score += 50 * personalityInfluence;
        
        // PAWN STORM FOR TACTICS: Storms open files for rooks/queens
        // Tactician loves when pawn advances create attacking opportunities
        if (move.piece === 'p') {
          const toRank = parseInt(move.to[1]);
          const toFile = move.to[0];
          const enemyKing = findKingPosition(game, game.turn() === 'w' ? 'b' : 'w');
          if (enemyKing) {
            const enemyKingFile = String.fromCharCode(97 + enemyKing.col);
            const adjacentFiles = [
              String.fromCharCode(enemyKingFile.charCodeAt(0) - 1),
              enemyKingFile,
              String.fromCharCode(enemyKingFile.charCodeAt(0) + 1)
            ];
            // Bonus for pawn storms that will open files for heavy pieces
            if (adjacentFiles.includes(toFile)) {
              // 1.5x storm bonus - loves opening files for tactics
              const stormBonus = (game.turn() === 'w' ? toRank - 2 : 9 - toRank) * 25 * personalityInfluence;
              score += stormBonus * 1.5;
            }
          }
        }
        // Lever positions are tactical gold - pawn exchanges open lines
        if (move.piece === 'p' && move.captured === 'p') {
          score += 40 * personalityInfluence; // Pawn exchanges create open files
        }
        break;
        
      case 'defensive':
        // Prefer non-capturing, consolidating moves
        if (!move.captured) score += 30 * personalityInfluence;
        // Love castling
        if (move.san === 'O-O' || move.san === 'O-O-O') score += 100 * personalityInfluence;
        // Prefer moving toward own back rank
        const backRank = game.turn() === 'w' ? '1' : '8';
        if (move.to.includes(backRank) || move.to.includes(game.turn() === 'w' ? '2' : '7')) {
          score += 25 * personalityInfluence;
        }
        
        // PAWN SHIELD BONUS (2x multiplier for Defender)
        // "Iron Fortress" - heavily penalize moving shield pawns (f,g,h for kingside or a,b,c for queenside)
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
              // Negative bonus = penalty (2x for Defender)
              score -= 60 * personalityInfluence * 2;
            }
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
        break;
        
      case 'bishop_lover':
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
          const fianchettoSquares = game.turn() === 'w' ? ['b3', 'g3'] : ['b6', 'g6'];
          if (fianchettoSquares.includes(move.to)) {
            score += 35 * personalityInfluence; // Love fianchetto setups
          }
        }
        break;
        
      case 'knight_lover':
        if (move.piece === 'n') score += 60 * personalityInfluence;
        // Outpost squares
        const outposts = ['c5', 'd5', 'e5', 'f5', 'c4', 'd4', 'e4', 'f4'];
        if (move.piece === 'n' && outposts.includes(move.to)) score += 50 * personalityInfluence;
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
            const advancedRank = game.turn() === 'w' ? 5 : 4;
            if ((game.turn() === 'w' && toRank >= advancedRank) || 
                (game.turn() === 'b' && toRank <= advancedRank)) {
              score -= 20 * personalityInfluence; // Prefers blocked center for knight maneuvers
            }
          }
        }
        // Knights love maneuvering in closed positions - bonus for knight repositioning
        if (move.piece === 'n' && !move.captured) {
          score += 15 * personalityInfluence; // Values quiet knight moves
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
  moveCount?: number
): Promise<{ move: string; from: string; to: string; promotion?: string } | null> {
  const game = new Chess(fen);
  const moves = game.moves({ verbose: true });
  
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
    // Phase 1: Lichess Opening Book (fast, high quality)
    if (inOpening) {
      try {
        const openingData = await getLichessOpeningMoves(fen);
        
        if (openingData && openingData.moves.length > 0) {
          const selectedOpening = selectOpeningMoveByPersonality(openingData.moves, personality);
          
          if (selectedOpening) {
            const matchingMove = moves.find(m => 
              m.san === selectedOpening.san || 
              (m.from + m.to + (m.promotion || '')) === selectedOpening.uci
            );
            
            if (matchingMove) {
              console.log(`[ClientBot] Playing opening book move: ${matchingMove.san} (${personality})`);
              if (openingData.opening) {
                console.log(`[ClientBot] Opening: ${openingData.opening.eco} ${openingData.opening.name}`);
              }
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
        console.warn('[ClientBot] Lichess opening lookup failed, continuing to engine:', error);
      }
    }
    
    // Phase 2: Engine evaluation
    // Use Stockfish for intermediate+ difficulty
    if (config.useStockfish) {
      console.log(`[ClientBot] Using Stockfish with ${config.stockfishNodes} nodes, MultiPV ${config.multiPvCount}`);
      
      const topMoves = await clientStockfish.getTopMoves(fen, config.multiPvCount, config.stockfishNodes);
      
      if (topMoves.length > 0) {
        const selected = selectMoveByPersonality(game, topMoves, personality, difficulty);
        
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
    console.log(`[ClientBot] Using minimax with depth ${config.maxDepth}, time ${timeBudget}ms`);
    console.log(`[ClientBot] Heuristics: killers=${config.useKillers}, history=${config.useHistory}, mobility=${config.mobilityWeight}%, kingSafety=${config.kingSafetyWeight}%, mopUp=${config.mopUpWeight}%, tapered=${config.useTaperedEval}`);
    
    // Use TT-enhanced search for Grandmaster difficulty
    const result = difficulty === 'grandmaster' 
      ? iterativeDeepeningWithTT(game, timeBudget, config.maxDepth, config)
      : iterativeDeepening(game, timeBudget, config.maxDepth, config);
    
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
