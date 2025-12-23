import { useState, useEffect, useCallback } from "react";
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
import { Clock, RotateCcw, Undo2, Trophy, Target, Play } from "lucide-react";

type BoardSize = 5 | 6 | 7 | 8;

interface Position {
  row: number;
  col: number;
}

const BOARD_SIZES: BoardSize[] = [5, 6, 7, 8];

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

interface KnightsTourEmbedProps {
  onClose?: () => void;
}

export function KnightsTourEmbed({ onClose }: KnightsTourEmbedProps) {
  const { toast } = useNotifications();
  
  const [boardSize, setBoardSize] = useState<BoardSize>(8);
  const [gameStarted, setGameStarted] = useState(false);
  const [knightPosition, setKnightPosition] = useState<Position | null>(null);
  const [visited, setVisited] = useState<boolean[][]>(() => createEmptyVisited(8));
  const [moveHistory, setMoveHistory] = useState<Position[]>([]);
  const [moveCount, setMoveCount] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [isStuck, setIsStuck] = useState(false);
  
  const totalSquares = boardSize * boardSize;
  const validMoves = knightPosition && !isComplete && !isStuck
    ? getValidMoves(knightPosition, boardSize, visited)
    : [];
  
  useEffect(() => {
    if (!gameStarted || isComplete || isStuck || !startTime) return;
    
    const interval = setInterval(() => {
      setElapsedTime(Date.now() - startTime);
    }, 100);
    
    return () => clearInterval(interval);
  }, [gameStarted, isComplete, isStuck, startTime]);
  
  useEffect(() => {
    if (!gameStarted || !knightPosition) return;
    
    if (moveCount === totalSquares && !isComplete) {
      setIsComplete(true);
      toast({
        title: "Congratulations!",
        description: `You completed the Knight's Tour in ${formatTime(elapsedTime)}!`,
      });
    } else if (validMoves.length === 0 && moveCount > 0 && moveCount < totalSquares && !isStuck) {
      setIsStuck(true);
      toast({
        title: "No Valid Moves!",
        description: `You got stuck after ${moveCount} moves. Try again!`,
        variant: "destructive",
      });
    }
  }, [moveCount, totalSquares, validMoves.length, gameStarted, knightPosition, isComplete, isStuck, elapsedTime, toast]);
  
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
  
  const handleSquareClick = (row: number, col: number) => {
    if (isComplete) return;
    
    const clickedPos = { row, col };
    
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
    
    const isValidMove = validMoves.some(m => m.row === row && m.col === col);
    if (!isValidMove) return;
    
    const newVisited = visited.map(r => [...r]);
    newVisited[row][col] = true;
    setVisited(newVisited);
    setKnightPosition(clickedPos);
    setMoveHistory(prev => [...prev, clickedPos]);
    setMoveCount(prev => prev + 1);
  };
  
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
  
  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    const tenths = Math.floor((ms % 1000) / 100);
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}.${tenths}`;
  };
  
  const getMoveNumber = (row: number, col: number): number | null => {
    const index = moveHistory.findIndex(pos => pos.row === row && pos.col === col);
    return index >= 0 ? index + 1 : null;
  };
  
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
          >
            {isKnightHere && (
              <span className="text-xl sm:text-2xl select-none text-white drop-shadow-md">♞</span>
            )}
            {!isKnightHere && moveNumber && (
              <span className={`text-xs sm:text-sm font-bold ${isLight ? "text-amber-800" : "text-amber-100"}`}>
                {moveNumber}
              </span>
            )}
          </div>
        );
      }
    }
    
    return squares;
  };

  if (!gameStarted) {
    return (
      <div className="flex flex-col items-center justify-center p-4 space-y-4">
        <div className="text-center mb-4">
          <h2 className="text-xl font-bold flex items-center justify-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Knight's Tour
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Visit every square exactly once using knight moves
          </p>
        </div>
        
        <div className="w-full max-w-xs space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Board Size</label>
            <Select value={boardSize.toString()} onValueChange={(v) => setBoardSize(parseInt(v) as BoardSize)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BOARD_SIZES.map((size) => (
                  <SelectItem key={size} value={size.toString()}>
                    {size}×{size} ({size * size} squares)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <Button onClick={handleStartGame} className="w-full" size="lg">
            <Play className="h-4 w-4 mr-2" />
            Start Game
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center p-2 sm:p-4">
      <div className="flex items-center justify-between w-full max-w-sm mb-3">
        <div className="flex items-center gap-2 text-sm">
          <Clock className="h-4 w-4" />
          <span className="font-mono">{formatTime(elapsedTime)}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Target className="h-4 w-4" />
          <span>{moveCount}/{totalSquares}</span>
        </div>
      </div>
      
      <div 
        className="grid w-full max-w-sm aspect-square border-2 border-amber-900 dark:border-amber-700 rounded overflow-hidden"
        style={{ gridTemplateColumns: `repeat(${boardSize}, 1fr)` }}
      >
        {renderBoard()}
      </div>
      
      <div className="flex gap-2 mt-4">
        <Button variant="outline" size="sm" onClick={handleUndo} disabled={moveHistory.length <= 1}>
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={handleReset}>
          <RotateCcw className="h-4 w-4" />
        </Button>
        {(isComplete || isStuck) && (
          <Button size="sm" onClick={handlePlayAgain}>
            <Play className="h-4 w-4 mr-1" /> Again
          </Button>
        )}
      </div>
      
      {isComplete && (
        <Card className="mt-4 bg-green-500/10 border-green-500/30">
          <CardContent className="p-3 text-center">
            <Trophy className="h-6 w-6 text-yellow-500 mx-auto mb-1" />
            <p className="font-bold text-green-600 dark:text-green-400">Tour Complete!</p>
            <p className="text-sm text-muted-foreground">{formatTime(elapsedTime)}</p>
          </CardContent>
        </Card>
      )}
      
      {isStuck && (
        <Card className="mt-4 bg-red-500/10 border-red-500/30">
          <CardContent className="p-3 text-center">
            <p className="font-bold text-red-600 dark:text-red-400">Stuck!</p>
            <p className="text-sm text-muted-foreground">{moveCount} moves - try again</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
