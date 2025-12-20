import { createHash } from 'crypto';
import { db } from './db';
import { positionCache, analysisMetrics } from '@shared/schema';
import { eq, sql, desc, and, gte } from 'drizzle-orm';
import type { InsertPositionCache, PositionCache } from '@shared/schema';
import { redisCache } from './redisCache';

interface QueuedAnalysis {
  id: string;
  gameId: string;
  userId: string;
  priority: number;
  queuedAt: Date;
  startedAt?: Date;
}

interface PerformanceMetrics {
  cacheHits: number;
  cacheMisses: number;
  totalLookupTimeMs: number;
  analysesCompleted: number;
  totalAnalysisTimeMs: number;
  adaptiveScaledowns: number;
  peakQueueLength: number;
  totalNodesUsed: number;
}

interface CachedPosition {
  evaluation: number;
  bestMove: string;
  bestMoveEval: number;
  principalVariation: string[];
  depth: number;
  isMate: boolean;
  mateIn?: number;
}

const DEFAULT_NODES = 2000000;
const MIN_NODES = 1000000;
const QUEUE_HIGH_THRESHOLD = 5;
const QUEUE_CRITICAL_THRESHOLD = 10;

/**
 * Normalize FEN for cache key purposes.
 * Keeps: board position, turn, castling rights, en passant square
 * Removes: half-move clock, full-move number (these don't affect position evaluation)
 * This ensures cache hits for identical positions regardless of move counters.
 */
function normalizeFenForCache(fen: string): string {
  const parts = fen.split(' ');
  if (parts.length < 4) return fen;
  // Return: position + turn + castling rights + en passant (ignoring move counters)
  return `${parts[0]} ${parts[1]} ${parts[2]} ${parts[3]}`;
}

class AnalysisQueueManager {
  private queue: QueuedAnalysis[] = [];
  private activeAnalyses: Map<string, QueuedAnalysis> = new Map();
  private metrics: PerformanceMetrics = {
    cacheHits: 0,
    cacheMisses: 0,
    totalLookupTimeMs: 0,
    analysesCompleted: 0,
    totalAnalysisTimeMs: 0,
    adaptiveScaledowns: 0,
    peakQueueLength: 0,
    totalNodesUsed: 0,
  };
  private sessionStartTime: Date = new Date();
  private lastMetricsSave: Date = new Date();
  private cacheSize: number = 0;

  private useRedis: boolean = false;

  async init(): Promise<void> {
    this.useRedis = await redisCache.init();
    
    if (this.useRedis) {
      const stats = await redisCache.getCacheStats();
      this.cacheSize = stats.keyCount;
      console.log(`[AnalysisQueue] Initialized with Redis (${this.cacheSize} cached positions)`);
    } else {
      try {
        const result = await db
          .select({ count: sql<number>`count(*)` })
          .from(positionCache);
        this.cacheSize = result[0]?.count || 0;
        console.log(`[AnalysisQueue] Initialized with PostgreSQL fallback (${this.cacheSize} cached positions)`);
      } catch (error) {
        console.error('[AnalysisQueue] Failed to get cache size:', error);
      }
    }
  }

  private hashFen(fen: string): string {
    // Use normalized FEN for cache key to improve hit rate
    const normalizedFen = normalizeFenForCache(fen);
    return createHash('sha256').update(normalizedFen).digest('hex');
  }

  async getCachedPosition(fen: string, minNodes: number = MIN_NODES): Promise<CachedPosition | null> {
    const startTime = Date.now();
    const fenHash = this.hashFen(fen);
    
    if (this.useRedis) {
      try {
        const cached = await redisCache.get(fenHash, minNodes);
        const lookupTime = Date.now() - startTime;
        this.metrics.totalLookupTimeMs += lookupTime;
        
        if (cached) {
          this.metrics.cacheHits++;
          console.log(`[AnalysisQueue] REDIS HIT for position (${lookupTime}ms lookup)`);
          return {
            evaluation: cached.evaluation,
            bestMove: cached.bestMove,
            bestMoveEval: cached.bestMoveEval,
            principalVariation: cached.principalVariation || [],
            depth: cached.depth,
            isMate: cached.isMate || false,
            mateIn: cached.mateIn,
          };
        }
        
        this.metrics.cacheMisses++;
        console.log(`[AnalysisQueue] REDIS MISS for position`);
        return null;
      } catch (error) {
        console.error('[AnalysisQueue] Redis lookup error:', error);
        this.metrics.cacheMisses++;
        return null;
      }
    }
    
    try {
      const cached = await db
        .select()
        .from(positionCache)
        .where(and(
          eq(positionCache.fenHash, fenHash),
          gte(positionCache.nodes, minNodes)
        ))
        .limit(1);
      
      const lookupTime = Date.now() - startTime;
      this.metrics.totalLookupTimeMs += lookupTime;
      
      if (cached.length > 0) {
        this.metrics.cacheHits++;
        console.log(`[AnalysisQueue] PG HIT for position (${lookupTime}ms lookup)`);
        
        await db
          .update(positionCache)
          .set({ 
            hitCount: sql`${positionCache.hitCount} + 1`,
            lastHitAt: new Date()
          })
          .where(eq(positionCache.id, cached[0].id));
        
        return {
          evaluation: cached[0].evaluation,
          bestMove: cached[0].bestMove,
          bestMoveEval: cached[0].bestMoveEval,
          principalVariation: cached[0].principalVariation as string[] || [],
          depth: cached[0].depth,
          isMate: cached[0].isMate || false,
          mateIn: cached[0].mateIn ?? undefined,
        };
      }
      
      this.metrics.cacheMisses++;
      console.log(`[AnalysisQueue] PG MISS for position`);
      return null;
    } catch (error) {
      console.error('[AnalysisQueue] Cache lookup error:', error);
      this.metrics.cacheMisses++;
      return null;
    }
  }

  async cachePosition(fen: string, nodes: number, result: CachedPosition): Promise<void> {
    const fenHash = this.hashFen(fen);
    
    if (this.useRedis) {
      try {
        const success = await redisCache.set(fenHash, {
          evaluation: result.evaluation,
          bestMove: result.bestMove,
          bestMoveEval: result.bestMoveEval,
          principalVariation: result.principalVariation,
          depth: result.depth,
          isMate: result.isMate,
          mateIn: result.mateIn,
          nodes,
          hitCount: 0,
        });
        if (success) {
          this.cacheSize++;
        }
        return;
      } catch (error) {
        console.error('[AnalysisQueue] Redis cache write error:', error);
        return;
      }
    }
    
    try {
      const existing = await db
        .select({ id: positionCache.id, nodes: positionCache.nodes })
        .from(positionCache)
        .where(eq(positionCache.fenHash, fenHash))
        .limit(1);
      
      if (existing.length > 0) {
        if (nodes > existing[0].nodes) {
          await db
            .update(positionCache)
            .set({
              nodes,
              evaluation: result.evaluation,
              bestMove: result.bestMove,
              bestMoveEval: result.bestMoveEval,
              principalVariation: result.principalVariation,
              depth: result.depth,
              isMate: result.isMate,
              mateIn: result.mateIn ?? null,
            })
            .where(eq(positionCache.id, existing[0].id));
        }
      } else {
        await db.insert(positionCache).values({
          fenHash,
          fen,
          nodes,
          evaluation: result.evaluation,
          bestMove: result.bestMove,
          bestMoveEval: result.bestMoveEval,
          principalVariation: result.principalVariation,
          depth: result.depth,
          isMate: result.isMate,
          mateIn: result.mateIn ?? null,
        });
        this.cacheSize++;
      }
    } catch (error) {
      console.error('[AnalysisQueue] Failed to cache position:', error);
    }
  }

  getAdaptiveNodeCount(): number {
    const queueLength = this.queue.length + this.activeAnalyses.size;
    
    if (queueLength >= QUEUE_CRITICAL_THRESHOLD) {
      this.metrics.adaptiveScaledowns++;
      return MIN_NODES;
    }
    
    if (queueLength >= QUEUE_HIGH_THRESHOLD) {
      this.metrics.adaptiveScaledowns++;
      return Math.round((DEFAULT_NODES + MIN_NODES) / 2);
    }
    
    return DEFAULT_NODES;
  }

  enqueue(gameId: string, userId: string, priority: number = 0): string {
    const id = `${gameId}-${Date.now()}`;
    const analysis: QueuedAnalysis = {
      id,
      gameId,
      userId,
      priority,
      queuedAt: new Date(),
    };
    
    this.queue.push(analysis);
    this.queue.sort((a, b) => b.priority - a.priority);
    
    if (this.queue.length > this.metrics.peakQueueLength) {
      this.metrics.peakQueueLength = this.queue.length;
    }
    
    return id;
  }

  dequeue(): QueuedAnalysis | null {
    const analysis = this.queue.shift();
    if (analysis) {
      analysis.startedAt = new Date();
      this.activeAnalyses.set(analysis.id, analysis);
    }
    return analysis || null;
  }

  complete(id: string, durationMs: number, nodesUsed: number): void {
    const analysis = this.activeAnalyses.get(id);
    if (analysis) {
      this.activeAnalyses.delete(id);
      this.metrics.analysesCompleted++;
      this.metrics.totalAnalysisTimeMs += durationMs;
      this.metrics.totalNodesUsed += nodesUsed;
    }
  }

  getQueueStatus(): { 
    queueLength: number; 
    activeCount: number; 
    adaptiveNodes: number;
  } {
    return {
      queueLength: this.queue.length,
      activeCount: this.activeAnalyses.size,
      adaptiveNodes: this.getAdaptiveNodeCount(),
    };
  }

  async getPerformanceStats(): Promise<{
    cacheHitRate: number;
    avgCacheLookupMs: number;
    avgAnalysisTimeMs: number;
    queueLength: number;
    peakQueueLength: number;
    totalCachedPositions: number;
    analysesCompleted: number;
    adaptiveScaledowns: number;
    avgNodesUsed: number;
    currentNodeCount: number;
    gamesAnalyzedToday: number;
    redisConnected: boolean;
  }> {
    const totalLookups = this.metrics.cacheHits + this.metrics.cacheMisses;
    
    // Get Redis cache stats if available
    let redisPositions = 0;
    if (this.useRedis) {
      try {
        const redisStats = await redisCache.getCacheStats();
        redisPositions = redisStats.keyCount;
      } catch (error) {
        console.error('[AnalysisQueue] Failed to get Redis cache stats:', error);
      }
    }
    
    // Also get PostgreSQL fallback cache size
    try {
      const result = await db
        .select({ count: sql<number>`count(*)` })
        .from(positionCache);
      this.cacheSize = result[0]?.count || 0;
    } catch (error) {
      console.error('[AnalysisQueue] Failed to get cache size:', error);
    }

    // Use Redis position count if available, otherwise PostgreSQL
    const totalPositions = this.useRedis ? redisPositions : this.cacheSize;

    return {
      cacheHitRate: totalLookups > 0 
        ? Math.round((this.metrics.cacheHits / totalLookups) * 100) 
        : 0,
      avgCacheLookupMs: totalLookups > 0 
        ? Math.round(this.metrics.totalLookupTimeMs / totalLookups) 
        : 0,
      avgAnalysisTimeMs: this.metrics.analysesCompleted > 0 
        ? Math.round(this.metrics.totalAnalysisTimeMs / this.metrics.analysesCompleted) 
        : 0,
      queueLength: this.queue.length + this.activeAnalyses.size,
      peakQueueLength: this.metrics.peakQueueLength,
      totalCachedPositions: totalPositions,
      analysesCompleted: this.metrics.analysesCompleted,
      adaptiveScaledowns: this.metrics.adaptiveScaledowns,
      avgNodesUsed: this.metrics.analysesCompleted > 0 
        ? Math.round(this.metrics.totalNodesUsed / this.metrics.analysesCompleted) 
        : DEFAULT_NODES,
      currentNodeCount: this.getAdaptiveNodeCount(),
      gamesAnalyzedToday: this.metrics.analysesCompleted,
      redisConnected: this.useRedis,
    };
  }

  async saveMetricsSnapshot(): Promise<void> {
    const now = new Date();
    const totalLookups = this.metrics.cacheHits + this.metrics.cacheMisses;
    
    try {
      await db.insert(analysisMetrics).values({
        metricType: 'hourly_summary',
        cacheHits: this.metrics.cacheHits,
        cacheMisses: this.metrics.cacheMisses,
        cacheSize: this.cacheSize,
        avgCacheLookupMs: totalLookups > 0 
          ? this.metrics.totalLookupTimeMs / totalLookups 
          : null,
        queueLength: this.queue.length,
        peakQueueLength: this.metrics.peakQueueLength,
        avgQueueWaitMs: null,
        analysesCompleted: this.metrics.analysesCompleted,
        avgAnalysisTimeMs: this.metrics.analysesCompleted > 0 
          ? this.metrics.totalAnalysisTimeMs / this.metrics.analysesCompleted 
          : null,
        avgNodesUsed: this.metrics.analysesCompleted > 0 
          ? Math.round(this.metrics.totalNodesUsed / this.metrics.analysesCompleted) 
          : null,
        adaptiveScaledowns: this.metrics.adaptiveScaledowns,
        gamesAnalyzedToday: this.metrics.analysesCompleted,
        periodStart: this.lastMetricsSave,
        periodEnd: now,
      });
      
      this.metrics = {
        cacheHits: 0,
        cacheMisses: 0,
        totalLookupTimeMs: 0,
        analysesCompleted: 0,
        totalAnalysisTimeMs: 0,
        adaptiveScaledowns: 0,
        peakQueueLength: 0,
        totalNodesUsed: 0,
      };
      this.lastMetricsSave = now;
      
      console.log('[AnalysisQueue] Metrics snapshot saved');
    } catch (error) {
      console.error('[AnalysisQueue] Failed to save metrics:', error);
    }
  }

  async getHistoricalMetrics(hours: number = 24): Promise<any[]> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    try {
      const metrics = await db
        .select()
        .from(analysisMetrics)
        .where(gte(analysisMetrics.timestamp, since))
        .orderBy(desc(analysisMetrics.timestamp))
        .limit(100);
      
      return metrics;
    } catch (error) {
      console.error('[AnalysisQueue] Failed to get historical metrics:', error);
      return [];
    }
  }

  // Lightweight cache lookup for bot use - no metric tracking, just fast lookup
  async getPositionEvalForBot(fen: string): Promise<{ evaluation: number; bestMove: string } | null> {
    const fenHash = this.hashFen(fen);
    
    if (this.useRedis) {
      try {
        const cached = await redisCache.get(fenHash, 0);
        if (cached) {
          return {
            evaluation: cached.evaluation,
            bestMove: cached.bestMove,
          };
        }
        return null;
      } catch (error) {
        return null;
      }
    }
    
    try {
      const cached = await db
        .select({
          evaluation: positionCache.evaluation,
          bestMove: positionCache.bestMove,
        })
        .from(positionCache)
        .where(eq(positionCache.fenHash, fenHash))
        .limit(1);
      
      if (cached.length > 0) {
        return {
          evaluation: cached[0].evaluation,
          bestMove: cached[0].bestMove,
        };
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  isUsingRedis(): boolean {
    return this.useRedis;
  }
}

export const analysisQueueManager = new AnalysisQueueManager();
