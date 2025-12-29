import { useState, useEffect, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useNotifications } from "@/hooks/useNotifications";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Clock, RotateCcw, Undo2, Trophy, Target, ArrowLeft, Play, Settings, Home, TrendingUp } from "lucide-react";
import { useLocation } from "wouter";

type BoardSize = 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

interface Position {
  row: number;
  col: number;
}

interface SquareState {
  visited: boolean;
  moveNumber: number | null;
}

const BOARD_SIZES: BoardSize[] = [5, 6, 7, 8, 9, 10, 11, 12];

const KNIGHT_MOVES = [
  [-2, -1], [-2, 1], [-1, -2], [-1, 2],
  [1, -2], [1, 2], [2, -1], [2, 1]
];

function getValidMoves(pos: Position, boardSize: number, visited: boolean[][]): Position[] {
  const validMoves: Position[] = [];
  
  for (const [dr, dc] of KNIGHT_MOVES) {
    const newRow = pos.row + dr;
    const newCol = pos.col + dc;
    
    if (
      newRow >= 0 && newRow < boardSize &&
      newCol >= 0 && newCol < boardSize &&
      !visited[newRow][newCol]
    ) {
      validMoves.push({ row: newRow, col: newCol });
    }
  }
  
  return validMoves;
}

function createEmptyVisited(size: number): boolean[][] {
  return Array(size).fill(null).map(() => Array(size).fill(false));
}

interface KnightsTourProgress {
  id: string;
  userId: string;
  boardSize: number;
  completedCount: number | null;
  bestTime: number | null;
  highestMoveCount: number | null;
  lastPlayedAt: string | null;
  createdAt: string | null;
}

export default function KnightsTour() {
  const { toast } = useNotifications();
  const [, setLocation] = useLocation();
  
  // Game configuration
  const [boardSize, setBoardSize] = useState<BoardSize>(8);
  
  // Game state
  const [gameStarted, setGameStarted] = useState(false);
  const [knightPosition, setKnightPosition] = useState<Position | null>(null);
  const [visited, setVisited] = useState<boolean[][]>(() => createEmptyVisited(8));
  const [moveHistory, setMoveHistory] = useState<Position[]>([]);
  const [moveCount, setMoveCount] = useState(0);
  
  // Timer
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [isStuck, setIsStuck] = useState(false);
  
  // Fetch user progress
  const { data: progressData } = useQuery<{
    progress: KnightsTourProgress | null;
    overallProgress: { totalCompleted: number; boardsCompleted: number };
  }>({
    queryKey: [`/api/knights-tour/progress/${boardSize}`],
  });
  
  const progress = progressData?.progress;
  const overallProgress = progressData?.overallProgress || { totalCompleted: 0, boardsCompleted: 0 };
  
  // Save completion mutation
  const saveCompletionMutation = useMutation({
    mutationFn: async (data: { boardSize: number; completionTime: number }) => {
      const response = await apiRequest("POST", "/api/knights-tour/complete", data);
      return await response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [`/api/knights-tour/progress/${variables.boardSize}`] });
    },
  });

  // Save incomplete attempt mutation
  const saveIncompleteMutation = useMutation({
    mutationFn: async (data: { boardSize: number; moveCount: number }) => {
      const response = await apiRequest("POST", "/api/knights-tour/incomplete", data);
      return await response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [`/api/knights-tour/progress/${variables.boardSize}`] });
    },
  });
  
  // Derived values
  const totalSquares = boardSize * boardSize;
  const validMoves = knightPosition && !isComplete && !isStuck
    ? getValidMoves(knightPosition, boardSize, visited)
    : [];
  
  // Timer effect
  useEffect(() => {
    if (!gameStarted || isComplete || isStuck || !startTime) return;
    
    const interval = setInterval(() => {
      setElapsedTime(Date.now() - startTime);
    }, 100);
    
    return () => clearInterval(interval);
  }, [gameStarted, isComplete, isStuck, startTime]);
  
  // Check for completion or stuck
  useEffect(() => {
    if (!gameStarted || !knightPosition) return;
    
    if (moveCount === totalSquares && !isComplete) {
      setIsComplete(true);
      const finalTime = elapsedTime;
      toast({
        title: "Congratulations!",
        description: `You completed the Knight's Tour in ${formatTime(finalTime)}!`,
      });
      
      // Save completion to database
      saveCompletionMutation.mutate({
        boardSize,
        completionTime: finalTime,
      });
    } else if (validMoves.length === 0 && moveCount > 0 && moveCount < totalSquares && !isStuck) {
      // Only show stuck message if we haven't completed all squares
      setIsStuck(true);
      toast({
        title: "No Valid Moves!",
        description: `You got stuck after ${moveCount} moves. Try again!`,
        variant: "destructive",
      });
      
      // Save incomplete attempt to track highest move count
      saveIncompleteMutation.mutate({
        boardSize,
        moveCount,
      });
    }
  }, [moveCount, totalSquares, validMoves.length, gameStarted, knightPosition, isComplete, isStuck]);
  
  // Start game
  const handleStartGame = () => {
    setVisited(createEmptyVisited(boardSize));
    setKnightPosition(null);
    setMoveHistory([]);
    setMoveCount(0);
    setStartTime(null);
    setElapsedTime(0);
    setIsComplete(false);
    setIsStuck(false);
    setGameStarted(true);
  };
  
  // Reset current game
  const handleReset = () => {
    setVisited(createEmptyVisited(boardSize));
    setKnightPosition(null);
    setMoveHistory([]);
    setMoveCount(0);
    setStartTime(Date.now());
    setElapsedTime(0);
    setIsComplete(false);
    setIsStuck(false);
  };
  
  // Play again with same settings
  const handlePlayAgain = () => {
    setVisited(createEmptyVisited(boardSize));
    setKnightPosition(null);
    setMoveHistory([]);
    setMoveCount(0);
    setStartTime(null);
    setElapsedTime(0);
    setIsComplete(false);
    setIsStuck(false);
  };
  
  // Go back to configuration to change difficulty
  const handleChangeDifficulty = () => {
    setGameStarted(false);
    setVisited(createEmptyVisited(boardSize));
    setKnightPosition(null);
    setMoveHistory([]);
    setMoveCount(0);
    setStartTime(null);
    setElapsedTime(0);
    setIsComplete(false);
    setIsStuck(false);
  };
  
  // Go to main dashboard
  const handleMainMenu = () => {
    setLocation("/");
  };
  
  // Handle square click
  const handleSquareClick = (row: number, col: number) => {
    if (isComplete) return;
    
    const clickedPos = { row, col };
    
    // First move - place the knight anywhere
    if (!knightPosition) {
      const newVisited = createEmptyVisited(boardSize);
      newVisited[row][col] = true;
      setVisited(newVisited);
      setKnightPosition(clickedPos);
      setMoveHistory([clickedPos]);
      setMoveCount(1);
      setStartTime(Date.now());
      setIsStuck(false);
      return;
    }
    
    // Subsequent moves - must be a valid knight move
    const isValidMove = validMoves.some(m => m.row === row && m.col === col);
    if (!isValidMove) return;
    
    const newVisited = visited.map(r => [...r]);
    newVisited[row][col] = true;
    setVisited(newVisited);
    setKnightPosition(clickedPos);
    setMoveHistory(prev => [...prev, clickedPos]);
    setMoveCount(prev => prev + 1);
  };
  
  // Undo last move
  const handleUndo = () => {
    if (moveHistory.length <= 1) return;
    
    const newHistory = moveHistory.slice(0, -1);
    const newPos = newHistory[newHistory.length - 1];
    
    const newVisited = createEmptyVisited(boardSize);
    newHistory.forEach(pos => {
      newVisited[pos.row][pos.col] = true;
    });
    
    setMoveHistory(newHistory);
    setKnightPosition(newPos);
    setVisited(newVisited);
    setMoveCount(newHistory.length);
    setIsStuck(false);
    setIsComplete(false);
  };
  
  // Back to menu
  const handleBackToMenu = () => {
    setGameStarted(false);
    setKnightPosition(null);
    setMoveHistory([]);
    setMoveCount(0);
    setIsComplete(false);
    setIsStuck(false);
  };
  
  // Format time
  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    const tenths = Math.floor((ms % 1000) / 100);
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}.${tenths}`;
  };
  
  // Get move number for a square
  const getMoveNumber = (row: number, col: number): number | null => {
    const index = moveHistory.findIndex(pos => pos.row === row && pos.col === col);
    return index >= 0 ? index + 1 : null;
  };
  
  // Render the board
  const renderBoard = () => {
    const squares = [];
    
    for (let row = 0; row < boardSize; row++) {
      for (let col = 0; col < boardSize; col++) {
        const isLight = (row + col) % 2 === 0;
        const isKnightHere = knightPosition?.row === row && knightPosition?.col === col;
        const isVisited = visited[row][col];
        const isValidNextMove = validMoves.some(m => m.row === row && m.col === col);
        const moveNumber = getMoveNumber(row, col);
        
        let bgColor = isLight ? "bg-amber-100 dark:bg-amber-900/40" : "bg-amber-700 dark:bg-amber-800";
        
        if (isKnightHere) {
          bgColor = "bg-blue-500 dark:bg-blue-600";
        } else if (isValidNextMove) {
          bgColor = "bg-green-400/70 dark:bg-green-600/70";
        } else if (isVisited) {
          bgColor = "bg-purple-300 dark:bg-purple-700/60";
        }
        
        squares.push(
          <div
            key={`${row}-${col}`}
            className={`
              ${bgColor}
              flex items-center justify-center
              cursor-pointer
              transition-colors
              relative
              aspect-square
              hover:brightness-110
            `}
            onClick={() => handleSquareClick(row, col)}
            data-testid={`square-${row}-${col}`}
          >
            {isKnightHere && (
              <span className="text-2xl sm:text-3xl md:text-4xl select-none text-white drop-shadow-md">
                ♞
              </span>
            )}
            {isVisited && !isKnightHere && moveNumber !== null && (
              <span className={`
                text-xs sm:text-sm font-bold select-none
                ${isLight ? "text-purple-800 dark:text-purple-200" : "text-purple-200 dark:text-purple-100"}
              `}>
                {moveNumber}
              </span>
            )}
            {isValidNextMove && !isVisited && (
              <div className="w-3 h-3 rounded-full bg-green-600 dark:bg-green-400 opacity-80" />
            )}
          </div>
        );
      }
    }
    
    return (
      <div 
        className="grid gap-0 border-2 border-amber-900 dark:border-amber-700 rounded-sm"
        style={{ 
          gridTemplateColumns: `repeat(${boardSize}, 1fr)`,
          width: "min(500px, 90vw)",
          aspectRatio: "1 / 1",
        }}
        data-testid="game-board"
      >
        {squares}
      </div>
    );
  };
  
  return (
    <div className="h-full flex">
      <Helmet>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="flex-1 flex items-center justify-center p-4 bg-muted/30 overflow-auto">
        <div className="w-full max-w-2xl space-y-4">
          <div>
            <h1 className="text-2xl font-bold" data-testid="heading-knights-tour">Knight's Tour</h1>
            <p className="text-sm text-muted-foreground">
              Visit every square exactly once using knight moves
            </p>
          </div>
          
          {!gameStarted ? (
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h2 className="text-xl font-semibold">Configure Challenge</h2>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Board Size</label>
                  <Select 
                    value={boardSize.toString()} 
                    onValueChange={(v) => setBoardSize(parseInt(v) as BoardSize)}
                  >
                    <SelectTrigger data-testid="select-board-size">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BOARD_SIZES.map(size => {
                        const difficultyLabels: Record<number, string> = {
                          5: 'Patzer',
                          6: 'Novice',
                          7: 'Intermediate',
                          8: 'Club Player',
                          9: 'Advanced',
                          10: 'Expert',
                          11: 'Master',
                          12: 'Grandmaster'
                        };
                        return (
                          <SelectItem key={size} value={size.toString()}>
                            {difficultyLabels[size]} {size}x{size} ({size * size} squares)
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="pt-2 space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Target className="w-4 h-4 text-muted-foreground" />
                    <span>Target: Visit all {boardSize * boardSize} squares</span>
                  </div>
                  {progress && (progress.completedCount || 0) > 0 ? (
                    <>
                      <div className="flex items-center gap-2 text-sm">
                        <Trophy className="w-4 h-4 text-yellow-500" />
                        <span>Completed: {progress.completedCount} times</span>
                      </div>
                      {progress.bestTime && (
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="w-4 h-4 text-green-500" />
                          <span>Best Time: {formatTime(progress.bestTime)}</span>
                        </div>
                      )}
                    </>
                  ) : progress?.highestMoveCount ? (
                    <div className="flex items-center gap-2 text-sm">
                      <TrendingUp className="w-4 h-4 text-blue-500" />
                      <span>Best Attempt: {progress.highestMoveCount}/{boardSize * boardSize} squares</span>
                    </div>
                  ) : null}
                </div>
                
                {overallProgress.totalCompleted > 0 && (
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      Overall: {overallProgress.totalCompleted} tours completed across {overallProgress.boardsCompleted} board sizes
                    </p>
                  </div>
                )}
                
                <Button 
                  onClick={handleStartGame}
                  className="w-full"
                  data-testid="button-start-challenge"
                >
                  Start Challenge
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Target className="w-5 h-5 text-primary" />
                    <span className="font-mono text-lg" data-testid="text-move-count">
                      {moveCount} / {totalSquares}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-muted-foreground" />
                    <span className="font-mono text-lg" data-testid="text-timer">
                      {formatTime(elapsedTime)}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleUndo}
                    disabled={moveHistory.length <= 1 || isComplete}
                    data-testid="button-undo"
                  >
                    <Undo2 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleReset}
                    data-testid="button-reset"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Reset
                  </Button>
                </div>
              </div>
              
              {isComplete && (
                <div className="p-4 bg-green-100 dark:bg-green-900/30 rounded-lg border border-green-300 dark:border-green-700">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-6 h-6 text-yellow-500" />
                    <span className="font-semibold text-green-800 dark:text-green-200">
                      Tour Complete! Time: {formatTime(elapsedTime)}
                    </span>
                  </div>
                </div>
              )}
              
              {isStuck && (
                <div className="p-4 bg-red-100 dark:bg-red-900/30 rounded-lg border border-red-300 dark:border-red-700">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-red-800 dark:text-red-200">
                      No valid moves! You got stuck after {moveCount} moves.
                    </span>
                  </div>
                </div>
              )}
              
              {(isComplete || isStuck) && (
                <div className="flex flex-wrap justify-center gap-2">
                  <Button
                    onClick={handlePlayAgain}
                    className="gap-2"
                    data-testid="button-play-again"
                  >
                    <Play className="w-4 h-4" />
                    Play Again
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleChangeDifficulty}
                    className="gap-2"
                    data-testid="button-change-difficulty"
                  >
                    <Settings className="w-4 h-4" />
                    Change Difficulty
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleMainMenu}
                    className="gap-2"
                    data-testid="button-main-menu"
                  >
                    <Home className="w-4 h-4" />
                    Main Menu
                  </Button>
                </div>
              )}
              
              <div className="flex justify-center">
                {renderBoard()}
              </div>
              
              <div className="text-center text-sm text-muted-foreground">
                {!knightPosition ? (
                  "Click any square to place the knight"
                ) : isComplete ? (
                  "Congratulations! You completed the tour!"
                ) : isStuck ? (
                  "No valid moves remaining. Undo or reset to try again."
                ) : (
                  <>Green squares show valid knight moves. Purple squares show your path.</>
                )}
              </div>
            </div>
          )}
          
          {gameStarted && (
            <Button
              variant="outline"
              onClick={handleBackToMenu}
              className="w-full"
              data-testid="button-back-to-menu"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Menu
            </Button>
          )}
        </div>
      </div>
      
      <div className="hidden lg:block w-80 border-l bg-card p-4 overflow-auto">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">♞</span>
            <div>
              <h3 className="font-semibold">Knight's Tour</h3>
              <p className="text-sm text-muted-foreground">{boardSize}x{boardSize} board</p>
            </div>
          </div>
          
          <div className="space-y-2">
            <h4 className="font-medium">How to Play</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>1. Click any square to start</li>
              <li>2. Move to green squares (valid knight moves)</li>
              <li>3. Visit all {totalSquares} squares</li>
              <li>4. Avoid getting stuck!</li>
            </ul>
          </div>
          
          <div className="space-y-2">
            <h4 className="font-medium">Legend</h4>
            <div className="space-y-1 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-blue-500 rounded" />
                <span>Current knight position</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-500 rounded" />
                <span>Valid next moves</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-purple-400 dark:bg-purple-700 rounded" />
                <span>Visited squares</span>
              </div>
            </div>
          </div>
          
          <div className="space-y-2">
            <h4 className="font-medium">Tips</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>Start from a corner for easier tours</li>
              <li>Try Warnsdorff's rule: move to squares with fewer onward options</li>
              <li>Use undo to backtrack when stuck</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
