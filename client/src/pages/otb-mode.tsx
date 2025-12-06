import { useState, useEffect, useRef, useCallback } from "react";
import { Chess } from "chess.js";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useWebSocket } from "@/hooks/useWebSocket";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ChessBoard } from "@/components/chess-board";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, Play, HandshakeIcon, Flag, AlertTriangle, Settings, Gavel, XCircle, CheckCircle, Trophy, Bot, ChevronLeft, BarChart3 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PromotionDialog } from "@/components/promotion-dialog";
import type { Game } from "@shared/schema";
import type { BotProfile, BotDifficulty, BotPersonality } from "@shared/botTypes";
import { 
  ALL_DIFFICULTIES, 
  ALL_PERSONALITIES, 
  BOT_DIFFICULTY_ELO, 
  BOT_DIFFICULTY_NAMES,
  BOT_PERSONALITY_NAMES,
  BOT_PERSONALITY_DESCRIPTIONS,
  BOT_PERSONALITY_ICONS,
  getBotByConfig 
} from "@shared/botTypes";

const INITIAL_BOARD = [
  ["r", "n", "b", "q", "k", "b", "n", "r"],
  ["p", "p", "p", "p", "p", "p", "p", "p"],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  ["P", "P", "P", "P", "P", "P", "P", "P"],
  ["R", "N", "B", "Q", "K", "B", "N", "R"],
];

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"];

interface MoveRecord {
  from: string;
  to: string;
  piece: string;
  captured?: string;
  notation: string;
  timestamp: number;
}

export default function OTBMode() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [game, setGame] = useState<Chess | null>(null);
  const [gameId, setGameId] = useState<string | null>(null);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [whiteTime, setWhiteTime] = useState(180);
  const [blackTime, setBlackTime] = useState(180);
  const [activeColor, setActiveColor] = useState<"white" | "black">("white");
  const [playerColor, setPlayerColor] = useState<"white" | "black">("white");
  const [timeControl, setTimeControl] = useState("5");
  const [increment, setIncrement] = useState(0);
  const [moves, setMoves] = useState<MoveRecord[]>([]);
  const [boardState, setBoardState] = useState<(string | null)[][]>(INITIAL_BOARD.map(row => [...row]));
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [clockPresses, setClockPresses] = useState(0);
  const [restoredGame, setRestoredGame] = useState(false);
  const [inQueue, setInQueue] = useState(false);
  const [queueType, setQueueType] = useState<string | null>(null);
  const [opponentTouchedSquare, setOpponentTouchedSquare] = useState<string | null>(null);
  const [lastMoveSquares, setLastMoveSquares] = useState<string[]>([]);
  const [showLegalMoves, setShowLegalMoves] = useState(false);
  const [highlightLastMove, setHighlightLastMove] = useState(true);
  
  const [myViolations, setMyViolations] = useState(0);
  const [opponentViolations, setOpponentViolations] = useState(0);
  const [myFalseClaims, setMyFalseClaims] = useState(0);
  const [opponentFalseClaims, setOpponentFalseClaims] = useState(0);
  const [arbiterPending, setArbiterPending] = useState(false);
  const [arbiterResult, setArbiterResult] = useState<{
    type: "illegal" | "legal" | null;
    message: string;
  } | null>(null);
  const [pendingCheckmate, setPendingCheckmate] = useState<{
    winner: "white" | "black";
    countdown: number;
  } | null>(null);
  const [legalChessGame, setLegalChessGame] = useState<Chess | null>(null);
  const [opponentName, setOpponentName] = useState<string>("Opponent");
  const [opponentRating, setOpponentRating] = useState<number>(1200);
  const [playerRating, setPlayerRating] = useState<number>(1200);
  const [clockTurn, setClockTurn] = useState<"white" | "black">("white");
  const [hasMadeMove, setHasMadeMove] = useState(false);
  const [pendingPromotion, setPendingPromotion] = useState<{
    from: string;
    to: string;
    fromRank: number;
    fromFile: number;
    toRank: number;
    toFile: number;
    piece: string;
    captured: string | null;
  } | null>(null);
  const [gameResult, setGameResult] = useState<"white_win" | "black_win" | "draw" | null>(null);
  
  const [showBotSelection, setShowBotSelection] = useState(false);
  const [selectedBot, setSelectedBot] = useState<BotProfile | null>(null);
  const [isBotGame, setIsBotGame] = useState(false);
  const [botThinking, setBotThinking] = useState(false);
  const [selectedBotDifficulty, setSelectedBotDifficulty] = useState<BotDifficulty | null>(null);
  
  const gameRef = useRef<Chess | null>(null);
  const gameIdRef = useRef<string | null>(null);
  const whiteTimeRef = useRef(180);
  const blackTimeRef = useRef(180);
  const saveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pendingCheckmateRef = useRef<NodeJS.Timeout | null>(null);
  const handleGameEndRef = useRef<((result: "white_win" | "black_win" | "draw") => void) | null>(null);

  useEffect(() => {
    gameRef.current = game;
    gameIdRef.current = gameId;
    whiteTimeRef.current = whiteTime;
    blackTimeRef.current = blackTime;
  }, [game, gameId, whiteTime, blackTime]);

  const squareToIndices = (square: string): { rank: number; file: number } => {
    const file = FILES.indexOf(square[0]);
    const rank = RANKS.indexOf(square[1]);
    return { rank, file };
  };

  const indicesToSquare = (rank: number, file: number): string => {
    return `${FILES[file]}${RANKS[rank]}`;
  };

  const boardToFen = (board: (string | null)[][], turn: "white" | "black"): string => {
    let fen = "";
    for (let rank = 0; rank < 8; rank++) {
      let emptyCount = 0;
      for (let file = 0; file < 8; file++) {
        const piece = board[rank][file];
        if (piece) {
          if (emptyCount > 0) {
            fen += emptyCount;
            emptyCount = 0;
          }
          fen += piece;
        } else {
          emptyCount++;
        }
      }
      if (emptyCount > 0) {
        fen += emptyCount;
      }
      if (rank < 7) fen += "/";
    }
    fen += ` ${turn === "white" ? "w" : "b"} KQkq - 0 1`;
    return fen;
  };

  const getPieceColor = (piece: string | null): "white" | "black" | null => {
    if (!piece) return null;
    return piece === piece.toUpperCase() ? "white" : "black";
  };

  const handleOpponentMove = useCallback((data: { matchId: string; move: string; fen: string; whiteTime: number; blackTime: number; from?: string; to?: string; piece?: string; captured?: string; promotion?: string }) => {
    if (data.matchId !== matchId) return;
    
    console.log('[OTB] Received opponent message:', data.move);
    
    // Handle clock press message - opponent pressed their clock, now it's our turn
    if (data.move === "__CLOCK_PRESS__") {
      console.log('[OTB] Opponent pressed clock, switching turn');
      setClockTurn(playerColor);
      setActiveColor(playerColor);
      setHasMadeMove(false);
      setWhiteTime(data.whiteTime);
      setBlackTime(data.blackTime);
      setOpponentTouchedSquare(null);
      return;
    }
    
    // Handle regular move
    if (data.from && data.to) {
      const { rank: fromRank, file: fromFile } = squareToIndices(data.from);
      const { rank: toRank, file: toFile } = squareToIndices(data.to);
      
      setBoardState(prev => {
        const newBoard = prev.map(row => [...row]);
        const piece = newBoard[fromRank][fromFile];
        newBoard[fromRank][fromFile] = null;
        // If there's a promotion piece, use that instead of the original pawn
        newBoard[toRank][toFile] = data.promotion || piece;
        return newBoard;
      });
      
      setMoves(prev => [...prev, {
        from: data.from!,
        to: data.to!,
        piece: data.piece || "?",
        captured: data.captured,
        notation: data.move,
        timestamp: Date.now(),
      }]);
      
      setLastMoveSquares([data.from, data.to]);
      
      if (data.captured?.toLowerCase() === "k") {
        setPendingCheckmate({
          winner: data.captured === "K" ? "black" : "white",
          countdown: 5,
        });
      }
    }
    
    setWhiteTime(data.whiteTime);
    setBlackTime(data.blackTime);
    setOpponentTouchedSquare(null);
    
    toast({
      title: "Opponent moved",
      description: data.move,
    });
  }, [matchId, toast, playerColor]);

  const handleOpponentTouch = useCallback((data: { matchId: string; square: string }) => {
    if (data.matchId !== matchId) return;
    setOpponentTouchedSquare(data.square);
  }, [matchId]);

  const handleArbiterCall = useCallback((data: { matchId: string; callerId: string; moveIndex: number }) => {
    if (data.matchId !== matchId) return;
    
    setArbiterPending(true);
    toast({
      title: "Arbiter Called!",
      description: "Opponent is disputing the last move...",
    });
  }, [matchId, toast]);

  const handleArbiterRuling = useCallback((data: { 
    matchId: string; 
    ruling: "illegal" | "legal"; 
    violatorId: string;
    timeAdjustment: { white: number; black: number };
    forfeit?: boolean;
    forfeitReason?: string;
  }) => {
    if (data.matchId !== matchId) return;
    
    setArbiterPending(false);
    
    if (data.forfeit) {
      toast({
        title: "Game Over - Forfeit",
        description: data.forfeitReason || "Forfeit due to violations",
        variant: "destructive",
      });
      
      // Use ref to access latest handleGameEnd
      const result = data.violatorId === user?.id ? 
        (playerColor === "white" ? "black_win" : "white_win") : 
        (playerColor === "white" ? "white_win" : "black_win");
      
      if (handleGameEndRef.current) {
        handleGameEndRef.current(result);
      }
      return;
    }
    
    setWhiteTime(prev => prev + data.timeAdjustment.white);
    setBlackTime(prev => prev + data.timeAdjustment.black);
    
    if (data.ruling === "illegal") {
      // Reset the board for BOTH players when a move is ruled illegal
      if (moves.length > 0) {
        const lastMove = moves[moves.length - 1];
        const { rank: fromRank, file: fromFile } = squareToIndices(lastMove.from);
        const { rank: toRank, file: toFile } = squareToIndices(lastMove.to);
        
        setBoardState(prev => {
          const newBoard = prev.map(row => [...row]);
          newBoard[fromRank][fromFile] = lastMove.piece;
          newBoard[toRank][toFile] = lastMove.captured || null;
          return newBoard;
        });
        
        setMoves(prev => prev.slice(0, -1));
        setLastMoveSquares([]);
        setActiveColor(prev => prev === "white" ? "black" : "white");
        setClockTurn(prev => prev === "white" ? "black" : "white");
        setHasMadeMove(false);
      }
      
      if (data.violatorId === user?.id) {
        setMyViolations(prev => prev + 1);
        setArbiterResult({ type: "illegal", message: "Your move was illegal! Opponent gains 2 minutes." });
      } else {
        setOpponentViolations(prev => prev + 1);
        setArbiterResult({ type: "illegal", message: "Opponent's move was illegal! You gain 2 minutes." });
      }
    } else {
      if (data.violatorId === user?.id) {
        setOpponentFalseClaims(prev => prev + 1);
        setArbiterResult({ type: "legal", message: "Move was legal! Opponent made a false claim. You gain 2 minutes." });
      } else {
        setMyFalseClaims(prev => prev + 1);
        setArbiterResult({ type: "legal", message: "Move was legal! False claim - opponent gains 2 minutes." });
      }
    }
    
    setTimeout(() => setArbiterResult(null), 4000);
  }, [matchId, user?.id, playerColor, moves, toast]);

  const handleOpponentGameEnd = useCallback((data: { result: string; reason: string }) => {
    console.log('[OTB] Opponent ended game:', data);
    
    if (saveIntervalRef.current) {
      clearInterval(saveIntervalRef.current);
      saveIntervalRef.current = null;
    }
    
    if (pendingCheckmateRef.current) {
      clearTimeout(pendingCheckmateRef.current);
      pendingCheckmateRef.current = null;
    }
    
    toast({
      title: "Game Over",
      description: data.reason,
    });
    
    // Keep board visible by setting gameResult
    const resultValue = data.result as "white_win" | "black_win" | "draw";
    setGameResult(resultValue);
    setPendingCheckmate(null);
    
    // Invalidate queries to refresh data
    queryClient.invalidateQueries({ queryKey: ["/api/ratings"] });
    queryClient.invalidateQueries({ queryKey: ["/api/games/recent"] });
    queryClient.invalidateQueries({ queryKey: ["/api/statistics"] });
  }, [toast]);

  const { sendMove, sendPieceTouch, sendArbiterCall, sendArbiterRuling, sendGameEnd, joinMatch, isConnected, isAuthenticated } = useWebSocket({
    userId: user?.id,
    matchId: matchId || undefined,
    onMove: handleOpponentMove,
    onPieceTouch: handleOpponentTouch,
    onArbiterCall: handleArbiterCall,
    onArbiterRuling: handleArbiterRuling,
    onGameEnd: handleOpponentGameEnd,
  });

  useEffect(() => {
    if (matchId && isConnected && isAuthenticated) {
      console.log('[OTB] Joining match room:', matchId);
      joinMatch(matchId);
    }
  }, [matchId, isConnected, isAuthenticated, joinMatch]);

  const createGameMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/games", data);
      return await response.json();
    },
    onSuccess: (data: Game) => {
      setGameId(data.id);
      toast({
        title: "Game started",
        description: "Good luck!",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to start game",
        variant: "destructive",
      });
    },
  });

  const updateGameMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!gameId) return;
      await apiRequest("PATCH", `/api/games/${gameId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ratings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/games/recent"] });
      queryClient.invalidateQueries({ queryKey: ["/api/statistics"] });
    },
  });

  const { data: ongoingGame } = useQuery<Game>({
    queryKey: ["/api/games/ongoing"],
    enabled: !restoredGame && !gameStarted && !inQueue,
  });

  const joinQueueMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/queue/join", data);
      return response;
    },
    onSuccess: () => {
      setInQueue(true);
      toast({
        title: "Joined queue",
        description: "Waiting for opponent...",
      });
      pollMatch();
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
    mutationFn: async (data: any) => {
      await apiRequest("POST", "/api/queue/leave", data);
    },
    onSuccess: () => {
      setInQueue(false);
      setQueueType(null);
      toast({
        title: "Left queue",
      });
    },
  });

  const pollMatch = useCallback(async () => {
    let attempts = 0;
    const maxAttempts = 120;
    
    const checkMatch = async () => {
      if (attempts >= maxAttempts) return;
      attempts++;

      try {
        const res = await apiRequest("POST", "/api/queue/findMatch", { queueType });
        const response = await res.json();
        if (response.matched && response.game) {
          if (!response.matchId) {
            toast({
              title: "Match Error",
              description: "Failed to join match room. Please try again.",
              variant: "destructive",
            });
            setInQueue(false);
            return;
          }
          
          setGameId(response.game.id);
          setMatchId(response.matchId);
          
          const chess = new Chess();
          setGame(chess);
          setLegalChessGame(new Chess());
          setBoardState(INITIAL_BOARD.map(row => [...row]));
          setMoves([]);
          setLastMoveSquares([]);
          setSelectedSquare(null);
          setGameResult(null);
          setGameStarted(true);
          setInQueue(false);
          const assignedColor = response.game.playerColor === "white" ? "white" : "black";
          setPlayerColor(assignedColor);
          setActiveColor("white");
          setClockTurn("white");
          
          setWhiteTime(response.game.whiteTime || 300);
          setBlackTime(response.game.blackTime || 300);
          setIncrement(response.game.increment || 0);
          
          setMyViolations(0);
          setOpponentViolations(0);
          setMyFalseClaims(0);
          setOpponentFalseClaims(0);
          setHasMadeMove(false);
          setPendingCheckmate(null);
          setArbiterPending(false);
          setArbiterResult(null);
          
          if (response.opponent) {
            setOpponentName(response.opponent.name || "Opponent");
            setOpponentRating(response.opponent.rating || 1200);
          }
          if (response.playerRating) {
            setPlayerRating(response.playerRating);
          }

          toast({
            title: "Match found!",
            description: `You are playing as ${assignedColor}`,
          });
          return;
        }
      } catch (error) {
        console.error("Error checking match:", error);
      }

      setTimeout(checkMatch, 1000);
    };

    checkMatch();
  }, [queueType, toast]);

  const handleJoinQueue = (time: string) => {
    const queueMap: Record<string, string> = {
      '1': 'otb_bullet',
      '5': 'otb_blitz',
      '15': 'otb_rapid',
      '30': 'otb_classical',
    };

    const queue = queueMap[time];
    setQueueType(queue);
    joinQueueMutation.mutate({ queueType: queue, isBlindfold: false });
  };

  useEffect(() => {
    if (ongoingGame && !restoredGame && !gameStarted && ongoingGame.status === 'active') {
      setGameResult(null);
      setRestoredGame(true);
    }
  }, [ongoingGame, restoredGame, gameStarted]);

  const saveGameState = useCallback(async () => {
    const currentGameId = gameIdRef.current;
    
    if (!currentGameId) return;
    
    try {
      const fen = boardToFen(boardState, activeColor);
      await apiRequest("PATCH", `/api/games/${currentGameId}`, {
        fen,
        moves: moves.map(m => m.notation),
        whiteTime: whiteTimeRef.current,
        blackTime: blackTimeRef.current,
      });
    } catch (error) {
      console.error("Error saving game state:", error);
    }
  }, [boardState, activeColor, moves]);

  const handleGameEnd = useCallback((result: "white_win" | "black_win" | "draw") => {
    if (!gameId) return;

    if (saveIntervalRef.current) {
      clearInterval(saveIntervalRef.current);
      saveIntervalRef.current = null;
    }
    
    if (pendingCheckmateRef.current) {
      clearTimeout(pendingCheckmateRef.current);
      pendingCheckmateRef.current = null;
    }

    const fen = boardToFen(boardState, activeColor);
    
    updateGameMutation.mutate({
      status: "completed",
      result,
      completedAt: new Date(),
      fen,
      moves: moves.map(m => m.notation),
      whiteTime,
      blackTime,
      manualClockPresses: clockPresses,
    });

    toast({
      title: "Game Over",
      description: result === "draw" ? "Game drawn" : result === "white_win" ? "White wins!" : "Black wins!",
    });

    // Keep board visible by setting gameResult instead of immediately hiding
    setGameResult(result);
    setPendingCheckmate(null);
  }, [gameId, boardState, activeColor, updateGameMutation, moves, whiteTime, blackTime, clockPresses, toast]);

  // Keep ref updated with latest handleGameEnd
  useEffect(() => {
    handleGameEndRef.current = handleGameEnd;
  }, [handleGameEnd]);

  useEffect(() => {
    if (pendingCheckmate) {
      if (pendingCheckmate.countdown <= 0) {
        handleGameEnd(pendingCheckmate.winner === "white" ? "white_win" : "black_win");
        return;
      }
      
      pendingCheckmateRef.current = setTimeout(() => {
        setPendingCheckmate(prev => prev ? { ...prev, countdown: prev.countdown - 1 } : null);
      }, 1000);
      
      return () => {
        if (pendingCheckmateRef.current) {
          clearTimeout(pendingCheckmateRef.current);
        }
      };
    }
  }, [pendingCheckmate, handleGameEnd]);

  useEffect(() => {
    if (gameStarted && !pendingCheckmate && !arbiterPending && !gameResult) {
      const timer = setInterval(() => {
        if (clockTurn === "white") {
          setWhiteTime((t) => {
            const newTime = Math.max(0, t - 1);
            if (newTime === 0 && t > 0) {
              handleGameEnd("black_win");
            }
            return newTime;
          });
        } else {
          setBlackTime((t) => {
            const newTime = Math.max(0, t - 1);
            if (newTime === 0 && t > 0) {
              handleGameEnd("white_win");
            }
            return newTime;
          });
        }
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [gameStarted, clockTurn, handleGameEnd, pendingCheckmate, arbiterPending, gameResult]);

  useEffect(() => {
    if (gameStarted && gameId) {
      saveIntervalRef.current = setInterval(() => {
        saveGameState();
      }, 10000);
    }

    return () => {
      if (saveIntervalRef.current) {
        clearInterval(saveIntervalRef.current);
        saveIntervalRef.current = null;
      }
    };
  }, [gameStarted, gameId, saveGameState]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleClockPress = useCallback(() => {
    if (!gameStarted || arbiterPending || pendingCheckmate) return;
    
    // In multiplayer, can only press clock on your turn
    if (matchId && clockTurn !== playerColor) {
      return; // Not your turn, can't press clock
    }
    
    // Must have made a move before pressing clock (in multiplayer)
    if (matchId && !hasMadeMove) {
      toast({
        title: "Make a move first",
        description: "You must make a move before pressing the clock",
        variant: "destructive",
      });
      return;
    }

    if (clockTurn === "white") {
      setWhiteTime((t) => t + increment);
    } else {
      setBlackTime((t) => t + increment);
    }

    const newClockTurn = clockTurn === "white" ? "black" : "white";
    setClockTurn(newClockTurn);
    setActiveColor(newClockTurn);
    setClockPresses(clockPresses + 1);
    setHasMadeMove(false);
    
    // Send clock press to opponent via WebSocket
    if (matchId) {
      sendMove(matchId, "__CLOCK_PRESS__", "", whiteTime, blackTime, undefined);
    }
  }, [gameStarted, clockTurn, increment, clockPresses, arbiterPending, pendingCheckmate, matchId, hasMadeMove, playerColor, toast, sendMove, whiteTime, blackTime]);

  const handleStartGame = () => {
    const minutes = parseInt(timeControl);
    const seconds = minutes * 60;
    
    setWhiteTime(seconds);
    setBlackTime(seconds);
    setIncrement(0);
    setGameResult(null);
    setGameStarted(true);
    
    const newGame = new Chess();
    setGame(newGame);
    setLegalChessGame(new Chess());
    setBoardState(INITIAL_BOARD.map(row => [...row]));
    setMoves([]);
    setActiveColor("white");
    setPlayerColor("white");
    setClockTurn("white");
    setClockPresses(0);
    setMyViolations(0);
    setOpponentViolations(0);
    setMyFalseClaims(0);
    setOpponentFalseClaims(0);
    setOpponentName("Practice Partner");
    setOpponentRating(1200);
    setIsBotGame(false);
    setSelectedBot(null);
    
    const mode = minutes <= 3 ? "otb_bullet" : minutes <= 10 ? "otb_blitz" : "otb_rapid";
    
    createGameMutation.mutate({
      mode,
      playerColor: "white",
      timeControl: minutes,
      increment: 0,
      fen: newGame.fen(),
      moves: [],
      whiteTime: seconds,
      blackTime: seconds,
      opponentName: "Practice",
    });
  };

  const requestBotMove = useCallback(async (currentFen: string, botId: string) => {
    setBotThinking(true);
    
    try {
      const response = await apiRequest("POST", "/api/bots/move", {
        fen: currentFen,
        botId,
        isOtbMode: true,
      });
      
      if (!response.ok) {
        throw new Error("Failed to get bot move");
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error getting bot move:", error);
      toast({
        title: "Error",
        description: "Bot failed to respond",
        variant: "destructive",
      });
      return null;
    } finally {
      setBotThinking(false);
    }
  }, [toast]);

  const handleStartBotGame = async (bot: BotProfile) => {
    if (!user) return;
    
    const minutes = parseInt(timeControl);
    const seconds = minutes * 60;
    
    setWhiteTime(seconds);
    setBlackTime(seconds);
    setIncrement(0);
    setGameResult(null);
    
    const newGame = new Chess();
    setGame(newGame);
    setLegalChessGame(new Chess());
    setBoardState(INITIAL_BOARD.map(row => [...row]));
    setMoves([]);
    setActiveColor("white");
    setClockTurn("white");
    setClockPresses(0);
    setMyViolations(0);
    setOpponentViolations(0);
    setMyFalseClaims(0);
    setOpponentFalseClaims(0);
    setIsBotGame(true);
    setSelectedBot(bot);
    setShowBotSelection(false);
    setSelectedBotDifficulty(null);
    
    const assignedColor = Math.random() < 0.5 ? "white" : "black";
    setPlayerColor(assignedColor);
    
    setOpponentName(bot.name);
    setOpponentRating(bot.elo);
    
    const mode = minutes <= 3 ? "otb_bullet" : minutes <= 10 ? "otb_blitz" : "otb_rapid";
    
    createGameMutation.mutate({
      mode,
      playerColor: assignedColor,
      timeControl: minutes,
      increment: 0,
      fen: newGame.fen(),
      moves: [],
      whiteTime: seconds,
      blackTime: seconds,
      opponentName: bot.name,
    });
    
    setGameStarted(true);
    
    if (assignedColor === "black") {
      setTimeout(async () => {
        const botMove = await requestBotMove(newGame.fen(), bot.id);
        if (botMove) {
          const legalGame = new Chess();
          legalGame.move(botMove.move);
          setLegalChessGame(legalGame);
          
          const move = legalGame.history({ verbose: true })[0];
          if (move) {
            const { rank: fromRank, file: fromFile } = squareToIndices(move.from);
            const { rank: toRank, file: toFile } = squareToIndices(move.to);
            const newBoard = INITIAL_BOARD.map(row => [...row]);
            const piece = newBoard[fromRank][fromFile];
            const captured = newBoard[toRank][toFile];
            newBoard[fromRank][fromFile] = null;
            newBoard[toRank][toFile] = move.promotion ? 
              (move.color === 'w' ? move.promotion.toUpperCase() : move.promotion.toLowerCase()) : 
              piece;
            setBoardState(newBoard);
            
            const moveNotation = `${piece?.toUpperCase()}${move.from}-${move.to}${captured ? 'x' + captured.toUpperCase() : ''}`;
            setMoves([{
              from: move.from,
              to: move.to,
              piece: piece!,
              captured: captured || undefined,
              notation: moveNotation,
              timestamp: Date.now(),
            }]);
            setLastMoveSquares([move.from, move.to]);
            
            setTimeout(() => {
              setClockTurn("white");
              setActiveColor("white");
              setClockPresses(1);
            }, 500);
          }
        }
      }, 500);
    }
  };

  const executeBotTurn = useCallback(async () => {
    if (!isBotGame || !selectedBot || !legalChessGame || gameResult) return;
    
    const botColor = playerColor === "white" ? "black" : "white";
    if (activeColor !== botColor) return;
    
    if (moves.length > 0) {
      const lastMove = moves[moves.length - 1];
      const tempChess = new Chess();
      let isLegal = true;
      
      try {
        for (let i = 0; i < moves.length - 1; i++) {
          const move = moves[i];
          const result = tempChess.move({
            from: move.from,
            to: move.to,
            promotion: 'q',
          });
          if (!result) {
            isLegal = false;
            break;
          }
        }
        
        if (isLegal) {
          const result = tempChess.move({
            from: lastMove.from,
            to: lastMove.to,
            promotion: 'q',
          });
          isLegal = !!result;
        }
      } catch (e) {
        isLegal = false;
      }
      
      if (!isLegal) {
        setArbiterPending(true);
        
        const newPlayerViolations = myViolations + 1;
        
        if (newPlayerViolations >= 2) {
          toast({
            title: "Game Over - Forfeit",
            description: "You forfeited due to 2 illegal moves",
            variant: "destructive",
          });
          handleGameEnd(playerColor === "white" ? "black_win" : "white_win");
          return;
        }
        
        setMyViolations(newPlayerViolations);
        setArbiterResult({ type: "illegal", message: "Bot called arbiter: Your move was illegal! Bot gains 2 minutes." });
        
        const { rank: fromRank, file: fromFile } = squareToIndices(lastMove.from);
        const { rank: toRank, file: toFile } = squareToIndices(lastMove.to);
        
        setBoardState(prev => {
          const newBoard = prev.map(row => [...row]);
          newBoard[fromRank][fromFile] = lastMove.piece;
          newBoard[toRank][toFile] = lastMove.captured || null;
          return newBoard;
        });
        
        setMoves(prev => prev.slice(0, -1));
        setLastMoveSquares([]);
        
        if (botColor === "white") {
          setWhiteTime(prev => prev + 120);
        } else {
          setBlackTime(prev => prev + 120);
        }
        
        setActiveColor(playerColor);
        setClockTurn(playerColor);
        
        setTimeout(() => {
          setArbiterResult(null);
          setArbiterPending(false);
        }, 3000);
        
        return;
      }
      
      setLegalChessGame(tempChess);
    }
    
    const currentFen = legalChessGame.fen();
    const botMove = await requestBotMove(currentFen, selectedBot.id);
    
    if (botMove && botMove.move) {
      const newLegalGame = new Chess(legalChessGame.fen());
      const moveResult = newLegalGame.move(botMove.move);
      
      if (moveResult) {
        setLegalChessGame(newLegalGame);
        
        const { rank: fromRank, file: fromFile } = squareToIndices(moveResult.from);
        const { rank: toRank, file: toFile } = squareToIndices(moveResult.to);
        
        setBoardState(prev => {
          const newBoard = prev.map(row => [...row]);
          const piece = newBoard[fromRank][fromFile];
          const captured = newBoard[toRank][toFile];
          newBoard[fromRank][fromFile] = null;
          newBoard[toRank][toFile] = moveResult.promotion ? 
            (moveResult.color === 'w' ? moveResult.promotion.toUpperCase() : moveResult.promotion.toLowerCase()) : 
            piece;
          
          const moveNotation = `${piece?.toUpperCase()}${moveResult.from}-${moveResult.to}${captured ? 'x' + captured.toUpperCase() : ''}`;
          setMoves(prevMoves => [...prevMoves, {
            from: moveResult.from,
            to: moveResult.to,
            piece: piece!,
            captured: captured || undefined,
            notation: moveNotation,
            timestamp: Date.now(),
          }]);
          
          return newBoard;
        });
        
        setLastMoveSquares([moveResult.from, moveResult.to]);
        
        if (newLegalGame.isCheckmate()) {
          setTimeout(() => {
            handleGameEnd(botColor === "white" ? "white_win" : "black_win");
          }, 500);
          return;
        }
        
        if (newLegalGame.isDraw() || newLegalGame.isStalemate()) {
          setTimeout(() => {
            handleGameEnd("draw");
          }, 500);
          return;
        }
        
        setTimeout(() => {
          if (botColor === "white") {
            setWhiteTime(t => t + increment);
          } else {
            setBlackTime(t => t + increment);
          }
          setClockTurn(playerColor);
          setActiveColor(playerColor);
          setClockPresses(prev => prev + 1);
        }, 500);
      }
    }
  }, [isBotGame, selectedBot, legalChessGame, gameResult, playerColor, activeColor, moves, myViolations, toast, handleGameEnd, requestBotMove, increment]);

  useEffect(() => {
    if (isBotGame && gameStarted && !botThinking && !arbiterPending && !gameResult) {
      const botColor = playerColor === "white" ? "black" : "white";
      if (clockTurn === botColor && activeColor === botColor) {
        const timer = setTimeout(() => {
          executeBotTurn();
        }, 300);
        return () => clearTimeout(timer);
      }
    }
  }, [isBotGame, gameStarted, botThinking, arbiterPending, gameResult, playerColor, clockTurn, activeColor, executeBotTurn]);

  const isPawnPromotion = (piece: string | null, toRank: number): boolean => {
    if (!piece) return false;
    const isPawn = piece.toLowerCase() === 'p';
    if (!isPawn) return false;
    const isWhitePawn = piece === 'P';
    return (isWhitePawn && toRank === 0) || (!isWhitePawn && toRank === 7);
  };

  const completeMove = (
    fromSquare: string,
    toSquare: string,
    fromRank: number,
    fromFile: number,
    toRank: number,
    toFile: number,
    originalPiece: string,
    captured: string | null,
    promotedPiece?: string
  ) => {
    const newBoard = boardState.map(row => [...row]);
    newBoard[fromRank][fromFile] = null;
    newBoard[toRank][toFile] = promotedPiece || originalPiece;
    setBoardState(newBoard);
    
    const promotionSuffix = promotedPiece ? `=${promotedPiece.toUpperCase()}` : '';
    const moveNotation = `${originalPiece.toUpperCase()}${fromSquare}-${toSquare}${captured ? 'x' + captured.toUpperCase() : ''}${promotionSuffix}`;
    const newMove: MoveRecord = {
      from: fromSquare,
      to: toSquare,
      piece: originalPiece,
      captured: captured || undefined,
      notation: moveNotation,
      timestamp: Date.now(),
    };
    
    setMoves(prev => [...prev, newMove]);
    setSelectedSquare(null);
    setLastMoveSquares([fromSquare, toSquare]);
    
    if (matchId) {
      setHasMadeMove(true);
    }
    
    const newFen = boardToFen(newBoard, activeColor === "white" ? "black" : "white");
    
    if (matchId) {
      sendMove(matchId, moveNotation, newFen, whiteTime, blackTime, {
        from: fromSquare,
        to: toSquare,
        piece: originalPiece,
        captured: captured || undefined,
        promotion: promotedPiece || undefined,
      });
      sendPieceTouch(null);
    }
    
    if (captured?.toLowerCase() === "k") {
      setPendingCheckmate({
        winner: captured === "K" ? "black" : "white",
        countdown: 5,
      });
    }
    
    saveGameState();
  };

  const handlePromotionSelect = (promotionPiece: "q" | "r" | "b" | "n") => {
    if (!pendingPromotion) return;
    
    const { from, to, fromRank, fromFile, toRank, toFile, piece, captured } = pendingPromotion;
    const isWhite = piece === 'P';
    const promotedPiece = isWhite ? promotionPiece.toUpperCase() : promotionPiece.toLowerCase();
    
    completeMove(from, to, fromRank, fromFile, toRank, toFile, piece, captured, promotedPiece);
    setPendingPromotion(null);
  };

  const handleSquareClick = (square: string) => {
    if (!gameStarted || arbiterPending || pendingCheckmate || pendingPromotion || botThinking) return;
    
    const isMyTurn = activeColor === playerColor;
    if (!isMyTurn && matchId) return;
    if (!isMyTurn && isBotGame) return;
    
    if (hasMadeMove && matchId) {
      toast({
        title: "Press clock first",
        description: "You must press the clock before making another move",
        variant: "destructive",
      });
      return;
    }

    const { rank, file } = squareToIndices(square);
    const pieceOnSquare = boardState[rank][file];
    const pieceColor = getPieceColor(pieceOnSquare);

    if (selectedSquare) {
      const { rank: fromRank, file: fromFile } = squareToIndices(selectedSquare);
      const movingPiece = boardState[fromRank][fromFile];
      const movingPieceColor = getPieceColor(movingPiece);
      
      if (movingPieceColor !== activeColor) {
        setSelectedSquare(null);
        return;
      }
      
      if (pieceColor === activeColor) {
        setSelectedSquare(square);
        return;
      }
      
      const captured = boardState[rank][file];
      
      if (isPawnPromotion(movingPiece, rank)) {
        setPendingPromotion({
          from: selectedSquare,
          to: square,
          fromRank,
          fromFile,
          toRank: rank,
          toFile: file,
          piece: movingPiece!,
          captured,
        });
        return;
      }
      
      completeMove(selectedSquare, square, fromRank, fromFile, rank, file, movingPiece!, captured);
    } else {
      if (pieceOnSquare && pieceColor === activeColor) {
        setSelectedSquare(square);
        if (matchId) {
          sendPieceTouch(square);
        }
      }
    }
  };

  const handleCallArbiter = () => {
    if (!matchId || moves.length === 0 || arbiterPending) return;
    
    const lastMove = moves[moves.length - 1];
    
    setArbiterPending(true);
    
    const tempChess = new Chess();
    let isLegal = false;
    
    try {
      for (let i = 0; i < moves.length - 1; i++) {
        const move = moves[i];
        const result = tempChess.move({
          from: move.from,
          to: move.to,
          promotion: 'q',
        });
        if (!result) break;
      }
      
      const result = tempChess.move({
        from: lastMove.from,
        to: lastMove.to,
        promotion: 'q',
      });
      isLegal = !!result;
    } catch (e) {
      isLegal = false;
    }
    
    const ruling = isLegal ? "legal" : "illegal";
    const opponentIsViolator = !isLegal;
    const violatorId = opponentIsViolator ? "opponent" : user?.id || "";
    
    let forfeit = false;
    let forfeitReason = "";
    
    if (ruling === "illegal") {
      const newOpponentViolations = opponentViolations + 1;
      if (newOpponentViolations >= 2) {
        forfeit = true;
        forfeitReason = "Opponent forfeited due to 2 illegal moves";
      }
    } else {
      const newMyFalseClaims = myFalseClaims + 1;
      if (newMyFalseClaims >= 2) {
        forfeit = true;
        forfeitReason = "You forfeited due to 2 false arbiter claims";
      }
    }
    
    const timeAdjustment = {
      white: ruling === "illegal" ? (playerColor === "white" ? 120 : 0) : (playerColor === "white" ? 0 : 120),
      black: ruling === "illegal" ? (playerColor === "black" ? 120 : 0) : (playerColor === "black" ? 0 : 120),
    };
    
    if (forfeit) {
      handleGameEnd(forfeitReason.includes("You forfeited") ? 
        (playerColor === "white" ? "black_win" : "white_win") : 
        (playerColor === "white" ? "white_win" : "black_win")
      );
      return;
    }
    
    setWhiteTime(prev => prev + timeAdjustment.white);
    setBlackTime(prev => prev + timeAdjustment.black);
    
    if (ruling === "illegal") {
      setOpponentViolations(prev => prev + 1);
      setArbiterResult({ type: "illegal", message: "Opponent's move was illegal! You gain 2 minutes." });
      
      const { rank: fromRank, file: fromFile } = squareToIndices(lastMove.from);
      const { rank: toRank, file: toFile } = squareToIndices(lastMove.to);
      
      setBoardState(prev => {
        const newBoard = prev.map(row => [...row]);
        newBoard[fromRank][fromFile] = lastMove.piece;
        newBoard[toRank][toFile] = lastMove.captured || null;
        return newBoard;
      });
      
      setMoves(prev => prev.slice(0, -1));
      setActiveColor(prev => prev === "white" ? "black" : "white");
      setPendingCheckmate(null);
    } else {
      setMyFalseClaims(prev => prev + 1);
      setArbiterResult({ type: "legal", message: "Move was legal! False claim - opponent gains 2 minutes." });
    }
    
    setTimeout(() => {
      setArbiterResult(null);
      setArbiterPending(false);
    }, 3000);
    
    if (matchId) {
      sendArbiterRuling?.(matchId, ruling, violatorId, timeAdjustment, forfeit, forfeitReason);
    }
  };

  const handleResign = () => {
    const result = playerColor === "white" ? "black_win" : "white_win";
    handleGameEnd(result);
    
    // Notify opponent via WebSocket
    if (matchId) {
      sendGameEnd(matchId, result, "Opponent resigned");
    }
  };

  const handleOfferDraw = () => {
    handleGameEnd("draw");
    
    // Notify opponent via WebSocket
    if (matchId) {
      sendGameEnd(matchId, "draw", "Game drawn by agreement");
    }
  };

  useEffect(() => {
    if (!gameStarted) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.key === " ") {
        e.preventDefault();
        handleClockPress();
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [gameStarted, handleClockPress]);

  const fen = boardToFen(boardState, activeColor);

  return (
    <div className="h-screen flex">
      <div className="flex-1 flex items-center justify-center p-4 bg-muted/30 overflow-auto">
        <div className="w-full max-w-2xl space-y-3">
          <div>
            <h1 className="text-2xl font-bold">OTB Tournament Mode</h1>
            <p className="text-sm text-muted-foreground">Free movement · FIDE-style arbiter disputes</p>
          </div>

          {!gameStarted && !gameResult ? (
            <>
              {!inQueue ? (
                <Card>
                  <CardContent className="pt-6 space-y-4">
                    <h2 className="text-xl font-semibold">Find Opponent</h2>
                    <div className="grid grid-cols-2 gap-3">
                      <Button 
                        variant="outline" 
                        onClick={() => handleJoinQueue('5')}
                        disabled={joinQueueMutation.isPending}
                        data-testid="button-queue-blitz"
                      >
                        <Clock className="mr-2 h-4 w-4" />
                        Blitz (5 min)
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={() => handleJoinQueue('15')}
                        disabled={joinQueueMutation.isPending}
                        data-testid="button-queue-rapid"
                      >
                        <Clock className="mr-2 h-4 w-4" />
                        Rapid (15 min)
                      </Button>
                    </div>

                    <div className="pt-4 border-t">
                      {!showBotSelection ? (
                        <>
                          <h3 className="text-lg font-semibold mb-4">or Start Practice Game</h3>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Time Control</label>
                            <Select value={timeControl} onValueChange={setTimeControl}>
                              <SelectTrigger data-testid="select-time-control">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="5">Blitz: 5 min</SelectItem>
                                <SelectItem value="15">Rapid: 15 min</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <Button onClick={handleStartGame} className="w-full mt-4" data-testid="button-start-game">
                            <Play className="mr-2 h-4 w-4" />
                            Practice (Solo)
                          </Button>
                          <Button 
                            variant="default"
                            onClick={() => setShowBotSelection(true)} 
                            className="w-full mt-2" 
                            data-testid="button-play-bot"
                          >
                            <Bot className="mr-2 h-4 w-4" />
                            Practice vs Bot
                          </Button>
                        </>
                      ) : !selectedBotDifficulty ? (
                        <>
                          <div className="flex items-center gap-2 mb-4">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setShowBotSelection(false);
                                setSelectedBotDifficulty(null);
                              }}
                              data-testid="button-back-from-bots"
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <h3 className="text-lg font-semibold">Select Bot Difficulty</h3>
                          </div>
                          
                          <div className="space-y-2 mb-4">
                            <label className="text-sm font-medium">Time Control</label>
                            <Select value={timeControl} onValueChange={setTimeControl}>
                              <SelectTrigger data-testid="select-bot-time-control">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="5">Blitz: 5 min</SelectItem>
                                <SelectItem value="15">Rapid: 15 min</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <ScrollArea className="h-[280px] pr-2">
                            <div className="grid grid-cols-1 gap-2">
                              {ALL_DIFFICULTIES.map((difficulty) => (
                                <Card 
                                  key={difficulty}
                                  className="cursor-pointer hover-elevate"
                                  onClick={() => setSelectedBotDifficulty(difficulty)}
                                  data-testid={`card-difficulty-${difficulty}`}
                                >
                                  <CardContent className="p-3">
                                    <div className="flex items-center justify-between">
                                      <span className="font-semibold">{BOT_DIFFICULTY_NAMES[difficulty]}</span>
                                      <Badge variant="secondary">
                                        {BOT_DIFFICULTY_ELO[difficulty]} Elo
                                      </Badge>
                                    </div>
                                  </CardContent>
                                </Card>
                              ))}
                            </div>
                          </ScrollArea>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 mb-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setSelectedBotDifficulty(null)}
                              data-testid="button-back-from-personality"
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <h3 className="text-lg font-semibold">Select Playstyle</h3>
                            <Badge variant="secondary" className="ml-auto">
                              {BOT_DIFFICULTY_ELO[selectedBotDifficulty]} Elo
                            </Badge>
                          </div>
                          
                          <p className="text-sm text-muted-foreground mb-4">
                            Choose your {BOT_DIFFICULTY_NAMES[selectedBotDifficulty]} opponent's playstyle
                          </p>
                          
                          <ScrollArea className="h-[280px] pr-2">
                            <div className="grid grid-cols-1 gap-2">
                              {ALL_PERSONALITIES.map((personality) => {
                                const bot = getBotByConfig(selectedBotDifficulty, personality);
                                if (!bot) return null;
                                return (
                                  <Card 
                                    key={personality}
                                    className="cursor-pointer hover-elevate"
                                    onClick={() => handleStartBotGame(bot)}
                                    data-testid={`card-personality-${personality}`}
                                  >
                                    <CardContent className="p-3">
                                      <div className="flex items-center gap-3">
                                        <Avatar className="h-10 w-10">
                                          <AvatarFallback className="bg-primary/10 text-primary font-bold text-lg">
                                            {BOT_PERSONALITY_ICONS[personality]}
                                          </AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2">
                                            <span className="font-semibold">{BOT_PERSONALITY_NAMES[personality]}</span>
                                          </div>
                                          <p className="text-xs text-muted-foreground">
                                            {BOT_PERSONALITY_DESCRIPTIONS[personality]}
                                          </p>
                                        </div>
                                      </div>
                                    </CardContent>
                                  </Card>
                                );
                              })}
                            </div>
                          </ScrollArea>
                        </>
                      )}
                    </div>

                    <div className="pt-4 border-t">
                      <h3 className="text-sm font-semibold mb-3">Game Settings</h3>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="highlight-last-move-pregame" className="text-sm cursor-pointer">
                          Highlight Last Move
                        </Label>
                        <Switch
                          id="highlight-last-move-pregame"
                          checked={highlightLastMove}
                          onCheckedChange={setHighlightLastMove}
                          data-testid="switch-highlight-last-move"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">Settings cannot be changed during gameplay</p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="pt-6 space-y-4 text-center">
                    <h2 className="text-xl font-semibold">Searching for Opponent</h2>
                    <div className="flex justify-center py-8">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                    </div>
                    <p className="text-muted-foreground">Open another browser window and queue up to play against yourself!</p>
                    <Button 
                      variant="outline" 
                      onClick={() => leaveQueueMutation.mutate({ queueType })}
                      className="w-full"
                      data-testid="button-leave-queue"
                    >
                      Cancel
                    </Button>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <>
              {pendingCheckmate && (
                <Card className="border-destructive bg-destructive/10">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <AlertTriangle className="h-6 w-6 text-destructive" />
                        <div>
                          <p className="font-semibold">King Captured!</p>
                          <p className="text-sm text-muted-foreground">
                            {pendingCheckmate.winner === playerColor ? "You win" : "Opponent wins"} in {pendingCheckmate.countdown}s...
                          </p>
                        </div>
                      </div>
                      <Button 
                        variant="destructive" 
                        onClick={handleCallArbiter}
                        disabled={arbiterPending || moves.length === 0}
                        data-testid="button-call-arbiter-checkmate"
                      >
                        <Gavel className="mr-2 h-4 w-4" />
                        Call Arbiter
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {arbiterResult && (
                <Card className={arbiterResult.type === "illegal" ? "border-green-500 bg-green-500/10" : "border-red-500 bg-red-500/10"}>
                  <CardContent className="py-4">
                    <div className="flex items-center gap-3">
                      {arbiterResult.type === "illegal" ? (
                        <CheckCircle className="h-6 w-6 text-green-500" />
                      ) : (
                        <XCircle className="h-6 w-6 text-red-500" />
                      )}
                      <div>
                        <p className="font-semibold">Arbiter Ruling</p>
                        <p className="text-sm">{arbiterResult.message}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Game Result Overlay */}
              {gameResult && (
                <Card className="border-primary bg-primary/10">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Trophy className="h-6 w-6 text-primary" />
                        <div>
                          <p className="font-semibold text-lg">Game Over</p>
                          <p className="text-sm text-muted-foreground">
                            {gameResult === "draw" 
                              ? "Game drawn" 
                              : gameResult === "white_win" 
                                ? (playerColor === "white" ? "You win!" : "Opponent wins") 
                                : (playerColor === "black" ? "You win!" : "Opponent wins")}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="secondary"
                          onClick={() => {
                            if (gameId) {
                              setLocation(`/analysis/${gameId}`);
                            }
                          }}
                          disabled={!gameId}
                          data-testid="button-analyze-game"
                        >
                          <BarChart3 className="mr-2 h-4 w-4" />
                          Analyze
                        </Button>
                        <Button 
                          onClick={() => {
                            setGameResult(null);
                            setGameStarted(false);
                            setGameId(null);
                            setMatchId(null);
                            setMoves([]);
                            setBoardState(INITIAL_BOARD.map(row => [...row]));
                            setSelectedSquare(null);
                            setClockPresses(0);
                            setMyViolations(0);
                            setOpponentViolations(0);
                            setMyFalseClaims(0);
                            setOpponentFalseClaims(0);
                            setArbiterResult(null);
                            setRestoredGame(false);
                            setIsBotGame(false);
                            setSelectedBot(null);
                            setShowBotSelection(false);
                            setSelectedBotDifficulty(null);
                            setBotThinking(false);
                            setLegalChessGame(new Chess());
                          }}
                          data-testid="button-main-menu"
                        >
                          Main Menu
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Opponent timer (top) */}
              <Card className={`${clockTurn !== playerColor ? "ring-2 ring-primary" : ""}`}>
                <CardContent className="py-2 px-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${playerColor === "white" ? "bg-black" : "bg-white border border-gray-400"}`} />
                      {isBotGame && <Bot className="h-4 w-4 text-primary" />}
                      <span className="font-medium text-sm" data-testid="text-opponent-name">{opponentName}</span>
                      <span className="text-xs text-muted-foreground" data-testid="text-opponent-rating">({opponentRating})</span>
                      {botThinking && (
                        <span className="text-xs text-primary animate-pulse" data-testid="text-bot-thinking">
                          thinking...
                        </span>
                      )}
                    </div>
                    <div className={`text-2xl font-mono font-bold ${
                      clockTurn !== playerColor ? "text-foreground" : "text-muted-foreground"
                    }`} data-testid={playerColor === "white" ? "text-black-time" : "text-white-time"}>
                      {formatTime(playerColor === "white" ? blackTime : whiteTime)}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <ChessBoard 
                fen={fen}
                orientation={playerColor}
                showCoordinates={true}
                highlightedSquares={[]}
                touchedSquare={opponentTouchedSquare}
                lastMoveSquares={highlightLastMove ? lastMoveSquares : []}
                selectedSquare={selectedSquare}
                onSquareClick={handleSquareClick}
              />

              {/* Player timer (bottom) */}
              <Card className={`${clockTurn === playerColor ? "ring-2 ring-primary" : ""}`}>
                <CardContent className="py-2 px-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${playerColor === "white" ? "bg-white border border-gray-400" : "bg-black"}`} />
                      <span className="font-medium text-sm">{user?.firstName || "You"}</span>
                      <span className="text-xs text-muted-foreground">({playerRating})</span>
                      <Badge variant="outline" className="text-xs py-0">You</Badge>
                    </div>
                    <div className={`text-2xl font-mono font-bold ${
                      clockTurn === playerColor ? "text-foreground" : "text-muted-foreground"
                    }`} data-testid={playerColor === "white" ? "text-white-time" : "text-black-time"}>
                      {formatTime(playerColor === "white" ? whiteTime : blackTime)}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Violations and game controls */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-xs">
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">Violations:</span>
                    <Badge variant={myViolations > 0 ? "destructive" : "secondary"} className="text-xs py-0">{myViolations}/2</Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">False claims:</span>
                    <Badge variant={myFalseClaims > 0 ? "destructive" : "secondary"} className="text-xs py-0">{myFalseClaims}/2</Badge>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleOfferDraw} data-testid="button-offer-draw">
                    <HandshakeIcon className="mr-1 h-3 w-3" />
                    Draw
                  </Button>
                  <Button variant="destructive" size="sm" onClick={handleResign} data-testid="button-resign">
                    <Flag className="mr-1 h-3 w-3" />
                    Resign
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {gameStarted && (
        <div className="w-72 border-l bg-card flex flex-col">
          <div className="p-3 border-b space-y-2">
            <Button
              onClick={handleClockPress}
              size="lg"
              className="w-full min-h-12 text-base font-semibold"
              disabled={arbiterPending || !!pendingCheckmate}
              data-testid="button-press-clock"
            >
              <Clock className="mr-2 h-5 w-5" />
              Press Clock
              <span className="ml-2 text-xs font-normal opacity-70">(Space)</span>
            </Button>
            
            {!isBotGame && (
              <Button
                onClick={handleCallArbiter}
                size="default"
                variant="outline"
                className="w-full border-orange-500 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950"
                disabled={arbiterPending || moves.length === 0 || clockTurn !== playerColor}
                data-testid="button-call-arbiter"
              >
                <Gavel className="mr-2 h-4 w-4" />
                Call Arbiter
              </Button>
            )}
            {isBotGame && (
              <p className="text-xs text-center text-muted-foreground">
                Bot will call arbiter if you make an illegal move
              </p>
            )}
          </div>
          
          <div className="p-3 border-b">
            <h3 className="font-semibold text-sm">Move List</h3>
            <p className="text-xs text-muted-foreground">Free movement - arbiter validates</p>
          </div>
          <ScrollArea className="flex-1 p-3">
            {moves.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-3">
                No moves yet
              </p>
            ) : (
              <div className="space-y-1 font-mono text-sm">
                {moves.map((move, i) => (
                  <div key={i} className="flex items-center gap-2" data-testid={`move-${i}`}>
                    <span className="text-muted-foreground w-6 text-xs">{Math.floor(i / 2) + 1}.</span>
                    <span className="text-sm">{move.notation}</span>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
          
          <div className="p-3 border-t bg-muted/30">
            <h4 className="text-xs font-semibold mb-1">Arbiter Rules</h4>
            <ul className="text-xs text-muted-foreground space-y-0.5">
              <li>• Illegal move: Caller +2 min</li>
              <li>• 2nd illegal: Forfeit</li>
              <li>• False claim: Opponent +2 min</li>
              <li>• 2nd false claim: Forfeit</li>
            </ul>
          </div>
        </div>
      )}

      <PromotionDialog
        open={!!pendingPromotion}
        color={activeColor}
        onSelect={handlePromotionSelect}
      />
    </div>
  );
}
