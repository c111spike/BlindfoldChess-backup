import { db } from '../server/db';
import { puzzles } from '../shared/schema';
import { eq } from 'drizzle-orm';
import { Chess, Square } from 'chess.js';

type TacticalMotif =
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

const PIECE_VALUES: Record<string, number> = {
  'p': 1, 'n': 3, 'b': 3, 'r': 5, 'q': 9, 'k': 100,
};

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['1', '2', '3', '4', '5', '6', '7', '8'];

function squareToCoords(sq: Square): { file: number; rank: number } {
  return { file: FILES.indexOf(sq[0]), rank: parseInt(sq[1]) - 1 };
}

function coordsToSquare(file: number, rank: number): Square | null {
  if (file < 0 || file > 7 || rank < 0 || rank > 7) return null;
  return (FILES[file] + RANKS[rank]) as Square;
}

function getPieceValue(piece: { type: string } | null): number {
  if (!piece) return 0;
  return PIECE_VALUES[piece.type] || 0;
}

function getAllPieces(chess: Chess): Map<Square, { type: string; color: 'w' | 'b' }> {
  const pieces = new Map<Square, { type: string; color: 'w' | 'b' }>();
  for (const file of FILES) {
    for (const rank of RANKS) {
      const sq = (file + rank) as Square;
      const piece = chess.get(sq);
      if (piece) pieces.set(sq, piece);
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

function findKing(chess: Chess, color: 'w' | 'b'): Square | null {
  const pieces = getAllPieces(chess);
  for (const [sq, piece] of Array.from(pieces.entries())) {
    if (piece.type === 'k' && piece.color === color) return sq;
  }
  return null;
}

function detectFork(chess: Chess, move: { from: Square; to: Square; piece: string }): TacticalMotif | null {
  const tempChess = new Chess(chess.fen());
  try { tempChess.move({ from: move.from, to: move.to }); } catch { return null; }
  
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
        if (value >= 3) valuableTargets.push({ square: attackMove.to, value });
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

function detectDiscoveredAttack(
  chessBefore: Chess, chessAfter: Chess, move: { from: Square; to: Square }
): TacticalMotif | null {
  const movingPieceColor = chessBefore.get(move.from)?.color;
  if (!movingPieceColor) return null;
  
  const targetColor = movingPieceColor === 'w' ? 'b' : 'w';
  const targetKingSquare = findKing(chessAfter, targetColor);
  if (!targetKingSquare) return null;
  
  const directAttackers = getAttackers(chessAfter, targetKingSquare, movingPieceColor);
  const movingPieceAttacksKing = directAttackers.includes(move.to);
  const discoveredAttackers = directAttackers.filter(sq => sq !== move.to);
  
  if (movingPieceAttacksKing && discoveredAttackers.length > 0) return 'double_check';
  if (discoveredAttackers.length > 0) {
    return chessAfter.inCheck() ? 'discovered_check' : 'discovered_attack';
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
      const { file: kf, rank: kr } = squareToCoords(kingSquare);
      const { file: nf, rank: nr } = squareToCoords(sq);
      const df = Math.abs(kf - nf);
      const dr = Math.abs(kr - nr);
      if ((df === 1 && dr === 2) || (df === 2 && dr === 1)) {
        knightDeliveredMate = true;
        break;
      }
    }
  }
  
  if (knightDeliveredMate) {
    const { file: kf, rank: kr } = squareToCoords(kingSquare);
    const cornerOrEdge = (kf === 0 || kf === 7) && (kr === 0 || kr === 7);
    
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
        if (piece && piece.color === losingColor) blockedByOwn++;
      }
      if (blockedByOwn >= 3) return 'smothered_mate';
    }
  }
  return 'checkmate';
}

function calculateMaterialBalance(chess: Chess): { white: number; black: number } {
  const pieces = getAllPieces(chess);
  let white = 0, black = 0;
  for (const [, piece] of Array.from(pieces.entries())) {
    const value = PIECE_VALUES[piece.type] || 0;
    if (piece.color === 'w') white += value;
    else black += value;
  }
  return { white, black };
}

function detectPuzzleMotifs(fen: string, solution: string[]): TacticalMotif[] {
  if (!solution || solution.length === 0) return [];
  
  const motifs: TacticalMotif[] = [];
  const chess = new Chess(fen);
  
  for (let i = 0; i < solution.length; i++) {
    const moveSan = solution[i];
    const fenBefore = chess.fen();
    const materialBefore = calculateMaterialBalance(chess);
    
    let moveResult;
    try { moveResult = chess.move(moveSan); } catch { continue; }
    if (!moveResult) continue;
    
    const fenAfter = chess.fen();
    const materialAfter = calculateMaterialBalance(chess);
    const chessAfter = new Chess(fenAfter);
    const chessBefore = new Chess(fenBefore);
    
    const fork = detectFork(chessBefore, {
      from: moveResult.from,
      to: moveResult.to,
      piece: moveResult.piece
    });
    if (fork && !motifs.includes(fork)) motifs.push(fork);
    
    const discovered = detectDiscoveredAttack(chessBefore, chessAfter, {
      from: moveResult.from,
      to: moveResult.to
    });
    if (discovered && !motifs.includes(discovered)) motifs.push(discovered);
    
    if (chess.isCheckmate()) {
      const matePattern = detectMatePattern(chess);
      if (matePattern && !motifs.includes(matePattern)) motifs.push(matePattern);
    }
    
    if (moveResult.promotion) {
      const promoMotif = moveResult.promotion.toLowerCase() !== 'q' ? 'underpromotion' : 'promotion';
      if (!motifs.includes(promoMotif)) motifs.push(promoMotif);
    }
    
    if (moveResult.san.includes('e.p.') && !motifs.includes('en_passant')) {
      motifs.push('en_passant');
    }
    
    const movingColor = chessBefore.get(moveResult.from)?.color;
    if (movingColor) {
      let materialSwing = 0;
      if (movingColor === 'w') {
        materialSwing = (materialAfter.white - materialAfter.black) - (materialBefore.white - materialBefore.black);
      } else {
        materialSwing = (materialAfter.black - materialAfter.white) - (materialBefore.black - materialBefore.white);
      }
      if (materialSwing >= 3 && !motifs.includes('material_win')) motifs.push('material_win');
      
      if (moveResult.captured) {
        const capturedValue = PIECE_VALUES[moveResult.captured] || 0;
        const movingValue = PIECE_VALUES[moveResult.piece] || 0;
        const materialGiven = movingValue - capturedValue;
        if (materialGiven >= 2 && materialSwing >= -1) {
          if (moveResult.piece === 'q' && !motifs.includes('queen_sacrifice')) motifs.push('queen_sacrifice');
          else if (moveResult.piece === 'r' && !motifs.includes('rook_sacrifice')) motifs.push('rook_sacrifice');
          else if ((moveResult.piece === 'n' || moveResult.piece === 'b') && !motifs.includes('minor_piece_sacrifice')) {
            motifs.push('minor_piece_sacrifice');
          }
        }
      }
    }
  }
  
  const totalPlayerMoves = Math.ceil(solution.length / 2);
  if (solution.length >= 2 && totalPlayerMoves === 1 && !motifs.includes('mate_in_1') && !motifs.includes('checkmate')) {
    const testChess = new Chess(fen);
    try {
      for (const move of solution) testChess.move(move);
      if (testChess.isCheckmate()) motifs.push('mate_in_1');
    } catch {}
  } else if (totalPlayerMoves === 2 && !motifs.includes('mate_in_2')) {
    const testChess = new Chess(fen);
    try {
      for (const move of solution) testChess.move(move);
      if (testChess.isCheckmate()) motifs.push('mate_in_2');
    } catch {}
  } else if (totalPlayerMoves === 3 && !motifs.includes('mate_in_3')) {
    const testChess = new Chess(fen);
    try {
      for (const move of solution) testChess.move(move);
      if (testChess.isCheckmate()) motifs.push('mate_in_3');
    } catch {}
  } else if (totalPlayerMoves >= 4 && !motifs.includes('mate_in_4_plus')) {
    const testChess = new Chess(fen);
    try {
      for (const move of solution) testChess.move(move);
      if (testChess.isCheckmate()) motifs.push('mate_in_4_plus');
    } catch {}
  }
  
  return motifs;
}

async function updateLichessMotifs() {
  console.log('Fetching Lichess puzzles...');
  
  const lichessPuzzles = await db
    .select()
    .from(puzzles)
    .where(eq(puzzles.sourceType, 'lichess'));
  
  console.log(`Found ${lichessPuzzles.length} Lichess puzzles to analyze`);
  
  let updated = 0;
  let errors = 0;
  const startTime = Date.now();
  
  for (const puzzle of lichessPuzzles) {
    try {
      const solution = puzzle.solution as string[];
      if (!solution || solution.length === 0) {
        errors++;
        continue;
      }
      
      const detectedMotifs = detectPuzzleMotifs(puzzle.fen, solution);
      
      await db
        .update(puzzles)
        .set({ tacticalMotifs: detectedMotifs })
        .where(eq(puzzles.id, puzzle.id));
      
      updated++;
      if (updated % 100 === 0) {
        console.log(`Processed ${updated}/${lichessPuzzles.length} puzzles...`);
      }
    } catch (err) {
      errors++;
      console.error(`Error processing puzzle ${puzzle.id}:`, err);
    }
  }
  
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\nCompleted in ${elapsed}s`);
  console.log(`Updated: ${updated} puzzles`);
  console.log(`Errors: ${errors}`);
  
  const sampleMotifs = await db
    .select({ motifs: puzzles.tacticalMotifs })
    .from(puzzles)
    .where(eq(puzzles.sourceType, 'lichess'))
    .limit(10);
  
  console.log('\nSample detected motifs:');
  sampleMotifs.forEach((p, i) => {
    console.log(`  ${i + 1}. ${JSON.stringify(p.motifs)}`);
  });
}

updateLichessMotifs()
  .then(() => {
    console.log('\nMotif update complete!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
