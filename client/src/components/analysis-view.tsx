import { useState, useEffect, useCallback, useRef, Fragment } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, X, Loader2 } from "lucide-react";
import { Chess } from "chess.js";
import { clientStockfish } from "@/lib/stockfish";

interface AnalysisViewProps {
  moveHistory: string[];
  playerColor: "white" | "black";
  onClose: () => void;
}

interface EvaluationBarProps {
  evaluation: number | null;
  isLoading: boolean;
  isMate: boolean;
  mateIn?: number;
  playerColor: "white" | "black";
}

function EvaluationBar({ evaluation, isLoading, isMate, mateIn, playerColor }: EvaluationBarProps) {
  // Calculate the fill percentage based on evaluation
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

  // This is the percentage of the bar that should be white (from bottom)
  const whiteFillPercent = evaluation !== null ? evalToFillPercentage(evaluation) : 50;
  
  const formatEval = (evalValue: number | null): string => {
    if (evalValue === null) return "...";
    if (isMate && mateIn !== undefined) {
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
    <div className="flex flex-col items-center w-6 h-full" data-testid="evaluation-bar">
      <div className="text-xs font-mono font-bold mb-1 flex-shrink-0" data-testid="evaluation-value">
        {formatEval(evaluation)}
      </div>
      <div className={`relative w-full rounded overflow-hidden border border-border ${bottomColor} flex-1`}>
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
  lastMove 
}: { 
  position: string; 
  flipped: boolean;
  lastMove?: { from: string; to: string } | null;
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
    <div className="aspect-square w-full max-w-[300px]" data-testid="analysis-board">
      <div className="grid grid-cols-8 gap-0 border border-border rounded overflow-hidden">
        {displayRanks.map((rank, rankIdx) =>
          displayFiles.map((file, fileIdx) => {
            const square = `${file}${rank}`;
            const piece = game.get(square as any);
            const isLight = (rankIdx + fileIdx) % 2 === 0;
            const isHighlighted = lastMove && (lastMove.from === square || lastMove.to === square);
            
            return (
              <div
                key={square}
                className={`aspect-square flex items-center justify-center text-2xl sm:text-3xl
                  ${isLight ? 'bg-amber-100 dark:bg-amber-200' : 'bg-amber-600 dark:bg-amber-700'}
                  ${isHighlighted ? 'ring-2 ring-inset ring-amber-400' : ''}
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

export function AnalysisView({ moveHistory, playerColor, onClose }: AnalysisViewProps) {
  const [currentMoveIndex, setCurrentMoveIndex] = useState(0);
  const [evaluation, setEvaluation] = useState<number | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isMate, setIsMate] = useState(false);
  const [mateIn, setMateIn] = useState<number | undefined>(undefined);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  
  const evalCacheRef = useRef<Map<string, { eval: number; isMate: boolean; mateIn?: number }>>(new Map());
  const gameRef = useRef(new Chess());

  const getPositionAtMove = useCallback((moveIndex: number): string => {
    const game = new Chess();
    for (let i = 0; i < moveIndex && i < moveHistory.length; i++) {
      game.move(moveHistory[i]);
    }
    return game.fen();
  }, [moveHistory]);

  const getLastMoveAtIndex = useCallback((moveIndex: number): { from: string; to: string } | null => {
    if (moveIndex <= 0) return null;
    const game = new Chess();
    let lastMoveInfo: { from: string; to: string } | null = null;
    for (let i = 0; i < moveIndex && i < moveHistory.length; i++) {
      const move = game.move(moveHistory[i]);
      if (move) {
        lastMoveInfo = { from: move.from, to: move.to };
      }
    }
    return lastMoveInfo;
  }, [moveHistory]);

  const currentFen = getPositionAtMove(currentMoveIndex);

  useEffect(() => {
    setLastMove(getLastMoveAtIndex(currentMoveIndex));
  }, [currentMoveIndex, getLastMoveAtIndex]);

  useEffect(() => {
    const evaluatePosition = async () => {
      const cached = evalCacheRef.current.get(currentFen);
      if (cached) {
        setEvaluation(cached.eval);
        setIsMate(cached.isMate);
        setMateIn(cached.mateIn);
        return;
      }

      setIsEvaluating(true);
      try {
        const result = await clientStockfish.analyzePosition(currentFen, 500000);
        const evalResult = {
          eval: result.evaluation,
          isMate: result.isMate,
          mateIn: result.mateIn
        };
        evalCacheRef.current.set(currentFen, evalResult);
        setEvaluation(result.evaluation);
        setIsMate(result.isMate);
        setMateIn(result.mateIn);
      } catch (error) {
        console.error('[Analysis] Evaluation error:', error);
        setEvaluation(null);
      } finally {
        setIsEvaluating(false);
      }
    };

    evaluatePosition();
  }, [currentFen]);

  const goToStart = () => setCurrentMoveIndex(0);
  const goBack = () => setCurrentMoveIndex(Math.max(0, currentMoveIndex - 1));
  const goForward = () => setCurrentMoveIndex(Math.min(moveHistory.length, currentMoveIndex + 1));
  const goToEnd = () => setCurrentMoveIndex(moveHistory.length);
  const goToMove = (index: number) => setCurrentMoveIndex(index);

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
          {/* Board and eval bar row */}
          <div className="flex gap-2 items-end">
            <div className="h-[300px] max-h-[80vw]">
              <EvaluationBar 
                evaluation={evaluation} 
                isLoading={isEvaluating}
                isMate={isMate}
                mateIn={mateIn}
                playerColor={playerColor}
              />
            </div>
            <ChessBoard 
              position={currentFen} 
              flipped={playerColor === "black"}
              lastMove={lastMove}
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
                disabled={currentMoveIndex === moveHistory.length}
                data-testid="button-analysis-forward"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={goToEnd}
                disabled={currentMoveIndex === moveHistory.length}
                data-testid="button-analysis-end"
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
          </div>
        </div>

        <Card className="mt-4 p-3 max-h-40 overflow-y-auto" data-testid="analysis-move-list">
          <div className="grid grid-cols-[auto_1fr_1fr] gap-x-3 gap-y-1 text-sm font-mono">
            {moveList.map((move) => (
              <Fragment key={move.moveNumber}>
                <span className="text-muted-foreground">
                  {move.moveNumber}.
                </span>
                <button
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
