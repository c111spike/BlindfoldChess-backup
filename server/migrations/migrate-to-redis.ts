import { Redis } from '@upstash/redis';
import { db } from '../db';
import { positionCache } from '@shared/schema';
import { createHash } from 'crypto';

const CACHE_TTL_DAYS = 30;
const CACHE_TTL_SECONDS = CACHE_TTL_DAYS * 24 * 60 * 60;
const CACHE_PREFIX = 'pos:';
const BATCH_SIZE = 100;

function normalizeFenForCache(fen: string): string {
  const parts = fen.split(' ');
  if (parts.length < 4) return fen;
  return `${parts[0]} ${parts[1]} ${parts[2]} ${parts[3]}`;
}

function hashFen(fen: string): string {
  const normalizedFen = normalizeFenForCache(fen);
  return createHash('sha256').update(normalizedFen).digest('hex');
}

async function migrateToRedis() {
  console.log('[Migration] Starting PostgreSQL → Redis migration...');
  
  let url = process.env.UPSTASH_REDIS_REST_URL;
  let token = process.env.UPSTASH_REDIS_REST_TOKEN;
  
  if (!url || !token) {
    console.error('[Migration] Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN');
    process.exit(1);
  }
  
  if (!url.startsWith('https://') && token.startsWith('https://')) {
    console.log('[Migration] Detected swapped credentials, auto-correcting...');
    const temp = url;
    url = token;
    token = temp;
  }
  
  const redis = new Redis({ url, token });
  
  try {
    await redis.ping();
    console.log('[Migration] Connected to Redis');
  } catch (error) {
    console.error('[Migration] Failed to connect to Redis:', error);
    process.exit(1);
  }
  
  const allPositions = await db.select().from(positionCache);
  console.log(`[Migration] Found ${allPositions.length} positions to migrate`);
  
  if (allPositions.length === 0) {
    console.log('[Migration] No positions to migrate');
    return;
  }
  
  let migrated = 0;
  let skipped = 0;
  let failed = 0;
  
  for (let i = 0; i < allPositions.length; i += BATCH_SIZE) {
    const batch = allPositions.slice(i, i + BATCH_SIZE);
    const pipeline = redis.pipeline();
    
    for (const pos of batch) {
      const fenHash = hashFen(pos.fen);
      const key = `${CACHE_PREFIX}${fenHash}`;
      
      const data = {
        evaluation: pos.evaluation,
        bestMove: pos.bestMove,
        bestMoveEval: pos.bestMoveEval,
        principalVariation: pos.principalVariation || [],
        depth: pos.depth,
        isMate: pos.isMate || false,
        mateIn: pos.mateIn ?? undefined,
        nodes: pos.nodes,
        hitCount: pos.hitCount || 0,
      };
      
      pipeline.set(key, data, { ex: CACHE_TTL_SECONDS });
    }
    
    try {
      const results = await pipeline.exec();
      const successCount = results.filter(r => r === 'OK').length;
      migrated += successCount;
      failed += batch.length - successCount;
      
      console.log(`[Migration] Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${successCount}/${batch.length} positions migrated`);
    } catch (error) {
      console.error(`[Migration] Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, error);
      failed += batch.length;
    }
  }
  
  console.log(`[Migration] Complete!`);
  console.log(`  - Migrated: ${migrated}`);
  console.log(`  - Skipped: ${skipped}`);
  console.log(`  - Failed: ${failed}`);
  
  const stats = await redis.dbsize();
  console.log(`  - Total Redis keys: ${stats}`);
}

migrateToRedis().catch(console.error);
