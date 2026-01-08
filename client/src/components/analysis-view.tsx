import { useState, useEffect, useMemo, useRef, Fragment } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, X, Loader2, Copy, Download, Check } from "lucide-react";
import { Chess } from "chess.js";
import { clientStockfish } from "@/lib/stockfish";
import { useToast } from "@/hooks/use-toast";

interface AnalysisViewProps {
  moveHistory: string[];
  playerColor: "white" | "black";
  onClose: () => void;
  gameResult?: "white_win" | "black_win" | "draw" | null;
  botElo?: number;
}

interface PositionData {
  fen: string;
  lastMove: { from: string; to: string } | null;
}

interface AnalysisResult {
  eval: number;
  isMate: boolean;
  mateIn?: number;
  bestMove?: string;
}

interface EvaluationBarProps {
  evaluation: number | null;
  isLoading: boolean;
  isMate: boolean;
  mateIn?: number;
  playerColor: "white" | "black";
}

function EvaluationBar({ evaluation, isLoading, isMate, mateIn, playerColor }: EvaluationBarProps) {
  // Stockfish returns eval from White's perspective
  // Convert to player's perspective: negate for black
  const playerEval = evaluation !== null 
    ? (playerColor === "black" ? -evaluation : evaluation) 
    : null;
  
  // Calculate the fill percentage based on evaluation (always from White's perspective for bar fill)
  // Positive eval = white advantage, negative = black advantage
  // Clamp to ±10 pawns, then convert to percentage
  const evalToFillPercentage = (evalValue: number): number => {
    // For mate, pin to 0% or 100%
    if (isMate) {
      return evalValue > 0 ? 100 : 0; // 100% white, 0% black
    }
    // Clamp to ±10 pawns
    const clampedEval = Math.max(-10, Math.min(10, evalValue));
    // Convert to 0-100%: 0 eval = 50%, +10 = 100% (white wins), -10 = 0% (black wins)
    return 50 + (clampedEval / 10) * 50;
  };

  // Bar fill uses raw evaluation (White's perspective) for correct visual
  const whiteFillPercent = evaluation !== null ? evalToFillPercentage(evaluation) : 50;
  
  // Display uses player-relative evaluation
  const formatEval = (evalValue: number | null): string => {
    if (evalValue === null) return "...";
    if (isMate && mateIn !== undefined) {
      // Positive playerEval means player is winning, show M#
      // Negative playerEval means player is losing, show -M#
      return evalValue > 0 ? `M${mateIn}` : `-M${mateIn}`;
    }
    const sign = evalValue >= 0 ? "+" : "";
    return `${sign}${evalValue.toFixed(1)}`;
  };

  // When player is white: opponent (black) at top, player (white) at bottom
  // When player is black: opponent (white) at top, player (black) at bottom
  // The bar should show: top color fills DOWN when that side gains advantage
  
  // For white player: black on top, white on bottom
  // whiteFillPercent represents how much of the bar from bottom is white
  // So blackFillPercent = 100 - whiteFillPercent (fills from top)
  
  // For black player: white on top, black on bottom
  // We flip the perspective: blackFillPercent fills from bottom
  const isFlipped = playerColor === "black";
  
  // Top section color and bottom section color based on player perspective
  const topColor = isFlipped ? "bg-white" : "bg-stone-900";
  const bottomColor = isFlipped ? "bg-stone-900" : "bg-white";
  
  // The fill from top: when player is white, black fills from top (100 - whiteFill)
  // When player is black, white fills from top (whiteFill)
  const topFillPercent = isFlipped ? whiteFillPercent : (100 - whiteFillPercent);

  return (
    <div className="flex flex-col items-center w-full h-full" data-testid="evaluation-bar">
      <div className="text-xs font-mono font-bold mb-1 flex-shrink-0" data-testid="evaluation-value">
        {formatEval(playerEval)}
      </div>
      <div className={`relative w-full rounded overflow-hidden border border-border ${bottomColor} flex-1 min-h-0`}>
        {/* Top section fills down based on advantage */}
        <div 
          className={`absolute top-0 left-0 right-0 ${topColor} transition-all duration-300`}
          style={{ height: `${topFillPercent}%` }}
        />
        {/* Center line at 50% (equal position) */}
        <div 
          className="absolute left-0 right-0 h-[2px] bg-amber-500"
          style={{ top: '50%', transform: 'translateY(-50%)' }}
        />
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <Loader2 className="h-3 w-3 animate-spin text-white" />
          </div>
        )}
      </div>
    </div>
  );
}

function ChessBoard({ 
  position, 
  flipped,
  lastMove,
  bestMoveSquares
}: { 
  position: string; 
  flipped: boolean;
  lastMove?: { from: string; to: string } | null;
  bestMoveSquares?: { from: string; to: string } | null;
}) {
  const game = new Chess(position);
  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];
  
  const displayFiles = flipped ? [...files].reverse() : files;
  const displayRanks = flipped ? [...ranks].reverse() : ranks;
  
  const pieceSymbols: Record<string, string> = {
    'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙',
    'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟'
  };

  return (
    <div className="aspect-square w-full" data-testid="analysis-board">
      <div className="grid grid-cols-8 grid-rows-8 w-full h-full border border-stone-400">
        {displayRanks.map(rank =>
          displayFiles.map(file => {
            const square = `${file}${rank}`;
            const piece = game.get(square as any);
            const isLight = (files.indexOf(file) + ranks.indexOf(rank)) % 2 === 0;
            const isHighlighted = lastMove && (lastMove.from === square || lastMove.to === square);
            const isBestMoveSquare = bestMoveSquares && (bestMoveSquares.from === square || bestMoveSquares.to === square);
            
            return (
              <div
                key={square}
                className={`aspect-square flex items-center justify-center text-2xl sm:text-3xl
                  ${isLight ? 'bg-amber-100 dark:bg-amber-200' : 'bg-amber-600 dark:bg-amber-700'}
                  ${isHighlighted ? 'ring-2 ring-inset ring-amber-400' : ''}
                  ${isBestMoveSquare ? 'ring-2 ring-inset ring-emerald-500' : ''}
                `}
                data-testid={`analysis-square-${square}`}
              >
                {piece && (
                  <span className={piece.color === 'w' ? 'text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]' : 'text-black'}>
                    {pieceSymbols[piece.color === 'w' ? piece.type.toUpperCase() : piece.type]}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export function AnalysisView({ moveHistory, playerColor, onClose, gameResult, botElo }: AnalysisViewProps) {
  const { toast } = useToast();
  const [currentMoveIndex, setCurrentMoveIndex] = useState(0);
  const [showBestMove, setShowBestMove] = useState(true);
  const [copiedPGN, setCopiedPGN] = useState(false);
  
  // Pre-analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(true);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisResults, setAnalysisResults] = useState<Map<number, AnalysisResult>>(new Map());
  
  const analysisAbortRef = useRef(false);

  // Auto-scroll to current move
  useEffect(() => {
    const activeMoveElement = document.getElementById(`move-${currentMoveIndex}`);
    if (activeMoveElement) {
      activeMoveElement.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [currentMoveIndex]);

  // Generate PGN with Seven Tag Roster
  const generatePGN = useMemo(() => {
    const pgnChess = new Chess();
    
    const resultString = gameResult === "white_win" ? "1-0" 
      : gameResult === "black_win" ? "0-1" 
      : gameResult === "draw" ? "1/2-1/2" 
      : "*";
    
    const now = new Date();
    const dateStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;
    
    pgnChess.header(
      'Event', 'Blindfold Chess Challenge',
      'Site', 'Mobile App',
      'Date', dateStr,
      'Round', '?',
      'White', playerColor === 'white' ? 'User' : `Stockfish (Elo ${botElo || '?'})`,
      'Black', playerColor === 'black' ? 'User' : `Stockfish (Elo ${botElo || '?'})`,
      'Result', resultString
    );
    
    moveHistory.forEach(move => {
      try {
        pgnChess.move(move);
      } catch (e) {
        console.warn('[PGN] Could not add move:', move);
      }
    });
    
    return pgnChess.pgn();
  }, [moveHistory, playerColor, gameResult, botElo]);

  const copyPGN = async () => {
    try {
      // Try modern clipboard API first
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(generatePGN);
      } else {
        // Fallback for older browsers/Android WebView
        const textArea = document.createElement("textarea");
        textArea.value = generatePGN;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      setCopiedPGN(true);
      toast({
        title: "PGN Copied",
        description: "Game notation copied to clipboard",
        duration: 2000,
      });
      setTimeout(() => setCopiedPGN(false), 2000);
    } catch (error) {
      console.error('[PGN] Copy failed:', error);
      toast({
        title: "Copy Failed",
        description: "Could not copy to clipboard",
        variant: "destructive",
        duration: 2000,
      });
    }
  };

  const downloadPGN = () => {
    const now = new Date();
    const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    const filename = `blindfold-game-${timestamp}.pgn.txt`;
    
    const element = document.createElement("a");
    const file = new Blob([generatePGN], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    URL.revokeObjectURL(element.href);
    
    toast({
      title: "PGN Downloaded",
      description: filename,
      duration: 2000,
    });
  };

  // Pre-compute all position FENs and lastMoves on mount (O(n) once, then O(1) lookup)
  const positionData = useMemo<PositionData[]>(() => {
    const data: PositionData[] = [];
    const game = new Chess();
    
    // Position 0: starting position
    data.push({ fen: game.fen(), lastMove: null });
    
    // Build each position by replaying moves
    for (let i = 0; i < moveHistory.length; i++) {
      try {
        const move = game.move(moveHistory[i]);
        if (move) {
          data.push({
            fen: game.fen(),
            lastMove: { from: move.from, to: move.to }
          });
        } else {
          console.warn(`[Analysis] Move returned null at index ${i}: ${moveHistory[i]}`);
          // Continue processing remaining moves
        }
      } catch (error) {
        console.warn(`[Analysis] Skipping invalid move at index ${i}: ${moveHistory[i]}`, error);
        // Continue processing remaining moves - don't break the loop
      }
    }
    
    console.log(`[Analysis] Built ${data.length} positions from ${moveHistory.length} moves`);
    
    return data;
  }, [moveHistory]);

  // Run pre-analysis on mount
  useEffect(() => {
    const runPreAnalysis = async () => {
      setIsAnalyzing(true);
      setAnalysisProgress(0);
      analysisAbortRef.current = false;
      
      const results = new Map<number, AnalysisResult>();
      const totalPositions = positionData.length;
      
      for (let i = 0; i < totalPositions; i++) {
        if (analysisAbortRef.current) break;
        
        const { fen } = positionData[i];
        
        try {
          const result = await clientStockfish.analyzePosition(fen, 500000);
          
          // Check abort flag after async operation
          if (analysisAbortRef.current) break;
          
          // Normalize to White's perspective
          const sideToMove = fen.split(' ')[1];
          const isBlackToMove = sideToMove === 'b';
          const whiteEval = isBlackToMove ? -result.evaluation : result.evaluation;
          const normalizedMateIn = result.mateIn !== undefined && isBlackToMove 
            ? -result.mateIn 
            : result.mateIn;
          
          results.set(i, {
            eval: whiteEval,
            isMate: result.isMate,
            mateIn: normalizedMateIn !== undefined ? Math.abs(normalizedMateIn) : undefined,
            bestMove: result.bestMove
          });
        } catch (error) {
          // Check abort flag after async operation (even on error)
          if (analysisAbortRef.current) break;
          console.error(`[Analysis] Error evaluating position ${i}:`, error);
          // Continue with remaining positions
        }
        
        // Only update state if not aborted
        if (!analysisAbortRef.current) {
          setAnalysisProgress(Math.round(((i + 1) / totalPositions) * 100));
          setAnalysisResults(new Map(results));
        }
        
        // Yield to UI thread to prevent browser/Android ANR (App Not Responding)
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      // Only update final state if not aborted
      if (!analysisAbortRef.current) {
        setIsAnalyzing(false);
      }
    };
    
    runPreAnalysis();
    
    return () => {
      analysisAbortRef.current = true;
    };
  }, [positionData]);

  // Current position data (O(1) lookup)
  const currentPosition = positionData[currentMoveIndex] || positionData[0];
  const currentFen = currentPosition.fen;
  const lastMove = currentPosition.lastMove;
  
  // Current analysis (O(1) lookup)
  const currentAnalysis = analysisResults.get(currentMoveIndex);
  const evaluation = currentAnalysis?.eval ?? null;
  const isMate = currentAnalysis?.isMate ?? false;
  const mateIn = currentAnalysis?.mateIn;
  const bestMove = currentAnalysis?.bestMove ?? null;

  const goToStart = () => setCurrentMoveIndex(0);
  const goBack = () => setCurrentMoveIndex(Math.max(0, currentMoveIndex - 1));
  const goForward = () => setCurrentMoveIndex(Math.min(positionData.length - 1, currentMoveIndex + 1));
  const goToEnd = () => setCurrentMoveIndex(positionData.length - 1);
  const goToMove = (index: number) => setCurrentMoveIndex(Math.min(index, positionData.length - 1));

  const formatMoveList = (): { moveNumber: number; white: string; black?: string; whiteIndex: number; blackIndex?: number }[] => {
    const moves: { moveNumber: number; white: string; black?: string; whiteIndex: number; blackIndex?: number }[] = [];
    for (let i = 0; i < moveHistory.length; i += 2) {
      moves.push({
        moveNumber: Math.floor(i / 2) + 1,
        white: moveHistory[i],
        black: moveHistory[i + 1],
        whiteIndex: i + 1,
        blackIndex: moveHistory[i + 1] ? i + 2 : undefined
      });
    }
    return moves;
  };

  const moveList = formatMoveList();

  // Convert UCI move (e.g., "e2e4") to from/to squares
  const parseBestMove = (uciMove: string | null): { from: string; to: string } | null => {
    if (!uciMove || uciMove.length < 4) return null;
    return {
      from: uciMove.slice(0, 2),
      to: uciMove.slice(2, 4)
    };
  };

  // Format best move for display (convert UCI to SAN if possible)
  const formatBestMove = (uciMove: string | null): string | null => {
    if (!uciMove) return null;
    try {
      const game = new Chess(currentFen);
      const move = game.move({
        from: uciMove.slice(0, 2),
        to: uciMove.slice(2, 4),
        promotion: uciMove.length > 4 ? uciMove[4] as 'q' | 'r' | 'b' | 'n' : undefined
      });
      return move ? move.san : uciMove;
    } catch {
      return uciMove;
    }
  };

  const bestMoveSquares = showBestMove ? parseBestMove(bestMove) : null;
  const formattedBestMove = formatBestMove(bestMove);

  // Show loading overlay during pre-analysis
  if (isAnalyzing && analysisProgress < 100) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col" data-testid="analysis-view">
        <div className="flex items-center justify-between p-3 border-b border-border">
          <h2 className="text-lg font-semibold">Game Analysis</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            data-testid="button-analysis-close"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        
        <div className="flex-1 flex flex-col items-center justify-center p-8 gap-6">
          <div className="flex items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
            <span className="text-lg font-medium">Analyzing game...</span>
          </div>
          
          <div className="w-full max-w-xs space-y-2">
            <Progress value={analysisProgress} className="h-3" />
            <p className="text-center text-sm text-muted-foreground">
              {analysisProgress}% complete ({Math.round((analysisProgress / 100) * positionData.length)} / {positionData.length} positions)
            </p>
          </div>
          
          <p className="text-sm text-muted-foreground text-center max-w-sm">
            This will take a few seconds. Once complete, you can navigate through moves instantly.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col" data-testid="analysis-view">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <h2 className="text-lg font-semibold">Game Analysis</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          data-testid="button-analysis-close"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div className="flex flex-col gap-3 items-center">
          {/* Board and eval bar row - use grid to sync heights. 24px bar + 8px gap + 320px board = 352px */}
          <div className="grid grid-cols-[24px_1fr] gap-2 w-full max-w-[352px]">
            <EvaluationBar 
              evaluation={evaluation} 
              isLoading={false}
              isMate={isMate}
              mateIn={mateIn}
              playerColor={playerColor}
            />
            <ChessBoard 
              position={currentFen} 
              flipped={playerColor === "black"}
              lastMove={lastMove}
              bestMoveSquares={bestMoveSquares}
            />
          </div>
          
          {/* Navigation buttons below */}
          <div className="flex justify-center gap-1">
              <Button
                variant="outline"
                size="icon"
                onClick={goToStart}
                disabled={currentMoveIndex === 0}
                data-testid="button-analysis-start"
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={goBack}
                disabled={currentMoveIndex === 0}
                data-testid="button-analysis-back"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={goForward}
                disabled={currentMoveIndex === positionData.length - 1}
                data-testid="button-analysis-forward"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={goToEnd}
                disabled={currentMoveIndex === positionData.length - 1}
                data-testid="button-analysis-end"
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
          </div>

          {/* Best move display */}
          <div className="flex items-center justify-center gap-2 text-sm" data-testid="best-move-display">
            <Button
              variant={showBestMove ? "default" : "outline"}
              size="sm"
              onClick={() => setShowBestMove(!showBestMove)}
              className="h-7 px-2"
              data-testid="button-toggle-best-move"
            >
              {showBestMove ? "Hide Best" : "Show Best"}
            </Button>
            {showBestMove && formattedBestMove && (
              <span className="font-mono bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-2 py-1 rounded" data-testid="text-best-move">
                Best: {formattedBestMove}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between mt-4 mb-2">
          <span className="text-sm font-medium text-muted-foreground">Move List</span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={copyPGN}
              className="h-7 px-2"
              data-testid="button-copy-pgn"
            >
              {copiedPGN ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
              {copiedPGN ? "Copied" : "Copy"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={downloadPGN}
              className="h-7 px-2"
              data-testid="button-download-pgn"
            >
              <Download className="h-3 w-3 mr-1" />
              Download
            </Button>
          </div>
        </div>

        <Card className="p-3 max-h-40 overflow-y-auto scroll-smooth" data-testid="analysis-move-list">
          <div className="grid grid-cols-[auto_1fr_1fr] gap-x-3 gap-y-1 text-sm font-mono">
            {moveList.map((move) => (
              <Fragment key={move.moveNumber}>
                <span className="text-muted-foreground">
                  {move.moveNumber}.
                </span>
                <button
                  id={`move-${move.whiteIndex}`}
                  onClick={() => goToMove(move.whiteIndex)}
                  className={`text-left px-1 rounded hover:bg-muted transition-colors ${
                    currentMoveIndex === move.whiteIndex ? 'bg-amber-400 text-black font-bold' : ''
                  }`}
                  data-testid={`move-white-${move.moveNumber}`}
                >
                  {move.white}
                </button>
                {move.black ? (
                  <button
                    id={`move-${move.blackIndex}`}
                    onClick={() => goToMove(move.blackIndex!)}
                    className={`text-left px-1 rounded hover:bg-muted transition-colors ${
                      currentMoveIndex === move.blackIndex ? 'bg-amber-400 text-black font-bold' : ''
                    }`}
                    data-testid={`move-black-${move.moveNumber}`}
                  >
                    {move.black}
                  </button>
                ) : (
                  <span />
                )}
              </Fragment>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
