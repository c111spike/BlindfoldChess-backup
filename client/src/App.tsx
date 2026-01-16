import { useState, useEffect, useRef } from "react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { SettingsDialog } from "@/components/settings-dialog";
import { AboutDialog } from "@/components/about-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { BarChart3, RefreshCw, Mic, History } from "lucide-react";
import { loadStats, resetStats, type GameStats } from "@/lib/gameStats";
import { StatsDashboard } from "@/components/stats-dashboard";
import GamePage, { type GameViewState } from "@/pages/game";
import TrainingPage, { type TrainingGameState } from "@/pages/training";
import { getDailyGoalsEnabled, getTodaySessionCount, isDailyGoalMet } from "@/lib/trainingStats";
import { Capacitor } from "@capacitor/core";
import BlindfoldNative, { markVoiceReady, debugSetPermission, debugSetModelReady, debugSetLastError } from "@/lib/nativeVoice";

export default function App() {
  const [showStatsDialog, setShowStatsDialog] = useState(false);
  const [showVoiceHelpDialog, setShowVoiceHelpDialog] = useState(false);
  const [stats, setStats] = useState<GameStats>(loadStats());
  const [historyTrigger, setHistoryTrigger] = useState(0);
  const [gameViewState, setGameViewState] = useState<GameViewState>('idle');
  const [showReturnConfirm, setShowReturnConfirm] = useState(false);
  const returnToTitleRef = useRef<(() => void) | null>(null);
  const [showTraining, setShowTraining] = useState(false);
  const [trainingGameState, setTrainingGameState] = useState<TrainingGameState>('menu');
  const returnToTrainingMenuRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const handleStatsUpdate = () => {
      setStats(loadStats());
    };
    window.addEventListener('statsUpdated', handleStatsUpdate);
    return () => window.removeEventListener('statsUpdated', handleStatsUpdate);
  }, []);

  // Request microphone permission on app load (Android only)
  // MUST request permission FIRST, then wait for Vosk service (it needs mic permission to bind)
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      markVoiceReady(true); // Web mode - always ready
      return;
    }
    
    const requestMicPermission = async () => {
      try {
        console.log('[App] Requesting mic permission on startup...');
        debugSetPermission('requesting...');
        // Request permission FIRST - Vosk service needs this before it can bind
        const result = await BlindfoldNative.requestPermissions();
        console.log('[App] Mic permission result:', result.mic);
        debugSetPermission(result.mic);
        
        if (result.mic !== 'granted') {
          console.warn('[App] Mic permission denied');
          debugSetLastError('Mic permission denied');
          markVoiceReady(false);
          return;
        }
        
        // Only wait for Vosk service AFTER permission is granted
        console.log('[App] Permission granted, waiting for Vosk service...');
        await BlindfoldNative.waitUntilReady();
        console.log('[App] Vosk service ready');
        debugSetModelReady(true);
        markVoiceReady(true);
      } catch (error) {
        console.error('[App] Failed to initialize voice:', error);
        debugSetLastError(String(error));
        markVoiceReady(false);
      }
    };
    
    requestMicPermission();
  }, []);

  const handleOpenHistory = () => {
    setHistoryTrigger(prev => prev + 1);
  };

  const handleTitleClick = () => {
    // Handle training mode
    if (showTraining) {
      if (trainingGameState === 'menu' || trainingGameState === 'ready' || trainingGameState === 'finished') {
        // Not in active game - just return to title
        setShowTraining(false);
        return;
      }
      // In active training game - show confirmation
      setShowReturnConfirm(true);
      return;
    }
    
    if (gameViewState === 'idle') {
      // Already on title - close any open dialogs and return to clean title screen
      setShowVoiceHelpDialog(false);
      setShowStatsDialog(false);
      window.dispatchEvent(new CustomEvent('closeAllDialogs'));
      return;
    }
    if (gameViewState === 'setup') {
      // On setup screen - just go back to title, no confirmation needed
      if (returnToTitleRef.current) {
        returnToTitleRef.current();
      }
      return;
    }
    // Show confirmation dialog for in_game and reconstruction
    setShowReturnConfirm(true);
  };

  const handleConfirmReturn = () => {
    setShowReturnConfirm(false);
    
    // Handle training mode
    if (showTraining) {
      if (returnToTrainingMenuRef.current) {
        returnToTrainingMenuRef.current();
      }
      setShowTraining(false);
      return;
    }
    
    if (returnToTitleRef.current) {
      returnToTitleRef.current();
    }
  };

  const getConfirmMessage = () => {
    // Handle training mode
    if (showTraining && trainingGameState === 'playing') {
      return "Quit this training game and return to title?";
    }
    
    switch (gameViewState) {
      case 'in_game':
        return "Resign this game and return to title?";
      case 'reconstruction':
        return "Leave this challenge and return to title?";
      case 'analysis':
        return "Skip analysis and return to title?";
      default:
        return "Return to title?";
    }
  };

  return (
    <ThemeProvider defaultTheme="dark">
      <TooltipProvider>
        <div className="flex flex-col h-dvh bg-background">
          <header className="grid grid-cols-3 items-center p-3 border-b border-border pt-[var(--safe-area-top)]">
            <div className="flex justify-start">
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
                  <div className="space-y-4 text-sm max-h-[60vh] overflow-y-auto">
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
                        If you have two pieces that can reach the same square, specify which one:
                      </p>
                      <p className="font-mono text-foreground">"Rook F to D1"</p>
                    </div>
                    
                    <div className="space-y-2">
                      <h3 className="font-semibold">Query Commands</h3>
                      <ul className="space-y-1 text-muted-foreground">
                        <li><span className="font-mono text-foreground">"say again"</span> / <span className="font-mono text-foreground">"repeat"</span> / <span className="font-mono text-foreground">"again"</span> - Hear the last move</li>
                        <li><span className="font-mono text-foreground">"last move"</span> - Hear opponent's last move</li>
                        <li><span className="font-mono text-foreground">"what's on e4"</span> - Check what piece is on a square</li>
                        <li><span className="font-mono text-foreground">"where is my queen"</span> - Find your piece locations</li>
                        <li><span className="font-mono text-foreground">"how much time"</span> / <span className="font-mono text-foreground">"clock"</span> - Hear remaining time</li>
                        <li><span className="font-mono text-foreground">"resign"</span> / <span className="font-mono text-foreground">"quit"</span> / <span className="font-mono text-foreground">"give up"</span> - Resign the game</li>
                      </ul>
                    </div>
                    
                    <div className="space-y-2">
                      <h3 className="font-semibold">Resign Confirmation</h3>
                      <ul className="space-y-1 text-muted-foreground">
                        <li><span className="font-mono text-foreground">"yes"</span> / <span className="font-mono text-foreground">"confirm"</span> - Confirm resignation</li>
                        <li><span className="font-mono text-foreground">"no"</span> / <span className="font-mono text-foreground">"cancel"</span> - Cancel resignation</li>
                      </ul>
                    </div>
                    
                    <div className="space-y-2">
                      <h3 className="font-semibold">Pro Commands</h3>
                      <ul className="space-y-1 text-muted-foreground">
                        <li><span className="font-mono text-foreground">"material"</span> - Hear material balance</li>
                        <li><span className="font-mono text-foreground">"legal moves for knight"</span> - List piece's legal moves</li>
                        <li><span className="font-mono text-foreground">"show board"</span> / <span className="font-mono text-foreground">"peek"</span> - Show board for 5 seconds</li>
                        <li><span className="font-mono text-foreground">"evaluate"</span> / <span className="font-mono text-foreground">"eval"</span> - Hear engine evaluation</li>
                      </ul>
                      <p className="text-xs text-muted-foreground/70 mt-1">
                        Note: "show board" and "evaluate" mark the game as assisted
                      </p>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <button
              onClick={handleTitleClick}
              className={`text-lg font-bold text-center whitespace-nowrap cursor-pointer transition-colors bg-transparent border-none p-0 m-0 font-inherit text-inherit outline-none select-none ${gameViewState === 'idle' ? 'cursor-default text-foreground' : 'text-foreground hover:text-primary'}`}
              style={{
                WebkitTapHighlightColor: 'transparent',
                WebkitTouchCallout: 'none',
              }}
              data-testid="button-title-home"
            >
              Blindfold Chess
            </button>
            <div className="flex items-center gap-1 justify-end">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleOpenHistory}
                data-testid="button-game-history"
              >
                <History className="h-5 w-5" />
              </Button>
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
                <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden">
                  <DialogHeader>
                    <DialogTitle>Training Metrics</DialogTitle>
                  </DialogHeader>
                  <StatsDashboard stats={stats} />
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-muted-foreground mt-4"
                    onClick={() => {
                      resetStats();
                      setStats(loadStats());
                    }}
                    data-testid="button-reset-stats"
                  >
                    <RefreshCw className="mr-2 h-3 w-3" />
                    Reset All Statistics
                  </Button>
                </DialogContent>
              </Dialog>
            </div>
          </header>
          <main className="flex-1 overflow-hidden">
            {showTraining ? (
              <TrainingPage 
                onBack={() => setShowTraining(false)} 
                onStateChange={setTrainingGameState}
                returnToMenuRef={returnToTrainingMenuRef}
              />
            ) : (
              <GamePage 
                historyTrigger={historyTrigger}
                onStateChange={setGameViewState}
                returnToTitleRef={returnToTitleRef}
                onTrainNowClick={() => setShowTraining(true)}
              />
            )}
          </main>
          <footer className="grid grid-cols-3 items-center p-2 border-t border-border pb-[var(--safe-area-bottom)]">
            <div className="flex justify-start">
              <SettingsDialog />
            </div>
            <div className="flex justify-center">
              <ThemeToggle />
            </div>
            <div className="flex justify-end">
              <AboutDialog />
            </div>
          </footer>
        </div>
        
        {/* Confirmation dialog for returning to title */}
        <AlertDialog open={showReturnConfirm} onOpenChange={setShowReturnConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Return to Title</AlertDialogTitle>
              <AlertDialogDescription>
                {getConfirmMessage()}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-return">Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmReturn} data-testid="button-confirm-return">
                Confirm
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        
        <Toaster />
      </TooltipProvider>
    </ThemeProvider>
  );
}
