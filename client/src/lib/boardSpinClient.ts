import { Chess } from 'chess.js';
import { clientStockfish } from './stockfish';

interface DifficultyConfig {
  minPieces: number;
  maxPieces: number;
  rotationInterval: number;
  excludedAngles: number[];
  multiplier: number;
}

const DIFFICULTY_CONFIGS: Record<string, DifficultyConfig> = {
  'beginner': {
    minPieces: 3,
    maxPieces: 4,
    rotationInterval: 120,
    excludedAngles: [0],
    multiplier: 1.0
  },
  'easy': {
    minPieces: 5,
    maxPieces: 7,
    rotationInterval: 90,
    excludedAngles: [0],
    multiplier: 1.5
  },
  'intermediate': {
    minPieces: 8,
    maxPieces: 11,
    rotationInterval: 60,
    excludedAngles: [0],
    multiplier: 2.0
  },
  'advanced': {
    minPieces: 12,
    maxPieces: 14,
    rotationInterval: 45,
    excludedAngles: [0],
    multiplier: 2.5
  },
  'expert': {
    minPieces: 15,
    maxPieces: 17,
    rotationInterval: 30,
    excludedAngles: [0, 30, 330],
    multiplier: 3.0
  },
  'master': {
    minPieces: 18,
    maxPieces: 20,
    rotationInterval: 15,
    excludedAngles: [0, 15, 30, 330, 345],
    multiplier: 4.0
  }
};

const PIECES = ['P', 'N', 'B', 'R', 'Q'];
const DECISIVE_PIECES = ['R', 'Q']; // Rook or Queen - can force checkmate with king

function getRandomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function isValidPosition(fen: string): boolean {
  try {
    const chess = new Chess(fen);
    const moves = chess.moves();
    return moves.length > 0;
  } catch {
    return false;
  }
}

function generateRandomPosition(targetPieces: number): string {
  const board: (string | null)[][] = Array(8).fill(null).map(() => Array(8).fill(null));
  let piecesPlaced = 0;
  
  const whiteKingFile = getRandomInt(0, 7);
  const whiteKingRank = getRandomInt(0, 2);
  board[whiteKingRank][whiteKingFile] = 'K';
  piecesPlaced++;
  
  let blackKingFile: number, blackKingRank: number;
  do {
    blackKingFile = getRandomInt(0, 7);
    blackKingRank = getRandomInt(5, 7);
  } while (Math.abs(blackKingFile - whiteKingFile) < 2 && Math.abs(blackKingRank - whiteKingRank) < 2);
  
  board[blackKingRank][blackKingFile] = 'k';
  piecesPlaced++;
  
  while (piecesPlaced < targetPieces) {
    const file = getRandomInt(0, 7);
    const rank = getRandomInt(0, 7);
    
    if (board[rank][file] !== null) continue;
    
    const isEdgeRank = rank === 0 || rank === 7;
    const availablePieces = isEdgeRank ? PIECES.filter(p => p !== 'P') : PIECES;
    
    const piece = getRandomElement(availablePieces);
    const isWhite = Math.random() > 0.5;
    
    board[rank][file] = isWhite ? piece : piece.toLowerCase();
    piecesPlaced++;
  }
  
  let fen = '';
  for (let rank = 7; rank >= 0; rank--) {
    let emptyCount = 0;
    for (let file = 0; file < 8; file++) {
      const piece = board[rank][file];
      if (piece) {
        if (emptyCount > 0) {
          fen += emptyCount;
          emptyCount = 0;
        }
        fen += piece;
      } else {
        emptyCount++;
      }
    }
    if (emptyCount > 0) {
      fen += emptyCount;
    }
    if (rank > 0) fen += '/';
  }
  
  const turn = Math.random() > 0.5 ? 'w' : 'b';
  fen += ` ${turn} - - 0 1`;
  
  return fen;
}

function generateValidRandomPosition(targetPieces: number, maxAttempts: number = 20): string {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const fen = generateRandomPosition(targetPieces);
    if (isValidPosition(fen)) {
      return fen;
    }
  }
  return '4k3/8/8/8/8/8/4P3/4K3 w - - 0 1';
}

const MINOR_PIECES = ['N', 'B'];
const MAJOR_PIECES = ['R', 'Q'];

// Generate a 4-piece position avoiding minor-piece-only draws (K+B vs K+B, K+N vs K+N, K+B vs K+N)
function generateDecisive4PiecePosition(maxAttempts: number = 20): string {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const board: (string | null)[][] = Array(8).fill(null).map(() => Array(8).fill(null));
    
    // Place white king (bottom half)
    const whiteKingFile = getRandomInt(0, 7);
    const whiteKingRank = getRandomInt(0, 3);
    board[whiteKingRank][whiteKingFile] = 'K';
    
    // Place black king (top half, at least 2 squares away)
    let blackKingFile: number, blackKingRank: number;
    do {
      blackKingFile = getRandomInt(0, 7);
      blackKingRank = getRandomInt(4, 7);
    } while (Math.abs(blackKingFile - whiteKingFile) < 2 && Math.abs(blackKingRank - whiteKingRank) < 2);
    board[blackKingRank][blackKingFile] = 'k';
    
    // Pick two additional pieces (excluding pawns for simplicity on edge ranks)
    const piece1 = getRandomElement([...MINOR_PIECES, ...MAJOR_PIECES]);
    const piece2 = getRandomElement([...MINOR_PIECES, ...MAJOR_PIECES]);
    
    // Check if both pieces are minor pieces (would be a draw if split)
    const bothMinor = MINOR_PIECES.includes(piece1) && MINOR_PIECES.includes(piece2);
    
    let piece1IsWhite: boolean;
    let piece2IsWhite: boolean;
    
    if (bothMinor) {
      // Both minor pieces must go to the same side to avoid draws
      const sameColor = Math.random() > 0.5;
      piece1IsWhite = sameColor;
      piece2IsWhite = sameColor;
    } else {
      // At least one major piece - safe to split
      piece1IsWhite = Math.random() > 0.5;
      piece2IsWhite = Math.random() > 0.5;
    }
    
    // Place piece 1
    let p1File: number, p1Rank: number;
    do {
      p1File = getRandomInt(0, 7);
      p1Rank = getRandomInt(0, 7);
    } while (
      (p1File === whiteKingFile && p1Rank === whiteKingRank) ||
      (p1File === blackKingFile && p1Rank === blackKingRank)
    );
    board[p1Rank][p1File] = piece1IsWhite ? piece1 : piece1.toLowerCase();
    
    // Place piece 2
    let p2File: number, p2Rank: number;
    do {
      p2File = getRandomInt(0, 7);
      p2Rank = getRandomInt(0, 7);
    } while (
      (p2File === whiteKingFile && p2Rank === whiteKingRank) ||
      (p2File === blackKingFile && p2Rank === blackKingRank) ||
      (p2File === p1File && p2Rank === p1Rank)
    );
    board[p2Rank][p2File] = piece2IsWhite ? piece2 : piece2.toLowerCase();
    
    // Convert board to FEN
    let fen = '';
    for (let rank = 7; rank >= 0; rank--) {
      let emptyCount = 0;
      for (let file = 0; file < 8; file++) {
        const p = board[rank][file];
        if (p) {
          if (emptyCount > 0) {
            fen += emptyCount;
            emptyCount = 0;
          }
          fen += p;
        } else {
          emptyCount++;
        }
      }
      if (emptyCount > 0) {
        fen += emptyCount;
      }
      if (rank > 0) fen += '/';
    }
    
    // Determine who moves - prefer the side with more/stronger material
    const whiteHasMajor = (piece1IsWhite && MAJOR_PIECES.includes(piece1)) || 
                          (piece2IsWhite && MAJOR_PIECES.includes(piece2));
    const blackHasMajor = (!piece1IsWhite && MAJOR_PIECES.includes(piece1)) || 
                          (!piece2IsWhite && MAJOR_PIECES.includes(piece2));
    
    let turn: string;
    if (whiteHasMajor && !blackHasMajor) {
      turn = 'w';
    } else if (blackHasMajor && !whiteHasMajor) {
      turn = 'b';
    } else {
      // Both have equal material, random turn
      turn = Math.random() > 0.5 ? 'w' : 'b';
    }
    
    fen += ` ${turn} - - 0 1`;
    
    if (isValidPosition(fen)) {
      return fen;
    }
  }
  
  // Fallback: K+R+N vs K position (always decisive)
  return '4k3/8/8/8/8/8/8/R3K1N1 w - - 0 1';
}

// Generate a 3-piece position with both kings + rook or queen (avoids draw positions)
function generateDecisive3PiecePosition(maxAttempts: number = 20): string {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const board: (string | null)[][] = Array(8).fill(null).map(() => Array(8).fill(null));
    
    // Place white king (bottom half of board)
    const whiteKingFile = getRandomInt(0, 7);
    const whiteKingRank = getRandomInt(0, 3);
    board[whiteKingRank][whiteKingFile] = 'K';
    
    // Place black king (top half of board, at least 2 squares away)
    let blackKingFile: number, blackKingRank: number;
    do {
      blackKingFile = getRandomInt(0, 7);
      blackKingRank = getRandomInt(4, 7);
    } while (Math.abs(blackKingFile - whiteKingFile) < 2 && Math.abs(blackKingRank - whiteKingRank) < 2);
    board[blackKingRank][blackKingFile] = 'k';
    
    // Place one rook or queen (either color)
    const piece = getRandomElement(DECISIVE_PIECES);
    const isWhite = Math.random() > 0.5;
    
    // Find a valid square for the piece (not on either king's square)
    let pieceFile: number, pieceRank: number;
    do {
      pieceFile = getRandomInt(0, 7);
      pieceRank = getRandomInt(0, 7);
    } while (
      (pieceFile === whiteKingFile && pieceRank === whiteKingRank) ||
      (pieceFile === blackKingFile && pieceRank === blackKingRank)
    );
    
    board[pieceRank][pieceFile] = isWhite ? piece : piece.toLowerCase();
    
    // Convert board to FEN
    let fen = '';
    for (let rank = 7; rank >= 0; rank--) {
      let emptyCount = 0;
      for (let file = 0; file < 8; file++) {
        const p = board[rank][file];
        if (p) {
          if (emptyCount > 0) {
            fen += emptyCount;
            emptyCount = 0;
          }
          fen += p;
        } else {
          emptyCount++;
        }
      }
      if (emptyCount > 0) {
        fen += emptyCount;
      }
      if (rank > 0) fen += '/';
    }
    
    // Side with the piece moves first (to avoid giving away the piece)
    const turn = isWhite ? 'w' : 'b';
    fen += ` ${turn} - - 0 1`;
    
    if (isValidPosition(fen)) {
      return fen;
    }
  }
  
  // Fallback: classic K+Q vs K position
  return '4k3/8/8/8/8/8/8/4K2Q w - - 0 1';
}

function getRandomRotation(config: DifficultyConfig): number {
  const possibleAngles: number[] = [];
  
  for (let angle = 0; angle < 360; angle += config.rotationInterval) {
    if (!config.excludedAngles.includes(angle)) {
      possibleAngles.push(angle);
    }
  }
  
  return getRandomElement(possibleAngles);
}

function countPieces(fen: string): number {
  const boardPart = fen.split(' ')[0];
  let count = 0;
  for (const char of boardPart) {
    if (/[pnbrqkPNBRQK]/.test(char)) {
      count++;
    }
  }
  return count;
}

function fenToBoard(fen: string): (string | null)[][] {
  const board: (string | null)[][] = Array(8).fill(null).map(() => Array(8).fill(null));
  const boardPart = fen.split(' ')[0];
  const ranks = boardPart.split('/');
  
  for (let rank = 0; rank < 8; rank++) {
    let file = 0;
    for (const char of ranks[7 - rank]) {
      if (/\d/.test(char)) {
        file += parseInt(char);
      } else {
        board[rank][file] = char;
        file++;
      }
    }
  }
  
  return board;
}

export interface GeneratedPosition {
  fen: string;
  board: (string | null)[][];
  difficulty: string;
  pieceCount: number;
  rotation: number;
  multiplier: number;
  pointsPerPiece: number;
  maxScore: number;
}

export function generatePositionClient(difficulty: string): GeneratedPosition {
  const config = DIFFICULTY_CONFIGS[difficulty];
  if (!config) {
    throw new Error(`Unknown difficulty: ${difficulty}`);
  }
  
  const targetPieces = getRandomInt(config.minPieces, config.maxPieces);
  
  // For beginner difficulty, use special decisive position generators to avoid draws
  // 3-piece: both kings + rook or queen
  // 4-piece: ensure minor pieces (B/N) aren't split between sides
  let fen: string;
  if (difficulty === 'beginner') {
    if (targetPieces === 3) {
      fen = generateDecisive3PiecePosition();
    } else if (targetPieces === 4) {
      fen = generateDecisive4PiecePosition();
    } else {
      fen = generateValidRandomPosition(targetPieces);
    }
  } else {
    fen = generateValidRandomPosition(targetPieces);
  }
  
  const board = fenToBoard(fen);
  const rotation = getRandomRotation(config);
  const pieceCount = countPieces(fen);
  const pointsPerPiece = 10;
  const maxScore = pieceCount * pointsPerPiece * config.multiplier;
  
  return {
    fen,
    board,
    difficulty,
    pieceCount,
    rotation,
    multiplier: config.multiplier,
    pointsPerPiece,
    maxScore
  };
}

export interface OptimalMove {
  move: string;
  evaluation: number;
  isMate: boolean;
  mateIn?: number;
}

export interface OptimalMovesResult {
  optimalMoves: OptimalMove[];
  bestMove: string;
  turn: string;
}

export async function getOptimalMovesClient(fen: string): Promise<OptimalMovesResult> {
  const fenParts = fen.split(' ');
  const turn = fenParts[1];
  
  try {
    await clientStockfish.init();
    
    // Get top 5 moves to find all equally-optimal ones
    const topMoves = await clientStockfish.getTopMoves(fen, 5, 2000000);
    
    if (topMoves.length === 0) {
      // Fallback to single best move
      const result = await clientStockfish.getBestMove(fen, { depth: 15 });
      return {
        optimalMoves: [{
          move: result.bestMove,
          evaluation: result.evaluation ?? 0,
          isMate: false
        }],
        bestMove: result.bestMove,
        turn
      };
    }
    
    const bestMove = topMoves[0];
    const optimalMoves: OptimalMove[] = [];
    
    // Find all moves that are equally optimal
    for (const move of topMoves) {
      const isEquallyOptimal = 
        // Both are mate in same number of moves
        (bestMove.isMate && move.isMate && bestMove.mateIn === move.mateIn) ||
        // Both are non-mate with same evaluation (within 0.1 pawn tolerance)
        (!bestMove.isMate && !move.isMate && Math.abs(bestMove.evaluation - move.evaluation) <= 0.1);
      
      if (isEquallyOptimal) {
        optimalMoves.push({
          move: move.move,
          evaluation: move.evaluation,
          isMate: move.isMate,
          mateIn: move.mateIn
        });
      }
    }
    
    console.log(`[BoardSpin] Found ${optimalMoves.length} equally optimal moves:`, 
      optimalMoves.map(m => `${m.move}${m.isMate ? ` (mate in ${m.mateIn})` : ` (${m.evaluation})`}`));
    
    return {
      optimalMoves,
      bestMove: bestMove.move,
      turn
    };
  } catch (error) {
    console.error('[BoardSpin Client] Stockfish error:', error);
    const chess = new Chess(fen);
    const moves = chess.moves({ verbose: true });
    if (moves.length > 0) {
      const move = moves[0];
      return {
        optimalMoves: [{ move: move.from + move.to, evaluation: 0, isMate: false }],
        bestMove: move.from + move.to,
        turn
      };
    }
    throw error;
  }
}

// Keep legacy function for backwards compatibility
export async function getBestMoveClient(fen: string): Promise<{ bestMove: string; turn: string }> {
  const result = await getOptimalMovesClient(fen);
  return { bestMove: result.bestMove, turn: result.turn };
}

export function calculateScoreClient(
  originalBoard: (string | null)[][],
  playerBoard: (string | null)[][],
  rotation: number,
  multiplier: number,
  gotBestMove: boolean
): { score: number; accuracy: number; correctPieces: number; totalPieces: number } {
  let correctPieces = 0;
  let totalPieces = 0;
  
  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const originalPiece = originalBoard[rank][file];
      const playerPiece = playerBoard[rank][file];
      
      if (originalPiece) {
        totalPieces++;
        if (originalPiece === playerPiece) {
          correctPieces++;
        }
      }
    }
  }
  
  const accuracy = totalPieces > 0 ? (correctPieces / totalPieces) * 100 : 0;
  let score = correctPieces * 10 * multiplier;
  
  if (gotBestMove && accuracy === 100) {
    score *= 2;
  }
  
  return {
    score: Math.round(score),
    accuracy: Math.round(accuracy * 10) / 10,
    correctPieces,
    totalPieces
  };
}

export function getAllDifficulties(): string[] {
  return Object.keys(DIFFICULTY_CONFIGS);
}
