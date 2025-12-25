import { Chess, Square, Piece } from 'chess.js';

export type TacticalMotif =
  | 'knight_fork'
  | 'bishop_fork'
  | 'queen_fork'
  | 'rook_fork'
  | 'pawn_fork'
  | 'king_fork'
  | 'absolute_pin'
  | 'relative_pin'
  | 'skewer'
  | 'discovered_attack'
  | 'discovered_check'
  | 'double_check'
  | 'back_rank_mate'
  | 'smothered_mate'
  | 'arabian_mate'
  | 'anastasia_mate'
  | 'mate_in_1'
  | 'mate_in_2'
  | 'mate_in_3'
  | 'mate_in_4_plus'
  | 'queen_sacrifice'
  | 'rook_sacrifice'
  | 'minor_piece_sacrifice'
  | 'deflection'
  | 'decoy'
  | 'overloaded_defender'
  | 'trapped_piece'
  | 'removing_defender'
  | 'zwischenzug'
  | 'promotion'
  | 'underpromotion'
  | 'en_passant'
  | 'material_win'
  | 'checkmate'
  | 'stalemate_trick';

export interface MotifDetectionResult {
  motifs: TacticalMotif[];
  phase: 'opening' | 'middlegame' | 'endgame';
  materialSwing: number;
  description: string[];
}

const PIECE_VALUES: Record<string, number> = {
  'p': 1,
  'n': 3,
  'b': 3,
  'r': 5,
  'q': 9,
  'k': 100,
};

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['1', '2', '3', '4', '5', '6', '7', '8'];

function squareToCoords(sq: Square): { file: number; rank: number } {
  return {
    file: FILES.indexOf(sq[0]),
    rank: parseInt(sq[1]) - 1,
  };
}

function coordsToSquare(file: number, rank: number): Square | null {
  if (file < 0 || file > 7 || rank < 0 || rank > 7) return null;
  return (FILES[file] + RANKS[rank]) as Square;
}

function getPieceValue(piece: Piece | null): number {
  if (!piece) return 0;
  return PIECE_VALUES[piece.type] || 0;
}

function getAllPieces(chess: Chess): Map<Square, Piece> {
  const pieces = new Map<Square, Piece>();
  for (const file of FILES) {
    for (const rank of RANKS) {
      const sq = (file + rank) as Square;
      const piece = chess.get(sq);
      if (piece) {
        pieces.set(sq, piece);
      }
    }
  }
  return pieces;
}

function getAttackers(chess: Chess, targetSquare: Square, color: 'w' | 'b'): Square[] {
  const attackers: Square[] = [];
  const pieces = getAllPieces(chess);
  
  for (const [sq, piece] of Array.from(pieces.entries())) {
    if (piece.color !== color) continue;
    
    const tempChess = new Chess(chess.fen());
    const moves = tempChess.moves({ square: sq, verbose: true });
    
    for (const move of moves) {
      if (move.to === targetSquare) {
        attackers.push(sq);
        break;
      }
    }
  }
  
  return attackers;
}

function getDefenders(chess: Chess, targetSquare: Square, color: 'w' | 'b'): Square[] {
  const tempChess = new Chess(chess.fen());
  const targetPiece = tempChess.get(targetSquare);
  
  if (!targetPiece || targetPiece.color !== color) return [];
  
  tempChess.remove(targetSquare);
  const oppositeColor = color === 'w' ? 'b' : 'w';
  
  try {
    tempChess.put({ type: 'p', color: oppositeColor }, targetSquare);
  } catch {
    return [];
  }
  
  const defenders: Square[] = [];
  const pieces = getAllPieces(tempChess);
  
  for (const [sq, piece] of Array.from(pieces.entries())) {
    if (piece.color !== color) continue;
    
    const moves = tempChess.moves({ square: sq, verbose: true });
    for (const move of moves) {
      if (move.to === targetSquare) {
        defenders.push(sq);
        break;
      }
    }
  }
  
  return defenders;
}

function detectFork(chess: Chess, move: { from: Square; to: Square; piece: string }): TacticalMotif | null {
  const tempChess = new Chess(chess.fen());
  
  try {
    tempChess.move({ from: move.from, to: move.to });
  } catch {
    return null;
  }
  
  const attackerColor = tempChess.get(move.to)?.color;
  if (!attackerColor) return null;
  
  const targetColor = attackerColor === 'w' ? 'b' : 'w';
  const attackedPieces = tempChess.moves({ square: move.to, verbose: true });
  
  const valuableTargets: { square: Square; value: number }[] = [];
  
  for (const attackMove of attackedPieces) {
    if (attackMove.captured) {
      const targetPiece = chess.get(attackMove.to);
      if (targetPiece && targetPiece.color === targetColor) {
        const value = getPieceValue(targetPiece);
        if (value >= 3) {
          valuableTargets.push({ square: attackMove.to, value });
        }
      }
    }
  }
  
  if (valuableTargets.length >= 2) {
    const pieceType = move.piece.toLowerCase();
    switch (pieceType) {
      case 'n': return 'knight_fork';
      case 'b': return 'bishop_fork';
      case 'q': return 'queen_fork';
      case 'r': return 'rook_fork';
      case 'p': return 'pawn_fork';
      case 'k': return 'king_fork';
    }
  }
  
  return null;
}

function detectPin(chess: Chess, targetSquare: Square): 'absolute_pin' | 'relative_pin' | null {
  const targetPiece = chess.get(targetSquare);
  if (!targetPiece) return null;
  
  const color = targetPiece.color;
  const { file, rank } = squareToCoords(targetSquare);
  
  const directions = [
    { df: 0, dr: 1 },  // up
    { df: 0, dr: -1 }, // down
    { df: 1, dr: 0 },  // right
    { df: -1, dr: 0 }, // left
    { df: 1, dr: 1 },  // up-right
    { df: 1, dr: -1 }, // down-right
    { df: -1, dr: 1 }, // up-left
    { df: -1, dr: -1 },// down-left
  ];
  
  for (const dir of directions) {
    const isDiagonal = dir.df !== 0 && dir.dr !== 0;
    let behindPiece: { piece: Piece; square: Square } | null = null;
    let attackerPiece: { piece: Piece; square: Square } | null = null;
    
    for (let i = 1; i <= 7; i++) {
      const sq = coordsToSquare(file + dir.df * i, rank + dir.dr * i);
      if (!sq) break;
      
      const piece = chess.get(sq);
      if (piece) {
        if (piece.color === color) {
          behindPiece = { piece, square: sq };
        } else {
          const canAttack = isDiagonal
            ? (piece.type === 'b' || piece.type === 'q')
            : (piece.type === 'r' || piece.type === 'q');
          if (canAttack) {
            attackerPiece = { piece, square: sq };
          }
        }
        break;
      }
    }
    
    for (let i = 1; i <= 7; i++) {
      const sq = coordsToSquare(file - dir.df * i, rank - dir.dr * i);
      if (!sq) break;
      
      const piece = chess.get(sq);
      if (piece) {
        if (!behindPiece && piece.color === color) {
          behindPiece = { piece, square: sq };
        } else if (!attackerPiece && piece.color !== color) {
          const canAttack = isDiagonal
            ? (piece.type === 'b' || piece.type === 'q')
            : (piece.type === 'r' || piece.type === 'q');
          if (canAttack) {
            attackerPiece = { piece, square: sq };
          }
        }
        break;
      }
    }
    
    if (behindPiece && attackerPiece) {
      if (behindPiece.piece.type === 'k') {
        return 'absolute_pin';
      }
      if (getPieceValue(behindPiece.piece) > getPieceValue(targetPiece)) {
        return 'relative_pin';
      }
    }
  }
  
  return null;
}

function detectDiscoveredAttack(
  chessBefore: Chess, 
  chessAfter: Chess, 
  move: { from: Square; to: Square }
): 'discovered_attack' | 'discovered_check' | 'double_check' | null {
  const movingPieceColor = chessBefore.get(move.from)?.color;
  if (!movingPieceColor) return null;
  
  const targetColor = movingPieceColor === 'w' ? 'b' : 'w';
  
  const targetKingSquare = findKing(chessAfter, targetColor);
  if (!targetKingSquare) return null;
  
  const directAttackers = getAttackers(chessAfter, targetKingSquare, movingPieceColor);
  const movingPieceAttacksKing = directAttackers.includes(move.to);
  const discoveredAttackers = directAttackers.filter(sq => sq !== move.to);
  
  if (movingPieceAttacksKing && discoveredAttackers.length > 0) {
    return 'double_check';
  }
  
  if (discoveredAttackers.length > 0) {
    if (chessAfter.inCheck()) {
      return 'discovered_check';
    }
    return 'discovered_attack';
  }
  
  return null;
}

function findKing(chess: Chess, color: 'w' | 'b'): Square | null {
  const pieces = getAllPieces(chess);
  for (const [sq, piece] of Array.from(pieces.entries())) {
    if (piece.type === 'k' && piece.color === color) {
      return sq;
    }
  }
  return null;
}

function detectMatePattern(chess: Chess): TacticalMotif | null {
  if (!chess.isCheckmate()) return null;
  
  const losingColor = chess.turn();
  const kingSquare = findKing(chess, losingColor);
  if (!kingSquare) return null;
  
  const { rank } = squareToCoords(kingSquare);
  
  if ((losingColor === 'w' && rank === 0) || (losingColor === 'b' && rank === 7)) {
    return 'back_rank_mate';
  }
  
  const winningColor = losingColor === 'w' ? 'b' : 'w';
  const pieces = getAllPieces(chess);
  let knightDeliveredMate = false;
  
  for (const [sq, piece] of Array.from(pieces.entries())) {
    if (piece.color === winningColor && piece.type === 'n') {
      const moves = new Chess(chess.fen());
      moves.load(chess.fen().replace(losingColor === 'w' ? ' w ' : ' b ', losingColor === 'w' ? ' b ' : ' w '));
      const knightMoves = moves.moves({ square: sq, verbose: true });
      for (const move of knightMoves) {
        if (move.to === kingSquare) {
          knightDeliveredMate = true;
          break;
        }
      }
    }
  }
  
  if (knightDeliveredMate) {
    const { file: kf, rank: kr } = squareToCoords(kingSquare);
    const cornerOrEdge = 
      (kf === 0 || kf === 7) && (kr === 0 || kr === 7);
    
    if (cornerOrEdge) {
      let blockedByOwn = 0;
      const escapeSquares = [
        coordsToSquare(kf-1, kr), coordsToSquare(kf+1, kr),
        coordsToSquare(kf, kr-1), coordsToSquare(kf, kr+1),
        coordsToSquare(kf-1, kr-1), coordsToSquare(kf+1, kr-1),
        coordsToSquare(kf-1, kr+1), coordsToSquare(kf+1, kr+1),
      ].filter(Boolean) as Square[];
      
      for (const sq of escapeSquares) {
        const piece = chess.get(sq);
        if (piece && piece.color === losingColor) {
          blockedByOwn++;
        }
      }
      
      if (blockedByOwn >= 3) {
        return 'smothered_mate';
      }
    }
  }
  
  return 'checkmate';
}

function detectSacrifice(
  chessBefore: Chess,
  move: { from: Square; to: Square; piece: string; captured?: string },
  evalBefore: number,
  evalAfter: number
): TacticalMotif | null {
  const movingPiece = chessBefore.get(move.from);
  if (!movingPiece) return null;
  
  const capturedValue = move.captured ? PIECE_VALUES[move.captured.toLowerCase()] || 0 : 0;
  const movingValue = PIECE_VALUES[move.piece.toLowerCase()] || 0;
  
  const materialGiven = movingValue - capturedValue;
  
  if (materialGiven < 2) return null;
  
  const playerPerspective = movingPiece.color === 'w' ? 1 : -1;
  const evalImprovement = (evalAfter - evalBefore) * playerPerspective;
  
  if (evalImprovement > -1.0) {
    switch (move.piece.toLowerCase()) {
      case 'q': return 'queen_sacrifice';
      case 'r': return 'rook_sacrifice';
      case 'n':
      case 'b': return 'minor_piece_sacrifice';
    }
  }
  
  return null;
}

function detectMateIn(mateIn: number | undefined): TacticalMotif | null {
  if (!mateIn) return null;
  
  const absMateMoves = Math.abs(mateIn);
  if (absMateMoves === 1) return 'mate_in_1';
  if (absMateMoves === 2) return 'mate_in_2';
  if (absMateMoves === 3) return 'mate_in_3';
  if (absMateMoves >= 4) return 'mate_in_4_plus';
  
  return null;
}

function detectPromotion(move: { promotion?: string }): TacticalMotif | null {
  if (!move.promotion) return null;
  
  if (move.promotion.toLowerCase() !== 'q') {
    return 'underpromotion';
  }
  return 'promotion';
}

function calculateMaterialBalance(chess: Chess): { white: number; black: number } {
  const pieces = getAllPieces(chess);
  let white = 0;
  let black = 0;
  
  for (const [_, piece] of Array.from(pieces.entries())) {
    const value = PIECE_VALUES[piece.type] || 0;
    if (piece.color === 'w') {
      white += value;
    } else {
      black += value;
    }
  }
  
  return { white, black };
}

function determinePhase(chess: Chess): 'opening' | 'middlegame' | 'endgame' {
  const history = chess.history();
  if (history.length <= 20) return 'opening';
  
  const { white, black } = calculateMaterialBalance(chess);
  const totalMaterial = white + black;
  
  if (totalMaterial <= 26) return 'endgame';
  return 'middlegame';
}

export interface AnalysisContext {
  fenBefore: string;
  fenAfter: string;
  move: {
    from: Square;
    to: Square;
    piece: string;
    captured?: string;
    promotion?: string;
    san: string;
  };
  evalBefore: number;
  evalAfter: number;
  mateIn?: number;
  isCheck: boolean;
  isCheckmate: boolean;
}

export function detectMotifs(context: AnalysisContext): MotifDetectionResult {
  const motifs: TacticalMotif[] = [];
  const descriptions: string[] = [];
  
  const chessBefore = new Chess(context.fenBefore);
  const chessAfter = new Chess(context.fenAfter);
  
  const fork = detectFork(chessBefore, context.move);
  if (fork) {
    motifs.push(fork);
    descriptions.push(`${fork.replace('_', ' ')} attacking multiple pieces`);
  }
  
  const discovered = detectDiscoveredAttack(chessBefore, chessAfter, context.move);
  if (discovered) {
    motifs.push(discovered);
    descriptions.push(`${discovered.replace(/_/g, ' ')}`);
  }
  
  const mateMotif = detectMateIn(context.mateIn);
  if (mateMotif) {
    motifs.push(mateMotif);
    descriptions.push(`Forces ${mateMotif.replace(/_/g, ' ')}`);
  }
  
  if (context.isCheckmate) {
    const matePattern = detectMatePattern(chessAfter);
    if (matePattern) {
      motifs.push(matePattern);
      descriptions.push(`${matePattern.replace(/_/g, ' ')}`);
    }
  }
  
  const sacrifice = detectSacrifice(chessBefore, context.move, context.evalBefore, context.evalAfter);
  if (sacrifice) {
    motifs.push(sacrifice);
    descriptions.push(`Sound ${sacrifice.replace(/_/g, ' ')}`);
  }
  
  const promotion = detectPromotion(context.move);
  if (promotion) {
    motifs.push(promotion);
    descriptions.push(`Pawn ${promotion}`);
  }
  
  if (context.move.san.includes('e.p.')) {
    motifs.push('en_passant');
    descriptions.push('En passant capture');
  }
  
  const { white: whiteBefore, black: blackBefore } = calculateMaterialBalance(chessBefore);
  const { white: whiteAfter, black: blackAfter } = calculateMaterialBalance(chessAfter);
  
  const movingColor = chessBefore.get(context.move.from)?.color;
  let materialSwing = 0;
  
  if (movingColor === 'w') {
    materialSwing = (whiteAfter - blackAfter) - (whiteBefore - blackBefore);
  } else {
    materialSwing = (blackAfter - whiteAfter) - (blackBefore - whiteBefore);
  }
  
  if (materialSwing >= 3) {
    motifs.push('material_win');
    descriptions.push(`Wins ${materialSwing} points of material`);
  }
  
  const phase = determinePhase(chessAfter);
  
  return {
    motifs,
    phase,
    materialSwing,
    description: descriptions,
  };
}

export function detectPuzzleMotifs(
  fen: string,
  solution: string[],
  evalAfterSolution?: number
): TacticalMotif[] {
  if (!solution || solution.length === 0) return [];
  
  const motifs: TacticalMotif[] = [];
  const chess = new Chess(fen);
  
  for (let i = 0; i < solution.length; i++) {
    const moveSan = solution[i];
    const fenBefore = chess.fen();
    
    let moveResult;
    try {
      moveResult = chess.move(moveSan);
    } catch {
      continue;
    }
    
    if (!moveResult) continue;
    
    const fenAfter = chess.fen();
    const isCheck = chess.inCheck();
    const isCheckmate = chess.isCheckmate();
    
    const context: AnalysisContext = {
      fenBefore,
      fenAfter,
      move: {
        from: moveResult.from,
        to: moveResult.to,
        piece: moveResult.piece,
        captured: moveResult.captured,
        promotion: moveResult.promotion,
        san: moveResult.san,
      },
      evalBefore: 0,
      evalAfter: evalAfterSolution || 0,
      isCheck,
      isCheckmate,
    };
    
    const result = detectMotifs(context);
    for (const motif of result.motifs) {
      if (!motifs.includes(motif)) {
        motifs.push(motif);
      }
    }
  }
  
  if (solution.length === 2 && !motifs.includes('mate_in_1')) {
    motifs.push('mate_in_1');
  } else if (solution.length === 4 && !motifs.includes('mate_in_2')) {
    motifs.push('mate_in_2');
  } else if (solution.length === 6 && !motifs.includes('mate_in_3')) {
    motifs.push('mate_in_3');
  } else if (solution.length >= 8 && !motifs.includes('mate_in_4_plus')) {
    motifs.push('mate_in_4_plus');
  }
  
  return motifs;
}

export function getMotifDisplayName(motif: TacticalMotif): string {
  const names: Record<TacticalMotif, string> = {
    knight_fork: 'Knight Fork',
    bishop_fork: 'Bishop Fork',
    queen_fork: 'Queen Fork',
    rook_fork: 'Rook Fork',
    pawn_fork: 'Pawn Fork',
    king_fork: 'King Fork',
    absolute_pin: 'Absolute Pin',
    relative_pin: 'Relative Pin',
    skewer: 'Skewer',
    discovered_attack: 'Discovered Attack',
    discovered_check: 'Discovered Check',
    double_check: 'Double Check',
    back_rank_mate: 'Back Rank Mate',
    smothered_mate: 'Smothered Mate',
    arabian_mate: 'Arabian Mate',
    anastasia_mate: 'Anastasia Mate',
    mate_in_1: 'Mate in 1',
    mate_in_2: 'Mate in 2',
    mate_in_3: 'Mate in 3',
    mate_in_4_plus: 'Mate in 4+',
    queen_sacrifice: 'Queen Sacrifice',
    rook_sacrifice: 'Rook Sacrifice',
    minor_piece_sacrifice: 'Minor Piece Sacrifice',
    deflection: 'Deflection',
    decoy: 'Decoy',
    overloaded_defender: 'Overloaded Defender',
    trapped_piece: 'Trapped Piece',
    removing_defender: 'Removing the Defender',
    zwischenzug: 'Zwischenzug',
    promotion: 'Pawn Promotion',
    underpromotion: 'Underpromotion',
    en_passant: 'En Passant',
    material_win: 'Material Win',
    checkmate: 'Checkmate',
    stalemate_trick: 'Stalemate Trick',
  };
  
  return names[motif] || motif.replace(/_/g, ' ');
}
