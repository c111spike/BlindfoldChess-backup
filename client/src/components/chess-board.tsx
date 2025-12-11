import { useState, useRef, useCallback, useEffect } from "react";
import { Card } from "@/components/ui/card";

interface Arrow {
  from: string;
  to: string;
  color?: string;
}

interface Premove {
  from: string;
  to: string;
}

interface ChessBoardProps {
  fen?: string;
  orientation?: "white" | "black";
  showCoordinates?: boolean;
  highlightedSquares?: string[];
  legalMoveSquares?: string[];
  lastMoveSquares?: string[];
  lastMove?: { from: string; to: string };
  selectedSquare?: string | null;
  lockedPiece?: string | null;
  onSquareClick?: (square: string) => void;
  onMove?: (from: string, to: string) => boolean;
  interactionMode?: "free" | "viewOnly";
  className?: string;
  noCard?: boolean;
  enableArrows?: boolean;
  enablePremoves?: boolean;
  isPlayerTurn?: boolean;
  premove?: Premove | null;
  onPremove?: (premove: Premove | null) => void;
  arrowDrawMode?: boolean;
  highlightColor?: "yellow" | "red";
}

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"];

const PIECE_SYMBOLS: Record<string, string> = {
  K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘", P: "♙",
  k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟",
};

export function ChessBoard({
  fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  orientation = "white",
  showCoordinates = true,
  highlightedSquares = [],
  legalMoveSquares = [],
  lastMoveSquares = [],
  lastMove,
  selectedSquare: externalSelectedSquare = null,
  lockedPiece = null,
  onSquareClick,
  onMove,
  interactionMode = "free",
  className = "",
  noCard = false,
  enableArrows = true,
  enablePremoves = false,
  isPlayerTurn = true,
  premove = null,
  onPremove,
  arrowDrawMode = false,
  highlightColor = "yellow",
}: ChessBoardProps) {
  const [internalSelectedSquare, setInternalSelectedSquare] = useState<string | null>(null);
  const selectedSquare = externalSelectedSquare !== null ? externalSelectedSquare : internalSelectedSquare;
  
  const [arrows, setArrows] = useState<Arrow[]>([]);
  const [drawingArrow, setDrawingArrow] = useState<{ from: string; currentSquare: string } | null>(null);
  const [isRightMouseDown, setIsRightMouseDown] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);
  
  const effectiveLastMoveSquares = lastMove 
    ? [lastMove.from, lastMove.to] 
    : lastMoveSquares;

  useEffect(() => {
    setInternalSelectedSquare(null);
  }, [fen]);

  const parseFen = (fen: string) => {
    const rows = fen.split(" ")[0].split("/");
    const board: (string | null)[][] = [];

    for (const row of rows) {
      const boardRow: (string | null)[] = [];
      for (const char of row) {
        if (isNaN(parseInt(char))) {
          boardRow.push(char);
        } else {
          for (let i = 0; i < parseInt(char); i++) {
            boardRow.push(null);
          }
        }
      }
      board.push(boardRow);
    }

    return board;
  };

  const board = parseFen(fen);
  const displayRanks = orientation === "white" ? RANKS : [...RANKS].reverse();
  const displayFiles = orientation === "white" ? FILES : [...FILES].reverse();

  const getSquareFromPosition = useCallback((clientX: number, clientY: number): string | null => {
    if (!boardRef.current) return null;
    
    const rect = boardRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    const squareWidth = rect.width / 8;
    const squareHeight = rect.height / 8;
    
    const fileIndex = Math.floor(x / squareWidth);
    const rankIndex = Math.floor(y / squareHeight);
    
    if (fileIndex < 0 || fileIndex > 7 || rankIndex < 0 || rankIndex > 7) {
      return null;
    }
    
    const file = displayFiles[fileIndex];
    const rank = displayRanks[rankIndex];
    
    return `${file}${rank}`;
  }, [displayFiles, displayRanks]);

  const handleSquareClick = (file: string, rank: string, piece: string | null) => {
    const square = `${file}${rank}`;
    
    if (interactionMode === "viewOnly") {
      return;
    }
    
    if (piece) {
      setArrows([]);
    }
    
    if (onMove && internalSelectedSquare && internalSelectedSquare !== square) {
      const moveResult = onMove(internalSelectedSquare, square);
      setInternalSelectedSquare(null);
      if (moveResult) {
        return;
      }
    }
    
    if (piece) {
      setInternalSelectedSquare(square);
    } else if (internalSelectedSquare) {
      setInternalSelectedSquare(null);
    }
    
    if (externalSelectedSquare === null) {
      onSquareClick?.(square);
    }
  };

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!enableArrows) return;
    
    if (e.button === 2 || arrowDrawMode) {
      e.preventDefault();
      setIsRightMouseDown(true);
      const square = getSquareFromPosition(e.clientX, e.clientY);
      if (square) {
        setDrawingArrow({ from: square, currentSquare: square });
      }
    }
  }, [enableArrows, arrowDrawMode, getSquareFromPosition]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!drawingArrow || !isRightMouseDown) return;
    
    const square = getSquareFromPosition(e.clientX, e.clientY);
    if (square && square !== drawingArrow.currentSquare) {
      setDrawingArrow({ ...drawingArrow, currentSquare: square });
    }
  }, [drawingArrow, isRightMouseDown, getSquareFromPosition]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (!enableArrows) return;
    
    if ((e.button === 2 || arrowDrawMode) && drawingArrow && isRightMouseDown) {
      const toSquare = getSquareFromPosition(e.clientX, e.clientY);
      
      if (toSquare && toSquare !== drawingArrow.from) {
        const newArrow = { from: drawingArrow.from, to: toSquare };
        const existingIndex = arrows.findIndex(
          a => a.from === newArrow.from && a.to === newArrow.to
        );
        
        if (existingIndex >= 0) {
          setArrows(arrows.filter((_, i) => i !== existingIndex));
        } else {
          setArrows([...arrows, newArrow]);
        }
      }
      
      setDrawingArrow(null);
      setIsRightMouseDown(false);
    }
  }, [enableArrows, arrowDrawMode, drawingArrow, isRightMouseDown, arrows, getSquareFromPosition]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!enableArrows || !arrowDrawMode) return;
    
    const touch = e.touches[0];
    const square = getSquareFromPosition(touch.clientX, touch.clientY);
    if (square) {
      setDrawingArrow({ from: square, currentSquare: square });
      setIsRightMouseDown(true);
    }
  }, [enableArrows, arrowDrawMode, getSquareFromPosition]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!drawingArrow || !isRightMouseDown) return;
    
    const touch = e.touches[0];
    const square = getSquareFromPosition(touch.clientX, touch.clientY);
    if (square && square !== drawingArrow.currentSquare) {
      setDrawingArrow({ ...drawingArrow, currentSquare: square });
    }
  }, [drawingArrow, isRightMouseDown, getSquareFromPosition]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!enableArrows || !arrowDrawMode) return;
    
    if (drawingArrow && isRightMouseDown) {
      const changedTouch = e.changedTouches[0];
      const toSquare = getSquareFromPosition(changedTouch.clientX, changedTouch.clientY);
      
      if (toSquare && toSquare !== drawingArrow.from) {
        const newArrow = { from: drawingArrow.from, to: toSquare };
        const existingIndex = arrows.findIndex(
          a => a.from === newArrow.from && a.to === newArrow.to
        );
        
        if (existingIndex >= 0) {
          setArrows(arrows.filter((_, i) => i !== existingIndex));
        } else {
          setArrows([...arrows, newArrow]);
        }
      }
      
      setDrawingArrow(null);
      setIsRightMouseDown(false);
    }
  }, [enableArrows, arrowDrawMode, drawingArrow, isRightMouseDown, arrows, getSquareFromPosition]);

  const getSquareCenter = useCallback((square: string): { x: number; y: number } => {
    const file = square[0];
    const rank = square[1];
    
    const fileIndex = displayFiles.indexOf(file);
    const rankIndex = displayRanks.indexOf(rank);
    
    return {
      x: (fileIndex + 0.5) * 12.5,
      y: (rankIndex + 0.5) * 12.5,
    };
  }, [displayFiles, displayRanks]);

  const getSquareColor = (fileIndex: number, rankIndex: number) => {
    const isLight = (fileIndex + rankIndex) % 2 === 0;
    return isLight ? "bg-[#f0d9b5]" : "bg-[#b58863]";
  };

  const isPremoveSquare = (square: string) => {
    return premove && (premove.from === square || premove.to === square);
  };

  const renderArrow = (arrow: Arrow, index: number, isPreview: boolean = false) => {
    const from = getSquareCenter(arrow.from);
    const to = getSquareCenter(arrow.to);
    
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    
    const headLength = 3;
    const adjustedLength = length - headLength * 0.7;
    const ratio = adjustedLength / length;
    
    const toX = from.x + dx * ratio;
    const toY = from.y + dy * ratio;
    
    const color = isPreview ? "rgba(255, 170, 0, 0.7)" : "rgba(255, 170, 0, 0.8)";
    
    return (
      <g key={`arrow-${index}`}>
        <line
          x1={from.x}
          y1={from.y}
          x2={toX}
          y2={toY}
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <polygon
          points={`0,-2 4,0 0,2`}
          fill={color}
          transform={`translate(${to.x},${to.y}) rotate(${Math.atan2(dy, dx) * 180 / Math.PI})`}
        />
      </g>
    );
  };

  const boardContent = (
    <div 
      ref={boardRef}
      className="relative w-full h-full select-none"
      onContextMenu={handleContextMenu}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => {
        if (isRightMouseDown) {
          setDrawingArrow(null);
          setIsRightMouseDown(false);
        }
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="grid grid-cols-8 grid-rows-8 gap-0 w-full h-full">
        {displayRanks.map((rank, rankIndex) =>
          displayFiles.map((file, fileIndex) => {
              const square = `${file}${rank}`;
              const boardRank = RANKS.indexOf(rank);
              const boardFile = FILES.indexOf(file);
              const piece = board[boardRank]?.[boardFile];
              const isHighlighted = highlightedSquares.includes(square);
              const isSelected = selectedSquare === square;
              const isLocked = lockedPiece === square;
              const isLastMove = effectiveLastMoveSquares.includes(square);
              const isPremove = isPremoveSquare(square);
              const isLegalMove = legalMoveSquares.includes(square);
              const isLegalCapture = isLegalMove && piece !== null;

              return (
                <div
                  key={square}
                  data-testid={`square-${square}`}
                  data-square={square}
                  onClick={() => handleSquareClick(file, rank, piece)}
                  className={`
                    relative flex items-center justify-center cursor-pointer
                    ${getSquareColor(fileIndex, rankIndex)}
                    ${isHighlighted ? "ring-2 ring-primary ring-inset" : ""}
                    ${isSelected && !isLocked ? (highlightColor === "red" ? "ring-4 ring-red-400 ring-inset" : "ring-4 ring-yellow-400 ring-inset") : ""}
                    ${isLocked ? (highlightColor === "red" ? "ring-4 ring-red-500 ring-inset" : "ring-4 ring-yellow-500 ring-inset") : ""}
                    ${isLastMove ? (highlightColor === "red" ? "bg-opacity-80 after:absolute after:inset-0 after:bg-red-400/30" : "bg-opacity-80 after:absolute after:inset-0 after:bg-yellow-400/30") : ""}
                    ${isPremove ? "bg-opacity-80 after:absolute after:inset-0 after:bg-blue-500/40" : ""}
                    hover-elevate
                  `}
                >
                  {piece && (
                    <span className={`text-3xl sm:text-4xl md:text-5xl select-none ${
                      piece === piece.toUpperCase() ? "text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]" : "text-black"
                    }`}>
                      {PIECE_SYMBOLS[piece]}
                    </span>
                  )}
                  
                  {isLegalMove && !isLegalCapture && (
                    <div className="absolute w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-black/20 pointer-events-none" />
                  )}
                  {isLegalCapture && (
                    <div className="absolute inset-0 rounded-full border-[3px] sm:border-4 border-black/20 pointer-events-none" />
                  )}
                  
                  {showCoordinates && fileIndex === 0 && (
                    <span className="absolute bottom-0.5 left-1 text-xs font-semibold select-none opacity-70">
                      {rank}
                    </span>
                  )}
                  {showCoordinates && rankIndex === 7 && (
                    <span className="absolute top-0.5 right-1 text-xs font-semibold select-none opacity-70">
                      {file}
                    </span>
                  )}
                </div>
              );
          })
        )}
      </div>
      
      {(arrows.length > 0 || drawingArrow) && (
        <svg 
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          {arrows.map((arrow, i) => renderArrow(arrow, i))}
          {drawingArrow && drawingArrow.from !== drawingArrow.currentSquare && 
            renderArrow({ from: drawingArrow.from, to: drawingArrow.currentSquare }, -1, true)
          }
        </svg>
      )}
    </div>
  );

  if (noCard) {
    return (
      <div className={`aspect-square w-full ${className}`}>
        {boardContent}
      </div>
    );
  }

  return (
    <Card className={`aspect-square w-full max-w-full md:max-w-[600px] p-1 md:p-2 ${className}`}>
      {boardContent}
    </Card>
  );
}
