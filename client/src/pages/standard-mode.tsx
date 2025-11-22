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
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Clock, Play, HandshakeIcon, Flag, Eye, Infinity as InfinityIcon } from "lucide-react";
import type { Game, Rating } from "@shared/schema";

const getRatingCategory = (tc: number): 'bullet' | 'blitz' | 'rapid' | 'classical' => {
  if (tc <= 180) return 'bullet';
  if (tc <= 600) return 'blitz';
  if (tc <= 1200) return 'rapid';
  return 'classical';
};

const BLINDFOLD_CONFIG = {
  easy: { maxPeeks: Number.POSITIVE_INFINITY, peekDuration: 3000 },
  medium: { maxPeeks: 20, peekDuration: 3000 },
  hard: { maxPeeks: 15, peekDuration: 2500 },
  expert: { maxPeeks: 10, peekDuration: 2000 },
  master: { maxPeeks: 5, peekDuration: 1500 },
  grandmaster: { maxPeeks: 0, peekDuration: 0 },
};

export default function StandardMode() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const { data: playerRatings } = useQuery<Rating>({
    queryKey: ["/api/ratings"],
  });
  
  const { data: userSettings } = useQuery<any>({
    queryKey: ["/api/settings"],
  });
  
  const [game, setGame] = useState<Chess | null>(null);
  const [gameId, setGameId] = useState<string | null>(null);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [whiteTime, setWhiteTime] = useState(180);
  const [blackTime, setBlackTime] = useState(180);
  const [moves, setMoves] = useState<string[]>([]);
  const [fen, setFen] = useState("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [legalMoves, setLegalMoves] = useState<string[]>([]);
  const [restoredGame, setRestoredGame] = useState(false);
  const [inQueue, setInQueue] = useState(false);
  const [queueType, setQueueType] = useState<string | null>(null);
  const [isBlindfold, setIsBlindfold] = useState(false);
  const [activeBlindfoldDifficulty, setActiveBlindfoldDifficulty] = useState<string | null>(null);
  const [playerColor, setPlayerColor] = useState<"white" | "black">("white");
  const [increment, setIncrement] = useState(0);
  const [opponentName, setOpponentName] = useState<string>("");
  const [playerName, setPlayerName] = useState<string>("");
  const [opponentRating, setOpponentRating] = useState<number>(1200);
  const [timeControl, setTimeControl] = useState<number>(180);
  const [showDrawOfferDialog, setShowDrawOfferDialog] = useState(false);
  const [showRematchDialog, setShowRematchDialog] = useState(false);
  const [showGameEndDialog, setShowGameEndDialog] = useState(false);
  const [gameResult, setGameResult] = useState<"white_win" | "black_win" | "draw" | null>(null);
  const [waitingForDrawResponse, setWaitingForDrawResponse] = useState(false);
  const [waitingForRematchResponse, setWaitingForRematchResponse] = useState(false);
  const [rematchDenied, setRematchDenied] = useState(false);
  
  const [remainingPeeks, setRemainingPeeks] = useState<number>(Number.POSITIVE_INFINITY);
  const [isPeeking, setIsPeeking] = useState(false);
  const [peekCountdown, setPeekCountdown] = useState<number>(0);
  const peekTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const gameRef = useRef<Chess | null>(null);
  const gameIdRef = useRef<string | null>(null);
  const matchIdRef = useRef<string | null>(null);
  const rematchExitIntentRef = useRef<boolean>(false);
  const didSendRematchRequestRef = useRef<boolean>(false);
  const gameFromMatchmakingRef = useRef<boolean>(false);
  const whiteTimeRef = useRef(180);
  const blackTimeRef = useRef(180);
  const movesRef = useRef<string[]>([]);
  const saveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const clockIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const gameCompletionInProgressRef = useRef(false);

  useEffect(() => {
    gameRef.current = game;
    gameIdRef.current = gameId;
    matchIdRef.current = matchId;
    whiteTimeRef.current = whiteTime;
    blackTimeRef.current = blackTime;
    movesRef.current = moves;
  }, [game, gameId, matchId, whiteTime, blackTime, moves]);

  const completeGame = useCallback(async (result: "white_win" | "black_win" | "draw") => {
    // Guard against duplicate execution
    if (gameCompletionInProgressRef.current) {
      console.log('[completeGame] Already in progress, skipping duplicate call');
      return;
    }
    
    const currentGame = gameRef.current;
    const currentGameId = gameIdRef.current;
    const currentMatchId = matchIdRef.current;
    
    if (!currentGameId || !currentGame) {
      console.log('[completeGame] No gameId or game, skipping');
      return;
    }

    try {
      // Set guard flag
      gameCompletionInProgressRef.current = true;

      // Stop all intervals and timers
      if (saveIntervalRef.current) {
        clearInterval(saveIntervalRef.current);
        saveIntervalRef.current = null;
      }
      if (clockIntervalRef.current) {
        clearInterval(clockIntervalRef.current);
        clockIntervalRef.current = null;
      }

      // Update UI state first
      setGameResult(result);
      setGameStarted(false);

      // Save final game state - MUST succeed before completion
      try {
        await apiRequest("PATCH", `/api/games/${currentGameId}`, {
          pgn: currentGame.pgn(),
          moves: movesRef.current,
          whiteTime: whiteTimeRef.current,
          blackTime: blackTimeRef.current,
        });
      } catch (error) {
        console.error("Error saving final game state:", error);
        // Don't proceed to completion if game state save failed
        toast({
          title: "Error",
          description: "Failed to save game state. Please try again.",
          variant: "destructive",
        });
        return;
      }

      // Complete match (centralized - handles stats, ratings, WebSocket broadcast)
      // Only proceed if PATCH succeeded above
      try {
        if (currentMatchId) {
          console.log('[completeGame] Calling POST /api/matches/:id/complete');
          await apiRequest("POST", `/api/matches/${currentMatchId}/complete`, { result });
        }
        
        // Invalidate queries
        queryClient.invalidateQueries({ queryKey: ["/api/ratings"] });
        queryClient.invalidateQueries({ queryKey: ["/api/games/recent"] });
        queryClient.invalidateQueries({ queryKey: ["/api/statistics"] });
        queryClient.invalidateQueries({ queryKey: ["/api/games/ongoing"] });
      } catch (error) {
        console.error("Error completing match:", error);
        // Show error to user but don't block - WebSocket might still handle it
        toast({
          title: "Error",
          description: "Match completion error. Please check your connection.",
          variant: "destructive",
        });
      }

      // Show game end dialog after server updates
      setShowGameEndDialog(true);
    } finally {
      // Always reset guard flag so future games can complete
      gameCompletionInProgressRef.current = false;
    }
  }, []);

  const resetGameState = useCallback(() => {
    if (saveIntervalRef.current) {
      clearInterval(saveIntervalRef.current);
      saveIntervalRef.current = null;
    }
    if (clockIntervalRef.current) {
      clearInterval(clockIntervalRef.current);
      clockIntervalRef.current = null;
    }
    if (peekTimerRef.current) {
      clearInterval(peekTimerRef.current);
      peekTimerRef.current = null;
    }
    gameCompletionInProgressRef.current = false;
    setGame(null);
    setGameId(null);
    setMatchId(null);
    setGameStarted(false);
    setWhiteTime(180);
    setBlackTime(180);
    setMoves([]);
    setFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
    setSelectedSquare(null);
    setLegalMoves([]);
    setRestoredGame(false);
    setPlayerColor("white");
    setIncrement(0);
    setIsPeeking(false);
    setPeekCountdown(0);
    setActiveBlindfoldDifficulty(null);
    gameRef.current = null;
    gameIdRef.current = null;
    matchIdRef.current = null;
    whiteTimeRef.current = 180;
    blackTimeRef.current = 180;
    movesRef.current = [];
  }, []);

  const handleOpponentMove = useCallback(async (data: { matchId: string; move: string; fen: string; whiteTime: number; blackTime: number }) => {
    console.log('[handleOpponentMove] Received opponent move:', data);
    console.log('[handleOpponentMove] Current matchIdRef:', matchIdRef.current);
    console.log('[handleOpponentMove] Game ref exists:', !!gameRef.current);
    
    if (data.matchId !== matchIdRef.current) {
      console.log('[handleOpponentMove] SKIPPED - matchId mismatch (data:', data.matchId, 'ref:', matchIdRef.current, ')');
      return;
    }
    
    const currentGame = gameRef.current;
    if (!currentGame) {
      console.log('[handleOpponentMove] SKIPPED - no game ref');
      return;
    }
    
    try {
      if (!data.fen || !data.move) {
        throw new Error("Invalid move payload");
      }
      
      console.log('[handleOpponentMove] Loading FEN:', data.fen);
      currentGame.load(data.fen);
      setFen(data.fen);
      
      const newMoves = [...movesRef.current, data.move];
      console.log('[handleOpponentMove] Updating moves:', newMoves);
      setMoves(newMoves);
      movesRef.current = newMoves;
      
      setWhiteTime(data.whiteTime);
      setBlackTime(data.blackTime);
      whiteTimeRef.current = data.whiteTime;
      blackTimeRef.current = data.blackTime;
      
      // Check for game end conditions after opponent's move
      if (currentGame.isCheckmate()) {
        console.log('[handleOpponentMove] Checkmate detected - game over');
        const result = currentGame.turn() === "w" ? "black_win" : "white_win";
        await completeGame(result);
      } else if (currentGame.isDraw() || currentGame.isStalemate() || currentGame.isThreefoldRepetition() || currentGame.isInsufficientMaterial()) {
        console.log('[handleOpponentMove] Draw detected - game over');
        await completeGame("draw");
      } else {
        console.log('[handleOpponentMove] Move processed successfully');
        toast({
          title: "Opponent moved",
          description: data.move,
        });
      }
    } catch (error) {
      console.error("[handleOpponentMove] Error:", error);
      toast({
        title: "Error",
        description: "Failed to process opponent's move. Please refresh.",
        variant: "destructive",
      });
    }
  }, [toast, completeGame]);

  const handleMatchFound = useCallback((matchData: { matchId: string; game: any; timeControl: string; color: string; opponent: { name: string; rating: number } }) => {
    try {
      console.log('[handleMatchFound] Received match data:', matchData);
      console.log('[handleMatchFound] PLAYER COLOR RECEIVED:', matchData.color);
      const gameData = matchData.game;
      console.log('[handleMatchFound] Game data:', gameData);
      
      if (!gameData || !gameData.id) {
        throw new Error(`Invalid game data: ${JSON.stringify(gameData)}`);
      }
      
      // Clear any pending game completion flags for the OLD game
      // The old game has already been completed by completeGame() or the server
      gameCompletionInProgressRef.current = false;
      
      // Set refs immediately for synchronous access
      gameIdRef.current = gameData.id;
      matchIdRef.current = matchData.matchId;
      rematchExitIntentRef.current = false; // Clear exit intent for new match
      didSendRematchRequestRef.current = false; // Reset rematch request flag for new game
      gameFromMatchmakingRef.current = true; // Mark that this game came from matchmaking (not restoration)
      console.log('[handleMatchFound] Set matchIdRef to:', matchIdRef.current);
      
      setGameId(gameData.id);
      setMatchId(matchData.matchId);
      setRematchDenied(false); // Reset denied state for new game
      const chess = new Chess(gameData.fen);
      gameRef.current = chess;
      setGame(chess);
      setPlayerColor(matchData.color as "white" | "black");
      console.log('[handleMatchFound] SET playerColor STATE TO:', matchData.color);
      setFen(gameData.fen);
      
      const matchMoves = gameData.moves || [];
      setMoves(matchMoves);
      movesRef.current = matchMoves;
      
      setWhiteTime(gameData.whiteTime || 180);
      setBlackTime(gameData.blackTime || 180);
      setIncrement(gameData.increment || 0);
      setOpponentName(matchData.opponent.name);
      setOpponentRating(matchData.opponent.rating);
      setPlayerName(`${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'You');
      
      const tcValue = parseInt(matchData.timeControl) || 180;
      setTimeControl(tcValue);
      
      // Lock blindfold difficulty at game start
      if (isBlindfold && userSettings?.blindfoldDifficulty) {
        setActiveBlindfoldDifficulty(userSettings.blindfoldDifficulty);
      }
      
      setGameStarted(true);
      setInQueue(false);
      
      toast({
        title: "Match found!",
        description: `Playing as ${matchData.color} against ${matchData.opponent.name}`,
      });
    } catch (error) {
      console.error("[handleMatchFound] Error loading match:", error);
      console.error("[handleMatchFound] Error stack:", error instanceof Error ? error.stack : 'No stack');
      console.error("[handleMatchFound] Error message:", error instanceof Error ? error.message : String(error));
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load match. Please try again.",
        variant: "destructive",
      });
    }
  }, [toast, isBlindfold, userSettings, user]);

  const handleDrawOffer = useCallback((data: { matchId: string; from: string }) => {
    if (data.matchId === matchIdRef.current) {
      setShowDrawOfferDialog(true);
    }
  }, []);

  const handleDrawResponse = useCallback(async (data: { matchId: string; accepted: boolean }) => {
    if (data.matchId === matchIdRef.current) {
      if (data.accepted) {
        // Reset waiting state before completing game
        setWaitingForDrawResponse(false);
        // Complete the game for both players
        await completeGame("draw");
      } else {
        setWaitingForDrawResponse(false);
        toast({
          title: "Draw declined",
          description: "Your opponent declined the draw offer",
        });
      }
    }
  }, [toast, completeGame]);

  const handleRematchRequest = useCallback((data: { matchId: string; from: string }) => {
    if (data.matchId === matchIdRef.current) {
      rematchExitIntentRef.current = false; // Clear exit intent for new rematch
      didSendRematchRequestRef.current = false; // We received a request, so we didn't send it
      setShowRematchDialog(true);
    }
  }, []);

  const handleRematchResponse = useCallback((data: { matchId: string; accepted: boolean; newMatchId?: string }) => {
    console.log('[handleRematchResponse] Received:', data);
    console.log('[handleRematchResponse] Current matchId:', matchIdRef.current, 'Response matchId:', data.matchId);
    console.log('[handleRematchResponse] didSendRematchRequestRef.current:', didSendRematchRequestRef.current);
    console.log('[handleRematchResponse] rematchExitIntentRef.current:', rematchExitIntentRef.current);
    
    // Ignore responses from old matches
    if (data.matchId !== matchIdRef.current) {
      console.log('[handleRematchResponse] Ignoring stale response from old match');
      return;
    }
    
    // Clear waiting state
    setWaitingForRematchResponse(false);
    
    // If user clicked Main Menu, ignore this response (they've already left)
    if (rematchExitIntentRef.current) {
      console.log('[handleRematchResponse] Exit intent detected, ignoring response');
      rematchExitIntentRef.current = false; // Clear for next time
      return;
    }
    
    if (data.accepted) {
      // Close both dialogs and wait for match_found event from server
      setShowGameEndDialog(false);
      setShowRematchDialog(false);
      setRematchDenied(false); // Reset denied state on successful rematch
      toast({
        title: "Rematch accepted!",
        description: "Starting new game...",
      });
      // Don't reset game state - the match_found event will set up the new game
    } else {
      console.log('[handleRematchResponse] Rematch declined');
      // Opponent declined (clicked Main Menu or No)
      setShowRematchDialog(false);
      // Don't re-open Game End dialog - it's already open
      setRematchDenied(true); // Mark as denied - button should stay disabled until next game
      
      // Only show toast if WE sent the rematch request
      if (didSendRematchRequestRef.current) {
        console.log('[handleRematchResponse] Showing toast - we sent the request');
        toast({
          title: "Rematch denied",
          description: "Your opponent declined the rematch",
          variant: "destructive",
        });
      } else {
        console.log('[handleRematchResponse] NOT showing toast - we did not send the request');
      }
      
      // Reset the flag for next time
      didSendRematchRequestRef.current = false;
    }
  }, [toast]);

  const handleGameEndEvent = useCallback((data: { result: string; reason: string }) => {
    console.log('[handleGameEndEvent] Received game_end WebSocket event:', data);
    
    // Set the game result so the Game Over dialog shows the correct winner
    setGameResult(data.result as "white_win" | "black_win" | "draw");
    
    // Show the Game Over dialog
    setShowGameEndDialog(true);
    
    // Stop all timers
    if (saveIntervalRef.current) {
      clearInterval(saveIntervalRef.current);
      saveIntervalRef.current = null;
    }
    if (clockIntervalRef.current) {
      clearInterval(clockIntervalRef.current);
      clockIntervalRef.current = null;
    }
    
    setGameStarted(false);
  }, []);

  const { sendMove, isConnected, joinQueue, leaveQueue: wsLeaveQueue, queueStatus, joinMatch, sendDrawOffer, sendDrawResponse, sendRematchRequest, sendRematchResponse } = useWebSocket({
    userId: user?.id,
    onMove: handleOpponentMove,
    onMatchFound: handleMatchFound,
    onDrawOffer: handleDrawOffer,
    onDrawResponse: handleDrawResponse,
    onRematchRequest: handleRematchRequest,
    onRematchResponse: handleRematchResponse,
    onGameEnd: handleGameEndEvent,
  });

  // Join the match room when a match is found
  useEffect(() => {
    if (matchId && isConnected) {
      console.log('[useEffect] Joining match room:', matchId);
      joinMatch(matchId);
    }
  }, [matchId, isConnected, joinMatch]);

  const createGameMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/games", data);
      return response.json();
    },
    onSuccess: (data: Game) => {
      setGameId(data.id);
      toast({
        title: "Game started",
        description: "Good luck!",
      });
    },
    onError: (error: any) => {
      if (error.message.includes("limit reached")) {
        toast({
          title: "Daily limit reached",
          description: "Upgrade to Premium for unlimited games",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to start game",
          variant: "destructive",
        });
      }
    },
  });

  const updateGameMutation = useMutation({
    mutationFn: async (data: any) => {
      const currentGameId = gameIdRef.current;
      const currentMatchId = matchIdRef.current;
      if (!currentGameId) return;
      await apiRequest("PATCH", `/api/games/${currentGameId}`, data);
      if (currentMatchId && data.status === 'completed') {
        await apiRequest("PATCH", `/api/matches/${currentMatchId}`, { status: 'completed' });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ratings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/games/recent"] });
      queryClient.invalidateQueries({ queryKey: ["/api/statistics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/games/ongoing"] });
      resetGameState();
    },
  });

  const { data: ongoingGame } = useQuery<Game>({
    queryKey: ["/api/games/ongoing"],
    enabled: !restoredGame && !gameStarted && !inQueue,
  });

  useEffect(() => {
    setInQueue(queueStatus.inQueue);
  }, [queueStatus]);

  const handleJoinQueue = (timeControl: string) => {
    if (!isConnected) {
      toast({
        title: "Not connected",
        description: "Please wait for connection...",
        variant: "destructive",
      });
      return;
    }

    resetGameState();
    setQueueType(`standard_${timeControl}`);
    joinQueue(timeControl);
    
    toast({
      title: "Joined queue",
      description: `Looking for ${timeControl} game...`,
    });
  };

  const handleLeaveQueue = () => {
    wsLeaveQueue();
    setQueueType(null);
    toast({
      title: "Left queue",
    });
  };

  useEffect(() => {
    if (ongoingGame && !restoredGame && !gameStarted && !inQueue && ongoingGame.status === 'active') {
      const restoreGame = async () => {
        try {
          const matchResponse = await apiRequest("GET", "/api/matches/active");
          
          if (!matchResponse.ok) {
            setRestoredGame(true);
            return;
          }
          
          const matchData = await matchResponse.json();
          if (!matchData || !matchData.matchId || matchData.status === 'completed') {
            setRestoredGame(true);
            return;
          }
          
          if (queueType && ongoingGame.mode !== queueType) {
            setRestoredGame(true);
            return;
          }
          
          if (!queueType) {
            setQueueType(ongoingGame.mode);
          }
          
          setMatchId(matchData.matchId);
          
          const chess = new Chess(ongoingGame.fen || undefined);
          setGame(chess);
          setGameId(ongoingGame.id);
          setPlayerColor((ongoingGame as any).playerColor || "white");
          setFen(ongoingGame.fen || "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
          
          const restoredMoves = ongoingGame.moves || [];
          setMoves(restoredMoves);
          movesRef.current = restoredMoves;
          
          setWhiteTime(ongoingGame.whiteTime || 180);
          setBlackTime(ongoingGame.blackTime || 180);
          setIncrement(ongoingGame.increment || 0);
          
          // Restore blindfold difficulty if it was saved with the game
          if ((ongoingGame as any).blindfoldDifficulty) {
            setActiveBlindfoldDifficulty((ongoingGame as any).blindfoldDifficulty);
            setIsBlindfold(true);
          }
          
          setGameStarted(true);
          setRestoredGame(true);
          
          // Only show "Game restored" toast if this is a real restoration (not a new game from matchmaking)
          if (!gameFromMatchmakingRef.current) {
            toast({
              title: "Game restored",
              description: "Your ongoing game has been loaded with live sync",
            });
          }
          
          // Reset the matchmaking flag after restoration logic runs
          gameFromMatchmakingRef.current = false;
        } catch (error) {
          console.error("Error restoring game:", error);
          toast({
            title: "Error",
            description: "Failed to restore game. Please refresh.",
            variant: "destructive",
          });
          setRestoredGame(true);
        }
      };
      
      restoreGame();
    }
  }, [ongoingGame, restoredGame, gameStarted, toast]);

  const saveGameState = useCallback(async () => {
    const currentGame = gameRef.current;
    const currentGameId = gameIdRef.current;
    
    if (!currentGameId || !currentGame) return;
    
    try {
      await apiRequest("PATCH", `/api/games/${currentGameId}`, {
        fen: currentGame.fen(),
        moves: movesRef.current,
        whiteTime: whiteTimeRef.current,
        blackTime: blackTimeRef.current,
        pgn: currentGame.pgn(),
      });
    } catch (error) {
      console.error("Error saving game state:", error);
    }
  }, []);

  const handleGameEnd = useCallback(async (result: "white_win" | "black_win" | "draw") => {
    await completeGame(result);
  }, [completeGame]);

  useEffect(() => {
    if (gameStarted && game) {
      const timer = setInterval(() => {
        const currentTurn = game.turn();
        
        if (currentTurn === "w") {
          setWhiteTime((t) => {
            const newTime = Math.max(0, t - 1);
            // Always update ref for the current turn
            whiteTimeRef.current = newTime;
            // Check for timeout - white loses, black wins
            if (newTime === 0 && t > 0) {
              handleGameEnd("black_win");
            }
            return newTime;
          });
        } else {
          setBlackTime((t) => {
            const newTime = Math.max(0, t - 1);
            // Always update ref for the current turn
            blackTimeRef.current = newTime;
            // Check for timeout - black loses, white wins
            if (newTime === 0 && t > 0) {
              handleGameEnd("white_win");
            }
            return newTime;
          });
        }
      }, 1000);
      
      clockIntervalRef.current = timer;

      return () => {
        clearInterval(timer);
        clockIntervalRef.current = null;
      };
    }
  }, [gameStarted, game, playerColor, handleGameEnd]);

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

  const handleSquareClick = async (square: string) => {
    console.log('[handleSquareClick] Square clicked:', square);
    console.log('[handleSquareClick] game:', !!game, 'gameStarted:', gameStarted);
    
    if (!game || !gameStarted) {
      console.log('[handleSquareClick] Skipping - no game or not started');
      return;
    }

    // Check if it's the player's turn
    const currentTurn = game.turn();
    const isMyTurn = (currentTurn === "w" && playerColor === "white") || (currentTurn === "b" && playerColor === "black");
    
    if (!isMyTurn) {
      console.log('[handleSquareClick] Not your turn');
      return;
    }

    if (selectedSquare) {
      console.log('[handleSquareClick] Selected square exists:', selectedSquare, '-> attempting move to:', square);
      try {
        const move = game.move({
          from: selectedSquare,
          to: square,
          promotion: "q",
        });

        console.log('[handleSquareClick] Move result:', move);

        if (move) {
          const newFen = game.fen();
          console.log('[handleSquareClick] New FEN:', newFen);
          console.log('[handleSquareClick] Move SAN:', move.san);
          
          setFen(newFen);
          
          const newMoves = [...movesRef.current, move.san];
          console.log('[handleSquareClick] New moves array:', newMoves);
          setMoves(newMoves);
          movesRef.current = newMoves;
          
          setSelectedSquare(null);
          setLegalMoves([]);
          
          console.log('[handleSquareClick] gameId:', gameId, 'matchId:', matchId);
          if (gameId && matchId) {
            console.log('[handleSquareClick] Sending move via WebSocket');
            sendMove(matchId, move.san, newFen, whiteTime, blackTime);
          }
          
          if (game.isCheckmate()) {
            await handleGameEnd(game.turn() === "w" ? "black_win" : "white_win");
          } else if (game.isDraw() || game.isStalemate() || game.isThreefoldRepetition() || game.isInsufficientMaterial()) {
            await handleGameEnd("draw");
          } else {
            saveGameState();
          }
        } else {
          console.log('[handleSquareClick] Move failed - selecting new square');
          const moves = game.moves({ square: square as any, verbose: true });
          if (moves.length > 0) {
            setSelectedSquare(square);
            setLegalMoves(moves.map((m: any) => m.to));
          }
        }
      } catch (e) {
        console.error('[handleSquareClick] Move error:', e);
        const moves = game.moves({ square: square as any, verbose: true });
        if (moves.length > 0) {
          setSelectedSquare(square);
          setLegalMoves(moves.map((m: any) => m.to));
        }
      }
    } else {
      console.log('[handleSquareClick] No selected square - selecting:', square);
      const moves = game.moves({ square: square as any, verbose: true });
      console.log('[handleSquareClick] Legal moves:', moves);
      if (moves.length > 0) {
        setSelectedSquare(square);
        setLegalMoves(moves.map((m: any) => m.to));
      }
    }
  };

  const handleResign = async () => {
    if (!game) return;
    // The resigning player loses, so opponent wins
    await completeGame(playerColor === "white" ? "black_win" : "white_win");
  };

  const handleOfferDraw = () => {
    if (!matchId) return;
    setWaitingForDrawResponse(true);
    sendDrawOffer(matchId);
    toast({
      title: "Draw offer sent",
      description: "Waiting for opponent's response...",
    });
  };

  const handlePeek = () => {
    if (!isBlindfold || remainingPeeks <= 0 || isPeeking) return;
    
    // Use locked difficulty if in a game, otherwise use current setting
    const effectiveDifficulty = activeBlindfoldDifficulty || userSettings?.blindfoldDifficulty || 'easy';
    const config = BLINDFOLD_CONFIG[effectiveDifficulty as keyof typeof BLINDFOLD_CONFIG];
    
    if (config.peekDuration === 0) return;
    
    if (isFinite(config.maxPeeks)) {
      setRemainingPeeks(prev => prev - 1);
    }
    
    setIsPeeking(true);
    setPeekCountdown(config.peekDuration);
    
    const startTime = Date.now();
    const endTime = startTime + config.peekDuration;
    
    peekTimerRef.current = setInterval(() => {
      const remaining = Math.max(0, endTime - Date.now());
      setPeekCountdown(remaining);
      
      if (remaining <= 0 && peekTimerRef.current) {
        clearInterval(peekTimerRef.current);
        peekTimerRef.current = null;
        setIsPeeking(false);
        setPeekCountdown(0);
      }
    }, 100);
  };
  
  useEffect(() => {
    // Clean up any active peek timer
    if (peekTimerRef.current) {
      clearInterval(peekTimerRef.current);
      peekTimerRef.current = null;
    }
    
    // Reset peek state
    setIsPeeking(false);
    setPeekCountdown(0);
    
    // Determine which difficulty to use: active game difficulty takes precedence
    const effectiveDifficulty = activeBlindfoldDifficulty || userSettings?.blindfoldDifficulty;
    
    // Initialize peek count based on mode
    if (isBlindfold && effectiveDifficulty) {
      const config = BLINDFOLD_CONFIG[effectiveDifficulty as keyof typeof BLINDFOLD_CONFIG];
      setRemainingPeeks(config.maxPeeks);
    } else {
      // Not in blindfold mode - reset to infinity (doesn't matter)
      setRemainingPeeks(Number.POSITIVE_INFINITY);
    }
    
    // Cleanup function for when effect re-runs or component unmounts
    return () => {
      if (peekTimerRef.current) {
        clearInterval(peekTimerRef.current);
        peekTimerRef.current = null;
      }
    };
  }, [isBlindfold, activeBlindfoldDifficulty, userSettings?.blindfoldDifficulty]);

  return (
    <div className="h-full md:h-screen flex flex-col md:flex-row overflow-auto md:overflow-hidden">
      <div className="flex-1 flex items-center justify-center p-4 md:p-8 bg-muted/30 md:overflow-auto">
        <div className="w-full max-w-3xl space-y-4 md:space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">Standard Mode</h1>
              <p className="text-sm md:text-base text-muted-foreground">Online chess with automatic clocks</p>
            </div>
            {!user?.isPremium && (
              <Badge variant="secondary">
                {5 - (user?.dailyGamesPlayed || 0)} free games left today
              </Badge>
            )}
          </div>

          {!gameStarted ? (
            <>
              {!inQueue ? (
                <Card>
                  <CardContent className="pt-6 space-y-4">
                    <div className="flex items-center justify-between pb-4 border-b">
                      <Label htmlFor="blindfold-toggle" className="text-base font-semibold">
                        Blindfold Mode
                      </Label>
                      <Switch
                        id="blindfold-toggle"
                        checked={isBlindfold}
                        onCheckedChange={setIsBlindfold}
                        data-testid="switch-blindfold"
                      />
                    </div>
                    {isBlindfold && (
                      <p className="text-sm text-muted-foreground">
                        Board will be hidden. Use the peek button to view it briefly.
                      </p>
                    )}

                    <h2 className="text-lg md:text-xl font-semibold">Find Opponent</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Button 
                        variant="outline"
                        size="lg"
                        onClick={() => handleJoinQueue('bullet')}
                        disabled={!isConnected}
                        data-testid="button-queue-bullet"
                      >
                        <Clock className="mr-2 h-4 w-4" />
                        Bullet (1m)
                      </Button>
                      <Button 
                        variant="outline"
                        size="lg"
                        onClick={() => handleJoinQueue('blitz')}
                        disabled={!isConnected}
                        data-testid="button-queue-blitz"
                      >
                        <Clock className="mr-2 h-4 w-4" />
                        Blitz (5m)
                      </Button>
                      <Button 
                        variant="outline"
                        size="lg"
                        onClick={() => handleJoinQueue('rapid')}
                        disabled={!isConnected}
                        data-testid="button-queue-rapid"
                      >
                        <Clock className="mr-2 h-4 w-4" />
                        Rapid (15m)
                      </Button>
                      <Button 
                        variant="outline"
                        size="lg"
                        onClick={() => handleJoinQueue('classical')}
                        disabled={!isConnected}
                        data-testid="button-queue-classical"
                      >
                        <Clock className="mr-2 h-4 w-4" />
                        Classical (30m)
                      </Button>
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
                      onClick={handleLeaveQueue}
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
              <div className="space-y-2">
                <Card>
                  <CardContent className="py-3">
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-sm font-medium" data-testid="text-opponent-name">
                        {opponentName}
                      </span>
                      <span className="text-sm text-muted-foreground font-mono" data-testid="text-opponent-rating">
                        ({opponentRating})
                      </span>
                    </div>
                  </CardContent>
                </Card>
                
                <div className="relative">
                  <ChessBoard 
                    fen={fen}
                    orientation={playerColor}
                    showCoordinates={true}
                    highlightedSquares={legalMoves}
                    onSquareClick={handleSquareClick}
                  />
                  
                  {isBlindfold && !isPeeking && (
                    <div className="absolute inset-0 bg-black pointer-events-none overflow-visible">
                      <svg className="w-full h-full" viewBox="0 0 8 8" preserveAspectRatio="none">
                        {Array.from({ length: 9 }).map((_, i) => (
                          <line
                            key={`h-${i}`}
                            x1="0"
                            y1={i}
                            x2="8"
                            y2={i}
                            stroke="white"
                            strokeWidth="0.02"
                          />
                        ))}
                        {Array.from({ length: 9 }).map((_, i) => (
                          <line
                            key={`v-${i}`}
                            x1={i}
                            y1="0"
                            x2={i}
                            y2="8"
                            stroke="white"
                            strokeWidth="0.02"
                          />
                        ))}
                      </svg>
                    </div>
                  )}
                </div>
                
                {isBlindfold && (userSettings?.blindfoldDifficulty !== 'grandmaster') && (
                  <div className="flex flex-col items-center gap-2 py-2">
                    {isPeeking && peekCountdown > 0 && (
                      <div className="text-2xl font-mono font-bold text-primary" data-testid="text-peek-countdown">
                        {(peekCountdown / 1000).toFixed(1)}s
                      </div>
                    )}
                    <Button
                      onClick={handlePeek}
                      variant="outline"
                      size="lg"
                      disabled={remainingPeeks === 0 || isPeeking}
                      data-testid="button-peek"
                    >
                      <Eye className="mr-2 h-5 w-5" />
                      Peek
                    </Button>
                    <div className="text-sm text-muted-foreground" data-testid="text-remaining-peeks">
                      {!isFinite(remainingPeeks) ? (
                        <span className="flex items-center gap-1">
                          <InfinityIcon className="h-4 w-4" /> peeks left
                        </span>
                      ) : (
                        <span>{remainingPeeks} peeks left</span>
                      )}
                    </div>
                  </div>
                )}
                
                <Card>
                  <CardContent className="py-3">
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-sm font-medium" data-testid="text-player-name">
                        {playerName}
                      </span>
                      <span className="text-sm text-muted-foreground font-mono" data-testid="text-player-rating">
                        ({playerRatings?.[getRatingCategory(timeControl)] || 1200})
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardContent className="py-4 md:py-6">
                  <div className="grid grid-cols-2 gap-4 md:gap-6">
                    <div className="space-y-2 md:space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs md:text-sm font-medium text-muted-foreground">White</span>
                        {game && game.turn() === "w" && (
                          <Badge variant="default" className="text-xs">Active</Badge>
                        )}
                      </div>
                      <div className={`text-3xl md:text-5xl font-mono font-bold ${
                        game && game.turn() === "w" ? "text-foreground" : "text-muted-foreground"
                      }`} data-testid="text-white-time">
                        {formatTime(whiteTime)}
                      </div>
                    </div>

                    <div className="space-y-2 md:space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs md:text-sm font-medium text-muted-foreground">Black</span>
                        {game && game.turn() === "b" && (
                          <Badge variant="default" className="text-xs">Active</Badge>
                        )}
                      </div>
                      <div className={`text-3xl md:text-5xl font-mono font-bold ${
                        game && game.turn() === "b" ? "text-foreground" : "text-muted-foreground"
                      }`} data-testid="text-black-time">
                        {formatTime(blackTime)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 md:mt-6 pt-4 md:pt-6 border-t flex flex-col sm:flex-row gap-3">
                    <Button 
                      variant="outline" 
                      className="flex-1" 
                      onClick={handleOfferDraw} 
                      disabled={waitingForDrawResponse}
                      data-testid="button-offer-draw"
                    >
                      <HandshakeIcon className="mr-2 h-4 w-4" />
                      {waitingForDrawResponse ? "Waiting..." : "Offer Draw"}
                    </Button>
                    <Button variant="destructive" className="flex-1" onClick={handleResign} data-testid="button-resign">
                      <Flag className="mr-2 h-4 w-4" />
                      Resign
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>

      {gameStarted && (
        <div className="w-full md:w-80 md:max-h-screen border-t md:border-t-0 md:border-l bg-card flex flex-col">
          {isBlindfold ? (
            <>
              <div className="p-4 border-b">
                <h3 className="font-semibold">Last Move</h3>
              </div>
              <div className="flex-1 p-4">
                {(() => {
                  // Compute last opponent move
                  let lastOpponentMove: string | null = null;
                  
                  if (moves.length > 0 && matchId && playerColor) {
                    const lastMoveIndex = moves.length - 1;
                    const lastMoveIsWhite = lastMoveIndex % 2 === 0;
                    const lastMoveColor = lastMoveIsWhite ? 'w' : 'b';
                    const myColor = playerColor === "white" ? 'w' : 'b';
                    
                    // If the last move was not made by me, it's the opponent's move
                    if (lastMoveColor !== myColor) {
                      lastOpponentMove = moves[lastMoveIndex];
                    } else if (moves.length >= 2) {
                      // If the last move was mine, get the second-to-last move
                      lastOpponentMove = moves[lastMoveIndex - 1];
                    }
                  }
                  
                  if (moves.length === 0) {
                    return (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        No moves yet
                      </p>
                    );
                  } else if (lastOpponentMove) {
                    return (
                      <Card className="bg-muted/50">
                        <CardContent className="p-4">
                          <div className="text-sm text-muted-foreground mb-1">
                            Opponent's last move:
                          </div>
                          <div className="font-mono text-2xl font-semibold" data-testid="text-last-opponent-move">
                            {lastOpponentMove}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  } else {
                    return (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        Waiting for opponent...
                      </p>
                    );
                  }
                })()}
              </div>
            </>
          ) : (
            <>
              <div className="p-4 border-b">
                <h3 className="font-semibold">Score Sheet</h3>
              </div>
              <ScrollArea className="flex-1 p-4">
                {moves.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No moves yet
                  </p>
                ) : (
                  <div className="font-mono text-sm">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-2 w-12 text-muted-foreground font-medium">#</th>
                          <th className="text-left py-2 px-2 font-medium">White</th>
                          <th className="text-left py-2 px-2 font-medium">Black</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.from({ length: Math.ceil(moves.length / 2) }).map((_, moveNumber) => {
                          const whiteMove = moves[moveNumber * 2];
                          const blackMove = moves[moveNumber * 2 + 1];
                          
                          return (
                            <tr key={moveNumber} className="border-b border-border/50">
                              <td className="py-2 px-2 text-muted-foreground">{moveNumber + 1}</td>
                              <td className="py-2 px-2">{whiteMove || "-"}</td>
                              <td className="py-2 px-2">{blackMove || "-"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </ScrollArea>
            </>
          )}
        </div>
      )}

      {/* Draw Offer Dialog */}
      <Dialog open={showDrawOfferDialog} onOpenChange={setShowDrawOfferDialog}>
        <DialogContent data-testid="dialog-draw-offer">
          <DialogHeader>
            <DialogTitle>Draw Offer</DialogTitle>
            <DialogDescription>
              Your opponent is offering a draw. Do you accept?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                if (matchId) sendDrawResponse(matchId, false);
                setShowDrawOfferDialog(false);
              }}
              data-testid="button-decline-draw"
            >
              Decline
            </Button>
            <Button
              onClick={async () => {
                if (matchId) {
                  // Close dialog immediately
                  setShowDrawOfferDialog(false);
                  
                  // Send acceptance to opponent
                  sendDrawResponse(matchId, true);
                  
                  // Complete the game
                  await completeGame("draw");
                }
              }}
              data-testid="button-accept-draw"
            >
              Accept
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rematch Request Dialog */}
      <Dialog open={showRematchDialog} onOpenChange={(open) => {
        // Don't allow closing while waiting for response
        if (!waitingForRematchResponse) {
          setShowRematchDialog(open);
        }
      }}>
        <DialogContent data-testid="dialog-rematch-request">
          <DialogHeader>
            <DialogTitle>Rematch Request</DialogTitle>
            <DialogDescription>
              {waitingForRematchResponse ? "Creating rematch..." : "Your opponent wants to play again."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={() => {
                  if (matchId) {
                    sendRematchResponse(matchId, true);
                    setWaitingForRematchResponse(true);
                  }
                }}
                disabled={waitingForRematchResponse}
                data-testid="button-accept-rematch"
              >
                Yes
              </Button>
              <Button
                className="flex-1"
                variant="outline"
                onClick={() => {
                  if (matchId) sendRematchResponse(matchId, false);
                  setShowRematchDialog(false);
                }}
                disabled={waitingForRematchResponse}
                data-testid="button-decline-rematch"
              >
                No
              </Button>
            </div>
            <Button
              variant="secondary"
              onClick={() => {
                if (matchId) sendRematchResponse(matchId, false);
                // Mark exit intent so response handler ignores late responses
                rematchExitIntentRef.current = true;
                setShowRematchDialog(false);
                setShowGameEndDialog(false);
                resetGameState();
              }}
              disabled={waitingForRematchResponse}
              data-testid="button-rematch-main-menu"
            >
              Main Menu
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Game End Dialog */}
      <Dialog open={showGameEndDialog} onOpenChange={setShowGameEndDialog}>
        <DialogContent data-testid="dialog-game-end">
          <DialogHeader>
            <DialogTitle>Game Over</DialogTitle>
            <DialogDescription>
              {gameResult === "draw" 
                ? "The game ended in a draw"
                : gameResult === "white_win"
                ? "White wins!"
                : "Black wins!"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setShowGameEndDialog(false);
                resetGameState();
              }}
              data-testid="button-main-menu"
            >
              Main Menu
            </Button>
            <Button
              onClick={() => {
                if (matchId) {
                  setWaitingForRematchResponse(true);
                  didSendRematchRequestRef.current = true; // Mark that we sent the request
                  console.log('[Rematch Button] Set didSendRematchRequestRef to true');
                  sendRematchRequest(matchId);
                  toast({
                    title: "Rematch requested",
                    description: "Waiting for opponent...",
                  });
                }
              }}
              disabled={waitingForRematchResponse || rematchDenied}
              data-testid="button-request-rematch"
            >
              {waitingForRematchResponse ? "Waiting..." : "Ask for Rematch"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
