import { useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, Brain, Grid3x3, TrendingUp, TrendingDown, Users, Gamepad2, EyeOff, RotateCcw, Puzzle, Crown } from "lucide-react";
import type { Rating, Game } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";
import { ThisDayInChessHistory } from "@/components/this-day-in-chess-history";

export default function Dashboard() {
  const { user, session } = useAuth();
  
  // Use session name (from Better Auth) as primary source, fallback to user firstName from DB
  const displayName = session?.user?.name?.split(' ')[0] || user?.firstName || 'Player';
  
  const { data: ratings, isLoading: ratingsLoading } = useQuery<Rating>({
    queryKey: ["/api/ratings"],
  });
  
  const { data: ongoingGame } = useQuery<Game>({
    queryKey: ["/api/games/ongoing"],
    refetchOnMount: true,
    staleTime: 0,
  });

  const { data: platformStats } = useQuery<{
    onlinePlayers: number;
    totalGames: {
      simulVsSimul: number;
      otb: number;
      standard: number;
      blindfold: number;
    };
    trainingChallenges: {
      boardSpin: number;
      nPiece: number;
      knightsTour: number;
    };
  }>({
    queryKey: ["/api/stats/platform"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });


  if (ratingsLoading) {
    return (
      <div className="p-8 space-y-8">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }


  return (
    <div className="p-8 space-y-8">
      <Helmet>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="mb-8">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="flex-shrink-0">
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Dashboard Mode</div>
            <h1 className="text-2xl lg:text-3xl font-bold mb-1">Welcome back, {displayName}</h1>
            <p className="text-sm text-muted-foreground">Ready for your daily training?</p>
          </div>
          <div className="lg:max-w-md w-full">
            <ThisDayInChessHistory />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="space-y-0 pb-3">
            <CardDescription className="text-xs font-medium">Simul Elo</CardDescription>
            <CardTitle className="text-3xl font-mono font-bold" data-testid="text-rating-simul">
              {ratings?.simul || 1000}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3" />
              <span>+6</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-0 pb-3">
            <CardDescription className="text-xs font-medium">OTB Blitz</CardDescription>
            <CardTitle className="text-3xl font-mono font-bold" data-testid="text-rating-otb-blitz">
              {ratings?.otbBlitz || 1200}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3" />
              <span>+8</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-0 pb-3">
            <CardDescription className="text-xs font-medium">OTB Rapid</CardDescription>
            <CardTitle className="text-3xl font-mono font-bold" data-testid="text-rating-otb-rapid">
              {ratings?.otbRapid || 1200}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <TrendingDown className="h-3 w-3 text-destructive" />
              <span className="text-destructive">-5</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-0 pb-3">
            <CardDescription className="text-xs font-medium">Elo Blitz</CardDescription>
            <CardTitle className="text-3xl font-mono font-bold" data-testid="text-rating-blitz">
              {ratings?.blitz || 1200}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3" />
              <span>+4</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-0 pb-3">
            <CardDescription className="text-xs font-medium">Elo Rapid</CardDescription>
            <CardTitle className="text-3xl font-mono font-bold" data-testid="text-rating-rapid">
              {ratings?.rapid || 1200}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3" />
              <span>+3</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-primary hover-elevate border-primary flex flex-col" data-testid="card-simul-exhibition">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between mb-2">
              <Grid3x3 className="h-8 w-8 text-primary-foreground" />
            </div>
            <CardTitle className="text-primary-foreground text-2xl">Simul vs Simul</CardTitle>
            <CardDescription className="text-primary-foreground/80">
              5 boards<br />30 seconds/move<br />Once you start on a board.
            </CardDescription>
          </CardHeader>
          <CardContent className="mt-auto">
            <Button asChild variant="secondary" className="w-full" data-testid="button-mode-simul-vs-simul">
              <Link href="/simul-vs-simul">Start Simul vs Simul</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-primary hover-elevate border-primary flex flex-col" data-testid="card-otb-mode">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between mb-2">
              <Clock className="h-8 w-8 text-primary-foreground" />
            </div>
            <CardTitle className="text-primary-foreground text-2xl">OTB Mode</CardTitle>
            <CardDescription className="text-primary-foreground/80">
              Manual clock<br />One touch rule<br />Arbiter Button
            </CardDescription>
          </CardHeader>
          <CardContent className="mt-auto">
            <Button asChild variant="secondary" className="w-full" data-testid="button-mode-otb">
              <Link href="/otb">Start Game</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-primary hover-elevate border-primary flex flex-col" data-testid="card-standard-mode">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between mb-2">
              <Brain className="h-8 w-8 text-primary-foreground" />
            </div>
            <CardTitle className="text-primary-foreground text-2xl">Standard (Blindfold training)</CardTitle>
            <CardDescription className="text-primary-foreground/80">
              Online chess. Automatic clocks. Optional blindfold.
            </CardDescription>
          </CardHeader>
          <CardContent className="mt-auto">
            <Button asChild variant="secondary" className="w-full" data-testid="button-mode-standard">
              <Link href="/standard">Play Standard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Total Stats Header */}
      <h2 className="text-2xl font-semibold" data-testid="text-total-stats-header">Total Stats</h2>

      {/* Platform Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-muted/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Users className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold font-mono" data-testid="text-online-players">
                  {platformStats?.onlinePlayers || 0}
                </p>
                <p className="text-xs text-muted-foreground">Online Players</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-muted/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Grid3x3 className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold font-mono" data-testid="text-total-simul-games">
                  {platformStats?.totalGames?.simulVsSimul || 0}
                </p>
                <p className="text-xs text-muted-foreground">Simul vs Simul Games</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-muted/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold font-mono" data-testid="text-total-otb-games">
                  {platformStats?.totalGames?.otb || 0}
                </p>
                <p className="text-xs text-muted-foreground">OTB Mode Games</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-muted/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <Gamepad2 className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-2xl font-bold font-mono" data-testid="text-total-standard-games">
                  {platformStats?.totalGames?.standard || 0}
                </p>
                <p className="text-xs text-muted-foreground">Standard Games</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-muted/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-500/10">
                <EyeOff className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <p className="text-2xl font-bold font-mono" data-testid="text-total-blindfold-games">
                  {platformStats?.totalGames?.blindfold || 0}
                </p>
                <p className="text-xs text-muted-foreground">Blindfold Games</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-muted/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/10">
                <RotateCcw className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
              </div>
              <div>
                <p className="text-2xl font-bold font-mono" data-testid="text-total-board-spin">
                  {platformStats?.trainingChallenges?.boardSpin || 0}
                </p>
                <p className="text-xs text-muted-foreground">Board Spin Games</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-muted/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Puzzle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold font-mono" data-testid="text-total-n-piece">
                  {platformStats?.trainingChallenges?.nPiece || 0}
                </p>
                <p className="text-xs text-muted-foreground">N-Piece Challenges</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-muted/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-rose-500/10">
                <Crown className="h-5 w-5 text-rose-600 dark:text-rose-400" />
              </div>
              <div>
                <p className="text-2xl font-bold font-mono" data-testid="text-total-knights-tour">
                  {platformStats?.trainingChallenges?.knightsTour || 0}
                </p>
                <p className="text-xs text-muted-foreground">Knight's Tour</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
