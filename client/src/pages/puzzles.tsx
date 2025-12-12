import { useState, useEffect, useRef } from "react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  RotateCcw,
  Flag
} from "lucide-react";
import type { Puzzle } from "@shared/schema";

const REPORT_REASONS = [
  { value: "incorrect_solution", label: "Incorrect Solution" },
  { value: "invalid_position", label: "Invalid Position" },
  { value: "duplicate", label: "Duplicate Puzzle" },
  { value: "inappropriate", label: "Inappropriate Content" },
  { value: "other", label: "Other" },
];

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

function PuzzleCard({ puzzle, onVote, onReport }: { puzzle: Puzzle & { userVote?: string | null }; onVote: (type: string) => void; onReport: (puzzleId: string) => void }) {
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
            <Button
              size="icon"
              variant="ghost"
              onClick={(e) => { e.stopPropagation(); onReport(puzzle.id); }}
              data-testid={`button-report-${puzzle.id}`}
              className="h-8 w-8"
            >
              <Flag className="h-4 w-4" />
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
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationIndex, setAnimationIndex] = useState(0);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [afterPuzzleId, setAfterPuzzleId] = useState<string | undefined>(undefined);
  
  // Refs to track pending timers so we can cancel them
  const opponentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Helper to clear all pending puzzle timers
  const clearPuzzleTimers = () => {
    if (opponentTimerRef.current) {
      clearTimeout(opponentTimerRef.current);
      opponentTimerRef.current = null;
    }
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
  };

  const { data: puzzle, isLoading } = useQuery<Puzzle>({
    queryKey: ["/api/puzzles/next", afterPuzzleId],
    queryFn: async () => {
      const url = afterPuzzleId 
        ? `/api/puzzles/next?afterId=${afterPuzzleId}` 
        : '/api/puzzles/next';
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch puzzle');
      return res.json();
    },
  });

  const reportMutation = useMutation({
    mutationFn: async ({ puzzleId, reason, details }: { puzzleId: string; reason: string; details?: string }) => {
      return apiRequest("POST", `/api/puzzles/${puzzleId}/report`, { reason, details });
    },
    onSuccess: () => {
      toast({ title: "Report Submitted", description: "Thank you for helping improve our puzzles!" });
      setReportDialogOpen(false);
      setReportReason("");
      setReportDetails("");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to submit report. Please try again.", variant: "destructive" });
    },
  });

  const voteMutation = useMutation({
    mutationFn: async ({ puzzleId, voteType }: { puzzleId: string; voteType: 'up' | 'down' }) => {
      return apiRequest("POST", `/api/puzzles/${puzzleId}/vote`, { voteType });
    },
    onSuccess: (_data, variables) => {
      // Update cache in place without refetching (which would advance puzzle)
      queryClient.setQueryData(["/api/puzzles/next", afterPuzzleId], (old: any) => {
        if (!old) return old;
        const currentVote = old.userVote;
        // Toggle behavior: clicking same vote removes it, different vote switches it
        const newVote = currentVote === variables.voteType ? null : variables.voteType;
        return { ...old, userVote: newVote };
      });
      toast({ title: "Vote Recorded", description: "Thank you for your feedback!" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to record vote. Please try again.", variant: "destructive" });
    },
  });

  const handleSubmitReport = () => {
    if (!puzzle?.id || !reportReason) return;
    reportMutation.mutate({ puzzleId: puzzle.id, reason: reportReason, details: reportDetails || undefined });
  };

  // Reset state when puzzle changes
  useEffect(() => {
    if (puzzle?.fen) {
      clearPuzzleTimers();
      setCurrentFen(puzzle.fen);
      setMoveIndex(0);
      setSolved(null);
      setSelectedSquare(null);
      setLegalMoves([]);
      setShowSolution(false);
      setIsAnimating(false);
      setAnimationIndex(0);
    }
  }, [puzzle?.id, puzzle?.fen]);

  // Helper to normalize moves (handle both string and array formats, including comma-separated)
  const normalizeMoves = (moves: string | string[] | null | undefined): string[] => {
    if (!moves) return [];
    if (Array.isArray(moves)) return moves.filter(m => m && m.length > 0);
    if (typeof moves === 'string') {
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

  // Animated solution playback - plays each move with 1 second delay
  useEffect(() => {
    if (!isAnimating || !puzzle?.fen || solutionMoves.length === 0) return;

    // If we've played all moves, stop animating
    if (animationIndex >= solutionMoves.length) {
      setIsAnimating(false);
      return;
    }

    // Build the position by replaying all moves up to animationIndex
    const chess = new Chess(puzzle.fen);
    for (let i = 0; i < animationIndex; i++) {
      try {
        chess.move(solutionMoves[i]);
      } catch (e) {
        console.error("Error replaying move:", solutionMoves[i], e);
      }
    }

    // Play the next move after 1 second delay
    const timer = setTimeout(() => {
      try {
        chess.move(solutionMoves[animationIndex]);
        setCurrentFen(chess.fen());
        setAnimationIndex(prev => prev + 1);
      } catch (e) {
        console.error("Error playing animated move:", solutionMoves[animationIndex], e);
        setIsAnimating(false);
      }
    }, animationIndex === 0 ? 0 : 1000); // No delay for first move, 1s for subsequent

    return () => clearTimeout(timer);
  }, [isAnimating, animationIndex, puzzle?.fen, solutionMoves]);

  const handleSquareClick = (square: string) => {
    // Disable interaction during animation or when solved
    if (!currentFen || solved !== null || isAnimating) return;
    
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
                opponentTimerRef.current = setTimeout(() => {
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
              resetTimerRef.current = setTimeout(() => {
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
      clearPuzzleTimers();
      setCurrentFen(puzzle.fen);
      setMoveIndex(0);
      setSolved(null);
      setSelectedSquare(null);
      setLegalMoves([]);
      setShowSolution(false);
      setIsAnimating(false);
      setAnimationIndex(0);
    }
  };

  const handleSkip = () => {
    clearPuzzleTimers();
    setSolved(null);
    setCurrentFen(null);
    setSelectedSquare(null);
    setLegalMoves([]);
    setMoveIndex(0);
    setShowSolution(false);
    setIsAnimating(false);
    setAnimationIndex(0);
    if (puzzle?.id) {
      setAfterPuzzleId(puzzle.id);
    }
  };

  const handleShowSolution = () => {
    // Cancel any pending timers before starting animation
    clearPuzzleTimers();
    setShowSolution(true);
    // Clear any in-progress state before starting animation
    setSolved(null);
    setSelectedSquare(null);
    setLegalMoves([]);
    setMoveIndex(0);
    // Start animated playback from the original puzzle position
    setCurrentFen(puzzle?.fen || null);
    setAnimationIndex(0);
    setIsAnimating(true);
  };

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
          <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                data-testid="button-report-puzzle"
              >
                <Flag className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Report Puzzle</DialogTitle>
                <DialogDescription>
                  Help us improve by reporting puzzles with issues.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="report-reason">Reason</Label>
                  <Select value={reportReason} onValueChange={setReportReason}>
                    <SelectTrigger id="report-reason" data-testid="select-report-reason">
                      <SelectValue placeholder="Select a reason" />
                    </SelectTrigger>
                    <SelectContent>
                      {REPORT_REASONS.map(reason => (
                        <SelectItem key={reason.value} value={reason.value}>
                          {reason.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="report-details">Details (optional)</Label>
                  <Textarea
                    id="report-details"
                    placeholder="Describe the issue..."
                    value={reportDetails}
                    onChange={(e) => setReportDetails(e.target.value)}
                    data-testid="textarea-report-details"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setReportDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmitReport}
                  disabled={!reportReason || reportMutation.isPending}
                  data-testid="button-submit-report"
                >
                  {reportMutation.isPending ? "Submitting..." : "Submit Report"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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
                    <p className="text-sm font-medium mb-2 flex items-center gap-2">
                      Solution:
                      {isAnimating && (
                        <span className="text-xs text-muted-foreground animate-pulse">
                          Playing...
                        </span>
                      )}
                    </p>
                    <p className="font-mono text-sm flex flex-wrap gap-1">
                      {solutionMoves.map((move, index) => (
                        <span
                          key={index}
                          className={`px-1.5 py-0.5 rounded transition-all duration-300 ${
                            index < animationIndex
                              ? "bg-green-500/20 text-green-600 dark:text-green-400"
                              : index === animationIndex && isAnimating
                              ? "bg-primary/20 text-primary font-bold scale-110"
                              : "text-muted-foreground"
                          }`}
                        >
                          {move}
                        </span>
                      ))}
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

                {(solved !== null || showSolution) && puzzle && (
                  <div className="p-4 rounded-lg border bg-muted/30">
                    <p className="text-sm font-medium text-muted-foreground mb-3">
                      Rate this puzzle
                    </p>
                    <div className="flex gap-3">
                      <Button
                        variant={(puzzle as any).userVote === 'up' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => puzzle?.id && voteMutation.mutate({ puzzleId: puzzle.id, voteType: 'up' })}
                        disabled={voteMutation.isPending}
                        data-testid="button-upvote-puzzle"
                      >
                        <ThumbsUp className="h-4 w-4 mr-2" />
                        Good Puzzle
                      </Button>
                      <Button
                        variant={(puzzle as any).userVote === 'down' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => puzzle?.id && voteMutation.mutate({ puzzleId: puzzle.id, voteType: 'down' })}
                        disabled={voteMutation.isPending}
                        data-testid="button-downvote-puzzle"
                      >
                        <ThumbsDown className="h-4 w-4 mr-2" />
                        Poor Puzzle
                      </Button>
                    </div>
                    {(puzzle as any).userVote && (
                      <p className="text-xs text-muted-foreground mt-2">
                        You voted: {(puzzle as any).userVote === 'up' ? 'Good' : 'Poor'} (click again to remove)
                      </p>
                    )}
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
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportPuzzleId, setReportPuzzleId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  
  const { data: puzzles, isLoading } = useQuery<Puzzle[]>({
    queryKey: ["/api/puzzles", puzzleType, difficulty, sortBy],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (puzzleType !== "all") params.set("type", puzzleType);
      if (difficulty !== "all") params.set("difficulty", difficulty);
      params.set("sortBy", sortBy);
      const url = `/api/puzzles${params.toString() ? `?${params.toString()}` : ''}`;
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch puzzles');
      return res.json();
    },
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

  const reportMutation = useMutation({
    mutationFn: async ({ puzzleId, reason, details }: { puzzleId: string; reason: string; details?: string }) => {
      return apiRequest("POST", `/api/puzzles/${puzzleId}/report`, { reason, details });
    },
    onSuccess: () => {
      toast({ title: "Report Submitted", description: "Thank you for helping improve our puzzles!" });
      setReportDialogOpen(false);
      setReportPuzzleId(null);
      setReportReason("");
      setReportDetails("");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to submit report. Please try again.", variant: "destructive" });
    },
  });
  
  const handleVote = (puzzleId: string, voteType: string) => {
    voteMutation.mutate({ puzzleId, voteType });
  };

  const handleReport = (puzzleId: string) => {
    setReportPuzzleId(puzzleId);
    setReportDialogOpen(true);
  };

  const handleSubmitReport = () => {
    if (!reportPuzzleId || !reportReason) return;
    reportMutation.mutate({ puzzleId: reportPuzzleId, reason: reportReason, details: reportDetails || undefined });
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
                onReport={handleReport}
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

      <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report Puzzle</DialogTitle>
            <DialogDescription>
              Help us improve by reporting puzzles with issues.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="browse-report-reason">Reason</Label>
              <Select value={reportReason} onValueChange={setReportReason}>
                <SelectTrigger id="browse-report-reason">
                  <SelectValue placeholder="Select a reason" />
                </SelectTrigger>
                <SelectContent>
                  {REPORT_REASONS.map(reason => (
                    <SelectItem key={reason.value} value={reason.value}>
                      {reason.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="browse-report-details">Details (optional)</Label>
              <Textarea
                id="browse-report-details"
                placeholder="Describe the issue..."
                value={reportDetails}
                onChange={(e) => setReportDetails(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmitReport}
              disabled={!reportReason || reportMutation.isPending}
            >
              {reportMutation.isPending ? "Submitting..." : "Submit Report"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MyPuzzlesTab() {
  const { toast } = useToast();
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportPuzzleId, setReportPuzzleId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  
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

  const reportMutation = useMutation({
    mutationFn: async ({ puzzleId, reason, details }: { puzzleId: string; reason: string; details?: string }) => {
      return apiRequest("POST", `/api/puzzles/${puzzleId}/report`, { reason, details });
    },
    onSuccess: () => {
      toast({ title: "Report Submitted", description: "Thank you for helping improve our puzzles!" });
      setReportDialogOpen(false);
      setReportPuzzleId(null);
      setReportReason("");
      setReportDetails("");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to submit report. Please try again.", variant: "destructive" });
    },
  });
  
  const handleVote = (puzzleId: string, voteType: string) => {
    voteMutation.mutate({ puzzleId, voteType });
  };

  const handleReport = (puzzleId: string) => {
    setReportPuzzleId(puzzleId);
    setReportDialogOpen(true);
  };

  const handleSubmitReport = () => {
    if (!reportPuzzleId || !reportReason) return;
    reportMutation.mutate({ puzzleId: reportPuzzleId, reason: reportReason, details: reportDetails || undefined });
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
    <>
      <div className="space-y-4">
        {myPuzzles.map((puzzle) => (
          <PuzzleCard
            key={puzzle.id}
            puzzle={puzzle as Puzzle & { userVote?: string | null }}
            onVote={(type) => handleVote(puzzle.id, type)}
            onReport={handleReport}
          />
        ))}
      </div>

      <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report Puzzle</DialogTitle>
            <DialogDescription>
              Help us improve by reporting puzzles with issues.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="mypuzzles-report-reason">Reason</Label>
              <Select value={reportReason} onValueChange={setReportReason}>
                <SelectTrigger id="mypuzzles-report-reason">
                  <SelectValue placeholder="Select a reason" />
                </SelectTrigger>
                <SelectContent>
                  {REPORT_REASONS.map(reason => (
                    <SelectItem key={reason.value} value={reason.value}>
                      {reason.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mypuzzles-report-details">Details (optional)</Label>
              <Textarea
                id="mypuzzles-report-details"
                placeholder="Describe the issue..."
                value={reportDetails}
                onChange={(e) => setReportDetails(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmitReport}
              disabled={!reportReason || reportMutation.isPending}
            >
              {reportMutation.isPending ? "Submitting..." : "Submit Report"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
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
