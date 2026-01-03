import {
  addToMatchmakingQueue,
  removeFromMatchmakingQueue,
  getMatchmakingQueueEntries,
  popMatchFromQueue,
  getQueueCounts as getRedisQueueCounts,
  cleanStaleQueueEntries,
  redisHealthCheck,
} from './redis';
import { getServerId } from './wsManager';

type TimeControl = 'bullet' | 'blitz' | 'rapid' | 'classical';

interface QueueEntry {
  userId: string;
  socketId: string;
  timeControl: TimeControl;
  rating: number;
  enqueuedAt: Date;
}

interface MatchResult {
  player1: QueueEntry;
  player2: QueueEntry;
}

class QueueManager {
  private localQueues: Map<TimeControl, QueueEntry[]>;
  private userToQueue: Map<string, TimeControl>;
  private useRedis: boolean = false;

  constructor() {
    this.localQueues = new Map([
      ['bullet', []],
      ['blitz', []],
      ['rapid', []],
      ['classical', []],
    ]);
    this.userToQueue = new Map();
    
    this.initRedis();
  }

  private async initRedis(): Promise<void> {
    try {
      this.useRedis = await redisHealthCheck();
      if (this.useRedis) {
        console.log('[QueueManager] Redis mode enabled');
      } else {
        console.log('[QueueManager] Using local memory mode');
      }
    } catch {
      this.useRedis = false;
      console.log('[QueueManager] Redis unavailable, using local memory');
    }
  }

  async join(userId: string, socketId: string, timeControl: TimeControl, rating: number): Promise<MatchResult | null> {
    if (this.userToQueue.has(userId)) {
      await this.leave(userId);
    }

    const entry: QueueEntry = {
      userId,
      socketId,
      timeControl,
      rating,
      enqueuedAt: new Date(),
    };

    this.userToQueue.set(userId, timeControl);

    if (this.useRedis) {
      try {
        await addToMatchmakingQueue(timeControl, {
          userId,
          socketId,
          rating,
          serverId: getServerId(),
          enqueuedAt: entry.enqueuedAt.getTime(),
        });

        const match = await popMatchFromQueue(timeControl, 300);
        if (match) {
          this.userToQueue.delete(match.player1.userId);
          this.userToQueue.delete(match.player2.userId);
          
          return {
            player1: {
              userId: match.player1.userId,
              socketId: match.player1.socketId,
              timeControl,
              rating: match.player1.rating,
              enqueuedAt: new Date(match.player1.enqueuedAt),
            },
            player2: {
              userId: match.player2.userId,
              socketId: match.player2.socketId,
              timeControl,
              rating: match.player2.rating,
              enqueuedAt: new Date(match.player2.enqueuedAt),
            },
          };
        }
        return null;
      } catch (error) {
        console.error('[QueueManager] Redis error, falling back to local:', error);
        this.useRedis = false;
      }
    }

    const queue = this.localQueues.get(timeControl)!;
    queue.push(entry);

    if (queue.length >= 2) {
      const player1 = queue.shift()!;
      const player2 = queue.shift()!;
      
      this.userToQueue.delete(player1.userId);
      this.userToQueue.delete(player2.userId);

      return { player1, player2 };
    }

    return null;
  }

  async leave(userId: string): Promise<boolean> {
    const timeControl = this.userToQueue.get(userId);
    if (!timeControl) {
      return false;
    }

    this.userToQueue.delete(userId);

    if (this.useRedis) {
      try {
        return await removeFromMatchmakingQueue(timeControl, userId);
      } catch (error) {
        console.error('[QueueManager] Redis leave error:', error);
      }
    }

    const queue = this.localQueues.get(timeControl)!;
    const index = queue.findIndex(entry => entry.userId === userId);
    
    if (index !== -1) {
      queue.splice(index, 1);
      return true;
    }

    return false;
  }

  async removeBySocketId(socketId: string): Promise<void> {
    for (const [timeControl, queue] of Array.from(this.localQueues.entries())) {
      const index = queue.findIndex((entry: QueueEntry) => entry.socketId === socketId);
      if (index !== -1) {
        const entry = queue[index];
        queue.splice(index, 1);
        this.userToQueue.delete(entry.userId);
        
        if (this.useRedis) {
          try {
            await removeFromMatchmakingQueue(timeControl, entry.userId);
          } catch (error) {
            console.error('[QueueManager] Redis removeBySocketId error:', error);
          }
        }
        break;
      }
    }
  }

  getStatus(userId: string): { inQueue: boolean; timeControl?: TimeControl; position?: number } {
    const timeControl = this.userToQueue.get(userId);
    if (!timeControl) {
      return { inQueue: false };
    }

    const queue = this.localQueues.get(timeControl)!;
    const position = queue.findIndex(entry => entry.userId === userId) + 1;

    return {
      inQueue: true,
      timeControl,
      position: position > 0 ? position : 1,
    };
  }

  async getQueueCounts(): Promise<Record<TimeControl, number>> {
    if (this.useRedis) {
      try {
        const counts = await getRedisQueueCounts();
        return counts as Record<TimeControl, number>;
      } catch (error) {
        console.error('[QueueManager] Redis getQueueCounts error:', error);
      }
    }

    return {
      bullet: this.localQueues.get('bullet')!.length,
      blitz: this.localQueues.get('blitz')!.length,
      rapid: this.localQueues.get('rapid')!.length,
      classical: this.localQueues.get('classical')!.length,
    };
  }

  async cleanStaleEntries(maxAge: number = 5 * 60 * 1000): Promise<number> {
    let cleaned = 0;

    if (this.useRedis) {
      try {
        cleaned = await cleanStaleQueueEntries(maxAge);
        if (cleaned > 0) {
          console.log(`[QueueManager] Redis cleaned ${cleaned} stale entries`);
        }
        return cleaned;
      } catch (error) {
        console.error('[QueueManager] Redis cleanStaleEntries error:', error);
      }
    }

    const now = new Date();

    for (const [timeControl, queue] of Array.from(this.localQueues.entries())) {
      const originalLength = queue.length;
      
      const validEntries = queue.filter((entry: QueueEntry) => {
        const age = now.getTime() - entry.enqueuedAt.getTime();
        const isValid = age < maxAge;
        
        if (!isValid) {
          this.userToQueue.delete(entry.userId);
        }
        
        return isValid;
      });

      this.localQueues.set(timeControl, validEntries);
      cleaned += originalLength - validEntries.length;
    }

    return cleaned;
  }

  isUsingRedis(): boolean {
    return this.useRedis;
  }
}

export function createQueueManager() {
  console.log('[DEBUG] Creating new QueueManager instance');
  const queueManager = new QueueManager();
  
  const cleanupHandle = setInterval(async () => {
    const cleaned = await queueManager.cleanStaleEntries();
    if (cleaned > 0) {
      console.log(`[QueueManager] Cleaned ${cleaned} stale queue entries`);
    }
  }, 30000);

  return { queueManager, cleanupHandle };
}
