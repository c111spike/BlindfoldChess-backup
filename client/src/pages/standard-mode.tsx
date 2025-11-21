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
  
  const gameRef = useRef<Chess | null>(null);
  const gameIdRef = useRef<string | null>(null);
  const whiteTimeRef = useRef(180);
  const blackTimeRef = useRef(180);
  const saveIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    gameRef.current = game;
    gameIdRef.current = gameId;
    whiteTimeRef.current = whiteTime;
    blackTimeRef.current = blackTime;
  }, [game, gameId, whiteTime, blackTime]);

  const handleOpponentMove = useCallback((data: { gameId: string; move: string; fen: string; whiteTime: number; blackTime: number }) => {
    if (data.gameId !== gameId) return;
    
    const currentGame = gameRef.current;
    if (!currentGame) return;
    
    try {
      if (!data.fen || !data.move) {
        throw new Error("Invalid move payload");
      }
      
      const newGame = new Chess(data.fen);
      currentGame.load(data.fen);
      setFen(data.fen);
      setMoves(currentGame.history());
      setWhiteTime(data.whiteTime);
      setBlackTime(data.blackTime);
      
      toast({
        title: "Opponent moved",
        description: data.move,
      });
    } catch (error) {
      console.error("Error handling opponent move:", error);
      toast({
        title: "Error",
        description: "Failed to process opponent's move. Please refresh.",
        variant: "destructive",
      });
    }
  }, [gameId, toast]);

  const { sendMove, isConnected } = useWebSocket({
    userId: user?.id,
    matchId: matchId || undefined,
    onMove: handleOpponentMove,
  });

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
      return response.json();
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
        const response = await apiRequest("POST", "/api/queue/findMatch", { queueType });
        const data = await response.json();
        if (data.matched && data.game) {
          if (!data.matchId) {
            toast({
              title: "Match Error",
              description: "Failed to join match room. Please try again.",
              variant: "destructive",
            });
            setInQueue(false);
            return;
          }
          
          setGameId(data.game.id);
          setMatchId(data.matchId);
          const chess = new Chess(data.game.fen);
          setGame(chess);
          setPlayerColor(data.game.playerColor || "white");
          setFen(data.game.fen);
          setMoves([]);
          setWhiteTime(data.game.whiteTime || 180);
          setBlackTime(data.game.blackTime || 180);
          setIncrement(data.game.increment || 0);
          setGameStarted(true);
          setInQueue(false);
        } else {
          const ongoingResponse = await apiRequest("GET", "/api/games/ongoing");
          if (ongoingResponse.ok) {
            const ongoingData = await ongoingResponse.json();
            if (ongoingData && ongoingData.mode?.startsWith('standard_')) {
              const matchResponse = await apiRequest("GET", "/api/matches/active");
              if (matchResponse.ok) {
                const matchData = await matchResponse.json();
                if (matchData && matchData.matchId) {
                  setMatchId(matchData.matchId);
                }
              }
              
              setGameId(ongoingData.id);
              const chess = new Chess(ongoingData.fen);
              setGame(chess);
              setPlayerColor(ongoingData.playerColor || "white");
              setFen(ongoingData.fen);
              setMoves(chess.history());
              setGameStarted(true);
              setInQueue(false);
              
              setWhiteTime(ongoingData.whiteTime || 180);
              setBlackTime(ongoingData.blackTime || 180);
              setIncrement(ongoingData.increment || 0);
              
              if (isBlindfold) {
                setShowBoard(false);
              }

              toast({
                title: "Match found!",
                description: "Game started",
              });
              return;
            }
          }
        }
      } catch (error) {
        console.error("Error checking match:", error);
      }

      setTimeout(checkMatch, 1000);
    };

    checkMatch();
  }, [queueType, toast, isBlindfold]);

  const handleJoinQueue = (time: string) => {
    const queueMap: Record<string, string> = {
      '1': 'standard_bullet',
      '5': 'standard_blitz',
      '15': 'standard_rapid',
      '30': 'standard_classical',
    };

    const queue = queueMap[time];
    setQueueType(queue);
    joinQueueMutation.mutate({ queueType: queue, isBlindfold });
  };

  useEffect(() => {
    if (ongoingGame && !restoredGame && !gameStarted && ongoingGame.status === 'active') {
      const restoreGame = async () => {
        try {
          const matchResponse = await apiRequest("GET", "/api/matches/active");
          
          if (!matchResponse.ok) {
            toast({
              title: "Error",
              description: "Cannot restore match. Please start a new game.",
              variant: "destructive",
            });
            setRestoredGame(true);
            return;
          }
          
          const matchData = await matchResponse.json();
          if (!matchData || !matchData.matchId) {
            toast({
              title: "Error",
              description: "Cannot restore match. Please start a new game.",
              variant: "destructive",
            });
            setRestoredGame(true);
            return;
          }
          
          setMatchId(matchData.matchId);
          
          const chess = new Chess(ongoingGame.fen || undefined);
          setGame(chess);
          setGameId(ongoingGame.id);
          setPlayerColor((ongoingGame as any).playerColor || "white");
          setFen(ongoingGame.fen || "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
          setMoves(chess.history());
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
        moves: currentGame.history(),
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
      completedAt: new Date().toISOString(),
      pgn: game.pgn(),
      moves,
      whiteTime,
      blackTime,
    });

    toast({
      title: "Game Over",
      description: result === "draw" ? "Game drawn" : result === "white_win" ? "White wins!" : "Black wins!",
    });

    setGameStarted(false);
    setShowBoard(true);
  }, [game, gameId, updateGameMutation, moves, whiteTime, blackTime, toast]);

  useEffect(() => {
    if (gameStarted && game) {
      const timer = setInterval(() => {
        const currentTurn = game.turn();
        
        if (currentTurn === "w") {
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
  }, [gameStarted, game, handleGameEnd]);

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
    if (!game || !gameStarted) return;

    if (selectedSquare) {
      try {
        const move = game.move({
          from: selectedSquare,
          to: square,
          promotion: "q",
        });

        if (move) {
          const newFen = game.fen();
          setFen(newFen);
          setMoves(game.history());
          setSelectedSquare(null);
          setLegalMoves([]);
          
          if (gameId && matchId) {
            sendMove(gameId, move.san, newFen, whiteTime, blackTime, increment);
          }
          
          if (game.isCheckmate()) {
            handleGameEnd(game.turn() === "w" ? "black_win" : "white_win");
          } else if (game.isDraw() || game.isStalemate() || game.isThreefoldRepetition() || game.isInsufficientMaterial()) {
            handleGameEnd("draw");
          } else {
            saveGameState();
          }
        } else {
          const moves = game.moves({ square: square as any, verbose: true });
          if (moves.length > 0) {
            setSelectedSquare(square);
            setLegalMoves(moves.map((m: any) => m.to));
          }
        }
      } catch (e) {
        const moves = game.moves({ square: square as any, verbose: true });
        if (moves.length > 0) {
          setSelectedSquare(square);
          setLegalMoves(moves.map((m: any) => m.to));
        }
      }
    } else {
      const moves = game.moves({ square: square as any, verbose: true });
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
                        onClick={() => handleJoinQueue('1')}
                        disabled={joinQueueMutation.isPending}
                        data-testid="button-queue-bullet"
                      >
                        <Clock className="mr-2 h-4 w-4" />
                        Bullet (1m)
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={() => handleJoinQueue('5')}
                        disabled={joinQueueMutation.isPending}
                        data-testid="button-queue-blitz"
                      >
                        <Clock className="mr-2 h-4 w-4" />
                        Blitz (5m)
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={() => handleJoinQueue('15')}
                        disabled={joinQueueMutation.isPending}
                        data-testid="button-queue-rapid"
                      >
                        <Clock className="mr-2 h-4 w-4" />
                        Rapid (15m)
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={() => handleJoinQueue('30')}
                        disabled={joinQueueMutation.isPending}
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
                <ChessBoard 
                  fen={fen}
                  orientation={playerColor}
                  showCoordinates={true}
                  highlightedSquares={legalMoves}
                  onSquareClick={handleSquareClick}
                />
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
