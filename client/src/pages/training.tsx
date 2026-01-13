import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Zap, Target, Trophy, Mic, MicOff, Flag, Volume2, HelpCircle } from "lucide-react";
import { Chess } from 'chess.js';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { saveTrainingSession, getTrainingStats, type TrainingStats } from "@/lib/trainingStats";
import { speak } from "@/lib/voice";
import { Capacitor } from "@capacitor/core";
import BlindfoldNative, { waitForVoiceReady, debugSetSessionActive, debugSetMicListening, debugSetLastResult, debugSetLastError } from "@/lib/nativeVoice";
import type { PluginListenerHandle } from '@capacitor/core';
import { VoiceDebugOverlay } from "@/components/VoiceDebugOverlay";

const isNativePlatform = Capacitor.isNativePlatform();

// CONTINUOUS LOOP: Helper that uses native speakAndListen for TTS + mic restart
async function speakMuted(text: string): Promise<void> {
  if (isNativePlatform) {
    try {
      await BlindfoldNative.speakAndListen({ text });
    } catch (e) {
      console.error('[Training] speakAndListen error:', e);
    }
  } else {
    await speak(text);
  }
}
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

type TrainingMode = 'menu' | 'color_blitz' | 'coordinate_sniper' | 'voice_move_master';
export type TrainingGameState = 'menu' | 'ready' | 'playing' | 'finished';

interface TrainingPageProps {
  onBack: () => void;
  onStateChange?: (state: TrainingGameState) => void;
  returnToMenuRef?: React.MutableRefObject<(() => void) | null>;
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['1', '2', '3', '4', '5', '6', '7', '8'];

function isDarkSquare(fileIndex: number, rankIndex: number): boolean {
  return (fileIndex + rankIndex) % 2 === 0;
}

function getRandomSquare(): { file: string; rank: string; fileIndex: number; rankIndex: number } {
  const fileIndex = Math.floor(Math.random() * 8);
  const rankIndex = Math.floor(Math.random() * 8);
  return {
    file: FILES[fileIndex],
    rank: RANKS[rankIndex],
    fileIndex,
    rankIndex,
  };
}

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const tenths = Math.floor((ms % 1000) / 100);
  return `${seconds}.${tenths}s`;
}

export default function TrainingPage({ onBack, onStateChange, returnToMenuRef }: TrainingPageProps) {
  const [mode, setMode] = useState<TrainingMode>('menu');
  const [stats, setStats] = useState<TrainingStats | null>(null);
  const [currentGameState, setCurrentGameState] = useState<'ready' | 'playing' | 'finished'>('ready');

  useEffect(() => {
    getTrainingStats().then(setStats);
  }, [mode]);

  // Report state changes to parent
  useEffect(() => {
    if (mode === 'menu') {
      onStateChange?.('menu');
    } else {
      onStateChange?.(currentGameState);
    }
  }, [mode, currentGameState, onStateChange]);

  // Expose return to menu function for header navigation
  useEffect(() => {
    if (returnToMenuRef) {
      returnToMenuRef.current = () => {
        setMode('menu');
        setCurrentGameState('ready');
      };
    }
    return () => {
      if (returnToMenuRef) {
        returnToMenuRef.current = null;
      }
    };
  }, [returnToMenuRef]);

  const handleGameComplete = async (gameMode: 'color_blitz' | 'coordinate_sniper' | 'voice_move_master', score: number, streak: number) => {
    await saveTrainingSession(gameMode, score, streak);
    setStats(await getTrainingStats());
    window.dispatchEvent(new CustomEvent('trainingStatsUpdated'));
  };

  if (mode === 'color_blitz') {
    return <ColorBlitzGame onBack={() => setMode('menu')} onComplete={(score, streak) => handleGameComplete('color_blitz', score, streak)} stats={stats} onGameStateChange={setCurrentGameState} />;
  }

  if (mode === 'coordinate_sniper') {
    return <CoordinateSniperGame onBack={() => setMode('menu')} onComplete={(score, streak) => handleGameComplete('coordinate_sniper', score, streak)} stats={stats} onGameStateChange={setCurrentGameState} />;
  }

  if (mode === 'voice_move_master') {
    return <VoiceMoveMasterGame onBack={() => setMode('menu')} onComplete={(score, streak) => handleGameComplete('voice_move_master', score, streak)} stats={stats} onGameStateChange={setCurrentGameState} />;
  }

  return (
    <div className="flex flex-col h-full p-4 max-w-md mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-training-back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold">Training Gym</h1>
      </div>

      <div className="space-y-4 flex-1">
        <Card className="hover-elevate cursor-pointer" onClick={() => setMode('voice_move_master')} data-testid="card-voice-move-master">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-purple-500/20">
                <Volume2 className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <CardTitle className="text-lg">Voice Move Master</CardTitle>
                <CardDescription>Announce moves by voice in 60 seconds</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {stats !== null && stats.voiceMoveMasterBest !== null && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Trophy className="h-4 w-4 text-amber-500" />
                <span>Best: {stats.voiceMoveMasterBest} correct</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="hover-elevate cursor-pointer" onClick={() => setMode('color_blitz')} data-testid="card-color-blitz">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-amber-500/20">
                <Zap className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <CardTitle className="text-lg">Color Blitz</CardTitle>
                <CardDescription>Name square colors in 60 seconds</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {stats !== null && stats.colorBlitzBest !== null && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Trophy className="h-4 w-4 text-amber-500" />
                <span>Best: {stats.colorBlitzBest} correct</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="hover-elevate cursor-pointer" onClick={() => setMode('coordinate_sniper')} data-testid="card-coordinate-sniper">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <Target className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <CardTitle className="text-lg">Coordinate Sniper</CardTitle>
                <CardDescription>Find 10 squares as fast as possible</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {stats !== null && stats.coordinateSniperBest !== null && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Trophy className="h-4 w-4 text-amber-500" />
                <span>Best: {formatTime(stats.coordinateSniperBest)}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface ColorBlitzGameProps {
  onBack: () => void;
  onComplete: (score: number, streak: number) => void;
  stats: TrainingStats | null;
  onGameStateChange?: (state: 'ready' | 'playing' | 'finished') => void;
}

function ColorBlitzGame({ onBack, onComplete, stats, onGameStateChange }: ColorBlitzGameProps) {
  const [gameState, setGameState] = useState<'ready' | 'playing' | 'finished'>('ready');
  const [currentSquare, setCurrentSquare] = useState(() => getRandomSquare());
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [voiceMode, setVoiceMode] = useState(false);
  const [showResignConfirm, setShowResignConfirm] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isNewBest = stats !== null && stats.colorBlitzBest !== null && score > stats.colorBlitzBest;
  const handleAnswerRef = useRef<((answer: 'light' | 'dark' | 'white' | 'black') => void) | null>(null);
  const hasSpokenFirstSquare = useRef(false);
  const nativeListenerRef = useRef<PluginListenerHandle | null>(null);
  const isNativeVoiceActive = useRef(false);

  // Stop native voice session (stop session first, then remove listener)
  const stopNativeVoice = async () => {
    // Stop session first to prevent startListening races
    if (isNativeVoiceActive.current) {
      try {
        await BlindfoldNative.stopSession();
      } catch (e) {}
      isNativeVoiceActive.current = false;
    }
    // Then remove listener
    if (nativeListenerRef.current) {
      try {
        await nativeListenerRef.current.remove();
      } catch (e) {}
      nativeListenerRef.current = null;
    }
    setIsListening(false);
  };

  const handleBack = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    stopNativeVoice();
    onBack();
  };

  const startGame = async () => {
    setGameState('playing');
    setScore(0);
    setStreak(0);
    setBestStreak(0);
    setTimeLeft(60);
    hasSpokenFirstSquare.current = false;
    const newSquare = getRandomSquare();
    setCurrentSquare(newSquare);
    
    // Speak first square after a brief delay (speakMuted handles mute/unmute)
    setTimeout(async () => {
      if (voiceMode) {
        await speakMuted(`${newSquare.file} ${newSquare.rank}`);
        hasSpokenFirstSquare.current = true;
      }
    }, 300);
  };

  const handleResign = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    stopNativeVoice();
    onBack();
  };

  // Start/stop voice recognition based on voiceMode and gameState using BlindfoldNative
  // Permissions are requested once on app startup in App.tsx
  useEffect(() => {
    if (!isNativePlatform || !voiceMode || gameState !== 'playing') {
      return;
    }

    let cancelled = false;

    const setupNativeVoice = async () => {
      try {
        // Wait for app-level permission request to complete
        const ready = await waitForVoiceReady();
        if (!ready || cancelled) {
          console.warn('[ColorBlitz] Voice not ready or cancelled');
          return;
        }

        console.log('[ColorBlitz] Starting voice session...');

        // Set up listener for speech results
        if (nativeListenerRef.current) {
          await nativeListenerRef.current.remove();
        }
        
        if (cancelled) return;
        
        nativeListenerRef.current = await BlindfoldNative.addListener('onSpeechResult', (data) => {
          const text = data.text.toLowerCase();
          console.log('[ColorBlitz] Voice:', text);
          debugSetLastResult(text);
          
          const lightSynonyms = ['light', 'white', 'lie', 'lye', 'lite', 'lied', 'liked', 'right', 'bright'];
          const darkSynonyms = ['dark', 'black', 'bark', 'duck', 'dock', 'doc'];
          
          if (lightSynonyms.some(s => text.includes(s))) {
            handleAnswerRef.current?.('light');
          } else if (darkSynonyms.some(s => text.includes(s))) {
            handleAnswerRef.current?.('dark');
          }
          
          BlindfoldNative.startListening().catch(() => {});
        });

        if (cancelled) return;

        // Start the native voice session
        await BlindfoldNative.startSession();
        debugSetSessionActive(true);
        // CRITICAL: Must call startListening() to begin mic capture
        await BlindfoldNative.startListening();
        debugSetMicListening(true);
        isNativeVoiceActive.current = true;
        setIsListening(true);
        console.log('[ColorBlitz] Native voice session started');

      } catch (error) {
        console.error('[ColorBlitz] Native voice setup failed:', error);
        debugSetLastError(String(error));
      }
    };

    setupNativeVoice();

    return () => {
      cancelled = true;
      stopNativeVoice();
    };
  }, [voiceMode, gameState]);

  useEffect(() => {
    if (gameState === 'playing') {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            setGameState('finished');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameState]);

  useEffect(() => {
    if (gameState === 'finished') {
      onComplete(score, bestStreak);
    }
  }, [gameState, score, bestStreak, onComplete]);

  // Notify parent of game state changes
  useEffect(() => {
    onGameStateChange?.(gameState);
  }, [gameState, onGameStateChange]);

  const handleAnswer = useCallback((answer: 'light' | 'dark' | 'white' | 'black') => {
    if (gameState !== 'playing') return;
    
    // Allow white/black as synonyms for light/dark
    const normalizedAnswer = (answer === 'white' || answer === 'light') ? 'light' : 'dark';
    const isCorrect = (normalizedAnswer === 'dark') === isDarkSquare(currentSquare.fileIndex, currentSquare.rankIndex);
    
    if (isCorrect) {
      setScore(prev => prev + 1);
      setStreak(prev => {
        const newStreak = prev + 1;
        setBestStreak(best => Math.max(best, newStreak));
        // HAPTIC CALIBRATION: Use Success notification for all correct answers (distinct "ding")
        Haptics.notification({ type: NotificationType.Success }).catch(() => {});
        return newStreak;
      });
      const newSquare = getRandomSquare();
      setCurrentSquare(newSquare);
      // Voice feedback: Say the coordinate after haptic settles
      if (voiceMode) {
        // HAPTIC CALIBRATION: Wait 300ms for haptic to finish before TTS (muted during speak)
        setTimeout(async () => {
          await speakMuted(`${newSquare.file} ${newSquare.rank}`);
        }, 300);
      }
    } else {
      setStreak(0);
      // HAPTIC CALIBRATION: Double heavy buzz for wrong answers (distinct from correct)
      Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {});
      setTimeout(() => {
        Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {});
      }, 100);
      // Voice feedback: Wrong (wait for haptic to settle)
      if (voiceMode) {
        // HAPTIC CALIBRATION: Wait 300ms for haptic to finish before TTS (muted during speak)
        setTimeout(async () => {
          await speakMuted('Wrong');
        }, 300);
      }
    }
  }, [gameState, currentSquare, voiceMode]);

  // Keep ref updated for voice recognition callback
  useEffect(() => {
    handleAnswerRef.current = handleAnswer;
  }, [handleAnswer]);

  if (gameState === 'ready') {
    return (
      <div className="flex flex-col h-full p-4 max-w-md mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={handleBack} data-testid="button-colorblitz-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Color Blitz</h1>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-6">
          <div className="text-center space-y-2">
            <Zap className="h-12 w-12 text-amber-500 mx-auto" />
            <h2 className="text-2xl font-bold">Ready?</h2>
            <p className="text-muted-foreground">Name as many square colors as you can in 60 seconds!</p>
          </div>

          <div className="flex items-center gap-3">
            <Switch
              id="voice-mode"
              checked={voiceMode}
              onCheckedChange={setVoiceMode}
              data-testid="switch-voice-mode"
            />
            <Label htmlFor="voice-mode" className="flex items-center gap-2">
              {voiceMode ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
              Voice Mode
            </Label>
          </div>

          {stats !== null && stats.colorBlitzBest !== null && (
            <p className="text-sm text-muted-foreground">
              Your best: <span className="font-semibold text-amber-500">{stats.colorBlitzBest}</span> correct
            </p>
          )}

          <Button size="lg" onClick={startGame} data-testid="button-start-colorblitz">
            Start
          </Button>
        </div>
      </div>
    );
  }

  if (gameState === 'finished') {
    return (
      <div className="flex flex-col h-full p-4 max-w-md mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={handleBack} data-testid="button-colorblitz-back-finished">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Color Blitz</h1>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-6">
          <Trophy className={`h-16 w-16 ${isNewBest ? 'text-amber-500' : 'text-muted-foreground'}`} />
          <div className="text-center space-y-2">
            <h2 className="text-4xl font-bold">{score}</h2>
            <p className="text-lg text-muted-foreground">squares correct</p>
            {isNewBest && (
              <Badge className="bg-amber-500 text-white">New Personal Best!</Badge>
            )}
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={handleBack} data-testid="button-colorblitz-menu">
              Menu
            </Button>
            <Button onClick={startGame} data-testid="button-colorblitz-retry">
              Play Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {isNativePlatform && <VoiceDebugOverlay />}
      <div className="flex flex-col h-full p-4 max-w-md mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold tabular-nums">{timeLeft}s</span>
            {voiceMode && isListening && (
              <Mic className="h-4 w-4 text-red-500 animate-pulse" />
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold">{score}</span>
            {streak >= 5 && (
              <Badge variant="outline" className="text-amber-500 border-amber-500">
                {streak} streak
              </Badge>
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-8">
          <div className="text-center">
            <p className="text-6xl font-bold font-mono tracking-wider">
              {currentSquare.file}{currentSquare.rank}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 w-full">
            <Button
              size="lg"
              className="h-20 text-xl bg-amber-100 hover:bg-amber-200 text-amber-900 dark:bg-amber-100 dark:hover:bg-amber-200"
              onClick={() => handleAnswer('light')}
              data-testid="button-answer-light"
            >
              Light
            </Button>
            <Button
              size="lg"
              className="h-20 text-xl bg-amber-900 hover:bg-amber-800 text-amber-100"
              onClick={() => handleAnswer('dark')}
              data-testid="button-answer-dark"
            >
              Dark
            </Button>
          </div>
          
          {/* Resign button underneath the answer buttons */}
          <Button
            variant="outline"
            onClick={() => setShowResignConfirm(true)}
            className="mt-4"
            data-testid="button-colorblitz-resign"
          >
            <Flag className="h-4 w-4 mr-2" />
            Resign
          </Button>
        </div>
      </div>

      <AlertDialog open={showResignConfirm} onOpenChange={setShowResignConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Quit Game?</AlertDialogTitle>
            <AlertDialogDescription>
              Your current score of {score} will not be saved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-colorblitz-resign-cancel">Continue</AlertDialogCancel>
            <AlertDialogAction onClick={handleResign} data-testid="button-colorblitz-resign-confirm">
              Quit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

interface CoordinateSniperGameProps {
  onBack: () => void;
  onComplete: (score: number, streak: number) => void;
  stats: TrainingStats | null;
  onGameStateChange?: (state: 'ready' | 'playing' | 'finished') => void;
}

function CoordinateSniperGame({ onBack, onComplete, stats, onGameStateChange }: CoordinateSniperGameProps) {
  const [gameState, setGameState] = useState<'ready' | 'playing' | 'finished'>('ready');
  const [currentSquare, setCurrentSquare] = useState(() => getRandomSquare());
  const [foundCount, setFoundCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [startTime, setStartTime] = useState<number>(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [flashSquare, setFlashSquare] = useState<{ square: string; correct: boolean } | null>(null);
  const [correctSquareFlash, setCorrectSquareFlash] = useState<string | null>(null);
  const [showResignConfirm, setShowResignConfirm] = useState(false);
  const totalSquares = 10;
  const isNewBest = stats !== null && stats.coordinateSniperBest !== null && elapsedTime < stats.coordinateSniperBest && elapsedTime > 0;

  const handleResign = () => {
    onBack();
  };

  const startGame = () => {
    setGameState('playing');
    setFoundCount(0);
    setStreak(0);
    setBestStreak(0);
    setStartTime(Date.now());
    setElapsedTime(0);
    const sq = getRandomSquare();
    setCurrentSquare(sq);
    speakMuted(`Find ${sq.file} ${sq.rank}`);
  };

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (gameState === 'playing') {
      interval = setInterval(() => {
        setElapsedTime(Date.now() - startTime);
      }, 100);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [gameState, startTime]);

  // Notify parent of game state changes
  useEffect(() => {
    onGameStateChange?.(gameState);
  }, [gameState, onGameStateChange]);

  const handleSquareClick = useCallback((clickedFile: string, clickedRank: string) => {
    if (gameState !== 'playing') return;
    
    const targetSquare = `${currentSquare.file}${currentSquare.rank}`;
    const clickedSquare = `${clickedFile}${clickedRank}`;
    
    if (clickedSquare === targetSquare) {
      Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
      setFlashSquare({ square: clickedSquare, correct: true });
      
      const newCount = foundCount + 1;
      setFoundCount(newCount);
      
      const newStreak = streak + 1;
      setStreak(newStreak);
      const updatedBestStreak = Math.max(bestStreak, newStreak);
      setBestStreak(updatedBestStreak);
      
      if (newCount >= totalSquares) {
        const finalTime = Date.now() - startTime;
        setElapsedTime(finalTime);
        setGameState('finished');
        onComplete(finalTime, updatedBestStreak);
        speakMuted("Complete!");
      } else {
        setTimeout(() => {
          setFlashSquare(null);
          const newSquare = getRandomSquare();
          setCurrentSquare(newSquare);
          speakMuted(`Find ${newSquare.file} ${newSquare.rank}`);
        }, 200);
      }
    } else {
      Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {});
      Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {});
      setFlashSquare({ square: clickedSquare, correct: false });
      setCorrectSquareFlash(targetSquare);
      setStreak(0);
      speakMuted(`No, that's ${clickedFile} ${clickedRank}`);
      
      setTimeout(() => {
        setFlashSquare(null);
        setCorrectSquareFlash(null);
      }, 1000);
    }
  }, [gameState, currentSquare, foundCount, streak, bestStreak, startTime, onComplete]);

  if (gameState === 'ready') {
    return (
      <div className="flex flex-col h-full p-4 max-w-md mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-sniper-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Coordinate Sniper</h1>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-6">
          <div className="text-center space-y-2">
            <Target className="h-12 w-12 text-blue-500 mx-auto" />
            <h2 className="text-2xl font-bold">Ready?</h2>
            <p className="text-muted-foreground">Find 10 squares as fast as you can!</p>
          </div>

          {stats !== null && stats.coordinateSniperBest !== null && (
            <p className="text-sm text-muted-foreground">
              Your best: <span className="font-semibold text-blue-500">{formatTime(stats.coordinateSniperBest)}</span>
            </p>
          )}

          <Button size="lg" onClick={startGame} data-testid="button-start-sniper">
            Start
          </Button>
        </div>
      </div>
    );
  }

  if (gameState === 'finished') {
    return (
      <div className="flex flex-col h-full p-4 max-w-md mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-sniper-back-finished">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Coordinate Sniper</h1>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-6">
          <Trophy className={`h-16 w-16 ${isNewBest ? 'text-blue-500' : 'text-muted-foreground'}`} />
          <div className="text-center space-y-2">
            <h2 className="text-4xl font-bold">{formatTime(elapsedTime)}</h2>
            <p className="text-lg text-muted-foreground">to find 10 squares</p>
            {isNewBest && (
              <Badge className="bg-blue-500 text-white">New Personal Best!</Badge>
            )}
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={onBack} data-testid="button-sniper-menu">
              Menu
            </Button>
            <Button onClick={startGame} data-testid="button-sniper-retry">
              Play Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col h-full p-4 max-w-md mx-auto">
        <div className="flex items-center justify-between mb-4">
          <p className="text-lg font-semibold">
            Find: <span className="text-2xl font-mono">{currentSquare.file}{currentSquare.rank}</span>
          </p>
          <span className="text-lg font-mono tabular-nums">{formatTime(elapsedTime)}</span>
        </div>

        <Progress value={(foundCount / totalSquares) * 100} className="mb-4" />
        <p className="text-sm text-muted-foreground text-center mb-4">{foundCount}/{totalSquares} found</p>

        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="grid grid-cols-8 gap-0 aspect-square w-full max-w-sm border border-border rounded-md overflow-hidden">
            {['8', '7', '6', '5', '4', '3', '2', '1'].map((rank, rankIdx) =>
              FILES.map((file, fileIdx) => {
                const square = `${file}${rank}`;
                const isDark = (fileIdx + rankIdx) % 2 === 1;
                const isFlashing = flashSquare?.square === square;
                const isCorrectFlash = correctSquareFlash === square;
                
                let bgColor = isDark ? 'bg-amber-700' : 'bg-amber-100';
                if (isFlashing) {
                  bgColor = flashSquare.correct ? 'bg-green-500' : 'bg-red-500';
                } else if (isCorrectFlash) {
                  bgColor = 'bg-green-500';
                }
                
                return (
                  <button
                    key={square}
                    className={`aspect-square ${bgColor} transition-colors duration-100`}
                    onClick={() => handleSquareClick(file, rank)}
                    data-testid={`square-${square}`}
                  />
                );
              })
            )}
          </div>
          
          {/* Resign button underneath the board */}
          <Button
            variant="outline"
            onClick={() => setShowResignConfirm(true)}
            className="mt-4"
            data-testid="button-sniper-resign"
          >
            <Flag className="h-4 w-4 mr-2" />
            Resign
          </Button>
        </div>
      </div>

      <AlertDialog open={showResignConfirm} onOpenChange={setShowResignConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Quit Game?</AlertDialogTitle>
            <AlertDialogDescription>
              Your progress ({foundCount}/{totalSquares} found) will not be saved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-sniper-resign-cancel">Continue</AlertDialogCancel>
            <AlertDialogAction onClick={handleResign} data-testid="button-sniper-resign-confirm">
              Quit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

interface VoiceMoveMasterGameProps {
  onBack: () => void;
  onComplete: (score: number, streak: number) => void;
  stats: TrainingStats | null;
  onGameStateChange?: (state: 'ready' | 'playing' | 'finished') => void;
}

interface TargetMove {
  from: string;
  to: string;
  san: string;
  piece: string;
  captured?: string;
}

const PIECE_NAMES: Record<string, string> = {
  'p': 'pawn',
  'n': 'knight',
  'b': 'bishop',
  'r': 'rook',
  'q': 'queen',
  'k': 'king',
};

const PIECE_SPEECH: Record<string, string> = {
  'p': '',
  'n': 'Knight',
  'b': 'Bishop',
  'r': 'Rook',
  'q': 'Queen',
  'k': 'King',
};

function getRandomPosition(): { chess: Chess; move: TargetMove } {
  const chess = new Chess();
  
  // Make 5-15 random moves to get an interesting position
  const numMoves = 5 + Math.floor(Math.random() * 11);
  for (let i = 0; i < numMoves; i++) {
    const moves = chess.moves({ verbose: true });
    if (moves.length === 0) break;
    const randomMove = moves[Math.floor(Math.random() * moves.length)];
    chess.move(randomMove);
  }
  
  // Get a random legal move
  const legalMoves = chess.moves({ verbose: true });
  if (legalMoves.length === 0) {
    // Reset if no legal moves (game over)
    return getRandomPosition();
  }
  
  const selectedMove = legalMoves[Math.floor(Math.random() * legalMoves.length)];
  
  return {
    chess,
    move: {
      from: selectedMove.from,
      to: selectedMove.to,
      san: selectedMove.san,
      piece: selectedMove.piece,
      captured: selectedMove.captured,
    },
  };
}

function moveToSpeechText(move: TargetMove): string {
  const pieceName = PIECE_SPEECH[move.piece] || '';
  const capture = move.captured ? ' takes' : '';
  const from = move.from.toUpperCase();
  const to = move.to.toUpperCase();
  
  if (pieceName) {
    return `${pieceName}${capture} ${to}`;
  } else {
    return `${from}${capture} ${to}`;
  }
}

function VoiceMoveMasterGame({ onBack, onComplete, stats, onGameStateChange }: VoiceMoveMasterGameProps) {
  const [gameState, setGameState] = useState<'ready' | 'playing' | 'finished'>('ready');
  const [position, setPosition] = useState<{ chess: Chess; move: TargetMove } | null>(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [isListening, setIsListening] = useState(false);
  const [showResignConfirm, setShowResignConfirm] = useState(false);
  const [awaitingResignConfirm, setAwaitingResignConfirm] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; correct: boolean } | null>(null);
  const [textInput, setTextInput] = useState('');
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const feedbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isNewBest = stats !== null && stats.voiceMoveMasterBest !== null && score > stats.voiceMoveMasterBest;
  const nativeListenerRef = useRef<PluginListenerHandle | null>(null);
  const isNativeVoiceActive = useRef(false);
  const processVoiceInputRef = useRef<((transcript: string) => void) | null>(null);

  // Stop native voice session (stop session first, then remove listener)
  const stopNativeVoice = async () => {
    // Stop session first to prevent startListening races
    if (isNativeVoiceActive.current) {
      try {
        await BlindfoldNative.stopSession();
      } catch (e) {}
      isNativeVoiceActive.current = false;
    }
    // Then remove listener
    if (nativeListenerRef.current) {
      try {
        await nativeListenerRef.current.remove();
      } catch (e) {}
      nativeListenerRef.current = null;
    }
    setIsListening(false);
  };

  const handleBack = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    stopNativeVoice();
    onBack();
  };

  const startGame = async () => {
    setGameState('playing');
    setScore(0);
    setStreak(0);
    setBestStreak(0);
    setTimeLeft(60);
    setFeedback(null);
    const newPos = getRandomPosition();
    setPosition(newPos);
    
    // Use speakMuted which handles mute/unmute internally
    setTimeout(async () => {
      await speakMuted("Say the move.");
    }, 300);
  };

  const handleResign = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    stopNativeVoice();
    onBack();
  };

  const processVoiceInput = useCallback((transcript: string) => {
    if (!position || gameState !== 'playing') return;
    
    const input = transcript.toLowerCase().trim();
    console.log('[VoiceMoveMaster] Processing:', input);
    
    // Check for resign command
    if (input.includes('resign') || input.includes('quit')) {
      setAwaitingResignConfirm(true);
      speakMuted("Are you sure you want to resign? Say yes or no.");
      return;
    }
    
    // Handle resign confirmation
    if (awaitingResignConfirm) {
      if (input.includes('yes')) {
        setShowResignConfirm(true);
        setAwaitingResignConfirm(false);
        return;
      } else if (input.includes('no')) {
        setAwaitingResignConfirm(false);
        speakMuted("Okay, continue playing.");
        return;
      }
    }
    
    // Command: repeat/again - tell user to look at the board
    if (input.includes('repeat') || input.includes('again') || input.includes('say again')) {
      speakMuted("Look at the highlighted squares on the board.");
      return;
    }
    
    // Command: time/clock
    if (input.includes('time') || input.includes('clock')) {
      speakMuted(`${timeLeft} seconds remaining`);
      return;
    }
    
    // Command: material
    if (input.includes('material')) {
      const material = calculateMaterial(position.chess);
      speakMuted(material);
      return;
    }
    
    // Command: what's on [square]
    const whatsOnMatch = input.match(/what'?s?\s+on\s+([a-h])\s*([1-8])/i);
    if (whatsOnMatch) {
      const square = `${whatsOnMatch[1]}${whatsOnMatch[2]}` as any;
      const piece = position.chess.get(square);
      if (piece) {
        const color = piece.color === 'w' ? 'White' : 'Black';
        const pieceName = PIECE_NAMES[piece.type];
        speakMuted(`${color} ${pieceName}`);
      } else {
        speakMuted('Empty');
      }
      return;
    }
    
    // Command: where is my [piece]
    const whereIsMatch = input.match(/where\s+is\s+my\s+(\w+)/i);
    if (whereIsMatch) {
      const pieceName = whereIsMatch[1].toLowerCase();
      const pieceType = Object.entries(PIECE_NAMES).find(([, name]) => name === pieceName)?.[0];
      if (pieceType) {
        const turn = position.chess.turn();
        const board = position.chess.board();
        const squares: string[] = [];
        for (let r = 0; r < 8; r++) {
          for (let f = 0; f < 8; f++) {
            const p = board[r][f];
            if (p && p.type === pieceType && p.color === turn) {
              squares.push(`${FILES[f]}${RANKS[7 - r]}`);
            }
          }
        }
        if (squares.length > 0) {
          speakMuted(`Your ${pieceName} is on ${squares.slice(0, 3).join(', ')}`);
        } else {
          speakMuted(`You don't have a ${pieceName}`);
        }
      }
      return;
    }
    
    // Command: evaluate
    if (input.includes('eval') || input.includes('evaluate')) {
      const material = calculateMaterialValue(position.chess);
      if (material > 0) {
        speakMuted(`White is up ${material} points`);
      } else if (material < 0) {
        speakMuted(`Black is up ${Math.abs(material)} points`);
      } else {
        speakMuted('Position is equal');
      }
      return;
    }
    
    // Command: legal moves for [piece]
    const legalMovesMatch = input.match(/legal\s+moves?\s+for\s+(\w+)/i);
    if (legalMovesMatch) {
      const pieceName = legalMovesMatch[1].toLowerCase();
      const pieceType = Object.entries(PIECE_NAMES).find(([, name]) => name === pieceName)?.[0];
      if (pieceType) {
        const moves = position.chess.moves({ verbose: true })
          .filter(m => m.piece === pieceType)
          .slice(0, 4)
          .map(m => m.san);
        if (moves.length > 0) {
          speakMuted(`${pieceName} can play ${moves.join(', ')}`);
        } else {
          speakMuted(`No legal moves for ${pieceName}`);
        }
      }
      return;
    }
    
    // Check if it matches the target move
    if (matchesMove(input, position.move)) {
      // Clear any pending "Try Again" feedback
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
        feedbackTimeoutRef.current = null;
      }
      
      // Success haptic - the "ping" to signal next move is ready
      Haptics.notification({ type: NotificationType.Success }).catch(() => {});
      setFeedback({ text: 'Correct!', correct: true });
      const newScore = score + 1;
      const newStreak = streak + 1;
      setScore(newScore);
      setStreak(newStreak);
      const updatedBestStreak = Math.max(bestStreak, newStreak);
      setBestStreak(updatedBestStreak);
      
      // Minimal verbal feedback - just "Correct!" to avoid TTS echo loop
      speakMuted('Correct!');
      
      // Move to next position silently (haptic already signals readiness)
      setTimeout(() => {
        setFeedback(null);
        const newPos = getRandomPosition();
        setPosition(newPos);
      }, 500);
    } else {
      // Reset streak immediately on wrong answer (don't delay this)
      setStreak(0);
      
      // FIX: Debounce "Try Again" UI feedback to wait 1s before showing
      // This prevents double feedback from partial speech recognition
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
      }
      
      feedbackTimeoutRef.current = setTimeout(() => {
        Haptics.notification({ type: NotificationType.Error }).catch(() => {});
        setFeedback({ text: 'Try again', correct: false });
        
        setTimeout(() => setFeedback(null), 1000);
      }, 1000);
    }
  }, [position, gameState, score, streak, bestStreak, timeLeft, awaitingResignConfirm]);
  
  // Keep processVoiceInput ref updated
  useEffect(() => {
    processVoiceInputRef.current = processVoiceInput;
  }, [processVoiceInput]);

  // Start/stop voice recognition based on gameState using BlindfoldNative
  // Permissions are requested once on app startup in App.tsx
  useEffect(() => {
    if (!isNativePlatform || gameState !== 'playing') {
      return;
    }

    let cancelled = false;

    const setupNativeVoice = async () => {
      try {
        // Wait for app-level permission request to complete
        const ready = await waitForVoiceReady();
        if (!ready || cancelled) {
          console.warn('[VoiceMoveMaster] Voice not ready or cancelled');
          return;
        }

        console.log('[VoiceMoveMaster] Starting voice session...');

        // Set up listener for speech results
        if (nativeListenerRef.current) {
          await nativeListenerRef.current.remove();
        }
        
        if (cancelled) return;
        
        nativeListenerRef.current = await BlindfoldNative.addListener('onSpeechResult', (data) => {
          const transcript = data.text;
          debugSetLastResult(transcript);
          if (transcript.length >= 2) {
            processVoiceInputRef.current?.(transcript);
          }
          BlindfoldNative.startListening().catch(() => {});
        });

        if (cancelled) return;

        // Start the native voice session
        await BlindfoldNative.startSession();
        debugSetSessionActive(true);
        // CRITICAL: Must call startListening() to begin mic capture
        await BlindfoldNative.startListening();
        debugSetMicListening(true);
        isNativeVoiceActive.current = true;
        setIsListening(true);
        console.log('[VoiceMoveMaster] Native voice session started');

      } catch (error) {
        console.error('[VoiceMoveMaster] Native voice setup failed:', error);
        debugSetLastError(String(error));
      }
    };

    setupNativeVoice();

    return () => {
      cancelled = true;
      stopNativeVoice();
    };
  }, [gameState]);

  // Timer
  useEffect(() => {
    if (gameState === 'playing') {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            setGameState('finished');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameState]);

  // Game complete
  useEffect(() => {
    if (gameState === 'finished') {
      onComplete(score, bestStreak);
    }
  }, [gameState, score, bestStreak, onComplete]);

  // Notify parent of game state changes
  useEffect(() => {
    onGameStateChange?.(gameState);
  }, [gameState, onGameStateChange]);

  if (gameState === 'ready') {
    return (
      <div className="flex flex-col h-full p-4 max-w-md mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={handleBack} data-testid="button-voicemaster-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Voice Move Master</h1>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-6">
          <div className="text-center space-y-2">
            <Volume2 className="h-12 w-12 text-purple-500 mx-auto" />
            <h2 className="text-2xl font-bold">Ready?</h2>
            <p className="text-muted-foreground">Announce chess moves by voice!</p>
            <p className="text-sm text-muted-foreground">Say the highlighted move within 60 seconds</p>
          </div>

          {stats !== null && stats.voiceMoveMasterBest !== null && (
            <p className="text-sm text-muted-foreground">
              Your best: <span className="font-semibold text-purple-500">{stats.voiceMoveMasterBest} moves</span>
            </p>
          )}

          <Button size="lg" onClick={startGame} data-testid="button-start-voicemaster">
            Start
          </Button>
        </div>
      </div>
    );
  }

  if (gameState === 'finished') {
    return (
      <div className="flex flex-col h-full p-4 max-w-md mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={handleBack} data-testid="button-voicemaster-back-finished">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Voice Move Master</h1>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-6">
          <Trophy className={`h-16 w-16 ${isNewBest ? 'text-purple-500' : 'text-muted-foreground'}`} />
          <div className="text-center space-y-2">
            <h2 className="text-4xl font-bold">{score}</h2>
            <p className="text-lg text-muted-foreground">moves announced correctly</p>
            {bestStreak > 1 && (
              <p className="text-sm text-muted-foreground">Best streak: {bestStreak}</p>
            )}
            {isNewBest && (
              <Badge className="bg-purple-500 text-white">New Personal Best!</Badge>
            )}
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={handleBack} data-testid="button-voicemaster-menu">
              Menu
            </Button>
            <Button onClick={startGame} data-testid="button-voicemaster-retry">
              Play Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Playing state
  const board = position?.chess.board() || [];
  const fromSquare = position?.move.from || '';
  const toSquare = position?.move.to || '';

  return (
    <>
      {isNativePlatform && <VoiceDebugOverlay />}
      <div className="flex flex-col h-full p-4 max-w-md mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-mono font-bold tabular-nums">{timeLeft}</span>
            {isListening && (
              <Mic className="h-5 w-5 text-red-500 animate-pulse" />
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold">{score}</span>
            {streak >= 3 && (
              <Badge variant="outline" className="text-purple-500 border-purple-500">
                {streak} streak
              </Badge>
            )}
          </div>
        </div>
        

        {/* Feedback display */}
        {feedback && (
          <div className={`text-center py-2 mb-2 rounded ${feedback.correct ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
            <span className="font-semibold">{feedback.text}</span>
          </div>
        )}

        {/* Chess board */}
        <div className="flex items-center justify-center mb-4">
          <div className="grid grid-cols-8 gap-0 aspect-square w-full max-w-sm border border-border rounded-md overflow-hidden">
            {['8', '7', '6', '5', '4', '3', '2', '1'].map((rank, rankIdx) =>
              FILES.map((file, fileIdx) => {
                const square = `${file}${rank}`;
                const isDark = (fileIdx + rankIdx) % 2 === 1;
                const piece = board[rankIdx]?.[fileIdx];
                const isFromSquare = square === fromSquare;
                const isToSquare = square === toSquare;
                
                let bgColor = isDark ? 'bg-amber-700' : 'bg-amber-100';
                if (isFromSquare) {
                  bgColor = 'bg-yellow-400';
                } else if (isToSquare) {
                  bgColor = 'bg-red-500';
                }
                
                const pieceSymbols: Record<string, string> = {
                  'wk': '\u2654', 'wq': '\u2655', 'wr': '\u2656', 'wb': '\u2657', 'wn': '\u2658', 'wp': '\u2659',
                  'bk': '\u265A', 'bq': '\u265B', 'br': '\u265C', 'bb': '\u265D', 'bn': '\u265E', 'bp': '\u265F',
                };
                
                return (
                  <div
                    key={square}
                    className={`aspect-square ${bgColor} flex items-center justify-center text-2xl`}
                  >
                    {piece && pieceSymbols[`${piece.color}${piece.type}`]}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Target move display */}
        <div className="text-center mb-4">
          <p className="text-lg">
            {isNativePlatform ? 'Say: ' : 'Type: '}<span className="font-bold text-purple-500">{position?.move.san}</span>
          </p>
        </div>

        {/* Text input fallback for web */}
        {!isNativePlatform && (
          <form
            className="flex gap-2 mb-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (textInput.trim()) {
                processVoiceInput(textInput);
                setTextInput('');
              }
            }}
          >
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Type move here..."
              className="flex-1 px-3 py-2 border rounded-md bg-background"
              autoFocus
              data-testid="input-voicemaster-text"
            />
            <Button type="submit" data-testid="button-voicemaster-submit">
              Submit
            </Button>
          </form>
        )}

        {/* Resign button underneath the board */}
        <Button
          variant="outline"
          onClick={() => setShowResignConfirm(true)}
          className="mx-auto mb-4"
          data-testid="button-voicemaster-resign"
        >
          <Flag className="h-4 w-4 mr-2" />
          Resign
        </Button>

        {/* Voice Commands Key */}
        <div className="bg-muted/50 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <HelpCircle className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{isNativePlatform ? 'Voice Commands' : 'Commands'}</span>
          </div>
          <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
            <span>repeat / again</span>
            <span>time / clock</span>
            <span>what's on [square]</span>
            <span>where is my [piece]</span>
            <span>material</span>
            <span>evaluate</span>
            <span>legal moves for [piece]</span>
            <span>resign</span>
          </div>
        </div>
      </div>

      <AlertDialog open={showResignConfirm} onOpenChange={setShowResignConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Quit Game?</AlertDialogTitle>
            <AlertDialogDescription>
              Your current score of {score} will not be saved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-voicemaster-resign-cancel">Continue</AlertDialogCancel>
            <AlertDialogAction onClick={handleResign} data-testid="button-voicemaster-resign-confirm">
              Quit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// Helper functions for Voice Move Master
function calculateMaterial(chess: Chess): string {
  const board = chess.board();
  let whiteMaterial = 0;
  let blackMaterial = 0;
  const values: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  
  for (const row of board) {
    for (const piece of row) {
      if (piece) {
        const value = values[piece.type];
        if (piece.color === 'w') {
          whiteMaterial += value;
        } else {
          blackMaterial += value;
        }
      }
    }
  }
  
  const diff = whiteMaterial - blackMaterial;
  if (diff > 0) return `White is up ${diff} point${diff !== 1 ? 's' : ''}`;
  if (diff < 0) return `Black is up ${Math.abs(diff)} point${Math.abs(diff) !== 1 ? 's' : ''}`;
  return 'Material is equal';
}

function calculateMaterialValue(chess: Chess): number {
  const board = chess.board();
  let diff = 0;
  const values: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  
  for (const row of board) {
    for (const piece of row) {
      if (piece) {
        const value = values[piece.type];
        diff += piece.color === 'w' ? value : -value;
      }
    }
  }
  return diff;
}

// CONNECTOR WORDS: Treat "to", "takes", "captures", "moves", "x" as equivalent
// User can say any of these interchangeably regardless of whether move is a capture
const CONNECTOR_WORDS = ['to', 'takes', 'captures', 'moves', 'x', 'move'];

// Phonetic mappings for Vosk speech recognition
// NOTE: "to", "for" excluded - they're connector words not rank numbers in chess context
const SPOKEN_NUMBERS: Record<string, string> = {
  'one': '1', 'won': '1', 'first': '1',
  'two': '2', 'too': '2', 'second': '2',  // NOT "to" - it's a connector word
  'three': '3', 'free': '3', 'tree': '3', 'third': '3',
  'four': '4', 'fore': '4', 'forth': '4', 'fourth': '4',  // NOT "for" - it's a preposition
  'five': '5', 'fifth': '5',
  'six': '6', 'sixth': '6', 'sicks': '6',
  'seven': '7', 'seventh': '7',
  'eight': '8', 'ate': '8', 'eighth': '8',
};

const SPOKEN_PIECES: Record<string, string> = {
  'night': 'knight', 'nite': 'knight', 'horse': 'knight',
  'rock': 'rook', 'castle': 'rook', 'brook': 'rook',
  'bish': 'bishop', 'bishup': 'bishop',
  'pond': 'pawn',
};

// Phonetic file letters (a-h) - how Vosk might hear them
const SPOKEN_FILES: Record<string, string> = {
  'ay': 'a', 'aye': 'a', 'eh': 'a', 'alpha': 'a', 'alfa': 'a', 'apple': 'a', 'able': 'a',
  'bee': 'b', 'be': 'b', 'bravo': 'b', 'boy': 'b', 'baker': 'b',
  'cee': 'c', 'see': 'c', 'sea': 'c', 'charlie': 'c', 'cat': 'c',
  'dee': 'd', 'delta': 'd', 'dog': 'd', 'david': 'd',
  'eee': 'e', 'ee': 'e', 'echo': 'e', 'easy': 'e', 'edward': 'e',
  'ef': 'f', 'eff': 'f', 'foxtrot': 'f', 'fox': 'f', 'frank': 'f',
  'gee': 'g', 'jee': 'g', 'golf': 'g', 'george': 'g',
  'aitch': 'h', 'ach': 'h', 'hotel': 'h', 'henry': 'h',
};

function normalizePhonetics(text: string): string {
  let normalized = text.toLowerCase();
  
  // STEP 1: Replace spoken file letters with actual letters FIRST
  // So "bee for" becomes "b for" before we check for "[a-h] for" pattern
  for (const [spoken, file] of Object.entries(SPOKEN_FILES)) {
    normalized = normalized.replace(new RegExp(`\\b${spoken}\\b`, 'g'), file);
  }
  
  // STEP 2: Handle context-aware "for" → "4" (only when after a file letter)
  // Pattern: [file letter] + "for" → [file letter] + "4"
  // Now "b for" correctly becomes "b 4"
  normalized = normalized.replace(/\b([a-h])\s+for\b/g, '$1 4');
  
  // STEP 3: Replace spoken numbers with digits
  for (const [spoken, digit] of Object.entries(SPOKEN_NUMBERS)) {
    normalized = normalized.replace(new RegExp(`\\b${spoken}\\b`, 'g'), digit);
  }
  
  // STEP 4: Replace spoken piece names with standard names
  for (const [spoken, piece] of Object.entries(SPOKEN_PIECES)) {
    normalized = normalized.replace(new RegExp(`\\b${spoken}\\b`, 'g'), piece);
  }
  
  return normalized;
}

function matchesMove(input: string, target: TargetMove): boolean {
  // STEP 1: Normalize phonetics first ("seven" → "7", "night" → "knight")
  const phoneticNormalized = normalizePhonetics(input);
  console.log('[matchesMove] Input:', input, '→ Normalized:', phoneticNormalized, '→ Target:', target.san);
  
  // Normalize and strip connector words for flexible matching
  let normalized = phoneticNormalized.replace(/[^a-z0-9\s]/g, '');
  const words = normalized.split(/\s+/);
  
  // Strip connector words for core matching (but keep original for bare coord check)
  const wordsWithoutConnectors = words.filter(w => !CONNECTOR_WORDS.includes(w));
  const strippedNormalized = wordsWithoutConnectors.join(' ');
  
  // FIX: Bare coordinate check for pawn moves (e.g., user says "c4" for pawn to c4)
  const bareCoord = normalized.replace(/\s+/g, '').match(/^([a-h])([1-8])$/);
  if (bareCoord && target.piece === 'p') {
    const targetSquare = bareCoord[1] + bareCoord[2];
    if (target.to === targetSquare) return true;
  }
  
  // Also check stripped version for bare coord (after removing "to" etc)
  const strippedBareCoord = strippedNormalized.replace(/\s+/g, '').match(/^([a-h])([1-8])$/);
  if (strippedBareCoord && target.piece === 'p') {
    const targetSquare = strippedBareCoord[1] + strippedBareCoord[2];
    if (target.to === targetSquare) return true;
  }
  
  // Direct SAN match (e.g., "Nf3", "e4", "Bxc6")
  const sanLower = target.san.toLowerCase().replace(/[+#x]/g, '');
  if (strippedNormalized.replace(/\s+/g, '').includes(sanLower)) return true;
  
  // Check for piece + destination (flexible matching)
  const pieceNames = ['knight', 'night', 'bishop', 'rook', 'queen', 'king', 'pawn'];
  const targetPieceName = PIECE_NAMES[target.piece];
  
  const hasCorrectPiece = wordsWithoutConnectors.some(w => 
    (targetPieceName === 'pawn' && !pieceNames.some(p => p !== 'pawn' && strippedNormalized.includes(p))) ||
    strippedNormalized.includes(targetPieceName) ||
    (targetPieceName === 'knight' && strippedNormalized.includes('night'))
  );
  
  // Check for destination square (flexible - look in stripped version)
  const destFile = target.to[0];
  const destRank = target.to[1];
  const hasDestination = strippedNormalized.includes(target.to) || 
    (strippedNormalized.includes(destFile) && strippedNormalized.includes(destRank));
  
  // If we have the correct piece and destination, it's a match!
  // We don't care whether they said "to", "takes", or nothing - all are valid
  if (hasCorrectPiece && hasDestination) {
    return true;
  }
  
  return false;
}
