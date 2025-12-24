/**
 * In-Memory Cache for Hot Data
 * 
 * This provides a simple TTL-based cache for frequently accessed data
 * that doesn't need persistence. Reduces database load for:
 * - Leaderboards (cached for 60 seconds)
 * - Statistics aggregates (cached for 30 seconds)
 * - Online user counts (cached for 10 seconds)
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class MemoryCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Cleanup expired entries every 60 seconds
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  /**
   * Get a cached value, returns undefined if not found or expired
   */
  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    
    return entry.data as T;
  }

  /**
   * Set a value with TTL in seconds
   */
  set<T>(key: string, data: T, ttlSeconds: number): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  /**
   * Get or fetch pattern - returns cached value or calls fetcher
   */
  async getOrFetch<T>(
    key: string, 
    fetcher: () => Promise<T>, 
    ttlSeconds: number
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== undefined) {
      return cached;
    }
    
    const data = await fetcher();
    this.set(key, data, ttlSeconds);
    return data;
  }

  /**
   * Invalidate a specific cache key
   */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Invalidate all keys matching a prefix
   */
  invalidatePrefix(prefix: string): void {
    const keysToDelete = Array.from(this.cache.keys()).filter(key => key.startsWith(prefix));
    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Clear all cached data
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;
    const entries = Array.from(this.cache.entries());
    entries.forEach(([key, entry]) => {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    });
    if (cleaned > 0) {
      console.log(`[MemoryCache] Cleaned up ${cleaned} expired entries`);
    }
  }

  /**
   * Stop the cleanup interval (for graceful shutdown)
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.cache.clear();
  }
}

// Singleton instance
export const memoryCache = new MemoryCache();

// Cache key constants
export const CACHE_KEYS = {
  LEADERBOARD: (mode: string) => `leaderboard:${mode}`,
  BOARD_SPIN_LEADERBOARD: (difficulty: string) => `boardspin:leaderboard:${difficulty}`,
  GAME_STATISTICS: 'stats:games',
  TRAINING_COUNTS: 'stats:training',
  BLINDFOLD_COUNT: 'stats:blindfold',
  ONLINE_USERS: 'online:count',
  PUZZLE_COUNT: 'puzzles:count',
  SIMUL_VS_SIMUL_COUNT: 'simul:count',
};

// TTL constants (in seconds)
export const CACHE_TTL = {
  LEADERBOARD: 60,      // 1 minute for leaderboards
  STATISTICS: 30,       // 30 seconds for aggregate stats
  ONLINE_USERS: 10,     // 10 seconds for online count
  PUZZLE_DATA: 120,     // 2 minutes for puzzle counts
};

/**
 * Centralized cache invalidation helpers
 * Use these to ensure all related caches are cleared together
 */
export const invalidateCaches = {
  /** Call when any puzzle is created, updated, deleted, or its visibility changes */
  puzzles(): void {
    memoryCache.invalidate(CACHE_KEYS.PUZZLE_COUNT);
    memoryCache.invalidate(CACHE_KEYS.TRAINING_COUNTS);
  },
  
  /** Call when any training challenge is completed (Board Spin, N-Piece, Knight's Tour) */
  training(): void {
    memoryCache.invalidate(CACHE_KEYS.TRAINING_COUNTS);
    memoryCache.invalidate(CACHE_KEYS.GAME_STATISTICS);
    memoryCache.invalidatePrefix('boardspin:leaderboard');
  },
  
  /** Call when a game is completed (affects ratings and leaderboards) */
  gameComplete(): void {
    memoryCache.invalidate(CACHE_KEYS.GAME_STATISTICS);
    memoryCache.invalidatePrefix('leaderboard:');
  },
};
