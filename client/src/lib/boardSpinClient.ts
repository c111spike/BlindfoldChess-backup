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
    minPieces: 2,
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
  const fen = generateValidRandomPosition(targetPieces);
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

export async function getBestMoveClient(fen: string): Promise<{ bestMove: string; turn: string }> {
  const fenParts = fen.split(' ');
  const turn = fenParts[1];
  
  try {
    await clientStockfish.init();
    
    const result = await clientStockfish.getBestMove(fen, { depth: 15 });
    let finalBestMove = result.bestMove;
    const evaluation = result.evaluation ?? 0;
    
    if (Math.abs(evaluation) <= 0.5) {
      try {
        const chess = new Chess(fen);
        const moves = chess.moves({ verbose: true });
        
        const captures = moves.filter(m => m.captured);
        if (captures.length > 0) {
          const pieceValues: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
          captures.sort((a, b) => pieceValues[b.captured!] - pieceValues[a.captured!]);
          finalBestMove = captures[0].from + captures[0].to;
        }
      } catch (e) {
        console.warn('[BoardSpin Client] Could not analyze captures:', e);
      }
    }
    
    return { bestMove: finalBestMove, turn };
  } catch (error) {
    console.error('[BoardSpin Client] Stockfish error:', error);
    const chess = new Chess(fen);
    const moves = chess.moves({ verbose: true });
    if (moves.length > 0) {
      const move = moves[0];
      return { bestMove: move.from + move.to, turn };
    }
    throw error;
  }
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
