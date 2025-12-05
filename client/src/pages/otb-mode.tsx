import { useState, useEffect, useRef, useCallback } from "react";
import { Chess } from "chess.js";
import { useMutation, useQuery } from "@tanstack/react-query";
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
import { Clock, Play, HandshakeIcon, Flag, AlertTriangle, Settings, Gavel, XCircle, CheckCircle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { Game } from "@shared/schema";

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
  
  const gameRef = useRef<Chess | null>(null);
  const gameIdRef = useRef<string | null>(null);
  const whiteTimeRef = useRef(180);
  const blackTimeRef = useRef(180);
  const saveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pendingCheckmateRef = useRef<NodeJS.Timeout | null>(null);

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

  const handleOpponentMove = useCallback((data: { matchId: string; move: string; fen: string; whiteTime: number; blackTime: number; from?: string; to?: string; piece?: string; captured?: string }) => {
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
        newBoard[toRank][toFile] = piece;
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
      handleGameEnd(data.violatorId === user?.id ? 
        (playerColor === "white" ? "black_win" : "white_win") : 
        (playerColor === "white" ? "white_win" : "black_win")
      );
      return;
    }
    
    setWhiteTime(prev => prev + data.timeAdjustment.white);
    setBlackTime(prev => prev + data.timeAdjustment.black);
    
    if (data.ruling === "illegal") {
      if (data.violatorId === user?.id) {
        setMyViolations(prev => prev + 1);
        setArbiterResult({ type: "illegal", message: "Your move was illegal! Opponent gains 2 minutes." });
        
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
          setActiveColor(prev => prev === "white" ? "black" : "white");
        }
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
    
    setGameStarted(false);
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

    setGameStarted(false);
    setPendingCheckmate(null);
  }, [gameId, boardState, activeColor, updateGameMutation, moves, whiteTime, blackTime, clockPresses, toast]);

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
    if (gameStarted && !pendingCheckmate && !arbiterPending) {
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
  }, [gameStarted, clockTurn, handleGameEnd, pendingCheckmate, arbiterPending]);

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

  const handleSquareClick = (square: string) => {
    if (!gameStarted || arbiterPending || pendingCheckmate) return;
    
    const isMyTurn = activeColor === playerColor;
    if (!isMyTurn && matchId) return;
    
    // In OTB mode, only allow one move per clock turn
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
      
      const newBoard = boardState.map(row => [...row]);
      const captured = newBoard[rank][file];
      newBoard[fromRank][fromFile] = null;
      newBoard[rank][file] = movingPiece;
      setBoardState(newBoard);
      
      const moveNotation = `${movingPiece?.toUpperCase()}${selectedSquare}-${square}${captured ? 'x' + captured.toUpperCase() : ''}`;
      const newMove: MoveRecord = {
        from: selectedSquare,
        to: square,
        piece: movingPiece || "?",
        captured: captured || undefined,
        notation: moveNotation,
        timestamp: Date.now(),
      };
      
      setMoves(prev => [...prev, newMove]);
      setSelectedSquare(null);
      setLastMoveSquares([selectedSquare, square]);
      
      // Mark that player has made a move this turn (must press clock before making another)
      if (matchId) {
        setHasMadeMove(true);
      }
      
      const newFen = boardToFen(newBoard, activeColor === "white" ? "black" : "white");
      
      if (matchId) {
        sendMove(matchId, moveNotation, newFen, whiteTime, blackTime, {
          from: selectedSquare,
          to: square,
          piece: movingPiece || "?",
          captured: captured || undefined,
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

          {!gameStarted ? (
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

              {/* Opponent timer (top) */}
              <Card className={`${clockTurn !== playerColor ? "ring-2 ring-primary" : ""}`}>
                <CardContent className="py-2 px-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${playerColor === "white" ? "bg-black" : "bg-white border border-gray-400"}`} />
                      <span className="font-medium text-sm">{opponentName}</span>
                      <span className="text-xs text-muted-foreground">({opponentRating})</span>
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
    </div>
  );
}
