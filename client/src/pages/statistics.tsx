import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Target, Clock, TrendingUp } from "lucide-react";
import type { Statistics } from "@shared/schema";

export default function StatisticsPage() {
  const { data: stats, isLoading } = useQuery<Statistics[]>({
    queryKey: ["/api/statistics"],
  });

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

  if (isLoading) {
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

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-4xl font-bold mb-2">Statistics</h1>
        <p className="text-muted-foreground">Detailed analytics across all training modes</p>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="otb" data-testid="tab-otb">OTB Modes</TabsTrigger>
          <TabsTrigger value="blindfold" data-testid="tab-blindfold">Blindfold</TabsTrigger>
          <TabsTrigger value="simul" data-testid="tab-simul">Simul</TabsTrigger>
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
                  {stats?.reduce((sum, s) => sum + (s.gamesPlayed || 0), 0) || 0}
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
                  {stats && stats.length > 0
                    ? Math.round(
                        (stats.reduce((sum, s) => sum + (s.wins || 0), 0) /
                          stats.reduce((sum, s) => sum + (s.gamesPlayed || 0), 0)) *
                          100
                      ) || 0
                    : 0}%
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
                  {formatDuration(stats?.reduce((sum, s) => sum + (s.totalTime || 0), 0) || 0)}
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
                  {Math.max(...(stats?.map(s => s.winStreak || 0) || [0]))}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {stats?.map((stat) => (
              <Card key={stat.id}>
                <CardHeader>
                  <CardTitle className="text-lg">
                    {stat.mode.replace(/_/g, " ").toUpperCase()}
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
        </TabsContent>

        <TabsContent value="otb" className="space-y-6">
          <div className="grid md:grid-cols-3 gap-6">
            {stats
              ?.filter(s => s.mode.startsWith("otb_"))
              .map((stat) => (
                <Card key={stat.id}>
                  <CardHeader>
                    <CardTitle>{stat.mode.replace("otb_", "").toUpperCase()}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-center">
                      <p className="text-4xl font-mono font-bold mb-1">
                        {stat.averageRating || 1200}
                      </p>
                      <p className="text-sm text-muted-foreground">Current Rating</p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center text-sm">
                      <div>
                        <p className="font-bold text-green-600 dark:text-green-400">{stat.wins}</p>
                        <p className="text-xs text-muted-foreground">W</p>
                      </div>
                      <div>
                        <p className="font-bold text-yellow-600 dark:text-yellow-400">{stat.draws}</p>
                        <p className="text-xs text-muted-foreground">D</p>
                      </div>
                      <div>
                        <p className="font-bold text-red-600 dark:text-red-400">{stat.losses}</p>
                        <p className="text-xs text-muted-foreground">L</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </TabsContent>

        <TabsContent value="blindfold">
          <Card>
            <CardHeader>
              <CardTitle>Blindfold Performance</CardTitle>
              <CardDescription>Memory training progress and achievements</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Blindfold statistics coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="simul">
          <Card>
            <CardHeader>
              <CardTitle>Simultaneous Exhibition Stats</CardTitle>
              <CardDescription>Multi-board performance metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Simul statistics coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
