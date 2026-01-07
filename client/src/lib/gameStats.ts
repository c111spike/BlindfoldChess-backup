// Game statistics tracking with localStorage persistence
// Comprehensive metrics for visualization, cognitive performance, and tactical tracking

import type { BotDifficulty } from '@shared/botTypes';
import { BOT_DIFFICULTY_ELO } from '@shared/botTypes';

// All 12 difficulty tiers
export const DIFFICULTY_TIERS: BotDifficulty[] = [
  'patzer', 'novice', 'intermediate', 'improving', 'club', 'advanced',
  'strong', 'expert', 'master', 'candidate', 'elite', 'grandmaster'
];

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
  
  // Per-tier statistics (12 levels)
  tierStats: Partial<Record<BotDifficulty, TierStats>>;
  
  // Visualization Ceiling: Highest Elo beaten without peeking
  visualizationCeiling: number; // Elo value (0 if never achieved)
  visualizationCeilingTier: BotDifficulty | null;
  
  // Clarity by move count (degradation tracking)
  clarityByMoveCount: ClarityByMoveCount;
  
  // Peek-free percentage overall
  totalPeekFreeGames: number;
  totalGamesPlayed: number;
  
  // Voice vs Touch ratio for reconstruction
  reconstructionVoiceInputs: number;
  reconstructionTouchInputs: number;
  
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
  
  // Opening book depth tracking
  totalBookMoves: number; // Total moves made while in book
  totalBookGames: number; // Games where book was used
  deepestBookLine: number; // Deepest we've stayed in book
  lastGameBookMoves: number; // How many moves in book last game
  
  // Stockfish threshold (where win rate drops below 50%)
  stockfishThreshold: BotDifficulty | null;
  
  // Personal bests
  longestGame: number; // Most moves in a game
  fastestWin: number; // Fewest moves to win
  
  // Streak tracking
  currentWinStreak: number;
  bestWinStreak: number;
  currentPeekFreeStreak: number; // Consecutive games without peeking
  bestPeekFreeGameStreak: number;
}

export interface BlindfoldSettings {
  boardReconstructionEnabled: boolean;
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
  visualizationCeilingTier: null,
  clarityByMoveCount: { ...DEFAULT_CLARITY_BY_MOVE_COUNT },
  totalPeekFreeGames: 0,
  totalGamesPlayed: 0,
  reconstructionVoiceInputs: 0,
  reconstructionTouchInputs: 0,
  
  // Cognitive metrics
  responseTimeByPhase: { ...DEFAULT_RESPONSE_BY_PHASE },
  lastGameEndgameDrift: 0,
  voiceCorrections: 0,
  voiceCommandsTotal: 0,
  lastGameVoiceCorrections: 0,
  mentalBlurCount: 0,
  
  // Tactical metrics
  totalBookMoves: 0,
  totalBookGames: 0,
  deepestBookLine: 0,
  lastGameBookMoves: 0,
  stockfishThreshold: null,
  longestGame: 0,
  fastestWin: 0,
  currentWinStreak: 0,
  bestWinStreak: 0,
  currentPeekFreeStreak: 0,
  bestPeekFreeGameStreak: 0,
};

const DEFAULT_SETTINGS: BlindfoldSettings = {
  boardReconstructionEnabled: false,
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
  difficulty: BotDifficulty;
  peekTimeMs: number;
  peekFreeStreak: number;
  wasPeekFree: boolean; // True if no peeks used all game
  responseTimes: number[]; // Array of response times per move
  clarityScore?: number;
  voicePurity?: number;
  totalMoves: number;
  bookMoves: number; // Moves that were in opening book
  voiceCorrections: number; // Voice command corrections
  voiceCommands: number; // Total voice commands
  reconstructionVoiceInputs: number; // Voice inputs during reconstruction
  reconstructionTouchInputs: number; // Touch inputs during reconstruction
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

// Calculate Stockfish threshold (lowest tier where win rate < 50%)
function calculateStockfishThreshold(tierStats: Partial<Record<BotDifficulty, TierStats>>): BotDifficulty | null {
  for (const tier of DIFFICULTY_TIERS) {
    const stats = tierStats[tier];
    if (!stats || stats.totalGames < 3) continue; // Need at least 3 games
    
    const winRate = stats.wins / stats.totalGames;
    if (winRate < 0.5) {
      return tier;
    }
  }
  return null;
}

// Calculate visualization ceiling (highest Elo beaten peek-free)
function calculateVisualizationCeiling(
  tierStats: Partial<Record<BotDifficulty, TierStats>>
): { elo: number; tier: BotDifficulty | null } {
  let highestElo = 0;
  let highestTier: BotDifficulty | null = null;
  
  for (const tier of DIFFICULTY_TIERS) {
    const stats = tierStats[tier];
    if (stats && stats.peekFreeWins > 0) {
      const elo = BOT_DIFFICULTY_ELO[tier];
      if (elo > highestElo) {
        highestElo = elo;
        highestTier = tier;
      }
    }
  }
  
  return { elo: highestElo, tier: highestTier };
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
  const difficulty = extendedData?.difficulty || 'club';
  const wasPeekFree = extendedData?.wasPeekFree ?? (peekTimeMs === 0);
  const totalMoves = extendedData?.totalMoves || responseTimes.length;
  const bookMoves = extendedData?.bookMoves || 0;
  const voiceCorrections = extendedData?.voiceCorrections || 0;
  const voiceCommands = extendedData?.voiceCommands || 0;
  const reconstructionVoice = extendedData?.reconstructionVoiceInputs || 0;
  const reconstructionTouch = extendedData?.reconstructionTouchInputs || 0;
  
  // Legacy global stats
  if (result === 'win') {
    stats.wins++;
  } else if (result === 'loss') {
    stats.losses++;
  } else {
    stats.draws++;
  }
  
  stats.lastGamePeekTime = peekTimeMs;
  stats.totalGamesPlayed++;
  
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
  
  // ============================================
  // Per-tier statistics
  // ============================================
  if (!stats.tierStats[difficulty]) {
    stats.tierStats[difficulty] = {
      wins: 0,
      losses: 0,
      draws: 0,
      peekFreeWins: 0,
      totalPeeks: 0,
      totalGames: 0,
    };
  }
  
  const tierStat = stats.tierStats[difficulty]!;
  tierStat.totalGames++;
  
  if (result === 'win') {
    tierStat.wins++;
    if (wasPeekFree) {
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
  
  if (!wasPeekFree) {
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
  stats.visualizationCeilingTier = ceiling.tier;
  
  // ============================================
  // Stockfish Threshold
  // ============================================
  stats.stockfishThreshold = calculateStockfishThreshold(stats.tierStats);
  
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
  // Clarity score by move count
  // ============================================
  if (clarityScore !== undefined) {
    stats.lastClarityScore = clarityScore;
    if (clarityScore > stats.bestClarityScore) {
      stats.bestClarityScore = clarityScore;
    }
    
    // Add to appropriate bucket
    const bucket = getMoveCountBucket(totalMoves);
    stats.clarityByMoveCount[bucket].total += clarityScore;
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
  
  // ============================================
  // Opening book tracking
  // ============================================
  if (bookMoves > 0) {
    stats.totalBookMoves += bookMoves;
    stats.totalBookGames++;
    stats.lastGameBookMoves = bookMoves;
    if (bookMoves > stats.deepestBookLine) {
      stats.deepestBookLine = bookMoves;
    }
  } else {
    stats.lastGameBookMoves = 0;
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
  if (stats.totalGamesPlayed === 0) return 0;
  return Math.round((stats.totalPeekFreeGames / stats.totalGamesPlayed) * 100);
}

export function getVoiceTouchRatio(stats: GameStats): { voice: number; touch: number } {
  const total = stats.reconstructionVoiceInputs + stats.reconstructionTouchInputs;
  if (total === 0) return { voice: 0, touch: 0 };
  
  return {
    voice: Math.round((stats.reconstructionVoiceInputs / total) * 100),
    touch: Math.round((stats.reconstructionTouchInputs / total) * 100),
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

export function getAverageBookDepth(stats: GameStats): number {
  if (stats.totalBookGames === 0) return 0;
  return Math.round(stats.totalBookMoves / stats.totalBookGames);
}

export function getTierWinRate(stats: GameStats, tier: BotDifficulty): number {
  const tierStat = stats.tierStats[tier];
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
  if (stats.stockfishThreshold) {
    const thresholdElo = BOT_DIFFICULTY_ELO[stats.stockfishThreshold];
    insights.push({
      type: 'info',
      category: 'tactical',
      title: 'Stockfish Threshold',
      message: `Your win rate drops below 50% at ${thresholdElo} Elo (${stats.stockfishThreshold}). Focus training at this level.`,
    });
  }
  
  const avgBookDepth = getAverageBookDepth(stats);
  if (avgBookDepth > 0) {
    insights.push({
      type: 'info',
      category: 'tactical',
      title: 'Opening Mastery',
      message: `You average ${avgBookDepth} moves in book. Deepest line: ${stats.deepestBookLine} moves.`,
    });
  }
  
  return insights;
}
