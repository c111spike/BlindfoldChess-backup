import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, Brain, Grid3x3, TrendingUp, TrendingDown, Trophy, History } from "lucide-react";
import type { Rating, Game } from "@shared/schema";

export default function Dashboard() {
  const { data: ratings, isLoading: ratingsLoading } = useQuery<Rating>({
    queryKey: ["/api/ratings"],
  });

  const { data: recentGames, isLoading: gamesLoading } = useQuery<Game[]>({
    queryKey: ["/api/games/recent"],
  });

  if (ratingsLoading) {
    return (
      <div className="p-8 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex-1">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-4">Dashboard Mode</div>
          <h1 className="text-4xl font-bold mb-2">Welcome back, Grandmaster</h1>
          <p className="text-muted-foreground">Ready for your daily training?</p>
        </div>
        <Button variant="default" size="lg" className="px-6" data-testid="button-go-premium">
          GO PREMIUM
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="space-y-0 pb-3">
            <CardDescription className="text-xs font-medium">Bullet (1 min)</CardDescription>
            <CardTitle className="text-3xl font-mono font-bold" data-testid="text-rating-bullet">
              {ratings?.bullet || 1200}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3" />
              <span>+12 this month</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-0 pb-3">
            <CardDescription className="text-xs font-medium">Blitz (5 min)</CardDescription>
            <CardTitle className="text-3xl font-mono font-bold" data-testid="text-rating-blitz">
              {ratings?.blitz || 1200}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3" />
              <span>+8 this month</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-0 pb-3">
            <CardDescription className="text-xs font-medium">Rapid (15 min)</CardDescription>
            <CardTitle className="text-3xl font-mono font-bold" data-testid="text-rating-rapid">
              {ratings?.rapid || 1200}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <TrendingDown className="h-3 w-3 text-destructive" />
              <span className="text-destructive">-5 this month</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-0 pb-3">
            <CardDescription className="text-xs font-medium">Classical (30 min)</CardDescription>
            <CardTitle className="text-3xl font-mono font-bold" data-testid="text-rating-classical">
              {ratings?.classical || 1200}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3" />
              <span>+15 this month</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <Card className="bg-primary hover-elevate border-primary" data-testid="card-simul-exhibition">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between mb-2">
              <Grid3x3 className="h-8 w-8 text-primary-foreground" />
            </div>
            <CardTitle className="text-primary-foreground text-2xl">Simul Exhibition</CardTitle>
            <CardDescription className="text-primary-foreground/80">
              2-10 boards. 30 seconds per move. FIFO rotation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="secondary" className="w-full" data-testid="button-mode-simul">
              <Link href="/simul">Start Exhibition</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover-elevate" data-testid="card-otb-mode">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between mb-2">
              <Clock className="h-8 w-8 text-foreground" />
            </div>
            <CardTitle className="text-2xl">OTB Tournament Mode</CardTitle>
            <CardDescription>
              Manual clock. FIDE tournament practice.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full" data-testid="button-mode-otb">
              <Link href="/otb">Start Game</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover-elevate" data-testid="card-standard-mode">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between mb-2">
              <Brain className="h-8 w-8 text-foreground" />
            </div>
            <CardTitle className="text-2xl">Standard</CardTitle>
            <CardDescription>
              Online chess. Automatic clocks. Optional blindfold.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full" data-testid="button-mode-standard">
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
