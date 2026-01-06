import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { AboutDialog } from "@/components/about-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { BarChart3, RefreshCw } from "lucide-react";
import { loadStats, resetStats, getAveragePeekTime, formatPeekTime, type GameStats } from "@/lib/gameStats";
import GamePage from "@/pages/game";

export default function App() {
  const [showStatsDialog, setShowStatsDialog] = useState(false);
  const [stats, setStats] = useState<GameStats>(loadStats());

  useEffect(() => {
    const handleStatsUpdate = () => {
      setStats(loadStats());
    };
    window.addEventListener('statsUpdated', handleStatsUpdate);
    return () => window.removeEventListener('statsUpdated', handleStatsUpdate);
  }, []);

  return (
    <ThemeProvider defaultTheme="dark">
      <TooltipProvider>
        <div className="flex flex-col min-h-screen bg-background">
          <header className="grid grid-cols-3 items-center p-3 border-b border-border">
            <div className="flex justify-start">
              <Dialog open={showStatsDialog} onOpenChange={setShowStatsDialog}>
                <DialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    data-testid="button-stats"
                  >
                    <BarChart3 className="h-5 w-5" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Your Statistics</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div className="space-y-1">
                        <p className="text-2xl font-bold text-green-600">{stats.wins}</p>
                        <p className="text-sm text-muted-foreground">Wins</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-2xl font-bold text-gray-600">{stats.draws}</p>
                        <p className="text-sm text-muted-foreground">Draws</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-2xl font-bold text-red-600">{stats.losses}</p>
                        <p className="text-sm text-muted-foreground">Losses</p>
                      </div>
                    </div>
                    
                    <div className="border-t pt-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Last Game Peek Time</span>
                        <span className="font-medium">{formatPeekTime(stats.lastGamePeekTime)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Average Peek Time</span>
                        <span className="font-medium">{formatPeekTime(getAveragePeekTime(stats))}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Games with Peeks</span>
                        <span className="font-medium">{stats.gamesWithPeeks}</span>
                      </div>
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-muted-foreground"
                      onClick={() => {
                        resetStats();
                        setStats(loadStats());
                      }}
                      data-testid="button-reset-stats"
                    >
                      <RefreshCw className="mr-2 h-3 w-3" />
                      Reset Statistics
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <h1 className="text-lg font-bold text-foreground text-center whitespace-nowrap">Blindfold Chess</h1>
            <div className="flex items-center gap-1 justify-end">
              <AboutDialog />
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            <GamePage />
          </main>
        </div>
        <Toaster />
      </TooltipProvider>
    </ThemeProvider>
  );
}
