import { Redis } from '@upstash/redis';

interface CachedPosition {
  evaluation: number;
  bestMove: string;
  bestMoveEval: number;
  principalVariation: string[];
  depth: number;
  isMate: boolean;
  mateIn?: number;
  nodes: number;
  hitCount: number;
}

const CACHE_TTL_DAYS = 30;
const CACHE_TTL_SECONDS = CACHE_TTL_DAYS * 24 * 60 * 60;
const CACHE_PREFIX = 'pos:';

class RedisCache {
  private redis: Redis | null = null;
  private isConnected: boolean = false;
  private connectionAttempted: boolean = false;

  async init(): Promise<boolean> {
    if (this.connectionAttempted) {
      return this.isConnected;
    }
    
    this.connectionAttempted = true;
    
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    
    console.log('[RedisCache] URL starts with:', url?.substring(0, 20));
    console.log('[RedisCache] Token starts with:', token?.substring(0, 10));
    
    if (!url || !token) {
      console.log('[RedisCache] No Upstash credentials found, using PostgreSQL fallback');
      return false;
    }
    
    if (!url.startsWith('https://')) {
      console.error('[RedisCache] URL and Token appear swapped! URL should start with https://');
      console.log('[RedisCache] Attempting to auto-swap...');
      if (token.startsWith('https://')) {
        const tempUrl = token;
        const tempToken = url;
        try {
          this.redis = new Redis({
            url: tempUrl,
            token: tempToken,
          });
          await this.redis.ping();
          this.isConnected = true;
          console.log('[RedisCache] Connected to Upstash Redis (values were swapped)');
          return true;
        } catch (swapError) {
          console.error('[RedisCache] Swap attempt also failed:', swapError);
        }
      }
      return false;
    }
    
    try {
      this.redis = new Redis({
        url,
        token,
      });
      
      await this.redis.ping();
      this.isConnected = true;
      console.log('[RedisCache] Connected to Upstash Redis successfully');
      return true;
    } catch (error) {
      console.error('[RedisCache] Failed to connect to Redis:', error);
      this.redis = null;
      this.isConnected = false;
      return false;
    }
  }

  isAvailable(): boolean {
    return this.isConnected && this.redis !== null;
  }

  private getKey(fenHash: string): string {
    return `${CACHE_PREFIX}${fenHash}`;
  }

  async get(fenHash: string, minNodes: number = 1000000): Promise<CachedPosition | null> {
    if (!this.isAvailable() || !this.redis) {
      return null;
    }

    try {
      const key = this.getKey(fenHash);
      const data = await this.redis.get<CachedPosition>(key);
      
      if (data && data.nodes >= minNodes) {
        await this.redis.hincrby(`${key}:meta`, 'hitCount', 1);
        return data;
      }
      
      return null;
    } catch (error) {
      console.error('[RedisCache] Get error:', error);
      return null;
    }
  }

  async set(fenHash: string, position: CachedPosition): Promise<boolean> {
    if (!this.isAvailable() || !this.redis) {
      return false;
    }

    try {
      const key = this.getKey(fenHash);
      
      const existing = await this.redis.get<CachedPosition>(key);
      if (existing && existing.nodes >= position.nodes) {
        return true;
      }
      
      await this.redis.set(key, position, { ex: CACHE_TTL_SECONDS });
      
      return true;
    } catch (error) {
      console.error('[RedisCache] Set error:', error);
      return false;
    }
  }

  async getCacheStats(): Promise<{ 
    available: boolean; 
    keyCount: number;
    memoryUsageMB: number;
  }> {
    if (!this.isAvailable() || !this.redis) {
      return { available: false, keyCount: 0, memoryUsageMB: 0 };
    }

    try {
      const info = await this.redis.dbsize();
      
      return {
        available: true,
        keyCount: info || 0,
        memoryUsageMB: 0,
      };
    } catch (error) {
      console.error('[RedisCache] Stats error:', error);
      return { available: false, keyCount: 0, memoryUsageMB: 0 };
    }
  }

  async migratePosition(fenHash: string, position: CachedPosition): Promise<boolean> {
    if (!this.isAvailable() || !this.redis) {
      return false;
    }

    try {
      const key = this.getKey(fenHash);
      await this.redis.set(key, position, { ex: CACHE_TTL_SECONDS });
      return true;
    } catch (error) {
      console.error('[RedisCache] Migration error:', error);
      return false;
    }
  }

  async bulkMigrate(positions: Array<{ fenHash: string; position: CachedPosition }>): Promise<{
    success: number;
    failed: number;
  }> {
    if (!this.isAvailable() || !this.redis) {
      return { success: 0, failed: positions.length };
    }

    let success = 0;
    let failed = 0;

    const pipeline = this.redis.pipeline();
    
    for (const { fenHash, position } of positions) {
      const key = this.getKey(fenHash);
      pipeline.set(key, position, { ex: CACHE_TTL_SECONDS });
    }

    try {
      const results = await pipeline.exec();
      success = results.filter(r => r === 'OK').length;
      failed = positions.length - success;
    } catch (error) {
      console.error('[RedisCache] Bulk migration error:', error);
      failed = positions.length;
    }

    return { success, failed };
  }
}

export const redisCache = new RedisCache();
