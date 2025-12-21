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
        perspectiveOrigin: "50% 100%",
      }}
      data-testid="perspective-board-container"
    >
      <div
        style={{
          transform: "rotateX(30deg)",
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
      <div 
        className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-[110%] h-6 bg-gradient-to-t from-amber-950 to-amber-900 rounded-b-lg shadow-lg"
        style={{
          transform: "rotateX(-10deg) translateZ(-10px)",
          transformOrigin: "top center",
        }}
        data-testid="table-edge"
      />
    </div>
  );
}
