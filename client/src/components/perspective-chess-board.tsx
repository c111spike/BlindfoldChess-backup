import { ChessBoard } from "@/components/chess-board";

interface PerspectiveBoardProps {
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
  enableArrows?: boolean;
  enablePremoves?: boolean;
  isPlayerTurn?: boolean;
  premove?: { from: string; to: string } | null;
  onPremove?: (premove: { from: string; to: string } | null) => void;
  arrowDrawMode?: boolean;
  highlightColor?: "yellow" | "red";
  perspective3d?: boolean;
}

export function PerspectiveChessBoard({
  perspective3d = false,
  className = "",
  ...props
}: PerspectiveBoardProps) {
  if (!perspective3d) {
    return <ChessBoard {...props} className={className} />;
  }

  return (
    <div 
      className={`relative ${className}`}
      style={{
        perspective: "1000px",
        perspectiveOrigin: "50% 80%",
      }}
      data-testid="perspective-board-container"
    >
      <style>{`
        .perspective-3d-board [data-square] img,
        .perspective-3d-board [data-square] svg {
          transform: translateZ(20px) scale(1.05);
          filter: drop-shadow(2px 4px 3px rgba(0, 0, 0, 0.4));
          transition: transform 0.15s ease-out;
        }
        .perspective-3d-board [data-square]:hover img,
        .perspective-3d-board [data-square]:hover svg {
          transform: translateZ(30px) scale(1.1);
          filter: drop-shadow(3px 6px 5px rgba(0, 0, 0, 0.5));
        }
      `}</style>
      <div
        className="perspective-3d-board"
        style={{
          transform: "rotateX(25deg)",
          transformOrigin: "50% 100%",
          transformStyle: "preserve-3d",
        }}
      >
        <ChessBoard 
          {...props} 
          noCard={true}
          className="shadow-2xl"
        />
      </div>
    </div>
  );
}
