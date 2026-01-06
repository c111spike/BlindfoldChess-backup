import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { AboutDialog } from "@/components/about-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { BarChart3, RefreshCw, Mic } from "lucide-react";
import { loadStats, resetStats, getAveragePeekTime, formatPeekTime, type GameStats } from "@/lib/gameStats";
import GamePage from "@/pages/game";

export default function App() {
  const [showStatsDialog, setShowStatsDialog] = useState(false);
  const [showVoiceHelpDialog, setShowVoiceHelpDialog] = useState(false);
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
              
              <Dialog open={showVoiceHelpDialog} onOpenChange={setShowVoiceHelpDialog}>
                <DialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    data-testid="button-voice-help"
                  >
                    <Mic className="h-5 w-5" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Voice Commands</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 text-sm">
                    <div className="space-y-2">
                      <h3 className="font-semibold">Basic Moves</h3>
                      <ul className="space-y-1 text-muted-foreground">
                        <li><span className="font-mono text-foreground">"e4"</span> - Move pawn to e4</li>
                        <li><span className="font-mono text-foreground">"knight f3"</span> - Move knight to f3</li>
                        <li><span className="font-mono text-foreground">"bishop takes c6"</span> - Capture on c6</li>
                        <li><span className="font-mono text-foreground">"castle kingside"</span> - Castle short (O-O)</li>
                        <li><span className="font-mono text-foreground">"castle queenside"</span> - Castle long (O-O-O)</li>
                      </ul>
                    </div>
                    
                    <div className="space-y-2">
                      <h3 className="font-semibold">When Two Pieces Can Move</h3>
                      <p className="text-muted-foreground">
                        If you have two pieces that can reach the same square, specify which one by adding the file letter:
                      </p>
                      <p className="text-muted-foreground">
                        Example: Rooks on A1 and F1, to move the F rook to D1:
                      </p>
                      <p className="font-mono text-foreground">"Rook F to D1"</p>
                    </div>
                    
                    <div className="space-y-2">
                      <h3 className="font-semibold">Other Commands</h3>
                      <ul className="space-y-1 text-muted-foreground">
                        <li><span className="font-mono text-foreground">"say again"</span> or <span className="font-mono text-foreground">"repeat"</span> - Hear the last move again</li>
                        <li><span className="font-mono text-foreground">"resign"</span> - Resign the game</li>
                      </ul>
                    </div>
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
