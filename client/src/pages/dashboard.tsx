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
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-4xl font-bold mb-2">Dashboard</h1>
        <p className="text-muted-foreground">Track your progress across all training modes</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="space-y-0 pb-3">
            <CardDescription className="text-xs font-medium">OTB Bullet</CardDescription>
            <CardTitle className="text-3xl font-mono font-bold" data-testid="text-rating-otb-bullet">
              {ratings?.otbBullet || 1200}
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
            <CardDescription className="text-xs font-medium">OTB Blitz</CardDescription>
            <CardTitle className="text-3xl font-mono font-bold" data-testid="text-rating-otb-blitz">
              {ratings?.otbBlitz || 1200}
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
            <CardDescription className="text-xs font-medium">OTB Rapid</CardDescription>
            <CardTitle className="text-3xl font-mono font-bold" data-testid="text-rating-otb-rapid">
              {ratings?.otbRapid || 1200}
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
            <CardDescription className="text-xs font-medium">Blindfold</CardDescription>
            <CardTitle className="text-3xl font-mono font-bold" data-testid="text-rating-blindfold">
              {ratings?.blindfold || 1200}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3" />
              <span>+23 this month</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-0 pb-3">
            <CardDescription className="text-xs font-medium">Simul</CardDescription>
            <CardTitle className="text-3xl font-mono font-bold" data-testid="text-rating-simul">
              {ratings?.simul || 1200}
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

      <div>
        <h2 className="text-2xl font-semibold mb-6">Training Modes</h2>
        <div className="grid md:grid-cols-3 gap-6">
          <Card className="hover-elevate">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Clock className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>OTB Tournament</CardTitle>
              <CardDescription>
                Practice with manual clock pressing and arbiter AI
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full" data-testid="button-mode-otb">
                <Link href="/otb">Start Training</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="hover-elevate">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Brain className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Blindfold</CardTitle>
              <CardDescription>
                Develop memory with voice-controlled gameplay
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full" data-testid="button-mode-blindfold">
                <Link href="/blindfold">Start Training</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="hover-elevate">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Grid3x3 className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>FIFO Simul</CardTitle>
              <CardDescription>
                Play multiple opponents with per-move clock
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full" data-testid="button-mode-simul">
                <Link href="/simul">Start Training</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
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
