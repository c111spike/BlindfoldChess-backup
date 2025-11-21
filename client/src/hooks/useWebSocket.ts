import { useEffect, useRef, useState, useCallback } from 'react';

interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

interface UseWebSocketOptions {
  userId?: string;
  matchId?: string;
  onMove?: (data: { matchId: string; move: string; fen: string; whiteTime: number; blackTime: number }) => void;
  onClockSync?: (data: { matchId: string; whiteTime: number; blackTime: number }) => void;
}

export function useWebSocket(options: UseWebSocketOptions) {
  const { userId, matchId, onMove, onClockSync } = options;
  const wsRef = useRef<WebSocket | null>(null);
  const prevMatchIdRef = useRef<string | undefined>(undefined);
  const [isConnected, setIsConnected] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isInMatch, setIsInMatch] = useState(false);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      
      if (userId) {
        ws.send(JSON.stringify({ type: 'auth', userId }));
      }
    };

    ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        console.log('WebSocket received:', message);

        switch (message.type) {
          case 'authenticated':
            setIsAuthenticated(true);
            if (matchId) {
              prevMatchIdRef.current = matchId;
              ws.send(JSON.stringify({ type: 'join_match', matchId }));
            }
            break;
          case 'joined_match':
            setIsInMatch(true);
            break;
          case 'opponent_move':
            if (onMove) {
              onMove({
                matchId: message.matchId,
                move: message.move,
                fen: message.fen,
                whiteTime: message.whiteTime,
                blackTime: message.blackTime,
              });
            }
            break;
          case 'clock_sync':
            if (onClockSync) {
              onClockSync({
                matchId: message.matchId,
                whiteTime: message.whiteTime,
                blackTime: message.blackTime,
              });
            }
            break;
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
      setIsAuthenticated(false);
      setIsInMatch(false);
    };
  }, [userId, matchId, onMove, onClockSync]);

  const sendMove = useCallback((matchId: string, move: string, fen: string, whiteTime: number, blackTime: number, increment?: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'move',
        matchId,
        move,
        fen,
        whiteTime,
        blackTime,
        increment: increment || 0,
      }));
    }
  }, []);

  const sendClockUpdate = useCallback((matchId: string, whiteTime: number, blackTime: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'clock_update',
        matchId,
        whiteTime,
        blackTime,
      }));
    }
  }, []);

  const joinMatch = useCallback((newMatchId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN && isAuthenticated) {
      wsRef.current.send(JSON.stringify({ type: 'join_match', matchId: newMatchId }));
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (userId) {
      connect();
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [userId, connect]);

  useEffect(() => {
    if (matchId && isAuthenticated && matchId !== prevMatchIdRef.current) {
      prevMatchIdRef.current = matchId;
      joinMatch(matchId);
    }
  }, [matchId, isAuthenticated, joinMatch]);

  return {
    isConnected,
    isAuthenticated,
    isInMatch,
    sendMove,
    sendClockUpdate,
    joinMatch,
  };
}
