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

interface MoveData {
  matchId: string;
  move: string;
  fen: string;
  whiteTime: number;
  blackTime: number;
  from?: string;
  to?: string;
  piece?: string;
  captured?: string;
  promotion?: string;
}

interface ArbiterCallData {
  matchId: string;
  callerId: string;
  moveIndex: number;
}

interface ArbiterRulingData {
  matchId: string;
  ruling: "illegal" | "legal";
  violatorId: string;
  timeAdjustment: { white: number; black: number };
  forfeit?: boolean;
  forfeitReason?: string;
  previousFen?: string;
  claimType?: "unsportsmanlike" | "illegal" | "distraction";
}

interface HandshakeStateData {
  whiteOfferedHandshake: boolean;
  blackOfferedHandshake: boolean;
  whiteMoved: boolean;
  blackMoved: boolean;
  whiteOfferedBeforeFirstMove: boolean;
  blackOfferedBeforeFirstMove: boolean;
}

interface JoinedMatchData {
  matchId: string;
  handshakeState: HandshakeStateData | null;
}

interface UseWebSocketOptions {
  userId?: string;
  matchId?: string;
  onMove?: (data: MoveData) => void;
  onClockSync?: (data: { matchId: string; whiteTime: number; blackTime: number }) => void;
  onMatchFound?: (data: MatchFoundData) => void;
  onJoinedMatch?: (data: JoinedMatchData) => void;
  onDrawOffer?: (data: { matchId: string; from: string }) => void;
  onDrawResponse?: (data: { matchId: string; accepted: boolean }) => void;
  onRematchRequest?: (data: { matchId: string; from: string }) => void;
  onRematchResponse?: (data: { matchId: string; accepted: boolean; newMatchId?: string }) => void;
  onGameEnd?: (data: { result: string; reason: string }) => void;
  onPieceTouch?: (data: { matchId: string; square: string }) => void;
  onArbiterCall?: (data: ArbiterCallData) => void;
  onArbiterRuling?: (data: ArbiterRulingData) => void;
  onHandshakeOffer?: (data: { matchId: string }) => void;
}

export function useWebSocket(options: UseWebSocketOptions) {
  const { 
    userId, 
    matchId, 
    onMove, 
    onClockSync, 
    onMatchFound,
    onJoinedMatch,
    onDrawOffer, 
    onDrawResponse, 
    onRematchRequest, 
    onRematchResponse, 
    onGameEnd, 
    onPieceTouch,
    onArbiterCall,
    onArbiterRuling,
    onHandshakeOffer,
  } = options;
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [queueStatus, setQueueStatus] = useState<{ inQueue: boolean; timeControl?: string }>({ inQueue: false });
  
  // Use refs for callbacks to avoid stale closure issues
  const onMoveRef = useRef(onMove);
  const onClockSyncRef = useRef(onClockSync);
  const onMatchFoundRef = useRef(onMatchFound);
  const onJoinedMatchRef = useRef(onJoinedMatch);
  const onDrawOfferRef = useRef(onDrawOffer);
  const onDrawResponseRef = useRef(onDrawResponse);
  const onRematchRequestRef = useRef(onRematchRequest);
  const onRematchResponseRef = useRef(onRematchResponse);
  const onGameEndRef = useRef(onGameEnd);
  const onPieceTouchRef = useRef(onPieceTouch);
  const onArbiterCallRef = useRef(onArbiterCall);
  const onArbiterRulingRef = useRef(onArbiterRuling);
  const onHandshakeOfferRef = useRef(onHandshakeOffer);
  
  // Keep refs updated with latest callbacks
  useEffect(() => {
    onMoveRef.current = onMove;
    onClockSyncRef.current = onClockSync;
    onMatchFoundRef.current = onMatchFound;
    onJoinedMatchRef.current = onJoinedMatch;
    onDrawOfferRef.current = onDrawOffer;
    onDrawResponseRef.current = onDrawResponse;
    onRematchRequestRef.current = onRematchRequest;
    onRematchResponseRef.current = onRematchResponse;
    onGameEndRef.current = onGameEnd;
    onPieceTouchRef.current = onPieceTouch;
    onArbiterCallRef.current = onArbiterCall;
    onArbiterRulingRef.current = onArbiterRuling;
    onHandshakeOfferRef.current = onHandshakeOffer;
  });

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
            if (message.matchId && wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({ type: 'join_match', matchId: message.matchId }));
            }
            if (onMatchFoundRef.current) {
              onMatchFoundRef.current({
                matchId: message.matchId,
                game: message.game,
                timeControl: message.timeControl,
                color: message.color,
                opponent: message.opponent,
              });
            }
            break;
          case 'joined_match':
            console.log('[WebSocket] Received joined_match with handshake state:', message.handshakeState);
            if (onJoinedMatchRef.current) {
              onJoinedMatchRef.current({
                matchId: message.matchId,
                handshakeState: message.handshakeState,
              });
            }
            break;
          case 'opponent_move':
            console.log('[WebSocket] Calling onMove handler with:', message);
            if (onMoveRef.current) {
              onMoveRef.current({
                matchId: message.matchId,
                move: message.move,
                fen: message.fen,
                whiteTime: message.whiteTime,
                blackTime: message.blackTime,
                from: message.from,
                to: message.to,
                piece: message.piece,
                captured: message.captured,
              });
            }
            break;
          case 'clock_sync':
            if (onClockSyncRef.current) {
              onClockSyncRef.current({
                matchId: message.matchId,
                whiteTime: message.whiteTime,
                blackTime: message.blackTime,
              });
            }
            break;
          case 'draw_offer':
            if (onDrawOfferRef.current) {
              onDrawOfferRef.current({
                matchId: message.matchId,
                from: message.from,
              });
            }
            break;
          case 'draw_response':
            if (onDrawResponseRef.current) {
              onDrawResponseRef.current({
                matchId: message.matchId,
                accepted: message.accepted,
              });
            }
            break;
          case 'rematch_request':
            if (onRematchRequestRef.current) {
              onRematchRequestRef.current({
                matchId: message.matchId,
                from: message.from,
              });
            }
            break;
          case 'rematch_response':
            if (onRematchResponseRef.current) {
              onRematchResponseRef.current({
                matchId: message.matchId,
                accepted: message.accepted,
                newMatchId: message.newMatchId,
              });
            }
            break;
          case 'game_end':
            if (onGameEndRef.current) {
              onGameEndRef.current({
                result: message.result,
                reason: message.reason,
              });
            }
            break;
          case 'opponent_touch':
            if (onPieceTouchRef.current) {
              onPieceTouchRef.current({
                matchId: message.matchId,
                square: message.square,
              });
            }
            break;
          case 'arbiter_call':
            if (onArbiterCallRef.current) {
              onArbiterCallRef.current({
                matchId: message.matchId,
                callerId: message.callerId,
                moveIndex: message.moveIndex,
              });
            }
            break;
          case 'arbiter_ruling':
            if (onArbiterRulingRef.current) {
              onArbiterRulingRef.current({
                matchId: message.matchId,
                ruling: message.ruling,
                violatorId: message.violatorId,
                timeAdjustment: message.timeAdjustment,
                forfeit: message.forfeit,
                forfeitReason: message.forfeitReason,
                previousFen: message.previousFen,
                claimType: message.claimType,
              });
            }
            break;
          case 'handshake_offer':
            if (onHandshakeOfferRef.current) {
              onHandshakeOfferRef.current({
                matchId: message.matchId,
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
  }, [userId]);

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

  const sendMove = useCallback((
    matchId: string, 
    move: string, 
    fen: string, 
    whiteTime: number, 
    blackTime: number,
    otbMoveData?: { from: string; to: string; piece: string; captured?: string; promotion?: string; playerColor?: "white" | "black" }
  ) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'move',
        matchId,
        move,
        fen,
        whiteTime,
        blackTime,
        ...(otbMoveData || {}),
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

  const sendDrawOffer = useCallback((matchId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'offer_draw', matchId }));
    }
  }, []);

  const sendDrawResponse = useCallback((matchId: string, accepted: boolean) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'respond_draw', matchId, accepted }));
    }
  }, []);

  const sendRematchRequest = useCallback((matchId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'request_rematch', matchId }));
    }
  }, []);

  const sendRematchResponse = useCallback((matchId: string, accepted: boolean) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'respond_rematch', matchId, accepted }));
    }
  }, []);

  const sendPieceTouch = useCallback((square: string | null) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'piece_touch', square }));
    }
  }, []);

  const sendArbiterCall = useCallback((matchId: string, moveIndex: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'arbiter_call', matchId, moveIndex }));
    }
  }, []);

  const sendArbiterRuling = useCallback((
    matchId: string, 
    ruling: "illegal" | "legal", 
    violatorId: string,
    timeAdjustment: { white: number; black: number },
    forfeit?: boolean,
    forfeitReason?: string,
    previousFen?: string,
    claimType?: "unsportsmanlike" | "illegal" | "distraction"
  ) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ 
        type: 'arbiter_ruling', 
        matchId, 
        ruling, 
        violatorId,
        timeAdjustment,
        forfeit,
        forfeitReason,
        previousFen,
        claimType,
      }));
    }
  }, []);

  const sendGameEnd = useCallback((matchId: string, result: string, reason: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ 
        type: 'game_end', 
        matchId, 
        result,
        reason,
      }));
    }
  }, []);

  const sendHandshakeOffer = useCallback((matchId: string, playerColor?: "white" | "black") => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ 
        type: 'handshake_offer', 
        matchId,
        playerColor,
      }));
    }
  }, []);

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
    sendDrawOffer,
    sendDrawResponse,
    sendRematchRequest,
    sendRematchResponse,
    sendPieceTouch,
    sendArbiterCall,
    sendArbiterRuling,
    sendGameEnd,
    sendHandshakeOffer,
  };
}
