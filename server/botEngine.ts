import { Chess, Move } from "chess.js";
import type { BotPersonality, BotDifficulty } from "../shared/botTypes";
import { BOT_DIFFICULTY_ELO } from "../shared/botTypes";

const PIECE_VALUES: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

const POSITION_BONUS: Record<string, number[][]> = {
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

function squareToIndices(square: string): { row: number; col: number } {
  const col = square.charCodeAt(0) - 97;
  const row = parseInt(square[1]) - 1;
  return { row, col };
}

function evaluatePosition(game: Chess, personality: BotPersonality): number {
  const board = game.board();
  let score = 0;

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece) {
        const pieceValue = PIECE_VALUES[piece.type];
        const positionTable = POSITION_BONUS[piece.type];
        const tableRow = piece.color === "w" ? 7 - row : row;
        const positionValue = positionTable ? positionTable[tableRow][col] : 0;
        
        let personalityBonus = 0;
        
        if (personality === "bishop_lover" && piece.type === "b") {
          personalityBonus = 30;
        } else if (personality === "knight_lover" && piece.type === "n") {
          personalityBonus = 30;
        }
        
        const totalValue = pieceValue + positionValue + personalityBonus;
        score += piece.color === "w" ? totalValue : -totalValue;
      }
    }
  }

  if (personality === "aggressive") {
    const turn = game.turn();
    const moves = game.moves({ verbose: true });
    const attackingMoves = moves.filter(m => m.captured || m.san.includes("+"));
    score += turn === "w" ? attackingMoves.length * 5 : -attackingMoves.length * 5;
  }

  if (personality === "defensive") {
    const inCheck = game.inCheck();
    if (inCheck) {
      score += game.turn() === "w" ? -50 : 50;
    }
  }

  if (personality === "positional") {
    const turn = game.turn();
    const moves = game.moves({ verbose: true });
    const centerSquares = ["d4", "d5", "e4", "e5"];
    const centerControl = moves.filter(m => centerSquares.includes(m.to)).length;
    score += turn === "w" ? centerControl * 8 : -centerControl * 8;
  }

  return score;
}

function minimax(
  game: Chess,
  depth: number,
  alpha: number,
  beta: number,
  maximizing: boolean,
  personality: BotPersonality
): number {
  if (depth === 0 || game.isGameOver()) {
    return evaluatePosition(game, personality);
  }

  const moves = game.moves();

  if (maximizing) {
    let maxEval = -Infinity;
    for (const move of moves) {
      game.move(move);
      const evalScore = minimax(game, depth - 1, alpha, beta, false, personality);
      game.undo();
      maxEval = Math.max(maxEval, evalScore);
      alpha = Math.max(alpha, evalScore);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const move of moves) {
      game.move(move);
      const evalScore = minimax(game, depth - 1, alpha, beta, true, personality);
      game.undo();
      minEval = Math.min(minEval, evalScore);
      beta = Math.min(beta, evalScore);
      if (beta <= alpha) break;
    }
    return minEval;
  }
}

function getSearchDepth(difficulty: BotDifficulty): number {
  const depthMap: Record<BotDifficulty, number> = {
    beginner: 1,
    novice: 1,
    intermediate: 2,
    club: 2,
    advanced: 3,
    expert: 3,
    master: 4,
  };
  return depthMap[difficulty];
}

function getMistakeProbability(difficulty: BotDifficulty): number {
  const probabilityMap: Record<BotDifficulty, number> = {
    beginner: 0.5,
    novice: 0.35,
    intermediate: 0.25,
    club: 0.15,
    advanced: 0.08,
    expert: 0.04,
    master: 0.02,
  };
  return probabilityMap[difficulty];
}

function scoreMove(
  game: Chess,
  move: Move,
  personality: BotPersonality,
  depth: number
): number {
  const gameCopy = new Chess(game.fen());
  gameCopy.move(move.san);
  
  const isMaximizing = game.turn() === "b";
  let score = minimax(gameCopy, depth - 1, -Infinity, Infinity, isMaximizing, personality);

  if (game.turn() === "b") {
    score = -score;
  }

  if (personality === "tactician") {
    if (move.captured) {
      score += PIECE_VALUES[move.captured] * 0.1;
    }
    if (move.san.includes("+")) {
      score += 30;
    }
    if (move.san.includes("#")) {
      score += 1000;
    }
  }

  if (personality === "aggressive") {
    if (move.captured) {
      score += 20;
    }
    if (move.san.includes("+")) {
      score += 40;
    }
    const attackingSquares = ["e4", "d4", "e5", "d5", "f4", "f5", "g4", "g5", "h4", "h5"];
    if (attackingSquares.includes(move.to)) {
      score += 15;
    }
  }

  if (personality === "defensive") {
    if (move.piece === "k" && !move.san.includes("O-O")) {
      score -= 20;
    }
    if (move.san.includes("O-O")) {
      score += 50;
    }
    const backRank = game.turn() === "w" ? "1" : "8";
    if (move.to.endsWith(backRank)) {
      score += 10;
    }
  }

  if (personality === "positional") {
    const centerSquares = ["d4", "d5", "e4", "e5"];
    if (centerSquares.includes(move.to)) {
      score += 25;
    }
    if (move.piece === "n" || move.piece === "b") {
      const developmentRank = game.turn() === "w" ? "1" : "8";
      if (!move.from.endsWith(developmentRank)) {
        score += 0;
      } else {
        score += 15;
      }
    }
  }

  if (personality === "bishop_lover") {
    if (move.piece === "b") {
      score += 20;
    }
    if (move.captured === "n") {
      score += 15;
    }
  }

  if (personality === "knight_lover") {
    if (move.piece === "n") {
      score += 20;
    }
    if (move.captured === "b") {
      score += 15;
    }
    const outpostSquares = ["c5", "d5", "e5", "f5", "c4", "d4", "e4", "f4"];
    if (outpostSquares.includes(move.to)) {
      score += 25;
    }
  }

  return score;
}

export function generateBotMove(
  fen: string,
  personality: BotPersonality,
  difficulty: BotDifficulty
): { move: string; from: string; to: string; promotion?: string } | null {
  const game = new Chess(fen);
  const moves = game.moves({ verbose: true });

  if (moves.length === 0) {
    return null;
  }

  if (moves.length === 1) {
    const move = moves[0];
    return {
      move: move.san,
      from: move.from,
      to: move.to,
      promotion: move.promotion,
    };
  }

  const depth = getSearchDepth(difficulty);
  const mistakeProbability = getMistakeProbability(difficulty);

  const scoredMoves = moves.map(move => ({
    move,
    score: scoreMove(game, move, personality, depth),
  }));

  scoredMoves.sort((a, b) => b.score - a.score);

  let selectedMove: Move;

  if (Math.random() < mistakeProbability) {
    const mistakeRange = Math.min(moves.length, Math.floor(moves.length * 0.6) + 2);
    const randomIndex = Math.floor(Math.random() * mistakeRange);
    selectedMove = scoredMoves[randomIndex].move;
  } else {
    const topMovesCount = Math.min(3, scoredMoves.length);
    const topMoves = scoredMoves.slice(0, topMovesCount);
    
    const totalWeight = topMoves.reduce((sum, m, i) => sum + (topMovesCount - i), 0);
    let random = Math.random() * totalWeight;
    
    selectedMove = topMoves[0].move;
    for (let i = 0; i < topMoves.length; i++) {
      random -= (topMovesCount - i);
      if (random <= 0) {
        selectedMove = topMoves[i].move;
        break;
      }
    }
  }

  return {
    move: selectedMove.san,
    from: selectedMove.from,
    to: selectedMove.to,
    promotion: selectedMove.promotion,
  };
}

export function calculateBotThinkTime(difficulty: BotDifficulty): number {
  const baseTimeMap: Record<BotDifficulty, { min: number; max: number }> = {
    beginner: { min: 500, max: 1500 },
    novice: { min: 800, max: 2000 },
    intermediate: { min: 1000, max: 2500 },
    club: { min: 1200, max: 3000 },
    advanced: { min: 1500, max: 4000 },
    expert: { min: 2000, max: 5000 },
    master: { min: 2500, max: 6000 },
  };

  const range = baseTimeMap[difficulty];
  return Math.floor(Math.random() * (range.max - range.min) + range.min);
}
