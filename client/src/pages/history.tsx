import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trophy, TrendingUp, TrendingDown, BarChart3, Flag } from "lucide-react";
import { ReportPlayerDialog } from "@/components/ReportPlayerDialog";
import type { Game } from "@shared/schema";

export default function History() {
  const [, setLocation] = useLocation();
  const [modeFilter, setModeFilter] = useState("all");
  
  const queryUrl = modeFilter === "all" 
    ? "/api/games/history" 
    : `/api/games/history?mode=${modeFilter}`;
  
  const { data: games, isLoading } = useQuery<Game[]>({
    queryKey: ["/api/games/history", modeFilter],
    queryFn: async () => {
      const response = await fetch(queryUrl);
      if (!response.ok) throw new Error("Failed to fetch games");
      return response.json();
    },
  });

  const getResultBadge = (game: Game) => {
    const isWin = 
      (game.result === "white_win" && game.playerColor === "white") ||
      (game.result === "black_win" && game.playerColor === "black");
    const isDraw = game.result === "draw";
    
    return (
      <Badge 
        variant={isWin ? "default" : isDraw ? "secondary" : "destructive"}
        className="w-16 justify-center"
      >
        {isWin ? "Win" : isDraw ? "Draw" : "Loss"}
      </Badge>
    );
  };

  return (
    <div className="p-8 space-y-6">
      <Helmet>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold mb-2">Game History</h1>
          <p className="text-muted-foreground">Review your past games and track improvement</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Select value={modeFilter} onValueChange={setModeFilter}>
          <SelectTrigger className="w-60" data-testid="select-mode-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Modes</SelectItem>
            <SelectItem value="otb_bullet">OTB Bullet</SelectItem>
            <SelectItem value="otb_blitz">OTB Blitz</SelectItem>
            <SelectItem value="otb_rapid">OTB Rapid</SelectItem>
            <SelectItem value="blindfold">Blindfold</SelectItem>
            <SelectItem value="simul">Simul</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : !games || games.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Trophy className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No games found</h3>
            <p className="text-muted-foreground mb-6">
              {modeFilter === "all" 
                ? "Start playing to build your game history"
                : "No games found for this mode"}
            </p>
            <Button asChild data-testid="button-start-playing">
              <a href="/">Start Playing</a>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {games.map((game) => (
            <Card key={game.id} className="hover-elevate" data-testid={`game-${game.id}`}>
              <CardContent className="py-5">
                <div className="grid grid-cols-12 gap-4 items-center">
                  <div className="col-span-2">
                    {getResultBadge(game)}
                  </div>
                  
                  <div className="col-span-4">
                    <p className="font-semibold">{game.opponentName || "Computer"}</p>
                    <p className="text-sm text-muted-foreground">
                      {game.mode.replace(/_/g, " ").toUpperCase()}
                    </p>
                  </div>
                  
                  <div className="col-span-2 font-mono text-sm text-muted-foreground">
                    {game.timeControl}+{game.increment}
                  </div>
                  
                  <div className="col-span-2">
                    {game.ratingChange && (
                      <div className={`flex items-center gap-1 font-mono font-semibold ${
                        game.ratingChange > 0 
                          ? "text-green-600 dark:text-green-400" 
                          : "text-red-600 dark:text-red-400"
                      }`}>
                        {game.ratingChange > 0 ? (
                          <TrendingUp className="h-4 w-4" />
                        ) : (
                          <TrendingDown className="h-4 w-4" />
                        )}
                        <span>{game.ratingChange > 0 ? "+" : ""}{game.ratingChange}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="col-span-1 text-right">
                    <p className="text-sm text-muted-foreground">
                      {new Date(game.completedAt || game.createdAt!).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(game.completedAt || game.createdAt!).toLocaleTimeString()}
                    </p>
                  </div>
                  
                  <div className="col-span-1 flex items-center justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setLocation(`/analysis/${game.id}`)}
                      data-testid={`button-analyze-${game.id}`}
                    >
                      <BarChart3 className="w-4 h-4 mr-1" />
                      Analyze
                    </Button>
                    {game.opponentId && (
                      <ReportPlayerDialog
                        reportedUserId={game.opponentId}
                        reportedUserName={game.opponentName || "Opponent"}
                        gameId={game.id}
                        trigger={
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-muted-foreground h-8 w-8"
                            data-testid={`button-report-${game.id}`}
                          >
                            <Flag className="h-4 w-4" />
                          </Button>
                        }
                      />
                    )}
                  </div>
                </div>
                
                {game.mode === "otb_bullet" || game.mode === "otb_blitz" || game.mode === "otb_rapid" ? (
                  <div className="mt-3 pt-3 border-t text-sm text-muted-foreground">
                    Manual clock presses: {game.manualClockPresses || 0}
                  </div>
                ) : game.mode === "blindfold" ? (
                  <div className="mt-3 pt-3 border-t text-sm text-muted-foreground">
                    Peeks used: {game.peeksUsed || 0} · Level {game.blindfoldLevel || 1}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
