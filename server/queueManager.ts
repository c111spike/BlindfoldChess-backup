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
  private queues: Map<TimeControl, QueueEntry[]>;
  private userToQueue: Map<string, TimeControl>;

  constructor() {
    this.queues = new Map([
      ['bullet', []],
      ['blitz', []],
      ['rapid', []],
      ['classical', []],
    ]);
    this.userToQueue = new Map();
  }

  join(userId: string, socketId: string, timeControl: TimeControl, rating: number): MatchResult | null {
    if (this.userToQueue.has(userId)) {
      const existingQueue = this.userToQueue.get(userId)!;
      this.leave(userId);
    }

    const entry: QueueEntry = {
      userId,
      socketId,
      timeControl,
      rating,
      enqueuedAt: new Date(),
    };

    const queue = this.queues.get(timeControl)!;
    queue.push(entry);
    this.userToQueue.set(userId, timeControl);

    if (queue.length >= 2) {
      const player1 = queue.shift()!;
      const player2 = queue.shift()!;
      
      this.userToQueue.delete(player1.userId);
      this.userToQueue.delete(player2.userId);

      return { player1, player2 };
    }

    return null;
  }

  leave(userId: string): boolean {
    const timeControl = this.userToQueue.get(userId);
    if (!timeControl) {
      return false;
    }

    const queue = this.queues.get(timeControl)!;
    const index = queue.findIndex(entry => entry.userId === userId);
    
    if (index !== -1) {
      queue.splice(index, 1);
      this.userToQueue.delete(userId);
      return true;
    }

    return false;
  }

  removeBySocketId(socketId: string): void {
    for (const [timeControl, queue] of Array.from(this.queues.entries())) {
      const index = queue.findIndex((entry: QueueEntry) => entry.socketId === socketId);
      if (index !== -1) {
        const entry = queue[index];
        queue.splice(index, 1);
        this.userToQueue.delete(entry.userId);
        break;
      }
    }
  }

  getStatus(userId: string): { inQueue: boolean; timeControl?: TimeControl; position?: number } {
    const timeControl = this.userToQueue.get(userId);
    if (!timeControl) {
      return { inQueue: false };
    }

    const queue = this.queues.get(timeControl)!;
    const position = queue.findIndex(entry => entry.userId === userId) + 1;

    return {
      inQueue: true,
      timeControl,
      position,
    };
  }

  getQueueCounts(): Record<TimeControl, number> {
    return {
      bullet: this.queues.get('bullet')!.length,
      blitz: this.queues.get('blitz')!.length,
      rapid: this.queues.get('rapid')!.length,
      classical: this.queues.get('classical')!.length,
    };
  }

  cleanStaleEntries(maxAge: number = 5 * 60 * 1000): number {
    let cleaned = 0;
    const now = new Date();

    for (const [timeControl, queue] of Array.from(this.queues.entries())) {
      const originalLength = queue.length;
      
      const validEntries = queue.filter((entry: QueueEntry) => {
        const age = now.getTime() - entry.enqueuedAt.getTime();
        const isValid = age < maxAge;
        
        if (!isValid) {
          this.userToQueue.delete(entry.userId);
        }
        
        return isValid;
      });

      this.queues.set(timeControl, validEntries);
      cleaned += originalLength - validEntries.length;
    }

    return cleaned;
  }
}

export function createQueueManager() {
  console.log('[DEBUG] Creating new QueueManager instance');
  const queueManager = new QueueManager();
  
  const cleanupHandle = setInterval(() => {
    const cleaned = queueManager.cleanStaleEntries();
    if (cleaned > 0) {
      console.log(`[QueueManager] Cleaned ${cleaned} stale queue entries`);
    }
  }, 30000);

  return { queueManager, cleanupHandle };
}
