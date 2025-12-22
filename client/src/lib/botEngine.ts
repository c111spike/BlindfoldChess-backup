import { Chess, Move } from 'chess.js';
import { clientStockfish, TopMoveResult } from './stockfish';
import { getLichessOpeningMoves, selectOpeningMoveByPersonality, isOpeningPhase } from './lichessOpenings';
import type { BotPersonality, BotDifficulty } from '@shared/botTypes';

// Piece values for MVV-LVA ordering
const PIECE_VALUES: Record<string, number> = {
  p: 100,
  n: 300,
  b: 320,
  r: 500,
  q: 900,
  k: 20000,
};

// MVV-LVA score: Higher = search first
// Most Valuable Victim - Least Valuable Attacker
function getMvvLvaScore(move: Move): number {
  if (!move.captured) return 0;
  
  const victimValue = PIECE_VALUES[move.captured] || 0;
  const attackerValue = PIECE_VALUES[move.piece] || 0;
  
  // MVV-LVA: victim * 10 - attacker gives priority to low-value attackers capturing high-value victims
  return victimValue * 10 - attackerValue;
}

// Sort moves for better alpha-beta pruning
function orderMoves(moves: Move[], bestMoveFromPrevious?: string): Move[] {
  const scored = moves.map(m => ({
    move: m,
    score: getMvvLvaScore(m) + (m.san.includes('+') ? 50 : 0) + (m.san.includes('#') ? 10000 : 0),
  }));
  
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

// Position evaluation with piece-square tables
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

function evaluatePosition(game: Chess): number {
  const board = game.board();
  let score = 0;

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece) {
        const pieceValue = PIECE_VALUES[piece.type];
        const pst = PST[piece.type];
        const tableRow = piece.color === 'w' ? 7 - row : row;
        const positionValue = pst ? pst[tableRow][col] : 0;
        
        const totalValue = pieceValue + positionValue;
        score += piece.color === 'w' ? totalValue : -totalValue;
      }
    }
  }

  return score;
}

// Quiescence search with stand-pat rule
function quiescence(game: Chess, alpha: number, beta: number, depth: number = 0): number {
  // Stand-pat: evaluate current position without forcing captures
  const standPat = evaluatePosition(game);
  
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
    const score = -quiescence(game, -beta, -alpha, depth + 1);
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

// Minimax with alpha-beta pruning and quiescence
function minimax(
  game: Chess,
  depth: number,
  alpha: number,
  beta: number,
  maximizing: boolean,
  bestMoveFromPrevious?: string
): { score: number; bestMove?: string } {
  if (depth === 0) {
    // Use quiescence search at leaf nodes
    const qScore = maximizing 
      ? quiescence(game, alpha, beta)
      : -quiescence(game, -beta, -alpha);
    return { score: qScore };
  }
  
  if (game.isGameOver()) {
    if (game.isCheckmate()) {
      return { score: maximizing ? -99999 : 99999 };
    }
    return { score: 0 }; // Draw
  }

  const moves = game.moves({ verbose: true });
  const orderedMoves = orderMoves(moves, bestMoveFromPrevious);
  
  let bestMove = orderedMoves[0]?.san;

  if (maximizing) {
    let maxEval = -Infinity;
    for (const move of orderedMoves) {
      game.move(move.san);
      const result = minimax(game, depth - 1, alpha, beta, false);
      game.undo();
      
      if (result.score > maxEval) {
        maxEval = result.score;
        bestMove = move.san;
      }
      alpha = Math.max(alpha, result.score);
      if (beta <= alpha) break;
    }
    return { score: maxEval, bestMove };
  } else {
    let minEval = Infinity;
    for (const move of orderedMoves) {
      game.move(move.san);
      const result = minimax(game, depth - 1, alpha, beta, true);
      game.undo();
      
      if (result.score < minEval) {
        minEval = result.score;
        bestMove = move.san;
      }
      beta = Math.min(beta, result.score);
      if (beta <= alpha) break;
    }
    return { score: minEval, bestMove };
  }
}

// Iterative deepening with time management
function iterativeDeepening(
  game: Chess,
  maxTimeMs: number,
  maxDepth: number = 10
): { bestMove: string; depth: number; score: number } {
  const startTime = Date.now();
  const moveOverhead = 100; // Buffer for network latency
  const timeLimit = maxTimeMs - moveOverhead;
  
  let bestMove = '';
  let bestScore = 0;
  let reachedDepth = 0;
  
  const maximizing = game.turn() === 'w';
  
  for (let depth = 1; depth <= maxDepth; depth++) {
    const elapsed = Date.now() - startTime;
    
    // Stop if we've used 70% of time (to ensure we complete current depth)
    if (elapsed > timeLimit * 0.7 && depth > 1) {
      break;
    }
    
    const result = minimax(game, depth, -Infinity, Infinity, maximizing, bestMove);
    
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

// Difficulty settings
interface DifficultyConfig {
  elo: number;
  timePerMoveMs: number;
  maxDepth: number;
  multiPvCount: number;
  stockfishNodes: number;
  mistakeProbability: number;
  useStockfish: boolean;
}

const DIFFICULTY_CONFIG: Record<BotDifficulty, DifficultyConfig> = {
  beginner: { elo: 400, timePerMoveMs: 500, maxDepth: 2, multiPvCount: 5, stockfishNodes: 10000, mistakeProbability: 0.4, useStockfish: false },
  novice: { elo: 600, timePerMoveMs: 800, maxDepth: 3, multiPvCount: 5, stockfishNodes: 50000, mistakeProbability: 0.2, useStockfish: false },
  intermediate: { elo: 900, timePerMoveMs: 1200, maxDepth: 4, multiPvCount: 4, stockfishNodes: 100000, mistakeProbability: 0.1, useStockfish: true },
  club: { elo: 1200, timePerMoveMs: 1500, maxDepth: 5, multiPvCount: 4, stockfishNodes: 200000, mistakeProbability: 0.05, useStockfish: true },
  advanced: { elo: 1500, timePerMoveMs: 2000, maxDepth: 6, multiPvCount: 3, stockfishNodes: 500000, mistakeProbability: 0.03, useStockfish: true },
  expert: { elo: 1800, timePerMoveMs: 3000, maxDepth: 8, multiPvCount: 3, stockfishNodes: 1000000, mistakeProbability: 0.02, useStockfish: true },
  master: { elo: 2000, timePerMoveMs: 4000, maxDepth: 10, multiPvCount: 3, stockfishNodes: 2000000, mistakeProbability: 0.01, useStockfish: true },
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
    
    if (!move) return { candidate, score };
    
    // Apply personality bonuses
    switch (personality) {
      case 'aggressive':
        if (move.captured) score += 80 * personalityInfluence;
        if (move.san.includes('+')) score += 100 * personalityInfluence;
        // Prefer moves toward enemy king side
        if (game.turn() === 'w' && parseInt(move.to[1]) >= 5) score += 40 * personalityInfluence;
        if (game.turn() === 'b' && parseInt(move.to[1]) <= 4) score += 40 * personalityInfluence;
        break;
        
      case 'tactician':
        if (move.captured) score += PIECE_VALUES[move.captured] * 0.2 * personalityInfluence;
        if (move.san.includes('+')) score += 60 * personalityInfluence;
        if (move.san.includes('#')) score += 1000;
        // Love sacrifices (giving up material for attack)
        if (move.captured && move.piece !== 'p') score += 50 * personalityInfluence;
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
        break;
        
      case 'bishop_lover':
        if (move.piece === 'b') score += 60 * personalityInfluence;
        // Long diagonals
        const longDiagonals = ['a1', 'b2', 'c3', 'd4', 'e5', 'f6', 'g7', 'h8', 'a8', 'b7', 'c6', 'd5', 'e4', 'f3', 'g2', 'h1'];
        if (move.piece === 'b' && longDiagonals.includes(move.to)) score += 40 * personalityInfluence;
        // Prefer trading knights for bishops
        if (move.captured === 'n' && move.piece !== 'n') score += 30 * personalityInfluence;
        break;
        
      case 'knight_lover':
        if (move.piece === 'n') score += 60 * personalityInfluence;
        // Outpost squares
        const outposts = ['c5', 'd5', 'e5', 'f5', 'c4', 'd4', 'e4', 'f4'];
        if (move.piece === 'n' && outposts.includes(move.to)) score += 50 * personalityInfluence;
        // Prefer trading bishops for knights
        if (move.captured === 'b' && move.piece !== 'b') score += 30 * personalityInfluence;
        break;
        
      case 'balanced':
      default:
        // Slight preference for the engine's top choice
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
    
    // Fallback: Use iterative deepening minimax
    console.log(`[ClientBot] Using minimax with depth ${config.maxDepth}, time ${timeBudget}ms`);
    
    const result = iterativeDeepening(game, timeBudget, config.maxDepth);
    
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
