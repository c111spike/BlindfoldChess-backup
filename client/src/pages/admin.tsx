import { useState } from "react";
import { Helmet } from "react-helmet-async";
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
import { clientStockfish, TopMoveResult } from "@/lib/stockfish";
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

interface CheatReportCardProps {
  report: CheatReport;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onViewGame: (gameId: string) => void;
  onSuspend: (userId: string, days: number) => void;
  onBan: (userId: string) => void;
  onRefundGame: (gameId: string) => void;
  onRefundAllWins: (userId: string) => void;
  onResolve: (reportId: string, resolution: string) => void;
  isLoading: boolean;
}

function CheatReportCard({ 
  report, 
  isExpanded, 
  onToggleExpand, 
  onViewGame, 
  onSuspend, 
  onBan, 
  onRefundGame, 
  onRefundAllWins,
  onResolve,
  isLoading 
}: CheatReportCardProps) {
  const { data: reporter } = useQuery<User>({
    queryKey: ["/api/admin/users", report.reporterId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/users/${report.reporterId}`);
      return res.json();
    },
    enabled: !!report.reporterId,
  });
  
  const { data: reportedUser } = useQuery<User>({
    queryKey: ["/api/admin/users", report.reportedUserId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/users/${report.reportedUserId}`);
      return res.json();
    },
    enabled: !!report.reportedUserId,
  });

  return (
    <Card data-testid={`cheat-report-${report.id}`}>
      <CardContent className="py-5">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <p className="font-semibold">Report #{report.id.slice(0, 8)}</p>
                <Badge variant="destructive">{report.reason.replace(/_/g, ' ')}</Badge>
              </div>
              <div className="text-sm text-muted-foreground">
                <span className="font-medium">Reporter: </span>
                {reporter ? `${reporter.firstName} ${reporter.lastName}` : 'Loading...'}
              </div>
              <div className="text-sm">
                <span className="font-medium text-red-600">Reported Player: </span>
                <span className="text-red-600 font-semibold">
                  {reportedUser ? `${reportedUser.firstName} ${reportedUser.lastName}` : 'Loading...'}
                </span>
              </div>
              {report.details && (
                <p className="text-sm text-muted-foreground mt-1">{report.details}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Reported: {new Date(report.createdAt!).toLocaleString()}
              </p>
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={onToggleExpand}
              data-testid={`button-expand-${report.id}`}
            >
              <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
              {isExpanded ? 'Collapse' : 'Actions'}
            </Button>
          </div>
          
          {/* Expanded Actions */}
          {isExpanded && (
            <div className="border-t pt-4 space-y-4">
              {/* View Game Button */}
              {report.gameId && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => onViewGame(report.gameId!)}
                    disabled={isLoading}
                    data-testid={`button-view-game-${report.id}`}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    View Game & Moves
                  </Button>
                </div>
              )}
              
              {/* Moderation Actions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Suspend Options */}
                <div className="space-y-2">
                  <p className="text-sm font-medium">Suspend Player</p>
                  <div className="flex flex-wrap gap-2">
                    {[1, 5, 10, 30].map(days => (
                      <Button
                        key={days}
                        variant="outline"
                        size="sm"
                        onClick={() => onSuspend(report.reportedUserId, days)}
                        disabled={isLoading}
                        data-testid={`button-suspend-${days}-${report.id}`}
                      >
                        {days} day{days > 1 ? 's' : ''}
                      </Button>
                    ))}
                  </div>
                </div>
                
                {/* Ban */}
                <div className="space-y-2">
                  <p className="text-sm font-medium">Permanent Ban</p>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={isLoading}
                        data-testid={`button-ban-${report.id}`}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Ban Player
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Confirm Permanent Ban</DialogTitle>
                        <DialogDescription>
                          Are you sure you want to permanently ban {reportedUser?.firstName} {reportedUser?.lastName}?
                          This action cannot be easily undone.
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <Button variant="destructive" onClick={() => onBan(report.reportedUserId)}>
                          Confirm Ban
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
              
              {/* ELO Refund Options */}
              <div className="space-y-2">
                <p className="text-sm font-medium">Refund ELO (Reverse Rating Changes)</p>
                <div className="flex flex-wrap gap-2">
                  {report.gameId && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onRefundGame(report.gameId!)}
                      disabled={isLoading}
                      data-testid={`button-refund-game-${report.id}`}
                    >
                      <RotateCcw className="h-4 w-4 mr-1" />
                      Refund This Game
                    </Button>
                  )}
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isLoading}
                        data-testid={`button-refund-all-${report.id}`}
                      >
                        <RotateCcw className="h-4 w-4 mr-1" />
                        Refund All Wins
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Confirm Refund All Wins</DialogTitle>
                        <DialogDescription>
                          This will reverse rating changes for ALL games won by {reportedUser?.firstName} {reportedUser?.lastName}.
                          This gives back points to all their opponents.
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <Button variant="destructive" onClick={() => onRefundAllWins(report.reportedUserId)}>
                          Confirm Refund All
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
              
              {/* Resolve/Dismiss */}
              <div className="flex items-center gap-2 border-t pt-4">
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => onResolve(report.id, "Reviewed and action taken")}
                  disabled={isLoading}
                  data-testid={`button-resolve-${report.id}`}
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Mark as Resolved
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onResolve(report.id, "Dismissed as invalid")}
                  disabled={isLoading}
                  data-testid={`button-dismiss-${report.id}`}
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Dismiss (False Report)
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

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
  
  // Cheat report state
  const [expandedReport, setExpandedReport] = useState<string | null>(null);
  const [gameViewerOpen, setGameViewerOpen] = useState(false);
  const [viewingGame, setViewingGame] = useState<any>(null);
  const [gameMoveIndex, setGameMoveIndex] = useState(0);
  
  // Engine analysis state for cheat detection
  const [engineAnalysis, setEngineAnalysis] = useState<Map<number, TopMoveResult[]>>(new Map());
  const [isAnalyzingPosition, setIsAnalyzingPosition] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState<{current: number; total: number} | null>(null);

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
  
  const suspendUserMutation = useMutation({
    mutationFn: async ({ userId, days }: { userId: string; days: number }) => {
      if (!isAdmin) throw new Error("Unauthorized");
      return apiRequest("POST", `/api/admin/users/${userId}/suspend`, { days });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cheat-reports?isResolved=false"] });
      toast({ title: "User Suspended", description: `User has been suspended for ${variables.days} days.` });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
  
  const banUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      if (!isAdmin) throw new Error("Unauthorized");
      return apiRequest("POST", `/api/admin/users/${userId}/ban`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cheat-reports?isResolved=false"] });
      toast({ title: "User Banned", description: "User has been permanently banned." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
  
  const refundGameMutation = useMutation({
    mutationFn: async (gameId: string) => {
      if (!isAdmin) throw new Error("Unauthorized");
      return apiRequest("POST", `/api/admin/games/${gameId}/refund-elo`);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cheat-reports?isResolved=false"] });
      toast({ title: "ELO Refunded", description: data.message || "Rating changes have been reversed." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
  
  const refundAllWinsMutation = useMutation({
    mutationFn: async (userId: string) => {
      if (!isAdmin) throw new Error("Unauthorized");
      return apiRequest("POST", `/api/admin/users/${userId}/refund-all-wins`);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cheat-reports?isResolved=false"] });
      toast({ title: "All Wins Refunded", description: data.message || "All rating gains have been reversed." });
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
      <Helmet>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
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
                <CheatReportCard 
                  key={report.id}
                  report={report}
                  isExpanded={expandedReport === report.id}
                  onToggleExpand={() => setExpandedReport(expandedReport === report.id ? null : report.id)}
                  onViewGame={async (gameId: string) => {
                    try {
                      const response = await apiRequest("GET", `/api/admin/games/${gameId}/details`);
                      const data = await response.json();
                      setViewingGame(data);
                      setGameMoveIndex(0);
                      setGameViewerOpen(true);
                    } catch (error) {
                      toast({ title: "Error", description: "Failed to load game", variant: "destructive" });
                    }
                  }}
                  onSuspend={(userId, days) => suspendUserMutation.mutate({ userId, days })}
                  onBan={(userId) => banUserMutation.mutate(userId)}
                  onRefundGame={(gameId) => refundGameMutation.mutate(gameId)}
                  onRefundAllWins={(userId) => refundAllWinsMutation.mutate(userId)}
                  onResolve={(reportId, resolution) => resolveReportMutation.mutate({ reportId, resolution })}
                  isLoading={
                    suspendUserMutation.isPending || 
                    banUserMutation.isPending || 
                    refundGameMutation.isPending || 
                    refundAllWinsMutation.isPending ||
                    resolveReportMutation.isPending
                  }
                />
              ))}
            </div>
          )}
          
          {/* Game Viewer Dialog with Engine Analysis */}
          <Dialog open={gameViewerOpen} onOpenChange={(open) => {
            setGameViewerOpen(open);
            if (!open) {
              setEngineAnalysis(new Map());
              setAnalysisProgress(null);
            }
          }}>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Game Review - Anti-Cheat Analysis</DialogTitle>
                <DialogDescription>
                  Review moves with engine analysis to investigate cheating suspicion
                </DialogDescription>
              </DialogHeader>
              {viewingGame && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <div>
                      <span className="font-semibold">White: </span>
                      {viewingGame.whitePlayer?.firstName} {viewingGame.whitePlayer?.lastName}
                    </div>
                    <div>
                      <span className="font-semibold">Black: </span>
                      {viewingGame.blackPlayer?.firstName} {viewingGame.blackPlayer?.lastName}
                    </div>
                  </div>
                  
                  {/* Analyze Game Button */}
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={async () => {
                        if (isAnalyzingPosition) return;
                        setIsAnalyzingPosition(true);
                        const moves = viewingGame.game?.moves || [];
                        const totalMoves = moves.length;
                        setAnalysisProgress({ current: 0, total: totalMoves });
                        
                        try {
                          await clientStockfish.init();
                          const newAnalysis = new Map<number, TopMoveResult[]>();
                          
                          const chess = new Chess();
                          for (let i = 0; i < totalMoves; i++) {
                            setAnalysisProgress({ current: i + 1, total: totalMoves });
                            const fen = chess.fen();
                            
                            try {
                              const topMoves = await clientStockfish.getTopMoves(fen, 3, 500000);
                              newAnalysis.set(i, topMoves);
                            } catch (e) {
                              console.warn('Failed to analyze position', i, e);
                            }
                            
                            try {
                              chess.move(moves[i]);
                            } catch {}
                          }
                          
                          setEngineAnalysis(newAnalysis);
                        } catch (error) {
                          toast({ title: "Analysis Error", description: "Failed to run engine analysis", variant: "destructive" });
                        } finally {
                          setIsAnalyzingPosition(false);
                          setAnalysisProgress(null);
                        }
                      }}
                      disabled={isAnalyzingPosition}
                      data-testid="button-analyze-game"
                    >
                      {isAnalyzingPosition ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Analyzing {analysisProgress?.current}/{analysisProgress?.total}...
                        </>
                      ) : (
                        <>
                          <Cpu className="h-4 w-4 mr-2" />
                          Analyze with Stockfish
                        </>
                      )}
                    </Button>
                    
                    {engineAnalysis.size > 0 && (
                      <Badge variant="secondary">
                        {engineAnalysis.size} positions analyzed
                      </Badge>
                    )}
                  </div>
                  
                  {/* Summary Statistics */}
                  {engineAnalysis.size > 0 && (() => {
                    const moves = viewingGame.game?.moves || [];
                    const thinkingTimes = viewingGame.game?.thinkingTimes || [];
                    
                    // Separate counters for engine analysis vs total moves
                    let whiteTop1 = 0, whiteTop3 = 0, whiteAnalyzedMoves = 0;
                    let blackTop1 = 0, blackTop3 = 0, blackAnalyzedMoves = 0;
                    let whiteTotalTime = 0, blackTotalTime = 0;
                    let skippedPositions = 0;
                    
                    // Total move counts
                    const totalMoves = moves.length;
                    const whiteTotalMoves = Math.ceil(totalMoves / 2);
                    const blackTotalMoves = Math.floor(totalMoves / 2);
                    
                    const chess = new Chess();
                    for (let i = 0; i < moves.length; i++) {
                      const topMoves = engineAnalysis.get(i);
                      const playerMove = moves[i];
                      const thinkTime = thinkingTimes[i] || 0;
                      const isWhite = i % 2 === 0;
                      
                      // Accumulate time stats for ALL moves
                      if (isWhite) {
                        whiteTotalTime += thinkTime;
                      } else {
                        blackTotalTime += thinkTime;
                      }
                      
                      // Always advance board state for accurate subsequent evaluations
                      let moveObj = null;
                      try {
                        moveObj = chess.move(playerMove);
                      } catch {}
                      
                      // Calculate engine match stats only when we have analysis
                      if (topMoves && topMoves.length > 0 && moveObj) {
                        const uciMove = moveObj.from + moveObj.to + (moveObj.promotion || '');
                        const matchIndex = topMoves.findIndex(tm => tm.move === uciMove);
                        
                        if (isWhite) {
                          whiteAnalyzedMoves++;
                          if (matchIndex === 0) whiteTop1++;
                          if (matchIndex >= 0 && matchIndex < 3) whiteTop3++;
                        } else {
                          blackAnalyzedMoves++;
                          if (matchIndex === 0) blackTop1++;
                          if (matchIndex >= 0 && matchIndex < 3) blackTop3++;
                        }
                      } else if (!topMoves || topMoves.length === 0) {
                        skippedPositions++;
                      }
                    }
                    
                    // Engine match percentages based on analyzed moves only
                    const whiteTop1Pct = whiteAnalyzedMoves > 0 ? Math.round((whiteTop1 / whiteAnalyzedMoves) * 100) : 0;
                    const whiteTop3Pct = whiteAnalyzedMoves > 0 ? Math.round((whiteTop3 / whiteAnalyzedMoves) * 100) : 0;
                    const blackTop1Pct = blackAnalyzedMoves > 0 ? Math.round((blackTop1 / blackAnalyzedMoves) * 100) : 0;
                    const blackTop3Pct = blackAnalyzedMoves > 0 ? Math.round((blackTop3 / blackAnalyzedMoves) * 100) : 0;
                    
                    // Average time based on ALL moves (not just analyzed)
                    const whiteAvgTime = whiteTotalMoves > 0 ? Math.round(whiteTotalTime / whiteTotalMoves) : 0;
                    const blackAvgTime = blackTotalMoves > 0 ? Math.round(blackTotalTime / blackTotalMoves) : 0;
                    
                    return (
                      <div className="space-y-3">
                        {skippedPositions > 0 && (
                          <div className="flex items-center gap-2 p-2 bg-yellow-500/20 border border-yellow-500/50 rounded text-sm">
                            <AlertTriangle className="h-4 w-4 text-yellow-500" />
                            <span>{skippedPositions} of {totalMoves} positions could not be analyzed (engine timeout)</span>
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground">
                          Analysis based on {whiteAnalyzedMoves + blackAnalyzedMoves} of {totalMoves} moves with engine data
                        </div>
                        <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                          <div className="space-y-2">
                            <p className="font-semibold text-sm">White Analysis</p>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div className="p-2 bg-background rounded">
                                <span className="text-muted-foreground">Top 1 Match:</span>
                                <span className={`ml-1 font-bold ${whiteTop1Pct > 70 ? 'text-red-500' : ''}`}>
                                  {whiteTop1Pct}%
                                </span>
                              </div>
                              <div className="p-2 bg-background rounded">
                                <span className="text-muted-foreground">Top 3 Match:</span>
                                <span className={`ml-1 font-bold ${whiteTop3Pct > 90 ? 'text-red-500' : ''}`}>
                                  {whiteTop3Pct}%
                                </span>
                              </div>
                              <div className="p-2 bg-background rounded col-span-2">
                                <span className="text-muted-foreground">Avg Think Time:</span>
                                <span className="ml-1 font-bold">{whiteAvgTime}s</span>
                              </div>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <p className="font-semibold text-sm">Black Analysis</p>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div className="p-2 bg-background rounded">
                                <span className="text-muted-foreground">Top 1 Match:</span>
                                <span className={`ml-1 font-bold ${blackTop1Pct > 70 ? 'text-red-500' : ''}`}>
                                  {blackTop1Pct}%
                                </span>
                              </div>
                              <div className="p-2 bg-background rounded">
                                <span className="text-muted-foreground">Top 3 Match:</span>
                                <span className={`ml-1 font-bold ${blackTop3Pct > 90 ? 'text-red-500' : ''}`}>
                                  {blackTop3Pct}%
                                </span>
                              </div>
                              <div className="p-2 bg-background rounded col-span-2">
                                <span className="text-muted-foreground">Avg Think Time:</span>
                                <span className="ml-1 font-bold">{blackAvgTime}s</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Chess Board */}
                    <div className="flex justify-center">
                      <div className="w-72 h-72">
                        <ChessBoard 
                          fen={(() => {
                            const chess = new Chess();
                            const moves = viewingGame.game?.moves || [];
                            for (let i = 0; i < gameMoveIndex && i < moves.length; i++) {
                              try {
                                chess.move(moves[i]);
                              } catch {}
                            }
                            return chess.fen();
                          })()}
                          onMove={() => false}
                          orientation="white"
                        />
                      </div>
                    </div>
                    
                    {/* Engine Analysis Panel */}
                    <div className="space-y-3">
                      <p className="font-semibold text-sm">Position {gameMoveIndex} Analysis</p>
                      
                      {/* Current move info with thinking time */}
                      {gameMoveIndex > 0 && (
                        <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">
                              {gameMoveIndex % 2 === 1 ? 'White' : 'Black'} played:
                            </span>
                            <Badge variant="outline" className="font-mono">
                              {viewingGame.game?.moves?.[gameMoveIndex - 1]}
                            </Badge>
                          </div>
                          {viewingGame.game?.thinkingTimes?.[gameMoveIndex - 1] !== undefined && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Think time:</span>
                              <span className="font-mono">
                                {viewingGame.game.thinkingTimes[gameMoveIndex - 1]}s
                              </span>
                            </div>
                          )}
                          
                          {/* Engine match indicator */}
                          {engineAnalysis.get(gameMoveIndex - 1) && (() => {
                            const topMoves = engineAnalysis.get(gameMoveIndex - 1)!;
                            const playerMove = viewingGame.game?.moves?.[gameMoveIndex - 1];
                            
                            const tempChess = new Chess();
                            const moves = viewingGame.game?.moves || [];
                            for (let i = 0; i < gameMoveIndex - 1 && i < moves.length; i++) {
                              try { tempChess.move(moves[i]); } catch {}
                            }
                            
                            try {
                              const moveObj = tempChess.move(playerMove);
                              if (moveObj) {
                                const uciMove = moveObj.from + moveObj.to + (moveObj.promotion || '');
                                const matchIndex = topMoves.findIndex(tm => tm.move === uciMove);
                                
                                if (matchIndex === 0) {
                                  return <Badge className="bg-green-500">Best Move (Top 1)</Badge>;
                                } else if (matchIndex === 1) {
                                  return <Badge className="bg-yellow-500">Top 2 Move</Badge>;
                                } else if (matchIndex === 2) {
                                  return <Badge className="bg-orange-500">Top 3 Move</Badge>;
                                } else {
                                  return <Badge variant="secondary">Not in Top 3</Badge>;
                                }
                              }
                            } catch {}
                            return null;
                          })()}
                        </div>
                      )}
                      
                      {/* Top 3 Engine Moves */}
                      {engineAnalysis.get(gameMoveIndex) ? (
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground">Engine Top 3 Moves:</p>
                          {engineAnalysis.get(gameMoveIndex)!.map((tm, idx) => (
                            <div key={idx} className="flex items-center justify-between p-2 bg-background rounded text-sm">
                              <div className="flex items-center gap-2">
                                <Badge variant={idx === 0 ? "default" : "outline"} className="w-6 justify-center">
                                  {idx + 1}
                                </Badge>
                                <span className="font-mono">{tm.move}</span>
                              </div>
                              <span className="text-muted-foreground">
                                {tm.isMate ? `M${tm.mateIn}` : `${tm.evaluation > 0 ? '+' : ''}${tm.evaluation.toFixed(1)}`}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : engineAnalysis.size > 0 ? (
                        <p className="text-sm text-muted-foreground">No analysis for this position</p>
                      ) : (
                        <p className="text-sm text-muted-foreground">Click "Analyze with Stockfish" to see engine recommendations</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setGameMoveIndex(0)}
                      disabled={gameMoveIndex === 0}
                      data-testid="button-game-start"
                    >
                      Start
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setGameMoveIndex(Math.max(0, gameMoveIndex - 1))}
                      disabled={gameMoveIndex === 0}
                      data-testid="button-game-prev"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm px-3">
                      Move {gameMoveIndex} / {viewingGame.game?.moves?.length || 0}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setGameMoveIndex(Math.min((viewingGame.game?.moves?.length || 0), gameMoveIndex + 1))}
                      disabled={gameMoveIndex >= (viewingGame.game?.moves?.length || 0)}
                      data-testid="button-game-next"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setGameMoveIndex(viewingGame.game?.moves?.length || 0)}
                      disabled={gameMoveIndex >= (viewingGame.game?.moves?.length || 0)}
                      data-testid="button-game-end"
                    >
                      End
                    </Button>
                  </div>
                  
                  {/* Move list with thinking times */}
                  <div className="bg-muted p-3 rounded max-h-40 overflow-y-auto">
                    <div className="text-sm font-mono space-y-1">
                      {viewingGame.game?.moves?.reduce((acc: JSX.Element[], move: string, i: number) => {
                        const thinkTime = viewingGame.game?.thinkingTimes?.[i];
                        const topMoves = engineAnalysis.get(i);
                        
                        let matchClass = '';
                        if (topMoves && topMoves.length > 0) {
                          const tempChess = new Chess();
                          const moves = viewingGame.game?.moves || [];
                          for (let j = 0; j < i; j++) {
                            try { tempChess.move(moves[j]); } catch {}
                          }
                          try {
                            const moveObj = tempChess.move(move);
                            if (moveObj) {
                              const uciMove = moveObj.from + moveObj.to + (moveObj.promotion || '');
                              const matchIndex = topMoves.findIndex(tm => tm.move === uciMove);
                              if (matchIndex === 0) matchClass = 'bg-green-500/20 text-green-700 dark:text-green-400';
                              else if (matchIndex === 1) matchClass = 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400';
                              else if (matchIndex === 2) matchClass = 'bg-orange-500/20 text-orange-700 dark:text-orange-400';
                            }
                          } catch {}
                        }
                        
                        if (i % 2 === 0) {
                          acc.push(
                            <span key={i} className="inline-flex items-center gap-1">
                              <span className="text-muted-foreground w-6">{Math.floor(i/2) + 1}.</span>
                              <span 
                                className={`cursor-pointer hover:bg-primary/20 px-1 rounded ${matchClass} ${i < gameMoveIndex ? '' : 'opacity-50'}`}
                                onClick={() => setGameMoveIndex(i + 1)}
                              >
                                {move}
                                {thinkTime !== undefined && <span className="text-xs text-muted-foreground ml-1">({thinkTime}s)</span>}
                              </span>
                            </span>
                          );
                        } else {
                          acc.push(
                            <span key={i} className="inline-flex items-center gap-1 mr-3">
                              <span 
                                className={`cursor-pointer hover:bg-primary/20 px-1 rounded ${matchClass} ${i < gameMoveIndex ? '' : 'opacity-50'}`}
                                onClick={() => setGameMoveIndex(i + 1)}
                              >
                                {move}
                                {thinkTime !== undefined && <span className="text-xs text-muted-foreground ml-1">({thinkTime}s)</span>}
                              </span>
                            </span>
                          );
                        }
                        return acc;
                      }, [])}
                    </div>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
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
                <Card data-testid="card-database-status">
                  <CardHeader className="pb-2">
                    <CardDescription className="flex items-center gap-2">
                      <Database className="h-4 w-4" />
                      Database Cache Status
                    </CardDescription>
                    <CardTitle className="text-2xl text-green-500">
                      Active
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      PostgreSQL cache with {performanceStats.totalCachedPositions.toLocaleString()} positions (30-day TTL)
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
                        ? '⚠️ Lookup time elevated' 
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
                    <CardTitle className={`text-2xl ${performanceStats.totalCachedPositions > 50000 ? 'text-orange-500' : ''}`}>
                      {performanceStats.totalCachedPositions.toLocaleString()}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      {performanceStats.totalCachedPositions > 50000 
                        ? '⚠️ Consider own Neon account for larger storage' 
                        : '✓ Cache size is within Replit limits'}
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
                  <CardTitle className="text-lg">Storage Scaling Guide</CardTitle>
                  <CardDescription>
                    Monitor storage usage and plan for growth
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className={`p-4 rounded-lg border ${performanceStats.avgCacheLookupMs > 50 ? 'border-orange-500 bg-orange-500/10' : 'border-green-500 bg-green-500/10'}`}>
                      <p className="font-medium">Cache Lookup Time</p>
                      <p className="text-sm text-muted-foreground">
                        {performanceStats.avgCacheLookupMs > 50 
                          ? 'Elevated - database may be under load' 
                          : 'OK - under 50ms threshold'}
                      </p>
                    </div>
                    <div className={`p-4 rounded-lg border ${performanceStats.totalCachedPositions > 50000 ? 'border-orange-500 bg-orange-500/10' : 'border-green-500 bg-green-500/10'}`}>
                      <p className="font-medium">Cache Size</p>
                      <p className="text-sm text-muted-foreground">
                        {performanceStats.totalCachedPositions > 50000 
                          ? 'Approaching Replit limits - consider own Neon account' 
                          : 'OK - within Replit storage limits'}
                      </p>
                    </div>
                    <div className="p-4 rounded-lg border border-blue-500 bg-blue-500/10">
                      <p className="font-medium">Scaling Tip</p>
                      <p className="text-sm text-muted-foreground">
                        For larger caches, create your own Neon account at neon.tech for unlimited storage
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
