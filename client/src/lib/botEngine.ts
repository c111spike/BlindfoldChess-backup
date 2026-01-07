import { Chess } from 'chess.js';
import { clientStockfish, StockfishResult } from './stockfish';
import { getBookMoves, isOpeningPhase } from './polyglotBook';
import type { BotDifficulty, BotProfile } from '@shared/botTypes';
import { BOT_DIFFICULTY_ELO } from '@shared/botTypes';

// Interface for tracking opponent's last move (for recapture detection)
export interface LastMoveInfo {
  from: string;
  to: string;
  captured?: string;
  capturedValue?: number;
}

// Piece values for delay calculation
const PIECE_VALUES: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

/**
 * Count the number of pieces a bot has remaining on the board.
 */
export function countBotPieces(fen: string, botColor: 'white' | 'black'): number {
  const position = fen.split(' ')[0];
  let count = 0;
  
  if (botColor === 'white') {
    for (const char of position) {
      if (char >= 'A' && char <= 'Z') count++;
    }
  } else {
    for (const char of position) {
      if (char >= 'a' && char <= 'z') count++;
    }
  }
  
  return count;
}

/**
 * Detect if a recapture opportunity exists.
 */
export function detectRecapture(lastMove: LastMoveInfo | undefined, fen: string): boolean {
  if (!lastMove || !lastMove.captured) return false;
  
  try {
    const game = new Chess(fen);
    const legalMoves = game.moves({ verbose: true });
    const recaptureSquare = lastMove.to;
    return legalMoves.some(move => move.to === recaptureSquare && move.captured);
  } catch {
    return false;
  }
}

/**
 * Check if a move captures an undefended piece (free capture).
 */
export function isFreeCapture(fen: string, moveUci: string): boolean {
  try {
    const game = new Chess(fen);
    const from = moveUci.slice(0, 2);
    const to = moveUci.slice(2, 4);
    
    const move = game.move({ from, to, promotion: moveUci.length > 4 ? moveUci[4] : undefined });
    if (!move || !move.captured) return false;
    
    // Check if opponent can recapture
    const opponentMoves = game.moves({ verbose: true });
    return !opponentMoves.some(om => om.to === to && om.captured);
  } catch {
    return false;
  }
}

/**
 * Calculate bot move delay for more human-like timing.
 */
export function getBotMoveDelay(
  moveNumber: number,
  remainingTime: number,
  fen: string,
  botColor: 'white' | 'black',
  lastMove?: LastMoveInfo
): number {
  // Base delay: 500-1500ms
  let baseDelay = 500 + Math.random() * 1000;
  
  // Quick recaptures
  if (detectRecapture(lastMove, fen)) {
    return Math.min(baseDelay, 800);
  }
  
  // Opening moves are faster (book knowledge)
  if (moveNumber <= 10) {
    baseDelay *= 0.7;
  }
  
  // Think longer in complex middlegame
  const pieceCount = countBotPieces(fen, botColor);
  if (pieceCount >= 10 && moveNumber > 10 && moveNumber < 30) {
    baseDelay *= 1.3;
  }
  
  // Time pressure - speed up
  if (remainingTime < 60) {
    baseDelay *= 0.5;
  } else if (remainingTime < 180) {
    baseDelay *= 0.7;
  }
  
  return Math.max(300, Math.min(3000, baseDelay));
}

export interface BotMoveResult {
  move: string;
  evaluation?: number;
  isBookMove?: boolean;
  isFreeCapture?: boolean;
}

/**
 * Get a move from the bot using Stockfish with UCI_LimitStrength.
 * Uses opening book for early game, then Stockfish for the rest.
 */
export async function getBotMove(
  fen: string,
  botId: string,
  moveHistorySAN?: string[],
  lastMove?: LastMoveInfo
): Promise<BotMoveResult | null> {
  try {
    // Get bot Elo from ID
    const elo = BOT_DIFFICULTY_ELO[botId as BotDifficulty] || 1200;
    
    // Check opening book first (for variation in openings)
    if (isOpeningPhase(moveHistorySAN?.length || 0)) {
      const bookResult = await getBookMoves(fen);
      if (bookResult.moves.length > 0) {
        const bookMoves = bookResult.moves;
        // Weight book moves by their frequency
        const totalWeight = bookMoves.reduce((sum, m) => sum + m.weight, 0);
        let random = Math.random() * totalWeight;
        
        for (const bookMove of bookMoves) {
          random -= bookMove.weight;
          if (random <= 0) {
            // Convert book move to UCI format
            const moveUci = bookMove.from + bookMove.to + (bookMove.promotion || '');
            return {
              move: moveUci,
              isBookMove: true
            };
          }
        }
        
        // Fallback to highest weight
        const bestMove = bookMoves[0];
        return {
          move: bestMove.from + bestMove.to + (bestMove.promotion || ''),
          isBookMove: true
        };
      }
    }
    
    // Use Stockfish with UCI_LimitStrength
    const result: StockfishResult = await clientStockfish.getBotMove(fen, elo);
    
    // Check if it's a free capture
    const freeCapture = isFreeCapture(fen, result.bestMove);
    
    return {
      move: result.bestMove,
      evaluation: result.evaluation,
      isFreeCapture: freeCapture
    };
  } catch (error) {
    console.error('[BotEngine] Error getting bot move:', error);
    return null;
  }
}

// Re-export for compatibility
export { loadBook } from './polyglotBook';
