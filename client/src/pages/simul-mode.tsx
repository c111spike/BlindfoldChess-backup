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
import { Play, Clock, Trophy, ChevronLeft, ChevronRight } from "lucide-react";
import type { Game } from "@shared/schema";

interface SimulBoard {
  id: string;
  gameId: string;
  opponent: string;
  fen: string;
  moves: string[];
  material: number;
  whiteTime: number;
  blackTime: number;
  timeRemaining: number;
  isActive: boolean;
  chess: Chess;
  result?: "win" | "loss" | "draw";
  playerColor: "white" | "black";
}

export default function SimulMode() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [gameStarted, setGameStarted] = useState(false);
  const [boardCount, setBoardCount] = useState("4");
  const [activeBoard, setActiveBoard] = useState(0);
  const [boards, setBoards] = useState<SimulBoard[]>([]);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [inQueue, setInQueue] = useState(false);
  const [queueType, setQueueType] = useState<string | null>(null);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [legalMoves, setLegalMoves] = useState<string[]>([]);
  
  const boardsRef = useRef<SimulBoard[]>([]);
  const activeBoardRef = useRef(0);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    boardsRef.current = boards;
    activeBoardRef.current = activeBoard;
  }, [boards, activeBoard]);

  const handleOpponentMove = useCallback((data: { gameId: string; move: string; fen: string; whiteTime: number; blackTime: number }) => {
    setBoards(prevBoards => {
      const boardIndex = prevBoards.findIndex(b => b.gameId === data.gameId);
      if (boardIndex === -1) return prevBoards;
      
      const newBoards = [...prevBoards];
      try {
        if (!data.fen || !data.move) {
          throw new Error("Invalid move payload");
        }
        
        const chess = new Chess(data.fen);
        const board = newBoards[boardIndex];
        newBoards[boardIndex] = {
          ...board,
          fen: data.fen,
          moves: chess.history(),
          chess,
          whiteTime: data.whiteTime,
          blackTime: data.blackTime,
        };
        
        toast({
          title: `Opponent moved on Board ${boardIndex + 1}`,
          description: data.move,
        });
      } catch (error) {
        console.error("Error handling opponent move:", error);
        toast({
          title: "Error",
          description: `Failed to process move on Board ${boardIndex + 1}. Please refresh.`,
          variant: "destructive",
        });
      }
      
      return newBoards;
    });
  }, [toast]);

  const { sendMove } = useWebSocket({
    userId: user?.id,
    matchId: matchId || undefined,
    onMove: handleOpponentMove,
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
        description: "Searching for opponent...",
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

  const updateGameMutation = useMutation({
    mutationFn: async ({ gameId, data }: { gameId: string; data: any }) => {
      await apiRequest("PATCH", `/api/games/${gameId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ratings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/games/recent"] });
      queryClient.invalidateQueries({ queryKey: ["/api/statistics"] });
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
        
        if (data.matched && data.games && Array.isArray(data.games)) {
          if (!data.matchId) {
            toast({
              title: "Match Error",
              description: "Failed to join match room. Please try again.",
              variant: "destructive",
            });
            setInQueue(false);
            return;
          }
          
          setMatchId(data.matchId);
          
          const newBoards: SimulBoard[] = data.games.map((game: any, i: number) => {
            const chess = new Chess(game.fen);
            return {
              id: `board-${i}`,
              gameId: game.id,
              opponent: game.opponentName || `Opponent ${i + 1}`,
              fen: game.fen,
              moves: [],
              material: 0,
              whiteTime: game.whiteTime || 30,
              blackTime: game.blackTime || 30,
              timeRemaining: 30,
              isActive: i === 0,
              chess,
              playerColor: game.playerColor || "white",
            };
          });
          
          setBoards(newBoards);
          setActiveBoard(0);
          setGameStarted(true);
          setInQueue(false);
          setBoardCount(data.boardCount?.toString() || newBoards.length.toString());
          
          toast({
            title: "Match found!",
            description: `Playing ${newBoards.length} boards simultaneously`,
          });
          
          startTimer();
          return;
        } else {
          // Check for ongoing simul games
          const matchResponse = await apiRequest("GET", "/api/matches/active");
          if (matchResponse.ok) {
            const matchData = await matchResponse.json();
            if (matchData && matchData.matchId && matchData.games && matchData.games.length > 0) {
              setMatchId(matchData.matchId);
              
              const restoredBoards: SimulBoard[] = matchData.games.map((game: any, i: number) => {
                const chess = new Chess(game.fen);
                return {
                  id: `board-${i}`,
                  gameId: game.id,
                  opponent: game.opponentName || `Opponent ${i + 1}`,
                  fen: game.fen,
                  moves: chess.history(),
                  material: 0,
                  whiteTime: game.whiteTime || 30,
                  blackTime: game.blackTime || 30,
                  timeRemaining: 30,
                  isActive: i === 0,
                  chess,
                  playerColor: game.playerColor || "white",
                  result: game.status === 'completed' ? (game.result as any) : undefined,
                };
              });
              
              setBoards(restoredBoards);
              setActiveBoard(0);
              setGameStarted(true);
              setInQueue(false);
              setBoardCount(restoredBoards.length.toString());
              
              toast({
                title: "Match resumed!",
                description: `Restored ${restoredBoards.length} boards`,
              });
              
              startTimer();
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
  }, [queueType, boardCount, toast]);

  const handleFindMatch = () => {
    const queue = `simul_${boardCount}`;
    setQueueType(queue);
    joinQueueMutation.mutate({ queueType: queue });
  };

  const startTimer = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }

    timerIntervalRef.current = setInterval(() => {
      const currentBoards = boardsRef.current;
      const currentActiveIndex = activeBoardRef.current;
      
      if (currentBoards.length === 0) return;

      if (!currentBoards[currentActiveIndex]?.result) {
        const activeBoard = currentBoards[currentActiveIndex];
        const newTime = Math.max(0, activeBoard.timeRemaining - 1);
        
        if (newTime === 0 && activeBoard.timeRemaining > 0) {
          setTimeout(() => {
            advanceToNextBoard();
          }, 0);
        } else {
          const updatedBoards = currentBoards.map((board, index) => 
            index === currentActiveIndex 
              ? { ...board, timeRemaining: newTime }
              : board
          );
          setBoards(updatedBoards);
        }
      }
    }, 1000);
  };

  const advanceToNextBoard = useCallback(() => {
    const currentBoards = boardsRef.current;
    const currentActiveIndex = activeBoardRef.current;
    
    let nextIndex = (currentActiveIndex + 1) % currentBoards.length;
    let attempts = 0;
    
    while (currentBoards[nextIndex]?.result && attempts < currentBoards.length) {
      nextIndex = (nextIndex + 1) % currentBoards.length;
      attempts++;
    }
    
    if (attempts < currentBoards.length) {
      const updatedBoards = currentBoards.map((board, index) => ({
        ...board,
        isActive: index === nextIndex,
        timeRemaining: index === nextIndex ? 30 : board.timeRemaining,
      }));
      
      setBoards(updatedBoards);
      setActiveBoard(nextIndex);
    }
  }, []);

  const handleSquareClick = (square: string) => {
    const currentBoard = boards[activeBoard];
    if (!currentBoard || currentBoard.result) return;

    const chess = currentBoard.chess;

    if (selectedSquare) {
      try {
        const move = chess.move({
          from: selectedSquare,
          to: square,
          promotion: "q",
        });

        if (move) {
          const newFen = chess.fen();
          const updatedBoards = [...boards];
          updatedBoards[activeBoard] = {
            ...currentBoard,
            fen: newFen,
            moves: chess.history(),
            chess,
          };

          if (matchId && currentBoard.gameId) {
            sendMove(currentBoard.gameId, move.san, newFen, currentBoard.whiteTime, currentBoard.blackTime, 0);
          }

          if (chess.isCheckmate()) {
            updatedBoards[activeBoard].result = chess.turn() === "w" ? "loss" : "win";
          } else if (chess.isDraw() || chess.isStalemate()) {
            updatedBoards[activeBoard].result = "draw";
          }

          setBoards(updatedBoards);
          setSelectedSquare(null);
          setLegalMoves([]);
          
          advanceToNextBoard();
        } else {
          const moves = chess.moves({ square: square as any, verbose: true });
          if (moves.length > 0) {
            setSelectedSquare(square);
            setLegalMoves(moves.map((m: any) => m.to));
          }
        }
      } catch (e) {
        const moves = chess.moves({ square: square as any, verbose: true });
        if (moves.length > 0) {
          setSelectedSquare(square);
          setLegalMoves(moves.map((m: any) => m.to));
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

  const handleBoardSwitch = (index: number) => {
    if (index === activeBoard) return;
    
    const updatedBoards = boards.map((board, i) => ({
      ...board,
      isActive: i === index,
      timeRemaining: i === index ? 30 : board.timeRemaining,
    }));
    
    setBoards(updatedBoards);
    setActiveBoard(index);
    setSelectedSquare(null);
    setLegalMoves([]);
  };

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, []);

  const formatTime = (seconds: number) => {
    return `0:${seconds.toString().padStart(2, "0")}`;
  };

  const getMaterialDisplay = (material: number) => {
    if (material === 0) return "=";
    return material > 0 ? `+${material}` : `${material}`;
  };

  const getScoreSummary = () => {
    const wins = boards.filter(b => b.result === "win").length;
    const losses = boards.filter(b => b.result === "loss").length;
    const draws = boards.filter(b => b.result === "draw").length;
    return { wins, losses, draws };
  };

  return (
    <div className="h-screen flex">
      {gameStarted && (
        <div className="w-80 border-r bg-card flex flex-col">
          <div className="p-4 border-b space-y-3">
            <h3 className="font-semibold" data-testid="text-board-count">
              Simul Boards ({boards.length})
            </h3>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Trophy className="h-4 w-4" />
              <span data-testid="text-score-summary">
                {getScoreSummary().wins}W · {getScoreSummary().losses}L · {getScoreSummary().draws}D
              </span>
            </div>
          </div>
          
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-2">
              {boards.map((board, index) => (
                <Card
                  key={board.id}
                  className={`cursor-pointer hover-elevate ${
                    activeBoard === index ? "border-primary ring-2 ring-primary/20" : ""
                  }`}
                  onClick={() => handleBoardSwitch(index)}
                  data-testid={`card-board-${index}`}
                >
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium" data-testid={`text-opponent-${index}`}>
                        {board.opponent}
                      </span>
                      {board.result && (
                        <Badge 
                          variant={
                            board.result === "win" ? "default" : 
                            board.result === "draw" ? "secondary" : 
                            "destructive"
                          }
                          className="text-xs"
                          data-testid={`badge-result-${index}`}
                        >
                          {board.result.toUpperCase()}
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <span 
                        className={`font-mono font-semibold ${
                          board.material > 0 ? "text-green-600 dark:text-green-400" :
                          board.material < 0 ? "text-red-600 dark:text-red-400" :
                          "text-muted-foreground"
                        }`}
                        data-testid={`text-material-${index}`}
                      >
                        {getMaterialDisplay(board.material)}
                      </span>
                      <span 
                        className="font-mono text-muted-foreground"
                        data-testid={`text-time-${index}`}
                      >
                        {formatTime(board.timeRemaining)}
                      </span>
                    </div>

                    {board.isActive && !board.result && (
                      <div className="pt-2 border-t">
                        <div className="flex items-center gap-2 text-xs text-primary">
                          <Clock className="h-3 w-3 animate-pulse" />
                          <span>Clock running</span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>

          <div className="p-4 border-t">
            <div className="text-xs text-muted-foreground">
              FIFO Order: 30s per board
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Make move → auto-advance to next
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 flex items-center justify-center p-8 bg-muted/30">
        {!gameStarted ? (
          <>
            {!inQueue ? (
              <Card className="w-full max-w-md">
                <CardContent className="pt-6 space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold mb-2">Simul vs Simul</h2>
                    <p className="text-muted-foreground">
                      Play multiple opponents simultaneously with FIFO rotation
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Number of Boards</label>
                    <Select value={boardCount} onValueChange={setBoardCount}>
                      <SelectTrigger data-testid="select-board-count">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                          <SelectItem key={num} value={num.toString()}>
                            {num} boards
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="p-4 bg-muted rounded-lg space-y-2">
                    <h4 className="font-semibold text-sm">How It Works</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• 30 seconds per board</li>
                      <li>• Make move → auto-switch to next board</li>
                      <li>• FIFO rotation: 0 → 1 → 2 → ... → 0</li>
                      <li>• Timer resets to 30s when board becomes active</li>
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
                  <h2 className="text-xl font-semibold">Searching for Opponent</h2>
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                  </div>
                  <p className="text-muted-foreground">
                    Queue: {queueType}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Open another window to test matchmaking
                  </p>
                  <Button 
                    variant="outline" 
                    onClick={() => leaveQueueMutation.mutate({ queueType })}
                    className="w-full"
                    data-testid="button-cancel-queue"
                  >
                    Cancel
                  </Button>
                </CardContent>
              </Card>
            )}
          </>
        ) : (
          <div className="w-full max-w-3xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold" data-testid="text-current-opponent">
                  {boards[activeBoard]?.opponent || "Board"}
                </h2>
                <p className="text-sm text-muted-foreground" data-testid="text-board-position">
                  Board {activeBoard + 1} of {boards.length}
                </p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-mono font-bold" data-testid="text-active-timer">
                  {formatTime(boards[activeBoard]?.timeRemaining || 0)}
                </div>
                <div 
                  className={`text-sm font-mono font-semibold ${
                    (boards[activeBoard]?.material || 0) > 0 ? "text-green-600 dark:text-green-400" :
                    (boards[activeBoard]?.material || 0) < 0 ? "text-red-600 dark:text-red-400" :
                    "text-muted-foreground"
                  }`}
                  data-testid="text-active-material"
                >
                  Material: {getMaterialDisplay(boards[activeBoard]?.material || 0)}
                </div>
              </div>
            </div>

            <ChessBoard
              fen={boards[activeBoard]?.fen}
              orientation={boards[activeBoard]?.playerColor || "white"}
              showCoordinates={true}
              highlightedSquares={legalMoves}
              onSquareClick={handleSquareClick}
            />

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                disabled={activeBoard === 0}
                onClick={() => handleBoardSwitch((activeBoard - 1 + boards.length) % boards.length)}
                data-testid="button-prev-board"
              >
                <ChevronLeft className="mr-2 h-4 w-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                disabled={activeBoard === boards.length - 1}
                onClick={() => handleBoardSwitch((activeBoard + 1) % boards.length)}
                data-testid="button-next-board"
              >
                Next
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>

            {boards[activeBoard]?.result && (
              <Card>
                <CardContent className="py-6 text-center">
                  <p className="text-xl font-semibold mb-2">
                    Board Result: {boards[activeBoard].result?.toUpperCase()}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Continue playing on other boards
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
