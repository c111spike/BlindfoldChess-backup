import { redis, REDIS_KEYS } from './redis';

type MessageHandler = (channel: string, message: string) => void;

const subscriptions = new Map<string, Set<MessageHandler>>();

// Adaptive polling: "Racing" during games, "Parking" when idle
// Racing (1s): Real-time move delivery during active games
// Parking (5s): Queue/matchmaking checks when no games active
// This saves ~95% of Redis commands vs constant 100ms polling
const RACING_INTERVAL = 1000;  // 1 second during active games
const PARKING_INTERVAL = 5000; // 5 seconds when idle
let pollTimeout: NodeJS.Timeout | null = null;
let isRacing = false;
const messageQueues = new Map<string, string[]>();

// Track active game channels (match: and simul: prefixed)
function hasActiveGames(): boolean {
  const channels = Array.from(subscriptions.keys());
  for (const channel of channels) {
    if (channel.includes('channel:match:') || channel.includes('channel:simul:')) {
      return true;
    }
  }
  return false;
}

function getCurrentInterval(): number {
  const racing = hasActiveGames();
  if (racing !== isRacing) {
    isRacing = racing;
    console.log(`[RedisPubSub] Mode: ${racing ? 'RACING (1s)' : 'PARKING (5s)'}`);
  }
  return racing ? RACING_INTERVAL : PARKING_INTERVAL;
}

export function subscribeToMatch(matchId: string, handler: MessageHandler): () => void {
  const channel = REDIS_KEYS.pubsubChannel(matchId);
  
  if (!subscriptions.has(channel)) {
    subscriptions.set(channel, new Set());
  }
  subscriptions.get(channel)!.add(handler);
  
  startPollingIfNeeded();
  
  return () => {
    const handlers = subscriptions.get(channel);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        subscriptions.delete(channel);
      }
    }
    stopPollingIfEmpty();
  };
}

export function subscribeToSimul(matchId: string, handler: MessageHandler): () => void {
  const channel = REDIS_KEYS.simulPubsubChannel(matchId);
  
  if (!subscriptions.has(channel)) {
    subscriptions.set(channel, new Set());
  }
  subscriptions.get(channel)!.add(handler);
  
  startPollingIfNeeded();
  
  return () => {
    const handlers = subscriptions.get(channel);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        subscriptions.delete(channel);
      }
    }
    stopPollingIfEmpty();
  };
}

async function pollMessages() {
  const entries = Array.from(subscriptions.entries());
  for (const [channel, handlers] of entries) {
    try {
      const listKey = `list:${channel}`;
      const messages = await redis.lrange(listKey, 0, 99);
      
      if (messages && messages.length > 0) {
        await redis.ltrim(listKey, messages.length, -1);
        
        for (const message of messages) {
          const msgStr = typeof message === 'string' ? message : JSON.stringify(message);
          const handlerArray = Array.from(handlers);
          for (const handler of handlerArray) {
            try {
              handler(channel, msgStr);
            } catch (err) {
              console.error('[RedisPubSub] Handler error:', err);
            }
          }
        }
      }
    } catch (err) {
      console.error('[RedisPubSub] Poll error for channel:', channel, err);
    }
  }
  
  // Schedule next poll with adaptive interval
  if (subscriptions.size > 0) {
    pollTimeout = setTimeout(pollLoop, getCurrentInterval());
  }
}

function pollLoop() {
  pollMessages();
}

function startPollingIfNeeded() {
  if (pollTimeout === null && subscriptions.size > 0) {
    pollTimeout = setTimeout(pollLoop, getCurrentInterval());
    console.log('[RedisPubSub] Started adaptive polling');
  }
}

function stopPollingIfEmpty() {
  if (subscriptions.size === 0 && pollTimeout !== null) {
    clearTimeout(pollTimeout);
    pollTimeout = null;
    isRacing = false;
    console.log('[RedisPubSub] Stopped polling');
  }
}

export async function publishToChannel(channel: string, message: object): Promise<void> {
  const listKey = `list:${channel}`;
  await redis.rpush(listKey, JSON.stringify(message));
  await redis.expire(listKey, 3600);
}

export async function publishMatchEvent(matchId: string, event: object): Promise<void> {
  const channel = REDIS_KEYS.pubsubChannel(matchId);
  await publishToChannel(channel, event);
}

export async function publishSimulEvent(matchId: string, event: object): Promise<void> {
  const channel = REDIS_KEYS.simulPubsubChannel(matchId);
  await publishToChannel(channel, event);
}

export function cleanupSubscriptions() {
  subscriptions.clear();
  if (pollTimeout) {
    clearTimeout(pollTimeout);
    pollTimeout = null;
  }
  isRacing = false;
  console.log('[RedisPubSub] Cleaned up all subscriptions');
}
