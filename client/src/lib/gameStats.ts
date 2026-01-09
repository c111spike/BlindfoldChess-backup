// Game statistics tracking with localStorage persistence
// Comprehensive metrics for visualization, cognitive performance, and tactical tracking

import { ALL_ELOS } from '@shared/botTypes';

// All 12 Elo tiers
export const ELO_TIERS: number[] = ALL_ELOS;

// Per-tier statistics
export interface TierStats {
  wins: number;
  losses: number;
  draws: number;
  peekFreeWins: number; // Wins without any peeks
  totalPeeks: number; // Number of games where peeks were used
  totalGames: number;
}

// Clarity score buckets by move count
export interface ClarityByMoveCount {
  moves10: { total: number; count: number }; // Games with ≤10 moves
  moves20: { total: number; count: number }; // Games with 11-20 moves
  moves30: { total: number; count: number }; // Games with 21-30 moves
  moves40: { total: number; count: number }; // Games with 31-40 moves
  moves50plus: { total: number; count: number }; // Games with 40+ moves
}

// Response time tracking by game phase
export interface ResponseTimeByPhase {
  opening: { total: number; count: number }; // First 10 moves
  middlegame: { total: number; count: number }; // Moves 11-30
  endgame: { total: number; count: number }; // Moves 31+
}

// Square inquiry heatmap - tracks which squares users ask about most
export type SquareInquiryHeatmap = Partial<Record<string, number>>;

// Board zones for pattern detection
export const BOARD_ZONES = {
  kingsideCornerWhite: ['f1', 'g1', 'h1', 'f2', 'g2', 'h2'],
  queensideCornerWhite: ['a1', 'b1', 'c1', 'a2', 'b2', 'c2'],
  kingsideCornerBlack: ['f8', 'g8', 'h8', 'f7', 'g7', 'h7'],
  queensideCornerBlack: ['a8', 'b8', 'c8', 'a7', 'b7', 'c7'],
  center: ['d4', 'e4', 'd5', 'e5'],
  extendedCenter: ['c3', 'd3', 'e3', 'f3', 'c4', 'f4', 'c5', 'f5', 'c6', 'd6', 'e6', 'f6'],
  kingside: ['f1', 'g1', 'h1', 'f2', 'g2', 'h2', 'f3', 'g3', 'h3', 'f4', 'g4', 'h4', 
             'f5', 'g5', 'h5', 'f6', 'g6', 'h6', 'f7', 'g7', 'h7', 'f8', 'g8', 'h8'],
  queenside: ['a1', 'b1', 'c1', 'a2', 'b2', 'c2', 'a3', 'b3', 'c3', 'a4', 'b4', 'c4',
              'a5', 'b5', 'c5', 'a6', 'b6', 'c6', 'a7', 'b7', 'c7', 'a8', 'b8', 'c8'],
  corners: ['a1', 'h1', 'a8', 'h8'],
} as const;

export type BoardZone = keyof typeof BOARD_ZONES;

// Complete game statistics interface
export interface GameStats {
  // Legacy global stats (kept for backwards compatibility)
  wins: number;
  draws: number;
  losses: number;
  lastGamePeekTime: number;
  totalPeekTime: number;
  gamesWithPeeks: number;
  bestPeekFreeStreak: number;
  lastGamePeekFreeStreak: number;
  lastGameAvgResponseTime: number;
  totalResponseTime: number;
  totalResponseMoves: number;
  bestClarityScore: number;
  lastClarityScore: number;
  lastVoicePurity: number;
  bestVoicePurity: number;
  
  // ============================================
  // 1. VISUALIZATION & MEMORY METRICS
  // ============================================
  
  // Per-Elo statistics (12 levels: 400, 600, 800, etc.)
  tierStats: Partial<Record<number, TierStats>>;
  
  // Visualization Ceiling: Highest Elo beaten without peeking
  visualizationCeiling: number; // Elo value (0 if never achieved)
  visualizationCeilingElo: number | null;
  
  // Clarity by move count (degradation tracking)
  clarityByMoveCount: ClarityByMoveCount;
  
  // Peek-free percentage overall
  totalPeekFreeGames: number;
  totalGamesPlayed: number;
  
  // Voice vs Touch ratio for reconstruction
  reconstructionVoiceInputs: number;
  reconstructionTouchInputs: number;
  
  // Voice vs Touch ratio for game moves
  gameVoiceMoves: number;
  gameTouchMoves: number;
  
  // ============================================
  // 2. COGNITIVE PERFORMANCE METRICS
  // ============================================
  
  // Mean Response Time tracking by phase
  responseTimeByPhase: ResponseTimeByPhase;
  
  // Endgame drift detection (last game)
  lastGameEndgameDrift: number; // % slower in endgame vs opening (0 = no drift)
  
  // Voice command corrections
  voiceCorrections: number; // Total voice command corrections
  voiceCommandsTotal: number; // Total voice commands issued
  lastGameVoiceCorrections: number;
  
  // Mental blur detection (response time spikes)
  mentalBlurCount: number; // Times response time exceeded 2x average
  
  // ============================================
  // 3. TACTICAL & SKILL METRICS
  // ============================================
  
  // Square inquiry heatmap (confusion tracking)
  squareInquiryHeatmap: SquareInquiryHeatmap;
  totalSquareInquiries: number;
  
  // Stockfish threshold Elo (where win rate drops below 50%)
  stockfishThresholdElo: number | null;
  
  // Personal bests
  longestGame: number; // Most moves in a game
  fastestWin: number; // Fewest moves to win
  
  // Streak tracking
  currentWinStreak: number;
  bestWinStreak: number;
  currentPeekFreeStreak: number; // Consecutive games without peeking
  bestPeekFreeGameStreak: number;
  
  // Blindfold vs standard game tracking
  blindfoldGamesPlayed: number;
  
  // Assisted games tracking (used eval or voice peek)
  assistedGamesCount: number; // Games where user used "evaluate" or "show board" voice commands
  lastGameWasAssisted: boolean; // Whether last game used assistance
}

export interface BlindfoldSettings {
  boardReconstructionEnabled: boolean;
  botThinkingTimeEnabled: boolean;
  keepAwakeEnabled: boolean;
}

const STATS_KEY = 'blindfold-chess-stats-v2';
const SETTINGS_KEY = 'blindfold-chess-settings';
const LEGACY_STATS_KEY = 'blindfold-chess-stats';

const DEFAULT_CLARITY_BY_MOVE_COUNT: ClarityByMoveCount = {
  moves10: { total: 0, count: 0 },
  moves20: { total: 0, count: 0 },
  moves30: { total: 0, count: 0 },
  moves40: { total: 0, count: 0 },
  moves50plus: { total: 0, count: 0 },
};

const DEFAULT_RESPONSE_BY_PHASE: ResponseTimeByPhase = {
  opening: { total: 0, count: 0 },
  middlegame: { total: 0, count: 0 },
  endgame: { total: 0, count: 0 },
};

const DEFAULT_STATS: GameStats = {
  // Legacy fields
  wins: 0,
  draws: 0,
  losses: 0,
  lastGamePeekTime: 0,
  totalPeekTime: 0,
  gamesWithPeeks: 0,
  bestPeekFreeStreak: 0,
  lastGamePeekFreeStreak: 0,
  lastGameAvgResponseTime: 0,
  totalResponseTime: 0,
  totalResponseMoves: 0,
  bestClarityScore: 0,
  lastClarityScore: 0,
  lastVoicePurity: 0,
  bestVoicePurity: 0,
  
  // Visualization metrics
  tierStats: {},
  visualizationCeiling: 0,
  visualizationCeilingElo: null,
  clarityByMoveCount: { ...DEFAULT_CLARITY_BY_MOVE_COUNT },
  totalPeekFreeGames: 0,
  totalGamesPlayed: 0,
  reconstructionVoiceInputs: 0,
  reconstructionTouchInputs: 0,
  gameVoiceMoves: 0,
  gameTouchMoves: 0,
  
  // Cognitive metrics
  responseTimeByPhase: { ...DEFAULT_RESPONSE_BY_PHASE },
  lastGameEndgameDrift: 0,
  voiceCorrections: 0,
  voiceCommandsTotal: 0,
  lastGameVoiceCorrections: 0,
  mentalBlurCount: 0,
  
  // Tactical metrics
  squareInquiryHeatmap: {},
  totalSquareInquiries: 0,
  stockfishThresholdElo: null,
  longestGame: 0,
  fastestWin: 0,
  currentWinStreak: 0,
  bestWinStreak: 0,
  currentPeekFreeStreak: 0,
  bestPeekFreeGameStreak: 0,
  blindfoldGamesPlayed: 0,
  assistedGamesCount: 0,
  lastGameWasAssisted: false,
};

const DEFAULT_SETTINGS: BlindfoldSettings = {
  boardReconstructionEnabled: false,
  botThinkingTimeEnabled: false,
  keepAwakeEnabled: true,
};

// Helper to deep merge stats with defaults
function deepMergeStats(saved: Partial<GameStats>): GameStats {
  const result = { ...DEFAULT_STATS, ...saved };
  
  // Ensure nested objects have all fields
  result.clarityByMoveCount = {
    ...DEFAULT_CLARITY_BY_MOVE_COUNT,
    ...(saved.clarityByMoveCount || {}),
  };
  result.responseTimeByPhase = {
    ...DEFAULT_RESPONSE_BY_PHASE,
    ...(saved.responseTimeByPhase || {}),
  };
  result.tierStats = saved.tierStats || {};
  result.squareInquiryHeatmap = saved.squareInquiryHeatmap || {};
  
  return result;
}

export function loadStats(): GameStats {
  try {
    // Try new stats key first
    const saved = localStorage.getItem(STATS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return deepMergeStats(parsed);
    }
    
    // Migrate from legacy stats if available
    const legacy = localStorage.getItem(LEGACY_STATS_KEY);
    if (legacy) {
      const parsed = JSON.parse(legacy);
      const migrated = deepMergeStats(parsed);
      saveStats(migrated); // Save to new key
      return migrated;
    }
  } catch (e) {
    console.error('Failed to load stats:', e);
  }
  return { ...DEFAULT_STATS };
}

export function saveStats(stats: GameStats): void {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch (e) {
    console.error('Failed to save stats:', e);
  }
}

export function loadSettings(): BlindfoldSettings {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch (e) {
    console.error('Failed to load settings:', e);
  }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(settings: BlindfoldSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
}

// Extended game result data
export interface GameResultData {
  result: 'win' | 'loss' | 'draw';
  botElo: number;
  peekTimeMs: number;
  peekFreeStreak: number;
  wasPeekFree: boolean; // True if no peeks used all game
  responseTimes: number[]; // Array of response times per move
  clarityScore?: number;
  voicePurity?: number;
  totalMoves: number;
  voiceCorrections: number; // Voice command corrections
  voiceCommands: number; // Total voice commands
  reconstructionVoiceInputs: number; // Voice inputs during reconstruction
  reconstructionTouchInputs: number; // Touch inputs during reconstruction
  gameVoiceMoves: number; // Voice moves during game
  gameTouchMoves: number; // Touch/click moves during game
  squareInquiries: string[]; // Squares inquired about during game
  isBlindfold: boolean; // Whether this was a blindfold game
  wasAssisted: boolean; // Whether user used "evaluate" or "show board" voice commands
}

// Calculate which move count bucket a game falls into
function getMoveCountBucket(moves: number): keyof ClarityByMoveCount {
  if (moves <= 10) return 'moves10';
  if (moves <= 20) return 'moves20';
  if (moves <= 30) return 'moves30';
  if (moves <= 40) return 'moves40';
  return 'moves50plus';
}

// Calculate response times by game phase
function categorizeResponseTimes(
  responseTimes: number[]
): { opening: number[]; middlegame: number[]; endgame: number[] } {
  return {
    opening: responseTimes.slice(0, 10),
    middlegame: responseTimes.slice(10, 30),
    endgame: responseTimes.slice(30),
  };
}

// Calculate endgame drift (% slower in endgame vs opening)
function calculateEndgameDrift(responseTimes: number[]): number {
  const phases = categorizeResponseTimes(responseTimes);
  
  if (phases.opening.length === 0 || phases.endgame.length === 0) return 0;
  
  const avgOpening = phases.opening.reduce((a, b) => a + b, 0) / phases.opening.length;
  const avgEndgame = phases.endgame.reduce((a, b) => a + b, 0) / phases.endgame.length;
  
  if (avgOpening === 0) return 0;
  
  const drift = ((avgEndgame - avgOpening) / avgOpening) * 100;
  return Math.max(0, Math.round(drift)); // Only positive drift (slower)
}

// Count mental blur events (response time > 2x average)
function countMentalBlurs(responseTimes: number[]): number {
  if (responseTimes.length < 3) return 0;
  
  const avg = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
  const threshold = avg * 2;
  
  return responseTimes.filter(t => t > threshold).length;
}

// Calculate Stockfish threshold (lowest Elo where win rate < 50%)
function calculateStockfishThreshold(tierStats: Partial<Record<number, TierStats>>): number | null {
  for (const elo of ELO_TIERS) {
    const stats = tierStats[elo];
    if (!stats || stats.totalGames < 3) continue; // Need at least 3 games
    
    const winRate = stats.wins / stats.totalGames;
    if (winRate < 0.5) {
      return elo;
    }
  }
  return null;
}

// Calculate visualization ceiling (highest Elo beaten peek-free)
function calculateVisualizationCeiling(
  tierStats: Partial<Record<number, TierStats>>
): { elo: number } {
  let highestElo = 0;
  
  for (const elo of ELO_TIERS) {
    const stats = tierStats[elo];
    if (stats && stats.peekFreeWins > 0) {
      if (elo > highestElo) {
        highestElo = elo;
      }
    }
  }
  
  return { elo: highestElo };
}

// Main function to record a game result with all metrics
export function recordGameResult(
  result: 'win' | 'loss' | 'draw',
  peekTimeMs: number,
  peekFreeStreak: number = 0,
  responseTimes: number[] = [],
  clarityScore?: number,
  voicePurity?: number,
  extendedData?: Partial<GameResultData>
): GameStats {
  const stats = loadStats();
  
  // Extract extended data with defaults
  const botElo = extendedData?.botElo || 1200;
  const wasPeekFree = extendedData?.wasPeekFree ?? (peekTimeMs === 0);
  const totalMoves = extendedData?.totalMoves || responseTimes.length;
  const voiceCorrections = extendedData?.voiceCorrections || 0;
  const voiceCommands = extendedData?.voiceCommands || 0;
  const reconstructionVoice = extendedData?.reconstructionVoiceInputs || 0;
  const reconstructionTouch = extendedData?.reconstructionTouchInputs || 0;
  const gameVoice = extendedData?.gameVoiceMoves || 0;
  const gameTouch = extendedData?.gameTouchMoves || 0;
  const squareInquiries = extendedData?.squareInquiries || [];
  const isBlindfold = extendedData?.isBlindfold ?? false;
  const wasAssisted = extendedData?.wasAssisted ?? false;
  
  // Legacy global stats
  if (result === 'win') {
    stats.wins++;
  } else if (result === 'loss') {
    stats.losses++;
  } else {
    stats.draws++;
  }
  
  stats.totalGamesPlayed++;
  
  // Track blindfold games separately
  if (isBlindfold) {
    stats.blindfoldGamesPlayed++;
    stats.lastGamePeekTime = peekTimeMs;
    
    if (peekTimeMs > 0) {
      stats.totalPeekTime += peekTimeMs;
      stats.gamesWithPeeks++;
    }
    
    if (wasPeekFree) {
      stats.totalPeekFreeGames++;
      stats.currentPeekFreeStreak++;
      if (stats.currentPeekFreeStreak > stats.bestPeekFreeGameStreak) {
        stats.bestPeekFreeGameStreak = stats.currentPeekFreeStreak;
      }
    } else {
      stats.currentPeekFreeStreak = 0;
    }
    
    // Peek-free move streak
    stats.lastGamePeekFreeStreak = peekFreeStreak;
    if (peekFreeStreak > stats.bestPeekFreeStreak) {
      stats.bestPeekFreeStreak = peekFreeStreak;
    }
  } else {
    // Standard game - reset last-game blindfold fields so UI knows this wasn't blindfold
    stats.lastGamePeekTime = 0;
    stats.lastGamePeekFreeStreak = 0;
    // Reset peek-free game streak since playing a standard game breaks the blindfold streak
    stats.currentPeekFreeStreak = 0;
  }
  
  // ============================================
  // Per-Elo statistics
  // ============================================
  if (!stats.tierStats[botElo]) {
    stats.tierStats[botElo] = {
      wins: 0,
      losses: 0,
      draws: 0,
      peekFreeWins: 0,
      totalPeeks: 0,
      totalGames: 0,
    };
  }
  
  const tierStat = stats.tierStats[botElo]!;
  tierStat.totalGames++;
  
  if (result === 'win') {
    tierStat.wins++;
    if (isBlindfold && wasPeekFree) {
      tierStat.peekFreeWins++;
    }
    
    // Win streak
    stats.currentWinStreak++;
    if (stats.currentWinStreak > stats.bestWinStreak) {
      stats.bestWinStreak = stats.currentWinStreak;
    }
    
    // Fastest win
    if (stats.fastestWin === 0 || totalMoves < stats.fastestWin) {
      stats.fastestWin = totalMoves;
    }
  } else if (result === 'loss') {
    tierStat.losses++;
    stats.currentWinStreak = 0;
  } else {
    tierStat.draws++;
  }
  
  if (isBlindfold && !wasPeekFree) {
    tierStat.totalPeeks++;
  }
  
  // Longest game
  if (totalMoves > stats.longestGame) {
    stats.longestGame = totalMoves;
  }
  
  // ============================================
  // Visualization Ceiling
  // ============================================
  const ceiling = calculateVisualizationCeiling(stats.tierStats);
  stats.visualizationCeiling = ceiling.elo;
  stats.visualizationCeilingElo = ceiling.elo || null;
  
  // ============================================
  // Stockfish Threshold
  // ============================================
  stats.stockfishThresholdElo = calculateStockfishThreshold(stats.tierStats);
  
  // ============================================
  // Response time tracking
  // ============================================
  if (responseTimes.length > 0) {
    const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    stats.lastGameAvgResponseTime = avgResponseTime;
    stats.totalResponseTime += responseTimes.reduce((a, b) => a + b, 0);
    stats.totalResponseMoves += responseTimes.length;
    
    // Phase-based response times
    const phases = categorizeResponseTimes(responseTimes);
    
    if (phases.opening.length > 0) {
      stats.responseTimeByPhase.opening.total += phases.opening.reduce((a, b) => a + b, 0);
      stats.responseTimeByPhase.opening.count += phases.opening.length;
    }
    if (phases.middlegame.length > 0) {
      stats.responseTimeByPhase.middlegame.total += phases.middlegame.reduce((a, b) => a + b, 0);
      stats.responseTimeByPhase.middlegame.count += phases.middlegame.length;
    }
    if (phases.endgame.length > 0) {
      stats.responseTimeByPhase.endgame.total += phases.endgame.reduce((a, b) => a + b, 0);
      stats.responseTimeByPhase.endgame.count += phases.endgame.length;
    }
    
    // Endgame drift
    stats.lastGameEndgameDrift = calculateEndgameDrift(responseTimes);
    
    // Mental blur detection
    stats.mentalBlurCount += countMentalBlurs(responseTimes);
  } else {
    stats.lastGameAvgResponseTime = 0;
    stats.lastGameEndgameDrift = 0;
  }
  
  // ============================================
  // Assisted game tracking (voice peek or evaluate)
  // ============================================
  stats.lastGameWasAssisted = wasAssisted;
  if (wasAssisted) {
    stats.assistedGamesCount++;
  }
  
  // ============================================
  // Clarity score by move count
  // ============================================
  if (clarityScore !== undefined) {
    // Cap clarity score at 50% for assisted games (used eval or voice peek)
    const adjustedClarityScore = wasAssisted ? Math.min(clarityScore, 50) : clarityScore;
    
    stats.lastClarityScore = adjustedClarityScore;
    if (adjustedClarityScore > stats.bestClarityScore) {
      stats.bestClarityScore = adjustedClarityScore;
    }
    
    // Add to appropriate bucket
    const bucket = getMoveCountBucket(totalMoves);
    stats.clarityByMoveCount[bucket].total += adjustedClarityScore;
    stats.clarityByMoveCount[bucket].count++;
  }
  
  // ============================================
  // Voice purity and corrections
  // ============================================
  if (voicePurity !== undefined) {
    stats.lastVoicePurity = voicePurity;
    if (voicePurity > stats.bestVoicePurity) {
      stats.bestVoicePurity = voicePurity;
    }
  }
  
  stats.voiceCorrections += voiceCorrections;
  stats.voiceCommandsTotal += voiceCommands;
  stats.lastGameVoiceCorrections = voiceCorrections;
  
  stats.reconstructionVoiceInputs += reconstructionVoice;
  stats.reconstructionTouchInputs += reconstructionTouch;
  stats.gameVoiceMoves += gameVoice;
  stats.gameTouchMoves += gameTouch;
  
  // ============================================
  // Square inquiry heatmap tracking
  // ============================================
  if (squareInquiries.length > 0) {
    stats.totalSquareInquiries += squareInquiries.length;
    for (const square of squareInquiries) {
      const normalizedSquare = square.toLowerCase();
      stats.squareInquiryHeatmap[normalizedSquare] = 
        (stats.squareInquiryHeatmap[normalizedSquare] || 0) + 1;
    }
  }
  
  saveStats(stats);
  return stats;
}

// ============================================
// DERIVED METRICS & INSIGHTS
// ============================================

export function getAverageResponseTime(stats: GameStats): number {
  if (stats.totalResponseMoves === 0) return 0;
  return stats.totalResponseTime / stats.totalResponseMoves;
}

export function getAveragePeekTime(stats: GameStats): number {
  if (stats.gamesWithPeeks === 0) return 0;
  return stats.totalPeekTime / stats.gamesWithPeeks;
}

export function getPeekFreePercentage(stats: GameStats): number {
  // Only calculate percentage based on blindfold games
  const blindfoldGames = stats.blindfoldGamesPlayed || 0;
  if (blindfoldGames === 0) return 0;
  return Math.round((stats.totalPeekFreeGames / blindfoldGames) * 100);
}

export function getVoiceTouchRatio(stats: GameStats): { voice: number; touch: number } {
  const total = stats.gameVoiceMoves + stats.gameTouchMoves;
  if (total === 0) return { voice: 0, touch: 0 };
  
  return {
    voice: Math.round((stats.gameVoiceMoves / total) * 100),
    touch: Math.round((stats.gameTouchMoves / total) * 100),
  };
}

export function getAverageResponseByPhase(stats: GameStats): {
  opening: number;
  middlegame: number;
  endgame: number;
} {
  const o = stats.responseTimeByPhase.opening;
  const m = stats.responseTimeByPhase.middlegame;
  const e = stats.responseTimeByPhase.endgame;
  
  return {
    opening: o.count > 0 ? Math.round(o.total / o.count) : 0,
    middlegame: m.count > 0 ? Math.round(m.total / m.count) : 0,
    endgame: e.count > 0 ? Math.round(e.total / e.count) : 0,
  };
}

export function getClarityByMoveCount(stats: GameStats): {
  moves10: number;
  moves20: number;
  moves30: number;
  moves40: number;
  moves50plus: number;
} {
  const c = stats.clarityByMoveCount;
  return {
    moves10: c.moves10.count > 0 ? Math.round(c.moves10.total / c.moves10.count) : 0,
    moves20: c.moves20.count > 0 ? Math.round(c.moves20.total / c.moves20.count) : 0,
    moves30: c.moves30.count > 0 ? Math.round(c.moves30.total / c.moves30.count) : 0,
    moves40: c.moves40.count > 0 ? Math.round(c.moves40.total / c.moves40.count) : 0,
    moves50plus: c.moves50plus.count > 0 ? Math.round(c.moves50plus.total / c.moves50plus.count) : 0,
  };
}

export function getVoiceCorrectionRate(stats: GameStats): number {
  if (stats.voiceCommandsTotal === 0) return 0;
  return Math.round((stats.voiceCorrections / stats.voiceCommandsTotal) * 100);
}

// Get zone inquiry counts from heatmap
export function getZoneInquiries(stats: GameStats): Record<BoardZone, number> {
  const result: Record<BoardZone, number> = {
    kingsideCornerWhite: 0,
    queensideCornerWhite: 0,
    kingsideCornerBlack: 0,
    queensideCornerBlack: 0,
    center: 0,
    extendedCenter: 0,
    kingside: 0,
    queenside: 0,
    corners: 0,
  };
  
  for (const [square, count] of Object.entries(stats.squareInquiryHeatmap)) {
    for (const [zoneName, squares] of Object.entries(BOARD_ZONES)) {
      if ((squares as readonly string[]).includes(square)) {
        result[zoneName as BoardZone] += count || 0;
      }
    }
  }
  
  return result;
}

// Get top confused squares (most inquired)
export function getTopConfusedSquares(stats: GameStats, limit: number = 5): { square: string; count: number }[] {
  return Object.entries(stats.squareInquiryHeatmap)
    .map(([square, count]) => ({ square, count: count || 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

// Get heatmap intensity for a square (0-100 scale)
export function getSquareHeatIntensity(stats: GameStats, square: string): number {
  if (stats.totalSquareInquiries === 0) return 0;
  const count = stats.squareInquiryHeatmap[square.toLowerCase()] || 0;
  const maxCount = Math.max(...Object.values(stats.squareInquiryHeatmap).map(c => c || 0), 1);
  return Math.round((count / maxCount) * 100);
}

export function getEloWinRate(stats: GameStats, elo: number): number {
  const tierStat = stats.tierStats[elo];
  if (!tierStat || tierStat.totalGames === 0) return 0;
  return Math.round((tierStat.wins / tierStat.totalGames) * 100);
}

export function formatPeekTime(ms: number): string {
  if (ms === 0) return '0s';
  
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }
  
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
}

export function formatResponseTime(ms: number): string {
  if (ms === 0) return '-';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function resetStats(): void {
  saveStats({ ...DEFAULT_STATS });
}

// ============================================
// INSIGHTS GENERATION
// ============================================

export interface Insight {
  type: 'info' | 'warning' | 'success' | 'tip';
  category: 'visualization' | 'cognitive' | 'tactical';
  title: string;
  message: string;
}

export function generateInsights(stats: GameStats): Insight[] {
  const insights: Insight[] = [];
  
  // Visualization insights
  const clarity = getClarityByMoveCount(stats);
  if (clarity.moves20 > 0 && clarity.moves40 > 0) {
    const degradation = clarity.moves20 - clarity.moves40;
    if (degradation > 20) {
      insights.push({
        type: 'warning',
        category: 'visualization',
        title: 'Clarity Degradation',
        message: `Your accuracy drops from ${clarity.moves20}% at 20 moves to ${clarity.moves40}% at 40 moves. Focus on endgame visualization training.`,
      });
    }
  }
  
  if (stats.visualizationCeiling > 0) {
    insights.push({
      type: 'success',
      category: 'visualization',
      title: 'Visualization Ceiling',
      message: `You've beaten a ${stats.visualizationCeiling} Elo bot without peeking! Keep pushing higher.`,
    });
  }
  
  const peekFree = getPeekFreePercentage(stats);
  if (peekFree > 50) {
    insights.push({
      type: 'success',
      category: 'visualization',
      title: 'Peek-Free Progress',
      message: `${peekFree}% of your games are peek-free. Your visualization is improving!`,
    });
  }
  
  // Cognitive insights
  const phaseResponse = getAverageResponseByPhase(stats);
  if (phaseResponse.endgame > 0 && phaseResponse.opening > 0) {
    const drift = ((phaseResponse.endgame - phaseResponse.opening) / phaseResponse.opening) * 100;
    if (drift > 50) {
      insights.push({
        type: 'warning',
        category: 'cognitive',
        title: 'Endgame Drift Detected',
        message: `Your endgame response time is ${Math.round(drift)}% slower than opening. The open board may be causing "mental blur."`,
      });
    }
  }
  
  const correctionRate = getVoiceCorrectionRate(stats);
  if (correctionRate > 20) {
    insights.push({
      type: 'tip',
      category: 'cognitive',
      title: 'Voice Accuracy',
      message: `You correct ${correctionRate}% of voice commands. Try speaking more slowly or using full square names.`,
    });
  }
  
  // Tactical insights
  if (stats.stockfishThresholdElo) {
    insights.push({
      type: 'info',
      category: 'tactical',
      title: 'Stockfish Threshold',
      message: `Your win rate drops below 50% at ${stats.stockfishThresholdElo} Elo. Focus training at this level.`,
    });
  }
  
  // Zone-based confusion insights
  const zoneInquiries = getZoneInquiries(stats);
  const topConfused = getTopConfusedSquares(stats, 3);
  
  if (topConfused.length > 0 && topConfused[0].count >= 3) {
    const confusedSquares = topConfused.map(s => s.square.toUpperCase()).join(', ');
    insights.push({
      type: 'warning',
      category: 'tactical',
      title: 'Board Blind Spots',
      message: `You frequently lose track of: ${confusedSquares}. Focus on visualizing these squares.`,
    });
  }
  
  // Check for kingside vs queenside weakness
  const kingsideTotal = zoneInquiries.kingside;
  const queensideTotal = zoneInquiries.queenside;
  if (kingsideTotal > queensideTotal * 2 && kingsideTotal >= 5) {
    insights.push({
      type: 'tip',
      category: 'tactical',
      title: 'Kingside Visualization',
      message: 'Your mental image of the kingside is weaker. Practice visualizing the f, g, and h files.',
    });
  } else if (queensideTotal > kingsideTotal * 2 && queensideTotal >= 5) {
    insights.push({
      type: 'tip',
      category: 'tactical',
      title: 'Queenside Visualization',
      message: 'Your mental image of the queenside is weaker. Practice visualizing the a, b, and c files.',
    });
  }
  
  // Corner weakness detection
  if (zoneInquiries.corners >= 4) {
    insights.push({
      type: 'tip',
      category: 'visualization',
      title: 'Corner Awareness',
      message: 'Your mental board is blurry in the corners (a1, h1, a8, h8). These squares need more focus.',
    });
  }
  
  return insights;
}
