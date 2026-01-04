import { useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Target, Clock, TrendingUp, Book, Brain, Puzzle, Gamepad2, Eye, Users, Handshake } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import type { Statistics } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";

interface SpecialModeStats {
  blindfold: {
    gamesPlayed: number;
    perfectGames: number;
    lastPeekTime: number | null;
    avgPeekTime: number;
    wins: number;
    losses: number;
    draws: number;
  };
  simulVsSimul: {
    gamesPlayed: number;
    wins: number;
    losses: number;
    draws: number;
    winRate: number;
  };
}

interface TrainingStats {
  repertoire: {
    totalRepertoires: number;
    linesPracticed: number;
    linesMastered: number;
    dueForReview: number;
    totalCorrect: number;
    totalIncorrect: number;
    accuracy: number;
  };
  boardSpin: {
    gamesPlayed: number;
    bestScore: number;
    avgAccuracy: number;
  };
  nPiece: {
    challengesAttempted: number;
    totalSolutions: number;
  };
  knightsTour: {
    totalCompleted: number;
    boardsCompleted: number;
    bestTime: number | null;
  };
  puzzles: {
    uploaded: number;
  };
}

export default function StatisticsPage() {
  const { user } = useAuth();
  
  const { data: stats, isLoading } = useQuery<Statistics[]>({
    queryKey: ["/api/statistics"],
  });

  const { data: trainingStats, isLoading: trainingLoading } = useQuery<TrainingStats>({
    queryKey: ["/api/training-stats"],
  });

  const { data: specialModeStats, isLoading: specialLoading } = useQuery<SpecialModeStats>({
    queryKey: ["/api/special-mode-stats"],
  });

  const formatPeekTime = (seconds: number) => {
    if (seconds < 60) {
      return `${seconds.toFixed(1)}s`;
    }
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins}m`;
  };

  const getWinRate = (stat: Statistics) => {
    const total = stat.gamesPlayed || 0;
    if (total === 0) return 0;
    return Math.round(((stat.wins || 0) / total) * 100);
  };

  if (isLoading || trainingLoading || specialLoading) {
    return (
      <div className="p-8 space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  const totalGames = stats?.reduce((sum, s) => sum + (s.gamesPlayed || 0), 0) || 0;
  const totalWins = stats?.reduce((sum, s) => sum + (s.wins || 0), 0) || 0;
  const overallWinRate = totalGames > 0 ? Math.round((totalWins / totalGames) * 100) : 0;
  const totalPlayTime = stats?.reduce((sum, s) => sum + (s.totalTime || 0), 0) || 0;
  const longestStreak = Math.max(...(stats?.map(s => s.winStreak || 0) || [0]));

  return (
    <div className="p-8 space-y-8">
      <Helmet>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div>
        <h1 className="text-4xl font-bold mb-2">Statistics</h1>
        <p className="text-muted-foreground">Track your progress across all training modes</p>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="games" data-testid="tab-games">Games</TabsTrigger>
          <TabsTrigger value="repertoire" data-testid="tab-repertoire">Repertoire</TabsTrigger>
          <TabsTrigger value="challenges" data-testid="tab-challenges">Challenges</TabsTrigger>
          <TabsTrigger value="blindfold" data-testid="tab-blindfold">Blindfold</TabsTrigger>
          <TabsTrigger value="simul" data-testid="tab-simul">Simul vs Simul</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="space-y-0 pb-3">
                <CardDescription className="flex items-center gap-2 text-xs">
                  <Trophy className="h-3 w-3" />
                  Total Games
                </CardDescription>
                <CardTitle className="text-3xl font-bold">
                  {totalGames}
                </CardTitle>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader className="space-y-0 pb-3">
                <CardDescription className="flex items-center gap-2 text-xs">
                  <Target className="h-3 w-3" />
                  Overall Win Rate
                </CardDescription>
                <CardTitle className="text-3xl font-bold">
                  {overallWinRate}%
                </CardTitle>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader className="space-y-0 pb-3">
                <CardDescription className="flex items-center gap-2 text-xs">
                  <Clock className="h-3 w-3" />
                  Total Play Time
                </CardDescription>
                <CardTitle className="text-3xl font-bold">
                  {formatDuration(totalPlayTime)}
                </CardTitle>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader className="space-y-0 pb-3">
                <CardDescription className="flex items-center gap-2 text-xs">
                  <TrendingUp className="h-3 w-3" />
                  Longest Win Streak
                </CardDescription>
                <CardTitle className="text-3xl font-bold">
                  {longestStreak}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          <Card data-testid="handshake-streak-card">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Handshake className="h-4 w-4" />
                Post-Game Handshake Streak
              </CardTitle>
              <CardDescription>
                Sportsmanship counts! Offer a handshake after each OTB game to build your streak.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-6">
                <div className="text-center">
                  <p className="text-4xl font-bold" data-testid="handshake-current-streak">
                    {user?.handshakeStreak || 0}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">Current Streak</p>
                </div>
                <div className="text-center">
                  <p className="text-4xl font-bold text-amber-500" data-testid="handshake-best-streak">
                    {user?.handshakeStreakMax || 0}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">Best Streak</p>
                </div>
              </div>
              {(user?.handshakeStreak || 0) >= 10 && (
                <div className="mt-4 text-center text-sm text-green-600 dark:text-green-400">
                  <Trophy className="h-4 w-4 inline mr-1" />
                  Sportsman Badge earned!
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Book className="h-4 w-4" />
                  Repertoire Training
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold">{trainingStats?.repertoire.linesPracticed || 0}</p>
                    <p className="text-xs text-muted-foreground">Lines Practiced</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {trainingStats?.repertoire.accuracy || 0}%
                    </p>
                    <p className="text-xs text-muted-foreground">Accuracy</p>
                  </div>
                </div>
                {trainingStats && trainingStats.repertoire.dueForReview > 0 && (
                  <div className="text-sm text-amber-600 dark:text-amber-400 text-center">
                    {trainingStats.repertoire.dueForReview} lines due for review
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Brain className="h-4 w-4" />
                  Board Spin
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold">{trainingStats?.boardSpin.gamesPlayed || 0}</p>
                    <p className="text-xs text-muted-foreground">Games Played</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{trainingStats?.boardSpin.bestScore || 0}</p>
                    <p className="text-xs text-muted-foreground">Best Score</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Puzzle className="h-4 w-4" />
                  N-Piece Challenge
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold">{trainingStats?.nPiece.challengesAttempted || 0}</p>
                    <p className="text-xs text-muted-foreground">Challenges</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{trainingStats?.nPiece.totalSolutions || 0}</p>
                    <p className="text-xs text-muted-foreground">Solutions Found</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Gamepad2 className="h-4 w-4" />
                  Knight's Tour
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold">{trainingStats?.knightsTour?.totalCompleted || 0}</p>
                    <p className="text-xs text-muted-foreground">Tours Completed</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {trainingStats?.knightsTour?.bestTime 
                        ? `${Math.floor(trainingStats.knightsTour.bestTime / 1000)}s`
                        : '-'}
                    </p>
                    <p className="text-xs text-muted-foreground">Best Time</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="games" className="space-y-6">
          {stats && stats.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {stats.map((stat) => (
                <Card key={stat.id}>
                  <CardHeader>
                    <CardTitle className="text-lg">
                      {stat.mode.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                          {stat.wins || 0}
                        </p>
                        <p className="text-xs text-muted-foreground">Wins</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                          {stat.draws || 0}
                        </p>
                        <p className="text-xs text-muted-foreground">Draws</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                          {stat.losses || 0}
                        </p>
                        <p className="text-xs text-muted-foreground">Losses</p>
                      </div>
                    </div>

                    <div className="pt-4 border-t space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Win Rate</span>
                        <span className="font-semibold">{getWinRate(stat)}%</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Peak Rating</span>
                        <span className="font-mono font-semibold">{stat.peakRating || "-"}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Play Time</span>
                        <span className="font-semibold">{formatDuration(stat.totalTime || 0)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>No Games Yet</CardTitle>
                <CardDescription>Play some games to see your statistics here!</CardDescription>
              </CardHeader>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="repertoire" className="space-y-6">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="space-y-0 pb-3">
                <CardDescription className="flex items-center gap-2 text-xs">
                  <Book className="h-3 w-3" />
                  Repertoires
                </CardDescription>
                <CardTitle className="text-3xl font-bold">
                  {trainingStats?.repertoire.totalRepertoires || 0}
                </CardTitle>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader className="space-y-0 pb-3">
                <CardDescription className="flex items-center gap-2 text-xs">
                  <Target className="h-3 w-3" />
                  Lines Practiced
                </CardDescription>
                <CardTitle className="text-3xl font-bold">
                  {trainingStats?.repertoire.linesPracticed || 0}
                </CardTitle>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader className="space-y-0 pb-3">
                <CardDescription className="flex items-center gap-2 text-xs">
                  <Trophy className="h-3 w-3" />
                  Lines Mastered
                </CardDescription>
                <CardTitle className="text-3xl font-bold">
                  {trainingStats?.repertoire.linesMastered || 0}
                </CardTitle>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader className="space-y-0 pb-3">
                <CardDescription className="flex items-center gap-2 text-xs">
                  <Clock className="h-3 w-3" />
                  Due for Review
                </CardDescription>
                <CardTitle className="text-3xl font-bold">
                  {trainingStats?.repertoire.dueForReview || 0}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Practice Performance</CardTitle>
              <CardDescription>Your repertoire training accuracy</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Overall Accuracy</span>
                  <span className="font-mono font-bold">{trainingStats?.repertoire.accuracy || 0}%</span>
                </div>
                <Progress value={trainingStats?.repertoire.accuracy || 0} />
              </div>
              
              <div className="grid grid-cols-2 gap-8 pt-4">
                <div className="text-center">
                  <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                    {trainingStats?.repertoire.totalCorrect || 0}
                  </p>
                  <p className="text-sm text-muted-foreground">Correct Moves</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-red-600 dark:text-red-400">
                    {trainingStats?.repertoire.totalIncorrect || 0}
                  </p>
                  <p className="text-sm text-muted-foreground">Incorrect Moves</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="challenges" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5" />
                  Board Spin
                </CardTitle>
                <CardDescription>Memory and visualization training</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold">{trainingStats?.boardSpin.gamesPlayed || 0}</p>
                    <p className="text-xs text-muted-foreground">Games</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{trainingStats?.boardSpin.bestScore || 0}</p>
                    <p className="text-xs text-muted-foreground">Best Score</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{trainingStats?.boardSpin.avgAccuracy || 0}%</p>
                    <p className="text-xs text-muted-foreground">Avg Accuracy</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Puzzle className="h-5 w-5" />
                  N-Piece Challenge
                </CardTitle>
                <CardDescription>Piece placement puzzles</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold">{trainingStats?.nPiece.challengesAttempted || 0}</p>
                    <p className="text-xs text-muted-foreground">Challenges</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{trainingStats?.nPiece.totalSolutions || 0}</p>
                    <p className="text-xs text-muted-foreground">Solutions</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gamepad2 className="h-5 w-5" />
                  Knight's Tour
                </CardTitle>
                <CardDescription>Knight movement mastery</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold">{trainingStats?.knightsTour?.totalCompleted || 0}</p>
                    <p className="text-xs text-muted-foreground">Completed</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{trainingStats?.knightsTour?.boardsCompleted || 0}</p>
                    <p className="text-xs text-muted-foreground">Board Sizes</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {trainingStats?.knightsTour?.bestTime 
                        ? `${Math.floor(trainingStats.knightsTour.bestTime / 1000)}s`
                        : '-'}
                    </p>
                    <p className="text-xs text-muted-foreground">Best Time</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Puzzle className="h-5 w-5" />
                  Puzzle Contributions
                </CardTitle>
                <CardDescription>Your puzzle uploads to the community</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center">
                  <p className="text-2xl font-bold" data-testid="text-puzzles-uploaded">{trainingStats?.puzzles?.uploaded || 0}</p>
                  <p className="text-xs text-muted-foreground">Puzzles Uploaded</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="blindfold" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Blindfold Training Statistics
              </CardTitle>
              <CardDescription>Track your visualization and memory training progress</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-4 gap-6">
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <p className="text-3xl font-bold">{specialModeStats?.blindfold.gamesPlayed || 0}</p>
                  <p className="text-sm text-muted-foreground">Games Played</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">{specialModeStats?.blindfold.perfectGames || 0}</p>
                  <p className="text-sm text-muted-foreground">Perfect Games</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <p className="text-3xl font-bold">
                    {specialModeStats?.blindfold.avgPeekTime !== undefined 
                      ? formatPeekTime(specialModeStats.blindfold.avgPeekTime)
                      : '-'}
                  </p>
                  <p className="text-sm text-muted-foreground">Avg Peek Time</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <p className="text-3xl font-bold">
                    {specialModeStats?.blindfold.lastPeekTime !== null 
                      ? formatPeekTime(specialModeStats.blindfold.lastPeekTime)
                      : '-'}
                  </p>
                  <p className="text-sm text-muted-foreground">Last Game Peek Time</p>
                </div>
              </div>

              <div className="border-t pt-6">
                <h4 className="text-sm font-semibold mb-4">Game Results</h4>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">{specialModeStats?.blindfold.wins || 0}</p>
                    <p className="text-xs text-muted-foreground">Wins</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400">{specialModeStats?.blindfold.losses || 0}</p>
                    <p className="text-xs text-muted-foreground">Losses</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-muted-foreground">{specialModeStats?.blindfold.draws || 0}</p>
                    <p className="text-xs text-muted-foreground">Draws</p>
                  </div>
                </div>
                {specialModeStats && specialModeStats.blindfold.gamesPlayed > 0 && (
                  <div className="mt-4">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Win Rate</span>
                      <span>{Math.round((specialModeStats.blindfold.wins / specialModeStats.blindfold.gamesPlayed) * 100)}%</span>
                    </div>
                    <Progress 
                      value={(specialModeStats.blindfold.wins / specialModeStats.blindfold.gamesPlayed) * 100} 
                      className="h-2"
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="simul" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Simul vs Simul Statistics
              </CardTitle>
              <CardDescription>Multi-board simultaneous exhibition performance</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <p className="text-3xl font-bold">{specialModeStats?.simulVsSimul.gamesPlayed || 0}</p>
                  <p className="text-sm text-muted-foreground">Total Games</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <p className="text-3xl font-bold">{specialModeStats?.simulVsSimul.winRate || 0}%</p>
                  <p className="text-sm text-muted-foreground">Win Rate</p>
                </div>
              </div>

              <div className="border-t pt-6">
                <h4 className="text-sm font-semibold mb-4">Game Results</h4>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">{specialModeStats?.simulVsSimul.wins || 0}</p>
                    <p className="text-xs text-muted-foreground">Wins</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400">{specialModeStats?.simulVsSimul.losses || 0}</p>
                    <p className="text-xs text-muted-foreground">Losses</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-muted-foreground">{specialModeStats?.simulVsSimul.draws || 0}</p>
                    <p className="text-xs text-muted-foreground">Draws</p>
                  </div>
                </div>
                {specialModeStats && specialModeStats.simulVsSimul.gamesPlayed > 0 && (
                  <div className="mt-4">
                    <Progress 
                      value={specialModeStats.simulVsSimul.winRate} 
                      className="h-2"
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
