// Game statistics tracking with localStorage persistence

export interface GameStats {
  wins: number;
  draws: number;
  losses: number;
  lastGamePeekTime: number; // in milliseconds
  totalPeekTime: number; // cumulative total in milliseconds
  gamesWithPeeks: number; // number of games where peeks were used (for average calculation)
}

const STATS_KEY = 'blindfold-chess-stats';

const DEFAULT_STATS: GameStats = {
  wins: 0,
  draws: 0,
  losses: 0,
  lastGamePeekTime: 0,
  totalPeekTime: 0,
  gamesWithPeeks: 0,
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

export function recordGameResult(
  result: 'win' | 'loss' | 'draw',
  peekTimeMs: number
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
  
  saveStats(stats);
  return stats;
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
