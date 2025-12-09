import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { ChessBoard } from "@/components/chess-board";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Chess } from "chess.js";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { 
  Brain, 
  CheckCircle2, 
  XCircle, 
  SkipForward, 
  Plus, 
  ThumbsUp, 
  ThumbsDown, 
  Trophy, 
  Star,
  Filter,
  Clock,
  TrendingUp,
  CheckCircle,
  AlertCircle,
  Share2,
  Puzzle as PuzzleIcon,
  Eye,
  RotateCcw
} from "lucide-react";
import type { Puzzle } from "@shared/schema";

const PUZZLE_TYPES = [
  { value: "all", label: "All Types" },
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
  { value: "all", label: "All Difficulties" },
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
  { value: "expert", label: "Expert" },
];

const SORT_OPTIONS = [
  { value: "newest", label: "Newest First" },
  { value: "popular", label: "Most Popular" },
  { value: "rating", label: "Highest Rated" },
];

const PIECE_SYMBOLS: Record<string, string> = {
  K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘", P: "♙",
  k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟",
};

function fenToMiniBoard(fen: string): (string | null)[][] {
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
}

function MiniChessboard({ fen, size = 120 }: { fen: string; size?: number }) {
  const board = fenToMiniBoard(fen);
  const squareSize = size / 8;
  
  return (
    <div 
      className="grid grid-cols-8 border border-border rounded overflow-hidden"
      style={{ width: size, height: size }}
    >
      {board.map((row, rankIdx) =>
        row.map((piece, fileIdx) => {
          const isLight = (fileIdx + rankIdx) % 2 === 0;
          return (
            <div
              key={`${rankIdx}-${fileIdx}`}
              className={`flex items-center justify-center ${isLight ? "bg-[#f0d9b5]" : "bg-[#b58863]"}`}
              style={{ width: squareSize, height: squareSize }}
            >
              {piece && (
                <span 
                  className={`select-none ${
                    piece === piece.toUpperCase() 
                      ? "text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]" 
                      : "text-black"
                  }`}
                  style={{ fontSize: squareSize * 0.7 }}
                >
                  {PIECE_SYMBOLS[piece]}
                </span>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

function PuzzleCard({ puzzle, onVote }: { puzzle: Puzzle & { userVote?: string | null }; onVote: (type: string) => void }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const getDifficultyColor = (difficulty: string | null) => {
    switch (difficulty) {
      case "beginner": return "bg-green-500/20 text-green-600 dark:text-green-400";
      case "intermediate": return "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400";
      case "advanced": return "bg-orange-500/20 text-orange-600 dark:text-orange-400";
      case "expert": return "bg-red-500/20 text-red-600 dark:text-red-400";
      default: return "bg-muted text-muted-foreground";
    }
  };
  
  const getTypeLabel = (type: string | null) => {
    const found = PUZZLE_TYPES.find(t => t.value === type);
    return found?.label || type || "Unknown";
  };
  
  const handleShare = () => {
    const url = `${window.location.origin}/puzzle/${puzzle.shareCode}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Link copied!", description: "Puzzle link copied to clipboard" });
  };
  
  return (
    <Card className="group hover-elevate cursor-pointer transition-all" data-testid={`puzzle-card-${puzzle.id}`}>
      <CardContent className="p-4">
        <div className="flex gap-4">
          <div onClick={() => setLocation(`/puzzle/${puzzle.id}`)} className="shrink-0">
            <MiniChessboard fen={puzzle.fen} size={100} />
          </div>
          
          <div className="flex-1 min-w-0" onClick={() => setLocation(`/puzzle/${puzzle.id}`)}>
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <Badge className={getDifficultyColor(puzzle.difficulty)} data-testid={`badge-difficulty-${puzzle.id}`}>
                {puzzle.difficulty || "Unknown"}
              </Badge>
              <Badge variant="outline" className="text-xs" data-testid={`badge-type-${puzzle.id}`}>
                {getTypeLabel(puzzle.puzzleType)}
              </Badge>
              {puzzle.isVerified && (
                <Badge className="bg-primary/20 text-primary">
                  <CheckCircle className="h-3 w-3 mr-1" /> Verified
                </Badge>
              )}
              {!puzzle.isVerified && (
                <Badge variant="secondary" className="text-xs">
                  <AlertCircle className="h-3 w-3 mr-1" /> Unverified
                </Badge>
              )}
            </div>
            
            <p className="text-sm text-muted-foreground mb-2 line-clamp-1">
              {puzzle.whoToMove === "white" ? "White" : "Black"} to move
              {puzzle.rating && ` • Rating: ${puzzle.rating}`}
            </p>
            
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Star className="h-3 w-3" />
                {puzzle.upvotes || 0}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {puzzle.solveCount || 0} solves
              </span>
            </div>
          </div>
          
          <div className="flex flex-col gap-2 shrink-0">
            <Button
              size="icon"
              variant={puzzle.userVote === 'up' ? "default" : "outline"}
              onClick={(e) => { e.stopPropagation(); onVote('up'); }}
              data-testid={`button-upvote-${puzzle.id}`}
              className="h-8 w-8"
            >
              <ThumbsUp className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant={puzzle.userVote === 'down' ? "destructive" : "outline"}
              onClick={(e) => { e.stopPropagation(); onVote('down'); }}
              data-testid={`button-downvote-${puzzle.id}`}
              className="h-8 w-8"
            >
              <ThumbsDown className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={(e) => { e.stopPropagation(); handleShare(); }}
              data-testid={`button-share-${puzzle.id}`}
              className="h-8 w-8"
            >
              <Share2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PuzzleOfTheDay() {
  const [, setLocation] = useLocation();
  
  const { data: puzzle, isLoading } = useQuery<Puzzle>({
    queryKey: ["/api/puzzles/of-the-day"],
  });
  
  if (isLoading) {
    return (
      <Card className="border-2 border-primary/30 bg-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            Puzzle of the Day
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }
  
  if (!puzzle) {
    return null;
  }
  
  return (
    <Card 
      className="border-2 border-primary/30 bg-primary/5 cursor-pointer hover-elevate"
      onClick={() => setLocation(`/puzzle/${puzzle.id}`)}
      data-testid="card-puzzle-of-day"
    >
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" />
          Puzzle of the Day
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4 items-center">
          <MiniChessboard fen={puzzle.fen} size={100} />
          <div>
            <p className="font-medium mb-1">
              {puzzle.whoToMove === "white" ? "White" : "Black"} to move
            </p>
            <p className="text-sm text-muted-foreground">
              {puzzle.puzzleType && PUZZLE_TYPES.find(t => t.value === puzzle.puzzleType)?.label}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Rating: {puzzle.rating || "Unrated"}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TrainTab() {
  const { toast } = useToast();
  const [solved, setSolved] = useState<boolean | null>(null);
  const [currentFen, setCurrentFen] = useState<string | null>(null);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [legalMoves, setLegalMoves] = useState<string[]>([]);
  const [moveIndex, setMoveIndex] = useState(0);
  const [showSolution, setShowSolution] = useState(false);

  const { data: puzzle, isLoading } = useQuery<Puzzle>({
    queryKey: ["/api/puzzles/random"],
  });

  // Reset state when puzzle changes
  useEffect(() => {
    if (puzzle?.fen) {
      setCurrentFen(puzzle.fen);
      setMoveIndex(0);
      setSolved(null);
      setSelectedSquare(null);
      setLegalMoves([]);
      setShowSolution(false);
    }
  }, [puzzle?.id, puzzle?.fen]);

  const handleSquareClick = (square: string) => {
    if (!currentFen || solved !== null) return;
    
    const chess = new Chess(currentFen);
    
    // If we already have a selected piece, try to make the move
    if (selectedSquare) {
      try {
        const result = chess.move({
          from: selectedSquare,
          to: square,
          promotion: 'q', // Auto-queen for simplicity
        });
        
        if (result) {
          setCurrentFen(chess.fen());
          setSelectedSquare(null);
          setLegalMoves([]);
          
          // Check if move matches solution (normalize to handle both string and array formats)
          const normMoves = (m: string | string[] | null | undefined): string[] => {
            if (!m) return [];
            if (Array.isArray(m)) return m.filter(x => x && x.length > 0);
            if (typeof m === 'string') return m.replace(/,/g, ' ').split(/\s+/).filter(x => x.length > 0);
            return [];
          };
          const rawSol = normMoves(puzzle?.solution);
          const rawMov = normMoves(puzzle?.moves);
          const solutionMoves = rawSol.length > 0 ? rawSol : rawMov;
          if (solutionMoves.length > moveIndex) {
            const expectedMove = solutionMoves[moveIndex];
            const moveStr = `${result.from}${result.to}`;
            const moveWithPromo = result.promotion ? `${moveStr}${result.promotion}` : moveStr;
            
            const normalizedExpected = expectedMove.toLowerCase().replace(/[+#=]/g, '');
            const normalizedSan = result.san.toLowerCase().replace(/[+#=]/g, '');
            
            const isCorrect = 
              moveStr === expectedMove || 
              moveWithPromo === expectedMove ||
              result.san === expectedMove ||
              result.lan === expectedMove ||
              normalizedSan === normalizedExpected ||
              moveStr === normalizedExpected;
            
            if (isCorrect) {
              setMoveIndex(moveIndex + 1);
              
              // Check if puzzle is complete
              if (moveIndex + 1 >= solutionMoves.length) {
                setSolved(true);
                toast({ title: "Correct!", description: "You solved the puzzle!" });
              } else if (solutionMoves.length > moveIndex + 1) {
                // Make opponent's response after a short delay
                setTimeout(() => {
                  try {
                    const opponentMove = solutionMoves[moveIndex + 1];
                    const chessAfter = new Chess(chess.fen());
                    chessAfter.move(opponentMove);
                    setCurrentFen(chessAfter.fen());
                    setMoveIndex(moveIndex + 2);
                  } catch (e) {
                    console.error("Error making opponent move:", e);
                  }
                }, 500);
              }
            } else {
              // Wrong move - show feedback and reset
              setSolved(false);
              toast({ 
                title: "Incorrect", 
                description: "That's not the best move. Try again!",
                variant: "destructive"
              });
              setTimeout(() => {
                setCurrentFen(puzzle?.fen || currentFen);
                setMoveIndex(0);
                setSolved(null);
              }, 1500);
            }
          }
          return;
        }
      } catch (e) {
        // Invalid move, deselect
      }
      
      setSelectedSquare(null);
      setLegalMoves([]);
    }
    
    // Select a piece if it's the right color's turn
    const piece = chess.get(square as any);
    if (piece) {
      const turn = chess.turn();
      const pieceColor = piece.color;
      if ((turn === 'w' && pieceColor === 'w') || (turn === 'b' && pieceColor === 'b')) {
        setSelectedSquare(square);
        const moves = chess.moves({ square: square as any, verbose: true });
        setLegalMoves(moves.map(m => m.to));
      }
    }
  };

  const handleReset = () => {
    if (puzzle?.fen) {
      setCurrentFen(puzzle.fen);
      setMoveIndex(0);
      setSolved(null);
      setSelectedSquare(null);
      setLegalMoves([]);
      setShowSolution(false);
    }
  };

  const handleSkip = () => {
    setSolved(null);
    setCurrentFen(null);
    setSelectedSquare(null);
    setLegalMoves([]);
    setMoveIndex(0);
    setShowSolution(false);
    queryClient.invalidateQueries({ queryKey: ["/api/puzzles/random"] });
  };

  const handleShowSolution = () => {
    setShowSolution(true);
  };

  // Helper to normalize moves (handle both string and array formats, including comma-separated)
  const normalizeMoves = (moves: string | string[] | null | undefined): string[] => {
    if (!moves) return [];
    if (Array.isArray(moves)) return moves.filter(m => m && m.length > 0);
    if (typeof moves === 'string') {
      // Handle comma-separated, space-separated, or mixed formats
      return moves
        .replace(/,/g, ' ')
        .split(/\s+/)
        .filter(m => m.length > 0);
    }
    return [];
  };

  // Get solution moves for display (prefer solution if it has content, otherwise use moves)
  const rawSolution = normalizeMoves(puzzle?.solution);
  const rawMoves = normalizeMoves(puzzle?.moves);
  const solutionMoves = rawSolution.length > 0 ? rawSolution : rawMoves;

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="space-y-4">
        {isLoading ? (
          <Skeleton className="aspect-square w-full max-w-[500px]" />
        ) : (
          <div className="max-w-[500px]">
            <ChessBoard
              fen={currentFen || puzzle?.fen || "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"}
              orientation={puzzle?.whoToMove === "black" ? "black" : "white"}
              showCoordinates={true}
              onSquareClick={handleSquareClick}
              selectedSquare={selectedSquare}
              legalMoveSquares={legalMoves}
            />
          </div>
        )}
        
        <div className="flex gap-3 max-w-[500px]">
          <Button
            variant="outline"
            onClick={handleReset}
            data-testid="button-reset-puzzle"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={handleShowSolution}
            disabled={showSolution || solved === true}
            data-testid="button-show-solution"
          >
            <Eye className="mr-2 h-4 w-4" />
            Show Solution
          </Button>
          <Button
            className="flex-1"
            onClick={handleSkip}
            data-testid="button-skip-puzzle"
          >
            <SkipForward className="mr-2 h-4 w-4" />
            {solved === true ? "Next Puzzle" : "Skip"}
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                Puzzle Training
              </CardTitle>
              {puzzle?.rating && (
                <Badge variant="secondary" className="font-mono">
                  {puzzle.rating}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ) : (
              <>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">
                    Find the best move
                  </p>
                  <p className="text-lg">
                    {puzzle?.whoToMove === "black" ? "Black" : "White"} to move and win
                  </p>
                  {solutionMoves.length > 1 && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {solutionMoves.length} moves to find
                    </p>
                  )}
                </div>

                {puzzle?.themes && puzzle.themes.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">Themes</p>
                    <div className="flex flex-wrap gap-2">
                      {puzzle.themes.map((theme, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {theme}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {showSolution && !solved && (
                  <div className="p-4 rounded-lg border bg-muted/50">
                    <p className="text-sm font-medium mb-2">Solution:</p>
                    <p className="font-mono text-sm">
                      {solutionMoves.join(' ')}
                    </p>
                  </div>
                )}

                {solved !== null && (
                  <div className={`p-4 rounded-lg border ${
                    solved 
                      ? "bg-green-500/10 border-green-500/20" 
                      : "bg-red-500/10 border-red-500/20"
                  }`}>
                    <div className="flex items-center gap-2 mb-2">
                      {solved ? (
                        <>
                          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                          <p className="font-semibold text-green-600 dark:text-green-400">
                            Correct!
                          </p>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                          <p className="font-semibold text-red-600 dark:text-red-400">
                            Not quite
                          </p>
                        </>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {solved 
                        ? "Excellent! You found the winning move." 
                        : "That's not the best move. Try again!"}
                    </p>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Your Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold">0</p>
                <p className="text-xs text-muted-foreground">Solved Today</p>
              </div>
              <div>
                <p className="text-2xl font-bold">0</p>
                <p className="text-xs text-muted-foreground">Total Solved</p>
              </div>
              <div>
                <p className="text-2xl font-bold">0%</p>
                <p className="text-xs text-muted-foreground">Success Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function BrowseTab() {
  const { toast } = useToast();
  
  const [puzzleType, setPuzzleType] = useState("all");
  const [difficulty, setDifficulty] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  
  const { data: puzzles, isLoading } = useQuery<Puzzle[]>({
    queryKey: ["/api/puzzles", { type: puzzleType !== "all" ? puzzleType : undefined, difficulty: difficulty !== "all" ? difficulty : undefined, sortBy }],
  });
  
  const voteMutation = useMutation({
    mutationFn: async ({ puzzleId, voteType }: { puzzleId: string; voteType: string }) => {
      return apiRequest("POST", `/api/puzzles/${puzzleId}/vote`, { voteType });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/puzzles"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to vote",
        variant: "destructive",
      });
    },
  });
  
  const handleVote = (puzzleId: string, voteType: string) => {
    voteMutation.mutate({ puzzleId, voteType });
  };

  return (
    <div className="grid lg:grid-cols-[1fr_300px] gap-6">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-3 p-4 bg-card rounded-lg border">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
          </div>
          
          <Select value={puzzleType} onValueChange={setPuzzleType}>
            <SelectTrigger className="w-[180px]" data-testid="select-puzzle-type">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              {PUZZLE_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={difficulty} onValueChange={setDifficulty}>
            <SelectTrigger className="w-[180px]" data-testid="select-difficulty">
              <SelectValue placeholder="Difficulty" />
            </SelectTrigger>
            <SelectContent>
              {DIFFICULTIES.map((d) => (
                <SelectItem key={d.value} value={d.value}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[180px]" data-testid="select-sort">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    <Skeleton className="h-[100px] w-[100px]" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-6 w-1/3" />
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-4 w-1/4" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : puzzles && puzzles.length > 0 ? (
          <div className="space-y-4">
            {puzzles.map((puzzle) => (
              <PuzzleCard
                key={puzzle.id}
                puzzle={puzzle as Puzzle & { userVote?: string | null }}
                onVote={(type) => handleVote(puzzle.id, type)}
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground mb-4">No puzzles found. Be the first to create one!</p>
              <Link href="/puzzles/create">
                <Button>
                  <Plus className="h-4 w-4 mr-2" /> Create Puzzle
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
      
      <div className="space-y-6">
        <PuzzleOfTheDay />
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Statistics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Puzzles</span>
              <span className="font-medium">{puzzles?.length || 0}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MyPuzzlesTab() {
  const { toast } = useToast();
  
  const { data: myPuzzles, isLoading } = useQuery<Puzzle[]>({
    queryKey: ["/api/puzzles/my-puzzles"],
  });
  
  const voteMutation = useMutation({
    mutationFn: async ({ puzzleId, voteType }: { puzzleId: string; voteType: string }) => {
      return apiRequest("POST", `/api/puzzles/${puzzleId}/vote`, { voteType });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/puzzles/my-puzzles"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to vote",
        variant: "destructive",
      });
    },
  });
  
  const handleVote = (puzzleId: string, voteType: string) => {
    voteMutation.mutate({ puzzleId, voteType });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex gap-4">
                <Skeleton className="h-[100px] w-[100px]" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-6 w-1/3" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-1/4" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!myPuzzles || myPuzzles.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground mb-4">You haven't created any puzzles yet.</p>
          <Link href="/puzzles/create">
            <Button>
              <Plus className="h-4 w-4 mr-2" /> Create Your First Puzzle
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {myPuzzles.map((puzzle) => (
        <PuzzleCard
          key={puzzle.id}
          puzzle={puzzle as Puzzle & { userVote?: string | null }}
          onVote={(type) => handleVote(puzzle.id, type)}
        />
      ))}
    </div>
  );
}

export default function Puzzles() {
  const [activeTab, setActiveTab] = useState("train");

  return (
    <div className="min-h-screen p-4 md:p-8 bg-muted/30">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
              <PuzzleIcon className="h-6 w-6" />
              Puzzles
            </h1>
            <p className="text-muted-foreground">Train your tactical skills and explore community puzzles</p>
          </div>
          
          <Link href="/puzzles/create">
            <Button data-testid="button-create-puzzle">
              <Plus className="h-4 w-4 mr-2" /> Create Puzzle
            </Button>
          </Link>
        </div>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="train" data-testid="tab-train">
              <Brain className="h-4 w-4 mr-2" /> Train
            </TabsTrigger>
            <TabsTrigger value="browse" data-testid="tab-browse">
              <PuzzleIcon className="h-4 w-4 mr-2" /> Browse
            </TabsTrigger>
            <TabsTrigger value="my-puzzles" data-testid="tab-my-puzzles">
              <Star className="h-4 w-4 mr-2" /> My Puzzles
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="train">
            <TrainTab />
          </TabsContent>
          
          <TabsContent value="browse">
            <BrowseTab />
          </TabsContent>
          
          <TabsContent value="my-puzzles">
            <MyPuzzlesTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
