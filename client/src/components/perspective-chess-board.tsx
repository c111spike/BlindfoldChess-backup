import { ChessBoard } from "@/components/chess-board";
import { ChessBoard3D } from "@/components/chess-board-3d";

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
  lastMove,
  ...props
}: PerspectiveBoardProps) {
  if (!perspective3d) {
    return <ChessBoard {...props} lastMove={lastMove} className={className} />;
  }

  const lastMoveSquares = lastMove ? [lastMove.from, lastMove.to] : [];

  return (
    <ChessBoard3D
      fen={props.fen}
      orientation={props.orientation}
      highlightedSquares={props.highlightedSquares}
      legalMoveSquares={props.legalMoveSquares}
      lastMoveSquares={lastMoveSquares}
      selectedSquare={props.selectedSquare}
      onSquareClick={props.onSquareClick}
      onMove={props.onMove}
      className={className}
    />
  );
}
