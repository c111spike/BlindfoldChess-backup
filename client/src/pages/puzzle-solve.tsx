import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link, useLocation } from "wouter";
import { Chess } from "chess.js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChessBoard } from "@/components/chess-board";
import { useToast } from "@/hooks/use-toast";
import { useHighlightColors } from "@/hooks/useHighlightColors";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  ThumbsUp, 
  ThumbsDown, 
  Flag, 
  Share2, 
  CheckCircle, 
  AlertCircle,
  ArrowLeft,
  Lightbulb,
  RotateCcw,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  XCircle,
  Youtube,
  ExternalLink
} from "lucide-react";
import type { Puzzle } from "@shared/schema";

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

const REPORT_REASONS = [
  { value: "incorrect_solution", label: "Incorrect Solution" },
  { value: "duplicate", label: "Duplicate Puzzle" },
  { value: "impossible", label: "Impossible Position" },
  { value: "inappropriate", label: "Inappropriate Content" },
  { value: "other", label: "Other" },
];

export default function PuzzleSolve() {
  const [, params] = useRoute("/puzzle/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const highlightColors = useHighlightColors();
  
  const puzzleId = params?.id;
  
  const [currentFen, setCurrentFen] = useState<string | null>(null);
  const [moveIndex, setMoveIndex] = useState(0);
  const [solved, setSolved] = useState<boolean | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [hintIndex, setHintIndex] = useState(0);
  
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDescription, setReportDescription] = useState("");
  
  const { data: puzzle, isLoading } = useQuery<Puzzle & { userVote?: string | null }>({
    queryKey: ["/api/puzzles", puzzleId],
    enabled: !!puzzleId,
  });
  
  useEffect(() => {
    if (puzzle?.fen) {
      setCurrentFen(puzzle.fen);
      setMoveIndex(0);
      setSolved(null);
    }
  }, [puzzle?.fen]);
  
  const voteMutation = useMutation({
    mutationFn: async (voteType: string) => {
      return apiRequest("POST", `/api/puzzles/${puzzleId}/vote`, { voteType });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/puzzles", puzzleId] });
      toast({ title: "Vote recorded!" });
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
    mutationFn: async () => {
      return apiRequest("POST", `/api/puzzles/${puzzleId}/report`, {
        reason: reportReason,
        description: reportDescription,
      });
    },
    onSuccess: () => {
      toast({ title: "Report submitted", description: "Thank you for helping improve our puzzle database." });
      setReportOpen(false);
      setReportReason("");
      setReportDescription("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit report",
        variant: "destructive",
      });
    },
  });
  
  const attemptMutation = useMutation({
    mutationFn: async (isSolved: boolean) => {
      return apiRequest("POST", "/api/puzzles/attempt", {
        puzzleId,
        solved: isSolved,
        timeSpent: 0,
      });
    },
  });
  
  const handleShare = () => {
    const url = `${window.location.origin}/puzzle/${puzzle?.shareCode || puzzleId}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Link copied!", description: "Puzzle link copied to clipboard" });
  };
  
  const handleReset = () => {
    if (puzzle?.fen) {
      setCurrentFen(puzzle.fen);
      setMoveIndex(0);
      setSolved(null);
      setShowHint(false);
      setHintIndex(0);
    }
  };
  
  const handleShowHint = () => {
    if (puzzle?.hints && puzzle.hints.length > 0) {
      setShowHint(true);
    }
  };
  
  const handleNextHint = () => {
    if (puzzle?.hints && hintIndex < puzzle.hints.length - 1) {
      setHintIndex(hintIndex + 1);
    }
  };
  
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [legalMoves, setLegalMoves] = useState<string[]>([]);

  const handleSquareClick = (square: string) => {
    if (!currentFen || solved !== null) return;
    
    const chess = new Chess(currentFen);
    
    if (selectedSquare) {
      try {
        const result = chess.move({
          from: selectedSquare,
          to: square,
          promotion: 'q',
        });
        
        if (result) {
          setCurrentFen(chess.fen());
          setSelectedSquare(null);
          setLegalMoves([]);
          
          const solutionMoves = puzzle?.solution || puzzle?.moves || [];
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
              
              if (moveIndex + 1 >= solutionMoves.length) {
                setSolved(true);
                attemptMutation.mutate(true);
                toast({ title: "Congratulations!", description: "You solved the puzzle!" });
              } else if (solutionMoves.length > moveIndex + 1) {
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
              setSolved(false);
              attemptMutation.mutate(false);
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
      }
      
      setSelectedSquare(null);
      setLegalMoves([]);
    }
    
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
  
  if (isLoading) {
    return (
      <div className="min-h-screen p-4 md:p-8 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-6">
            <Skeleton className="aspect-square w-full max-w-[500px]" />
            <div className="space-y-4">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  if (!puzzle) {
    return (
      <div className="min-h-screen p-4 md:p-8 bg-muted/30 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground mb-4">Puzzle not found</p>
            <Link href="/puzzles">
              <Button>
                <ArrowLeft className="h-4 w-4 mr-2" /> Back to Puzzles
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen p-4 md:p-8 bg-muted/30">
      <Helmet>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/puzzles">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-xl font-bold" data-testid="text-page-title">Solve Puzzle</h1>
        </div>
        
        <div className="grid lg:grid-cols-[1fr_350px] gap-6">
          <div className="space-y-4">
            <div className="max-w-[500px] mx-auto lg:mx-0">
              <ChessBoard
                fen={currentFen || puzzle.fen}
                orientation={puzzle.whoToMove === "black" ? "black" : "white"}
                showCoordinates={true}
                onSquareClick={handleSquareClick}
                selectedSquare={selectedSquare}
                legalMoveSquares={legalMoves}
                customHighlightColors={highlightColors}
              />
            </div>
            
            <div className="flex gap-3 max-w-[500px] mx-auto lg:mx-0">
              <Button
                variant="outline"
                onClick={handleReset}
                data-testid="button-reset"
              >
                <RotateCcw className="h-4 w-4 mr-2" /> Reset
              </Button>
              
              {puzzle.hints && puzzle.hints.length > 0 && (
                <Button
                  variant="outline"
                  onClick={handleShowHint}
                  disabled={showHint}
                  data-testid="button-hint"
                >
                  <Lightbulb className="h-4 w-4 mr-2" /> Hint
                </Button>
              )}
            </div>
            
            {solved !== null && (
              <div className={`max-w-[500px] mx-auto lg:mx-0 p-4 rounded-lg border ${
                solved 
                  ? "bg-green-500/10 border-green-500/20" 
                  : "bg-red-500/10 border-red-500/20"
              }`}>
                <div className="flex items-center gap-2">
                  {solved ? (
                    <>
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                      <p className="font-semibold text-green-600 dark:text-green-400">
                        Correct! Puzzle solved!
                      </p>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                      <p className="font-semibold text-red-600 dark:text-red-400">
                        Not quite - try again!
                      </p>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
          
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Puzzle Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge className={getDifficultyColor(puzzle.difficulty)}>
                    {puzzle.difficulty || "Unknown"}
                  </Badge>
                  <Badge variant="outline">
                    {getTypeLabel(puzzle.puzzleType)}
                  </Badge>
                  {puzzle.isVerified ? (
                    <Badge className="bg-primary/20 text-primary">
                      <CheckCircle className="h-3 w-3 mr-1" /> Verified
                    </Badge>
                  ) : (
                    <Badge variant="secondary">
                      <AlertCircle className="h-3 w-3 mr-1" /> Unverified
                    </Badge>
                  )}
                </div>
                
                <div className="space-y-2 text-sm">
                  <p>
                    <span className="text-muted-foreground">To Move: </span>
                    <span className="font-medium">
                      {puzzle.whoToMove === "black" ? "Black" : "White"}
                    </span>
                  </p>
                  {puzzle.rating && (
                    <p>
                      <span className="text-muted-foreground">Rating: </span>
                      <span className="font-medium">{puzzle.rating}</span>
                    </p>
                  )}
                  {puzzle.sourceType && (
                    <p>
                      <span className="text-muted-foreground">Source: </span>
                      <span className="font-medium">
                        {puzzle.sourceType === "created" ? "Original" : 
                         puzzle.sourceType === "book" ? `Book${puzzle.sourceName ? `: ${puzzle.sourceName}` : ""}` :
                         puzzle.sourceType === "youtube" ? `YouTube${puzzle.sourceName ? `: ${puzzle.sourceName}` : ""}` :
                         puzzle.sourceName || "Other"}
                      </span>
                    </p>
                  )}
                  {puzzle.youtubeVideoUrl && (
                    <a
                      href={puzzle.youtubeVideoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-primary hover:underline"
                      data-testid="link-youtube-video"
                    >
                      <Youtube className="h-4 w-4 text-red-500" />
                      <span>Watch Video</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
                
                <div className="flex items-center gap-2 pt-2 border-t">
                  <Button
                    size="sm"
                    variant={puzzle.userVote === 'up' ? "default" : "outline"}
                    onClick={() => voteMutation.mutate('up')}
                    data-testid="button-upvote"
                  >
                    <ThumbsUp className="h-4 w-4 mr-1" />
                    {puzzle.upvotes || 0}
                  </Button>
                  <Button
                    size="sm"
                    variant={puzzle.userVote === 'down' ? "destructive" : "outline"}
                    onClick={() => voteMutation.mutate('down')}
                    data-testid="button-downvote"
                  >
                    <ThumbsDown className="h-4 w-4 mr-1" />
                    {puzzle.downvotes || 0}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={handleShare}
                    data-testid="button-share"
                  >
                    <Share2 className="h-4 w-4" />
                  </Button>
                  
                  <Dialog open={reportOpen} onOpenChange={setReportOpen}>
                    <DialogTrigger asChild>
                      <Button size="icon" variant="ghost" data-testid="button-report">
                        <Flag className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Report Puzzle</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Reason</label>
                          <Select value={reportReason} onValueChange={setReportReason}>
                            <SelectTrigger data-testid="select-report-reason">
                              <SelectValue placeholder="Select a reason" />
                            </SelectTrigger>
                            <SelectContent>
                              {REPORT_REASONS.map((reason) => (
                                <SelectItem key={reason.value} value={reason.value}>
                                  {reason.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Description (optional)</label>
                          <Textarea
                            value={reportDescription}
                            onChange={(e) => setReportDescription(e.target.value)}
                            placeholder="Provide additional details..."
                            data-testid="input-report-description"
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setReportOpen(false)}>
                          Cancel
                        </Button>
                        <Button 
                          onClick={() => reportMutation.mutate()}
                          disabled={!reportReason || reportMutation.isPending}
                          data-testid="button-submit-report"
                        >
                          Submit Report
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>
            
            {showHint && puzzle.hints && puzzle.hints.length > 0 && (
              <Card className="border-yellow-500/30 bg-yellow-500/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-yellow-500" />
                    Hint {hintIndex + 1} of {puzzle.hints.length}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{puzzle.hints[hintIndex]}</p>
                  {hintIndex < puzzle.hints.length - 1 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={handleNextHint}
                      data-testid="button-next-hint"
                    >
                      Next Hint <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Solution</CardTitle>
              </CardHeader>
              <CardContent>
                {solved ? (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">You found the solution:</p>
                    <div className="flex flex-wrap gap-2">
                      {(puzzle.solution || puzzle.moves || []).map((move, i) => (
                        <Badge key={i} variant="outline" className="font-mono">
                          {i % 2 === 0 ? `${Math.floor(i/2) + 1}.` : ""} {move}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Solve the puzzle to see the solution
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
