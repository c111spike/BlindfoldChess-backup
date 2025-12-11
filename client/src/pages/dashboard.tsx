import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, Brain, Grid3x3, TrendingUp, TrendingDown, Trophy, History, Users, Gamepad2 } from "lucide-react";
import type { Rating, Game, UserSettings } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { ThisDayInChessHistory } from "@/components/this-day-in-chess-history";

export default function Dashboard() {
  const { toast } = useToast();
  const { user } = useAuth();
  
  const { data: ratings, isLoading: ratingsLoading } = useQuery<Rating>({
    queryKey: ["/api/ratings"],
  });

  const { data: recentGames, isLoading: gamesLoading } = useQuery<Game[]>({
    queryKey: ["/api/games/recent"],
  });

  const { data: userSettings } = useQuery<UserSettings>({
    queryKey: ["/api/settings"],
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
  }>({
    queryKey: ["/api/stats/platform"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const updateBlindfolddifficultyMutation = useMutation({
    mutationFn: async (difficulty: string) => {
      return await apiRequest("PATCH", "/api/settings", {
        blindfoldDifficulty: difficulty,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "Settings saved",
        description: "Blindfold difficulty updated",
      });
    },
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

  const difficultyOptions = [
    { value: "easy", label: "Easy", description: "Unlimited press-and-hold peeks" },
    { value: "medium", label: "Medium", description: "20 press-and-hold peeks" },
    { value: "hard", label: "Hard", description: "15 press-and-hold peeks" },
    { value: "expert", label: "Expert", description: "10 press-and-hold peeks" },
    { value: "master", label: "Master", description: "5 press-and-hold peeks" },
    { value: "grandmaster", label: "Grandmaster", description: "0 peeks (pure blindfold)" },
  ];

  return (
    <div className="p-8 space-y-8">
      <div className="mb-8">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="flex-shrink-0">
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Dashboard Mode</div>
            <h1 className="text-2xl lg:text-3xl font-bold mb-1">Welcome back, {user?.firstName || 'Player'}</h1>
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

        <Card className="bg-primary hover-elevate border-primary flex flex-col" data-testid="card-blindfold-settings">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between mb-2">
              <Brain className="h-8 w-8 text-primary-foreground" />
            </div>
            <CardTitle className="text-primary-foreground text-2xl">Blindfold Settings</CardTitle>
            <CardDescription className="text-primary-foreground/80">
              (Standard only)<br />
              {ongoingGame && ongoingGame.status === 'active' 
                ? "Finish current game to change" 
                : "Select difficulty level"}
            </CardDescription>
          </CardHeader>
          <CardContent className="mt-auto">
            <Select
              value={userSettings?.blindfoldDifficulty || "medium"}
              onValueChange={(value) => updateBlindfolddifficultyMutation.mutate(value)}
              disabled={updateBlindfolddifficultyMutation.isPending || (ongoingGame?.status === 'active')}
            >
              <SelectTrigger className="w-full bg-secondary text-secondary-foreground border-secondary-border" data-testid="select-blindfold-difficulty">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {difficultyOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div>
                      <div className="font-medium">{option.label}</div>
                      <div className="text-xs text-muted-foreground">{option.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card className="bg-primary hover-elevate border-primary flex flex-col" data-testid="card-standard-mode">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between mb-2">
              <Brain className="h-8 w-8 text-primary-foreground" />
            </div>
            <CardTitle className="text-primary-foreground text-2xl">Standard</CardTitle>
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
      </div>

      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold">Recent Games</h2>
          <Button variant="ghost" asChild data-testid="button-view-all-games">
            <Link href="/history">
              View All <History className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
        
        {gamesLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        ) : !recentGames || recentGames.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Trophy className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">No games played yet</p>
              <p className="text-sm text-muted-foreground">Start training in any mode to see your game history here</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {recentGames.slice(0, 5).map((game) => (
              <Card key={game.id} className="hover-elevate">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`px-3 py-1 rounded-md text-xs font-medium ${
                        game.result === 'white_win' && game.playerColor === 'white' ||
                        game.result === 'black_win' && game.playerColor === 'black'
                          ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                          : game.result === 'draw'
                          ? 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400'
                          : 'bg-red-500/10 text-red-600 dark:text-red-400'
                      }`}>
                        {game.result === 'white_win' && game.playerColor === 'white' ||
                         game.result === 'black_win' && game.playerColor === 'black'
                          ? 'Win'
                          : game.result === 'draw'
                          ? 'Draw'
                          : 'Loss'}
                      </div>
                      <div>
                        <p className="font-medium">{game.opponentName || 'Computer'}</p>
                        <p className="text-sm text-muted-foreground">
                          {game.mode.replace('_', ' ').toUpperCase()} · {game.timeControl}+{game.increment}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      {game.ratingChange && (
                        <p className={`text-sm font-mono font-semibold ${
                          game.ratingChange > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                        }`}>
                          {game.ratingChange > 0 ? '+' : ''}{game.ratingChange}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {new Date(game.completedAt || game.createdAt!).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
