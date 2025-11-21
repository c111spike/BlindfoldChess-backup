import { useEffect, useRef, useState, useCallback } from 'react';

interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

interface MatchFoundData {
  matchId: string;
  game: any;
  timeControl: string;
  color: string;
  opponent: {
    name: string;
    rating: number;
  };
}

interface UseWebSocketOptions {
  userId?: string;
  onMove?: (data: { matchId: string; move: string; fen: string; whiteTime: number; blackTime: number }) => void;
  onClockSync?: (data: { matchId: string; whiteTime: number; blackTime: number }) => void;
  onMatchFound?: (data: MatchFoundData) => void;
}

export function useWebSocket(options: UseWebSocketOptions) {
  const { userId, onMove, onClockSync, onMatchFound } = options;
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [queueStatus, setQueueStatus] = useState<{ inQueue: boolean; timeControl?: string }>({ inQueue: false });

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    console.log('[useWebSocket] Attempting to connect to:', wsUrl);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[useWebSocket] WebSocket connection established!');
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
            break;
          case 'queue_joined':
            setQueueStatus({ inQueue: true, timeControl: message.timeControl });
            break;
          case 'queue_left':
            setQueueStatus({ inQueue: false });
            break;
          case 'match_found':
            setQueueStatus({ inQueue: false });
            // Automatically join the match room for real-time move sync
            if (message.matchId && wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({ type: 'join_match', matchId: message.matchId }));
            }
            if (onMatchFound) {
              onMatchFound({
                matchId: message.matchId,
                game: message.game,
                timeControl: message.timeControl,
                color: message.color,
                opponent: message.opponent,
              });
            }
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
      setQueueStatus({ inQueue: false });
    };
  }, [userId, onMove, onClockSync, onMatchFound]);

  const joinQueue = useCallback((timeControl: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN && isAuthenticated) {
      wsRef.current.send(JSON.stringify({ type: 'join_queue', timeControl }));
    }
  }, [isAuthenticated]);

  const leaveQueue = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'leave_queue' }));
    }
  }, []);

  const sendMove = useCallback((matchId: string, move: string, fen: string, whiteTime: number, blackTime: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'move',
        matchId,
        move,
        fen,
        whiteTime,
        blackTime,
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

  const joinMatch = useCallback((matchId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN && isAuthenticated) {
      wsRef.current.send(JSON.stringify({ type: 'join_match', matchId }));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  return {
    isConnected,
    isAuthenticated,
    queueStatus,
    joinQueue,
    leaveQueue,
    sendMove,
    sendClockUpdate,
    joinMatch,
  };
}
