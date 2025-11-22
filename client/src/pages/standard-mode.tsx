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
import { Clock, Play, HandshakeIcon, Flag, Eye } from "lucide-react";
import type { Game } from "@shared/schema";

export default function StandardMode() {
  const { user } = useAuth();
  const { toast } = useToast();
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
  const [showBoard, setShowBoard] = useState(true);
  const [playerColor, setPlayerColor] = useState<"white" | "black">("white");
  const [increment, setIncrement] = useState(0);
  const [opponentName, setOpponentName] = useState<string>("");
  const [playerName, setPlayerName] = useState<string>("");
  
  const gameRef = useRef<Chess | null>(null);
  const gameIdRef = useRef<string | null>(null);
  const matchIdRef = useRef<string | null>(null);
  const whiteTimeRef = useRef(180);
  const blackTimeRef = useRef(180);
  const movesRef = useRef<string[]>([]);
  const saveIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    gameRef.current = game;
    gameIdRef.current = gameId;
    matchIdRef.current = matchId;
    whiteTimeRef.current = whiteTime;
    blackTimeRef.current = blackTime;
    movesRef.current = moves;
  }, [game, gameId, matchId, whiteTime, blackTime, moves]);

  const resetGameState = useCallback(() => {
    if (saveIntervalRef.current) {
      clearInterval(saveIntervalRef.current);
      saveIntervalRef.current = null;
    }
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
    setShowBoard(true);
    gameRef.current = null;
    gameIdRef.current = null;
    matchIdRef.current = null;
    whiteTimeRef.current = 180;
    blackTimeRef.current = 180;
    movesRef.current = [];
  }, []);

  const handleOpponentMove = useCallback((data: { matchId: string; move: string; fen: string; whiteTime: number; blackTime: number }) => {
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
        
        // Update game on server
        const currentGameId = gameIdRef.current;
        const currentMatchId = matchIdRef.current;
        if (currentGameId) {
          apiRequest("PATCH", `/api/games/${currentGameId}`, {
            status: "completed",
            result,
            completedAt: new Date(),
            pgn: currentGame.pgn(),
            moves: movesRef.current,
            whiteTime: data.whiteTime,
            blackTime: data.blackTime,
          }).then(() => {
            if (currentMatchId) {
              return apiRequest("PATCH", `/api/matches/${currentMatchId}`, { status: 'completed' });
            }
          }).then(() => {
            queryClient.invalidateQueries({ queryKey: ["/api/ratings"] });
            queryClient.invalidateQueries({ queryKey: ["/api/games/recent"] });
            queryClient.invalidateQueries({ queryKey: ["/api/statistics"] });
            queryClient.invalidateQueries({ queryKey: ["/api/games/ongoing"] });
          });
        }
        
        toast({
          title: "Game Over",
          description: result === "white_win" ? "White wins!" : "Black wins!",
        });
        
        setGameStarted(false);
        setShowBoard(true);
      } else if (currentGame.isDraw() || currentGame.isStalemate() || currentGame.isThreefoldRepetition() || currentGame.isInsufficientMaterial()) {
        console.log('[handleOpponentMove] Draw detected - game over');
        
        // Update game on server
        const currentGameId = gameIdRef.current;
        const currentMatchId = matchIdRef.current;
        if (currentGameId) {
          apiRequest("PATCH", `/api/games/${currentGameId}`, {
            status: "completed",
            result: "draw",
            completedAt: new Date(),
            pgn: currentGame.pgn(),
            moves: movesRef.current,
            whiteTime: data.whiteTime,
            blackTime: data.blackTime,
          }).then(() => {
            if (currentMatchId) {
              return apiRequest("PATCH", `/api/matches/${currentMatchId}`, { status: 'completed' });
            }
          }).then(() => {
            queryClient.invalidateQueries({ queryKey: ["/api/ratings"] });
            queryClient.invalidateQueries({ queryKey: ["/api/games/recent"] });
            queryClient.invalidateQueries({ queryKey: ["/api/statistics"] });
            queryClient.invalidateQueries({ queryKey: ["/api/games/ongoing"] });
          });
        }
        
        toast({
          title: "Game Over",
          description: "Game drawn",
        });
        
        setGameStarted(false);
        setShowBoard(true);
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
  }, [toast]);

  const handleMatchFound = useCallback((matchData: { matchId: string; game: any; timeControl: string; color: string; opponent: { name: string; rating: number } }) => {
    try {
      console.log('[handleMatchFound] Received match data:', matchData);
      console.log('[handleMatchFound] PLAYER COLOR RECEIVED:', matchData.color);
      const gameData = matchData.game;
      console.log('[handleMatchFound] Game data:', gameData);
      
      if (!gameData || !gameData.id) {
        throw new Error(`Invalid game data: ${JSON.stringify(gameData)}`);
      }
      
      // Set refs immediately for synchronous access
      gameIdRef.current = gameData.id;
      matchIdRef.current = matchData.matchId;
      console.log('[handleMatchFound] Set matchIdRef to:', matchIdRef.current);
      
      setGameId(gameData.id);
      setMatchId(matchData.matchId);
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
      setPlayerName(`${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'You');
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
  }, [toast]);

  const { sendMove, isConnected, joinQueue, leaveQueue: wsLeaveQueue, queueStatus, joinMatch } = useWebSocket({
    userId: user?.id,
    onMove: handleOpponentMove,
    onMatchFound: handleMatchFound,
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
      if (!gameId) return;
      await apiRequest("PATCH", `/api/games/${gameId}`, data);
      if (matchId && data.status === 'completed') {
        await apiRequest("PATCH", `/api/matches/${matchId}`, { status: 'completed' });
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
          setGameStarted(true);
          setRestoredGame(true);
          
          toast({
            title: "Game restored",
            description: "Your ongoing game has been loaded with live sync",
          });
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

  const handleGameEnd = useCallback((result: "white_win" | "black_win" | "draw") => {
    if (!game || !gameId) return;

    if (saveIntervalRef.current) {
      clearInterval(saveIntervalRef.current);
      saveIntervalRef.current = null;
    }

    updateGameMutation.mutate({
      status: "completed",
      result,
      completedAt: new Date(),
      pgn: game.pgn(),
      moves: movesRef.current,
      whiteTime: whiteTimeRef.current,
      blackTime: blackTimeRef.current,
    });

    toast({
      title: "Game Over",
      description: result === "draw" ? "Game drawn" : result === "white_win" ? "White wins!" : "Black wins!",
    });

    setGameStarted(false);
    setShowBoard(true);
  }, [game, gameId, updateGameMutation, toast]);

  useEffect(() => {
    if (gameStarted && game) {
      const timer = setInterval(() => {
        const currentTurn = game.turn();
        const isMyTurn = (currentTurn === "w" && playerColor === "white") || (currentTurn === "b" && playerColor === "black");
        
        if (currentTurn === "w") {
          setWhiteTime((t) => {
            const newTime = Math.max(0, t - 1);
            if (isMyTurn) {
              whiteTimeRef.current = newTime;
            }
            if (newTime === 0 && t > 0 && isMyTurn) {
              handleGameEnd("black_win");
            }
            return newTime;
          });
        } else {
          setBlackTime((t) => {
            const newTime = Math.max(0, t - 1);
            if (isMyTurn) {
              blackTimeRef.current = newTime;
            }
            if (newTime === 0 && t > 0 && isMyTurn) {
              handleGameEnd("white_win");
            }
            return newTime;
          });
        }
      }, 1000);

      return () => clearInterval(timer);
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

  const handleSquareClick = (square: string) => {
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
            handleGameEnd(game.turn() === "w" ? "black_win" : "white_win");
          } else if (game.isDraw() || game.isStalemate() || game.isThreefoldRepetition() || game.isInsufficientMaterial()) {
            handleGameEnd("draw");
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

  const handleResign = () => {
    if (!game) return;
    handleGameEnd(game.turn() === "w" ? "black_win" : "white_win");
  };

  const handleOfferDraw = () => {
    handleGameEnd("draw");
  };

  const handlePeek = () => {
    setShowBoard(true);
    setTimeout(() => setShowBoard(false), 2000);
  };

  return (
    <div className="h-screen flex">
      <div className="flex-1 flex items-center justify-center p-8 bg-muted/30">
        <div className="w-full max-w-3xl space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Standard Mode</h1>
              <p className="text-muted-foreground">Online chess with automatic clocks</p>
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

                    <h2 className="text-xl font-semibold">Find Opponent</h2>
                    <div className="grid grid-cols-2 gap-3">
                      <Button 
                        variant="outline" 
                        onClick={() => handleJoinQueue('bullet')}
                        disabled={!isConnected}
                        data-testid="button-queue-bullet"
                      >
                        <Clock className="mr-2 h-4 w-4" />
                        Bullet (1m)
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={() => handleJoinQueue('blitz')}
                        disabled={!isConnected}
                        data-testid="button-queue-blitz"
                      >
                        <Clock className="mr-2 h-4 w-4" />
                        Blitz (5m)
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={() => handleJoinQueue('rapid')}
                        disabled={!isConnected}
                        data-testid="button-queue-rapid"
                      >
                        <Clock className="mr-2 h-4 w-4" />
                        Rapid (15m)
                      </Button>
                      <Button 
                        variant="outline" 
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
              {isBlindfold && !showBoard ? (
                <Card>
                  <CardContent className="py-24 text-center">
                    <div className="space-y-4">
                      <p className="text-2xl font-semibold text-muted-foreground">
                        Board Hidden
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Visualize the position in your mind
                      </p>
                      <Button
                        onClick={handlePeek}
                        variant="outline"
                        size="lg"
                        data-testid="button-peek"
                      >
                        <Eye className="mr-2 h-5 w-5" />
                        Peek (2s)
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  <Card>
                    <CardContent className="py-3">
                      <div className="text-sm font-medium text-center" data-testid="text-opponent-name">
                        {opponentName}
                      </div>
                    </CardContent>
                  </Card>
                  <ChessBoard 
                    fen={fen}
                    orientation={playerColor}
                    showCoordinates={true}
                    highlightedSquares={legalMoves}
                    onSquareClick={handleSquareClick}
                  />
                  <Card>
                    <CardContent className="py-3">
                      <div className="text-sm font-medium text-center" data-testid="text-player-name">
                        {playerName}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              <Card>
                <CardContent className="py-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-muted-foreground">White</span>
                        {game && game.turn() === "w" && (
                          <Badge variant="default" className="text-xs">Active</Badge>
                        )}
                      </div>
                      <div className={`text-5xl font-mono font-bold ${
                        game && game.turn() === "w" ? "text-foreground" : "text-muted-foreground"
                      }`} data-testid="text-white-time">
                        {formatTime(whiteTime)}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-muted-foreground">Black</span>
                        {game && game.turn() === "b" && (
                          <Badge variant="default" className="text-xs">Active</Badge>
                        )}
                      </div>
                      <div className={`text-5xl font-mono font-bold ${
                        game && game.turn() === "b" ? "text-foreground" : "text-muted-foreground"
                      }`} data-testid="text-black-time">
                        {formatTime(blackTime)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-6 border-t flex gap-3">
                    <Button variant="outline" className="flex-1" onClick={handleOfferDraw} data-testid="button-offer-draw">
                      <HandshakeIcon className="mr-2 h-4 w-4" />
                      Offer Draw
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
        <div className="w-80 border-l bg-card flex flex-col">
          <div className="p-4 border-b">
            <h3 className="font-semibold">Move List</h3>
          </div>
          <ScrollArea className="flex-1 p-4">
            {moves.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No moves yet
              </p>
            ) : (
              <div className="space-y-2 font-mono text-sm">
                {moves.map((move, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-muted-foreground w-8">{Math.floor(i / 2) + 1}.</span>
                    <span>{move}</span>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
