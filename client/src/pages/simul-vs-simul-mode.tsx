import { useState, useEffect, useCallback, useRef } from "react";
import { Helmet } from "react-helmet-async";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Chess } from "chess.js";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications } from "@/hooks/useNotifications";
import { useHighlightColors } from "@/hooks/useHighlightColors";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { generateBotMoveClient, countBotPieces, detectRecapture, LastMoveInfo } from "@/lib/botEngine";
import type { BotPersonality, BotDifficulty } from "@shared/botTypes";

// Piece values for recapture detection
const PIECE_VALUES_SIMUL: Record<string, number> = {
  p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000
};
import { Label } from "@/components/ui/label";
import { ChessBoard } from "@/components/chess-board";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Play, Clock, Users, ArrowLeft, ArrowRight, Crown, BarChart3, Mic, Flag, Handshake, Check, X, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { speak, moveToSpeech, voiceRecognition } from "@/lib/voice";
import { ReportPlayerDialog } from "@/components/ReportPlayerDialog";
import type { UserSettings } from "@shared/schema";
import { SuspensionBanner } from "@/components/suspension-banner";

interface SimulVsSimulBoard {
  pairingId: string;
  boardNumber: number;
  color: 'white' | 'black';
  opponentId: string;
  opponentName: string;
  isOpponentBot: boolean;
  fen: string;
  moves: string[];
  moveCount: number;
  activeColor: 'white' | 'black';
  result: string;
  chess: Chess;
  timeRemaining: number;
  gameId?: string;
  lastMove?: { from: string; to: string };
  thinkingTimes: number[];
  turnStartTime: number;
}

interface PendingPromotion {
  from: string;
  to: string;
  boardIndex: number;
}

interface MatchPlayer {
  odId: string;
  isBot: boolean;
  botPersonality?: string;
  seat: number;
}

export default function SimulVsSimulMode() {
  const { user } = useAuth();
  const { toast } = useNotifications();
  const [, setLocation] = useLocation();
  const highlightColors = useHighlightColors();
  
  const [gameStarted, setGameStarted] = useState(false);
  const [boardCount, setBoardCount] = useState("5");
  const [activeBoard, setActiveBoard] = useState(0);
  const [boards, setBoards] = useState<SimulVsSimulBoard[]>([]);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [inQueue, setInQueue] = useState(false);
  const [queueInfo, setQueueInfo] = useState<{ playersInQueue: number; playersNeeded: number } | null>(null);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [legalMoves, setLegalMoves] = useState<string[]>([]);
  const [players, setPlayers] = useState<MatchPlayer[]>([]);
  const [matchComplete, setMatchComplete] = useState(false);
  const [focusedPairingId, setFocusedPairingId] = useState<string | null>(null);
  const [showMatchEndDialog, setShowMatchEndDialog] = useState(false);
  const [matchStats, setMatchStats] = useState<{
    ratingChange: number;
    humanGamesPlayed: number;
    wins: number;
    losses: number;
    draws: number;
  } | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion | null>(null);
  const [showPromotionDialog, setShowPromotionDialog] = useState(false);
  const [isVoiceListening, setIsVoiceListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState<string | null>(null);
  const [voiceTurnKey, setVoiceTurnKey] = useState<string | null>(null);
  const [showResignDialog, setShowResignDialog] = useState<'board' | 'all' | null>(null);
  const [pendingDrawOffers, setPendingDrawOffers] = useState<Set<string>>(new Set()); // pairingIds with sent draw offers
  const [incomingDrawOffers, setIncomingDrawOffers] = useState<Set<string>>(new Set()); // pairingIds with received draw offers
  const [showMobileSidebar, setShowMobileSidebar] = useState(false); // Mobile sidebar toggle
  const [queueCountdown, setQueueCountdown] = useState(30); // Bot fill countdown
  
  const boardsRef = useRef<SimulVsSimulBoard[]>([]);
  const activeBoardRef = useRef(0);
  const userSettingsRef = useRef<UserSettings | null>(null);
  const promotionPendingRef = useRef(false);
  const wsRef = useRef<WebSocket | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const queuePollRef = useRef<NodeJS.Timeout | null>(null);
  const matchIdRef = useRef<string | null>(null);
  
  const { data: userSettings } = useQuery<UserSettings>({
    queryKey: ['/api/settings'],
  });
  
  // Centralized helper to update boards state and ref atomically
  // This ensures boardsRef is always in sync with the latest state
  const updateBoardsSync = useCallback((newBoards: SimulVsSimulBoard[]) => {
    boardsRef.current = newBoards;
    setBoards(newBoards);
  }, []);
  
  // Helper for functional updates that also syncs the ref
  const updateBoardsFn = useCallback((updater: (prev: SimulVsSimulBoard[]) => SimulVsSimulBoard[]) => {
    setBoards(prevBoards => {
      const newBoards = updater(prevBoards);
      boardsRef.current = newBoards;
      return newBoards;
    });
  }, []);
  
  useEffect(() => {
    boardsRef.current = boards;
  }, [boards]);
  
  useEffect(() => {
    activeBoardRef.current = activeBoard;
  }, [activeBoard]);
  
  useEffect(() => {
    userSettingsRef.current = userSettings || null;
  }, [userSettings]);
  
  useEffect(() => {
    matchIdRef.current = matchId;
  }, [matchId]);

  // Warn player when trying to leave during an active match
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Only warn if match is active and not already complete
      if (gameStarted && !matchComplete && boards.some(b => b.result === 'ongoing')) {
        e.preventDefault();
        e.returnValue = 'You have ongoing games. Leaving will count as a forfeit on all boards.';
        return e.returnValue;
      }
    };

    const handleVisibilityChange = () => {
      // Notify server when player switches tabs during active match
      if (gameStarted && !matchComplete && boards.some(b => b.result === 'ongoing') && matchId) {
        if (document.visibilityState === 'hidden') {
          // Send player_away to server
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'player_away', matchId }));
          }
          toast({
            title: "Warning",
            description: "You switched tabs. Return within 30 seconds or forfeit.",
            variant: "destructive",
          });
        } else if (document.visibilityState === 'visible') {
          // Send player_back to server
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'player_back', matchId }));
          }
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [gameStarted, matchComplete, boards, matchId, toast]);
  
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      if (queuePollRef.current) {
        clearInterval(queuePollRef.current);
      }
    };
  }, []);
  
  // Queue bot-fill countdown timer
  useEffect(() => {
    if (!inQueue) {
      setQueueCountdown(30);
      return;
    }
    
    const interval = setInterval(() => {
      setQueueCountdown(prev => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(interval);
  }, [inQueue]);
  
  // Client-side countdown timer - decrements active board's timer every second
  useEffect(() => {
    if (!gameStarted || matchComplete) {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      return;
    }
    
    timerIntervalRef.current = setInterval(() => {
      updateBoardsFn(prevBoards => {
        if (prevBoards.length === 0) return prevBoards;
        
        // Find the active board
        const activeBoardData = prevBoards[activeBoard];
        if (!activeBoardData) return prevBoards;
        
        // Only decrement if it's player's turn and game is ongoing
        const isPlayerTurn = activeBoardData.activeColor === activeBoardData.color;
        if (!isPlayerTurn || activeBoardData.result !== 'ongoing') {
          return prevBoards;
        }
        
        // Decrement the timer for the active board
        const newBoards = [...prevBoards];
        const currentTime = newBoards[activeBoard].timeRemaining;
        if (currentTime > 0) {
          newBoards[activeBoard] = {
            ...newBoards[activeBoard],
            timeRemaining: currentTime - 1,
          };
        }
        
        return newBoards;
      });
    }, 1000);
    
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [gameStarted, matchComplete, activeBoard, updateBoardsFn]);
  
  // Track when it's the player's turn - only updates on actual turn changes, not timer ticks
  useEffect(() => {
    if (!gameStarted || boards.length === 0 || matchComplete) {
      setVoiceTurnKey(null);
      return;
    }
    
    const currentBoard = boards[activeBoard];
    if (!currentBoard || currentBoard.result !== 'ongoing') {
      setVoiceTurnKey(null);
      return;
    }
    
    const isMyTurn = currentBoard.activeColor === currentBoard.color;
    const newKey = isMyTurn ? `${currentBoard.pairingId}-${currentBoard.activeColor}-${currentBoard.fen}` : null;
    
    setVoiceTurnKey(prevKey => {
      // Only update if the key actually changed (prevents unnecessary re-renders)
      if (prevKey !== newKey) {
        return newKey;
      }
      return prevKey;
    });
  }, [gameStarted, boards, activeBoard, matchComplete]);
  
  // Voice input recognition for spoken moves - uses stable voiceTurnKey instead of boards
  useEffect(() => {
    if (!voiceTurnKey || !userSettings?.voiceInputEnabled) {
      voiceRecognition.stop();
      return;
    }
    
    // Get current board data from ref (stable, doesn't trigger re-renders)
    const currentBoard = boardsRef.current[activeBoardRef.current];
    if (!currentBoard) {
      voiceRecognition.stop();
      return;
    }
    
    const chess = currentBoard.chess;
    const allLegalMoves = chess.moves();
    voiceRecognition.setLegalMoves(allLegalMoves);
    
    voiceRecognition.setOnResult((move, transcript) => {
      setVoiceTranscript(transcript);
      
      if (move) {
        const isCapture = move.includes('x');
        const spokenConfirm = moveToSpeech(move, isCapture, false, false);
        const boardNumber = boardsRef.current[activeBoardRef.current]?.boardNumber || '?';
        speak(`Board ${boardNumber}: ${spokenConfirm}`).then(async () => {
          const currentBoardData = boardsRef.current[activeBoardRef.current];
          if (!currentBoardData) return;
          
          const currentChess = currentBoardData.chess;
          const moveResult = currentChess.move(move);
          
          if (moveResult) {
            const newFen = currentChess.fen();
            const newActiveColor = currentChess.turn() === 'w' ? 'white' : 'black';
            
            // Record thinking time for this move (preserve decimal precision)
            const thinkingTime = (Date.now() - currentBoardData.turnStartTime) / 1000;
            const newThinkingTimes = [...currentBoardData.thinkingTimes, thinkingTime];
            
            const updatedBoards = [...boardsRef.current];
            updatedBoards[activeBoardRef.current] = {
              ...currentBoardData,
              fen: newFen,
              moves: currentChess.history(),
              moveCount: currentChess.history().length,
              activeColor: newActiveColor as 'white' | 'black',
              chess: currentChess,
              lastMove: { from: moveResult.from, to: moveResult.to },
              thinkingTimes: newThinkingTimes,
              turnStartTime: Date.now(),
            };
            
            // Determine if this move ends the game
            const isGameEnding = currentChess.isCheckmate() || currentChess.isDraw() || currentChess.isStalemate();
            let gameResult: 'white_win' | 'black_win' | 'draw' | null = null;
            let gameEndReason: string | null = null;
            
            if (currentChess.isCheckmate()) {
              gameResult = currentChess.turn() === 'w' ? 'black_win' : 'white_win';
              gameEndReason = 'checkmate';
              updatedBoards[activeBoardRef.current].result = gameResult;
            } else if (currentChess.isDraw() || currentChess.isStalemate()) {
              gameResult = 'draw';
              gameEndReason = currentChess.isStalemate() ? 'stalemate' : 'draw';
              updatedBoards[activeBoardRef.current].result = 'draw';
            }
            
            // For game-ending moves, use REST API and await completion before sending game result
            // This prevents race condition where game result is processed before final move is saved
            if (isGameEnding) {
              try {
                await apiRequest('POST', '/api/simul-vs-simul/move', {
                  pairingId: currentBoardData.pairingId,
                  move: moveResult.san,
                  fen: newFen,
                });
                
                // Move is now saved - send WebSocket notification for opponent, then game result
                if (wsRef.current?.readyState === WebSocket.OPEN) {
                  // Notify opponent of the move
                  wsRef.current.send(JSON.stringify({
                    type: 'simul_move',
                    pairingId: currentBoardData.pairingId,
                    move: moveResult.san,
                    fen: newFen,
                    from: moveResult.from,
                    to: moveResult.to,
                    piece: moveResult.piece,
                    captured: moveResult.captured,
                    promotion: moveResult.promotion,
                  }));
                  
                  // Now send game result with thinking times
                  if (gameResult && gameEndReason) {
                    wsRef.current.send(JSON.stringify({
                      type: 'simul_game_result',
                      pairingId: currentBoardData.pairingId,
                      result: gameResult,
                      reason: gameEndReason,
                      thinkingTimes: newThinkingTimes,
                    }));
                  }
                }
              } catch (error) {
                console.error('Failed to save game-ending move:', error);
                // Still send via WebSocket as fallback
                if (wsRef.current?.readyState === WebSocket.OPEN) {
                  wsRef.current.send(JSON.stringify({
                    type: 'simul_move',
                    pairingId: currentBoardData.pairingId,
                    move: moveResult.san,
                    fen: newFen,
                    from: moveResult.from,
                    to: moveResult.to,
                    piece: moveResult.piece,
                    captured: moveResult.captured,
                    promotion: moveResult.promotion,
                  }));
                  if (gameResult && gameEndReason) {
                    wsRef.current.send(JSON.stringify({
                      type: 'simul_game_result',
                      pairingId: currentBoardData.pairingId,
                      result: gameResult,
                      reason: gameEndReason,
                      thinkingTimes: newThinkingTimes,
                    }));
                  }
                }
              }
            } else {
              // Non-game-ending move: use WebSocket for speed
              if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({
                  type: 'simul_move',
                  pairingId: currentBoardData.pairingId,
                  move: moveResult.san,
                  fen: newFen,
                  from: moveResult.from,
                  to: moveResult.to,
                  piece: moveResult.piece,
                  captured: moveResult.captured,
                  promotion: moveResult.promotion,
                }));
              }
            }
            
            // Update both ref and state atomically
            boardsRef.current = updatedBoards;
            setBoards(updatedBoards);
            setSelectedSquare(null);
            setLegalMoves([]);
            setVoiceTranscript(null);
          }
        });
      } else {
        toast({
          title: "Didn't understand",
          description: `Heard: "${transcript}". Try again.`,
          variant: "destructive",
        });
      }
    });
    
    voiceRecognition.setOnListeningChange(setIsVoiceListening);
    voiceRecognition.start();
    
    return () => {
      voiceRecognition.reset();
    };
  }, [voiceTurnKey, userSettings?.voiceInputEnabled, toast]);
  
  const connectWebSocket = useCallback(() => {
    if (!user?.id || wsRef.current?.readyState === WebSocket.OPEN) return;
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    wsRef.current = ws;
    
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'auth', userId: user.id }));
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
      } catch (error) {
        console.error('WebSocket message parse error:', error);
      }
    };
    
    ws.onclose = () => {
      setTimeout(connectWebSocket, 3000);
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }, [user?.id]);
  
  const handleWebSocketMessage = useCallback((data: any) => {
    switch (data.type) {
      case 'simul_joined':
        const newBoards: SimulVsSimulBoard[] = data.boards.map((b: any) => ({
          ...b,
          chess: new Chess(b.fen),
          timeRemaining: 30,
          thinkingTimes: [],
          turnStartTime: Date.now(),
        }));
        // Update ref immediately for consistency with executeMove
        boardsRef.current = newBoards;
        setBoards(newBoards);
        setPlayers(data.players || []);
        setFocusedPairingId(data.initialFocus);
        setGameStarted(true);
        setInQueue(false);
        
        const focusIndex = newBoards.findIndex((b: SimulVsSimulBoard) => b.pairingId === data.initialFocus);
        if (focusIndex >= 0) {
          setActiveBoard(focusIndex);
        }
        
        // Send initial focus acknowledgment to start the timer
        // Use setTimeout to ensure wsRef is properly set
        setTimeout(() => {
          if (data.initialFocus && wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
              type: 'simul_focus_ack',
              matchId: data.matchId,
              pairingId: data.initialFocus,
            }));
          }
        }, 100);
        
        toast({
          title: "Match found!",
          description: `Playing ${newBoards.length} games simultaneously`,
        });
        break;
        
      case 'simul_opponent_move':
        {
          const boardIndex = boardsRef.current.findIndex(b => b.pairingId === data.pairingId);
          const boardNumber = boardIndex >= 0 ? boardsRef.current[boardIndex].boardNumber : '?';
          
          // Sequence Guard: Only accept updates if incoming moveCount > local moveCount
          // This prevents late-arriving WebSocket messages from "time traveling" the board back
          // to a previous state (out-of-order execution bug)
          if (boardIndex !== -1) {
            const localMoveCount = boardsRef.current[boardIndex].moveCount;
            const incomingMoveCount = data.moveCount;
            
            if (incomingMoveCount <= localMoveCount) {
              console.log(`[SimulWS] Ignored stale opponent move for board ${boardNumber}. Local: ${localMoveCount}, Incoming: ${incomingMoveCount}`);
              break; // Drop the message; we are already ahead or at same position
            }
            
            // Update boardsRef immediately to prevent race conditions with simul_bot_turn
            const chess = new Chess(data.fen);
            const opponentThinkingTime = (Date.now() - boardsRef.current[boardIndex].turnStartTime) / 1000;
            const newThinkingTimes = [...boardsRef.current[boardIndex].thinkingTimes, opponentThinkingTime];
            
            const updatedBoards = [...boardsRef.current];
            updatedBoards[boardIndex] = {
              ...boardsRef.current[boardIndex],
              fen: data.fen,
              moves: chess.history(),
              moveCount: incomingMoveCount,
              activeColor: data.activeColor,
              chess,
              lastMove: data.from && data.to ? { from: data.from, to: data.to } : boardsRef.current[boardIndex].lastMove,
              thinkingTimes: newThinkingTimes,
              turnStartTime: Date.now(),
            };
            
            // Update ref immediately, then trigger React state update
            boardsRef.current = updatedBoards;
            setBoards(updatedBoards);
            
            toast({
              title: `Opponent moved on Board ${boardNumber}`,
              description: data.move,
            });
          }
        }
        break;
        
      case 'simul_focus_update':
        // Block auto-switch if promotion is pending
        if (data.reason === 'auto_switch' && promotionPendingRef.current) {
          console.log('[SimulWS] Blocking auto-switch - promotion pending');
          break;
        }
        
        setFocusedPairingId(data.pairingId);
        const newFocusIndex = boardsRef.current.findIndex(b => b.pairingId === data.pairingId);
        if (newFocusIndex >= 0) {
          setActiveBoard(newFocusIndex);
          if (data.reason === 'auto_switch') {
            toast({
              title: "Board switched",
              description: `Auto-switched to Board ${boardsRef.current[newFocusIndex].boardNumber}`,
            });
          }
          // Send focus acknowledgment so timer starts on the new board
          // Use matchIdRef to get current value (avoids stale closure)
          const currentMatchId = matchIdRef.current;
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && currentMatchId) {
            wsRef.current.send(JSON.stringify({
              type: 'simul_focus_ack',
              matchId: currentMatchId,
              pairingId: data.pairingId,
            }));
          }
        }
        break;
        
      case 'simul_timer_state':
        updateBoardsFn(prevBoards => {
          const boardIndex = prevBoards.findIndex(b => b.pairingId === data.pairingId);
          if (boardIndex === -1) return prevBoards;
          
          const newBoards = [...prevBoards];
          const board = newBoards[boardIndex];
          const playerColor = board.color;
          const timeRemaining = playerColor === 'white' ? data.whiteTimeRemaining : data.blackTimeRemaining;
          
          newBoards[boardIndex] = {
            ...board,
            timeRemaining: data.isPaused ? board.timeRemaining : timeRemaining,
          };
          
          return newBoards;
        });
        break;
        
      case 'simul_bot_turn':
        {
          const { pairingId, botId, personality, difficulty, fen, moveCount, botColor, moves } = data;
          const expectedMoveCount = moveCount;
          console.log(`[SimulBot] Received bot turn notification for pairing ${pairingId}, bot: ${botId}, moveCount: ${moveCount}`);
          
          // Check if game is still valid (treat empty/falsy result as ongoing)
          const isGameOngoing = (result: string | undefined | null): boolean => {
            return !result || result === 'ongoing' || result === '';
          };
          
          // Build lastMove info for recapture detection
          const buildLastMoveInfo = (): LastMoveInfo | undefined => {
            if (!moves || moves.length === 0) return undefined;
            try {
              // Replay moves to get the last move details
              const tempGame = new Chess();
              for (const m of moves) {
                tempGame.move(m);
              }
              const history = tempGame.history({ verbose: true });
              if (history.length === 0) return undefined;
              const lastMove = history[history.length - 1];
              return {
                from: lastMove.from,
                to: lastMove.to,
                captured: lastMove.captured,
                capturedValue: lastMove.captured ? PIECE_VALUES_SIMUL[lastMove.captured] : undefined
              };
            } catch {
              return undefined;
            }
          };
          
          const lastMoveInfo = buildLastMoveInfo();
          
          // Calculate human-like delay for simul mode (30-second per-turn timer)
          // Priority order:
          // 1. Recapture available → 1 second
          // 2. Piece count determines endgame (longer delays since 30s timer)
          // 3. Move count determines opening/middlegame
          const calculateBotDelay = (mc: number, fenStr: string, bColor: 'white' | 'black', lm: LastMoveInfo | undefined): number => {
            // 1. Recapture - quick reflexive move
            if (detectRecapture(lm, fenStr)) {
              return 1000;
            }
            
            // 2. Check piece count for endgame phases
            const pieceCount = countBotPieces(fenStr, bColor);
            
            if (pieceCount === 1) {
              // Lone king - no choices, instant move
              return 1000;
            } else if (pieceCount >= 2 && pieceCount <= 5) {
              // Endgame low - simplified calculation
              return 3000 + Math.random() * 2000; // 3-5s
            } else if (pieceCount >= 6 && pieceCount <= 10) {
              // Endgame mid - moderate calculation
              return 3000 + Math.random() * 4000; // 3-7s
            }
            
            // 3. Full board (11-16 pieces) - use move count
            if (mc <= 5) {
              // Opening - quick book moves
              return 1000;
            } else if (mc <= 10) {
              // Early development
              return 2000 + Math.random() * 2000; // 2-4s
            }
            
            // Middlegame - deep thinking
            return 3000 + Math.random() * 7000; // 3-10s
          };
          
          const delay = calculateBotDelay(moveCount, fen, botColor as 'white' | 'black', lastMoveInfo);
          
          setTimeout(async () => {
            try {
              // Verify board state hasn't changed (game still ongoing, moveCount matches)
              const board = boardsRef.current.find(b => b.pairingId === pairingId);
              if (!board || !isGameOngoing(board.result)) {
                console.log(`[SimulBot] Cancelling bot move - game ended or board not found for pairing ${pairingId}`);
                return;
              }
              if (board.moveCount !== expectedMoveCount) {
                console.log(`[SimulBot] Cancelling bot move - moveCount mismatch (expected ${expectedMoveCount}, got ${board.moveCount})`);
                return;
              }
              
              const botMove = await generateBotMoveClient(
                fen,
                personality as BotPersonality,
                difficulty as BotDifficulty,
                undefined,
                moveCount
              );
              
              if (botMove && wsRef.current?.readyState === WebSocket.OPEN) {
                // Final check before sending - game might have ended during calculation
                const boardIndex = boardsRef.current.findIndex(b => b.pairingId === pairingId);
                const finalBoard = boardIndex !== -1 ? boardsRef.current[boardIndex] : null;
                if (!finalBoard || !isGameOngoing(finalBoard.result)) {
                  console.log(`[SimulBot] Cancelling bot move - game ended during calculation for pairing ${pairingId}`);
                  return;
                }
                
                console.log(`[SimulBot] Sending bot move result: ${botMove.move}`);
                
                // Create new Chess instance and apply the bot move
                const game = new Chess(fen);
                const moveResult = game.move({ from: botMove.from, to: botMove.to, promotion: botMove.promotion });
                if (!moveResult) {
                  console.error(`[SimulBot] Invalid bot move: ${botMove.move}`);
                  return;
                }
                const newFen = game.fen();
                const newActiveColor = game.turn() === 'w' ? 'white' : 'black';
                
                // CRITICAL: Increment from current board's moveCount, not game.history().length
                // game.history() only contains 1 move (the new one) since we created a fresh Chess from FEN
                const newMoveCount = finalBoard.moveCount + 1;
                const newMoves = [...finalBoard.moves, botMove.move];
                
                // CRITICAL FIX: Apply bot move to local state FIRST (optimistic update)
                // This ensures the local moveCount is in sync before the server responds
                const updatedBoards = [...boardsRef.current];
                updatedBoards[boardIndex] = {
                  ...finalBoard,
                  fen: newFen,
                  moves: newMoves,
                  moveCount: newMoveCount,
                  activeColor: newActiveColor as 'white' | 'black',
                  chess: game,
                  lastMove: { from: botMove.from, to: botMove.to },
                  turnStartTime: Date.now(),
                };
                
                // Update ref immediately, then trigger React state update
                boardsRef.current = updatedBoards;
                setBoards(updatedBoards);
                
                console.log(`[SimulBot] Applied bot move locally: moveCount ${finalBoard.moveCount} -> ${newMoveCount}`);
                
                // Now send to server
                wsRef.current.send(JSON.stringify({
                  type: 'simul_bot_move_result',
                  pairingId,
                  move: botMove.move,
                  from: botMove.from,
                  to: botMove.to,
                  promotion: botMove.promotion,
                  fen: newFen,
                }));
              }
            } catch (error) {
              console.error(`[SimulBot] Error calculating bot move for pairing ${pairingId}:`, error);
            }
          }, delay);
        }
        break;
        
      case 'simul_game_end':
        {
          const board = boardsRef.current.find(b => b.pairingId === data.pairingId);
          
          updateBoardsFn(prevBoards => {
            const idx = prevBoards.findIndex(b => b.pairingId === data.pairingId);
            if (idx === -1) return prevBoards;
            
            const newBoards = [...prevBoards];
            newBoards[idx] = {
              ...newBoards[idx],
              result: data.result,
              gameId: data.gameId,
            };
            
            return newBoards;
          });
          
          // Show toast for individual board completion (non-blocking)
          if (board) {
            toast({
              title: `Board #${board.boardNumber} - Game Over`,
              description: `vs ${board.opponentName}: ${data.result}`,
            });
          }
        }
        break;
        
      case 'simul_match_complete':
        setMatchComplete(true);
        setShowMatchEndDialog(true);
        setMatchStats({
          ratingChange: data.ratingChange || 0,
          humanGamesPlayed: data.humanGamesPlayed || 0,
          wins: data.wins || 0,
          losses: data.losses || 0,
          draws: data.draws || 0,
        });
        break;
        
      case 'simul_draw_offer':
        {
          const { pairingId } = data;
          setIncomingDrawOffers(prev => new Set([...prev, pairingId]));
          const board = boardsRef.current.find(b => b.pairingId === pairingId);
          toast({
            title: "Draw offer received",
            description: `${board?.opponentName || 'Opponent'} offers a draw on Board #${board?.boardNumber || '?'}`,
          });
        }
        break;
        
      case 'simul_draw_response':
        {
          const { pairingId, accepted } = data;
          // Clear pending states
          setPendingDrawOffers(prev => {
            const newSet = new Set(prev);
            newSet.delete(pairingId);
            return newSet;
          });
          setIncomingDrawOffers(prev => {
            const newSet = new Set(prev);
            newSet.delete(pairingId);
            return newSet;
          });
          const board = boardsRef.current.find(b => b.pairingId === pairingId);
          if (!accepted) {
            toast({
              title: "Draw declined",
              description: `Draw offer on Board #${board?.boardNumber || '?'} was declined`,
              variant: "destructive",
            });
          }
        }
        break;
        
      case 'simul_move_confirmed':
        break;
        
      case 'simul_switch_confirmed':
        setFocusedPairingId(data.pairingId);
        const switchedIndex = boardsRef.current.findIndex(b => b.pairingId === data.pairingId);
        if (switchedIndex >= 0) {
          setActiveBoard(switchedIndex);
        }
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'simul_focus_ack',
            matchId: data.matchId,
            pairingId: data.pairingId,
          }));
        }
        break;
        
      case 'simul_focus_resync':
        setFocusedPairingId(data.correctPairingId);
        const resyncIndex = boardsRef.current.findIndex(b => b.pairingId === data.correctPairingId);
        if (resyncIndex >= 0) {
          setActiveBoard(resyncIndex);
          toast({
            title: "Focus resynced",
            description: `Synced to Board ${boardsRef.current[resyncIndex].boardNumber}`,
          });
        }
        break;
        
      case 'error':
        toast({
          title: "Error",
          description: data.message,
          variant: "destructive",
        });
        break;
    }
  }, [boards, toast]);
  
  const joinQueueMutation = useMutation({
    mutationFn: async (data: { boardCount: number }) => {
      const response = await apiRequest("POST", "/api/simul-vs-simul/queue/join", data);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.inMatch) {
        setMatchId(data.matchId);
        joinMatch(data.matchId);
      } else if (data.matchFound) {
        setMatchId(data.matchId);
        joinMatch(data.matchId);
      } else if (data.inQueue) {
        setInQueue(true);
        setQueueInfo({
          playersInQueue: data.playersInQueue,
          playersNeeded: data.playersNeeded,
        });
        toast({
          title: "Joined queue",
          description: `Waiting for ${data.playersNeeded - data.playersInQueue} more player(s)`,
        });
        startQueuePolling();
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to join queue",
        variant: "destructive",
      });
    },
  });
  
  const leaveQueueMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/simul-vs-simul/queue/leave");
      return response.json();
    },
    onSuccess: () => {
      setInQueue(false);
      setQueueInfo(null);
      if (queuePollRef.current) {
        clearInterval(queuePollRef.current);
      }
      toast({
        title: "Left queue",
      });
    },
  });
  
  // Settings mutations for voice options with optimistic updates
  const updateSettingsMutation = useMutation({
    mutationFn: async (settings: Record<string, any>) => {
      const response = await apiRequest("PATCH", "/api/settings", settings);
      return response.json();
    },
    onMutate: async (newSettings) => {
      await queryClient.cancelQueries({ queryKey: ["/api/settings"] });
      const previousSettings = queryClient.getQueryData(["/api/settings"]);
      queryClient.setQueryData(["/api/settings"], (old: any) => ({
        ...old,
        ...newSettings,
      }));
      return { previousSettings };
    },
    onError: (err, newSettings, context) => {
      if (context?.previousSettings) {
        queryClient.setQueryData(["/api/settings"], context.previousSettings);
      }
      toast({
        title: "Error",
        description: "Failed to save setting",
        variant: "destructive",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
    },
  });
  
  const startQueuePolling = () => {
    if (queuePollRef.current) {
      clearInterval(queuePollRef.current);
    }
    
    queuePollRef.current = setInterval(async () => {
      try {
        const response = await apiRequest("GET", `/api/simul-vs-simul/queue/status?boardCount=${boardCount}`);
        const data = await response.json();
        
        if (data.inMatch) {
          setInQueue(false);
          setMatchId(data.matchId);
          joinMatch(data.matchId);
          if (queuePollRef.current) {
            clearInterval(queuePollRef.current);
          }
        } else if (data.inQueue) {
          setQueueInfo({
            playersInQueue: data.playersInQueue,
            playersNeeded: data.playersNeeded,
          });
        }
      } catch (error) {
        console.error('Queue poll error:', error);
      }
    }, 2000);
  };
  
  const joinMatch = (mId: string) => {
    connectWebSocket();
    
    const checkWsAndJoin = () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'simul_join',
          matchId: mId,
        }));
        setMatchId(mId);
      } else {
        setTimeout(checkWsAndJoin, 100);
      }
    };
    
    checkWsAndJoin();
  };
  
  const handleFindMatch = () => {
    const count = parseInt(boardCount);
    joinQueueMutation.mutate({ boardCount: count });
  };
  
  const handleLeaveQueue = () => {
    leaveQueueMutation.mutate();
  };
  
  const handleBoardSwitch = (index: number) => {
    if (index < 0 || index >= boards.length) return;
    
    const targetPairingId = boards[index].pairingId;
    
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'simul_switch_board',
        matchId,
        pairingId: targetPairingId,
      }));
    }
    
    setActiveBoard(index);
    setFocusedPairingId(targetPairingId);
    setSelectedSquare(null);
    setLegalMoves([]);
  };
  
  const handleResignBoard = useCallback((boardIndex: number, showToast: boolean = true) => {
    const board = boardsRef.current[boardIndex];
    if (!board || board.result !== 'ongoing') return;
    if (matchComplete || promotionPendingRef.current) return;
    
    const result = board.color === 'white' ? 'black_win' : 'white_win';
    
    updateBoardsFn(prev => {
      const newBoards = [...prev];
      newBoards[boardIndex] = { ...newBoards[boardIndex], result };
      return newBoards;
    });
    
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'simul_game_result',
        pairingId: board.pairingId,
        result,
        reason: 'resignation',
        thinkingTimes: board.thinkingTimes,
      }));
    }
    
    if (showToast) {
      toast({
        title: "Board Resigned",
        description: `You resigned on Board #${board.boardNumber}`,
      });
    }
  }, [updateBoardsFn, toast, matchComplete]);
  
  const handleResignAllBoards = useCallback(() => {
    if (matchComplete || promotionPendingRef.current) return;
    
    const ongoingBoards = boardsRef.current.filter(b => b.result === 'ongoing');
    if (ongoingBoards.length === 0) return;
    
    ongoingBoards.forEach((board) => {
      const boardIndex = boardsRef.current.findIndex(b => b.pairingId === board.pairingId);
      if (boardIndex >= 0) {
        handleResignBoard(boardIndex, false);
      }
    });
    
    toast({
      title: "All Boards Resigned",
      description: `You resigned on ${ongoingBoards.length} board(s)`,
    });
  }, [handleResignBoard, toast, matchComplete]);
  
  // Handle draw offers
  const handleOfferDraw = useCallback((pairingId: string) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      toast({
        title: "Connection error",
        description: "Unable to send draw offer. Please check your connection.",
        variant: "destructive",
      });
      return;
    }
    
    wsRef.current.send(JSON.stringify({
      type: 'simul_offer_draw',
      pairingId,
    }));
    
    setPendingDrawOffers(prev => new Set([...prev, pairingId]));
    toast({
      title: "Draw offered",
      description: "Waiting for opponent's response",
    });
  }, [toast]);
  
  const handleRespondDraw = useCallback((pairingId: string, accepted: boolean) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      toast({
        title: "Connection error",
        description: "Unable to respond to draw offer. Please check your connection.",
        variant: "destructive",
      });
      return;
    }
    
    wsRef.current.send(JSON.stringify({
      type: 'simul_respond_draw',
      pairingId,
      accepted,
    }));
    
    setIncomingDrawOffers(prev => {
      const newSet = new Set(prev);
      newSet.delete(pairingId);
      return newSet;
    });
  }, [toast]);
  
  // Check if a move is a pawn promotion
  const isPromotionMove = (chess: Chess, from: string, to: string): boolean => {
    const piece = chess.get(from as any);
    if (!piece || piece.type !== 'p') return false;
    
    const toRank = to[1];
    const isWhitePromotion = piece.color === 'w' && toRank === '8';
    const isBlackPromotion = piece.color === 'b' && toRank === '1';
    
    return isWhitePromotion || isBlackPromotion;
  };
  
  // Execute a move with optional promotion piece
  // Uses async/await to ensure move is saved to database before sending game result
  const executeMove = async (boardIndex: number, from: string, to: string, promotion?: string) => {
    // Use boardsRef to get the latest state (avoids stale closure issues)
    const currentBoard = boardsRef.current[boardIndex];
    if (!currentBoard) return;
    
    const chess = currentBoard.chess;
    
    try {
      const move = chess.move({
        from,
        to,
        promotion: promotion || undefined,
      });
      
      if (move) {
        const newFen = chess.fen();
        const newActiveColor = chess.turn() === 'w' ? 'white' : 'black';
        
        // Record thinking time for this move (preserve decimal precision)
        const thinkingTime = (Date.now() - currentBoard.turnStartTime) / 1000;
        const newThinkingTimes = [...currentBoard.thinkingTimes, thinkingTime];
        
        // Use boardsRef.current to build updated boards (ensures latest state)
        const updatedBoards = [...boardsRef.current];
        updatedBoards[boardIndex] = {
          ...currentBoard,
          fen: newFen,
          moves: chess.history(),
          moveCount: chess.history().length,
          activeColor: newActiveColor as 'white' | 'black',
          chess,
          lastMove: { from: move.from, to: move.to },
          thinkingTimes: newThinkingTimes,
          turnStartTime: Date.now(), // Reset for opponent's turn
        };
        
        // Determine if this move ends the game
        const isGameEnding = chess.isCheckmate() || chess.isDraw() || chess.isStalemate();
        let gameResult: 'white_win' | 'black_win' | 'draw' | null = null;
        let gameEndReason: string | null = null;
        
        if (chess.isCheckmate()) {
          gameResult = chess.turn() === 'w' ? 'black_win' : 'white_win';
          gameEndReason = 'checkmate';
          updatedBoards[boardIndex].result = gameResult;
        } else if (chess.isDraw() || chess.isStalemate()) {
          gameResult = 'draw';
          gameEndReason = chess.isStalemate() ? 'stalemate' : 'draw';
          updatedBoards[boardIndex].result = 'draw';
        }
        
        // For game-ending moves, use REST API and await completion before sending game result
        // This prevents race condition where game result is processed before final move is saved
        if (isGameEnding) {
          try {
            await apiRequest('POST', '/api/simul-vs-simul/move', {
              pairingId: currentBoard.pairingId,
              move: move.san,
              fen: newFen,
            });
            
            // Move is now saved - send WebSocket notification for opponent, then game result
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              // Notify opponent of the move
              wsRef.current.send(JSON.stringify({
                type: 'simul_move',
                pairingId: currentBoard.pairingId,
                move: move.san,
                fen: newFen,
                from: move.from,
                to: move.to,
                piece: move.piece,
                captured: move.captured,
                promotion: move.promotion,
              }));
              
              // Now send game result with thinking times
              if (gameResult && gameEndReason) {
                wsRef.current.send(JSON.stringify({
                  type: 'simul_game_result',
                  pairingId: currentBoard.pairingId,
                  result: gameResult,
                  reason: gameEndReason,
                  thinkingTimes: newThinkingTimes,
                }));
              }
            }
          } catch (error) {
            console.error('Failed to save game-ending move:', error);
            // Still send via WebSocket as fallback
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({
                type: 'simul_move',
                pairingId: currentBoard.pairingId,
                move: move.san,
                fen: newFen,
                from: move.from,
                to: move.to,
                piece: move.piece,
                captured: move.captured,
                promotion: move.promotion,
              }));
              if (gameResult && gameEndReason) {
                wsRef.current.send(JSON.stringify({
                  type: 'simul_game_result',
                  pairingId: currentBoard.pairingId,
                  result: gameResult,
                  reason: gameEndReason,
                  thinkingTimes: newThinkingTimes,
                }));
              }
            }
          }
        } else {
          // Non-game-ending move: use WebSocket for speed
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
              type: 'simul_move',
              pairingId: currentBoard.pairingId,
              move: move.san,
              fen: newFen,
              from: move.from,
              to: move.to,
              piece: move.piece,
              captured: move.captured,
              promotion: move.promotion,
            }));
          }
        }
        
        // Update both state and ref immediately for consistency
        boardsRef.current = updatedBoards;
        setBoards(updatedBoards);
        setSelectedSquare(null);
        setLegalMoves([]);
        
        // Clear promotion pending state
        promotionPendingRef.current = false;
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'simul_promotion_status',
            matchId,
            pending: false,
          }));
        }
      }
    } catch (e) {
      console.error('Move execution error:', e);
    }
  };
  
  // Handle promotion piece selection
  const handlePromotionSelect = (piece: 'q' | 'r' | 'b' | 'n') => {
    if (!pendingPromotion) return;
    
    executeMove(pendingPromotion.boardIndex, pendingPromotion.from, pendingPromotion.to, piece);
    setPendingPromotion(null);
    setShowPromotionDialog(false);
  };
  
  const handleSquareClick = (square: string) => {
    const currentBoard = boards[activeBoard];
    if (!currentBoard || currentBoard.result !== 'ongoing') return;
    
    const isMyTurn = currentBoard.activeColor === currentBoard.color;
    if (!isMyTurn) {
      toast({
        title: "Not your turn",
        description: "Wait for your opponent to move",
        variant: "destructive",
      });
      return;
    }
    
    const chess = currentBoard.chess;
    
    if (selectedSquare) {
      // Check if this is a valid move
      const validMoves = chess.moves({ square: selectedSquare as any, verbose: true });
      const isValidMove = validMoves.some((m: any) => m.to === square);
      
      if (isValidMove) {
        // Check if this is a promotion move
        if (isPromotionMove(chess, selectedSquare, square)) {
          // Show promotion dialog instead of auto-promoting
          setPendingPromotion({
            from: selectedSquare,
            to: square,
            boardIndex: activeBoard,
          });
          setShowPromotionDialog(true);
          promotionPendingRef.current = true;
          
          // Notify server that promotion is pending (block auto-switch)
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
              type: 'simul_promotion_status',
              matchId,
              pending: true,
            }));
          }
          return;
        }
        
        // Regular move
        executeMove(activeBoard, selectedSquare, square);
      } else {
        // Clicked on different piece, select it if it has moves
        const moves = chess.moves({ square: square as any, verbose: true });
        if (moves.length > 0) {
          setSelectedSquare(square);
          setLegalMoves(moves.map((m: any) => m.to));
        } else {
          setSelectedSquare(null);
          setLegalMoves([]);
        }
      }
    } else {
      const moves = chess.moves({ square: square as any, verbose: true });
      if (moves.length > 0) {
        setSelectedSquare(square);
        setLegalMoves(moves.map((m: any) => m.to));
      }
    }
  };
  
  const getResultDisplay = (result: string, playerColor: string) => {
    if (result === 'ongoing') return null;
    if (result === 'draw') return { text: 'Draw', variant: 'secondary' as const };
    if (result === `${playerColor}_win`) return { text: 'Won', variant: 'default' as const };
    return { text: 'Lost', variant: 'destructive' as const };
  };
  
  const getScoreSummary = () => {
    let wins = 0, losses = 0, draws = 0;
    boards.forEach(board => {
      const result = getResultDisplay(board.result, board.color);
      if (result?.text === 'Won') wins++;
      else if (result?.text === 'Lost') losses++;
      else if (result?.text === 'Draw') draws++;
    });
    return { wins, losses, draws };
  };
  
  const activeGame = boards[activeBoard];
  const isMyTurn = activeGame?.activeColor === activeGame?.color;
  
  return (
    <div className="h-full flex" data-testid="page-simul-vs-simul">
      <Helmet>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      {/* Main Content Area - LEFT */}
      <div className="flex-1 flex flex-col p-4 md:p-8 bg-muted/30 overflow-auto">
        {!gameStarted ? (
          <div className="flex-1 flex items-center justify-center">
            {!inQueue ? (
              <Card className="w-full max-w-md">
                <CardContent className="pt-6 space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold mb-2">Simul vs Simul</h2>
                    <p className="text-muted-foreground">
                      Round-robin where everyone plays everyone simultaneously
                    </p>
                  </div>
                  <SuspensionBanner />
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Number of Boards (per player)</label>
                    <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                      <span className="font-medium" data-testid="text-board-count">5 boards</span>
                      <span className="text-muted-foreground">(6 players)</span>
                    </div>
                  </div>
                  
                  <div className="space-y-3 pt-2 border-t">
                    <h4 className="font-semibold text-sm">Voice Input</h4>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="voice-commands" className="text-sm cursor-pointer">
                          Voice Commands
                        </Label>
                        <p className="text-xs text-muted-foreground">Speak your moves instead of clicking</p>
                      </div>
                      <Switch
                        id="voice-commands"
                        checked={userSettings?.voiceInputEnabled || false}
                        onCheckedChange={(checked) => updateSettingsMutation.mutate({ voiceInputEnabled: checked })}
                        disabled={updateSettingsMutation.isPending}
                        data-testid="switch-voice-input"
                      />
                    </div>
                  </div>
                  
                  <div className="p-4 bg-muted rounded-lg space-y-2">
                    <h4 className="font-semibold text-sm">How It Works</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Each player plays N games against N opponents</li>
                      <li>• 30-second timer per move (only when viewing that board)</li>
                      <li>• Auto-switch to next board needing attention</li>
                      <li>• Random color assignment per game</li>
                      <li>• Timer pauses when you switch boards</li>
                    </ul>
                  </div>
                  <Button
                    onClick={handleFindMatch}
                    className="w-full"
                    size="lg"
                    disabled={joinQueueMutation.isPending}
                    data-testid="button-find-match"
                  >
                    <Play className="mr-2 h-4 w-4" />
                    Find Match
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card className="w-full max-w-md">
                <CardContent className="pt-6 space-y-4 text-center">
                  <h2 className="text-xl font-semibold">Waiting for Players</h2>
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                  </div>
                  {queueInfo && (
                    <div className="space-y-2">
                      <p className="text-muted-foreground">
                        {queueInfo.playersInQueue} / {queueInfo.playersNeeded} players
                      </p>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className="bg-primary rounded-full h-2 transition-all"
                          style={{ width: `${(queueInfo.playersInQueue / queueInfo.playersNeeded) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground">
                    Need {(queueInfo?.playersNeeded || parseInt(boardCount) + 1) - (queueInfo?.playersInQueue || 0)} more player(s) to start
                  </p>
                  <p className="text-xs text-muted-foreground italic">
                    {queueCountdown > 0 
                      ? `Filling with bots in ${queueCountdown}s...`
                      : "Filling with bots now..."}
                  </p>
                  <Button
                    variant="outline"
                    onClick={handleLeaveQueue}
                    disabled={leaveQueueMutation.isPending}
                    data-testid="button-leave-queue"
                  >
                    Cancel
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        ) : activeGame ? (
          <div className="w-full max-w-3xl mx-auto space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Badge variant={activeGame.color === 'white' ? 'outline' : 'secondary'}>
                  {activeGame.color}
                </Badge>
                {activeGame.result === 'ongoing' && (
                  <Badge variant={isMyTurn ? 'default' : 'secondary'}>
                    {isMyTurn ? 'Your turn' : "Opponent's turn"}
                  </Badge>
                )}
                {activeGame.result === 'ongoing' && isMyTurn && (
                  <div className="flex items-center gap-1 text-lg font-mono" data-testid="text-timer">
                    <Clock className="h-4 w-4" />
                    <span className={activeGame.timeRemaining <= 10 ? 'text-red-500 font-bold' : ''}>
                      {activeGame.timeRemaining}s
                    </span>
                  </div>
                )}
                {isVoiceListening && userSettings?.voiceInputEnabled && (
                  <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400" data-testid="voice-listening-indicator">
                    <Mic className="h-3 w-3 animate-pulse" />
                    <span>Listening{voiceTranscript ? `: "${voiceTranscript}"` : "..."}</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleBoardSwitch(activeBoard - 1)}
                  disabled={!matchComplete || activeBoard === 0}
                  data-testid="button-prev-board"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="text-center">
                  <h3 className="font-semibold" data-testid="text-active-board">
                    Board #{activeGame.boardNumber}
                  </h3>
                  <span className="text-sm text-muted-foreground" data-testid="text-active-opponent">
                    vs {activeGame.opponentName}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleBoardSwitch(activeBoard + 1)}
                  disabled={!matchComplete || activeBoard === boards.length - 1}
                  data-testid="button-next-board"
                >
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="w-full aspect-square">
              <ChessBoard
                fen={activeGame.fen}
                orientation={activeGame.color}
                onSquareClick={activeGame.result === 'ongoing' && isMyTurn ? handleSquareClick : undefined}
                selectedSquare={selectedSquare}
                legalMoveSquares={legalMoves}
                lastMoveSquares={activeGame.lastMove ? [activeGame.lastMove.from, activeGame.lastMove.to] : []}
                customHighlightColors={highlightColors}
              />
            </div>
            {activeGame.result !== 'ongoing' && (
              <div className="flex items-center justify-center gap-4">
                <Badge
                  variant={getResultDisplay(activeGame.result, activeGame.color)?.variant || 'secondary'}
                  className="text-lg px-4 py-1"
                >
                  {getResultDisplay(activeGame.result, activeGame.color)?.text || activeGame.result}
                </Badge>
                {activeGame.gameId && (
                  <Button
                    variant="outline"
                    onClick={() => setLocation(`/analysis/${activeGame.gameId}${matchId ? `?matchId=${matchId}` : ''}`)}
                    data-testid="button-analyze-main"
                  >
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Analyze Game
                  </Button>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            Loading boards...
          </div>
        )}
      </div>
      
      {/* Mobile sidebar toggle button */}
      {gameStarted && (
        <Button
          variant="outline"
          size="icon"
          className="fixed bottom-4 right-4 z-50 md:hidden shadow-lg"
          onClick={() => setShowMobileSidebar(!showMobileSidebar)}
          data-testid="button-mobile-sidebar-toggle"
        >
          <Menu className="h-5 w-5" />
        </Button>
      )}
      
      {/* Mobile overlay */}
      {gameStarted && showMobileSidebar && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setShowMobileSidebar(false)}
          data-testid="overlay-mobile-sidebar"
        />
      )}
      
      {/* Sidebar - RIGHT, only when game started */}
      {gameStarted && (
        <div 
          className={cn(
            "w-80 border-l bg-card flex flex-col",
            "fixed md:relative inset-y-0 right-0 z-40",
            "transform transition-transform duration-300 ease-in-out",
            "md:transform-none",
            showMobileSidebar ? "translate-x-0" : "translate-x-full md:translate-x-0"
          )} 
          data-testid="sidebar-other-games"
        >
          <div className="p-4 border-b space-y-3">
            <div className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-primary" />
              <h3 className="font-semibold flex-1" data-testid="text-match-title">
                Simul vs Simul
              </h3>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden h-8 w-8"
                onClick={() => setShowMobileSidebar(false)}
                data-testid="button-close-sidebar"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                <span>{boards.length + 1} Players</span>
              </div>
              <div className="flex items-center gap-1" data-testid="text-score">
                {getScoreSummary().wins}W · {getScoreSummary().losses}L · {getScoreSummary().draws}D
              </div>
            </div>
            {/* Draw offer and Resign buttons at top for visibility */}
            {!matchComplete && boards.some(b => b.result === 'ongoing') && (
              <div className="space-y-2 pt-2">
                {/* Incoming draw offer - accept/decline UI */}
                {activeGame?.result === 'ongoing' && incomingDrawOffers.has(activeGame.pairingId) && (
                  <div className="flex items-center gap-2 p-2 bg-yellow-500/10 border border-yellow-500/30 rounded-md">
                    <Handshake className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                    <span className="text-sm flex-1">Draw offered</span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2"
                      onClick={() => handleRespondDraw(activeGame.pairingId, true)}
                      data-testid="button-accept-draw"
                    >
                      <Check className="h-4 w-4 text-green-600" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2"
                      onClick={() => handleRespondDraw(activeGame.pairingId, false)}
                      data-testid="button-decline-draw"
                    >
                      <X className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                )}
                <div className="flex gap-2">
                  {activeGame?.result === 'ongoing' && !activeGame.isOpponentBot && !pendingDrawOffers.has(activeGame.pairingId) && !incomingDrawOffers.has(activeGame.pairingId) && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleOfferDraw(activeGame.pairingId)}
                      data-testid="button-offer-draw"
                    >
                      <Handshake className="h-4 w-4 mr-2" />
                      Offer Draw
                    </Button>
                  )}
                  {activeGame?.result === 'ongoing' && pendingDrawOffers.has(activeGame.pairingId) && (
                    <Badge variant="secondary" className="flex-1 justify-center py-1.5">
                      <Handshake className="h-4 w-4 mr-2" />
                      Draw pending...
                    </Badge>
                  )}
                  {activeGame?.result === 'ongoing' && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => setShowResignDialog('board')}
                      data-testid="button-resign-board-sidebar"
                    >
                      <Flag className="h-4 w-4 mr-2" />
                      Resign
                    </Button>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setShowResignDialog('all')}
                  data-testid="button-resign-all-top"
                >
                  <Flag className="h-4 w-4 mr-2" />
                  Resign All Boards
                </Button>
              </div>
            )}
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-2">
              {boards.map((board, index) => {
                const resultDisplay = getResultDisplay(board.result, board.color);
                const isActive = index === activeBoard;
                const isPlayerTurn = board.activeColor === board.color && board.result === 'ongoing';
                return (
                  <Card
                    key={board.pairingId}
                    className={cn(
                      "transition-all cursor-pointer hover-elevate",
                      isActive && "border-primary ring-2 ring-primary/20",
                      isPlayerTurn && !isActive && "border-yellow-500/50"
                    )}
                    onClick={() => handleBoardSwitch(index)}
                    data-testid={`card-board-${index}`}
                  >
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
                            #{board.boardNumber}
                          </span>
                          <span className="font-medium text-sm" data-testid={`text-opponent-${index}`}>
                            vs {board.opponentName}
                          </span>
                        </div>
                        <Badge variant={board.color === 'white' ? 'outline' : 'secondary'} className="text-xs">
                          {board.color}
                        </Badge>
                      </div>
                      {/* Result badge and Analyze button - positioned between header and move count */}
                      {board.result !== 'ongoing' && (
                        <div className="flex items-center gap-2">
                          {resultDisplay && (
                            <Badge
                              variant={resultDisplay.variant}
                              className="text-xs"
                              data-testid={`badge-result-${index}`}
                            >
                              {resultDisplay.text}
                            </Badge>
                          )}
                          {board.gameId && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                setLocation(`/analysis/${board.gameId}${matchId ? `?matchId=${matchId}` : ''}`);
                              }}
                              data-testid={`button-analyze-${index}`}
                            >
                              <BarChart3 className="h-3 w-3 mr-1" />
                              Analyze
                            </Button>
                          )}
                        </div>
                      )}
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{board.moveCount} moves</span>
                        {board.result === 'ongoing' && (
                          <div className="flex items-center gap-1">
                            {isPlayerTurn ? (
                              <Badge variant="default" className="text-xs animate-pulse">
                                Your turn
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">Waiting...</span>
                            )}
                          </div>
                        )}
                      </div>
                      {board.result === 'ongoing' && isPlayerTurn && isActive && (
                        <div className="flex items-center gap-1 text-xs text-yellow-600 dark:text-yellow-400">
                          <Clock className="h-3 w-3" />
                          <span>{board.timeRemaining}s</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </ScrollArea>
          {matchComplete && (
            <div className="p-4 border-t">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setLocation('/history')}
                data-testid="button-view-history"
              >
                View Game History
              </Button>
            </div>
          )}
        </div>
      )}
      
      {/* Match Complete Dialog */}
      <Dialog open={showMatchEndDialog} onOpenChange={setShowMatchEndDialog}>
        <DialogContent data-testid="dialog-match-end" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Match Complete!</DialogTitle>
            <DialogDescription>
              All games have finished. Review your results below.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {matchStats && matchStats.humanGamesPlayed > 0 && (
              <div className="flex items-center justify-center p-4 rounded-lg bg-muted/50">
                <div className="text-center">
                  <div className="text-sm text-muted-foreground mb-1">Simul Rating Change</div>
                  <div className={cn(
                    "text-3xl font-bold",
                    matchStats.ratingChange > 0 && "text-green-500",
                    matchStats.ratingChange < 0 && "text-red-500",
                    matchStats.ratingChange === 0 && "text-muted-foreground"
                  )} data-testid="text-rating-change">
                    {matchStats.ratingChange > 0 ? '+' : ''}{matchStats.ratingChange}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1" data-testid="text-human-stats">
                    {matchStats.wins}W / {matchStats.draws}D / {matchStats.losses}L
                    {matchStats.humanGamesPlayed < boards.length && (
                      <span> ({matchStats.humanGamesPlayed} rated games)</span>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            {matchStats && matchStats.humanGamesPlayed === 0 && (
              <div className="flex items-center justify-center p-4 rounded-lg bg-muted/50">
                <div className="text-center text-muted-foreground">
                  <div className="text-sm mb-1">No Rating Change</div>
                  <div className="text-xs">Bot games are unrated</div>
                </div>
              </div>
            )}
            
            <div className="space-y-2">
              {boards.map((board, index) => {
                const resultInfo = getResultDisplay(board.result, board.color);
                return (
                  <div 
                    key={board.pairingId}
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Board #{board.boardNumber}</span>
                      <span className="text-sm text-muted-foreground">vs {board.opponentName}</span>
                      {board.isOpponentBot && (
                        <Badge variant="outline" className="text-xs">Bot</Badge>
                      )}
                      {!board.isOpponentBot && board.opponentId && (
                        <ReportPlayerDialog
                          reportedUserId={board.opponentId}
                          reportedUserName={board.opponentName}
                          gameId={board.gameId}
                          trigger={<span className="text-xs text-muted-foreground cursor-pointer hover:underline" data-testid={`link-report-player-simul-${index}`}>Report</span>}
                        />
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={resultInfo?.variant || 'secondary'}>
                        {resultInfo?.text || board.result}
                      </Badge>
                      {board.gameId && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setShowMatchEndDialog(false);
                            setLocation(`/analysis/${board.gameId}${matchId ? `?matchId=${matchId}` : ''}`);
                          }}
                          data-testid={`button-analyze-result-${index}`}
                        >
                          <BarChart3 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowMatchEndDialog(false);
                    if (matchId) {
                      setLocation(`/simul-match/${matchId}/review`);
                    }
                  }}
                  data-testid="button-review-boards"
                >
                  Review Boards
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowMatchEndDialog(false);
                    setLocation('/history');
                  }}
                  data-testid="button-view-history"
                >
                  Game History
                </Button>
              </div>
              <Button
                className="w-full"
                onClick={() => {
                  setShowMatchEndDialog(false);
                  setLocation('/');
                }}
                data-testid="button-main-menu"
              >
                Main Menu
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Pawn Promotion Dialog */}
      <Dialog open={showPromotionDialog} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-promotion" aria-labelledby="promotion-title" aria-describedby="promotion-description">
          <DialogHeader>
            <DialogTitle id="promotion-title">Choose Promotion Piece</DialogTitle>
            <DialogDescription id="promotion-description">
              Your pawn reached the last rank. Select a piece to promote to.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-4 gap-4 py-4" role="group" aria-label="Promotion piece options">
            <Button
              variant="outline"
              className="flex flex-col items-center justify-center h-20"
              onClick={() => handlePromotionSelect('q')}
              data-testid="button-promote-queen"
              aria-label="Promote to Queen"
              autoFocus
            >
              <span className="text-4xl" aria-hidden="true">{pendingPromotion && boards[pendingPromotion.boardIndex]?.color === 'white' ? '♕' : '♛'}</span>
              <span className="text-xs mt-1">Queen</span>
            </Button>
            <Button
              variant="outline"
              className="flex flex-col items-center justify-center h-20"
              onClick={() => handlePromotionSelect('r')}
              data-testid="button-promote-rook"
              aria-label="Promote to Rook"
            >
              <span className="text-4xl" aria-hidden="true">{pendingPromotion && boards[pendingPromotion.boardIndex]?.color === 'white' ? '♖' : '♜'}</span>
              <span className="text-xs mt-1">Rook</span>
            </Button>
            <Button
              variant="outline"
              className="flex flex-col items-center justify-center h-20"
              onClick={() => handlePromotionSelect('b')}
              data-testid="button-promote-bishop"
              aria-label="Promote to Bishop"
            >
              <span className="text-4xl" aria-hidden="true">{pendingPromotion && boards[pendingPromotion.boardIndex]?.color === 'white' ? '♗' : '♝'}</span>
              <span className="text-xs mt-1">Bishop</span>
            </Button>
            <Button
              variant="outline"
              className="flex flex-col items-center justify-center h-20"
              onClick={() => handlePromotionSelect('n')}
              data-testid="button-promote-knight"
              aria-label="Promote to Knight"
            >
              <span className="text-4xl" aria-hidden="true">{pendingPromotion && boards[pendingPromotion.boardIndex]?.color === 'white' ? '♘' : '♞'}</span>
              <span className="text-xs mt-1">Knight</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Resign Confirmation Dialog */}
      <Dialog open={showResignDialog !== null} onOpenChange={(open) => !open && setShowResignDialog(null)}>
        <DialogContent data-testid="dialog-resign-confirm">
          <DialogHeader>
            <DialogTitle>
              {showResignDialog === 'all' ? 'Resign All Boards?' : 'Resign This Board?'}
            </DialogTitle>
            <DialogDescription>
              {showResignDialog === 'all' 
                ? `You are about to resign all ${boards.filter(b => b.result === 'ongoing').length} ongoing game(s). This action cannot be undone.`
                : `You are about to resign on Board #${boards[activeBoard]?.boardNumber || '?'} against ${boards[activeBoard]?.opponentName || 'opponent'}. This action cannot be undone.`
              }
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={() => setShowResignDialog(null)}
              data-testid="button-resign-cancel"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (showResignDialog === 'all') {
                  handleResignAllBoards();
                } else if (showResignDialog === 'board') {
                  handleResignBoard(activeBoard);
                }
                setShowResignDialog(null);
              }}
              data-testid="button-resign-confirm"
            >
              <Flag className="h-4 w-4 mr-2" />
              {showResignDialog === 'all' ? 'Resign All' : 'Resign'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
