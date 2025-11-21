import { useState } from "react";
import { Card } from "@/components/ui/card";

interface ChessBoardProps {
  fen?: string;
  orientation?: "white" | "black";
  showCoordinates?: boolean;
  highlightedSquares?: string[];
  onSquareClick?: (square: string) => void;
  className?: string;
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
  onSquareClick,
  className = "",
}: ChessBoardProps) {
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);

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

  const handleSquareClick = (file: string, rank: string) => {
    const square = `${file}${rank}`;
    setSelectedSquare(square);
    onSquareClick?.(square);
  };

  const getSquareColor = (fileIndex: number, rankIndex: number) => {
    const isLight = (fileIndex + rankIndex) % 2 === 0;
    return isLight ? "bg-[#f0d9b5]" : "bg-[#b58863]";
  };

  return (
    <Card className={`aspect-square w-full max-w-[600px] p-2 ${className}`}>
      <div className="relative w-full h-full">
        <div className="grid grid-cols-8 grid-rows-8 gap-0 w-full h-full">
          {displayRanks.map((rank, rankIndex) =>
            displayFiles.map((file, fileIndex) => {
              const square = `${file}${rank}`;
              const boardRank = RANKS.indexOf(rank);
              const boardFile = FILES.indexOf(file);
              const piece = board[boardRank]?.[boardFile];
              const isHighlighted = highlightedSquares.includes(square);
              const isSelected = selectedSquare === square;

              return (
                <div
                  key={square}
                  data-testid={`square-${square}`}
                  onClick={() => handleSquareClick(file, rank)}
                  className={`
                    relative flex items-center justify-center cursor-pointer
                    ${getSquareColor(fileIndex, rankIndex)}
                    ${isHighlighted ? "ring-2 ring-primary ring-inset" : ""}
                    ${isSelected ? "ring-4 ring-yellow-400 ring-inset" : ""}
                    hover-elevate
                  `}
                >
                  {piece && (
                    <span className={`text-5xl select-none ${
                      piece === piece.toUpperCase() ? "text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]" : "text-black"
                    }`}>
                      {PIECE_SYMBOLS[piece]}
                    </span>
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
      </div>
    </Card>
  );
}
