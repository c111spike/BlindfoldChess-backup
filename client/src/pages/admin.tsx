import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Flag, 
  Users, 
  FileWarning,
  Eye,
  MessageSquare,
  Loader2,
  TrendingUp,
  Activity,
  Database,
  Gauge,
  Zap,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  RotateCcw,
  Cpu,
  Play,
  ExternalLink
} from "lucide-react";
import { ChessBoard } from "@/components/chess-board";
import { Chess } from "chess.js";
import { Input } from "@/components/ui/input";
import type { User, Puzzle, CheatReport, UserAntiCheat, PuzzleReport } from "@shared/schema";
import { Link } from "wouter";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface FlaggedPuzzleWithReports extends Puzzle {
  reports: PuzzleReport[];
}

interface FlaggedUserWithDetails extends UserAntiCheat {
  user: User;
  reportCount: number;
}

interface AntiCheatStats {
  totalFlagged: number;
  byPriority: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  unresolvedReports: number;
}

interface PerformanceStats {
  cacheHitRate: number;
  avgCacheLookupMs: number;
  avgAnalysisTimeMs: number;
  queueLength: number;
  peakQueueLength: number;
  totalCachedPositions: number;
  analysesCompleted: number;
  adaptiveScaledowns: number;
  avgNodesUsed: number;
  currentNodeCount: number;
  gamesAnalyzedToday: number;
  redisConnected?: boolean;
}

interface PuzzleAnalysis {
  fen: string;
  moveIndex: number;
  solutionMove: string;
  solutionMoveUci: string;
  stockfishBestMove: string;
  evaluation: number;
  isMate: boolean;
  mateIn?: number;
  isBestMove: boolean;
  classification: string;
  topMoves: Array<{
    move: string;
    evaluation: number;
    isMate: boolean;
    mateIn?: number;
  }>;
  principalVariation: string[];
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: "bg-red-500 text-white",
  high: "bg-orange-500 text-white",
  medium: "bg-yellow-500 text-black",
  low: "bg-gray-500 text-white",
};

const REVIEW_STATUS_LABELS: Record<string, string> = {
  pending: "Pending Review",
  under_review: "Under Review",
  warning_issued: "Warning Issued",
  cleared: "Cleared",
  dismissed: "Dismissed",
};

export default function AdminPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("flagged-players");
  const [selectedUser, setSelectedUser] = useState<FlaggedUserWithDetails | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [warningNotes, setWarningNotes] = useState("");
  const [reviewStatus, setReviewStatus] = useState("");
  
  // Puzzle Review state
  const [puzzleSearchQuery, setPuzzleSearchQuery] = useState("");
  const [selectedPuzzle, setSelectedPuzzle] = useState<Puzzle | null>(null);
  const [reviewMoveIndex, setReviewMoveIndex] = useState(0);
  const [puzzleAnalysis, setPuzzleAnalysis] = useState<PuzzleAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [reviewFen, setReviewFen] = useState<string | null>(null);

  const isAdmin = user?.isAdmin === true;

  const { data: stats, isLoading: statsLoading } = useQuery<AntiCheatStats>({
    queryKey: ["/api/admin/anti-cheat/stats"],
    enabled: isAdmin,
  });

  const { data: flaggedUsers, isLoading: flaggedLoading } = useQuery<FlaggedUserWithDetails[]>({
    queryKey: ["/api/admin/flagged-users"],
    enabled: isAdmin,
  });

  const { data: cheatReports, isLoading: reportsLoading } = useQuery<CheatReport[]>({
    queryKey: ["/api/admin/cheat-reports?isResolved=false"],
    enabled: isAdmin,
  });

  const { data: flaggedPuzzles, isLoading: puzzlesLoading } = useQuery<FlaggedPuzzleWithReports[]>({
    queryKey: ["/api/admin/puzzles/flagged"],
    enabled: isAdmin,
  });

  const { data: performanceStats, isLoading: performanceLoading, refetch: refetchPerformance } = useQuery<PerformanceStats>({
    queryKey: ["/api/admin/analysis/performance"],
    enabled: isAdmin,
    refetchInterval: 30000,
  });

  // All puzzles for review
  const { data: allPuzzles, isLoading: allPuzzlesLoading } = useQuery<Puzzle[]>({
    queryKey: ["/api/puzzles?sortBy=newest&limit=100"],
    enabled: isAdmin && activeTab === "puzzle-review",
  });

  // Filter puzzles based on search
  const filteredPuzzles = allPuzzles?.filter(p => {
    if (!puzzleSearchQuery) return true;
    const searchLower = puzzleSearchQuery.toLowerCase();
    return (
      p.puzzleType?.toLowerCase().includes(searchLower) ||
      p.id.toLowerCase().includes(searchLower) ||
      p.sourceName?.toLowerCase().includes(searchLower)
    );
  }) || [];

  // Analyze puzzle move
  const analyzePuzzleMutation = useMutation({
    mutationFn: async ({ puzzleId, moveIndex }: { puzzleId: string; moveIndex: number }) => {
      const res = await apiRequest("POST", `/api/admin/puzzles/${puzzleId}/analyze`, { moveIndex });
      return res.json();
    },
    onSuccess: (data: PuzzleAnalysis) => {
      setPuzzleAnalysis(data);
      setIsAnalyzing(false);
    },
    onError: (error: any) => {
      toast({ title: "Analysis Failed", description: error.message, variant: "destructive" });
      setIsAnalyzing(false);
    },
  });

  // Helper to navigate through puzzle moves
  const navigatePuzzleMove = (direction: 'prev' | 'next' | 'reset') => {
    if (!selectedPuzzle) return;
    const solution = selectedPuzzle.solution as string[];
    if (!solution) return;

    let newIndex = reviewMoveIndex;
    if (direction === 'prev' && reviewMoveIndex > 0) {
      newIndex = reviewMoveIndex - 1;
    } else if (direction === 'next' && reviewMoveIndex < solution.length) {
      newIndex = reviewMoveIndex + 1;
    } else if (direction === 'reset') {
      newIndex = 0;
    }

    setReviewMoveIndex(newIndex);
    setPuzzleAnalysis(null);

    // Build FEN at this move index
    try {
      const chess = new Chess(selectedPuzzle.fen);
      for (let i = 0; i < newIndex; i++) {
        chess.move(solution[i]);
      }
      setReviewFen(chess.fen());
    } catch (e) {
      setReviewFen(selectedPuzzle.fen);
    }
  };

  // Select a puzzle for review
  const selectPuzzleForReview = (puzzle: Puzzle) => {
    setSelectedPuzzle(puzzle);
    setReviewMoveIndex(0);
    setReviewFen(puzzle.fen);
    setPuzzleAnalysis(null);
  };

  const updateReviewMutation = useMutation({
    mutationFn: async ({ userId, status, notes }: { userId: string; status: string; notes?: string }) => {
      if (!isAdmin) throw new Error("Unauthorized");
      return apiRequest("POST", `/api/admin/users/${userId}/review`, { status, notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/flagged-users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/anti-cheat/stats"] });
      toast({ title: "Review Updated", description: "User review status has been updated." });
      setSelectedUser(null);
      setAdminNotes("");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const issueWarningMutation = useMutation({
    mutationFn: async ({ userId, notes }: { userId: string; notes: string }) => {
      if (!isAdmin) throw new Error("Unauthorized");
      return apiRequest("POST", `/api/admin/users/${userId}/warn`, { notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/flagged-users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/anti-cheat/stats"] });
      toast({ title: "Warning Issued", description: "The user has been warned." });
      setSelectedUser(null);
      setWarningNotes("");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const resolveReportMutation = useMutation({
    mutationFn: async ({ reportId, resolution }: { reportId: string; resolution: string }) => {
      if (!isAdmin) throw new Error("Unauthorized");
      return apiRequest("POST", `/api/admin/cheat-reports/${reportId}/resolve`, { resolution });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cheat-reports?isResolved=false"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/anti-cheat/stats"] });
      toast({ title: "Report Resolved", description: "The report has been resolved." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const verifyPuzzleMutation = useMutation({
    mutationFn: async (puzzleId: string) => {
      if (!isAdmin) throw new Error("Unauthorized");
      return apiRequest("POST", `/api/admin/puzzles/${puzzleId}/verify`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/puzzles/flagged"] });
      toast({ title: "Puzzle Verified", description: "The puzzle has been verified." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const removePuzzleMutation = useMutation({
    mutationFn: async (puzzleId: string) => {
      if (!isAdmin) throw new Error("Unauthorized");
      return apiRequest("POST", `/api/admin/puzzles/${puzzleId}/remove`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/puzzles/flagged"] });
      toast({ title: "Puzzle Removed", description: "The puzzle has been removed." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  if (!isAdmin) {
    return (
      <div className="p-8 text-center">
        <Shield className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
        <p className="text-muted-foreground">You do not have permission to access this page.</p>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-4xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground">Manage flagged players, reports, and moderation</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Flagged Players</p>
                <p className="text-3xl font-bold">{statsLoading ? "..." : stats?.totalFlagged || 0}</p>
              </div>
              <Users className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Critical Priority</p>
                <p className="text-3xl font-bold text-red-500">
                  {statsLoading ? "..." : stats?.byPriority.critical || 0}
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Reports</p>
                <p className="text-3xl font-bold">{statsLoading ? "..." : stats?.unresolvedReports || 0}</p>
              </div>
              <FileWarning className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Flagged Puzzles</p>
                <p className="text-3xl font-bold">{puzzlesLoading ? "..." : flaggedPuzzles?.length || 0}</p>
              </div>
              <Flag className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="flagged-players" data-testid="tab-flagged-players">
            <Users className="h-4 w-4 mr-2" />
            Flagged Players
          </TabsTrigger>
          <TabsTrigger value="cheat-reports" data-testid="tab-cheat-reports">
            <FileWarning className="h-4 w-4 mr-2" />
            Cheat Reports
          </TabsTrigger>
          <TabsTrigger value="flagged-puzzles" data-testid="tab-flagged-puzzles">
            <Flag className="h-4 w-4 mr-2" />
            Flagged Puzzles
          </TabsTrigger>
          <TabsTrigger value="performance" data-testid="tab-performance">
            <Activity className="h-4 w-4 mr-2" />
            Performance
          </TabsTrigger>
          <TabsTrigger value="puzzle-review" data-testid="tab-puzzle-review">
            <Cpu className="h-4 w-4 mr-2" />
            Puzzle Review
          </TabsTrigger>
        </TabsList>

        <TabsContent value="flagged-players" className="space-y-4">
          {flaggedLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}
            </div>
          ) : !flaggedUsers?.length ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                <h3 className="text-xl font-semibold mb-2">All Clear</h3>
                <p className="text-muted-foreground">No flagged players to review.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {flaggedUsers.map(fu => (
                <Card key={fu.id} data-testid={`flagged-user-${fu.userId}`}>
                  <CardContent className="py-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                          <Users className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-semibold">{fu.user.firstName} {fu.user.lastName}</p>
                          <p className="text-sm text-muted-foreground">{fu.user.email}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Risk Score:</span>
                            <span className="font-bold text-lg">{fu.riskScore?.toFixed(0) || 0}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Reports:</span>
                            <span>{fu.reportCount}</span>
                          </div>
                        </div>
                        
                        <Badge className={PRIORITY_COLORS[fu.reviewPriority || 'low']}>
                          {fu.reviewPriority?.toUpperCase()}
                        </Badge>
                        
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => setSelectedUser(fu)}
                              data-testid={`button-review-${fu.userId}`}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              Review
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle>Review Player: {fu.user.firstName} {fu.user.lastName}</DialogTitle>
                              <DialogDescription>
                                Review anti-cheat data and take appropriate action.
                              </DialogDescription>
                            </DialogHeader>
                            
                            <div className="grid gap-4 py-4">
                              <div className="grid grid-cols-3 gap-4">
                                <div className="p-3 bg-muted rounded-lg">
                                  <p className="text-sm text-muted-foreground">Risk Score</p>
                                  <p className="text-2xl font-bold">{fu.riskScore?.toFixed(1) || 0}</p>
                                </div>
                                <div className="p-3 bg-muted rounded-lg">
                                  <p className="text-sm text-muted-foreground">Reports</p>
                                  <p className="text-2xl font-bold">{fu.reportCount}</p>
                                </div>
                                <div className="p-3 bg-muted rounded-lg">
                                  <p className="text-sm text-muted-foreground">Warnings</p>
                                  <p className="text-2xl font-bold">{fu.warningCount || 0}</p>
                                </div>
                              </div>
                              
                              <div className="grid grid-cols-3 gap-4 text-sm">
                                <div>
                                  <p className="text-muted-foreground">Accuracy Anomaly</p>
                                  <p className="font-semibold">{fu.accuracyAnomaly?.toFixed(1) || 0}%</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Time Anomaly</p>
                                  <p className="font-semibold">{fu.timeAnomaly?.toFixed(1) || 0}%</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Simul Anomaly</p>
                                  <p className="font-semibold">{fu.simulAnomaly?.toFixed(1) || 0}%</p>
                                </div>
                              </div>
                              
                              {fu.flagReason && (
                                <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                                  <p className="text-sm font-medium">Flag Reason</p>
                                  <p className="text-sm text-muted-foreground">{fu.flagReason}</p>
                                </div>
                              )}
                              
                              {fu.adminNotes && (
                                <div className="p-3 bg-muted rounded-lg">
                                  <p className="text-sm font-medium">Previous Admin Notes</p>
                                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{fu.adminNotes}</p>
                                </div>
                              )}
                              
                              <div className="grid gap-2">
                                <Label>Update Status</Label>
                                <Select value={reviewStatus} onValueChange={setReviewStatus}>
                                  <SelectTrigger data-testid="select-review-status">
                                    <SelectValue placeholder="Select new status..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="under_review">Under Review</SelectItem>
                                    <SelectItem value="cleared">Cleared (No Action)</SelectItem>
                                    <SelectItem value="dismissed">Dismiss Flag</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              
                              <div className="grid gap-2">
                                <Label>Admin Notes</Label>
                                <Textarea
                                  value={adminNotes}
                                  onChange={(e) => setAdminNotes(e.target.value)}
                                  placeholder="Add notes about your review..."
                                  data-testid="input-admin-notes"
                                />
                              </div>
                            </div>
                            
                            <DialogFooter className="flex gap-2">
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button variant="destructive" data-testid="button-issue-warning">
                                    <AlertTriangle className="h-4 w-4 mr-1" />
                                    Issue Warning
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Issue Warning</DialogTitle>
                                    <DialogDescription>
                                      This will record a warning on the player's account.
                                    </DialogDescription>
                                  </DialogHeader>
                                  <div className="grid gap-4 py-4">
                                    <div className="grid gap-2">
                                      <Label>Warning Message</Label>
                                      <Textarea
                                        value={warningNotes}
                                        onChange={(e) => setWarningNotes(e.target.value)}
                                        placeholder="Reason for the warning..."
                                        data-testid="input-warning-notes"
                                      />
                                    </div>
                                  </div>
                                  <DialogFooter>
                                    <Button
                                      variant="destructive"
                                      onClick={() => fu && issueWarningMutation.mutate({ userId: fu.userId, notes: warningNotes })}
                                      disabled={!warningNotes || issueWarningMutation.isPending}
                                      data-testid="button-confirm-warning"
                                    >
                                      {issueWarningMutation.isPending ? (
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                      ) : null}
                                      Confirm Warning
                                    </Button>
                                  </DialogFooter>
                                </DialogContent>
                              </Dialog>
                              
                              <Button
                                onClick={() => fu && updateReviewMutation.mutate({ 
                                  userId: fu.userId, 
                                  status: reviewStatus, 
                                  notes: adminNotes 
                                })}
                                disabled={!reviewStatus || updateReviewMutation.isPending}
                                data-testid="button-update-status"
                              >
                                {updateReviewMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : null}
                                Update Status
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="cheat-reports" className="space-y-4">
          {reportsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}
            </div>
          ) : !cheatReports?.length ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                <h3 className="text-xl font-semibold mb-2">No Pending Reports</h3>
                <p className="text-muted-foreground">All cheat reports have been resolved.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {cheatReports.map(report => (
                <Card key={report.id} data-testid={`cheat-report-${report.id}`}>
                  <CardContent className="py-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">Report #{report.id.slice(0, 8)}</p>
                        <p className="text-sm text-muted-foreground">
                          Reason: {report.reason.replace(/_/g, ' ')}
                        </p>
                        {report.details && (
                          <p className="text-sm text-muted-foreground mt-1">{report.details}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">
                          Reported: {new Date(report.createdAt!).toLocaleString()}
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => resolveReportMutation.mutate({ 
                            reportId: report.id, 
                            resolution: "Reviewed and action taken" 
                          })}
                          disabled={resolveReportMutation.isPending}
                          data-testid={`button-resolve-${report.id}`}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Resolve
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => resolveReportMutation.mutate({ 
                            reportId: report.id, 
                            resolution: "Dismissed as invalid" 
                          })}
                          disabled={resolveReportMutation.isPending}
                          data-testid={`button-dismiss-${report.id}`}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Dismiss
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="flagged-puzzles" className="space-y-4">
          {puzzlesLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}
            </div>
          ) : !flaggedPuzzles?.length ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                <h3 className="text-xl font-semibold mb-2">No Flagged Puzzles</h3>
                <p className="text-muted-foreground">All puzzles are in good standing.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {flaggedPuzzles.map(puzzle => (
                <Card key={puzzle.id} data-testid={`flagged-puzzle-${puzzle.id}`}>
                  <CardContent className="py-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">{puzzle.puzzleType || 'Puzzle'}</p>
                        <p className="text-sm text-muted-foreground">
                          Type: {puzzle.puzzleType} | Difficulty: {puzzle.difficulty}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="secondary">
                            <TrendingUp className="h-3 w-3 mr-1" />
                            {puzzle.upvotes || 0} upvotes
                          </Badge>
                          <Badge variant="destructive">
                            {puzzle.downvotes || 0} downvotes
                          </Badge>
                          <Badge variant="outline">
                            {puzzle.reportCount || 0} reports
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Link href={`/puzzle/${puzzle.id}`}>
                          <Button
                            variant="outline"
                            size="sm"
                            data-testid={`button-view-puzzle-${puzzle.id}`}
                          >
                            <ExternalLink className="h-4 w-4 mr-1" />
                            View Puzzle
                          </Button>
                        </Link>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => verifyPuzzleMutation.mutate(puzzle.id)}
                          disabled={verifyPuzzleMutation.isPending}
                          data-testid={`button-verify-puzzle-${puzzle.id}`}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Verify
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => removePuzzleMutation.mutate(puzzle.id)}
                          disabled={removePuzzleMutation.isPending}
                          data-testid={`button-remove-puzzle-${puzzle.id}`}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Remove
                        </Button>
                      </div>
                    </div>
                    
                    {puzzle.reports && puzzle.reports.length > 0 && (
                      <Collapsible className="mt-4">
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm" className="w-full justify-between" data-testid={`button-toggle-reports-${puzzle.id}`}>
                            <span className="flex items-center gap-2">
                              <MessageSquare className="h-4 w-4" />
                              View {puzzle.reports.length} Report{puzzle.reports.length > 1 ? 's' : ''}
                            </span>
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-2 space-y-2">
                          {puzzle.reports.map((report) => (
                            <div 
                              key={report.id} 
                              className="p-3 bg-muted rounded-lg border-l-4 border-orange-500"
                              data-testid={`report-${report.id}`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <Badge variant="outline" className="text-xs">
                                  {report.reason}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {report.createdAt ? new Date(report.createdAt).toLocaleDateString() : 'Unknown date'}
                                </span>
                              </div>
                              {report.details && (
                                <p className="text-sm text-muted-foreground mt-1">{report.details}</p>
                              )}
                            </div>
                          ))}
                        </CollapsibleContent>
                      </Collapsible>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Analysis Performance Metrics</h2>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => refetchPerformance()}
              data-testid="button-refresh-performance"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>

          {performanceLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4, 5, 6, 7, 8].map(i => <Skeleton key={i} className="h-32" />)}
            </div>
          ) : performanceStats ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card data-testid="card-redis-status">
                  <CardHeader className="pb-2">
                    <CardDescription className="flex items-center gap-2">
                      <Database className="h-4 w-4" />
                      Redis Cache Status
                    </CardDescription>
                    <CardTitle className={`text-2xl ${performanceStats.redisConnected ? 'text-green-500' : 'text-orange-500'}`}>
                      {performanceStats.redisConnected ? 'Connected' : 'Not Connected'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      {performanceStats.redisConnected 
                        ? `Upstash Redis active with ${performanceStats.totalCachedPositions.toLocaleString()} cached positions`
                        : 'Using PostgreSQL fallback. Configure Upstash for better performance.'}
                    </p>
                  </CardContent>
                </Card>

                <Card data-testid="card-cache-lookup">
                  <CardHeader className="pb-2">
                    <CardDescription className="flex items-center gap-2">
                      <Zap className="h-4 w-4" />
                      Avg Cache Lookup
                    </CardDescription>
                    <CardTitle className={`text-2xl ${performanceStats.avgCacheLookupMs > 50 ? 'text-orange-500' : ''}`}>
                      {performanceStats.avgCacheLookupMs}ms
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      {performanceStats.avgCacheLookupMs > 50 
                        ? '⚠️ Consider Redis for faster lookups' 
                        : '✓ Database caching is performing well'}
                    </p>
                  </CardContent>
                </Card>

                <Card data-testid="card-cached-positions">
                  <CardHeader className="pb-2">
                    <CardDescription className="flex items-center gap-2">
                      <Database className="h-4 w-4" />
                      Cached Positions
                    </CardDescription>
                    <CardTitle className={`text-2xl ${performanceStats.totalCachedPositions > 100000 ? 'text-orange-500' : ''}`}>
                      {performanceStats.totalCachedPositions.toLocaleString()}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      {performanceStats.totalCachedPositions > 100000 
                        ? '⚠️ Consider Redis for large cache' 
                        : '✓ Cache size is manageable'}
                    </p>
                  </CardContent>
                </Card>

                <Card data-testid="card-queue-length">
                  <CardHeader className="pb-2">
                    <CardDescription className="flex items-center gap-2">
                      <Gauge className="h-4 w-4" />
                      Queue Length
                    </CardDescription>
                    <CardTitle className={`text-2xl ${performanceStats.queueLength > 5 ? 'text-orange-500' : ''}`}>
                      {performanceStats.queueLength}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      Peak: {performanceStats.peakQueueLength} | 
                      {performanceStats.queueLength > 5 
                        ? ' ⚠️ High load detected' 
                        : ' ✓ Normal load'}
                    </p>
                  </CardContent>
                </Card>

                <Card data-testid="card-analyses-completed">
                  <CardHeader className="pb-2">
                    <CardDescription className="flex items-center gap-2">
                      <Activity className="h-4 w-4" />
                      Games Analyzed Today
                    </CardDescription>
                    <CardTitle className="text-2xl">{performanceStats.gamesAnalyzedToday}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      Avg time: {performanceStats.avgAnalysisTimeMs}ms per game
                    </p>
                  </CardContent>
                </Card>

                <Card data-testid="card-current-nodes">
                  <CardHeader className="pb-2">
                    <CardDescription className="flex items-center gap-2">
                      <Gauge className="h-4 w-4" />
                      Current Node Count
                    </CardDescription>
                    <CardTitle className={`text-2xl ${performanceStats.currentNodeCount < 2000000 ? 'text-yellow-500' : ''}`}>
                      {(performanceStats.currentNodeCount / 1000000).toFixed(1)}M
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      {performanceStats.currentNodeCount < 2000000 
                        ? '⚠️ Reduced for high load' 
                        : '✓ Full accuracy mode'}
                    </p>
                  </CardContent>
                </Card>

                <Card data-testid="card-avg-nodes">
                  <CardHeader className="pb-2">
                    <CardDescription className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      Avg Nodes Used
                    </CardDescription>
                    <CardTitle className="text-2xl">
                      {(performanceStats.avgNodesUsed / 1000000).toFixed(1)}M
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      Average across all analyses
                    </p>
                  </CardContent>
                </Card>

                <Card data-testid="card-scaledowns">
                  <CardHeader className="pb-2">
                    <CardDescription className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Adaptive Scaledowns
                    </CardDescription>
                    <CardTitle className={`text-2xl ${performanceStats.adaptiveScaledowns > 10 ? 'text-orange-500' : ''}`}>
                      {performanceStats.adaptiveScaledowns}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      Times accuracy was reduced for performance
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="text-lg">When to Upgrade to Redis</CardTitle>
                  <CardDescription>
                    Monitor these indicators to know when database caching becomes insufficient
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className={`p-4 rounded-lg border ${performanceStats.avgCacheLookupMs > 50 ? 'border-orange-500 bg-orange-500/10' : 'border-green-500 bg-green-500/10'}`}>
                      <p className="font-medium">Cache Lookup Time</p>
                      <p className="text-sm text-muted-foreground">
                        {performanceStats.avgCacheLookupMs > 50 
                          ? 'Consider Redis - lookups exceeding 50ms' 
                          : 'OK - under 50ms threshold'}
                      </p>
                    </div>
                    <div className={`p-4 rounded-lg border ${performanceStats.totalCachedPositions > 100000 ? 'border-orange-500 bg-orange-500/10' : 'border-green-500 bg-green-500/10'}`}>
                      <p className="font-medium">Cache Size</p>
                      <p className="text-sm text-muted-foreground">
                        {performanceStats.totalCachedPositions > 100000 
                          ? 'Consider Redis - over 100k positions' 
                          : 'OK - under 100k positions'}
                      </p>
                    </div>
                    <div className={`p-4 rounded-lg border ${performanceStats.redisConnected ? 'border-green-500 bg-green-500/10' : 'border-orange-500 bg-orange-500/10'}`}>
                      <p className="font-medium">Redis Status</p>
                      <p className="text-sm text-muted-foreground">
                        {performanceStats.redisConnected 
                          ? 'OK - Upstash Redis connected' 
                          : 'Consider Upstash Redis for faster lookups'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="py-8 text-center">
                <AlertTriangle className="h-12 w-12 mx-auto text-yellow-500 mb-4" />
                <h3 className="text-xl font-semibold mb-2">No Performance Data</h3>
                <p className="text-muted-foreground">Performance metrics will appear after game analyses are run.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="puzzle-review" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Puzzle List */}
            <Card className="lg:col-span-1">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  Select Puzzle
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  placeholder="Search puzzles..."
                  value={puzzleSearchQuery}
                  onChange={(e) => setPuzzleSearchQuery(e.target.value)}
                  data-testid="input-puzzle-search"
                />
                <div className="max-h-[400px] overflow-y-auto space-y-2">
                  {allPuzzlesLoading ? (
                    <Skeleton className="h-20" />
                  ) : filteredPuzzles.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No puzzles found</p>
                  ) : (
                    filteredPuzzles.slice(0, 20).map(puzzle => (
                      <div
                        key={puzzle.id}
                        className={`p-3 rounded-lg border cursor-pointer hover-elevate transition-all ${
                          selectedPuzzle?.id === puzzle.id ? 'border-primary bg-primary/5' : ''
                        }`}
                        onClick={() => selectPuzzleForReview(puzzle)}
                        data-testid={`puzzle-item-${puzzle.id}`}
                      >
                        <p className="font-medium text-sm truncate">{puzzle.puzzleType || 'Puzzle'} - {puzzle.difficulty || 'Unknown'}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className="text-xs">{puzzle.puzzleType}</Badge>
                          {puzzle.isFlagged && <Badge variant="destructive" className="text-xs">Flagged</Badge>}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Puzzle Review Board */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle>Puzzle Review</CardTitle>
                <CardDescription>
                  Step through moves and verify with Stockfish
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!selectedPuzzle ? (
                  <div className="py-12 text-center">
                    <Cpu className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Select a puzzle to review</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Board */}
                      <div className="flex justify-center">
                        <ChessBoard
                          fen={reviewFen || selectedPuzzle.fen}
                          orientation={selectedPuzzle.whoToMove === 'black' ? 'black' : 'white'}
                          interactionMode="viewOnly"
                          className="w-[300px] h-[300px]"
                        />
                      </div>

                      {/* Move Info and Controls */}
                      <div className="space-y-4">
                        <div>
                          <p className="text-sm text-muted-foreground mb-1">Position</p>
                          <p className="font-medium">
                            Move {reviewMoveIndex} of {(selectedPuzzle.solution as string[])?.length || 0}
                          </p>
                          {reviewMoveIndex > 0 && reviewMoveIndex <= (selectedPuzzle.solution as string[])?.length && (
                            <p className="text-sm mt-1">
                              Last move: <span className="font-mono bg-muted px-1 rounded">
                                {(selectedPuzzle.solution as string[])[reviewMoveIndex - 1]}
                              </span>
                            </p>
                          )}
                          {reviewMoveIndex < (selectedPuzzle.solution as string[])?.length && (
                            <p className="text-sm mt-1">
                              Next move: <span className="font-mono bg-muted px-1 rounded">
                                {(selectedPuzzle.solution as string[])[reviewMoveIndex]}
                              </span>
                            </p>
                          )}
                        </div>

                        {/* Navigation */}
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => navigatePuzzleMove('reset')}
                            disabled={reviewMoveIndex === 0}
                            data-testid="button-reset-move"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => navigatePuzzleMove('prev')}
                            disabled={reviewMoveIndex === 0}
                            data-testid="button-prev-move"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => navigatePuzzleMove('next')}
                            disabled={reviewMoveIndex >= (selectedPuzzle.solution as string[])?.length}
                            data-testid="button-next-move"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>

                        {/* Analyze Button */}
                        {reviewMoveIndex < (selectedPuzzle.solution as string[])?.length && (
                          <Button
                            onClick={() => {
                              setIsAnalyzing(true);
                              setPuzzleAnalysis(null);
                              analyzePuzzleMutation.mutate({ 
                                puzzleId: selectedPuzzle.id, 
                                moveIndex: reviewMoveIndex 
                              });
                            }}
                            disabled={isAnalyzing || analyzePuzzleMutation.isPending}
                            className="w-full"
                            data-testid="button-analyze-move"
                          >
                            {isAnalyzing || analyzePuzzleMutation.isPending ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Analyzing...
                              </>
                            ) : (
                              <>
                                <Cpu className="h-4 w-4 mr-2" />
                                Verify with Stockfish
                              </>
                            )}
                          </Button>
                        )}

                        {/* Analysis Results */}
                        {puzzleAnalysis && (
                          <Card className={`border-2 ${
                            puzzleAnalysis.isBestMove 
                              ? 'border-green-500 bg-green-500/10' 
                              : puzzleAnalysis.classification === 'Good'
                                ? 'border-blue-500 bg-blue-500/10'
                                : puzzleAnalysis.classification === 'Inaccuracy'
                                  ? 'border-yellow-500 bg-yellow-500/10'
                                  : 'border-red-500 bg-red-500/10'
                          }`}>
                            <CardContent className="pt-4 space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="font-medium">Classification:</span>
                                <Badge className={
                                  puzzleAnalysis.isBestMove 
                                    ? 'bg-green-500' 
                                    : puzzleAnalysis.classification === 'Good'
                                      ? 'bg-blue-500'
                                      : puzzleAnalysis.classification === 'Inaccuracy'
                                        ? 'bg-yellow-500 text-black'
                                        : 'bg-red-500'
                                }>
                                  {puzzleAnalysis.classification}
                                </Badge>
                              </div>

                              <div className="grid grid-cols-2 gap-2 text-sm">
                                <div>
                                  <p className="text-muted-foreground">Solution Move</p>
                                  <p className="font-mono">{puzzleAnalysis.solutionMove}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Stockfish Best</p>
                                  <p className="font-mono">{puzzleAnalysis.stockfishBestMove}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Evaluation</p>
                                  <p className="font-mono">
                                    {puzzleAnalysis.isMate 
                                      ? `M${puzzleAnalysis.mateIn}` 
                                      : puzzleAnalysis.evaluation.toFixed(2)}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Is Best Move?</p>
                                  <p>{puzzleAnalysis.isBestMove ? '✓ Yes' : '✗ No'}</p>
                                </div>
                              </div>

                              {puzzleAnalysis.topMoves.length > 0 && (
                                <div>
                                  <p className="text-muted-foreground text-sm mb-1">Top Moves:</p>
                                  <div className="space-y-1">
                                    {puzzleAnalysis.topMoves.map((m, i) => (
                                      <div key={i} className="flex items-center justify-between text-sm font-mono bg-muted/50 px-2 py-1 rounded">
                                        <span>{i + 1}. {m.move}</span>
                                        <span>{m.isMate ? `M${m.mateIn}` : m.evaluation.toFixed(2)}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 pt-4 border-t">
                      {selectedPuzzle.isFlagged && (
                        <Button
                          variant="outline"
                          onClick={() => {
                            verifyPuzzleMutation.mutate(selectedPuzzle.id);
                            setSelectedPuzzle(null);
                          }}
                          disabled={verifyPuzzleMutation.isPending}
                          data-testid="button-approve-puzzle"
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Unflag & Approve
                        </Button>
                      )}
                      <Button
                        variant="destructive"
                        onClick={() => {
                          removePuzzleMutation.mutate(selectedPuzzle.id);
                          setSelectedPuzzle(null);
                        }}
                        disabled={removePuzzleMutation.isPending}
                        data-testid="button-remove-reviewed-puzzle"
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Remove Puzzle
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
