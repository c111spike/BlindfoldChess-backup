import { stockfishService, type MoveAnalysisResult } from './stockfish';
import { storage } from './storage';
import { Chess } from 'chess.js';
import type { 
  MoveClassification, 
  GamePhase,
  Game,
  GameAnalysis,
  InsertGameAnalysis,
  InsertMoveAnalysis 
} from '@shared/schema';

interface AnalysisProgress {
  gameId: string;
  currentMove: number;
  totalMoves: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

const analysisQueue: Map<string, AnalysisProgress> = new Map();

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

interface ClassificationContext {
  centipawnLoss: number;
  normalizedCentipawnLoss: number;
  isBestMove: boolean;
  isForced: boolean;
  isSacrifice: boolean;
  evalSwing: number;
  deliversMate: boolean;
  evalAfter: number;
}

function detectSacrifice(
  result: MoveAnalysisResult,
  prevResult: MoveAnalysisResult | null,
  preMovefen: string
): boolean {
  const movedPieceValue = PIECE_VALUES[result.movedPiece] || 0;
  const capturedPieceValue = result.capturedPiece ? (PIECE_VALUES[result.capturedPiece] || 0) : 0;
  
  const materialLoss = movedPieceValue - capturedPieceValue;
  
  if (materialLoss < 2) return false;
  
  try {
    const chess = new Chess(preMovefen);
    
    chess.move(result.move);
    
    const pv = result.principalVariation;
    if (pv && pv.length > 0) {
      try {
        const opponentReply = chess.move(pv[0]);
        if (opponentReply && opponentReply.captured) {
          const recapturedValue = PIECE_VALUES[opponentReply.captured] || 0;
          if (recapturedValue >= movedPieceValue - 1) {
            return false;
          }
        }
      } catch {
      }
    }
  } catch {
  }
  
  const evalImprovement = result.normalizedEvalAfter - result.normalizedEvalBefore;
  const deliversMate = result.isMateAfter && result.mateInAfter !== undefined && result.mateInAfter > 0;
  
  return evalImprovement >= 1.5 || deliversMate;
}

function classifyMove(ctx: ClassificationContext): MoveClassification {
  if (ctx.isForced) return 'forced';
  
  if (ctx.isSacrifice && (ctx.evalSwing >= 150 || ctx.deliversMate)) {
    return 'genius';
  }
  
  if (!ctx.isSacrifice && (ctx.deliversMate || ctx.evalSwing >= 200 || ctx.evalAfter >= 3)) {
    return 'fantastic';
  }
  
  if (ctx.isBestMove && ctx.normalizedCentipawnLoss <= 10) {
    return 'best';
  }
  
  if (ctx.normalizedCentipawnLoss <= CLASSIFICATION_THRESHOLDS.good) return 'good';
  if (ctx.normalizedCentipawnLoss <= CLASSIFICATION_THRESHOLDS.imprecise) return 'imprecise';
  if (ctx.normalizedCentipawnLoss <= CLASSIFICATION_THRESHOLDS.mistake) return 'mistake';
  return 'blunder';
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

function findBiggestSwings(moveAnalyses: MoveAnalysisResult[]): { moveNumber: number; swing: number }[] {
  const swings: { moveNumber: number; swing: number; index: number }[] = [];
  
  for (let i = 1; i < moveAnalyses.length; i++) {
    const swing = Math.abs(moveAnalyses[i].normalizedEvalAfter - moveAnalyses[i - 1].normalizedEvalAfter);
    swings.push({ moveNumber: moveAnalyses[i].moveNumber, swing, index: i });
  }
  
  return swings
    .sort((a, b) => b.swing - a.swing)
    .slice(0, 3)
    .map(({ moveNumber, swing }) => ({ moveNumber, swing }));
}

function calculateAccuracy(normalizedCentipawnLosses: number[]): number {
  if (normalizedCentipawnLosses.length === 0) return 100;
  
  const avgLoss = normalizedCentipawnLosses.reduce((a, b) => a + b, 0) / normalizedCentipawnLosses.length;
  const accuracy = Math.max(0, Math.min(100, 100 - (avgLoss / 5)));
  return Math.round(accuracy * 10) / 10;
}

function detectTimeTroubleStart(
  thinkingTimes: number[],
  clockTimes: number[],
  timeControl: number | null
): number | null {
  if (!timeControl || thinkingTimes.length === 0) return null;
  
  const totalTimeMs = timeControl * 1000;
  const timeTroubleThreshold = totalTimeMs * 0.1;
  
  for (let i = 0; i < clockTimes.length; i++) {
    if (clockTimes[i] <= timeTroubleThreshold) {
      return Math.floor(i / 2) + 1;
    }
  }
  
  return null;
}

function detectBurnout(centipawnLosses: number[], totalMoves: number): boolean {
  if (totalMoves < 30) return false;
  
  const firstHalf = centipawnLosses.slice(0, Math.floor(centipawnLosses.length / 2));
  const secondHalf = centipawnLosses.slice(Math.floor(centipawnLosses.length / 2));
  
  const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length || 0;
  const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length || 0;
  
  return avgSecond > avgFirst * 1.5;
}

function calculateEfficiencyFactor(thinkingTimes: number[], centipawnLosses: number[]): number {
  if (thinkingTimes.length === 0 || centipawnLosses.length === 0) return 1;
  
  const avgThinkingTime = thinkingTimes.reduce((a, b) => a + b, 0) / thinkingTimes.length;
  const avgLoss = centipawnLosses.reduce((a, b) => a + b, 0) / centipawnLosses.length;
  
  if (avgLoss === 0) return 1;
  return Math.min(2, Math.max(0, 1 - (avgLoss / 100) + (avgThinkingTime / 30000)));
}

function calculateFocusCheckScore(
  centipawnLosses: number[],
  moveAnalyses: MoveAnalysisResult[]
): number {
  if (centipawnLosses.length < 10) return 1;
  
  let focusBreaks = 0;
  for (let i = 1; i < centipawnLosses.length; i++) {
    if (centipawnLosses[i] > 100 && centipawnLosses[i - 1] < 30) {
      focusBreaks++;
    }
  }
  
  return Math.max(0, 1 - (focusBreaks / centipawnLosses.length) * 5);
}

function detectVSSMismatch(moveAnalyses: MoveAnalysisResult[]): number[] {
  const alerts: number[] = [];
  
  for (let i = 1; i < moveAnalyses.length; i++) {
    const prevEval = moveAnalyses[i - 1].normalizedEvalAfter;
    const currLoss = moveAnalyses[i].normalizedCentipawnLoss;
    
    if (Math.abs(prevEval) > 2 && currLoss > 100) {
      alerts.push(i);
    }
  }
  
  return alerts;
}

function generateImprovementSuggestions(
  classifications: MoveClassification[],
  phases: GamePhase[],
  timeTroubleStart: number | null,
  burnoutDetected: boolean
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
  
  if (timeTroubleStart) {
    suggestions.push(`Work on time management - you entered time trouble around move ${timeTroubleStart}`);
  }
  
  if (burnoutDetected) {
    suggestions.push('Your play quality decreased in the later stages - practice longer games to build endurance');
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

export async function analyzeGame(gameId: string, userId: string): Promise<GameAnalysis | null> {
  const existingAnalysis = await storage.getGameAnalysis(gameId);
  if (existingAnalysis && existingAnalysis.status === 'completed') {
    return existingAnalysis;
  }

  const game = await storage.getGame(gameId);
  if (!game || !game.moves || game.moves.length === 0) {
    console.error('Game not found or has no moves:', gameId);
    return null;
  }

  analysisQueue.set(gameId, {
    gameId,
    currentMove: 0,
    totalMoves: game.moves.length,
    status: 'processing'
  });

  try {
    const analysisRecord = await storage.createGameAnalysis({
      gameId,
      userId,
      status: 'processing',
    });

    const moveResults = await stockfishService.analyzeGame(game.moves as string[]);
    
    const chess = new Chess();
    const classifications: MoveClassification[] = [];
    const phases: GamePhase[] = [];
    const whiteNormalizedCPL: number[] = [];
    const blackNormalizedCPL: number[] = [];
    
    for (let i = 0; i < moveResults.length; i++) {
      const result = moveResults[i];
      const prevResult = i > 0 ? moveResults[i - 1] : null;
      
      const isForced = isMoveForcedPosition(chess);
      const preMoveFen = chess.fen();
      chess.move(result.move);
      
      const isSacrifice = detectSacrifice(result, prevResult, preMoveFen);
      const evalSwing = (result.normalizedEvalAfter - result.normalizedEvalBefore) * 100;
      const isCheckmate = chess.isCheckmate();
      const deliversMate = isCheckmate || (result.isMateAfter && result.mateInAfter !== undefined && result.mateInAfter >= 0);
      
      const adjustedCentipawnLoss = isCheckmate ? 0 : result.centipawnLoss;
      const adjustedNormalizedCPL = isCheckmate ? 0 : result.normalizedCentipawnLoss;
      
      const classificationContext: ClassificationContext = {
        centipawnLoss: adjustedCentipawnLoss,
        normalizedCentipawnLoss: adjustedNormalizedCPL,
        isBestMove: result.isBestMove,
        isForced,
        isSacrifice,
        evalSwing,
        deliversMate,
        evalAfter: result.normalizedEvalAfter,
      };
      
      const classification = classifyMove(classificationContext);
      const phase = determineGamePhase(chess, result.moveNumber);
      
      classifications.push(classification);
      phases.push(phase);
      
      if (result.color === 'white') {
        whiteNormalizedCPL.push(adjustedNormalizedCPL);
      } else {
        blackNormalizedCPL.push(adjustedNormalizedCPL);
      }

      const thinkingTime = game.thinkingTimes?.[i] || null;
      const clockTime = game.clockTimes?.[i] || null;

      await storage.createMoveAnalysis({
        gameAnalysisId: analysisRecord.id,
        moveNumber: result.moveNumber,
        color: result.color,
        move: result.move,
        fen: result.fen,
        evalBefore: result.normalizedEvalBefore,
        evalAfter: result.normalizedEvalAfter,
        bestMove: result.bestMove,
        bestMoveEval: result.bestMoveEval,
        centipawnLoss: adjustedNormalizedCPL,
        classification,
        phase,
        thinkingTime,
        clockTime,
        isCriticalMoment: false,
        principalVariation: result.principalVariation,
      });

      analysisQueue.set(gameId, {
        ...analysisQueue.get(gameId)!,
        currentMove: i + 1
      });
    }

    const criticalMoments = detectCriticalMoments(moveResults);
    const biggestSwings = findBiggestSwings(moveResults);
    const whiteAccuracy = calculateAccuracy(whiteNormalizedCPL);
    const blackAccuracy = calculateAccuracy(blackNormalizedCPL);
    
    const openingCPL = moveResults
      .filter((_, i) => phases[i] === 'opening')
      .map(r => r.normalizedCentipawnLoss);
    const middlegameCPL = moveResults
      .filter((_, i) => phases[i] === 'middlegame')
      .map(r => r.normalizedCentipawnLoss);
    const endgameCPL = moveResults
      .filter((_, i) => phases[i] === 'endgame')
      .map(r => r.normalizedCentipawnLoss);

    const timeTroubleStart = detectTimeTroubleStart(
      game.thinkingTimes as number[] || [],
      game.clockTimes as number[] || [],
      game.timeControl
    );
    
    const burnoutDetected = detectBurnout(
      moveResults.map(r => r.normalizedCentipawnLoss),
      moveResults.length
    );

    const efficiencyFactor = calculateEfficiencyFactor(
      game.thinkingTimes as number[] || [],
      moveResults.map(r => r.normalizedCentipawnLoss)
    );

    const focusCheckScore = calculateFocusCheckScore(
      moveResults.map(r => r.normalizedCentipawnLoss),
      moveResults
    );

    const vssMismatchAlerts = detectVSSMismatch(moveResults);

    const improvementSuggestions = generateImprovementSuggestions(
      classifications,
      phases,
      timeTroubleStart,
      burnoutDetected
    );

    const updatedAnalysis = await storage.updateGameAnalysis(analysisRecord.id, {
      status: 'completed',
      whiteAccuracy,
      blackAccuracy,
      openingAccuracy: calculateAccuracy(openingCPL),
      middlegameAccuracy: calculateAccuracy(middlegameCPL),
      endgameAccuracy: calculateAccuracy(endgameCPL),
      totalCentipawnLoss: moveResults.reduce((a, b) => a + b.normalizedCentipawnLoss, 0),
      averageCentipawnLoss: moveResults.reduce((a, b) => a + b.normalizedCentipawnLoss, 0) / moveResults.length,
      criticalMoments,
      biggestSwings,
      timeTroubleStartMove: timeTroubleStart,
      burnoutDetected,
      focusCheckScore,
      efficiencyFactor,
      vssMismatchAlerts,
      improvementSuggestions,
      analyzedAt: new Date(),
    });

    analysisQueue.set(gameId, {
      ...analysisQueue.get(gameId)!,
      status: 'completed'
    });

    await storage.recordAccuracyHistory(
      userId,
      gameId,
      game.playerColor === 'white' ? whiteAccuracy : blackAccuracy,
      game.ratingChange || undefined,
      game.mode
    );

    return updatedAnalysis;
  } catch (error) {
    console.error('Error analyzing game:', error);
    analysisQueue.set(gameId, {
      ...analysisQueue.get(gameId)!,
      status: 'failed'
    });
    
    const existingRecord = await storage.getGameAnalysis(gameId);
    if (existingRecord) {
      await storage.updateGameAnalysis(existingRecord.id, { status: 'failed' });
    }
    
    return null;
  }
}

export function getAnalysisProgress(gameId: string): AnalysisProgress | null {
  return analysisQueue.get(gameId) || null;
}

export async function generateShareLink(gameAnalysisId: string, userId: string): Promise<string> {
  const shareCode = generateShareCode();
  await storage.createSharedAnalysis({
    shareCode,
    gameAnalysisId,
    createdById: userId,
  });
  return shareCode;
}

function generateShareCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function getAnalysisByShareCode(shareCode: string) {
  const shared = await storage.getSharedAnalysisByCode(shareCode);
  if (!shared) return null;
  
  await storage.incrementShareViewCount(shared.id);
  
  const analysis = await storage.getGameAnalysisById(shared.gameAnalysisId);
  if (!analysis) return null;
  
  const moves = await storage.getMoveAnalyses(analysis.id);
  const game = await storage.getGame(analysis.gameId);
  
  return { analysis, moves, game };
}
