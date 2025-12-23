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
import { Play, RotateCcw, Trophy, Target, Clock, CheckCircle } from "lucide-react";
import {
  PieceType,
  BoardSize,
  Position,
  BOARD_SIZES,
  PIECE_NAMES,
  PIECE_SYMBOLS,
  MAX_PIECES,
  isAttacking,
  getAttackSquares,
  isValidSolution,
  hasConflicts,
  getConflictingPieces,
} from "@shared/nPieceChallengeData";

const PIECE_TYPES: PieceType[] = ["rook", "knight", "bishop", "queen", "king"];

interface NPieceChallengeEmbedProps {
  onClose?: () => void;
  hideAttackHighlights?: boolean;
}

export function NPieceChallengeEmbed({ onClose, hideAttackHighlights = false }: NPieceChallengeEmbedProps) {
  const { toast } = useNotifications();
  
  const [pieceType, setPieceType] = useState<PieceType>("queen");
  const [boardSize, setBoardSize] = useState<BoardSize>(8);
  const [gameStarted, setGameStarted] = useState(false);
  const [pieces, setPieces] = useState<Position[]>([]);
  const [selectedPiece, setSelectedPiece] = useState<Position | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isSolved, setIsSolved] = useState(false);
  const [solveTime, setSolveTime] = useState<number | null>(null);
  
  const maxPieces = MAX_PIECES[pieceType][boardSize];
  
  useEffect(() => {
    if (!gameStarted || isSolved || !startTime) return;
    
    const interval = setInterval(() => {
      setElapsedTime(Date.now() - startTime);
    }, 100);
    
    return () => clearInterval(interval);
  }, [gameStarted, isSolved, startTime]);
  
  useEffect(() => {
    if (gameStarted && !isSolved && pieces.length === maxPieces) {
      const valid = isValidSolution(pieceType, pieces, boardSize);
      if (valid) {
        const time = elapsedTime;
        setIsSolved(true);
        setSolveTime(time);
        toast({
          title: "Solved!",
          description: `You placed ${maxPieces} ${PIECE_NAMES[pieceType]}s in ${formatTime(time)}!`,
        });
      }
    }
  }, [pieces, maxPieces, pieceType, boardSize, gameStarted, isSolved, elapsedTime, toast]);
  
  const handleStartGame = () => {
    setPieces([]);
    setSelectedPiece(null);
    setStartTime(Date.now());
    setElapsedTime(0);
    setIsSolved(false);
    setSolveTime(null);
    setGameStarted(true);
  };
  
  const handleReset = () => {
    setPieces([]);
    setSelectedPiece(null);
    setStartTime(Date.now());
    setElapsedTime(0);
    setIsSolved(false);
    setSolveTime(null);
  };
  
  const handleSquareClick = (row: number, col: number) => {
    if (isSolved) return;
    
    const existingIndex = pieces.findIndex(p => p.row === row && p.col === col);
    
    if (existingIndex >= 0) {
      if (selectedPiece?.row === row && selectedPiece?.col === col) {
        setSelectedPiece(null);
      } else {
        setSelectedPiece({ row, col });
      }
      return;
    }
    
    if (selectedPiece) {
      const newPieces = pieces.map(p => 
        p.row === selectedPiece.row && p.col === selectedPiece.col
          ? { row, col }
          : p
      );
      setPieces(newPieces);
      setSelectedPiece(null);
      return;
    }
    
    if (pieces.length < maxPieces) {
      setPieces([...pieces, { row, col }]);
    }
  };
  
  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    const tenths = Math.floor((ms % 1000) / 100);
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}.${tenths}`;
  };
  
  const attackedSquares = new Set<string>();
  const conflictingSet = hasConflicts(pieceType, pieces) ? getConflictingPieces(pieceType, pieces) : new Set<string>();
  
  pieces.forEach(p => {
    getAttackSquares(pieceType, p, boardSize).forEach(sq => {
      attackedSquares.add(`${sq.row}-${sq.col}`);
    });
  });
  
  const renderBoard = () => {
    const squares = [];
    
    for (let row = 0; row < boardSize; row++) {
      for (let col = 0; col < boardSize; col++) {
        const isLight = (row + col) % 2 === 0;
        const hasPiece = pieces.some(p => p.row === row && p.col === col);
        const isSelected = selectedPiece?.row === row && selectedPiece?.col === col;
        const isAttacked = attackedSquares.has(`${row}-${col}`);
        const isConflict = conflictingSet.has(`${row},${col}`);
        
        let bgColor = isLight ? "bg-amber-100 dark:bg-amber-900/40" : "bg-amber-700 dark:bg-amber-800";
        
        if (isSelected) {
          bgColor = "bg-blue-500 dark:bg-blue-600";
        } else if (isConflict) {
          bgColor = "bg-red-500/70 dark:bg-red-600/70";
        } else if (hasPiece) {
          bgColor = "bg-green-400/70 dark:bg-green-600/70";
        } else if (isAttacked && !isSolved && !hideAttackHighlights) {
          bgColor = isLight ? "bg-red-200/50 dark:bg-red-900/30" : "bg-red-400/30 dark:bg-red-800/30";
        }
        
        squares.push(
          <div
            key={`${row}-${col}`}
            className={`
              ${bgColor}
              flex items-center justify-center
              cursor-pointer
              transition-colors
              aspect-square
              hover:brightness-110
            `}
            onClick={() => handleSquareClick(row, col)}
          >
            {hasPiece && (
              <span className={`text-xl sm:text-2xl select-none ${isLight ? "text-amber-900" : "text-amber-100"}`}>
                {PIECE_SYMBOLS[pieceType]}
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
            <Target className="h-5 w-5 text-blue-500" />
            N-Piece Challenge
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Place pieces so none attack each other
          </p>
        </div>
        
        <div className="w-full max-w-xs space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Piece Type</label>
            <Select value={pieceType} onValueChange={(v) => setPieceType(v as PieceType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PIECE_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {PIECE_SYMBOLS[type]} {PIECE_NAMES[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <label className="text-sm font-medium mb-2 block">Board Size</label>
            <Select value={boardSize.toString()} onValueChange={(v) => setBoardSize(parseInt(v) as BoardSize)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BOARD_SIZES.map((size) => (
                  <SelectItem key={size} value={size.toString()}>
                    {size}×{size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="text-center text-sm text-muted-foreground">
            Place {maxPieces} {PIECE_NAMES[pieceType]}s
          </div>
          
          <Button onClick={handleStartGame} className="w-full" size="lg">
            <Play className="h-4 w-4 mr-2" />
            Start Challenge
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
          <span>{pieces.length}/{maxPieces} {PIECE_NAMES[pieceType]}s</span>
        </div>
      </div>
      
      <div 
        className="grid w-full max-w-sm aspect-square border-2 border-amber-900 dark:border-amber-700 rounded overflow-hidden"
        style={{ gridTemplateColumns: `repeat(${boardSize}, 1fr)` }}
      >
        {renderBoard()}
      </div>
      
      <div className="flex gap-2 mt-4">
        <Button variant="outline" size="sm" onClick={handleReset}>
          <RotateCcw className="h-4 w-4 mr-1" /> Reset
        </Button>
        {isSolved && (
          <Button size="sm" onClick={handleReset}>
            <Play className="h-4 w-4 mr-1" /> Again
          </Button>
        )}
      </div>
      
      {isSolved && (
        <Card className="mt-4 bg-green-500/10 border-green-500/30">
          <CardContent className="p-3 text-center">
            <CheckCircle className="h-6 w-6 text-green-500 mx-auto mb-1" />
            <p className="font-bold text-green-600 dark:text-green-400">Solved!</p>
            <p className="text-sm text-muted-foreground">{formatTime(solveTime || 0)}</p>
          </CardContent>
        </Card>
      )}
      
      {!isSolved && pieces.length > 0 && conflictingSet.size > 0 && (
        <p className="text-sm text-red-500 mt-2">
          {conflictingSet.size} piece(s) in conflict
        </p>
      )}
    </div>
  );
}
