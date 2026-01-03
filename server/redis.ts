import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export const REDIS_KEYS = {
  userConnection: (userId: string) => `ws:user:${userId}`,
  matchRoom: (matchId: string) => `ws:match:${matchId}`,
  simulMatchRoom: (matchId: string) => `ws:simul:${matchId}`,
  onlineUsers: 'ws:online',
  matchState: (matchId: string) => `game:state:${matchId}`,
  matchHandshake: (matchId: string) => `game:handshake:${matchId}`,
  postGameHandshake: (matchId: string) => `game:posthandshake:${matchId}`,
  disconnectTimer: (userId: string) => `ws:disconnect:${userId}`,
  pubsubChannel: (matchId: string) => `channel:match:${matchId}`,
  simulPubsubChannel: (matchId: string) => `channel:simul:${matchId}`,
};

export const REDIS_TTL = {
  CONNECTION: 60 * 60,
  MATCH_STATE: 60 * 60 * 2,
  HANDSHAKE: 60 * 5,
  DISCONNECT: 60,
};

export async function redisHealthCheck(): Promise<boolean> {
  try {
    const result = await redis.ping();
    return result === 'PONG';
  } catch (error) {
    console.error('[Redis] Health check failed:', error);
    return false;
  }
}

export async function addUserOnline(userId: string, serverId: string): Promise<void> {
  await redis.hset(REDIS_KEYS.onlineUsers, { [userId]: serverId });
}

export async function removeUserOnline(userId: string): Promise<void> {
  await redis.hdel(REDIS_KEYS.onlineUsers, userId);
}

export async function getOnlineUserCount(): Promise<number> {
  const users = await redis.hgetall(REDIS_KEYS.onlineUsers);
  return users ? Object.keys(users).length : 0;
}

export async function isUserOnline(userId: string): Promise<boolean> {
  const result = await redis.hget(REDIS_KEYS.onlineUsers, userId);
  return result !== null;
}

export async function addToMatchRoom(matchId: string, userId: string): Promise<void> {
  await redis.sadd(REDIS_KEYS.matchRoom(matchId), userId);
  await redis.expire(REDIS_KEYS.matchRoom(matchId), REDIS_TTL.MATCH_STATE);
}

export async function removeFromMatchRoom(matchId: string, userId: string): Promise<void> {
  await redis.srem(REDIS_KEYS.matchRoom(matchId), userId);
}

export async function getMatchRoomMembers(matchId: string): Promise<string[]> {
  const members = await redis.smembers(REDIS_KEYS.matchRoom(matchId));
  return members || [];
}

export async function deleteMatchRoom(matchId: string): Promise<void> {
  await redis.del(REDIS_KEYS.matchRoom(matchId));
}

export async function addToSimulRoom(matchId: string, userId: string): Promise<void> {
  await redis.sadd(REDIS_KEYS.simulMatchRoom(matchId), userId);
  await redis.expire(REDIS_KEYS.simulMatchRoom(matchId), REDIS_TTL.MATCH_STATE);
}

export async function removeFromSimulRoom(matchId: string, userId: string): Promise<void> {
  await redis.srem(REDIS_KEYS.simulMatchRoom(matchId), userId);
}

export async function getSimulRoomMembers(matchId: string): Promise<string[]> {
  const members = await redis.smembers(REDIS_KEYS.simulMatchRoom(matchId));
  return members || [];
}

interface MatchState {
  fen: string;
  whiteTime: number;
  blackTime: number;
  moves: string[];
  lastMoveAt: number;
  status: string;
}

export async function setMatchState(matchId: string, state: MatchState): Promise<void> {
  await redis.set(REDIS_KEYS.matchState(matchId), JSON.stringify(state), { ex: REDIS_TTL.MATCH_STATE });
}

export async function getMatchState(matchId: string): Promise<MatchState | null> {
  const state = await redis.get(REDIS_KEYS.matchState(matchId));
  if (!state) return null;
  return typeof state === 'string' ? JSON.parse(state) : state as MatchState;
}

export async function deleteMatchState(matchId: string): Promise<void> {
  await redis.del(REDIS_KEYS.matchState(matchId));
}

interface HandshakeState {
  whiteOfferedHandshake: boolean;
  blackOfferedHandshake: boolean;
  whiteMoved: boolean;
  blackMoved: boolean;
  whiteOfferedBeforeFirstMove: boolean;
  blackOfferedBeforeFirstMove: boolean;
  player1Color: 'white' | 'black';
  player1Id: string;
  player2Id: string;
}

export async function setHandshakeState(matchId: string, state: HandshakeState): Promise<void> {
  await redis.set(REDIS_KEYS.matchHandshake(matchId), JSON.stringify(state), { ex: REDIS_TTL.HANDSHAKE });
}

export async function getHandshakeState(matchId: string): Promise<HandshakeState | null> {
  const state = await redis.get(REDIS_KEYS.matchHandshake(matchId));
  if (!state) return null;
  return typeof state === 'string' ? JSON.parse(state) : state as HandshakeState;
}

export async function deleteHandshakeState(matchId: string): Promise<void> {
  await redis.del(REDIS_KEYS.matchHandshake(matchId));
}

interface PostGameHandshakeState {
  player1Offered: boolean;
  player2Offered: boolean;
  player1Id: string;
  player2Id: string;
  createdAt: number;
  finalized: boolean;
}

export async function setPostGameHandshakeState(matchId: string, state: PostGameHandshakeState): Promise<void> {
  await redis.set(REDIS_KEYS.postGameHandshake(matchId), JSON.stringify(state), { ex: REDIS_TTL.HANDSHAKE });
}

export async function getPostGameHandshakeState(matchId: string): Promise<PostGameHandshakeState | null> {
  const state = await redis.get(REDIS_KEYS.postGameHandshake(matchId));
  if (!state) return null;
  return typeof state === 'string' ? JSON.parse(state) : state as PostGameHandshakeState;
}

export async function deletePostGameHandshakeState(matchId: string): Promise<void> {
  await redis.del(REDIS_KEYS.postGameHandshake(matchId));
}

export async function setDisconnectTimer(userId: string, matchId: string, expiresIn: number): Promise<void> {
  await redis.set(
    REDIS_KEYS.disconnectTimer(userId), 
    JSON.stringify({ matchId, expiresAt: Date.now() + expiresIn }),
    { ex: Math.ceil(expiresIn / 1000) + 5 }
  );
}

export async function getDisconnectTimer(userId: string): Promise<{ matchId: string; expiresAt: number } | null> {
  const data = await redis.get(REDIS_KEYS.disconnectTimer(userId));
  if (!data) return null;
  return typeof data === 'string' ? JSON.parse(data) : data as { matchId: string; expiresAt: number };
}

export async function deleteDisconnectTimer(userId: string): Promise<void> {
  await redis.del(REDIS_KEYS.disconnectTimer(userId));
}

export async function publishMatchEvent(matchId: string, event: object): Promise<void> {
  await redis.publish(REDIS_KEYS.pubsubChannel(matchId), JSON.stringify(event));
}

export async function publishSimulEvent(matchId: string, event: object): Promise<void> {
  await redis.publish(REDIS_KEYS.simulPubsubChannel(matchId), JSON.stringify(event));
}

// Matchmaking Queue functions using Redis sorted sets
const QUEUE_KEY_PREFIX = 'queue:matchmaking:';

interface QueueEntryData {
  userId: string;
  socketId: string;
  rating: number;
  serverId: string;
  enqueuedAt: number;
}

export async function addToMatchmakingQueue(
  timeControl: string,
  entry: QueueEntryData
): Promise<void> {
  const key = `${QUEUE_KEY_PREFIX}${timeControl}`;
  // Use enqueued timestamp as score for FIFO ordering
  await redis.zadd(key, { score: entry.enqueuedAt, member: JSON.stringify(entry) });
  // Set TTL on queue key to auto-cleanup stale queues
  await redis.expire(key, 600); // 10 minutes
}

export async function removeFromMatchmakingQueue(
  timeControl: string,
  userId: string
): Promise<boolean> {
  const key = `${QUEUE_KEY_PREFIX}${timeControl}`;
  const entries = await redis.zrange(key, 0, -1);
  
  for (const entry of entries) {
    const data: QueueEntryData = typeof entry === 'string' ? JSON.parse(entry) : entry;
    if (data.userId === userId) {
      await redis.zrem(key, typeof entry === 'string' ? entry : JSON.stringify(entry));
      return true;
    }
  }
  return false;
}

export async function getMatchmakingQueueEntries(
  timeControl: string
): Promise<QueueEntryData[]> {
  const key = `${QUEUE_KEY_PREFIX}${timeControl}`;
  const entries = await redis.zrange(key, 0, -1);
  return entries.map(e => typeof e === 'string' ? JSON.parse(e) : e);
}

export async function popMatchFromQueue(
  timeControl: string,
  ratingRange: number = 300
): Promise<{ player1: QueueEntryData; player2: QueueEntryData } | null> {
  const key = `${QUEUE_KEY_PREFIX}${timeControl}`;
  const entries = await redis.zrange(key, 0, -1);
  
  if (entries.length < 2) return null;
  
  const parsed: QueueEntryData[] = entries.map(e => 
    typeof e === 'string' ? JSON.parse(e) : e
  );
  
  // Find first valid match within rating range (FIFO)
  for (let i = 0; i < parsed.length; i++) {
    for (let j = i + 1; j < parsed.length; j++) {
      const ratingDiff = Math.abs(parsed[i].rating - parsed[j].rating);
      if (ratingDiff <= ratingRange) {
        // Remove both from queue atomically
        const entry1Str = typeof entries[i] === 'string' ? entries[i] : JSON.stringify(entries[i]);
        const entry2Str = typeof entries[j] === 'string' ? entries[j] : JSON.stringify(entries[j]);
        await redis.zrem(key, entry1Str, entry2Str);
        return { player1: parsed[i], player2: parsed[j] };
      }
    }
  }
  
  return null;
}

export async function getQueueCounts(): Promise<Record<string, number>> {
  const timeControls = ['bullet', 'blitz', 'rapid', 'classical'];
  const counts: Record<string, number> = {};
  
  for (const tc of timeControls) {
    const count = await redis.zcard(`${QUEUE_KEY_PREFIX}${tc}`);
    counts[tc] = count;
  }
  
  return counts;
}

export async function cleanStaleQueueEntries(maxAgeMs: number = 300000): Promise<number> {
  const timeControls = ['bullet', 'blitz', 'rapid', 'classical'];
  const cutoff = Date.now() - maxAgeMs;
  let cleaned = 0;
  
  for (const tc of timeControls) {
    const key = `${QUEUE_KEY_PREFIX}${tc}`;
    // Remove entries with score (timestamp) less than cutoff
    const removed = await redis.zremrangebyscore(key, 0, cutoff);
    cleaned += removed;
  }
  
  return cleaned;
}

export { redis };
