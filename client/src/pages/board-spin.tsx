import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCw, Clock, Target, Trophy, Play, Sparkles } from "lucide-react";

const PIECE_UNICODE: Record<string, string> = {
  'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙',
  'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟',
};

const AVAILABLE_PIECES = ['K', 'Q', 'R', 'B', 'N', 'P', 'k', 'q', 'r', 'b', 'n', 'p'];

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

export default function BoardSpin() {
  const { toast } = useToast();
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
  const [bestMove, setBestMove] = useState<string | null>(null);
  const [playerMove, setPlayerMove] = useState<string>('');
  const [bonusResult, setBonusResult] = useState<boolean | null>(null);
  const [finalRotation, setFinalRotation] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const difficulties = [
    { value: 'beginner', label: 'Beginner (3-5 pieces)', multiplier: '1.0x' },
    { value: 'easy', label: 'Easy (6-10 pieces)', multiplier: '1.5x' },
    { value: 'medium', label: 'Medium (11-17 pieces)', multiplier: '2.0x' },
    { value: 'hard', label: 'Hard (18-24 pieces)', multiplier: '2.5x' },
    { value: 'expert', label: 'Expert (25-31 pieces)', multiplier: '3.0x' },
    { value: 'master', label: 'Master (32 pieces)', multiplier: '4.0x' },
  ];

  const generateNewPosition = async () => {
    try {
      const response = await apiRequest('POST', '/api/boardspin/generate', { difficulty });
      const result = await response.json() as GeneratedPosition;
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
    
    // Create flying pieces from current position
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
    
    // Animate spin - multiple rotations plus landing at final angle
    const totalSpins = 3;
    const finalAngle = position.rotation;
    setFinalRotation(finalAngle);
    
    // Animate to total rotation over 2 seconds
    let currentRotation = 0;
    const targetRotation = totalSpins * 360 + finalAngle;
    const duration = 2000;
    const startTime = Date.now();
    
    const animateSpin = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      currentRotation = eased * targetRotation;
      setSpinRotation(currentRotation);
      
      if (progress < 1) {
        requestAnimationFrame(animateSpin);
      } else {
        // Spin complete - transition to recreate phase
        setTimeout(() => {
          setFlyingPieces([]);
          setPhase('recreate');
          setTimeLeft(120);
          setPlayerBoard(Array(8).fill(null).map(() => Array(8).fill(null)));
          
          // Start countdown timer
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
      const checkResponse = await apiRequest('POST', '/api/boardspin/check', {
        originalBoard: position.board,
        playerBoard,
        rotation: position.rotation,
        multiplier: position.multiplier,
      });
      const result = await checkResponse.json() as { score: number; accuracy: number; correctPieces: number; totalPieces: number };
      
      setScore(result.score);
      setAccuracy(result.accuracy);
      
      // If 100% accuracy, go to bonus phase
      if (result.accuracy === 100) {
        // Get best move from Stockfish
        const bestMoveResponse = await apiRequest('POST', '/api/boardspin/bestmove', { fen: position.fen });
        const bestMoveResult = await bestMoveResponse.json() as { bestMove: string };
        setBestMove(bestMoveResult.bestMove);
        setPhase('bonus');
      } else {
        setPhase('results');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to check answer",
        variant: "destructive",
      });
    }
  };

  const handleBonusSubmit = async () => {
    if (!bestMove) return;
    
    const isCorrect = playerMove.toLowerCase().replace(/[^a-h1-8]/g, '') === 
                      bestMove.toLowerCase().replace(/[^a-h1-8]/g, '');
    
    setBonusResult(isCorrect);
    
    if (isCorrect) {
      setScore(prev => prev * 2);
    }
    
    setPhase('results');
  };

  const handleSquareClick = (rank: number, file: number) => {
    if (phase !== 'recreate') return;
    
    if (selectedPiece) {
      // Place the piece
      const newBoard = playerBoard.map(row => [...row]);
      newBoard[rank][file] = selectedPiece;
      setPlayerBoard(newBoard);
      setSelectedPiece(null);
    } else if (playerBoard[rank][file]) {
      // Remove the piece
      const newBoard = playerBoard.map(row => [...row]);
      newBoard[rank][file] = null;
      setPlayerBoard(newBoard);
    }
  };

  const resetGame = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setPhase('select');
    setPosition(null);
    setPlayerBoard(Array(8).fill(null).map(() => Array(8).fill(null)));
    setSelectedPiece(null);
    setTimeLeft(120);
    setSpinRotation(0);
    setFlyingPieces([]);
    setScore(0);
    setAccuracy(0);
    setBestMove(null);
    setPlayerMove('');
    setBonusResult(null);
    setFinalRotation(0);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const renderBoard = (board: (string | null)[][], rotation: number = 0, interactive: boolean = false) => {
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];
    
    return (
      <motion.div 
        className="relative aspect-square w-full max-w-[400px]"
        style={{ 
          transform: `rotate(${rotation}deg)`,
          transformOrigin: 'center center',
        }}
        animate={{ rotate: rotation }}
        transition={{ duration: 0.1 }}
      >
        <div className="grid grid-cols-8 gap-0 border-2 border-border rounded-md overflow-hidden">
          {ranks.map((rank, rankIdx) => (
            files.map((file, fileIdx) => {
              const isLight = (rankIdx + fileIdx) % 2 === 0;
              const piece = board[rankIdx][fileIdx];
              
              return (
                <div
                  key={`${file}${rank}`}
                  className={`aspect-square flex items-center justify-center cursor-pointer transition-colors
                    ${isLight ? 'bg-amber-100 dark:bg-amber-200' : 'bg-amber-700 dark:bg-amber-800'}
                    ${interactive ? 'hover:brightness-110' : ''}
                    ${interactive && selectedPiece ? 'hover:ring-2 hover:ring-primary' : ''}
                  `}
                  style={{ transform: `rotate(${-rotation}deg)` }}
                  onClick={() => interactive && handleSquareClick(rankIdx, fileIdx)}
                  data-testid={`square-${file}${rank}`}
                >
                  {piece && (
                    <span className={`text-2xl sm:text-3xl md:text-4xl select-none
                      ${piece === piece.toUpperCase() ? 'text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]' : 'text-gray-900 drop-shadow-[0_1px_2px_rgba(255,255,255,0.5)]'}
                    `}>
                      {PIECE_UNICODE[piece]}
                    </span>
                  )}
                </div>
              );
            })
          ))}
        </div>
        
        {/* Flying pieces animation overlay */}
        <AnimatePresence>
          {flyingPieces.map((fp) => (
            <motion.div
              key={fp.id}
              className="absolute text-3xl pointer-events-none"
              initial={{ 
                left: `${fp.x}%`, 
                top: `${fp.y}%`,
                opacity: 1,
                scale: 1,
              }}
              animate={{ 
                left: `${50 + (Math.random() - 0.5) * 200}%`,
                top: `${50 + (Math.random() - 0.5) * 200}%`,
                opacity: 0,
                scale: 0.5,
                rotate: Math.random() * 720 - 360,
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.5, ease: "easeOut" }}
            >
              <span className={fp.piece === fp.piece.toUpperCase() ? 'text-white' : 'text-gray-900'}>
                {PIECE_UNICODE[fp.piece]}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>
    );
  };

  const renderPieceTray = () => (
    <div className="flex flex-wrap gap-2 justify-center p-4 bg-muted rounded-lg">
      <p className="w-full text-sm text-muted-foreground text-center mb-2">
        Click a piece, then click a square to place it. Click an occupied square to remove.
      </p>
      {AVAILABLE_PIECES.map((piece) => (
        <Button
          key={piece}
          variant={selectedPiece === piece ? "default" : "outline"}
          size="icon"
          className="w-12 h-12 text-2xl"
          onClick={() => setSelectedPiece(selectedPiece === piece ? null : piece)}
          data-testid={`piece-${piece}`}
        >
          <span className={piece === piece.toUpperCase() ? '' : 'text-gray-600 dark:text-gray-400'}>
            {PIECE_UNICODE[piece]}
          </span>
        </Button>
      ))}
    </div>
  );

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <RotateCw className="w-8 h-8" />
            Board Spin
          </h1>
          <p className="text-muted-foreground">Memorize, spin, recreate!</p>
        </div>
        {phase !== 'select' && (
          <Button variant="outline" onClick={resetGame} data-testid="button-reset">
            New Game
          </Button>
        )}
      </div>

      {/* Phase: Select Difficulty */}
      {phase === 'select' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5" />
              Select Difficulty
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select value={difficulty} onValueChange={setDifficulty}>
              <SelectTrigger data-testid="select-difficulty">
                <SelectValue placeholder="Select difficulty" />
              </SelectTrigger>
              <SelectContent>
                {difficulties.map((d) => (
                  <SelectItem key={d.value} value={d.value} data-testid={`difficulty-${d.value}`}>
                    <div className="flex items-center justify-between w-full gap-4">
                      <span>{d.label}</span>
                      <Badge variant="secondary">{d.multiplier}</Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Button 
              className="w-full" 
              size="lg"
              onClick={generateNewPosition}
              data-testid="button-start"
            >
              <Play className="w-4 h-4 mr-2" />
              Start Game
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Phase: Memorize */}
      {phase === 'memorize' && position && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5" />
                  Memorize the Position
                </span>
                <Badge variant="outline">{position.pieceCount} pieces</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
              <p className="text-muted-foreground">
                Take as long as you need. Press Spin when ready!
              </p>
              
              {renderBoard(position.board, 0, false)}
              
              <Button 
                size="lg" 
                className="mt-4"
                onClick={startSpin}
                data-testid="button-spin"
              >
                <RotateCw className="w-4 h-4 mr-2" />
                SPIN!
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Phase: Spinning */}
      {phase === 'spinning' && position && (
        <div className="space-y-4">
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-8">
              <h2 className="text-2xl font-bold animate-pulse">Spinning...</h2>
              
              <div className="relative">
                {renderBoard(
                  Array(8).fill(null).map(() => Array(8).fill(null)), 
                  spinRotation, 
                  false
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Phase: Recreate */}
      {phase === 'recreate' && position && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  Recreate the Position
                </span>
                <Badge 
                  variant={timeLeft < 30 ? "destructive" : "outline"}
                  className="text-lg px-3 py-1"
                >
                  <Clock className="w-4 h-4 mr-1" />
                  {formatTime(timeLeft)}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
              <p className="text-muted-foreground">
                Board is rotated {position.rotation}°. Place the pieces where they belong!
              </p>
              
              {renderBoard(playerBoard, finalRotation, true)}
              
              {renderPieceTray()}
              
              <Button 
                size="lg" 
                className="mt-4"
                onClick={checkAnswer}
                data-testid="button-submit"
              >
                Submit Answer
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Phase: Bonus */}
      {phase === 'bonus' && position && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <Trophy className="w-5 h-5" />
                Perfect! Bonus Round
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
              <p className="text-lg">Find the best move for double points!</p>
              
              {renderBoard(position.board, 0, false)}
              
              <div className="flex items-center gap-2 w-full max-w-xs">
                <input
                  type="text"
                  placeholder="e.g., e2e4 or Nf3"
                  value={playerMove}
                  onChange={(e) => setPlayerMove(e.target.value)}
                  className="flex-1 px-3 py-2 border rounded-md bg-background"
                  data-testid="input-move"
                />
                <Button onClick={handleBonusSubmit} data-testid="button-bonus-submit">
                  Submit
                </Button>
              </div>
              
              <Button variant="outline" onClick={() => setPhase('results')}>
                Skip Bonus
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Phase: Results */}
      {phase === 'results' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5" />
              Results
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Accuracy</p>
                <p className="text-3xl font-bold">{accuracy}%</p>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Score</p>
                <p className="text-3xl font-bold">{score}</p>
                {bonusResult === true && (
                  <Badge className="mt-1" variant="default">×2 Bonus!</Badge>
                )}
              </div>
            </div>
            
            {bonusResult !== null && (
              <div className={`p-4 rounded-lg text-center ${bonusResult ? 'bg-green-100 dark:bg-green-900' : 'bg-red-100 dark:bg-red-900'}`}>
                {bonusResult ? (
                  <p className="text-green-700 dark:text-green-300">
                    Correct! Best move was {bestMove}. Score doubled!
                  </p>
                ) : (
                  <p className="text-red-700 dark:text-red-300">
                    The best move was {bestMove}. No bonus this time.
                  </p>
                )}
              </div>
            )}
            
            {accuracy === 100 && bonusResult === null && (
              <p className="text-center text-muted-foreground">
                You skipped the bonus round.
              </p>
            )}
            
            <div className="flex gap-2 justify-center">
              <Button onClick={resetGame} size="lg" data-testid="button-play-again">
                <Play className="w-4 h-4 mr-2" />
                Play Again
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
