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

// Refined thresholds based on modern engine standards
// Tighter ranges make analysis feel more "Master-level"
const CLASSIFICATION_THRESHOLDS = {
  good: 40,       // 1-40 cp: solid move, near-optimal
  imprecise: 90,  // 41-90 cp: slight inaccuracy
  mistake: 200,   // 91-200 cp: clear error, ~1 pawn loss
  blunder: 200,   // 201+ cp: serious blunder, 2+ pawns or piece
};

// Position is "crushing" when one side is completely winning
// Don't award Genius/Fantastic for finding obvious moves in won positions
// Use 5.0 since normalized eval is clamped to ±10 (equivalent to ~5 pawns advantage)
const CRUSHING_EVAL_THRESHOLD = 5.0;

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
  isRealSacrifice: boolean;  // True only for non-capture moves that leave material hanging
  isHardToFind: boolean;     // True if second-best move drops eval by 150+ cp
  deliversMate: boolean;
  evalBefore: number;        // Position eval before the move (from player's perspective)
  evalAfter: number;         // Position eval after the move (from player's perspective)
  isOnlyWinningMove: boolean; // True if this is the only move that maintains winning/equal position
}

function classifyMove(ctx: ClassificationContext): MoveClassification {
  if (ctx.isForced) return 'forced';

  // Check if position is already "crushing" - don't award special moves in won positions
  // A position where either side has 5+ pawn equivalent advantage is crushing
  const isCrushingPosition = Math.abs(ctx.evalBefore) >= CRUSHING_EVAL_THRESHOLD;

  // Genius: Best move that delivers mate (only if NOT in crushing position AND hard to find)
  // Mating moves are only genius if they were difficult to spot
  if (ctx.isBestMove && ctx.deliversMate && !isCrushingPosition && ctx.isHardToFind) {
    return 'genius';
  }

  // Genius: Real sacrifice + Sound (evalAfter > -1.0) + Hard to find
  // A REAL sacrifice is a non-capture move that intentionally leaves material to be taken
  // The sacrifice must be the ONLY winning line (hard to find)
  if (ctx.isBestMove && ctx.isRealSacrifice && !isCrushingPosition && ctx.isHardToFind) {
    const isSoundSacrifice = ctx.evalAfter > -1.0;
    if (isSoundSacrifice) {
      return 'genius';
    }
  }

  // Fantastic: Best move + Only move to stay winning/equal (the "high-wire act")
  // This rewards finding the critical move that prevents collapse
  // Must also leave position in non-losing state (evalAfter >= -1.0)
  if (ctx.isBestMove && ctx.isOnlyWinningMove && !isCrushingPosition) {
    const maintainsPosition = ctx.evalAfter >= -1.0;
    if (maintainsPosition) {
      return 'fantastic';
    }
  }

  if (ctx.isBestMove) {
    return 'best';
  }

  if (ctx.normalizedCentipawnLoss <= CLASSIFICATION_THRESHOLDS.good) return 'good';
  if (ctx.normalizedCentipawnLoss <= CLASSIFICATION_THRESHOLDS.imprecise) return 'imprecise';
  if (ctx.normalizedCentipawnLoss <= CLASSIFICATION_THRESHOLDS.mistake) return 'mistake';
  return 'blunder';
}

// Accuracy weights based on move classification (refined thresholds)
// Genius/Fantastic/Best/Forced = 100%, Good = 90-95%, Imprecise = 60-75%, Mistake = 30-45%, Blunder = 0-10%
// Using weighted mean - importance factor reduces impact of outliers (bad moves don't tank score unfairly)
function getClassificationWeight(classification: MoveClassification, cpLoss: number): { weight: number; importance: number } {
  switch (classification) {
    case 'genius':
    case 'fantastic':
    case 'best':
    case 'forced':
    case 'book':
      // Perfect moves get 100%
      return { weight: 100, importance: 1.0 };
    case 'good':
      // Good moves: 90-95% based on CP loss (1-40 cp loss)
      // This ensures "Good" is noticeably below "Best" but still solid
      const goodWeight = Math.max(90, 95 - (cpLoss / 8));
      return { weight: goodWeight, importance: 1.0 };
    case 'imprecise':
      // Imprecise: 60-75% based on CP loss (41-90 cp loss)
      const impreciseWeight = Math.max(60, 75 - ((cpLoss - 40) / 50) * 15);
      return { weight: impreciseWeight, importance: 1.0 };
    case 'mistake':
      // Mistake: 30-45% based on CP loss (91-200 cp loss)
      const mistakeWeight = Math.max(30, 45 - ((cpLoss - 90) / 110) * 15);
      return { weight: mistakeWeight, importance: 1.0 };
    case 'blunder':
      // Blunder: 0-10% based on severity (201+ cp loss)
      const blunderWeight = Math.max(0, 10 - ((cpLoss - 200) / 100) * 10);
      return { weight: blunderWeight, importance: 1.0 };
    default:
      return { weight: 100, importance: 1.0 };
  }
}

function calculateAccuracyFromClassifications(moves: MoveAnalysisResult[]): number {
  if (moves.length === 0) return 100;

  let weightedSum = 0;
  let importanceSum = 0;

  for (const move of moves) {
    const { weight, importance } = getClassificationWeight(move.classification, move.normalizedCentipawnLoss);
    weightedSum += weight * importance;
    importanceSum += importance;
  }

  if (importanceSum === 0) return 100;
  
  const accuracy = weightedSum / importanceSum;
  return Math.round(accuracy * 10) / 10;
}

// Legacy function kept for backwards compatibility
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
    const rawTopMoves = await clientStockfish.getTopMoves(fenBefore, 3, 100000);
    
    // Normalize top move evaluations to White's perspective
    // Stockfish returns evals from side-to-move POV, so flip for Black's turn
    const topMoves = rawTopMoves.map(tm => ({
      ...tm,
      evaluation: color === 'white' ? tm.evaluation : -tm.evaluation,
    }));

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

    // STRICT Sacrifice Detection for Genius moves
    // A REAL sacrifice is a NON-CAPTURE move that intentionally leaves material to be taken
    // Trades (captures) are NEVER sacrifices - only moves where you don't take anything
    const isNonCapture = !moveResult.captured;
    const movedPieceValue = PIECE_VALUES[moveResult.piece.toLowerCase()] || 0;
    
    // A real sacrifice requires:
    // 1. Non-capture move (not a trade)
    // 2. Moving a piece worth 3+ (minor piece or higher)
    // 3. Position improves or stays good (evalSwing >= 0 means we didn't just blunder)
    const isRealSacrifice = isBestMove && isNonCapture && movedPieceValue >= 3 && evalSwing >= 0;

    // Detect "hard to find" - the move must be the ONLY winning line
    // Second-best move must drop eval by 150+ cp (1.5 pawns) 
    let isHardToFind = false;
    let isOnlyWinningMove = false;
    if (isBestMove && topMoves.length >= 2) {
      const bestMoveEval = topMoves[0]?.evaluation || 0;
      const secondBestEval = topMoves[1]?.evaluation || 0;
      const evalDropForSecondBest = (bestMoveEval - secondBestEval) * 100;
      
      // For "only winning move" (Fantastic): 100+ cp drop
      isOnlyWinningMove = evalDropForSecondBest >= 100;
      
      // For "hard to find" (Genius): 150+ cp drop - stricter requirement
      isHardToFind = evalDropForSecondBest >= 150;
    }

    const classification = classifyMove({
      centipawnLoss,
      normalizedCentipawnLoss,
      isBestMove,
      isForced,
      isRealSacrifice,
      isHardToFind,
      deliversMate,
      evalBefore: normalizedEvalBefore,
      evalAfter: normalizedEvalAfter,
      isOnlyWinningMove,
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

    console.log('[GameAnalysis] Calculating accuracies using classification-based weighted mean...');
    // Split moves by color for accuracy calculation
    const whiteMoves = moveResults.filter(m => m.color === 'white');
    const blackMoves = moveResults.filter(m => m.color === 'black');
    const whiteAccuracy = calculateAccuracyFromClassifications(whiteMoves);
    const blackAccuracy = calculateAccuracyFromClassifications(blackMoves);
    
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
