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
import { Clock, Play, HandshakeIcon, Flag, AlertTriangle } from "lucide-react";
import type { Game } from "@shared/schema";

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
  const [timeControl, setTimeControl] = useState("5");
  const [increment, setIncrement] = useState(0);
  const [moves, setMoves] = useState<string[]>([]);
  const [fen, setFen] = useState("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [legalMoves, setLegalMoves] = useState<string[]>([]);
  const [clockPresses, setClockPresses] = useState(0);
  const [restoredGame, setRestoredGame] = useState(false);
  const [inQueue, setInQueue] = useState(false);
  const [queueType, setQueueType] = useState<string | null>(null);
  
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

  const { sendMove } = useWebSocket({
    userId: user?.id,
    matchId: matchId || undefined,
    onMove: handleOpponentMove,
  });

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
          const chess = new Chess(response.game.fen);
          setGame(chess);
          setFen(response.game.fen);
          setMoves([]);
          setGameStarted(true);
          setInQueue(false);
          setActiveColor(response.game.playerColor === "white" ? "white" : "black");
          
          setWhiteTime(response.game.whiteTime || 180);
          setBlackTime(response.game.blackTime || 180);
          setIncrement(response.game.increment || 0);

          toast({
            title: "Match found!",
            description: "Game started",
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
      try {
        apiRequest("GET", "/api/matches/active").then(async (response) => {
          if (response.ok) {
            const matchData = await response.json();
            if (matchData && matchData.matchId) {
              setMatchId(matchData.matchId);
            }
          }
        });
        
        const chess = new Chess(ongoingGame.fen || undefined);
        setGame(chess);
        setGameId(ongoingGame.id);
        setFen(ongoingGame.fen || "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
        setMoves(chess.history());
        setWhiteTime(ongoingGame.whiteTime || 180);
        setBlackTime(ongoingGame.blackTime || 180);
        setGameStarted(true);
        setActiveColor(chess.turn() === "w" ? "white" : "black");
        setIncrement(ongoingGame.increment || 0);
        const tc = ongoingGame.timeControl || 3;
        const inc = ongoingGame.increment || 0;
        setTimeControl(`${tc}+${inc}`);
        setRestoredGame(true);
        
        toast({
          title: "Game restored",
          description: "Your ongoing game has been loaded",
        });
      } catch (error) {
        console.error("Error restoring game:", error);
      }
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
      manualClockPresses: clockPresses,
    });

    toast({
      title: "Game Over",
      description: result === "draw" ? "Game drawn" : result === "white_win" ? "White wins!" : "Black wins!",
    });

    setGameStarted(false);
  }, [game, gameId, updateGameMutation, moves, whiteTime, blackTime, clockPresses, toast]);

  useEffect(() => {
    if (gameStarted && game) {
      const timer = setInterval(() => {
        if (activeColor === "white") {
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
  }, [gameStarted, activeColor, game, handleGameEnd]);

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

  useEffect(() => {
    if (whiteTime === 0 || blackTime === 0) {
      handleGameEnd(whiteTime === 0 ? "black_win" : "white_win");
    }
  }, [whiteTime, blackTime, handleGameEnd]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleClockPress = useCallback(() => {
    if (!game) return;

    if (activeColor === "white") {
      setWhiteTime((t) => t + increment);
    } else {
      setBlackTime((t) => t + increment);
    }

    const newActiveColor = activeColor === "white" ? "black" : "white";
    setActiveColor(newActiveColor);
    setClockPresses(clockPresses + 1);
  }, [game, activeColor, increment, clockPresses]);

  const handleStartGame = () => {
    const [minutes, inc] = timeControl.split("+").map(Number);
    const seconds = minutes * 60;
    
    setWhiteTime(seconds);
    setBlackTime(seconds);
    setIncrement(inc);
    setGameStarted(true);
    
    const newGame = new Chess();
    setGame(newGame);
    setFen(newGame.fen());
    setMoves([]);
    setActiveColor("white");
    setClockPresses(0);
    
    const mode = minutes <= 3 ? "otb_bullet" : minutes <= 10 ? "otb_blitz" : "otb_rapid";
    
    createGameMutation.mutate({
      mode,
      playerColor: "white",
      timeControl: minutes,
      increment: inc,
      fen: newGame.fen(),
      moves: [],
      whiteTime: seconds,
      blackTime: seconds,
      opponentName: "Computer",
    });
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
    handleGameEnd(activeColor === "white" ? "black_win" : "white_win");
  };

  const handleOfferDraw = () => {
    handleGameEnd("draw");
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

  return (
    <div className="h-screen flex">
      <div className="flex-1 flex items-center justify-center p-8 bg-muted/30">
        <div className="w-full max-w-3xl space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">OTB Tournament Mode</h1>
              <p className="text-muted-foreground">Manual clock · FIDE-accurate arbiter</p>
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

                    <div className="pt-4 border-t">
                      <h3 className="text-lg font-semibold mb-4">or Start Practice Game</h3>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Time Control</label>
                        <Select value={timeControl} onValueChange={setTimeControl}>
                          <SelectTrigger data-testid="select-time-control">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">Bullet: 1m</SelectItem>
                            <SelectItem value="3">Blitz: 3m</SelectItem>
                            <SelectItem value="5">Blitz: 5m</SelectItem>
                            <SelectItem value="10">Rapid: 10m</SelectItem>
                            <SelectItem value="15">Rapid: 15m</SelectItem>
                            <SelectItem value="30">Classical: 30m</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button onClick={handleStartGame} className="w-full mt-4" data-testid="button-start-game">
                        <Play className="mr-2 h-4 w-4" />
                        Practice vs Computer
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
              <ChessBoard 
                fen={fen}
                orientation="white"
                showCoordinates={true}
                highlightedSquares={legalMoves}
                onSquareClick={handleSquareClick}
              />

              <Card>
                <CardContent className="py-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-muted-foreground">White</span>
                        {activeColor === "white" && (
                          <Badge variant="default" className="text-xs">Active</Badge>
                        )}
                      </div>
                      <div className={`text-5xl font-mono font-bold ${
                        activeColor === "white" ? "text-foreground" : "text-muted-foreground"
                      }`} data-testid="text-white-time">
                        {formatTime(whiteTime)}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-muted-foreground">Black</span>
                        {activeColor === "black" && (
                          <Badge variant="default" className="text-xs">Active</Badge>
                        )}
                      </div>
                      <div className={`text-5xl font-mono font-bold ${
                        activeColor === "black" ? "text-foreground" : "text-muted-foreground"
                      }`} data-testid="text-black-time">
                        {formatTime(blackTime)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-6 border-t">
                    <Button
                      onClick={handleClockPress}
                      size="lg"
                      className="w-full min-h-20 text-xl font-semibold"
                      data-testid="button-press-clock"
                    >
                      <Clock className="mr-3 h-6 w-6" />
                      Press Clock
                      <span className="ml-2 text-sm font-normal opacity-70">(Spacebar)</span>
                    </Button>
                  </div>

                  <div className="mt-4 flex gap-3">
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
