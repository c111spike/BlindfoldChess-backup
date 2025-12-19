import { createHash } from 'crypto';
import { db } from '../db';
import { positionCache } from '@shared/schema';
import { eq, inArray } from 'drizzle-orm';

function normalizeFenForCache(fen: string): string {
  const parts = fen.split(' ');
  if (parts.length < 4) return fen;
  return `${parts[0]} ${parts[1]} ${parts[2]} ${parts[3]}`;
}

function hashFen(fen: string): string {
  const normalizedFen = normalizeFenForCache(fen);
  return createHash('sha256').update(normalizedFen).digest('hex');
}

async function rehashPositionCache() {
  console.log('[Migration] Starting position cache rehash with deduplication...');
  
  try {
    const allPositions = await db.select().from(positionCache);
    console.log(`[Migration] Found ${allPositions.length} cached positions to process`);
    
    const hashGroups = new Map<string, typeof allPositions>();
    
    for (const position of allPositions) {
      const newHash = hashFen(position.fen);
      if (!hashGroups.has(newHash)) {
        hashGroups.set(newHash, []);
      }
      hashGroups.get(newHash)!.push(position);
    }
    
    let updated = 0;
    let deleted = 0;
    let skipped = 0;
    
    for (const [newHash, positions] of hashGroups) {
      positions.sort((a, b) => b.nodes - a.nodes);
      const keeper = positions[0];
      const duplicates = positions.slice(1);
      
      if (duplicates.length > 0) {
        const duplicateIds = duplicates.map(p => p.id);
        await db
          .delete(positionCache)
          .where(inArray(positionCache.id, duplicateIds));
        deleted += duplicates.length;
        console.log(`[Migration] Merged ${duplicates.length + 1} entries for same position (kept ${keeper.nodes} nodes)`);
      }
      
      if (keeper.fenHash !== newHash) {
        await db
          .update(positionCache)
          .set({ fenHash: newHash })
          .where(eq(positionCache.id, keeper.id));
        updated++;
      } else {
        skipped++;
      }
    }
    
    console.log(`[Migration] Complete: ${updated} rehashed, ${deleted} duplicates removed, ${skipped} already correct`);
    console.log(`[Migration] Final cache size: ${hashGroups.size} unique positions`);
    return { updated, deleted, skipped, uniquePositions: hashGroups.size };
  } catch (error) {
    console.error('[Migration] Error during rehash:', error);
    throw error;
  }
}

rehashPositionCache()
  .then((result) => {
    console.log('[Migration] Success:', result);
    process.exit(0);
  })
  .catch((error) => {
    console.error('[Migration] Failed:', error);
    process.exit(1);
  });
