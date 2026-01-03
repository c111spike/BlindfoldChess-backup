import { redis, REDIS_KEYS } from './redis';

type MessageHandler = (channel: string, message: string) => void;

const subscriptions = new Map<string, Set<MessageHandler>>();

const POLL_INTERVAL = 100;
let pollInterval: NodeJS.Timeout | null = null;
const messageQueues = new Map<string, string[]>();

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
}

function startPollingIfNeeded() {
  if (pollInterval === null && subscriptions.size > 0) {
    pollInterval = setInterval(pollMessages, POLL_INTERVAL);
    console.log('[RedisPubSub] Started polling');
  }
}

function stopPollingIfEmpty() {
  if (subscriptions.size === 0 && pollInterval !== null) {
    clearInterval(pollInterval);
    pollInterval = null;
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
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
  console.log('[RedisPubSub] Cleaned up all subscriptions');
}
