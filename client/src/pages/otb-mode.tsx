import { useState, useEffect, useRef, useCallback } from "react";
import { Chess } from "chess.js";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
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
  const [gameStarted, setGameStarted] = useState(false);
  const [whiteTime, setWhiteTime] = useState(180);
  const [blackTime, setBlackTime] = useState(180);
  const [activeColor, setActiveColor] = useState<"white" | "black">("white");
  const [timeControl, setTimeControl] = useState("3+0");
  const [increment, setIncrement] = useState(0);
  const [moves, setMoves] = useState<string[]>([]);
  const [fen, setFen] = useState("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [legalMoves, setLegalMoves] = useState<string[]>([]);
  const [clockPresses, setClockPresses] = useState(0);
  const [restoredGame, setRestoredGame] = useState(false);
  
  const gameRef = useRef<Chess | null>(null);
  const gameIdRef = useRef<string | null>(null);
  const whiteTimeRef = useRef(180);
  const blackTimeRef = useRef(180);

  useEffect(() => {
    gameRef.current = game;
    gameIdRef.current = gameId;
    whiteTimeRef.current = whiteTime;
    blackTimeRef.current = blackTime;
  }, [game, gameId, whiteTime, blackTime]);

  const { data: ongoingGame } = useQuery<Game>({
    queryKey: ["/api/games/ongoing"],
    enabled: !restoredGame && !gameStarted,
  });

  useEffect(() => {
    if (ongoingGame && !restoredGame && !gameStarted) {
      try {
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

  useEffect(() => {
    if (gameStarted && game) {
      const timer = setInterval(() => {
        if (activeColor === "white") {
          setWhiteTime((t) => Math.max(0, t - 1));
        } else {
          setBlackTime((t) => Math.max(0, t - 1));
        }
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [gameStarted, activeColor, game]);

  useEffect(() => {
    let saveInterval: NodeJS.Timeout | null = null;
    
    if (gameStarted && gameId) {
      saveInterval = setInterval(() => {
        saveGameState();
      }, 10000);
    }

    return () => {
      if (saveInterval) {
        clearInterval(saveInterval);
      }
    };
  }, [gameStarted, gameId, saveGameState]);

  useEffect(() => {
    if (whiteTime === 0 || blackTime === 0) {
      handleGameEnd(whiteTime === 0 ? "black_win" : "white_win");
    }
  }, [whiteTime, blackTime]);

  const createGameMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/games", data);
      return response;
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

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

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
          setFen(game.fen());
          setMoves(game.history());
          setSelectedSquare(null);
          setLegalMoves([]);
          
          saveGameState();
        } else {
          setSelectedSquare(square);
          const moves = game.moves({ square, verbose: true });
          setLegalMoves(moves.map((m) => m.to));
        }
      } catch (e) {
        setSelectedSquare(square);
        const moves = game.moves({ square, verbose: true });
        setLegalMoves(moves.map((m) => m.to));
      }
    } else {
      setSelectedSquare(square);
      const moves = game.moves({ square, verbose: true });
      setLegalMoves(moves.map((m) => m.to));
    }
  };

  const handleClockPress = () => {
    if (!game) return;

    if (activeColor === "white") {
      setWhiteTime((t) => t + increment);
    } else {
      setBlackTime((t) => t + increment);
    }

    const newActiveColor = activeColor === "white" ? "black" : "white";
    setActiveColor(newActiveColor);
    setClockPresses(clockPresses + 1);
  };

  const handleGameEnd = (result: "white_win" | "black_win" | "draw") => {
    if (!game || !gameId) return;

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
  };

  const handleResign = () => {
    handleGameEnd(activeColor === "white" ? "black_win" : "white_win");
  };

  const handleOfferDraw = () => {
    handleGameEnd("draw");
  };

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
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h2 className="text-xl font-semibold">Start New Game</h2>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Time Control</label>
                  <Select value={timeControl} onValueChange={setTimeControl}>
                    <SelectTrigger data-testid="select-time-control">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1+0">Bullet: 1+0</SelectItem>
                      <SelectItem value="3+0">Blitz: 3+0</SelectItem>
                      <SelectItem value="3+2">Blitz: 3+2</SelectItem>
                      <SelectItem value="5+0">Blitz: 5+0</SelectItem>
                      <SelectItem value="10+0">Rapid: 10+0</SelectItem>
                      <SelectItem value="15+10">Rapid: 15+10</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleStartGame} className="w-full" data-testid="button-start-game">
                  <Play className="mr-2 h-4 w-4" />
                  Start Game
                </Button>
              </CardContent>
            </Card>
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
