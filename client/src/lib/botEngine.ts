import { Chess } from 'chess.js';
import { clientStockfish, StockfishResult } from './stockfish';
import { getBookMoves, isOpeningPhase } from './polyglotBook';
import { getBotConfigFromElo } from '@shared/botTypes';

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

/**
 * Count total pieces on the board from FEN string.
 * Returns count of all pieces (both colors).
 */
export function countAllPieces(fen: string): number {
  const board = fen.split(' ')[0];
  let count = 0;
  for (const char of board) {
    if (/[pnbrqkPNBRQK]/.test(char)) {
      count++;
    }
  }
  return count;
}

/**
 * Human-like bot thinking delay based on game phase and complexity.
 * Creates realistic thinking patterns:
 * - Moves 1-6: 1-2s (book moves)
 * - Moves 7-10: 2-3s (development)
 * - Moves 11-15: 3-8s (middlegame transition)
 * - Moves 16-20: 4-8s (peak complexity)
 * - Move 21+: Based on piece count (4-8s crowded, 1-2s endgame)
 * - Time scramble overrides: Under 60s = 1s, under 30s = 0.5s (NO multiplier applied)
 * 
 * Time control scaling (applied to all moves including first 20):
 * - 5min/Practice: 1.0x (base delays)
 * - 15min: 1.5x (longer thinks for rapid games)
 * - 30min: 2.0x (classical-length pauses)
 */
export function getHumanBotThinkingDelay(
  moveNumber: number,
  pieceCount: number,
  botTimeRemaining: number,
  timeControl: 'blitz' | 'rapid' | 'classical' | 'practice' = 'blitz'
): number {
  // PRIORITY 1: TIME SCRAMBLE (Panic Mode) - NO multiplier applied!
  if (botTimeRemaining < 30) return 500; // 0.5s
  if (botTimeRemaining < 60) return 1000; // 1s

  // Get time control multiplier
  const getMultiplier = () => {
    if (timeControl === 'classical') return 2.0;
    if (timeControl === 'rapid') return 1.5;
    return 1.0; // blitz and practice
  };
  const multiplier = getMultiplier();

  const randomRange = (min: number, max: number) => 
    (Math.random() * (max - min) + min) * 1000;

  let baseDelay: number;

  // PRIORITY 2: EARLY GAME (Moves 1-20)
  if (moveNumber <= 6) {
    baseDelay = randomRange(1, 2);
  } else if (moveNumber <= 10) {
    baseDelay = randomRange(2, 3);
  } else if (moveNumber <= 15) {
    baseDelay = randomRange(3, 8);
  } else if (moveNumber <= 20) {
    baseDelay = randomRange(4, 8);
  }
  // PRIORITY 3: PIECE DENSITY (Move 21+)
  else if (pieceCount >= 26) {
    baseDelay = randomRange(4, 8);
  } else if (pieceCount >= 20) {
    baseDelay = randomRange(4, 7);
  } else if (pieceCount >= 14) {
    baseDelay = randomRange(3, 6);
  } else if (pieceCount >= 9) {
    baseDelay = randomRange(2, 4);
  } else {
    baseDelay = randomRange(1, 2); // Final Endgame (8-2 pieces)
  }

  return baseDelay * multiplier;
}

export interface BotMoveResult {
  move: string;
  evaluation?: number;
  isBookMove?: boolean;
  isFreeCapture?: boolean;
}

/**
 * Get a random legal move from the position.
 */
function getRandomMove(fen: string): string | null {
  try {
    const game = new Chess(fen);
    const moves = game.moves({ verbose: true });
    if (moves.length === 0) return null;
    
    const randomMove = moves[Math.floor(Math.random() * moves.length)];
    return randomMove.from + randomMove.to + (randomMove.promotion || '');
  } catch {
    return null;
  }
}

/**
 * Get a move from the bot using depth-limited Stockfish search.
 * Uses opening book for early game, then depth-limited search with random chance.
 * 
 * Bot difficulty is controlled by:
 * - depth: How many moves ahead the engine looks (1-6, or 0 for unleashed)
 * - randomPercent: Chance of playing a completely random legal move (0-50%)
 * - skillLevel: Stockfish Skill Level parameter (0-20)
 */
export async function getBotMove(
  fen: string,
  botElo: number,
  moveHistorySAN?: string[],
  lastMove?: LastMoveInfo
): Promise<BotMoveResult | null> {
  try {
    // Get bot configuration from continuous Elo
    const config = getBotConfigFromElo(botElo);
    
    // Random move chance (coin flip before any calculation)
    if (config.randomPercent > 0 && Math.random() * 100 < config.randomPercent) {
      const randomMove = getRandomMove(fen);
      if (randomMove) {
        console.log(`[BotEngine] Elo ${botElo}: Playing random move (${config.randomPercent}% chance)`);
        return {
          move: randomMove,
          isBookMove: false
        };
      }
    }
    
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
            const moveUci = bookMove.from + bookMove.to + (bookMove.promotion || '');
            return {
              move: moveUci,
              isBookMove: true
            };
          }
        }
        
        const bestMove = bookMoves[0];
        return {
          move: bestMove.from + bestMove.to + (bestMove.promotion || ''),
          isBookMove: true
        };
      }
    }
    
    // Use Stockfish with depth-limited or node-based search
    let result: StockfishResult;
    
    if (config.depth > 0) {
      // Depth-limited search with Skill Level
      result = await clientStockfish.getBestMove(fen, {
        depth: config.depth,
        skillLevel: config.skillLevel
      });
      console.log(`[BotEngine] Elo ${botElo}: Depth ${config.depth}, Skill ${config.skillLevel}`);
    } else {
      // Node-based unleashed search with Skill Level
      result = await clientStockfish.getBestMove(fen, {
        nodes: config.nodes || 500000,
        skillLevel: config.skillLevel
      });
      console.log(`[BotEngine] Elo ${botElo}: Unleashed nodes ${config.nodes}, Skill ${config.skillLevel}`);
    }
    
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
