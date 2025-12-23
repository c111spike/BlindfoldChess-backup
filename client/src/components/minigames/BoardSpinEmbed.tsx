import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNotifications } from "@/hooks/useNotifications";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCw, Clock, Target, Trophy, Play, Sparkles } from "lucide-react";
import { generatePositionClient, getOptimalMovesClient, calculateScoreClient, OptimalMove } from "@/lib/boardSpinClient";
import { Chess } from 'chess.js';

const PIECE_UNICODE: Record<string, string> = {
  'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙',
  'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟',
};

const AVAILABLE_PIECES = ['K', 'Q', 'R', 'B', 'N', 'P', 'k', 'q', 'r', 'b', 'n', 'p'];

const transformSquare = (square: string, rotation: number): string => {
  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const file = files.indexOf(square[0]);
  const rank = parseInt(square[1]) - 1;
  
  let newFile: number, newRank: number;
  
  switch (rotation) {
    case 90:
      newFile = 7 - rank;
      newRank = file;
      break;
    case 180:
      newFile = 7 - file;
      newRank = 7 - rank;
      break;
    case 270:
      newFile = rank;
      newRank = 7 - file;
      break;
    default:
      return square;
  }
  
  return files[newFile] + (newRank + 1);
};

interface GeneratedPosition {
  fen: string;
  board: (string | null)[][];
  difficulty: string;
  pieceCount: number;
  rotation: number;
  multiplier: number;
  pointsPerPiece: number;
  maxScore: number;
}

type GamePhase = 'select' | 'memorize' | 'spinning' | 'recreate' | 'bonus' | 'results';

interface BoardSpinEmbedProps {
  onClose?: () => void;
}

export function BoardSpinEmbed({ onClose }: BoardSpinEmbedProps) {
  const { toast } = useNotifications();
  const [phase, setPhase] = useState<GamePhase>('select');
  const [difficulty, setDifficulty] = useState<string>('easy');
  const [position, setPosition] = useState<GeneratedPosition | null>(null);
  const [playerBoard, setPlayerBoard] = useState<(string | null)[][]>(
    Array(8).fill(null).map(() => Array(8).fill(null))
  );
  const [selectedPiece, setSelectedPiece] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(120);
  const [spinRotation, setSpinRotation] = useState(0);
  const [flyingPieces, setFlyingPieces] = useState<Array<{ piece: string; x: number; y: number; id: number }>>([]);
  const [score, setScore] = useState(0);
  const [accuracy, setAccuracy] = useState(0);
  const [finalRotation, setFinalRotation] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const recreationStartTime = useRef<number>(0);

  const difficulties = [
    { value: 'beginner', label: 'Beginner (3-4 pieces)', multiplier: '1.0x' },
    { value: 'easy', label: 'Easy (5-7 pieces)', multiplier: '1.5x' },
    { value: 'intermediate', label: 'Intermediate (8-11 pieces)', multiplier: '2.0x' },
    { value: 'advanced', label: 'Advanced (12-14 pieces)', multiplier: '2.5x' },
  ];

  const generateNewPosition = async () => {
    try {
      const result = generatePositionClient(difficulty);
      setPosition(result);
      setPhase('memorize');
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate position",
        variant: "destructive",
      });
    }
  };

  const startSpin = useCallback(() => {
    if (!position) return;
    
    setPhase('spinning');
    
    const pieces: Array<{ piece: string; x: number; y: number; id: number }> = [];
    let id = 0;
    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const piece = position.board[rank][file];
        if (piece) {
          pieces.push({
            piece,
            x: file * 12.5,
            y: rank * 12.5,
            id: id++,
          });
        }
      }
    }
    setFlyingPieces(pieces);
    
    const totalSpins = 3;
    const finalAngle = position.rotation;
    setFinalRotation(finalAngle);
    
    let currentRotation = 0;
    const targetRotation = totalSpins * 360 + finalAngle;
    const duration = 2000;
    const startTime = Date.now();
    
    const animateSpin = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      currentRotation = eased * targetRotation;
      setSpinRotation(currentRotation);
      
      if (progress < 1) {
        requestAnimationFrame(animateSpin);
      } else {
        setTimeout(() => {
          setFlyingPieces([]);
          setPhase('recreate');
          setTimeLeft(120);
          recreationStartTime.current = Date.now();
          setPlayerBoard(Array(8).fill(null).map(() => Array(8).fill(null)));
          
          timerRef.current = setInterval(() => {
            setTimeLeft(prev => {
              if (prev <= 1) {
                if (timerRef.current) clearInterval(timerRef.current);
                checkAnswer();
                return 0;
              }
              return prev - 1;
            });
          }, 1000);
        }, 500);
      }
    };
    
    requestAnimationFrame(animateSpin);
  }, [position]);

  const checkAnswer = async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    if (!position) return;
    
    try {
      const result = calculateScoreClient(
        position.board,
        playerBoard,
        position.rotation,
        position.multiplier,
        false
      );
      
      setScore(result.score);
      setAccuracy(result.accuracy);
      setPhase('results');
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to check answer",
        variant: "destructive",
      });
    }
  };

  const handleSquareClick = (rank: number, file: number) => {
    if (phase !== 'recreate') return;
    
    const currentPiece = playerBoard[rank][file];
    
    if (currentPiece) {
      const newBoard = playerBoard.map(r => [...r]);
      newBoard[rank][file] = null;
      setPlayerBoard(newBoard);
      return;
    }
    
    if (selectedPiece) {
      const newBoard = playerBoard.map(r => [...r]);
      newBoard[rank][file] = selectedPiece;
      setPlayerBoard(newBoard);
    }
  };

  const playAgain = () => {
    setPhase('select');
    setPosition(null);
    setPlayerBoard(Array(8).fill(null).map(() => Array(8).fill(null)));
    setSelectedPiece(null);
    setTimeLeft(120);
    setSpinRotation(0);
    setFlyingPieces([]);
    setScore(0);
    setAccuracy(0);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const renderBoard = (board: (string | null)[][], rotation: number = 0, interactive = false) => {
    const squares = [];
    
    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const isLight = (rank + file) % 2 === 0;
        const piece = board[rank][file];
        
        squares.push(
          <div
            key={`${rank}-${file}`}
            className={`
              aspect-square flex items-center justify-center
              ${isLight ? 'bg-amber-100 dark:bg-amber-900/40' : 'bg-amber-700 dark:bg-amber-800'}
              ${interactive ? 'cursor-pointer hover:brightness-110' : ''}
            `}
            onClick={interactive ? () => handleSquareClick(rank, file) : undefined}
          >
            {piece && (
              <span className={`text-lg sm:text-xl select-none ${piece === piece.toUpperCase() ? 'text-amber-100' : 'text-amber-900'}`}>
                {PIECE_UNICODE[piece]}
              </span>
            )}
          </div>
        );
      }
    }
    
    return (
      <div 
        className="grid grid-cols-8 w-full max-w-xs aspect-square border-2 border-amber-900 dark:border-amber-700 rounded overflow-hidden"
        style={{ transform: `rotate(${rotation}deg)` }}
      >
        {squares}
      </div>
    );
  };

  if (phase === 'select') {
    return (
      <div className="flex flex-col items-center justify-center p-4 space-y-4">
        <div className="text-center mb-4">
          <h2 className="text-xl font-bold flex items-center justify-center gap-2">
            <RotateCw className="h-5 w-5 text-blue-500" />
            Board Spin
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Memorize the position, then recreate it after the board spins
          </p>
        </div>
        
        <div className="w-full max-w-xs space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Difficulty</label>
            <Select value={difficulty} onValueChange={setDifficulty}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {difficulties.map((d) => (
                  <SelectItem key={d.value} value={d.value}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <Button onClick={generateNewPosition} className="w-full" size="lg">
            <Play className="h-4 w-4 mr-2" />
            Start Game
          </Button>
        </div>
      </div>
    );
  }

  if (phase === 'memorize') {
    return (
      <div className="flex flex-col items-center p-2 sm:p-4">
        <div className="text-center mb-4">
          <h3 className="font-semibold">Memorize This Position</h3>
          <p className="text-sm text-muted-foreground">
            {position?.pieceCount} pieces - {position?.multiplier}x multiplier
          </p>
        </div>
        
        {position && renderBoard(position.board)}
        
        <Button onClick={startSpin} className="mt-4" size="lg">
          <RotateCw className="h-4 w-4 mr-2" />
          Spin!
        </Button>
      </div>
    );
  }

  if (phase === 'spinning') {
    return (
      <div className="flex flex-col items-center justify-center p-4 min-h-[300px]">
        <div 
          className="relative w-48 h-48 sm:w-64 sm:h-64"
          style={{ transform: `rotate(${spinRotation}deg)` }}
        >
          <div className="absolute inset-0 grid grid-cols-8 border-2 border-amber-900 rounded overflow-hidden">
            {Array(64).fill(null).map((_, i) => {
              const row = Math.floor(i / 8);
              const col = i % 8;
              const isLight = (row + col) % 2 === 0;
              return (
                <div
                  key={i}
                  className={`aspect-square ${isLight ? 'bg-amber-100' : 'bg-amber-700'}`}
                />
              );
            })}
          </div>
          
          <AnimatePresence>
            {flyingPieces.map((p) => (
              <motion.div
                key={p.id}
                className="absolute text-xl"
                initial={{ x: `${p.x}%`, y: `${p.y}%` }}
                animate={{
                  x: `${Math.random() * 100}%`,
                  y: `${Math.random() * 100}%`,
                }}
                transition={{ duration: 2, ease: "easeInOut" }}
              >
                {PIECE_UNICODE[p.piece]}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        
        <p className="text-sm text-muted-foreground mt-4">Spinning...</p>
      </div>
    );
  }

  if (phase === 'recreate') {
    return (
      <div className="flex flex-col items-center p-2 sm:p-4">
        <div className="flex items-center justify-between w-full max-w-xs mb-3">
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4" />
            <span className={`font-mono ${timeLeft < 30 ? 'text-red-500' : ''}`}>
              {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
            </span>
          </div>
          <Badge variant="outline">
            Rotated {finalRotation}°
          </Badge>
        </div>
        
        {renderBoard(playerBoard, finalRotation, true)}
        
        <div className="flex flex-wrap gap-1 mt-3 justify-center max-w-xs">
          {AVAILABLE_PIECES.map((piece) => (
            <Button
              key={piece}
              variant={selectedPiece === piece ? "default" : "outline"}
              size="sm"
              className="w-8 h-8 p-0"
              onClick={() => setSelectedPiece(selectedPiece === piece ? null : piece)}
            >
              {PIECE_UNICODE[piece]}
            </Button>
          ))}
        </div>
        
        <Button onClick={checkAnswer} className="mt-4">
          <Target className="h-4 w-4 mr-2" />
          Submit
        </Button>
      </div>
    );
  }

  if (phase === 'results') {
    return (
      <div className="flex flex-col items-center p-4">
        <Card className={`w-full max-w-xs ${accuracy === 100 ? 'bg-green-500/10 border-green-500/30' : 'bg-card'}`}>
          <CardContent className="p-4 text-center">
            {accuracy === 100 ? (
              <Trophy className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
            ) : (
              <Target className="h-8 w-8 text-blue-500 mx-auto mb-2" />
            )}
            
            <p className="text-2xl font-bold">{score} pts</p>
            <p className="text-sm text-muted-foreground">{accuracy}% accuracy</p>
            
            <Button onClick={playAgain} className="mt-4 w-full">
              <Play className="h-4 w-4 mr-2" />
              Play Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}
