import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNotifications } from "@/hooks/useNotifications";
import { apiRequest } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCw, Clock, Target, Trophy, Play, Sparkles, Home, Eye } from "lucide-react";
import { generatePositionClient, getOptimalMovesClient, calculateScoreClient, OptimalMove, wouldPawnCreateCrossing, wouldPawnCreateInvalidDoubling } from "@/lib/boardSpinClient";
import { Chess } from 'chess.js';

const PIECE_UNICODE: Record<string, string> = {
  'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙',
  'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟',
};

const AVAILABLE_PIECES = ['K', 'Q', 'R', 'B', 'N', 'P', 'k', 'q', 'r', 'b', 'n', 'p'];

// Transform a square notation based on board rotation
// This converts the original move coordinates to match the rotated visual display
const transformSquare = (square: string, rotation: number): string => {
  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const file = files.indexOf(square[0]); // 0-7 (a=0, h=7)
  const rank = parseInt(square[1]) - 1; // 0-7 (1=0, 8=7)
  
  let newFile: number, newRank: number;
  
  switch (rotation) {
    case 90:
      // 90° clockwise: (file, rank) -> (7-rank, file)
      newFile = 7 - rank;
      newRank = file;
      break;
    case 180:
      // 180°: (file, rank) -> (7-file, 7-rank)
      newFile = 7 - file;
      newRank = 7 - rank;
      break;
    case 270:
      // 270° clockwise (90° counter-clockwise): (file, rank) -> (rank, 7-file)
      newFile = rank;
      newRank = 7 - file;
      break;
    default:
      // 0° - no change
      return square;
  }
  
  return files[newFile] + (newRank + 1);
};

// Transform a move (e.g., "e2e4") based on rotation
const transformMove = (move: string, rotation: number): string => {
  if (!move || move.length < 4) return move;
  const from = move.substring(0, 2);
  const to = move.substring(2, 4);
  const promotion = move.substring(4); // e.g., "q" for pawn promotion
  return transformSquare(from, rotation) + transformSquare(to, rotation) + promotion;
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

export default function BoardSpin() {
  const [, navigate] = useLocation();
  const { toast } = useNotifications();
  const [phase, setPhase] = useState<GamePhase>('select');
  const [difficulty, setDifficulty] = useState<string>('patzer');
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
  const [optimalMoves, setOptimalMoves] = useState<OptimalMove[]>([]);
  const [bestMove, setBestMove] = useState<string | null>(null);
  const [playerMove, setPlayerMove] = useState<string>('');
  const [bonusResult, setBonusResult] = useState<boolean | null>(null);
  const [isAlternativeOptimal, setIsAlternativeOptimal] = useState<boolean>(false);
  const [finalRotation, setFinalRotation] = useState(0);
  const [scoreSaved, setScoreSaved] = useState(false);
  const [timeSpent, setTimeSpent] = useState(0);
  const [bonusSelectedSquare, setBonusSelectedSquare] = useState<{rank: number; file: number} | null>(null);
  const [bonusBoard, setBonusBoard] = useState<(string | null)[][]>(
    Array(8).fill(null).map(() => Array(8).fill(null))
  );
  const [validBonusMoves, setValidBonusMoves] = useState<string[]>([]);
  const [showingAnswer, setShowingAnswer] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const recreationStartTime = useRef<number>(0);

  interface PersonalBest {
    id: string;
    score: number;
    accuracy: number;
    pieceCount: number;
    bonusEarned: boolean;
    createdAt: string;
  }

  const { data: personalBest, refetch: refetchPersonalBest } = useQuery<PersonalBest | null>({
    queryKey: [`/api/boardspin/my-highscore?difficulty=${difficulty}`],
    enabled: phase === 'select' || phase === 'results',
  });

  const difficulties = [
    { value: 'patzer', label: 'Patzer (3-4 pieces)', multiplier: '1.0x' },
    { value: 'novice', label: 'Novice (5-7 pieces)', multiplier: '1.5x' },
    { value: 'intermediate', label: 'Intermediate (8-11 pieces)', multiplier: '2.0x' },
    { value: 'clubplayer', label: 'Club Player (12-14 pieces)', multiplier: '2.5x' },
    { value: 'expert', label: 'Expert (15-17 pieces)', multiplier: '3.0x' },
    { value: 'master', label: 'Master (18-20 pieces)', multiplier: '4.0x' },
    { value: 'grandmaster', label: 'Grandmaster (21-25 pieces)', multiplier: '5.0x' },
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
          recreationStartTime.current = Date.now();
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

  const saveScore = async (finalScore: number, finalAccuracy: number, bonusEarned: boolean) => {
    if (!position || scoreSaved) return;
    
    const elapsed = Math.round((Date.now() - recreationStartTime.current) / 1000);
    setTimeSpent(elapsed);
    
    try {
      await apiRequest('POST', '/api/boardspin/scores', {
        difficulty: position.difficulty,
        score: finalScore,
        accuracy: finalAccuracy,
        pieceCount: position.pieceCount,
        rotation: position.rotation,
        bonusEarned,
        timeSpent: elapsed,
      });
      setScoreSaved(true);
      refetchPersonalBest();
    } catch (error: any) {
      // Silently ignore auth errors - users can play without login, scores just won't be saved
      if (error?.message?.includes('401')) {
        console.log('Score not saved - user not logged in');
      } else {
        console.error('Failed to save score:', error);
      }
    }
  };

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
      
      if (result.accuracy === 100) {
        try {
          const optimalResult = await getOptimalMovesClient(position.fen);
          console.log(`[BoardSpin Client] Best move: ${optimalResult.bestMove}, Turn: ${optimalResult.turn}`);
          console.log(`[BoardSpin Client] Optimal moves: ${optimalResult.optimalMoves.map(m => m.move).join(', ')}`);
          console.log(`[BoardSpin Client] FEN turn: ${position.fen.split(' ')[1]}`);
          setOptimalMoves(optimalResult.optimalMoves);
          setBestMove(optimalResult.bestMove);
          // Initialize bonus board as a copy of the original position
          setBonusBoard(position.board.map(row => [...row]));
          setPhase('bonus');
        } catch (stockfishError) {
          console.error('[BoardSpin] Stockfish error, skipping bonus:', stockfishError);
          await saveScore(result.score, result.accuracy, false);
          setPhase('results');
        }
      } else {
        await saveScore(result.score, result.accuracy, false);
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
    if (!bestMove || optimalMoves.length === 0) return;
    
    const normalizedPlayerMove = playerMove.toLowerCase().replace(/[^a-h1-8]/g, '');
    
    // Check if player's move matches ANY of the optimal moves
    const matchedOptimalMove = optimalMoves.find(
      om => om.move.toLowerCase().replace(/[^a-h1-8]/g, '') === normalizedPlayerMove
    );
    
    const isCorrect = matchedOptimalMove !== undefined;
    const isAlternative = isCorrect && normalizedPlayerMove !== bestMove.toLowerCase().replace(/[^a-h1-8]/g, '');
    
    setBonusResult(isCorrect);
    setIsAlternativeOptimal(isAlternative);
    
    const finalScore = isCorrect ? score * 2 : score;
    if (isCorrect) {
      setScore(finalScore);
    }
    
    // Save score with bonus status
    await saveScore(finalScore, accuracy, isCorrect);
    setPhase('results');
  };
  
  const skipBonus = async () => {
    // Save score without bonus
    await saveScore(score, accuracy, false);
    setPhase('results');
  };

  const handleSquareClick = (rank: number, file: number) => {
    if (phase !== 'recreate') return;
    
    if (selectedPiece) {
      // Check for pawn constraints before placing
      const isPawn = selectedPiece === 'P' || selectedPiece === 'p';
      if (isPawn) {
        const isWhitePawn = selectedPiece === 'P';
        if (wouldPawnCreateCrossing(playerBoard, file, rank, isWhitePawn)) {
          toast({
            title: "Invalid placement",
            description: "Pawns cannot be placed where they would have had to pass through an opposing pawn",
            variant: "destructive",
          });
          return;
        }
        if (wouldPawnCreateInvalidDoubling(playerBoard, file, rank, isWhitePawn)) {
          toast({
            title: "Invalid placement",
            description: "Doubled pawns require an empty adjacent file (for the capture path)",
            variant: "destructive",
          });
          return;
        }
      }
      
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

  const handleBonusSquareClick = (rank: number, file: number) => {
    if (phase !== 'bonus' || !position) return;
    
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    // Board convention: board[0] = rank 1, board[7] = rank 8
    // So chess rank = boardRank + 1
    const piece = bonusBoard[rank][file];
    const whiteToMove = position.fen.split(' ')[1] === 'w';
    const clickedSquare = files[file] + (rank + 1);
    
    if (bonusSelectedSquare) {
      // Check if clicking the same square (deselect)
      if (bonusSelectedSquare.rank === rank && bonusSelectedSquare.file === file) {
        setBonusSelectedSquare(null);
        setValidBonusMoves([]);
        return;
      }
      
      // Check if this is a valid move destination
      const fromSquare = files[bonusSelectedSquare.file] + (bonusSelectedSquare.rank + 1);
      const toSquare = clickedSquare;
      
      // Check if valid move
      if (validBonusMoves.includes(toSquare)) {
        const move = fromSquare + toSquare;
        
        // Update the bonus board visually - move the piece
        const newBoard = bonusBoard.map(row => [...row]);
        const movingPiece = newBoard[bonusSelectedSquare.rank][bonusSelectedSquare.file];
        newBoard[bonusSelectedSquare.rank][bonusSelectedSquare.file] = null;
        newBoard[rank][file] = movingPiece;
        setBonusBoard(newBoard);
        
        setPlayerMove(move);
        setBonusSelectedSquare(null);
        setValidBonusMoves([]);
      } else if (piece) {
        // Clicked on another piece - try to select it instead
        const isWhitePiece = piece === piece.toUpperCase();
        if ((whiteToMove && isWhitePiece) || (!whiteToMove && !isWhitePiece)) {
          selectBonusPiece(rank, file);
        }
      } else {
        // Invalid destination - deselect
        setBonusSelectedSquare(null);
        setValidBonusMoves([]);
      }
    } else if (piece) {
      // First click - select a piece (must be correct color)
      const isWhitePiece = piece === piece.toUpperCase();
      if ((whiteToMove && isWhitePiece) || (!whiteToMove && !isWhitePiece)) {
        selectBonusPiece(rank, file);
      }
    }
  };
  
  const selectBonusPiece = (rank: number, file: number) => {
    if (!position) return;
    
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const fromSquare = files[file] + (rank + 1);
    
    // Use chess.js to compute legal moves from this square
    try {
      const chess = new Chess(position.fen);
      const moves = chess.moves({ square: fromSquare as any, verbose: true });
      const validDestinations = moves.map(m => m.to);
      
      setBonusSelectedSquare({ rank, file });
      setValidBonusMoves(validDestinations);
    } catch (e) {
      console.warn('[BoardSpin] Could not compute legal moves:', e);
      setBonusSelectedSquare({ rank, file });
      setValidBonusMoves([]);
    }
  };
  
  const resetBonusBoard = () => {
    if (position) {
      setBonusBoard(position.board.map(row => [...row]));
      setPlayerMove('');
      setBonusSelectedSquare(null);
      setValidBonusMoves([]);
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
    setOptimalMoves([]);
    setBestMove(null);
    setPlayerMove('');
    setBonusResult(null);
    setIsAlternativeOptimal(false);
    setFinalRotation(0);
    setScoreSaved(false);
    setTimeSpent(0);
    setBonusSelectedSquare(null);
    setBonusBoard(Array(8).fill(null).map(() => Array(8).fill(null)));
    setValidBonusMoves([]);
    setShowingAnswer(false);
    recreationStartTime.current = 0;
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

  // Compute heatmap data comparing player's board to original
  // Returns a 2D array where each cell is: 'correct' | 'wrong' | 'missed' | 'extra' | null
  const computeHeatmap = (originalBoard: (string | null)[][], playerBoard: (string | null)[][]): (string | null)[][] => {
    const heatmap: (string | null)[][] = Array(8).fill(null).map(() => Array(8).fill(null));
    
    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const original = originalBoard[rank][file];
        const player = playerBoard[rank][file];
        
        if (original) {
          // There should be a piece here
          if (player === original) {
            heatmap[rank][file] = 'correct'; // Green - correct piece
          } else if (player) {
            heatmap[rank][file] = 'wrong'; // Red - wrong piece placed
          } else {
            heatmap[rank][file] = 'missed'; // Yellow - piece was missed
          }
        } else {
          // This square should be empty
          if (player) {
            heatmap[rank][file] = 'extra'; // Red - extra piece placed wrongly
          }
          // If both empty, leave as null (no highlight)
        }
      }
    }
    
    return heatmap;
  };

  const renderBoard = (board: (string | null)[][], rotation: number = 0, interactive: boolean = false, bonusMode: boolean = false, heatmap?: (string | null)[][], hidePieces: boolean = false) => {
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];
    const whiteToMove = position?.fen.split(' ')[1] === 'w';
    
    return (
      <motion.div 
        className="relative aspect-square w-full max-w-[400px]"
        style={{ 
          transformOrigin: 'center center',
        }}
        initial={{ rotate: rotation }}
        animate={{ rotate: rotation }}
        transition={{ duration: 0 }}
      >
        <div className="grid grid-cols-8 gap-0 border-2 border-border rounded-md overflow-hidden">
          {ranks.map((rank, rankIdx) => (
            files.map((file, fileIdx) => {
              const isLight = (rankIdx + fileIdx) % 2 === 0;
              // Board array: board[0] = rank 1, board[7] = rank 8
              // Visual: rankIdx 0 = rank 8 (top), rankIdx 7 = rank 1 (bottom)
              // So we need to flip: actualRank = 7 - rankIdx
              const actualRank = 7 - rankIdx;
              const piece = board[actualRank][fileIdx];
              const isA1 = file === 'a' && rank === '1';
              const isH8 = file === 'h' && rank === '8';
              const isBonusSelected = bonusMode && bonusSelectedSquare?.rank === actualRank && bonusSelectedSquare?.file === fileIdx;
              const squareNotation = file + (actualRank + 1);
              const isValidMoveTarget = bonusMode && validBonusMoves.includes(squareNotation);
              const isClickablePiece = bonusMode && piece && !bonusSelectedSquare && (
                (whiteToMove && piece === piece.toUpperCase()) || 
                (!whiteToMove && piece !== piece.toUpperCase())
              );
              
              // Heatmap coloring
              const heatmapValue = heatmap?.[actualRank]?.[fileIdx];
              const heatmapBg = heatmapValue === 'correct' 
                ? 'bg-green-400 dark:bg-green-600' 
                : heatmapValue === 'wrong' || heatmapValue === 'extra'
                ? 'bg-red-400 dark:bg-red-600'
                : heatmapValue === 'missed'
                ? 'bg-amber-400 dark:bg-amber-500'
                : '';
              
              // Get the correct piece for ghost icon (for missed/wrong squares)
              const correctPiece = position?.board?.[actualRank]?.[fileIdx];
              const showGhost = heatmap && (heatmapValue === 'missed' || heatmapValue === 'wrong') && correctPiece;
              
              return (
                <div
                  key={`${file}${rank}`}
                  className={`aspect-square flex items-center justify-center cursor-pointer transition-colors relative
                    ${heatmapBg || (isLight ? 'bg-amber-100 dark:bg-amber-200' : 'bg-amber-700 dark:bg-amber-800')}
                    ${interactive ? 'hover:brightness-110' : ''}
                    ${interactive && selectedPiece ? 'hover:ring-2 hover:ring-primary' : ''}
                    ${bonusMode ? 'hover:brightness-110' : ''}
                    ${isBonusSelected ? 'ring-4 ring-green-500 ring-inset brightness-110' : ''}
                    ${isValidMoveTarget ? 'ring-4 ring-blue-400 ring-inset' : ''}
                    ${bonusMode && isClickablePiece && !isBonusSelected ? 'ring-2 ring-primary/50 ring-inset' : ''}
                  `}
                  onClick={() => {
                    if (interactive) handleSquareClick(actualRank, fileIdx);
                    if (bonusMode) handleBonusSquareClick(actualRank, fileIdx);
                  }}
                  data-testid={`square-${file}${rank}`}
                >
                  {/* Corner markers for a1 and h8 - counter-rotate to stay readable */}
                  {isA1 && (
                    <span 
                      className="absolute bottom-0.5 left-0.5 text-[10px] font-bold text-red-600 dark:text-red-500 bg-white/70 dark:bg-black/50 px-0.5 rounded" 
                      style={{ transform: `rotate(${-rotation}deg)` }}
                      data-testid="marker-a1"
                    >
                      a1
                    </span>
                  )}
                  {isH8 && (
                    <span 
                      className="absolute top-0.5 right-0.5 text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-white/70 dark:bg-black/50 px-0.5 rounded" 
                      style={{ transform: `rotate(${-rotation}deg)` }}
                      data-testid="marker-h8"
                    >
                      h8
                    </span>
                  )}
                  {/* Valid move indicator dot for empty squares */}
                  {isValidMoveTarget && !piece && (
                    <div 
                      className="w-4 h-4 rounded-full bg-blue-400/70"
                      style={{ transform: `rotate(${-rotation}deg)` }}
                    />
                  )}
                  {/* Ghost icon showing correct pieces - only visible when holding the "show answer" button */}
                  {hidePieces && correctPiece && (
                    <span 
                      className={`absolute text-xl sm:text-2xl md:text-3xl select-none pointer-events-none text-white opacity-90 ${
                        correctPiece === correctPiece.toUpperCase() 
                          ? 'drop-shadow-[0_0_2px_rgba(0,0,0,0.8)]' 
                          : 'drop-shadow-[0_0_3px_rgba(0,0,0,1)] [text-shadow:_0_0_2px_rgb(0_0_0),_0_0_4px_rgb(0_0_0)]'
                      }`}
                      style={{ transform: `rotate(${-rotation}deg)` }}
                      title={`Should be: ${correctPiece}`}
                    >
                      {PIECE_UNICODE[correctPiece]}
                    </span>
                  )}
                  {/* Pieces counter-rotate to stay upright (hidden when hidePieces is true) */}
                  {piece && !hidePieces && (
                    <span 
                      className={`text-2xl sm:text-3xl md:text-4xl select-none
                        ${piece === piece.toUpperCase() ? 'text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]' : 'text-gray-900 drop-shadow-[0_1px_2px_rgba(255,255,255,0.5)]'}
                      `}
                      style={{ transform: `rotate(${-rotation}deg)` }}
                    >
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
      <Helmet>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
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
        <div className="grid md:grid-cols-2 gap-4">
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
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="w-5 h-5" />
                Personal Best
              </CardTitle>
            </CardHeader>
            <CardContent>
              {personalBest ? (
                <div className="space-y-4" data-testid="personal-best">
                  <div className="text-center">
                    <div className="text-4xl font-bold text-primary" data-testid="personal-best-score">
                      {personalBest.score}
                    </div>
                    <p className="text-sm text-muted-foreground">points</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="p-2 rounded-lg bg-muted/50">
                      <div className="text-lg font-semibold" data-testid="personal-best-accuracy">
                        {Math.round(personalBest.accuracy)}%
                      </div>
                      <p className="text-xs text-muted-foreground">Accuracy</p>
                    </div>
                    <div className="p-2 rounded-lg bg-muted/50">
                      <div className="text-lg font-semibold">
                        {personalBest.pieceCount}
                      </div>
                      <p className="text-xs text-muted-foreground">Pieces</p>
                    </div>
                  </div>
                  
                  {personalBest.bonusEarned && (
                    <div className="flex items-center justify-center gap-2 text-yellow-500">
                      <Sparkles className="w-4 h-4" />
                      <span className="text-sm font-medium">Best Move Bonus Earned</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-4 space-y-2">
                  <Trophy className="w-12 h-12 mx-auto text-muted-foreground/30" />
                  <p className="text-muted-foreground">
                    No personal best yet for this difficulty.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Play a game to set your record!
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
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
              
              <div className="relative w-full max-w-[400px] aspect-square">
                {/* Spinning board (empty) */}
                <motion.div 
                  className="absolute inset-0"
                  style={{ 
                    transformOrigin: 'center center',
                  }}
                  animate={{ rotate: spinRotation }}
                  transition={{ duration: 0.05, ease: "linear" }}
                >
                  <div className="grid grid-cols-8 gap-0 border-2 border-border rounded-md overflow-hidden w-full h-full">
                    {Array(8).fill(null).map((_, rankIdx) => (
                      Array(8).fill(null).map((_, fileIdx) => {
                        const isLight = (rankIdx + fileIdx) % 2 === 0;
                        const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
                        const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];
                        const file = files[fileIdx];
                        const rank = ranks[rankIdx];
                        const isA1 = file === 'a' && rank === '1';
                        const isH8 = file === 'h' && rank === '8';
                        
                        return (
                          <div
                            key={`${file}${rank}`}
                            className={`aspect-square flex items-center justify-center relative
                              ${isLight ? 'bg-amber-100 dark:bg-amber-200' : 'bg-amber-700 dark:bg-amber-800'}
                            `}
                          >
                            {isA1 && (
                              <span 
                                className="absolute bottom-0.5 left-0.5 text-[10px] font-bold text-red-600 dark:text-red-500 bg-white/70 dark:bg-black/50 px-0.5 rounded" 
                                style={{ transform: `rotate(${-spinRotation}deg)` }}
                              >
                                a1
                              </span>
                            )}
                            {isH8 && (
                              <span 
                                className="absolute top-0.5 right-0.5 text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-white/70 dark:bg-black/50 px-0.5 rounded"
                                style={{ transform: `rotate(${-spinRotation}deg)` }}
                              >
                                h8
                              </span>
                            )}
                          </div>
                        );
                      })
                    ))}
                  </div>
                </motion.div>
                
                {/* Flying pieces - animate outward from board center */}
                <AnimatePresence>
                  {flyingPieces.map((fp) => {
                    // Calculate outward direction from center (50%, 50%)
                    const centerX = 50;
                    const centerY = 50;
                    const pieceX = fp.x + 6.25; // Center of square
                    const pieceY = fp.y + 6.25;
                    
                    // Direction vector from center
                    const dirX = pieceX - centerX;
                    const dirY = pieceY - centerY;
                    
                    // Normalize and scale for fly-off distance
                    const magnitude = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
                    const flyDistance = 150; // How far pieces fly off (in %)
                    const finalX = pieceX + (dirX / magnitude) * flyDistance;
                    const finalY = pieceY + (dirY / magnitude) * flyDistance;
                    
                    return (
                      <motion.div
                        key={fp.id}
                        className="absolute text-3xl sm:text-4xl pointer-events-none"
                        style={{
                          left: `${fp.x}%`,
                          top: `${fp.y}%`,
                          width: '12.5%',
                          height: '12.5%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        initial={{ 
                          left: `${fp.x}%`,
                          top: `${fp.y}%`,
                          opacity: 1,
                          scale: 1,
                          rotate: 0,
                        }}
                        animate={{ 
                          left: `${finalX}%`,
                          top: `${finalY}%`,
                          opacity: 0,
                          scale: 0.5,
                          rotate: spinRotation + (fp.id % 2 === 0 ? 180 : -180),
                        }}
                        transition={{ 
                          duration: 1.5,
                          ease: "easeOut",
                        }}
                      >
                        {PIECE_UNICODE[fp.piece]}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
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
              
              {/* Show whose turn it is */}
              <div className="flex items-center gap-2 text-lg font-medium">
                <span>Turn:</span>
                <Badge 
                  variant="outline" 
                  className={`text-base px-3 py-1 ${
                    position.fen.split(' ')[1] === 'w' 
                      ? 'bg-white text-black border-gray-400' 
                      : 'bg-gray-800 text-white border-gray-600'
                  }`}
                >
                  {position.fen.split(' ')[1] === 'w' ? 'White to move' : 'Black to move'}
                </Badge>
              </div>
              
              <p className="text-sm text-muted-foreground">
                Click a piece to select it, then click the destination square to move it. You can reset to try a different move.
              </p>
              
              {renderBoard(bonusBoard, 0, false, true)}
              
              <div className="flex items-center gap-2 w-full max-w-xs">
                <input
                  type="text"
                  placeholder="e.g., e2e4 or Nf3"
                  value={playerMove}
                  onChange={(e) => setPlayerMove(e.target.value)}
                  className="flex-1 px-3 py-2 border rounded-md bg-background"
                  data-testid="input-move"
                />
                <Button onClick={handleBonusSubmit} disabled={!playerMove} data-testid="button-bonus-submit">
                  Submit
                </Button>
              </div>
              
              <div className="flex gap-2">
                {playerMove && (
                  <Button variant="outline" onClick={resetBonusBoard} data-testid="button-reset-move">
                    <RotateCw className="w-4 h-4 mr-1" />
                    Reset Move
                  </Button>
                )}
                <Button variant="outline" onClick={skipBonus} data-testid="button-skip-bonus">
                  Skip Bonus
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Phase: Results */}
      {phase === 'results' && (
        <div className="space-y-4">
          {/* Board display with heatmap - toggle visibility between recreated and original */}
          <div className="flex justify-center">
            <div className="text-center relative w-full max-w-[400px]">
              <p className="text-sm font-medium mb-2 text-muted-foreground">
                {showingAnswer ? 'Correct Pieces (Ghost Icons)' : 'Your Recreation'}
              </p>
              {position && renderBoard(playerBoard, finalRotation, false, false, computeHeatmap(position.board, playerBoard), showingAnswer)}
            </div>
          </div>
          
          {/* Heatmap legend */}
          {accuracy < 100 && (
            <div className="flex flex-wrap justify-center gap-3 text-sm">
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded bg-green-400 dark:bg-green-600" />
                <span className="text-muted-foreground">Correct</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded bg-red-400 dark:bg-red-600" />
                <span className="text-muted-foreground">Wrong</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded bg-amber-400 dark:bg-amber-500" />
                <span className="text-muted-foreground">Missed</span>
              </div>
            </div>
          )}
          
          {/* Show Answer button for accuracy < 100% */}
          {accuracy < 100 && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                onMouseDown={() => setShowingAnswer(true)}
                onMouseUp={() => setShowingAnswer(false)}
                onMouseLeave={() => setShowingAnswer(false)}
                onTouchStart={() => setShowingAnswer(true)}
                onTouchEnd={() => setShowingAnswer(false)}
                data-testid="button-show-answer"
              >
                <Eye className="w-4 h-4 mr-2" />
                Hold to See Correct Pieces
              </Button>
            </div>
          )}
          
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
                    isAlternativeOptimal ? (
                      <p className="text-green-700 dark:text-green-300">
                        Correct! You found an equally optimal move. Score doubled!
                        {optimalMoves.length > 1 && (
                          <span className="block text-sm mt-1 opacity-80">
                            (Other optimal moves: {optimalMoves.map(m => m.move).join(', ')})
                          </span>
                        )}
                      </p>
                    ) : (
                      <p className="text-green-700 dark:text-green-300">
                        Correct! Best move was {bestMove}. Score doubled!
                      </p>
                    )
                  ) : (
                    <p className="text-red-700 dark:text-red-300">
                      {optimalMoves.length > 1 ? (
                        <>The optimal moves were {optimalMoves.map(m => m.move).join(', ')}. No bonus this time.</>
                      ) : (
                        <>The best move was {bestMove}. No bonus this time.</>
                      )}
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
                <Button 
                  variant="outline" 
                  size="lg" 
                  onClick={() => navigate('/')}
                  data-testid="button-main-menu"
                >
                  <Home className="w-4 h-4 mr-2" />
                  Main Menu
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
