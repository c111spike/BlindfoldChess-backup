import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, Brain, Grid3x3, TrendingUp, TrendingDown, Trophy, History } from "lucide-react";
import type { Rating, Game, UserSettings } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

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
    { value: "easy", label: "Easy", description: "Unlimited peeks (3 sec)" },
    { value: "medium", label: "Medium", description: "20 peeks (3 sec)" },
    { value: "hard", label: "Hard", description: "15 peeks (2.5 sec)" },
    { value: "expert", label: "Expert", description: "10 peeks (2 sec)" },
    { value: "master", label: "Master", description: "5 peeks (1.5 sec)" },
    { value: "grandmaster", label: "Grandmaster", description: "0 peeks" },
  ];

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex-1">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-4">Dashboard Mode</div>
          <h1 className="text-4xl font-bold mb-2">Welcome back, {user?.firstName || 'Player'}</h1>
          <p className="text-muted-foreground">Ready for your daily training?</p>
        </div>
        <Button variant="default" size="lg" className="px-6" data-testid="button-go-premium">
          GO PREMIUM
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="space-y-0 pb-3">
            <CardDescription className="text-xs font-medium">OTB Bullet</CardDescription>
            <CardTitle className="text-3xl font-mono font-bold" data-testid="text-rating-bullet">
              {ratings?.bullet || 1200}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3" />
              <span>+12</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-0 pb-3">
            <CardDescription className="text-xs font-medium">OTB Blitz</CardDescription>
            <CardTitle className="text-3xl font-mono font-bold" data-testid="text-rating-blitz">
              {ratings?.blitz || 1200}
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
            <CardTitle className="text-3xl font-mono font-bold" data-testid="text-rating-rapid">
              {ratings?.rapid || 1200}
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
            <CardDescription className="text-xs font-medium">Classical Elo</CardDescription>
            <CardTitle className="text-3xl font-mono font-bold" data-testid="text-rating-classical">
              {ratings?.classical || 1400}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3" />
              <span>+15</span>
            </div>
          </CardContent>
        </Card>

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
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-primary hover-elevate border-primary flex flex-col" data-testid="card-simul-exhibition">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between mb-2">
              <Grid3x3 className="h-8 w-8 text-primary-foreground" />
            </div>
            <CardTitle className="text-primary-foreground text-2xl">Simul vs Simul</CardTitle>
            <CardDescription className="text-primary-foreground/80">
              2-10 boards<br />30 seconds/move<br />Once you start on a board.
            </CardDescription>
          </CardHeader>
          <CardContent className="mt-auto">
            <Button asChild variant="secondary" className="w-full" data-testid="button-mode-simul">
              <Link href="/simul">Start Simul</Link>
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
              {ongoingGame && ongoingGame.status === 'active' 
                ? "Finish your current game to change difficulty" 
                : "Select difficulty for blindfold mode"}
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
