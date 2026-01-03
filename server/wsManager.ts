import type { WebSocket } from 'ws';
import { 
  addUserOnline, 
  removeUserOnline, 
  addToMatchRoom, 
  removeFromMatchRoom,
  getMatchRoomMembers,
  deleteMatchRoom,
  addToSimulRoom,
  removeFromSimulRoom,
  getSimulRoomMembers,
  setDisconnectTimer,
  getDisconnectTimer,
  deleteDisconnectTimer,
} from './redis';
import { publishMatchEvent, publishSimulEvent, subscribeToMatch, subscribeToSimul } from './redisPubSub';

const SERVER_ID = `server-${process.pid}-${Date.now()}`;

const localConnections = new Map<string, WebSocket>();
const matchSubscriptions = new Map<string, () => void>();
const simulSubscriptions = new Map<string, () => void>();

export interface ExtendedWebSocket extends WebSocket {
  isAlive?: boolean;
  userId?: string;
  matchId?: string;
  lastPong?: number;
  socketId?: string;
}

export function getServerId(): string {
  return SERVER_ID;
}

export async function registerConnection(userId: string, ws: WebSocket): Promise<void> {
  localConnections.set(userId, ws);
  await addUserOnline(userId, SERVER_ID);
  console.log(`[WSManager] User ${userId} connected on ${SERVER_ID}`);
}

export async function unregisterConnection(userId: string): Promise<void> {
  localConnections.delete(userId);
  await removeUserOnline(userId);
  console.log(`[WSManager] User ${userId} disconnected from ${SERVER_ID}`);
}

export function getLocalConnection(userId: string): WebSocket | undefined {
  return localConnections.get(userId);
}

export function getAllLocalConnections(): Map<string, WebSocket> {
  return localConnections;
}

export async function joinMatchRoom(matchId: string, userId: string, ws: ExtendedWebSocket): Promise<void> {
  await addToMatchRoom(matchId, userId);
  ws.matchId = matchId;
  
  if (!matchSubscriptions.has(matchId)) {
    const unsubscribe = subscribeToMatch(matchId, (channel, message) => {
      handleMatchMessage(matchId, message);
    });
    matchSubscriptions.set(matchId, unsubscribe);
    console.log(`[WSManager] Subscribed to match ${matchId}`);
  }
}

export async function leaveMatchRoom(matchId: string, userId: string): Promise<void> {
  await removeFromMatchRoom(matchId, userId);
  
  const members = await getMatchRoomMembers(matchId);
  if (members.length === 0) {
    const unsubscribe = matchSubscriptions.get(matchId);
    if (unsubscribe) {
      unsubscribe();
      matchSubscriptions.delete(matchId);
    }
    await deleteMatchRoom(matchId);
    console.log(`[WSManager] Cleaned up empty match room ${matchId}`);
  }
}

export async function joinSimulRoom(matchId: string, userId: string): Promise<void> {
  await addToSimulRoom(matchId, userId);
  
  if (!simulSubscriptions.has(matchId)) {
    const unsubscribe = subscribeToSimul(matchId, (channel, message) => {
      handleSimulMessage(matchId, message);
    });
    simulSubscriptions.set(matchId, unsubscribe);
    console.log(`[WSManager] Subscribed to simul ${matchId}`);
  }
}

export async function leaveSimulRoom(matchId: string, userId: string): Promise<void> {
  await removeFromSimulRoom(matchId, userId);
  
  const members = await getSimulRoomMembers(matchId);
  if (members.length === 0) {
    const unsubscribe = simulSubscriptions.get(matchId);
    if (unsubscribe) {
      unsubscribe();
      simulSubscriptions.delete(matchId);
    }
    console.log(`[WSManager] Cleaned up empty simul room ${matchId}`);
  }
}

export async function broadcastToMatch(matchId: string, event: object, excludeUserId?: string): Promise<void> {
  await publishMatchEvent(matchId, { ...event, _excludeUserId: excludeUserId, _serverId: SERVER_ID });
}

export async function broadcastToSimul(matchId: string, event: object, excludeUserId?: string): Promise<void> {
  await publishSimulEvent(matchId, { ...event, _excludeUserId: excludeUserId, _serverId: SERVER_ID });
}

async function handleMatchMessage(matchId: string, messageStr: string): Promise<void> {
  try {
    const data = JSON.parse(messageStr);
    const excludeUserId = data._excludeUserId;
    delete data._excludeUserId;
    delete data._serverId;
    
    const members = await getMatchRoomMembers(matchId);
    
    for (const userId of members) {
      if (userId === excludeUserId) continue;
      
      const ws = localConnections.get(userId);
      if (ws && ws.readyState === 1) {
        ws.send(JSON.stringify(data));
      }
    }
  } catch (err) {
    console.error('[WSManager] Error handling match message:', err);
  }
}

async function handleSimulMessage(matchId: string, messageStr: string): Promise<void> {
  try {
    const data = JSON.parse(messageStr);
    const excludeUserId = data._excludeUserId;
    delete data._excludeUserId;
    delete data._serverId;
    
    const members = await getSimulRoomMembers(matchId);
    
    for (const userId of members) {
      if (userId === excludeUserId) continue;
      
      const ws = localConnections.get(userId);
      if (ws && ws.readyState === 1) {
        ws.send(JSON.stringify(data));
      }
    }
  } catch (err) {
    console.error('[WSManager] Error handling simul message:', err);
  }
}

export async function sendToUser(userId: string, event: object): Promise<boolean> {
  const ws = localConnections.get(userId);
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify(event));
    return true;
  }
  return false;
}

export async function setUserDisconnectTimer(userId: string, matchId: string, timeoutMs: number): Promise<void> {
  await setDisconnectTimer(userId, matchId, timeoutMs);
}

export async function getUserDisconnectTimer(userId: string): Promise<{ matchId: string; expiresAt: number } | null> {
  return await getDisconnectTimer(userId);
}

export async function clearUserDisconnectTimer(userId: string): Promise<void> {
  await deleteDisconnectTimer(userId);
}

export function getLocalConnectionCount(): number {
  return localConnections.size;
}

export function cleanupAllSubscriptions(): void {
  for (const unsubscribe of Array.from(matchSubscriptions.values())) {
    unsubscribe();
  }
  matchSubscriptions.clear();
  
  for (const unsubscribe of Array.from(simulSubscriptions.values())) {
    unsubscribe();
  }
  simulSubscriptions.clear();
  
  console.log('[WSManager] Cleaned up all subscriptions');
}
