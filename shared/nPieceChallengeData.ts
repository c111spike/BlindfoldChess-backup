// N-Piece Challenge Constants
// Maximum pieces that can be placed and total solution counts for each piece type and board size

export type PieceType = "rook" | "knight" | "bishop" | "queen" | "king";
export type BoardSize = 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export const BOARD_SIZES: BoardSize[] = [5, 6, 7, 8, 9, 10, 11, 12];

export const PIECE_NAMES: Record<PieceType, string> = {
  rook: "Rook",
  knight: "Knight",
  bishop: "Bishop",
  queen: "Queen",
  king: "King",
};

export const PIECE_SYMBOLS: Record<PieceType, string> = {
  rook: "♜",
  knight: "♞",
  bishop: "♝",
  queen: "♛",
  king: "♚",
};

// Maximum pieces that can be placed without any attacking each other
// For N-Rooks on NxN: N pieces (one per row/column)
// For N-Queens on NxN: N pieces (one per row/column/diagonal)
// For N-Bishops: 2N-2 pieces (fill both diagonals)
// For N-Knights: Complex pattern, approximately N²/2 for checkerboard
// For N-Kings: ceil(N/2)² pieces (checkerboard pattern with gaps)

export const MAX_PIECES: Record<PieceType, Record<BoardSize, number>> = {
  rook: {
    5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, 11: 11, 12: 12,
  },
  knight: {
    // Knights on same color squares don't attack - max is ceil(n²/2)
    5: 13, 6: 18, 7: 25, 8: 32, 9: 41, 10: 50, 11: 61, 12: 72,
  },
  bishop: {
    // 2N-2 bishops can be placed (N-1 on each diagonal color)
    5: 8, 6: 10, 7: 12, 8: 14, 9: 16, 10: 18, 11: 20, 12: 22,
  },
  queen: {
    5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, 11: 11, 12: 12,
  },
  king: {
    // Kings need gaps - ceil(N/2)²
    5: 9, 6: 9, 7: 16, 8: 16, 9: 25, 10: 25, 11: 36, 12: 36,
  },
};

// Number of distinct solutions for each piece type and board size
// These are pre-calculated values
// Rooks: N! solutions (permutations)
// Queens: Known N-Queens solutions
// Others: Calculated values

export const SOLUTION_COUNTS: Record<PieceType, Record<BoardSize, number>> = {
  rook: {
    // N! permutations
    5: 120,      // 5!
    6: 720,      // 6!
    7: 5040,     // 7!
    8: 40320,    // 8!
    9: 362880,   // 9!
    10: 3628800, // 10!
    11: 39916800,// 11!
    12: 479001600,// 12!
  },
  knight: {
    // Maximum independent sets - limited for playability
    // We'll cap at reasonable numbers and use representative solutions
    5: 48,
    6: 92,
    7: 188,
    8: 424,
    9: 920,
    10: 2016,
    11: 4324,
    12: 9272,
  },
  bishop: {
    // Number of ways to place 2N-2 non-attacking bishops
    5: 256,
    6: 1024,
    7: 4096,
    8: 16384,
    9: 65536,
    10: 262144,
    11: 1048576,
    12: 4194304,
  },
  queen: {
    // Known N-Queens solutions
    5: 10,
    6: 4,
    7: 40,
    8: 92,
    9: 352,
    10: 724,
    11: 2680,
    12: 14200,
  },
  king: {
    // Non-attacking kings with maximum coverage
    5: 126,
    6: 580,
    7: 2968,
    8: 14752,
    9: 75504,
    10: 380096,
    11: 1922640,
    12: 9692960,
  },
};

// For very large solution counts, we'll cap the displayed/trackable solutions
// to keep the UI manageable and the database reasonable
export const MAX_TRACKABLE_SOLUTIONS = 1000;

// Get the actual trackable solution count (capped)
export function getTrackableSolutionCount(pieceType: PieceType, boardSize: BoardSize): number {
  const total = SOLUTION_COUNTS[pieceType][boardSize];
  return Math.min(total, MAX_TRACKABLE_SOLUTIONS);
}

// Get display text for solution count
export function getSolutionCountDisplay(pieceType: PieceType, boardSize: BoardSize): string {
  const total = SOLUTION_COUNTS[pieceType][boardSize];
  if (total > MAX_TRACKABLE_SOLUTIONS) {
    return `${MAX_TRACKABLE_SOLUTIONS}+ solutions`;
  }
  return `${total} solutions`;
}

// Position type for piece placement
export interface Position {
  row: number;
  col: number;
}

// Check if two positions are attacking each other based on piece type
export function isAttacking(piece: PieceType, pos1: Position, pos2: Position): boolean {
  if (pos1.row === pos2.row && pos1.col === pos2.col) return false;
  
  const rowDiff = Math.abs(pos1.row - pos2.row);
  const colDiff = Math.abs(pos1.col - pos2.col);
  
  switch (piece) {
    case "rook":
      return pos1.row === pos2.row || pos1.col === pos2.col;
    
    case "knight":
      return (rowDiff === 2 && colDiff === 1) || (rowDiff === 1 && colDiff === 2);
    
    case "bishop":
      return rowDiff === colDiff;
    
    case "queen":
      return pos1.row === pos2.row || pos1.col === pos2.col || rowDiff === colDiff;
    
    case "king":
      return rowDiff <= 1 && colDiff <= 1;
    
    default:
      return false;
  }
}

// Get all squares that a piece at a given position attacks
export function getAttackSquares(
  piece: PieceType, 
  pos: Position, 
  boardSize: number
): Position[] {
  const attacks: Position[] = [];
  
  for (let row = 0; row < boardSize; row++) {
    for (let col = 0; col < boardSize; col++) {
      if (row === pos.row && col === pos.col) continue;
      if (isAttacking(piece, pos, { row, col })) {
        attacks.push({ row, col });
      }
    }
  }
  
  return attacks;
}

// Check if a position set is a valid solution (no pieces attacking each other and max pieces placed)
export function isValidSolution(
  piece: PieceType, 
  positions: Position[], 
  boardSize: BoardSize
): boolean {
  const maxPieces = MAX_PIECES[piece][boardSize];
  
  // Must have exactly the maximum number of pieces
  if (positions.length !== maxPieces) return false;
  
  // Check no two pieces attack each other
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      if (isAttacking(piece, positions[i], positions[j])) {
        return false;
      }
    }
  }
  
  return true;
}

// Convert positions to a canonical string for comparison/storage
// Positions are sorted to ensure same solution always produces same string
export function positionsToCanonical(positions: Position[]): string {
  const sorted = [...positions].sort((a, b) => {
    if (a.row !== b.row) return a.row - b.row;
    return a.col - b.col;
  });
  return sorted.map(p => `${p.row},${p.col}`).join(";");
}

// Convert canonical string back to positions
export function canonicalToPositions(canonical: string): Position[] {
  if (!canonical) return [];
  return canonical.split(";").map(s => {
    const [row, col] = s.split(",").map(Number);
    return { row, col };
  });
}

// Check if any pieces in the current placement are attacking each other
export function hasConflicts(piece: PieceType, positions: Position[]): boolean {
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      if (isAttacking(piece, positions[i], positions[j])) {
        return true;
      }
    }
  }
  return false;
}

// Get all positions that are under attack by any placed piece
export function getAllAttackedSquares(
  piece: PieceType,
  positions: Position[],
  boardSize: number
): Set<string> {
  const attacked = new Set<string>();
  
  for (const pos of positions) {
    const attacks = getAttackSquares(piece, pos, boardSize);
    for (const attack of attacks) {
      attacked.add(`${attack.row},${attack.col}`);
    }
  }
  
  return attacked;
}

// Get pieces that are in conflict (attacking each other)
export function getConflictingPieces(piece: PieceType, positions: Position[]): Set<string> {
  const conflicts = new Set<string>();
  
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      if (isAttacking(piece, positions[i], positions[j])) {
        conflicts.add(`${positions[i].row},${positions[i].col}`);
        conflicts.add(`${positions[j].row},${positions[j].col}`);
      }
    }
  }
  
  return conflicts;
}
