// Game statistics tracking with localStorage persistence

export interface GameStats {
  wins: number;
  draws: number;
  losses: number;
  lastGamePeekTime: number; // in milliseconds
  totalPeekTime: number; // cumulative total in milliseconds
  gamesWithPeeks: number; // number of games where peeks were used (for average calculation)
  bestPeekFreeStreak: number; // personal best consecutive moves without peeking
  lastGamePeekFreeStreak: number; // streak from last game
  lastGameAvgResponseTime: number; // average response time in ms from last game
  totalResponseTime: number; // cumulative response time
  totalResponseMoves: number; // number of moves tracked for response time
  bestClarityScore: number; // best board reconstruction score (0-100)
  lastClarityScore: number; // last game's clarity score
}

export interface BlindfoldSettings {
  boardReconstructionEnabled: boolean;
}

const STATS_KEY = 'blindfold-chess-stats';
const SETTINGS_KEY = 'blindfold-chess-settings';

const DEFAULT_STATS: GameStats = {
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
};

const DEFAULT_SETTINGS: BlindfoldSettings = {
  boardReconstructionEnabled: false,
};

export function loadStats(): GameStats {
  try {
    const saved = localStorage.getItem(STATS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...DEFAULT_STATS, ...parsed };
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

export interface GameResultData {
  result: 'win' | 'loss' | 'draw';
  peekTimeMs: number;
  peekFreeStreak: number;
  responseTimes: number[]; // array of response times in ms
  clarityScore?: number; // 0-100, optional if reconstruction wasn't done
}

export function recordGameResult(
  result: 'win' | 'loss' | 'draw',
  peekTimeMs: number,
  peekFreeStreak: number = 0,
  responseTimes: number[] = [],
  clarityScore?: number
): GameStats {
  const stats = loadStats();
  
  if (result === 'win') {
    stats.wins++;
  } else if (result === 'loss') {
    stats.losses++;
  } else {
    stats.draws++;
  }
  
  stats.lastGamePeekTime = peekTimeMs;
  
  if (peekTimeMs > 0) {
    stats.totalPeekTime += peekTimeMs;
    stats.gamesWithPeeks++;
  }
  
  // Peek-free streak
  stats.lastGamePeekFreeStreak = peekFreeStreak;
  if (peekFreeStreak > stats.bestPeekFreeStreak) {
    stats.bestPeekFreeStreak = peekFreeStreak;
  }
  
  // Response time tracking
  if (responseTimes.length > 0) {
    const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    stats.lastGameAvgResponseTime = avgResponseTime;
    stats.totalResponseTime += responseTimes.reduce((a, b) => a + b, 0);
    stats.totalResponseMoves += responseTimes.length;
  } else {
    stats.lastGameAvgResponseTime = 0;
  }
  
  // Clarity score (board reconstruction)
  if (clarityScore !== undefined) {
    stats.lastClarityScore = clarityScore;
    if (clarityScore > stats.bestClarityScore) {
      stats.bestClarityScore = clarityScore;
    }
  }
  
  saveStats(stats);
  return stats;
}

export function getAverageResponseTime(stats: GameStats): number {
  if (stats.totalResponseMoves === 0) return 0;
  return stats.totalResponseTime / stats.totalResponseMoves;
}

export function getAveragePeekTime(stats: GameStats): number {
  if (stats.gamesWithPeeks === 0) return 0;
  return stats.totalPeekTime / stats.gamesWithPeeks;
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

export function resetStats(): void {
  saveStats({ ...DEFAULT_STATS });
}
