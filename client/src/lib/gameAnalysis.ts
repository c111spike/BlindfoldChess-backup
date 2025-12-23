import { Chess } from 'chess.js';
import { clientStockfish, type PositionAnalysis, type TopMoveResult } from './stockfish';

export type MoveClassification = 
  | 'genius' 
  | 'fantastic' 
  | 'best' 
  | 'good' 
  | 'imprecise' 
  | 'mistake' 
  | 'blunder' 
  | 'book' 
  | 'forced';

export type GamePhase = 'opening' | 'middlegame' | 'endgame';

export interface MoveAnalysisResult {
  moveNumber: number;
  color: 'white' | 'black';
  move: string;
  fen: string;
  evalBefore: number;
  evalAfter: number;
  normalizedEvalBefore: number;
  normalizedEvalAfter: number;
  bestMove: string;
  bestMoveEval: number;
  centipawnLoss: number;
  normalizedCentipawnLoss: number;
  principalVariation: string[];
  isBestMove: boolean;
  isMateBefore: boolean;
  isMateAfter: boolean;
  mateInBefore?: number;
  mateInAfter?: number;
  capturedPiece?: string;
  movedPiece: string;
  isCheckmate: boolean;
  classification: MoveClassification;
  phase: GamePhase;
  topMoves?: TopMoveResult[];
}

export interface GameAnalysisResult {
  moves: MoveAnalysisResult[];
  whiteAccuracy: number;
  blackAccuracy: number;
  criticalMoments: number[];
  improvementSuggestions: string[];
  timeTroubleStart: number | null;
  burnoutDetected: boolean;
  focusCheckScore: number;
  efficiencyFactor: number;
}

const MAX_EVAL = 10;
const MAX_CENTIPAWN_LOSS = 500;

const CLASSIFICATION_THRESHOLDS = {
  good: 50,
  imprecise: 120,
  mistake: 250,
  blunder: 250,
};

const PIECE_VALUES: Record<string, number> = {
  'p': 1,
  'n': 3,
  'b': 3,
  'r': 5,
  'q': 9,
  'k': 0,
};

const OPENING_MOVE_LIMIT = 10;
const MIDDLEGAME_MATERIAL_THRESHOLD = 26;

function normalizeEvaluation(rawEval: number): number {
  return Math.max(-MAX_EVAL, Math.min(MAX_EVAL, rawEval));
}

function normalizeCentipawnLoss(rawLoss: number): number {
  return Math.min(MAX_CENTIPAWN_LOSS, Math.max(0, rawLoss));
}

function determineGamePhase(chess: Chess, moveNumber: number): GamePhase {
  if (moveNumber <= OPENING_MOVE_LIMIT) return 'opening';

  const fen = chess.fen();
  const pieces = fen.split(' ')[0];
  let material = 0;

  for (const char of pieces) {
    switch (char.toLowerCase()) {
      case 'q': material += 9; break;
      case 'r': material += 5; break;
      case 'b': material += 3; break;
      case 'n': material += 3; break;
    }
  }

  if (material <= MIDDLEGAME_MATERIAL_THRESHOLD) return 'endgame';
  return 'middlegame';
}

function isMoveForcedPosition(chess: Chess): boolean {
  const moves = chess.moves();
  return moves.length === 1;
}

interface ClassificationContext {
  centipawnLoss: number;
  normalizedCentipawnLoss: number;
  isBestMove: boolean;
  isForced: boolean;
  isSacrifice: boolean;
  evalSwing: number;
  deliversMate: boolean;
}

function classifyMove(ctx: ClassificationContext): MoveClassification {
  if (ctx.isForced) return 'forced';

  if (ctx.isBestMove && ctx.isSacrifice && (ctx.evalSwing >= 300 || ctx.deliversMate)) {
    return 'genius';
  }

  if (ctx.isBestMove && (ctx.evalSwing >= 200 || ctx.deliversMate)) {
    return 'fantastic';
  }

  if (ctx.isBestMove) {
    return 'best';
  }

  if (ctx.normalizedCentipawnLoss <= CLASSIFICATION_THRESHOLDS.good) return 'good';
  if (ctx.normalizedCentipawnLoss <= CLASSIFICATION_THRESHOLDS.imprecise) return 'imprecise';
  if (ctx.normalizedCentipawnLoss <= CLASSIFICATION_THRESHOLDS.mistake) return 'mistake';
  return 'blunder';
}

function calculateAccuracy(normalizedCentipawnLosses: number[]): number {
  if (normalizedCentipawnLosses.length === 0) return 100;

  const avgLoss = normalizedCentipawnLosses.reduce((a, b) => a + b, 0) / normalizedCentipawnLosses.length;
  const accuracy = Math.max(0, Math.min(100, 100 - (avgLoss / 5)));
  return Math.round(accuracy * 10) / 10;
}

function detectCriticalMoments(moveAnalyses: MoveAnalysisResult[]): number[] {
  const criticalMoves: number[] = [];
  const SWING_THRESHOLD = 1.5;

  for (let i = 1; i < moveAnalyses.length; i++) {
    const evalDiff = Math.abs(moveAnalyses[i].normalizedEvalAfter - moveAnalyses[i - 1].normalizedEvalAfter);
    if (evalDiff >= SWING_THRESHOLD) {
      criticalMoves.push(i);
    }
  }

  return criticalMoves.slice(0, 5);
}

function generateImprovementSuggestions(
  classifications: MoveClassification[],
  phases: GamePhase[]
): string[] {
  const suggestions: string[] = [];

  const blunders = classifications.filter(c => c === 'blunder').length;
  const mistakes = classifications.filter(c => c === 'mistake').length;

  const openingMoves = phases.filter(p => p === 'opening').length;
  const openingClassifications = classifications.slice(0, openingMoves);
  const openingErrors = openingClassifications.filter(c => c === 'blunder' || c === 'mistake').length;

  if (openingErrors > 2) {
    suggestions.push('Study your opening repertoire - you had several inaccuracies in the opening phase');
  }

  if (blunders > 2) {
    suggestions.push('Practice tactical puzzles to reduce blunders');
  }

  if (mistakes > 3) {
    suggestions.push('Spend more time on candidate move selection before committing');
  }

  const endgameMoves = phases.filter(p => p === 'endgame').length;
  if (endgameMoves > 0) {
    const endgameStartIndex = phases.findIndex(p => p === 'endgame');
    const endgameClassifications = classifications.slice(endgameStartIndex);
    const endgameErrors = endgameClassifications.filter(c => c === 'blunder' || c === 'mistake').length;
    if (endgameErrors > 1) {
      suggestions.push('Study endgame fundamentals - several errors occurred in the endgame');
    }
  }

  return suggestions.slice(0, 4);
}

export type AnalysisProgressCallback = (current: number, total: number) => void;

export async function analyzeGameClientSide(
  moves: string[],
  onProgress?: AnalysisProgressCallback
): Promise<GameAnalysisResult> {
  console.log('[GameAnalysis] Initializing Stockfish WASM...');
  await clientStockfish.init();
  console.log('[GameAnalysis] Stockfish ready, starting analysis of', moves.length, 'moves');

  const chess = new Chess();
  const moveResults: MoveAnalysisResult[] = [];
  const whiteNormalizedCPL: number[] = [];
  const blackNormalizedCPL: number[] = [];

  let prevAnalysis: PositionAnalysis | null = null;
  const NODES_PER_POSITION = 200000;

  for (let i = 0; i < moves.length; i++) {
    const move = moves[i];
    const color: 'white' | 'black' = i % 2 === 0 ? 'white' : 'black';
    const moveNumber = Math.floor(i / 2) + 1;

    const fenBefore = chess.fen();
    const isForced = isMoveForcedPosition(chess);

    const analysisBefore = prevAnalysis || await clientStockfish.analyzePosition(fenBefore, NODES_PER_POSITION);
    
    // Get top 3 moves for this position (cached for instant display during review)
    // Use fewer nodes for faster analysis since we already have the best move from analysisBefore
    const topMoves = await clientStockfish.getTopMoves(fenBefore, 3, 100000);

    const moveResult = chess.move(move);
    if (!moveResult) {
      console.error(`[GameAnalysis] Invalid move: ${move}`);
      continue;
    }

    const fenAfter = chess.fen();
    const phase = determineGamePhase(chess, moveNumber);

    const analysisAfter = await clientStockfish.analyzePosition(fenAfter, NODES_PER_POSITION);

    const evalBefore = color === 'white' ? analysisBefore.evaluation : -analysisBefore.evaluation;
    const evalAfter = color === 'white' ? -analysisAfter.evaluation : analysisAfter.evaluation;

    const normalizedEvalBefore = normalizeEvaluation(evalBefore);
    const normalizedEvalAfter = normalizeEvaluation(evalAfter);

    const centipawnLoss = Math.max(0, (evalBefore - evalAfter) * 100);
    const normalizedCentipawnLoss = normalizeCentipawnLoss(centipawnLoss);

    const isBestMove = move === analysisBefore.bestMove ||
      moveResult.san === analysisBefore.bestMove ||
      `${moveResult.from}${moveResult.to}` === analysisBefore.bestMove;

    const evalSwing = (normalizedEvalAfter - normalizedEvalBefore) * 100;
    const isCheckmate = chess.isCheckmate();
    const deliversMate = isCheckmate || (analysisAfter.isMate && analysisAfter.mateIn !== undefined && analysisAfter.mateIn >= 0);

    const classification = classifyMove({
      centipawnLoss,
      normalizedCentipawnLoss,
      isBestMove,
      isForced,
      isSacrifice: false,
      evalSwing,
      deliversMate,
    });

    if (color === 'white') {
      whiteNormalizedCPL.push(normalizedCentipawnLoss);
    } else {
      blackNormalizedCPL.push(normalizedCentipawnLoss);
    }

    moveResults.push({
      moveNumber,
      color,
      move: moveResult.san,
      fen: fenAfter,
      evalBefore,
      evalAfter,
      normalizedEvalBefore,
      normalizedEvalAfter,
      bestMove: analysisBefore.bestMove,
      bestMoveEval: analysisBefore.evaluation,
      centipawnLoss,
      normalizedCentipawnLoss,
      principalVariation: analysisBefore.principalVariation,
      isBestMove,
      isMateBefore: analysisBefore.isMate,
      isMateAfter: analysisAfter.isMate,
      mateInBefore: analysisBefore.mateIn,
      mateInAfter: analysisAfter.mateIn,
      capturedPiece: moveResult.captured,
      movedPiece: moveResult.piece,
      isCheckmate,
      classification,
      phase,
      topMoves,
    });

    prevAnalysis = {
      ...analysisAfter,
      evaluation: -analysisAfter.evaluation,
    };

    if (onProgress) {
      onProgress(i + 1, moves.length);
    }
  }

  console.log('[GameAnalysis] Loop complete, calculating results...');
  
  try {
    const classifications = moveResults.map(m => m.classification);
    const phases = moveResults.map(m => m.phase);

    console.log('[GameAnalysis] Calculating accuracies...');
    const whiteAccuracy = calculateAccuracy(whiteNormalizedCPL);
    const blackAccuracy = calculateAccuracy(blackNormalizedCPL);
    
    console.log('[GameAnalysis] Detecting critical moments...');
    const criticalMoments = detectCriticalMoments(moveResults);
    
    console.log('[GameAnalysis] Generating suggestions...');
    const suggestions = generateImprovementSuggestions(classifications, phases);

    console.log('[GameAnalysis] Building final result with', moveResults.length, 'analyzed moves');
    
    const result: GameAnalysisResult = {
      moves: moveResults,
      whiteAccuracy,
      blackAccuracy,
      criticalMoments,
      improvementSuggestions: suggestions,
      timeTroubleStart: null,
      burnoutDetected: false,
      focusCheckScore: 1,
      efficiencyFactor: 1,
    };
    
    console.log('[GameAnalysis] Analysis complete! Returning result.');
    return result;
  } catch (err) {
    console.error('[GameAnalysis] Error in post-loop calculations:', err);
    throw err;
  }
}
