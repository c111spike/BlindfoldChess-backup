import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Chess } from "chess.js";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Trash2, 
  RotateCcw, 
  FlipVertical, 
  Save, 
  Plus,
  Lightbulb,
  BookOpen,
  Youtube,
  PenLine,
  HelpCircle,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  XCircle,
  Loader2,
  Sparkles,
  Undo2,
  MousePointerClick
} from "lucide-react";

interface MoveVerification {
  classification: string;
  isBestMove: boolean;
  stockfishBestMove: string;
  evaluation: number;
  isMate: boolean;
  mateIn?: number;
  fromCache: boolean;
}

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"];

const PIECE_SYMBOLS: Record<string, string> = {
  K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘", P: "♙",
  k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟",
};

const WHITE_PIECES = ["K", "Q", "R", "B", "N", "P"];
const BLACK_PIECES = ["k", "q", "r", "b", "n", "p"];

const PUZZLE_TYPES = [
  { value: "mate_in_1", label: "Mate in 1" },
  { value: "mate_in_2", label: "Mate in 2" },
  { value: "mate_in_3", label: "Mate in 3" },
  { value: "mate_in_4_plus", label: "Mate in 4+" },
  { value: "win_piece", label: "Win a Piece" },
  { value: "positional_advantage", label: "Positional Advantage" },
  { value: "endgame", label: "Endgame" },
  { value: "opening_trap", label: "Opening Trap" },
  { value: "defensive", label: "Defensive" },
  { value: "sacrifice", label: "Sacrifice" },
  { value: "other", label: "Other" },
];

const DIFFICULTIES = [
  { value: "beginner", label: "Beginner (800-1200)" },
  { value: "intermediate", label: "Intermediate (1200-1600)" },
  { value: "advanced", label: "Advanced (1600-2000)" },
  { value: "expert", label: "Expert (2000+)" },
];

const SOURCE_TYPES = [
  { value: "created", label: "I created this puzzle", icon: PenLine },
  { value: "book", label: "From a book", icon: BookOpen },
  { value: "youtube", label: "From YouTube", icon: Youtube },
  { value: "other", label: "Other source", icon: HelpCircle },
];

type BoardPosition = (string | null)[][];

function createEmptyBoard(): BoardPosition {
  return Array(8).fill(null).map(() => Array(8).fill(null));
}

function boardToFen(board: BoardPosition, whoToMove: "white" | "black"): string {
  let fen = "";
  for (let rank = 0; rank < 8; rank++) {
    let emptyCount = 0;
    for (let file = 0; file < 8; file++) {
      const piece = board[rank][file];
      if (piece) {
        if (emptyCount > 0) {
          fen += emptyCount;
          emptyCount = 0;
        }
        fen += piece;
      } else {
        emptyCount++;
      }
    }
    if (emptyCount > 0) {
      fen += emptyCount;
    }
    if (rank < 7) fen += "/";
  }
  fen += ` ${whoToMove === "white" ? "w" : "b"} KQkq - 0 1`;
  return fen;
}

function fenToBoard(fen: string): BoardPosition {
  const rows = fen.split(" ")[0].split("/");
  const board: BoardPosition = [];
  
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
}

export default function PuzzleCreator() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  
  const [board, setBoard] = useState<BoardPosition>(createEmptyBoard());
  const [selectedPiece, setSelectedPiece] = useState<string | null>(null);
  const [whoToMove, setWhoToMove] = useState<"white" | "black">("white");
  const [orientation, setOrientation] = useState<"white" | "black">("white");
  
  const [puzzleType, setPuzzleType] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [solutionMoves, setSolutionMoves] = useState<string[]>([""]);
  const [hints, setHints] = useState<string[]>([]);
  const [hintInput, setHintInput] = useState("");
  
  const [sourceType, setSourceType] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [hasPermission, setHasPermission] = useState(false);
  
  // Stockfish verification state
  const [moveVerifications, setMoveVerifications] = useState<Record<number, MoveVerification>>({});
  const [verifyingMoveIndex, setVerifyingMoveIndex] = useState<number | null>(null);
  
  // Interactive solution board state
  const [selectedSolutionSquare, setSelectedSolutionSquare] = useState<string | null>(null);
  const [legalMoves, setLegalMoves] = useState<string[]>([]);
  
  const displayRanks = orientation === "white" ? RANKS : [...RANKS].reverse();
  const displayFiles = orientation === "white" ? FILES : [...FILES].reverse();
  
  // Compute the current working position (after all valid solution moves)
  const getWorkingPosition = useCallback(() => {
    const baseFen = boardToFen(board, whoToMove);
    const validMoves = solutionMoves.filter(m => m.trim());
    
    if (validMoves.length === 0) {
      return { fen: baseFen, board: board };
    }
    
    try {
      const chess = new Chess(baseFen);
      for (const move of validMoves) {
        const result = chess.move(move);
        if (!result) {
          return { fen: baseFen, board: board };
        }
      }
      return { fen: chess.fen(), board: fenToBoard(chess.fen()) };
    } catch {
      return { fen: baseFen, board: board };
    }
  }, [board, whoToMove, solutionMoves]);
  
  const workingPosition = getWorkingPosition();
  
  // Handle click on the solution preview board
  const handleSolutionSquareClick = useCallback((square: string) => {
    const workingFen = workingPosition.fen;
    
    try {
      const chess = new Chess(workingFen);
      const piece = chess.get(square as any);
      
      if (selectedSolutionSquare) {
        // Try to make a move
        try {
          const move = chess.move({
            from: selectedSolutionSquare as any,
            to: square as any,
            promotion: 'q' // Auto-promote to queen for simplicity
          });
          
          if (move) {
            // Get current valid moves (non-empty)
            const currentValidMoves = solutionMoves.filter(m => m.trim());
            // Insert the new move and keep an empty placeholder at end for manual entry
            const newMoves = [...currentValidMoves, move.san, ''];
            setSolutionMoves(newMoves);
            toast({ title: "Move Added", description: `${move.san} added to solution` });
          }
        } catch {
          // Invalid move, check if clicking on own piece to re-select
          if (piece && ((chess.turn() === 'w' && piece.color === 'w') || (chess.turn() === 'b' && piece.color === 'b'))) {
            setSelectedSolutionSquare(square);
            const moves = chess.moves({ square: square as any, verbose: true });
            setLegalMoves(moves.map(m => m.to));
            return;
          }
        }
        setSelectedSolutionSquare(null);
        setLegalMoves([]);
      } else {
        // First click - select a piece if it belongs to the side to move
        if (piece && ((chess.turn() === 'w' && piece.color === 'w') || (chess.turn() === 'b' && piece.color === 'b'))) {
          setSelectedSolutionSquare(square);
          const moves = chess.moves({ square: square as any, verbose: true });
          setLegalMoves(moves.map(m => m.to));
        } else {
          // Clicking on empty square or opponent piece - clear selection
          setSelectedSolutionSquare(null);
          setLegalMoves([]);
        }
      }
    } catch (e) {
      console.error("Error handling solution square click:", e);
      setSelectedSolutionSquare(null);
      setLegalMoves([]);
    }
  }, [selectedSolutionSquare, workingPosition.fen, solutionMoves, toast]);
  
  // Undo last solution move
  const undoLastSolutionMove = useCallback(() => {
    const validMoves = solutionMoves.filter(m => m.trim());
    if (validMoves.length > 0) {
      const newMoves = validMoves.slice(0, -1);
      // Always keep an empty placeholder at the end for manual entry
      setSolutionMoves(newMoves.length > 0 ? [...newMoves, ''] : ['']);
      // Clear verification for removed move
      const newVerifications = { ...moveVerifications };
      delete newVerifications[validMoves.length - 1];
      setMoveVerifications(newVerifications);
      setSelectedSolutionSquare(null);
      setLegalMoves([]);
      toast({ title: "Move Undone", description: "Last solution move removed" });
    }
  }, [solutionMoves, moveVerifications, toast]);
  
  // Clear all solution moves
  const clearAllSolutionMoves = useCallback(() => {
    setSolutionMoves(['']);
    setMoveVerifications({});
    setSelectedSolutionSquare(null);
    setLegalMoves([]);
    toast({ title: "Cleared", description: "All solution moves cleared" });
  }, [toast]);

  const handleSquareClick = useCallback((rankIdx: number, fileIdx: number) => {
    const actualRank = displayRanks[rankIdx];
    const actualFile = displayFiles[fileIdx];
    const boardRank = RANKS.indexOf(actualRank);
    const boardFile = FILES.indexOf(actualFile);
    
    if (selectedPiece) {
      const newBoard = board.map(row => [...row]);
      if (selectedPiece === "eraser") {
        newBoard[boardRank][boardFile] = null;
      } else {
        newBoard[boardRank][boardFile] = selectedPiece;
      }
      setBoard(newBoard);
    }
  }, [selectedPiece, board, displayRanks, displayFiles]);

  const handleClearBoard = () => {
    setBoard(createEmptyBoard());
  };

  const handleResetToStarting = () => {
    setBoard(fenToBoard("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR"));
  };

  const handleFlipBoard = () => {
    setOrientation(orientation === "white" ? "black" : "white");
  };

  const addSolutionMove = () => {
    setSolutionMoves([...solutionMoves, ""]);
  };

  const updateSolutionMove = (index: number, value: string) => {
    const newMoves = [...solutionMoves];
    newMoves[index] = value;
    setSolutionMoves(newMoves);
    // Clear verification for this move and all subsequent moves when changed
    const newVerifications = { ...moveVerifications };
    for (let i = index; i < solutionMoves.length; i++) {
      delete newVerifications[i];
    }
    setMoveVerifications(newVerifications);
  };

  const removeSolutionMove = (index: number) => {
    if (solutionMoves.length > 1) {
      setSolutionMoves(solutionMoves.filter((_, i) => i !== index));
      // Clear verifications for removed and subsequent moves
      const newVerifications = { ...moveVerifications };
      for (let i = index; i < solutionMoves.length; i++) {
        delete newVerifications[i];
      }
      setMoveVerifications(newVerifications);
    }
  };

  // Stockfish verification mutation
  const verifyMoveMutation = useMutation({
    mutationFn: async ({ fen, move, moveIndex }: { fen: string; move: string; moveIndex: number }) => {
      const res = await apiRequest("POST", "/api/puzzles/verify-move", { fen, move });
      return { ...(await res.json()), moveIndex };
    },
    onMutate: ({ moveIndex }) => {
      setVerifyingMoveIndex(moveIndex);
    },
    onSuccess: (data) => {
      setMoveVerifications(prev => ({
        ...prev,
        [data.moveIndex]: {
          classification: data.classification,
          isBestMove: data.isBestMove,
          stockfishBestMove: data.stockfishBestMove,
          evaluation: data.evaluation,
          isMate: data.isMate,
          mateIn: data.mateIn,
          fromCache: data.fromCache,
        },
      }));
      setVerifyingMoveIndex(null);
    },
    onError: (error: any) => {
      toast({ title: "Verification Failed", description: error.message, variant: "destructive" });
      setVerifyingMoveIndex(null);
    },
  });

  // Build FEN at a given move index (position after moves 0..index-1)
  const getFenAtMoveIndex = (moveIndex: number): string | null => {
    const baseFen = boardToFen(board, whoToMove);
    if (moveIndex === 0) return baseFen;
    
    try {
      const chess = new Chess(baseFen);
      for (let i = 0; i < moveIndex; i++) {
        const move = solutionMoves[i]?.trim();
        if (!move) return null;
        const result = chess.move(move);
        if (!result) return null;
      }
      return chess.fen();
    } catch {
      return null;
    }
  };

  const verifyMove = (moveIndex: number) => {
    const move = solutionMoves[moveIndex]?.trim();
    if (!move) {
      toast({ title: "No Move", description: "Enter a move first", variant: "destructive" });
      return;
    }
    
    const fen = getFenAtMoveIndex(moveIndex);
    if (!fen) {
      toast({ 
        title: "Invalid Position", 
        description: moveIndex > 0 ? "Previous moves are invalid" : "Set up a valid position first", 
        variant: "destructive" 
      });
      return;
    }
    
    verifyMoveMutation.mutate({ fen, move, moveIndex });
  };

  const addHint = () => {
    if (hintInput.trim()) {
      setHints([...hints, hintInput.trim()]);
      setHintInput("");
    }
  };

  const removeHint = (index: number) => {
    setHints(hints.filter((_, i) => i !== index));
  };

  const getSquareColor = (fileIndex: number, rankIndex: number) => {
    const isLight = (fileIndex + rankIndex) % 2 === 0;
    return isLight ? "bg-[#f0d9b5]" : "bg-[#b58863]";
  };

  const createPuzzleMutation = useMutation({
    mutationFn: async () => {
      const fen = boardToFen(board, whoToMove);
      const validMoves = solutionMoves.filter(m => m.trim());
      
      return apiRequest("POST", "/api/puzzles", {
        fen,
        moves: validMoves,
        solution: validMoves,
        rating: difficulty === "beginner" ? 1000 : difficulty === "intermediate" ? 1400 : difficulty === "advanced" ? 1800 : 2200,
        puzzleType,
        difficulty,
        hints,
        sourceType,
        sourceName: sourceName || null,
        whoToMove,
        themes: [],
      });
    },
    onSuccess: () => {
      toast({
        title: "Puzzle Created!",
        description: "Your puzzle has been submitted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/puzzles"] });
      setLocation("/puzzles");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create puzzle",
        variant: "destructive",
      });
    },
  });

  const canProceedToStep2 = board.some(row => row.some(cell => cell !== null));
  const canProceedToStep3 = puzzleType && difficulty && solutionMoves.some(m => m.trim());
  const canSubmit = sourceType && hasPermission;

  const hasPieces = board.some(row => row.some(cell => cell !== null));

  return (
    <div className="min-h-screen p-4 md:p-8 bg-muted/30">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Create a Puzzle</h1>
          <p className="text-muted-foreground">Share your chess puzzles with the community</p>
        </div>

        <div className="flex items-center gap-2 mb-6">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div 
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                  ${step === s ? "bg-primary text-primary-foreground" : 
                    step > s ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}
              >
                {s}
              </div>
              <span className={`text-sm hidden sm:inline ${step === s ? "font-medium" : "text-muted-foreground"}`}>
                {s === 1 ? "Set Up Position" : s === 2 ? "Puzzle Details" : "Source"}
              </span>
              {s < 3 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            </div>
          ))}
        </div>

        {step === 1 && (
          <div className="grid lg:grid-cols-[1fr_350px] gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Board Setup</CardTitle>
                <CardDescription>Click a piece from the palette, then click squares to place it</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="aspect-square max-w-[500px] mx-auto">
                  <div className="grid grid-cols-8 grid-rows-8 gap-0 w-full h-full border-2 border-foreground/20 rounded">
                    {displayRanks.map((rank, rankIdx) =>
                      displayFiles.map((file, fileIdx) => {
                        const boardRank = RANKS.indexOf(rank);
                        const boardFile = FILES.indexOf(file);
                        const piece = board[boardRank]?.[boardFile];
                        
                        return (
                          <div
                            key={`${file}${rank}`}
                            data-testid={`editor-square-${file}${rank}`}
                            onClick={() => handleSquareClick(rankIdx, fileIdx)}
                            className={`
                              relative flex items-center justify-center cursor-pointer
                              ${getSquareColor(fileIdx, rankIdx)}
                              ${selectedPiece ? "hover:ring-2 hover:ring-primary hover:ring-inset" : ""}
                            `}
                          >
                            {piece && (
                              <span className={`text-3xl sm:text-4xl select-none ${
                                piece === piece.toUpperCase() ? "text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]" : "text-black"
                              }`}>
                                {PIECE_SYMBOLS[piece]}
                              </span>
                            )}
                            {fileIdx === 0 && (
                              <span className="absolute bottom-0.5 left-1 text-xs font-semibold select-none opacity-70">
                                {rank}
                              </span>
                            )}
                            {rankIdx === 7 && (
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

                <div className="flex flex-wrap gap-2 mt-4 justify-center">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleClearBoard}
                    data-testid="button-clear-board"
                  >
                    <Trash2 className="h-4 w-4 mr-1" /> Clear
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleResetToStarting}
                    data-testid="button-reset-starting"
                  >
                    <RotateCcw className="h-4 w-4 mr-1" /> Starting Position
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleFlipBoard}
                    data-testid="button-flip-board"
                  >
                    <FlipVertical className="h-4 w-4 mr-1" /> Flip Board
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Piece Palette</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-sm text-muted-foreground mb-2 block">White Pieces</Label>
                    <div className="flex gap-1">
                      {WHITE_PIECES.map((piece) => (
                        <button
                          key={piece}
                          data-testid={`piece-${piece}`}
                          onClick={() => setSelectedPiece(selectedPiece === piece ? null : piece)}
                          className={`w-10 h-10 flex items-center justify-center rounded border-2 transition-colors
                            ${selectedPiece === piece ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"}`}
                        >
                          <span className="text-2xl text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">
                            {PIECE_SYMBOLS[piece]}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-sm text-muted-foreground mb-2 block">Black Pieces</Label>
                    <div className="flex gap-1">
                      {BLACK_PIECES.map((piece) => (
                        <button
                          key={piece}
                          data-testid={`piece-${piece}`}
                          onClick={() => setSelectedPiece(selectedPiece === piece ? null : piece)}
                          className={`w-10 h-10 flex items-center justify-center rounded border-2 transition-colors
                            ${selectedPiece === piece ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"}`}
                        >
                          <span className="text-2xl text-black">
                            {PIECE_SYMBOLS[piece]}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <Button
                    variant={selectedPiece === "eraser" ? "default" : "outline"}
                    size="sm"
                    className="w-full"
                    onClick={() => setSelectedPiece(selectedPiece === "eraser" ? null : "eraser")}
                    data-testid="button-eraser"
                  >
                    <Trash2 className="h-4 w-4 mr-2" /> Eraser Tool
                  </Button>

                  {selectedPiece && (
                    <p className="text-sm text-center text-muted-foreground">
                      {selectedPiece === "eraser" ? "Click squares to remove pieces" : `Selected: ${PIECE_SYMBOLS[selectedPiece] || selectedPiece}`}
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Who to Move</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Button
                      variant={whoToMove === "white" ? "default" : "outline"}
                      className="flex-1"
                      onClick={() => setWhoToMove("white")}
                      data-testid="button-white-to-move"
                    >
                      <span className="text-lg mr-2">♔</span> White
                    </Button>
                    <Button
                      variant={whoToMove === "black" ? "default" : "outline"}
                      className="flex-1"
                      onClick={() => setWhoToMove("black")}
                      data-testid="button-black-to-move"
                    >
                      <span className="text-lg mr-2">♚</span> Black
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Button
                className="w-full"
                size="lg"
                disabled={!canProceedToStep2}
                onClick={() => setStep(2)}
                data-testid="button-next-step-1"
              >
                Continue <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
              {!hasPieces && (
                <p className="text-sm text-muted-foreground text-center">
                  Place at least one piece to continue
                </p>
              )}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="grid lg:grid-cols-[300px_1fr] gap-6">
            <Card className="h-fit">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Puzzle Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="puzzleType">Puzzle Type</Label>
                  <Select value={puzzleType} onValueChange={setPuzzleType}>
                    <SelectTrigger id="puzzleType" data-testid="select-puzzle-type">
                      <SelectValue placeholder="Select puzzle type" />
                    </SelectTrigger>
                    <SelectContent>
                      {PUZZLE_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="difficulty">Difficulty</Label>
                  <Select value={difficulty} onValueChange={setDifficulty}>
                    <SelectTrigger id="difficulty" data-testid="select-difficulty">
                      <SelectValue placeholder="Select difficulty" />
                    </SelectTrigger>
                    <SelectContent>
                      {DIFFICULTIES.map((diff) => (
                        <SelectItem key={diff.value} value={diff.value}>
                          {diff.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Solution Moves</Label>
                  <p className="text-sm text-muted-foreground mb-2">
                    Enter moves in algebraic notation (e.g., Qxf7+, Nf3, e4). Verify with Stockfish to check quality.
                  </p>
                  <div className="space-y-3">
                    {solutionMoves.map((move, index) => {
                      const verification = moveVerifications[index];
                      const isVerifying = verifyingMoveIndex === index;
                      
                      return (
                        <div key={index} className="space-y-1">
                          <div className="flex gap-2 items-center">
                            <span className="w-8 h-9 flex items-center justify-center text-sm text-muted-foreground">
                              {index + 1}.
                            </span>
                            <Input
                              value={move}
                              onChange={(e) => updateSolutionMove(index, e.target.value)}
                              placeholder={`Move ${index + 1}`}
                              data-testid={`input-solution-move-${index}`}
                              className={verification ? (
                                verification.isBestMove ? 'border-green-500' : 
                                verification.classification === 'Good' || verification.classification === 'Okay' ? 'border-blue-500' :
                                'border-orange-500'
                              ) : ''}
                            />
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={() => verifyMove(index)}
                                  disabled={isVerifying || !move.trim()}
                                  data-testid={`button-verify-move-${index}`}
                                >
                                  {isVerifying ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : verification ? (
                                    verification.isBestMove ? (
                                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                                    ) : (
                                      <Sparkles className="h-4 w-4 text-blue-500" />
                                    )
                                  ) : (
                                    <Sparkles className="h-4 w-4" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                {verification ? 'Re-verify with Stockfish' : 'Verify with Stockfish'}
                              </TooltipContent>
                            </Tooltip>
                            {solutionMoves.length > 1 && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeSolutionMove(index)}
                                data-testid={`button-remove-move-${index}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                          {verification && (
                            <div className="ml-10 flex items-center gap-2 text-sm">
                              <Badge 
                                variant={verification.isBestMove ? "default" : "secondary"}
                                className={verification.isBestMove ? 'bg-green-600' : ''}
                              >
                                {verification.classification}
                              </Badge>
                              {!verification.isBestMove && (
                                <span className="text-muted-foreground">
                                  Best: {verification.stockfishBestMove}
                                </span>
                              )}
                              <span className="text-muted-foreground">
                                Eval: {verification.isMate ? `M${verification.mateIn}` : verification.evaluation.toFixed(2)}
                              </span>
                              {verification.fromCache && (
                                <Badge variant="outline" className="text-xs">cached</Badge>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={addSolutionMove}
                    data-testid="button-add-move"
                  >
                    <Plus className="h-4 w-4 mr-2" /> Add Move
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <MousePointerClick className="h-5 w-5" />
                      Interactive Board
                    </CardTitle>
                    <div className="flex gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={undoLastSolutionMove}
                            disabled={solutionMoves.filter(m => m.trim()).length === 0}
                            data-testid="button-undo-solution-move"
                          >
                            <Undo2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Undo last move</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={clearAllSolutionMoves}
                            disabled={solutionMoves.filter(m => m.trim()).length === 0}
                            data-testid="button-clear-solution-moves"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Clear all moves</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                  <CardDescription>Click pieces to make moves and build your solution</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="aspect-square max-w-[450px] mx-auto border-2 border-foreground/20 rounded overflow-visible">
                    <div className="grid grid-cols-8 grid-rows-8 gap-0 w-full h-full">
                      {RANKS.map((rank, rankIdx) =>
                        FILES.map((file, fileIdx) => {
                          const square = `${file}${rank}`;
                          const workingBoard = workingPosition.board;
                          const piece = workingBoard[rankIdx]?.[fileIdx];
                          const isSelected = selectedSolutionSquare === square;
                          const isLegalTarget = legalMoves.includes(square);
                          
                          return (
                            <div
                              key={square}
                              data-testid={`solution-square-${square}`}
                              onClick={() => handleSolutionSquareClick(square)}
                              className={`
                                relative flex items-center justify-center cursor-pointer transition-all
                                ${getSquareColor(fileIdx, rankIdx)}
                                ${isSelected ? "ring-2 ring-primary ring-inset" : ""}
                                ${isLegalTarget ? "ring-2 ring-green-500 ring-inset" : ""}
                                hover:brightness-110
                              `}
                            >
                              {piece && (
                                <span className={`text-2xl select-none ${
                                  piece === piece.toUpperCase() ? "text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]" : "text-black"
                                }`}>
                                  {PIECE_SYMBOLS[piece]}
                                </span>
                              )}
                              {isLegalTarget && !piece && (
                                <div className="w-3 h-3 rounded-full bg-green-500/60" />
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                  <div className="text-center mt-3 space-y-1">
                    <p className="text-sm text-muted-foreground">
                      {(() => {
                        try {
                          const chess = new Chess(workingPosition.fen);
                          return chess.turn() === 'w' ? "White" : "Black";
                        } catch {
                          return whoToMove === "white" ? "White" : "Black";
                        }
                      })()} to move
                    </p>
                    {solutionMoves.filter(m => m.trim()).length > 0 && (
                      <p className="text-sm font-medium text-primary">
                        {solutionMoves.filter(m => m.trim()).length} move{solutionMoves.filter(m => m.trim()).length !== 1 ? 's' : ''} in solution
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Lightbulb className="h-4 w-4" /> Hints (Optional)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-2">
                    <Input
                      value={hintInput}
                      onChange={(e) => setHintInput(e.target.value)}
                      placeholder="Enter a hint..."
                      onKeyDown={(e) => e.key === "Enter" && addHint()}
                      data-testid="input-hint"
                    />
                    <Button onClick={addHint} data-testid="button-add-hint">Add</Button>
                  </div>
                  
                  {hints.length > 0 && (
                    <div className="space-y-2">
                      {hints.map((hint, index) => (
                        <div key={index} className="flex items-start gap-2 p-2 bg-muted rounded">
                          <Badge variant="secondary" className="shrink-0">
                            Hint {index + 1}
                          </Badge>
                          <p className="text-sm flex-1">{hint}</p>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => removeHint(index)}
                            data-testid={`button-remove-hint-${index}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-2 flex gap-4 justify-between">
              <Button variant="outline" onClick={() => setStep(1)} data-testid="button-back-step-2">
                <ChevronLeft className="h-4 w-4 mr-2" /> Back
              </Button>
              <Button
                disabled={!canProceedToStep3}
                onClick={() => setStep(3)}
                data-testid="button-next-step-2"
              >
                Continue <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="max-w-2xl mx-auto">
            <Card>
              <CardHeader>
                <CardTitle>Puzzle Source</CardTitle>
                <CardDescription>Tell us where this puzzle came from</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-3">
                  {SOURCE_TYPES.map((source) => {
                    const Icon = source.icon;
                    return (
                      <button
                        key={source.value}
                        onClick={() => setSourceType(source.value)}
                        data-testid={`source-${source.value}`}
                        className={`p-4 rounded-lg border-2 text-left transition-colors
                          ${sourceType === source.value 
                            ? "border-primary bg-primary/5" 
                            : "border-border hover:border-primary/50"}`}
                      >
                        <Icon className="h-5 w-5 mb-2" />
                        <p className="font-medium text-sm">{source.label}</p>
                      </button>
                    );
                  })}
                </div>

                {(sourceType === "book" || sourceType === "youtube" || sourceType === "other") && (
                  <div className="space-y-2">
                    <Label htmlFor="sourceName">
                      {sourceType === "book" ? "Book Title" : 
                       sourceType === "youtube" ? "YouTube Channel/Video" : 
                       "Source Description"}
                    </Label>
                    <Input
                      id="sourceName"
                      value={sourceName}
                      onChange={(e) => setSourceName(e.target.value)}
                      placeholder={
                        sourceType === "book" ? "e.g., My System by Nimzowitsch" :
                        sourceType === "youtube" ? "e.g., Agadmator's Chess Channel" :
                        "Describe the source..."
                      }
                      data-testid="input-source-name"
                    />
                  </div>
                )}

                <div className="p-4 bg-muted rounded-lg">
                  <h4 className="font-medium mb-2">Puzzle Summary</h4>
                  <div className="space-y-1 text-sm">
                    <p><span className="text-muted-foreground">Type:</span> {PUZZLE_TYPES.find(t => t.value === puzzleType)?.label}</p>
                    <p><span className="text-muted-foreground">Difficulty:</span> {DIFFICULTIES.find(d => d.value === difficulty)?.label}</p>
                    <p><span className="text-muted-foreground">Solution:</span> {solutionMoves.filter(m => m.trim()).join(", ")}</p>
                    <p><span className="text-muted-foreground">Hints:</span> {hints.length || "None"}</p>
                    <p><span className="text-muted-foreground">Who to move:</span> {whoToMove === "white" ? "White" : "Black"}</p>
                  </div>
                </div>

                <div className="p-4 border rounded-lg bg-card">
                  <div className="flex items-start gap-3">
                    <Checkbox 
                      id="permission"
                      checked={hasPermission}
                      onCheckedChange={(checked) => setHasPermission(checked === true)}
                      data-testid="checkbox-permission"
                    />
                    <div className="space-y-1">
                      <Label htmlFor="permission" className="text-sm font-medium leading-none cursor-pointer">
                        Rights Confirmation
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        I confirm this puzzle is my original creation, or I have permission to share it, or it is in the public domain. I understand my puzzle may be removed if it infringes on copyrights. By submitting, I agree to the <a href="/terms" className="underline hover:text-primary" data-testid="link-terms-of-service">Terms of Service</a>.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 justify-between pt-4">
                  <Button variant="outline" onClick={() => setStep(2)} data-testid="button-back-step-3">
                    <ChevronLeft className="h-4 w-4 mr-2" /> Back
                  </Button>
                  <Button
                    disabled={!canSubmit || createPuzzleMutation.isPending}
                    onClick={() => createPuzzleMutation.mutate()}
                    data-testid="button-submit-puzzle"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {createPuzzleMutation.isPending ? "Creating..." : "Create Puzzle"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
