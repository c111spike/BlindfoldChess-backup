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

interface HighlightColors {
  selectedPiece?: string;
  availableMoves?: string;
  lastMove?: string;
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
  customHighlightColors?: HighlightColors;
  hideSelectionHighlight?: boolean;
}

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"];

// Helper functions for knight move detection and L-shaped arrows
const squareToIndices = (square: string): { file: number; rank: number } => {
  return {
    file: FILES.indexOf(square[0]),
    rank: parseInt(square[1]) - 1,
  };
};

const indicesToSquare = (file: number, rank: number): string => {
  return `${FILES[file]}${rank + 1}`;
};

const isKnightMove = (from: string, to: string): boolean => {
  const fromPos = squareToIndices(from);
  const toPos = squareToIndices(to);
  const dx = Math.abs(toPos.file - fromPos.file);
  const dy = Math.abs(toPos.rank - fromPos.rank);
  return (dx === 2 && dy === 1) || (dx === 1 && dy === 2);
};

// Get the intermediate square for L-shaped knight arrow (corner of the L)
// We move 2 squares in the longer direction first, then 1 in the shorter
const getKnightIntermediateSquare = (from: string, to: string): string => {
  const fromPos = squareToIndices(from);
  const toPos = squareToIndices(to);
  const dx = toPos.file - fromPos.file;
  const dy = toPos.rank - fromPos.rank;
  
  // If moving 2 squares horizontally, go horizontal first
  if (Math.abs(dx) === 2) {
    return indicesToSquare(toPos.file, fromPos.rank);
  } else {
    // Moving 2 squares vertically, go vertical first
    return indicesToSquare(fromPos.file, toPos.rank);
  }
};

// Cburnett SVG pieces (CC BY-SA 3.0 - Colin M.L. Burnett)
const PIECE_IMAGES: Record<string, string> = {
  K: "/pieces/wK.svg", Q: "/pieces/wQ.svg", R: "/pieces/wR.svg", B: "/pieces/wB.svg", N: "/pieces/wN.svg", P: "/pieces/wP.svg",
  k: "/pieces/bK.svg", q: "/pieces/bQ.svg", r: "/pieces/bR.svg", b: "/pieces/bB.svg", n: "/pieces/bN.svg", p: "/pieces/bP.svg",
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
  customHighlightColors,
  hideSelectionHighlight = false,
}: ChessBoardProps) {
  const selectedColor = customHighlightColors?.selectedPiece || (highlightColor === "red" ? "#ef4444" : "#facc15");
  const lastMoveHighlightColor = customHighlightColors?.lastMove || (highlightColor === "red" ? "#f97316" : "#f97316"); // Orange for last move
  const availableMovesColorValue = customHighlightColors?.availableMoves || "#fbbf24"; // Amber for available moves
  const [internalSelectedSquare, setInternalSelectedSquare] = useState<string | null>(null);
  const selectedSquare = externalSelectedSquare !== null ? externalSelectedSquare : internalSelectedSquare;
  
  const [arrows, setArrows] = useState<Arrow[]>([]);
  const [drawingArrow, setDrawingArrow] = useState<{ from: string; currentSquare: string } | null>(null);
  const [isRightMouseDown, setIsRightMouseDown] = useState(false);
  const [pendingArrowStart, setPendingArrowStart] = useState<string | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  
  const effectiveLastMoveSquares = lastMove 
    ? [lastMove.from, lastMove.to] 
    : lastMoveSquares;

  useEffect(() => {
    setInternalSelectedSquare(null);
  }, [fen]);

  // Clear pending arrow start when arrow draw mode is disabled
  useEffect(() => {
    if (!arrowDrawMode) {
      setPendingArrowStart(null);
    }
  }, [arrowDrawMode]);

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
    
    // When arrow draw mode is enabled, use click-to-click arrow drawing
    if (arrowDrawMode) {
      if (pendingArrowStart === null) {
        // First click - set the start square
        setPendingArrowStart(square);
      } else if (pendingArrowStart === square) {
        // Same square clicked - cancel the pending arrow
        setPendingArrowStart(null);
      } else {
        // Second click on different square - create/toggle the arrow
        const newArrow = { from: pendingArrowStart, to: square };
        const existingIndex = arrows.findIndex(
          a => a.from === newArrow.from && a.to === newArrow.to
        );
        
        if (existingIndex >= 0) {
          // Arrow exists - remove it
          setArrows(arrows.filter((_, i) => i !== existingIndex));
        } else {
          // Arrow doesn't exist - add it
          setArrows([...arrows, newArrow]);
        }
        setPendingArrowStart(null);
      }
      return;
    }
    
    if (piece) {
      setArrows([]);
    }
    
    // Helper to check if a piece is white (uppercase) or black (lowercase)
    const isWhitePiece = (p: string) => p === p.toUpperCase();
    const isBlackPiece = (p: string) => p === p.toLowerCase();
    
    // Get the piece on the currently selected square (use combined selectedSquare for external control)
    const getSelectedPiece = (): string | null => {
      if (!selectedSquare) return null;
      const selectedFile = selectedSquare[0];
      const selectedRank = selectedSquare[1];
      const boardRank = RANKS.indexOf(selectedRank);
      const boardFile = FILES.indexOf(selectedFile);
      return board[boardRank]?.[boardFile] || null;
    };
    
    const selectedPiece = getSelectedPiece();
    
    // If clicking on a piece of the same color as currently selected, switch selection
    // BUT NOT if there's a locked piece (touch-move rule in OTB mode)
    if (piece && selectedPiece && selectedSquare !== square) {
      const selectedIsWhite = isWhitePiece(selectedPiece);
      const clickedIsWhite = isWhitePiece(piece);
      if (selectedIsWhite === clickedIsWhite) {
        // If a piece is locked (touch-move), don't allow visual selection switching
        if (lockedPiece) {
          // Still call onSquareClick so OTB mode can handle the tap
          // but don't change the visual selection
          onSquareClick?.(square);
          return;
        }
        // Same color - switch selection without trying to move
        setInternalSelectedSquare(square);
        onSquareClick?.(square);
        return;
      }
    }
    
    if (onMove && selectedSquare && selectedSquare !== square) {
      const fromSquare = selectedSquare;
      const moveResult = onMove(fromSquare, square);
      if (moveResult) {
        setInternalSelectedSquare(null);
        return;
      }
      // Move failed - if clicked square has a piece, select it instead
      // BUT NOT if there's a locked piece (touch-move rule)
      if (piece && externalSelectedSquare === null && !lockedPiece) {
        setInternalSelectedSquare(square);
        onSquareClick?.(square);
        return;
      }
    }
    
    if (piece) {
      // Don't switch selection if a piece is locked (touch-move rule)
      if (externalSelectedSquare === null && !lockedPiece) {
        setInternalSelectedSquare(square);
      }
    } else if (selectedSquare && !lockedPiece) {
      // Don't clear selection if piece is locked
      setInternalSelectedSquare(null);
    }
    
    onSquareClick?.(square);
  };

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!enableArrows || interactionMode === "viewOnly") return;
    
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

  // Touch handlers disabled in arrow draw mode - use click-to-click instead to prevent scroll
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // Disabled - arrow draw mode now uses click-to-click to prevent scroll issues
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    // Disabled - arrow draw mode now uses click-to-click to prevent scroll issues
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    // Disabled - arrow draw mode now uses click-to-click to prevent scroll issues
  }, []);

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
    return isLight ? "bg-board-light" : "bg-board-dark";
  };

  const isPremoveSquare = (square: string) => {
    return premove && (premove.from === square || premove.to === square);
  };

  const renderArrow = (arrow: Arrow, index: number, isPreview: boolean = false) => {
    const from = getSquareCenter(arrow.from);
    const to = getSquareCenter(arrow.to);
    const color = isPreview ? "rgba(255, 170, 0, 0.7)" : "rgba(255, 170, 0, 0.8)";
    
    // Check if this is a knight move pattern - render L-shaped arrow
    if (isKnightMove(arrow.from, arrow.to)) {
      const intermediateSquare = getKnightIntermediateSquare(arrow.from, arrow.to);
      const mid = getSquareCenter(intermediateSquare);
      
      // Calculate arrow head direction for the final segment
      const dx2 = to.x - mid.x;
      const dy2 = to.y - mid.y;
      const length2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
      
      const headLength = 3;
      const adjustedLength2 = length2 - headLength * 0.7;
      const ratio2 = adjustedLength2 / length2;
      
      const toX = mid.x + dx2 * ratio2;
      const toY = mid.y + dy2 * ratio2;
      
      return (
        <g key={`arrow-${index}`}>
          {/* First segment: from start to corner */}
          <line
            x1={from.x}
            y1={from.y}
            x2={mid.x}
            y2={mid.y}
            stroke={color}
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          {/* Second segment: from corner to destination */}
          <line
            x1={mid.x}
            y1={mid.y}
            x2={toX}
            y2={toY}
            stroke={color}
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          {/* Arrow head at destination */}
          <polygon
            points={`0,-2 4,0 0,2`}
            fill={color}
            transform={`translate(${to.x},${to.y}) rotate(${Math.atan2(dy2, dx2) * 180 / Math.PI})`}
          />
        </g>
      );
    }
    
    // Standard straight arrow for non-knight moves
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    
    const headLength = 3;
    const adjustedLength = length - headLength * 0.7;
    const ratio = adjustedLength / length;
    
    const toX = from.x + dx * ratio;
    const toY = from.y + dy * ratio;
    
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
              const isPendingArrowStart = pendingArrowStart === square;

              const hexToRgba = (hex: string, alpha: number) => {
                const r = parseInt(hex.slice(1, 3), 16);
                const g = parseInt(hex.slice(3, 5), 16);
                const b = parseInt(hex.slice(5, 7), 16);
                return `rgba(${r}, ${g}, ${b}, ${alpha})`;
              };

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
                    ${isPremove ? "bg-opacity-80 after:absolute after:inset-0 after:bg-blue-500/40" : ""}
                    ${isPendingArrowStart ? "ring-4 ring-orange-400 ring-inset" : ""}
                    hover-elevate
                  `}
                  style={{
                    ...(!hideSelectionHighlight && isSelected && !isLocked ? { boxShadow: `inset 0 0 0 4px ${selectedColor}` } : {}),
                    ...(!hideSelectionHighlight && isLocked ? { boxShadow: `inset 0 0 0 4px ${selectedColor}` } : {}),
                  }}
                >
                  {isLastMove && (
                    <div 
                      className="absolute inset-0 pointer-events-none" 
                      style={{ backgroundColor: hexToRgba(lastMoveHighlightColor, 0.3) }}
                    />
                  )}
                  {piece && (
                    <img 
                      src={PIECE_IMAGES[piece]} 
                      alt={piece}
                      className="w-[75%] h-[75%] select-none relative z-10 pointer-events-none"
                      draggable={false}
                    />
                  )}
                  
                  {isLegalMove && !isLegalCapture && (
                    <div 
                      className="absolute w-3 h-3 sm:w-4 sm:h-4 rounded-full pointer-events-none z-10" 
                      style={{ backgroundColor: hexToRgba(availableMovesColorValue, 0.4) }}
                    />
                  )}
                  {isLegalCapture && (
                    <div 
                      className="absolute inset-0 rounded-full pointer-events-none z-10" 
                      style={{ border: `3px solid ${hexToRgba(availableMovesColorValue, 0.5)}` }}
                    />
                  )}
                  
                  {showCoordinates && fileIndex === 0 && (
                    <span className="absolute bottom-0.5 left-1 text-xs font-semibold select-none opacity-70">
                      {rank}
                    </span>
                  )}
                  {showCoordinates && rankIndex === 7 && (
                    <span className="absolute bottom-0.5 right-1 text-xs font-semibold select-none opacity-70">
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
