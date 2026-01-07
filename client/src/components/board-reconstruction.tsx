import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, X, RotateCcw, Send } from "lucide-react";

const PIECE_IMAGES: Record<string, string> = {
  'wK': '/pieces/wK.svg',
  'wQ': '/pieces/wQ.svg',
  'wR': '/pieces/wR.svg',
  'wB': '/pieces/wB.svg',
  'wN': '/pieces/wN.svg',
  'wP': '/pieces/wP.svg',
  'bK': '/pieces/bK.svg',
  'bQ': '/pieces/bQ.svg',
  'bR': '/pieces/bR.svg',
  'bB': '/pieces/bB.svg',
  'bN': '/pieces/bN.svg',
  'bP': '/pieces/bP.svg',
};

const ALL_PIECES = ['wK', 'wQ', 'wR', 'wB', 'wN', 'wP', 'bK', 'bQ', 'bR', 'bB', 'bN', 'bP'];

interface BoardReconstructionProps {
  actualFen: string;
  playerColor: 'white' | 'black';
  onComplete: (score: number) => void;
  onSkip: () => void;
  onContinue?: () => void;
}

function fenToBoard(fen: string): (string | null)[][] {
  const board: (string | null)[][] = Array(8).fill(null).map(() => Array(8).fill(null));
  const [position] = fen.split(' ');
  const rows = position.split('/');
  
  const pieceMap: Record<string, string> = {
    'K': 'wK', 'Q': 'wQ', 'R': 'wR', 'B': 'wB', 'N': 'wN', 'P': 'wP',
    'k': 'bK', 'q': 'bQ', 'r': 'bR', 'b': 'bB', 'n': 'bN', 'p': 'bP',
  };
  
  rows.forEach((row, rowIdx) => {
    let colIdx = 0;
    for (const char of row) {
      if (/\d/.test(char)) {
        colIdx += parseInt(char);
      } else if (pieceMap[char]) {
        board[rowIdx][colIdx] = pieceMap[char];
        colIdx++;
      }
    }
  });
  
  return board;
}

function calculateScore(userBoard: (string | null)[][], actualBoard: (string | null)[][]): number {
  let correct = 0;
  let total = 0;
  
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const actual = actualBoard[row][col];
      const user = userBoard[row][col];
      
      if (actual !== null) {
        total++;
        if (actual === user) {
          correct++;
        }
      }
    }
  }
  
  if (total === 0) return 100;
  return Math.round((correct / total) * 100);
}

export function BoardReconstruction({ actualFen, playerColor, onComplete, onSkip, onContinue }: BoardReconstructionProps) {
  const [userBoard, setUserBoard] = useState<(string | null)[][]>(
    Array(8).fill(null).map(() => Array(8).fill(null))
  );
  const [selectedPiece, setSelectedPiece] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  
  const actualBoard = fenToBoard(actualFen);
  
  const handleSquareClick = useCallback((row: number, col: number) => {
    if (submitted) return;
    
    if (selectedPiece) {
      setUserBoard(prev => {
        const newBoard = prev.map(r => [...r]);
        newBoard[row][col] = selectedPiece;
        return newBoard;
      });
    } else if (userBoard[row][col]) {
      setUserBoard(prev => {
        const newBoard = prev.map(r => [...r]);
        newBoard[row][col] = null;
        return newBoard;
      });
    }
  }, [selectedPiece, userBoard, submitted]);
  
  const handleReset = () => {
    setUserBoard(Array(8).fill(null).map(() => Array(8).fill(null)));
    setSelectedPiece(null);
  };
  
  const handleSubmit = () => {
    const calculatedScore = calculateScore(userBoard, actualBoard);
    setScore(calculatedScore);
    setSubmitted(true);
    onComplete(calculatedScore);
  };
  
  const files = playerColor === "white" 
    ? ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
    : ['h', 'g', 'f', 'e', 'd', 'c', 'b', 'a'];
  const ranks = playerColor === "white"
    ? ['8', '7', '6', '5', '4', '3', '2', '1']
    : ['1', '2', '3', '4', '5', '6', '7', '8'];
  
  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center justify-between">
          <span>Reconstruct the Board</span>
          {score !== null && (
            <Badge variant={score >= 80 ? "default" : score >= 50 ? "secondary" : "destructive"} className="ml-2">
              Clarity Score: {score}%
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!submitted && (
          <p className="text-sm text-muted-foreground">
            Place pieces where you remember them. Click a piece below, then click squares to place it.
          </p>
        )}
        
        <div className="flex flex-wrap gap-1 justify-center p-2 bg-muted rounded-md">
          {ALL_PIECES.map(piece => (
            <button
              key={piece}
              onClick={() => setSelectedPiece(selectedPiece === piece ? null : piece)}
              className={`w-8 h-8 rounded transition-all ${
                selectedPiece === piece 
                  ? 'ring-2 ring-amber-400 bg-amber-100' 
                  : 'hover:bg-muted-foreground/20'
              } ${submitted ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={submitted}
              data-testid={`piece-palette-${piece}`}
            >
              <img src={PIECE_IMAGES[piece]} alt={piece} className="w-full h-full" />
            </button>
          ))}
        </div>
        
        <div className="aspect-square w-full max-w-xs mx-auto">
          <div className="grid grid-cols-8 grid-rows-8 w-full h-full border border-stone-400">
            {Array.from({ length: 64 }).map((_, i) => {
              const displayRow = Math.floor(i / 8);
              const displayCol = i % 8;
              const boardRow = playerColor === "white" ? displayRow : 7 - displayRow;
              const boardCol = playerColor === "white" ? displayCol : 7 - displayCol;
              
              const isLight = (displayRow + displayCol) % 2 === 0;
              const userPiece = userBoard[boardRow][boardCol];
              const actualPiece = actualBoard[boardRow][boardCol];
              
              let squareClass = isLight ? 'bg-amber-100' : 'bg-amber-700';
              let indicator = null;
              
              if (submitted) {
                if (userPiece === actualPiece) {
                  if (userPiece !== null) {
                    squareClass = isLight ? 'bg-green-200' : 'bg-green-600';
                  }
                } else {
                  squareClass = isLight ? 'bg-red-200' : 'bg-red-500';
                  if (actualPiece && userPiece !== actualPiece) {
                    indicator = (
                      <div className="absolute bottom-0 right-0 w-4 h-4 bg-white/80 rounded-tl flex items-center justify-center">
                        <img src={PIECE_IMAGES[actualPiece]} alt="correct" className="w-3 h-3" />
                      </div>
                    );
                  }
                }
              }
              
              return (
                <div
                  key={i}
                  onClick={() => handleSquareClick(boardRow, boardCol)}
                  className={`relative flex items-center justify-center cursor-pointer ${squareClass} ${
                    !submitted && selectedPiece ? 'hover:ring-2 hover:ring-amber-400 hover:ring-inset' : ''
                  }`}
                  data-testid={`reconstruction-square-${files[displayCol]}${ranks[displayRow]}`}
                >
                  {userPiece && (
                    <img 
                      src={PIECE_IMAGES[userPiece]} 
                      alt={userPiece} 
                      className="w-[85%] h-[85%]" 
                    />
                  )}
                  {indicator}
                  {displayCol === 0 && (
                    <span className="absolute top-0.5 left-0.5 text-[8px] font-semibold select-none opacity-70">
                      {ranks[displayRow]}
                    </span>
                  )}
                  {displayRow === 7 && (
                    <span className="absolute bottom-0.5 right-0.5 text-[8px] font-semibold select-none opacity-70">
                      {files[displayCol]}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        
        <div className="flex gap-2">
          {!submitted ? (
            <>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleReset}
                className="flex-1"
                data-testid="button-reconstruction-reset"
              >
                <RotateCcw className="mr-1 h-4 w-4" />
                Reset
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onSkip}
                className="flex-1"
                data-testid="button-reconstruction-skip"
              >
                Skip
              </Button>
              <Button 
                size="sm" 
                onClick={handleSubmit}
                className="flex-1 bg-amber-400 hover:bg-amber-500 text-stone-900"
                data-testid="button-reconstruction-submit"
              >
                <Send className="mr-1 h-4 w-4" />
                Check
              </Button>
            </>
          ) : (
            <Button 
              size="sm" 
              onClick={onContinue || onSkip}
              className="w-full bg-amber-400 hover:bg-amber-500 text-stone-900"
              data-testid="button-reconstruction-continue"
            >
              Continue
            </Button>
          )}
        </div>
        
        {submitted && (
          <div className="text-center text-sm">
            {score !== null && score >= 80 ? (
              <p className="text-green-600 flex items-center justify-center gap-1">
                <Check className="h-4 w-4" /> Excellent memory!
              </p>
            ) : score !== null && score >= 50 ? (
              <p className="text-amber-600">Good effort! Keep practicing.</p>
            ) : (
              <p className="text-red-600 flex items-center justify-center gap-1">
                <X className="h-4 w-4" /> Keep training your visualization!
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
