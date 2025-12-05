import { Chess } from 'chess.js';

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
    maxPieces: 5,
    rotationInterval: 120,
    excludedAngles: [0],
    multiplier: 1.0
  },
  'easy': {
    minPieces: 6,
    maxPieces: 10,
    rotationInterval: 90,
    excludedAngles: [0],
    multiplier: 1.5
  },
  'intermediate': {
    minPieces: 11,
    maxPieces: 17,
    rotationInterval: 60,
    excludedAngles: [0],
    multiplier: 2.0
  },
  'advanced': {
    minPieces: 18,
    maxPieces: 24,
    rotationInterval: 45,
    excludedAngles: [0],
    multiplier: 2.5
  },
  'expert': {
    minPieces: 25,
    maxPieces: 31,
    rotationInterval: 30,
    excludedAngles: [0, 30, 330],
    multiplier: 3.0
  },
  'master': {
    minPieces: 32,
    maxPieces: 32,
    rotationInterval: 15,
    excludedAngles: [0, 15, 30, 330, 345],
    multiplier: 4.0
  }
};

const PIECES = ['P', 'N', 'B', 'R', 'Q'];
const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['1', '2', '3', '4', '5', '6', '7', '8'];

function getRandomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateRandomPosition(targetPieces: number): string {
  const board: (string | null)[][] = Array(8).fill(null).map(() => Array(8).fill(null));
  let piecesPlaced = 0;
  
  // Always place both kings first
  const whiteKingFile = getRandomInt(0, 7);
  const whiteKingRank = getRandomInt(0, 2); // White king on ranks 1-3
  board[whiteKingRank][whiteKingFile] = 'K';
  piecesPlaced++;
  
  // Black king must be at least 2 squares away
  let blackKingFile: number, blackKingRank: number;
  do {
    blackKingFile = getRandomInt(0, 7);
    blackKingRank = getRandomInt(5, 7); // Black king on ranks 6-8
  } while (Math.abs(blackKingFile - whiteKingFile) < 2 && Math.abs(blackKingRank - whiteKingRank) < 2);
  
  board[blackKingRank][blackKingFile] = 'k';
  piecesPlaced++;
  
  // Place remaining pieces randomly
  while (piecesPlaced < targetPieces) {
    const file = getRandomInt(0, 7);
    const rank = getRandomInt(0, 7);
    
    if (board[rank][file] !== null) continue;
    
    // Don't place pawns on ranks 1 or 8
    const isEdgeRank = rank === 0 || rank === 7;
    const availablePieces = isEdgeRank ? PIECES.filter(p => p !== 'P') : PIECES;
    
    const piece = getRandomElement(availablePieces);
    const isWhite = Math.random() > 0.5;
    
    board[rank][file] = isWhite ? piece : piece.toLowerCase();
    piecesPlaced++;
  }
  
  // Convert board to FEN
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
  
  // Add game state (white to move, no castling, no en passant)
  fen += ' w - - 0 1';
  
  return fen;
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

function rotateBoard(board: (string | null)[][], degrees: number): (string | null)[][] {
  const rotations = (degrees / 90) % 4;
  let result = board.map(row => [...row]);
  
  for (let r = 0; r < rotations; r++) {
    const newBoard: (string | null)[][] = Array(8).fill(null).map(() => Array(8).fill(null));
    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        newBoard[file][7 - rank] = result[rank][file];
      }
    }
    result = newBoard;
  }
  
  return result;
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

export function generatePosition(difficulty: string): GeneratedPosition {
  const config = DIFFICULTY_CONFIGS[difficulty];
  if (!config) {
    throw new Error(`Unknown difficulty: ${difficulty}`);
  }
  
  const targetPieces = getRandomInt(config.minPieces, config.maxPieces);
  const fen = generateRandomPosition(targetPieces);
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

export function getDifficultyConfig(difficulty: string): DifficultyConfig | undefined {
  return DIFFICULTY_CONFIGS[difficulty];
}

export function getAllDifficulties(): string[] {
  return Object.keys(DIFFICULTY_CONFIGS);
}

export function calculateScore(
  originalBoard: (string | null)[][],
  playerBoard: (string | null)[][],
  rotation: number,
  multiplier: number,
  gotBestMove: boolean
): { score: number; accuracy: number; correctPieces: number; totalPieces: number } {
  // Rotate the original board to match the player's perspective
  const nearestRotation = Math.round(rotation / 90) * 90;
  const rotatedOriginal = rotateBoard(originalBoard, nearestRotation);
  
  let correctPieces = 0;
  let totalPieces = 0;
  
  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const originalPiece = rotatedOriginal[rank][file];
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
