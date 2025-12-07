import { useState, useEffect, useCallback, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Chess } from "chess.js";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ChessBoard } from "@/components/chess-board";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Play, Clock, Users, ArrowLeft, ArrowRight, Crown, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

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
}

interface MatchPlayer {
  odId: string;
  isBot: boolean;
  botPersonality?: string;
  seat: number;
}

export default function SimulVsSimulMode() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  
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
  
  const boardsRef = useRef<SimulVsSimulBoard[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const queuePollRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    boardsRef.current = boards;
  }, [boards]);
  
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
      setBoards(prevBoards => {
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
  }, [gameStarted, matchComplete, activeBoard]);
  
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
        }));
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
        setBoards(prevBoards => {
          const boardIndex = prevBoards.findIndex(b => b.pairingId === data.pairingId);
          if (boardIndex === -1) return prevBoards;
          
          const newBoards = [...prevBoards];
          const chess = new Chess(data.fen);
          newBoards[boardIndex] = {
            ...newBoards[boardIndex],
            fen: data.fen,
            moves: chess.history(),
            moveCount: data.moveCount,
            activeColor: data.activeColor,
            chess,
          };
          
          return newBoards;
        });
        
        toast({
          title: `Opponent moved on Board ${boards.find(b => b.pairingId === data.pairingId)?.boardNumber || '?'}`,
          description: data.move,
        });
        break;
        
      case 'simul_focus_update':
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
        }
        break;
        
      case 'simul_timer_state':
        setBoards(prevBoards => {
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
        
      case 'simul_game_end':
        setBoards(prevBoards => {
          const boardIndex = prevBoards.findIndex(b => b.pairingId === data.pairingId);
          if (boardIndex === -1) return prevBoards;
          
          const newBoards = [...prevBoards];
          newBoards[boardIndex] = {
            ...newBoards[boardIndex],
            result: data.result,
            gameId: data.gameId,
          };
          
          return newBoards;
        });
        
        toast({
          title: "Game ended",
          description: `Board ${boards.find(b => b.pairingId === data.pairingId)?.boardNumber}: ${data.result} (${data.reason})`,
          variant: data.result.includes('wins') ? 'default' : 'destructive',
        });
        break;
        
      case 'simul_match_complete':
        setMatchComplete(true);
        toast({
          title: "Match complete!",
          description: "All games have finished. View your results.",
        });
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
      try {
        const move = chess.move({
          from: selectedSquare,
          to: square,
          promotion: "q",
        });
        
        if (move) {
          const newFen = chess.fen();
          const newActiveColor = chess.turn() === 'w' ? 'white' : 'black';
          
          const updatedBoards = [...boards];
          updatedBoards[activeBoard] = {
            ...currentBoard,
            fen: newFen,
            moves: chess.history(),
            moveCount: chess.history().length,
            activeColor: newActiveColor as 'white' | 'black',
            chess,
          };
          
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
            }));
          }
          
          if (chess.isCheckmate()) {
            const result = chess.turn() === 'w' ? 'black_win' : 'white_win';
            updatedBoards[activeBoard].result = result;
            
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({
                type: 'simul_game_result',
                pairingId: currentBoard.pairingId,
                result,
                reason: 'checkmate',
              }));
            }
          } else if (chess.isDraw() || chess.isStalemate()) {
            updatedBoards[activeBoard].result = 'draw';
            
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({
                type: 'simul_game_result',
                pairingId: currentBoard.pairingId,
                result: 'draw',
                reason: chess.isStalemate() ? 'stalemate' : 'draw',
              }));
            }
          }
          
          setBoards(updatedBoards);
          setSelectedSquare(null);
          setLegalMoves([]);
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
      {gameStarted && (
        <div className="w-80 border-r bg-card flex flex-col">
          <div className="p-4 border-b space-y-3">
            <div className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-primary" />
              <h3 className="font-semibold" data-testid="text-match-title">
                Simul vs Simul
              </h3>
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
                      "cursor-pointer hover-elevate transition-all",
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
                      
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          {board.moveCount} moves
                        </span>
                        
                        {resultDisplay ? (
                          <Badge 
                            variant={resultDisplay.variant}
                            className="text-xs"
                            data-testid={`badge-result-${index}`}
                          >
                            {resultDisplay.text}
                          </Badge>
                        ) : (
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
                      
                      {board.result !== 'ongoing' && board.gameId && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full mt-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            setLocation(`/analysis/${board.gameId}`);
                          }}
                          data-testid={`button-analyze-${index}`}
                        >
                          <BarChart3 className="h-3 w-3 mr-1" />
                          Analyze
                        </Button>
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
      
      <div className="flex-1 flex items-center justify-center p-8 bg-muted/30">
        {!gameStarted ? (
          <>
            {!inQueue ? (
              <Card className="w-full max-w-md">
                <CardContent className="pt-6 space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold mb-2">Simul vs Simul</h2>
                    <p className="text-muted-foreground">
                      Round-robin where everyone plays everyone simultaneously
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Number of Boards (per player)</label>
                    <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                      <span className="font-medium" data-testid="text-board-count">5 boards</span>
                      <span className="text-muted-foreground">(6 players)</span>
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
          </>
        ) : activeGame ? (
          <div className="flex flex-col items-center gap-4">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleBoardSwitch(activeBoard - 1)}
                disabled={activeBoard === 0}
                data-testid="button-prev-board"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              
              <div className="text-center min-w-48">
                <h3 className="font-semibold text-lg" data-testid="text-active-board">
                  Board #{activeGame.boardNumber}
                </h3>
                <p className="text-sm text-muted-foreground" data-testid="text-active-opponent">
                  vs {activeGame.opponentName}
                </p>
                <div className="flex items-center justify-center gap-2 mt-1">
                  <Badge variant={activeGame.color === 'white' ? 'outline' : 'secondary'}>
                    Playing as {activeGame.color}
                  </Badge>
                  {activeGame.result === 'ongoing' && (
                    <Badge variant={isMyTurn ? 'default' : 'secondary'}>
                      {isMyTurn ? 'Your turn' : "Opponent's turn"}
                    </Badge>
                  )}
                </div>
              </div>
              
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleBoardSwitch(activeBoard + 1)}
                disabled={activeBoard === boards.length - 1}
                data-testid="button-next-board"
              >
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
            
            {activeGame.result === 'ongoing' && isMyTurn && (
              <div className="flex items-center gap-2 text-lg font-mono" data-testid="text-timer">
                <Clock className="h-5 w-5" />
                <span className={activeGame.timeRemaining <= 10 ? 'text-red-500' : ''}>
                  {activeGame.timeRemaining}s
                </span>
              </div>
            )}
            
            <div className="max-w-[500px] w-full aspect-square">
              <ChessBoard
                fen={activeGame.fen}
                orientation={activeGame.color}
                onSquareClick={activeGame.result === 'ongoing' && isMyTurn ? handleSquareClick : undefined}
                selectedSquare={selectedSquare}
                legalMoveSquares={legalMoves}
              />
            </div>
            
            {activeGame.result !== 'ongoing' && (
              <div className="text-center">
                <Badge 
                  variant={getResultDisplay(activeGame.result, activeGame.color)?.variant || 'secondary'}
                  className="text-lg px-4 py-1"
                >
                  {getResultDisplay(activeGame.result, activeGame.color)?.text || activeGame.result}
                </Badge>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center text-muted-foreground">
            Loading boards...
          </div>
        )}
      </div>
    </div>
  );
}
