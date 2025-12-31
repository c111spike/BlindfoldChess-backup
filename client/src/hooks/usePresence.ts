import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from './useAuth';

const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const RECONNECT_DELAY = 5000; // 5 seconds

export function usePresence() {
  const { user, isAuthenticated } = useAuth();
  const wsRef = useRef<WebSocket | null>(null);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectRef = useRef<NodeJS.Timeout | null>(null);
  const isConnectingRef = useRef(false);

  const cleanup = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
    if (reconnectRef.current) {
      clearTimeout(reconnectRef.current);
      reconnectRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    isConnectingRef.current = false;
  }, []);

  const connect = useCallback(() => {
    if (!user?.id || isConnectingRef.current || wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    isConnectingRef.current = true;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      isConnectingRef.current = false;
      
      // Authenticate using 'auth' message type (matches backend)
      ws.send(JSON.stringify({
        type: 'auth',
        userId: user.id,
      }));

      // Start heartbeat to keep connection alive
      heartbeatRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, HEARTBEAT_INTERVAL);
    };

    ws.onclose = () => {
      isConnectingRef.current = false;
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }

      // Attempt reconnection if user is still authenticated
      if (user?.id && !reconnectRef.current) {
        reconnectRef.current = setTimeout(() => {
          reconnectRef.current = null;
          connect();
        }, RECONNECT_DELAY);
      }
    };

    ws.onerror = () => {
      isConnectingRef.current = false;
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        // Handle pong response (no action needed, just keeps connection alive)
        if (data.type === 'pong') {
          return;
        }
      } catch {
        // Ignore parse errors
      }
    };
  }, [user?.id]);

  useEffect(() => {
    if (isAuthenticated && user?.id) {
      connect();
    } else {
      cleanup();
    }

    return cleanup;
  }, [isAuthenticated, user?.id, connect, cleanup]);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);
}
