import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Book, Plus, Search, ChevronRight, Play, Trash2, CheckCircle, XCircle, RotateCcw, ArrowLeft } from "lucide-react";
import { ChessBoard } from "@/components/chess-board";
import { Chess } from "chess.js";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Opening, Repertoire, RepertoireLine, PracticeHistory } from "@shared/schema";

type PracticeHistoryWithLine = PracticeHistory & { line: RepertoireLine };

type ViewMode = "list" | "browse" | "train";

export default function RepertoireTrainer() {
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [ecoFilter, setEcoFilter] = useState("");
  const [selectedOpening, setSelectedOpening] = useState<Opening | null>(null);
  const [selectedRepertoire, setSelectedRepertoire] = useState<Repertoire | null>(null);
  const [newRepertoireName, setNewRepertoireName] = useState("");
  const [newRepertoireColor, setNewRepertoireColor] = useState<"white" | "black">("white");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const { data: repertoires, isLoading: repertoiresLoading } = useQuery<Repertoire[]>({
    queryKey: ["/api/repertoires"],
  });

  const openingsQueryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('search', searchQuery);
    if (ecoFilter) params.set('eco', ecoFilter);
    if (newRepertoireColor) params.set('color', newRepertoireColor);
    params.set('limit', '100');
    return params.toString();
  }, [searchQuery, ecoFilter, newRepertoireColor]);

  const { data: openings, isLoading: openingsLoading } = useQuery<Opening[]>({
    queryKey: ["/api/openings", searchQuery, ecoFilter, newRepertoireColor],
    queryFn: async () => {
      const url = `/api/openings${openingsQueryParams ? `?${openingsQueryParams}` : ''}`;
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch openings');
      return res.json();
    },
    enabled: viewMode === "browse" || createDialogOpen,
  });

  const createRepertoireMutation = useMutation({
    mutationFn: async (data: { name: string; color: string; openingId?: string }) => {
      return await apiRequest("POST", "/api/repertoires", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/repertoires"] });
      setCreateDialogOpen(false);
      setNewRepertoireName("");
      setSelectedOpening(null);
      toast({
        title: "Repertoire created",
        description: "Your new opening repertoire is ready for training.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create repertoire",
        variant: "destructive",
      });
    },
  });

  const deleteRepertoireMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/repertoires/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/repertoires"] });
      toast({
        title: "Repertoire deleted",
        description: "The repertoire has been removed.",
      });
    },
  });

  const ecoGroups = useMemo(() => {
    return ["A", "B", "C", "D", "E"];
  }, []);

  const filteredOpenings = useMemo(() => {
    if (!openings) return [];
    return openings;
  }, [openings]);

  const handleCreateRepertoire = () => {
    if (!newRepertoireName.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a name for your repertoire.",
        variant: "destructive",
      });
      return;
    }

    createRepertoireMutation.mutate({
      name: newRepertoireName,
      color: newRepertoireColor,
      openingId: selectedOpening?.id,
    });
  };

  const handleStartTraining = (repertoire: Repertoire) => {
    setSelectedRepertoire(repertoire);
    setViewMode("train");
  };

  if (viewMode === "train" && selectedRepertoire) {
    return (
      <TrainingView
        repertoire={selectedRepertoire}
        onBack={() => {
          setViewMode("list");
          setSelectedRepertoire(null);
        }}
      />
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Training</div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Opening Repertoire Trainer</h1>
          <p className="text-sm text-muted-foreground mt-1">Build and practice your opening repertoires</p>
        </div>

        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-repertoire">
              <Plus className="w-4 h-4 mr-2" />
              New Repertoire
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>Create New Repertoire</DialogTitle>
              <DialogDescription>
                Select an opening from the Lichess database or create a custom repertoire.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="repertoire-name">Repertoire Name</Label>
                  <Input
                    id="repertoire-name"
                    placeholder="e.g., Sicilian Defense"
                    value={newRepertoireName}
                    onChange={(e) => setNewRepertoireName(e.target.value)}
                    data-testid="input-repertoire-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Playing Color</Label>
                  <Select value={newRepertoireColor} onValueChange={(v) => setNewRepertoireColor(v as "white" | "black")}>
                    <SelectTrigger data-testid="select-color">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="white">White</SelectItem>
                      <SelectItem value="black">Black</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Select Opening (Optional)</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Search openings..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1"
                    data-testid="input-opening-search"
                  />
                  <Select value={ecoFilter || "all"} onValueChange={(v) => setEcoFilter(v === "all" ? "" : v)}>
                    <SelectTrigger className="w-24" data-testid="select-eco-filter">
                      <SelectValue placeholder="ECO" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {ecoGroups.map((eco) => (
                        <SelectItem key={eco} value={eco}>{eco}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="border rounded-md h-[300px] overflow-y-auto" data-testid="openings-list-container">
                <div className="p-2 space-y-1">
                  {openingsLoading ? (
                    <div className="p-4 text-center text-muted-foreground">Loading openings...</div>
                  ) : filteredOpenings.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground">No openings found</div>
                  ) : (
                    filteredOpenings.map((opening) => (
                      <div
                        key={opening.id}
                        className={`p-3 rounded-md cursor-pointer transition-colors hover-elevate ${
                          selectedOpening?.id === opening.id
                            ? "bg-primary/20 border border-primary"
                            : "hover:bg-muted"
                        }`}
                        onClick={() => {
                          setSelectedOpening(opening);
                          if (!newRepertoireName) {
                            setNewRepertoireName(opening.name);
                          }
                        }}
                        data-testid={`opening-item-${opening.id}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{opening.name}</div>
                            <div className="text-xs text-muted-foreground font-mono">{opening.eco} - {opening.pgn}</div>
                          </div>
                          <Badge variant="secondary" className="shrink-0">{opening.eco}</Badge>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {selectedOpening && (
                <Card className="bg-muted/50">
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm">Selected: {selectedOpening.name}</CardTitle>
                  </CardHeader>
                </Card>
              )}
            </div>

            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreateRepertoire}
                disabled={createRepertoireMutation.isPending}
                data-testid="button-confirm-create"
              >
                {createRepertoireMutation.isPending ? "Creating..." : "Create Repertoire"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {repertoiresLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : repertoires && repertoires.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {repertoires.map((repertoire) => (
            <Card key={repertoire.id} className="hover-elevate" data-testid={`repertoire-card-${repertoire.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg truncate">{repertoire.name}</CardTitle>
                    <CardDescription className="flex items-center gap-2 mt-1">
                      <Badge variant={repertoire.color === "white" ? "outline" : "secondary"}>
                        {repertoire.color}
                      </Badge>
                    </CardDescription>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => deleteRepertoireMutation.mutate(repertoire.id)}
                    data-testid={`button-delete-${repertoire.id}`}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Button
                  className="w-full"
                  onClick={() => handleStartTraining(repertoire)}
                  data-testid={`button-train-${repertoire.id}`}
                >
                  <Play className="w-4 h-4 mr-2" />
                  Start Training
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-8 text-center">
          <Book className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Repertoires Yet</h3>
          <p className="text-muted-foreground mb-4">
            Create your first opening repertoire to start training your openings.
          </p>
          <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-create-first-repertoire">
            <Plus className="w-4 h-4 mr-2" />
            Create Your First Repertoire
          </Button>
        </Card>
      )}
    </div>
  );
}

function TrainingView({ repertoire, onBack }: { repertoire: Repertoire; onBack: () => void }) {
  const { toast } = useToast();
  const [game] = useState(() => new Chess());
  const [currentFen, setCurrentFen] = useState(game.fen());
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [isUserTurn, setIsUserTurn] = useState(true);
  const [feedback, setFeedback] = useState<"correct" | "incorrect" | null>(null);
  const [sessionStats, setSessionStats] = useState({ correct: 0, incorrect: 0 });
  const [showSolution, setShowSolution] = useState(false);
  const [currentLine, setCurrentLine] = useState<RepertoireLine | PracticeHistoryWithLine | null>(null);
  const [allLinesCompleted, setAllLinesCompleted] = useState(false);

  const { data: practiceData, isLoading: practiceLoading, refetch: refetchPractice } = useQuery<{
    dueLines: PracticeHistoryWithLine[];
    newLines: RepertoireLine[];
  }>({
    queryKey: ["/api/repertoires", repertoire.id, "practice"],
    refetchOnWindowFocus: false,
  });

  const { data: lichessData } = useQuery({
    queryKey: ["/api/lichess/explorer", { fen: currentFen }],
    enabled: !isUserTurn && !allLinesCompleted,
  });

  const recordResultMutation = useMutation({
    mutationFn: async ({ lineId, correct }: { lineId: string; correct: boolean }) => {
      return await apiRequest("POST", `/api/practice/${lineId}/result`, { correct });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/repertoires", repertoire.id, "practice"] });
    },
  });

  const lines = useMemo(() => {
    if (!practiceData) return [];
    const due = practiceData.dueLines || [];
    const newLines = practiceData.newLines || [];
    return [...due, ...newLines];
  }, [practiceData]);

  useEffect(() => {
    if (lines.length > 0 && currentLineIndex < lines.length) {
      const line = lines[currentLineIndex];
      setCurrentLine(line);
      game.load('line' in line ? line.line.fen : line.fen);
      setCurrentFen(game.fen());
      setIsUserTurn(true);
      setFeedback(null);
      setShowSolution(false);
    } else if (lines.length > 0 && currentLineIndex >= lines.length) {
      setAllLinesCompleted(true);
    }
  }, [lines, currentLineIndex, game]);

  const handleMove = useCallback((from: string, to: string) => {
    if (!isUserTurn || !currentLine) return false;

    const expectedMove = 'line' in currentLine ? currentLine.line.correctMove : currentLine.correctMove;
    const lineId = 'line' in currentLine ? currentLine.line.id : currentLine.id;

    const moveAttempt = game.move({ from, to, promotion: 'q' });
    if (!moveAttempt) return false;

    const isCorrect = moveAttempt.san === expectedMove || 
                      `${from}${to}` === expectedMove ||
                      moveAttempt.lan === expectedMove;

    if (isCorrect) {
      setFeedback("correct");
      setSessionStats(prev => ({ ...prev, correct: prev.correct + 1 }));
      recordResultMutation.mutate({ lineId, correct: true });
      setCurrentFen(game.fen());

      setTimeout(() => {
        setCurrentLineIndex(prev => prev + 1);
      }, 1000);
    } else {
      game.undo();
      setFeedback("incorrect");
      setSessionStats(prev => ({ ...prev, incorrect: prev.incorrect + 1 }));
      recordResultMutation.mutate({ lineId, correct: false });
      setShowSolution(true);
    }

    return isCorrect;
  }, [isUserTurn, currentLine, game, recordResultMutation]);

  const handleNextLine = () => {
    setCurrentLineIndex(prev => prev + 1);
  };

  const handleRestart = () => {
    setSessionStats({ correct: 0, incorrect: 0 });
    setAllLinesCompleted(false);
    
    if (lines.length > 0) {
      const line = lines[0];
      setCurrentLine(line);
      game.reset();
      game.load('line' in line ? line.line.fen : line.fen);
      setCurrentFen(game.fen());
      setIsUserTurn(true);
      setFeedback(null);
      setShowSolution(false);
      setCurrentLineIndex(0);
    } else {
      refetchPractice();
      setCurrentLineIndex(0);
    }
  };

  if (practiceLoading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="text-center">
          <Skeleton className="w-64 h-64 mx-auto mb-4" />
          <p className="text-muted-foreground">Loading practice session...</p>
        </div>
      </div>
    );
  }

  if (allLinesCompleted || lines.length === 0) {
    return (
      <div className="p-8">
        <Button variant="ghost" onClick={onBack} className="mb-4" data-testid="button-back">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Repertoires
        </Button>

        <Card className="max-w-md mx-auto text-center p-8">
          <CheckCircle className="w-16 h-16 mx-auto text-green-500 mb-4" />
          <h2 className="text-2xl font-bold mb-2">Training Complete!</h2>
          <p className="text-muted-foreground mb-6">
            {lines.length === 0 
              ? "No lines available for practice. Add more lines to your repertoire."
              : `You've completed all ${lines.length} lines in this session.`}
          </p>

          {sessionStats.correct + sessionStats.incorrect > 0 && (
            <div className="mb-6 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Accuracy</span>
                <span className="font-mono">
                  {Math.round((sessionStats.correct / (sessionStats.correct + sessionStats.incorrect)) * 100)}%
                </span>
              </div>
              <Progress 
                value={(sessionStats.correct / (sessionStats.correct + sessionStats.incorrect)) * 100} 
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span className="text-green-500">{sessionStats.correct} correct</span>
                <span className="text-red-500">{sessionStats.incorrect} incorrect</span>
              </div>
            </div>
          )}

          <div className="flex gap-2 justify-center">
            <Button variant="outline" onClick={onBack} data-testid="button-done">
              Done
            </Button>
            <Button onClick={handleRestart} data-testid="button-restart">
              <RotateCcw className="w-4 h-4 mr-2" />
              Practice Again
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const expectedMove = currentLine ? ('line' in currentLine ? currentLine.line.correctMove : currentLine.correctMove) : "";

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" onClick={onBack} data-testid="button-back">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div className="text-center">
          <h2 className="font-semibold">{repertoire.name}</h2>
          <p className="text-sm text-muted-foreground">
            Line {currentLineIndex + 1} of {lines.length}
          </p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-green-500">{sessionStats.correct} correct</span>
          <span className="text-red-500">{sessionStats.incorrect} incorrect</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 flex justify-center">
          <div className="w-full max-w-lg">
            <ChessBoard
              fen={currentFen}
              orientation={repertoire.color as "white" | "black"}
              onMove={handleMove}
              interactionMode={isUserTurn && !feedback ? "free" : "viewOnly"}
              data-testid="chessboard-training"
            />
          </div>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Your Move</CardTitle>
              <CardDescription>
                {repertoire.color === "white" ? "Play as White" : "Play as Black"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {feedback === "correct" && (
                <div className="flex items-center gap-2 p-3 bg-green-500/20 rounded-lg border border-green-500">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span className="font-medium text-green-500">Correct!</span>
                </div>
              )}

              {feedback === "incorrect" && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 p-3 bg-red-500/20 rounded-lg border border-red-500">
                    <XCircle className="w-5 h-5 text-red-500" />
                    <span className="font-medium text-red-500">Incorrect</span>
                  </div>
                  {showSolution && (
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground">Expected move:</p>
                      <p className="font-mono font-bold text-lg">{expectedMove}</p>
                    </div>
                  )}
                  <Button onClick={handleNextLine} className="w-full" data-testid="button-next">
                    Next Line
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              )}

              {!feedback && (
                <p className="text-muted-foreground">
                  Find the correct move in this position.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <Progress value={(currentLineIndex / lines.length) * 100} className="mb-2" />
              <p className="text-sm text-muted-foreground text-center">
                {currentLineIndex} of {lines.length} lines completed
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
