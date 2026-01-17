import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Zap, Target, Trophy, Mic, MicOff, Flag, Volume2, HelpCircle, ChevronRight, Crown, Brain, Eye, EyeOff } from "lucide-react";
import { Chess } from 'chess.js';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { saveTrainingSession, getTrainingStats, type TrainingStats, type TrainingMode as TrainingModeType } from "@/lib/trainingStats";
import { generateKnightChallenge, isLegalKnightMove, findKnightPath } from "@/lib/knightsPath";
import { generateEndgame, getEndgameTypes, type EndgameType } from "@/lib/endgameDrills";
import { getRandomMarathon, getDifficultyTiers, type DifficultyTier, type MarathonScenario } from "@/lib/blindfoldMarathon";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

type TrainingMode = 'menu' | 'color_blitz' | 'coordinate_sniper' | 'voice_move_master' | 'knights_path' | 'endgame_drills' | 'blindfold_marathon';
export type TrainingGameState = 'menu' | 'ready' | 'playing' | 'finished';

interface TrainingPageProps {
  onBack: () => void;
  onStateChange?: (state: TrainingGameState) => void;
  returnToMenuRef?: React.MutableRefObject<(() => void) | null>;
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['1', '2', '3', '4', '5', '6', '7', '8'];

// TTS pronunciation helper - pronounce 'a' as 'ay' for clarity
function speakableCoordinate(file: string, rank: string): string {
  const spokenFile = file === 'a' ? 'ay' : file;
  return `${spokenFile} ${rank}`;
}

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

  const handleGameComplete = async (gameMode: TrainingModeType, score: number, streak: number = 0, variant?: string) => {
    await saveTrainingSession(gameMode, score, streak, variant);
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

  if (mode === 'knights_path') {
    return <KnightsPathGame onBack={() => setMode('menu')} onComplete={(time, variant) => handleGameComplete('knights_path', time, 0, variant)} stats={stats} onGameStateChange={setCurrentGameState} />;
  }

  if (mode === 'endgame_drills') {
    return <EndgameDrillsGame onBack={() => setMode('menu')} onComplete={(time, variant) => handleGameComplete('endgame_drills', time, 0, variant)} stats={stats} onGameStateChange={setCurrentGameState} />;
  }

  if (mode === 'blindfold_marathon') {
    return <BlindfoldsMarathonGame onBack={() => setMode('menu')} onComplete={(time, streak, variant) => handleGameComplete('blindfold_marathon', time, streak, variant)} stats={stats} onGameStateChange={setCurrentGameState} />;
  }

  return (
    <div className="flex flex-col h-full p-3 max-w-md mx-auto">
      <div className="flex items-center gap-2 mb-3">
        <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-training-back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold">Training Gym</h1>
      </div>

      <div className="flex flex-col gap-2 flex-1">
        <Card className="hover-elevate cursor-pointer flex-1" onClick={() => setMode('voice_move_master')} data-testid="card-voice-move-master">
          <CardHeader className="h-full py-2 px-3">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-purple-500/20">
                <Volume2 className="h-5 w-5 text-purple-500" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">Voice Move Master</CardTitle>
                  {stats !== null && stats.voiceMoveMasterBest !== null && (
                    <Badge variant="secondary" className="text-xs">{stats.voiceMoveMasterBest}</Badge>
                  )}
                </div>
                <CardDescription className="text-xs mt-0.5">Announce chess moves by voice in 60 seconds</CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>

        <Card className="hover-elevate cursor-pointer flex-1" onClick={() => setMode('color_blitz')} data-testid="card-color-blitz">
          <CardHeader className="h-full py-2 px-3">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-amber-500/20">
                <Zap className="h-5 w-5 text-amber-500" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">Color Blitz</CardTitle>
                  {stats !== null && stats.colorBlitzBest !== null && (
                    <Badge variant="secondary" className="text-xs">{stats.colorBlitzBest}</Badge>
                  )}
                </div>
                <CardDescription className="text-xs mt-0.5">Name square colors as fast as you can</CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>

        <Card className="hover-elevate cursor-pointer flex-1" onClick={() => setMode('coordinate_sniper')} data-testid="card-coordinate-sniper">
          <CardHeader className="h-full py-2 px-3">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <Target className="h-5 w-5 text-blue-500" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">Coordinate Sniper</CardTitle>
                  {stats !== null && stats.coordinateSniperBest !== null && (
                    <Badge variant="secondary" className="text-xs">{formatTime(stats.coordinateSniperBest)}</Badge>
                  )}
                </div>
                <CardDescription className="text-xs mt-0.5">Find 10 squares as fast as possible</CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>

        <Card className="hover-elevate cursor-pointer flex-1" onClick={() => setMode('knights_path')} data-testid="card-knights-path">
          <CardHeader className="h-full py-2 px-3">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-green-500/20">
                <ChevronRight className="h-5 w-5 text-green-500" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">Knight's Path</CardTitle>
                  {stats !== null && stats.knightsPathBest !== null && (
                    <Badge variant="secondary" className="text-xs">{formatTime(stats.knightsPathBest)}</Badge>
                  )}
                </div>
                <CardDescription className="text-xs mt-0.5">Navigate the knight to the target square</CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>

        <Card className="hover-elevate cursor-pointer flex-1" onClick={() => setMode('endgame_drills')} data-testid="card-endgame-drills">
          <CardHeader className="h-full py-2 px-3">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-orange-500/20">
                <Crown className="h-5 w-5 text-orange-500" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">Endgame Drills</CardTitle>
                  {stats !== null && stats.endgameDrillsBest !== null && (
                    <Badge variant="secondary" className="text-xs">{formatTime(stats.endgameDrillsBest)}</Badge>
                  )}
                </div>
                <CardDescription className="text-xs mt-0.5">Checkmate with K+Q or K+R vs King blindfolded</CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>

        <Card className="hover-elevate cursor-pointer flex-1" onClick={() => setMode('blindfold_marathon')} data-testid="card-blindfold-marathon">
          <CardHeader className="h-full py-2 px-3">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-red-500/20">
                <Brain className="h-5 w-5 text-red-500" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">Blindfold Marathon</CardTitle>
                  {stats !== null && stats.blindfoldMarathonBest !== null && (
                    <Badge variant="secondary" className="text-xs">{formatTime(stats.blindfoldMarathonBest)}</Badge>
                  )}
                </div>
                <CardDescription className="text-xs mt-0.5">Visualize famous games and find the winning move</CardDescription>
              </div>
            </div>
          </CardHeader>
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
  const [isPracticeMode, setIsPracticeMode] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'challenge' | 'practice'>('challenge');
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

  const startGame = async (practiceMode: boolean = false) => {
    setIsPracticeMode(practiceMode);
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
        await speakMuted(speakableCoordinate(newSquare.file, newSquare.rank));
        hasSpokenFirstSquare.current = true;
      }
    }, 300);
  };

  const handleResign = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    stopNativeVoice();
    onBack();
  };
  
  const handlePracticeResign = () => {
    setShowResignConfirm(true);
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
          
          const lightSynonyms = ['light', 'white', 'lie', 'lye', 'lite', 'lied', 'liked', 'right', 'bright', 'lyte', 'lit', 'like', 'life'];
          const darkSynonyms = ['dark', 'black', 'bark', 'duck', 'dock', 'doc', 'dork', 'dog', 'dart'];
          
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
    // Skip timer countdown in practice mode (unlimited time)
    if (gameState === 'playing' && !isPracticeMode) {
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
  }, [gameState, isPracticeMode]);

  useEffect(() => {
    // Skip stats in practice mode
    if (gameState === 'finished' && !isPracticeMode) {
      onComplete(score, bestStreak);
    }
  }, [gameState, score, bestStreak, onComplete, isPracticeMode]);

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
          await speakMuted(speakableCoordinate(newSquare.file, newSquare.rank));
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
      <div className="flex flex-col h-full p-3 max-w-md mx-auto">
        <div className="flex items-center gap-2 mb-3">
          <Button variant="ghost" size="icon" onClick={handleBack} data-testid="button-colorblitz-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Color Blitz</h1>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="text-center space-y-2">
            <Zap className="h-12 w-12 text-amber-500 mx-auto" />
            <h2 className="text-2xl font-bold">Ready?</h2>
          </div>

          <Tabs value={selectedTab} onValueChange={(v) => setSelectedTab(v as 'challenge' | 'practice')} className="w-full max-w-xs">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="challenge" data-testid="tab-colorblitz-challenge">1 Minute Challenge</TabsTrigger>
              <TabsTrigger value="practice" data-testid="tab-colorblitz-practice">Practice</TabsTrigger>
            </TabsList>
          </Tabs>

          <p className="text-muted-foreground text-center">
            {selectedTab === 'challenge' 
              ? 'Name as many square colors as you can in 60 seconds!'
              : 'Practice at your own pace with unlimited time.'}
          </p>

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

          {selectedTab === 'challenge' && stats !== null && stats.colorBlitzBest !== null && (
            <p className="text-sm text-muted-foreground">
              Your best: <span className="font-semibold text-amber-500">{stats.colorBlitzBest}</span> correct
            </p>
          )}

          <Button size="lg" onClick={() => startGame(selectedTab === 'practice')} data-testid="button-start-colorblitz">
            Start
          </Button>
        </div>
      </div>
    );
  }

  if (gameState === 'finished') {
    return (
      <div className="flex flex-col h-full p-3 max-w-md mx-auto">
        <div className="flex items-center gap-2 mb-3">
          <Button variant="ghost" size="icon" onClick={handleBack} data-testid="button-colorblitz-back-finished">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Color Blitz</h1>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-4">
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
            <Button onClick={() => startGame(false)} data-testid="button-colorblitz-retry">
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
      <div className="flex flex-col h-full p-3 max-w-md mx-auto">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {isPracticeMode ? (
              <Badge variant="outline">Practice</Badge>
            ) : (
              <span className="text-2xl font-bold tabular-nums">{timeLeft}s</span>
            )}
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

        <div className="flex-1 flex flex-col items-center justify-center gap-6">
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
  const [isPracticeMode, setIsPracticeMode] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'challenge' | 'practice'>('challenge');
  const [isBoardFlipped, setIsBoardFlipped] = useState(false);
  const totalSquares = 10;
  const isNewBest = stats !== null && stats.coordinateSniperBest !== null && elapsedTime < stats.coordinateSniperBest && elapsedTime > 0;

  const handleResign = () => {
    onBack();
  };

  const startGame = (practiceMode: boolean = false) => {
    setIsPracticeMode(practiceMode);
    setGameState('playing');
    setFoundCount(0);
    setStreak(0);
    setBestStreak(0);
    setStartTime(Date.now());
    setElapsedTime(0);
    setFlashSquare(null);
    setCorrectSquareFlash(null);
    const sq = getRandomSquare();
    setCurrentSquare(sq);
    // Use "ay" pronunciation for file A
    const fileSpoken = sq.file === 'a' ? 'ay' : sq.file;
    speakMuted(`Find ${fileSpoken} ${sq.rank}`);
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
      
      if (newCount >= totalSquares && !isPracticeMode) {
        const finalTime = Date.now() - startTime;
        setElapsedTime(finalTime);
        setGameState('finished');
        onComplete(finalTime, updatedBestStreak);
        speakMuted("Complete!");
      } else if (newCount >= totalSquares && isPracticeMode) {
        // In practice mode, just reset and continue - don't end the game
        setFoundCount(0);
        setStreak(0);
        setBestStreak(0);
        setTimeout(() => {
          setFlashSquare(null);
          const newSquare = getRandomSquare();
          setCurrentSquare(newSquare);
          const fileSpoken = newSquare.file === 'a' ? 'ay' : newSquare.file;
          speakMuted(`Great! Find ${fileSpoken} ${newSquare.rank}`);
        }, 200);
        return;
      } else {
        setTimeout(() => {
          setFlashSquare(null);
          const newSquare = getRandomSquare();
          setCurrentSquare(newSquare);
          // Use "ay" pronunciation for file A
          const fileSpoken = newSquare.file === 'a' ? 'ay' : newSquare.file;
          speakMuted(`Find ${fileSpoken} ${newSquare.rank}`);
        }, 200);
      }
    } else {
      Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {});
      Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {});
      setFlashSquare({ square: clickedSquare, correct: false });
      setCorrectSquareFlash(targetSquare);
      setStreak(0);
      speakMuted(`No, that's ${speakableCoordinate(clickedFile, clickedRank)}`);
      
      setTimeout(() => {
        setFlashSquare(null);
        setCorrectSquareFlash(null);
      }, 1000);
    }
  }, [gameState, currentSquare, foundCount, streak, bestStreak, startTime, onComplete]);

  if (gameState === 'ready') {
    return (
      <div className="flex flex-col h-full p-3 max-w-md mx-auto">
        <div className="flex items-center gap-2 mb-3">
          <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-sniper-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Coordinate Sniper</h1>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="text-center space-y-2">
            <Target className="h-12 w-12 text-blue-500 mx-auto" />
            <h2 className="text-2xl font-bold">Ready?</h2>
          </div>

          <Tabs value={selectedTab} onValueChange={(v) => setSelectedTab(v as 'challenge' | 'practice')} className="w-full max-w-xs">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="challenge" data-testid="tab-sniper-challenge">10 Square Race</TabsTrigger>
              <TabsTrigger value="practice" data-testid="tab-sniper-practice">Practice</TabsTrigger>
            </TabsList>
          </Tabs>

          <p className="text-muted-foreground text-center">
            {selectedTab === 'challenge' 
              ? 'Find 10 squares as fast as you can!'
              : 'Practice finding squares with no time pressure.'}
          </p>

          <div className="flex items-center gap-3 justify-center">
            <Label htmlFor="board-flip" className="text-sm text-muted-foreground">Play as Black</Label>
            <Switch
              id="board-flip"
              checked={isBoardFlipped}
              onCheckedChange={setIsBoardFlipped}
              data-testid="switch-board-flip"
            />
          </div>

          {selectedTab === 'challenge' && stats !== null && stats.coordinateSniperBest !== null && (
            <p className="text-sm text-muted-foreground">
              Your best: <span className="font-semibold text-blue-500">{formatTime(stats.coordinateSniperBest)}</span>
            </p>
          )}

          <Button size="lg" onClick={() => startGame(selectedTab === 'practice')} data-testid="button-start-sniper">
            Start
          </Button>
        </div>
      </div>
    );
  }

  if (gameState === 'finished') {
    return (
      <div className="flex flex-col h-full p-3 max-w-md mx-auto">
        <div className="flex items-center gap-2 mb-3">
          <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-sniper-back-finished">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Coordinate Sniper</h1>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-4">
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
            <Button onClick={() => startGame(false)} data-testid="button-sniper-retry">
              Play Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col h-full p-3 max-w-md mx-auto">
        <div className="flex items-center justify-between mb-2">
          <p className="text-lg font-semibold">
            Find: <span className="text-2xl font-mono">{currentSquare.file}{currentSquare.rank}</span>
          </p>
          <div className="flex items-center gap-2">
            {isPracticeMode ? (
              <Badge variant="outline">Practice</Badge>
            ) : (
              <span className="text-lg font-mono tabular-nums">{formatTime(elapsedTime)}</span>
            )}
          </div>
        </div>

        {!isPracticeMode && <Progress value={(foundCount / totalSquares) * 100} className="mb-2" />}
        <p className="text-sm text-muted-foreground text-center mb-2">
          {isPracticeMode ? `${foundCount} found` : `${foundCount}/${totalSquares} found`}
        </p>

        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="grid grid-cols-8 gap-0 aspect-square w-full max-w-sm border border-border rounded-md overflow-hidden">
            {(isBoardFlipped ? ['1', '2', '3', '4', '5', '6', '7', '8'] : ['8', '7', '6', '5', '4', '3', '2', '1']).map((rank, rankIdx) =>
              (isBoardFlipped ? [...FILES].reverse() : FILES).map((file, fileIdx) => {
                const square = `${file}${rank}`;
                const actualFileIdx = FILES.indexOf(file);
                const actualRankIdx = RANKS.indexOf(rank);
                const isDark = isDarkSquare(actualFileIdx, actualRankIdx);
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
  const [isPracticeMode, setIsPracticeMode] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'challenge' | 'practice'>('challenge');
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

  const startGame = async (practiceMode: boolean = false) => {
    setIsPracticeMode(practiceMode);
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

  // Timer - skip in practice mode
  useEffect(() => {
    if (gameState === 'playing' && !isPracticeMode) {
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
  }, [gameState, isPracticeMode]);

  // Game complete - skip stats in practice mode
  useEffect(() => {
    if (gameState === 'finished' && !isPracticeMode) {
      onComplete(score, bestStreak);
    }
  }, [gameState, score, bestStreak, onComplete, isPracticeMode]);

  // Notify parent of game state changes
  useEffect(() => {
    onGameStateChange?.(gameState);
  }, [gameState, onGameStateChange]);

  if (gameState === 'ready') {
    return (
      <div className="flex flex-col h-full p-3 max-w-md mx-auto">
        <div className="flex items-center gap-2 mb-3">
          <Button variant="ghost" size="icon" onClick={handleBack} data-testid="button-voicemaster-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Voice Move Master</h1>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="text-center space-y-2">
            <Volume2 className="h-12 w-12 text-purple-500 mx-auto" />
            <h2 className="text-2xl font-bold">Ready?</h2>
          </div>

          <Tabs value={selectedTab} onValueChange={(v) => setSelectedTab(v as 'challenge' | 'practice')} className="w-full max-w-xs">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="challenge" data-testid="tab-voicemaster-challenge">1 Minute Challenge</TabsTrigger>
              <TabsTrigger value="practice" data-testid="tab-voicemaster-practice">Practice</TabsTrigger>
            </TabsList>
          </Tabs>

          <p className="text-muted-foreground text-center">
            {selectedTab === 'challenge' 
              ? 'Say the highlighted move within 60 seconds!'
              : 'Practice announcing moves at your own pace.'}
          </p>

          {selectedTab === 'challenge' && stats !== null && stats.voiceMoveMasterBest !== null && (
            <p className="text-sm text-muted-foreground">
              Your best: <span className="font-semibold text-purple-500">{stats.voiceMoveMasterBest} moves</span>
            </p>
          )}

          <Button size="lg" onClick={() => startGame(selectedTab === 'practice')} data-testid="button-start-voicemaster">
            Start
          </Button>
        </div>
      </div>
    );
  }

  if (gameState === 'finished') {
    return (
      <div className="flex flex-col h-full p-3 max-w-md mx-auto">
        <div className="flex items-center gap-2 mb-3">
          <Button variant="ghost" size="icon" onClick={handleBack} data-testid="button-voicemaster-back-finished">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Voice Move Master</h1>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-4">
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
            <Button onClick={() => startGame(false)} data-testid="button-voicemaster-retry">
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
      <div className="flex flex-col h-full p-3 max-w-md mx-auto">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {isPracticeMode ? (
              <Badge variant="outline">Practice</Badge>
            ) : (
              <span className="text-2xl font-mono font-bold tabular-nums">{timeLeft}</span>
            )}
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

        {/* Chess Notation Guide */}
        <div className="bg-muted/50 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <HelpCircle className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Chess Notation</span>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span><strong>e4</strong> = pawn to e4</span>
            <span><strong>R</strong> = Rook</span>
            <span><strong>N</strong> = Knight</span>
            <span><strong>B</strong> = Bishop</span>
            <span><strong>Q</strong> = Queen</span>
            <span><strong>K</strong> = King</span>
            <span><strong>Bb2</strong> = Bishop to b2</span>
            <span><strong>Nxc5</strong> = Knight takes c5</span>
            <span><strong>0-0</strong> = Kingside castle</span>
            <span><strong>0-0-0</strong> = Queenside castle</span>
            <span><strong>+</strong> = Check</span>
            <span><strong>#</strong> = Checkmate</span>
            <span><strong>=Q</strong> = Promote to Queen</span>
            <span><strong>e.p.</strong> = En passant</span>
            <span className="col-span-2"><strong>Rac1</strong> = When 2 rooks can go to c1, specify which (a-file)</span>
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
  'ef': 'f', 'eff': 'f', 'foxtrot': 'f', 'fox': 'f', 'frank': 'f', 'if': 'f', 'of': 'f',
  'gee': 'g', 'jee': 'g', 'golf': 'g', 'george': 'g',
  'aitch': 'h', 'ach': 'h', 'hotel': 'h', 'henry': 'h',
};

function normalizePhonetics(text: string): string {
  let normalized = text.toLowerCase();
  
  // STEP 0: Handle compound phonetic mishearings FIRST
  // "before" → "b 4" (Vosk hears "b four" as "before")
  normalized = normalized.replace(/\bbefore\b/g, 'b 4');
  // "sci fi" or "scifi" → "c 5" (Vosk hears "c five" as "sci fi")
  normalized = normalized.replace(/\bsci\s*fi\b/g, 'c 5');
  normalized = normalized.replace(/\bscifi\b/g, 'c 5');
  // "quincy" → "queen c" (Vosk hears "Queen c" as "Quincy")
  normalized = normalized.replace(/\bquincy\b/g, 'queen c');
  
  // STEP 1: Replace spoken file letters with actual letters FIRST
  // So "bee for" becomes "b for" before we check for "[a-h] for" pattern
  for (const [spoken, file] of Object.entries(SPOKEN_FILES)) {
    normalized = normalized.replace(new RegExp(`\\b${spoken}\\b`, 'g'), file);
  }
  
  // STEP 2: Context-aware "he" → "e" (when followed by rank 1-8 or rank-like words including "for")
  // "he 4" → "e 4", "he for" → "e for" (which then becomes "e 4")
  normalized = normalized.replace(/\bhe\s+([1-8])\b/g, 'e $1');
  normalized = normalized.replace(/\bhe\s+(one|two|three|four|five|six|seven|eight|won|too|free|fore|for|fifth|sixth|seventh|eighth)\b/gi, 'e $1');
  
  // STEP 3: Context-aware "the" → "d" (when followed by rank - works for bare coords and after pieces/captures)
  // "the 8" → "d 8", "king the 8" → "king d 8", "takes the 5" → "takes d 5"
  normalized = normalized.replace(/\bthe\s+([1-8])\b/g, 'd $1');
  normalized = normalized.replace(/\bthe\s+(one|two|three|four|five|six|seven|eight)\b/gi, 'd $1');
  
  // STEP 4: Handle context-aware "for" → "4" (only when after a file letter)
  // Pattern: [file letter] + "for" → [file letter] + "4"
  // Now "b for" correctly becomes "b 4"
  normalized = normalized.replace(/\b([a-h])\s+for\b/g, '$1 4');
  
  // STEP 5: Replace spoken numbers with digits
  for (const [spoken, digit] of Object.entries(SPOKEN_NUMBERS)) {
    normalized = normalized.replace(new RegExp(`\\b${spoken}\\b`, 'g'), digit);
  }
  
  // STEP 6: Replace spoken piece names with standard names
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

// ============ KNIGHT'S PATH GAME ============
interface KnightsPathGameProps {
  onBack: () => void;
  onComplete: (time: number, variant?: string) => void;
  stats: TrainingStats | null;
  onGameStateChange?: (state: 'ready' | 'playing' | 'finished') => void;
}

function KnightsPathGame({ onBack, onComplete, stats, onGameStateChange }: KnightsPathGameProps) {
  const [gameState, setGameState] = useState<'ready' | 'playing' | 'finished'>('ready');
  const [challenge, setChallenge] = useState(() => generateKnightChallenge(3, 4));
  const [currentPosition, setCurrentPosition] = useState('');
  const [userPath, setUserPath] = useState<string[]>([]);
  const [startTime, setStartTime] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [pathsCompleted, setPathsCompleted] = useState(0);
  const [showResignConfirm, setShowResignConfirm] = useState(false);
  const [isPracticeMode, setIsPracticeMode] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'challenge' | 'practice'>('challenge');
  const [flashSquare, setFlashSquare] = useState<{ square: string; correct: boolean } | null>(null);
  const [hideKnight, setHideKnight] = useState(false);
  const [audioInputEnabled, setAudioInputEnabled] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const nativeListenerRef = useRef<PluginListenerHandle | null>(null);
  const handleSquareClickRef = useRef<((file: string, rank: string) => void) | null>(null);
  const voiceActiveRef = useRef(false);
  const totalPaths = 5;
  const isNewBest = stats?.knightsPathBest !== null && elapsedTime > 0 && elapsedTime < (stats?.knightsPathBest || Infinity);

  useEffect(() => {
    onGameStateChange?.(gameState);
  }, [gameState, onGameStateChange]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (gameState === 'playing') {
      interval = setInterval(() => {
        setElapsedTime(Date.now() - startTime);
      }, 100);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [gameState, startTime]);

  const stopVoiceSession = useCallback(async () => {
    voiceActiveRef.current = false;
    try {
      await BlindfoldNative.stopSession();
    } catch {}
    if (nativeListenerRef.current) {
      try {
        await nativeListenerRef.current.remove();
      } catch {}
      nativeListenerRef.current = null;
    }
    setIsListening(false);
  }, []);

  useEffect(() => {
    return () => { stopVoiceSession(); };
  }, [stopVoiceSession]);

  const parseCoordinateFromVoice = useCallback((text: string): string | null => {
    const normalized = text.toLowerCase().replace(/[^a-z0-9]/g, '');
    const natoMap: Record<string, string> = {
      alpha: 'a', alfa: 'a', bravo: 'b', charlie: 'c', delta: 'd',
      echo: 'e', foxtrot: 'f', golf: 'g', hotel: 'h',
      one: '1', two: '2', three: '3', four: '4',
      five: '5', six: '6', seven: '7', eight: '8'
    };
    let processed = text.toLowerCase();
    for (const [nato, letter] of Object.entries(natoMap)) {
      processed = processed.replace(new RegExp(nato, 'g'), letter);
    }
    processed = processed.replace(/[^a-h1-8]/g, '');
    const match = processed.match(/([a-h])([1-8])/);
    if (match) return `${match[1]}${match[2]}`;
    if (normalized.length >= 2) {
      const file = normalized.match(/[a-h]/);
      const rank = normalized.match(/[1-8]/);
      if (file && rank) return `${file[0]}${rank[0]}`;
    }
    return null;
  }, []);

  useEffect(() => {
    if (!isNativePlatform || !audioInputEnabled || gameState !== 'playing') {
      if (isNativePlatform && (gameState !== 'playing' || !audioInputEnabled)) {
        stopVoiceSession();
      }
      return;
    }

    let cancelled = false;
    const setupVoice = async () => {
      try {
        await waitForVoiceReady();
        if (cancelled) return;

        nativeListenerRef.current = await BlindfoldNative.addListener('onSpeechResult', (data) => {
          if (!voiceActiveRef.current) return;
          const result = data.text?.toLowerCase().trim() || '';
          if (result) {
            const coordinate = parseCoordinateFromVoice(result);
            if (coordinate && coordinate.length === 2) {
              const file = coordinate[0];
              const rank = coordinate[1];
              handleSquareClickRef.current?.(file, rank);
            }
            if (voiceActiveRef.current) {
              BlindfoldNative.startListening().catch(() => {});
            }
          }
        });

        voiceActiveRef.current = true;
        await BlindfoldNative.startSession();
        await BlindfoldNative.startListening();
        setIsListening(true);
      } catch (error) {
        console.error('[KnightsPath] Voice setup failed:', error);
      }
    };

    setupVoice();
    return () => { cancelled = true; stopVoiceSession(); };
  }, [gameState, audioInputEnabled, stopVoiceSession, parseCoordinateFromVoice]);

  const startGame = (practiceMode: boolean = false) => {
    setIsPracticeMode(practiceMode);
    const newChallenge = generateKnightChallenge(3, 4);
    setChallenge(newChallenge);
    setCurrentPosition(newChallenge.start);
    setUserPath([newChallenge.start]);
    setPathsCompleted(0);
    setStartTime(Date.now());
    setElapsedTime(0);
    setGameState('playing');
    const fileSpoken = newChallenge.start[0] === 'a' ? 'ay' : newChallenge.start[0];
    const endFileSpoken = newChallenge.end[0] === 'a' ? 'ay' : newChallenge.end[0];
    speakMuted(`Knight on ${fileSpoken} ${newChallenge.start[1]}. Get to ${endFileSpoken} ${newChallenge.end[1]}`);
  };

  const handleSquareClick = useCallback((file: string, rank: string) => {
    if (gameState !== 'playing') return;
    const clickedSquare = `${file}${rank}`;
    
    if (!isLegalKnightMove(currentPosition, clickedSquare)) {
      Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {});
      setFlashSquare({ square: clickedSquare, correct: false });
      speakMuted("Invalid knight move");
      setTimeout(() => setFlashSquare(null), 500);
      return;
    }
    
    Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
    setFlashSquare({ square: clickedSquare, correct: true });
    setCurrentPosition(clickedSquare);
    setUserPath(prev => [...prev, clickedSquare]);
    
    if (clickedSquare === challenge.end) {
      const newCompleted = pathsCompleted + 1;
      setPathsCompleted(newCompleted);
      
      if (newCompleted >= totalPaths && !isPracticeMode) {
        const finalTime = Date.now() - startTime;
        setElapsedTime(finalTime);
        setGameState('finished');
        onComplete(finalTime, audioInputEnabled ? 'audio' : undefined);
        speakMuted("Complete!");
      } else {
        const newChallenge = generateKnightChallenge(3, 4);
        setTimeout(() => {
          setChallenge(newChallenge);
          setCurrentPosition(newChallenge.start);
          setUserPath([newChallenge.start]);
          setFlashSquare(null);
          const fileSpoken = newChallenge.start[0] === 'a' ? 'ay' : newChallenge.start[0];
          const endFileSpoken = newChallenge.end[0] === 'a' ? 'ay' : newChallenge.end[0];
          speakMuted(`Good! Knight on ${fileSpoken} ${newChallenge.start[1]}. Get to ${endFileSpoken} ${newChallenge.end[1]}`);
        }, 300);
      }
    } else {
      setTimeout(() => setFlashSquare(null), 200);
    }
  }, [gameState, currentPosition, challenge, pathsCompleted, isPracticeMode, startTime, onComplete]);

  useEffect(() => {
    handleSquareClickRef.current = handleSquareClick;
  }, [handleSquareClick]);

  if (gameState === 'ready') {
    return (
      <div className="flex flex-col h-full p-3 max-w-md mx-auto">
        <div className="flex items-center gap-2 mb-3">
          <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-knights-path-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Knight's Path</h1>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="text-center space-y-2">
            <ChevronRight className="h-12 w-12 text-green-500 mx-auto" />
            <h2 className="text-2xl font-bold">Ready?</h2>
          </div>

          <Tabs value={selectedTab} onValueChange={(v) => setSelectedTab(v as 'challenge' | 'practice')} className="w-full max-w-xs">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="challenge" data-testid="tab-knights-challenge">5 Path Race</TabsTrigger>
              <TabsTrigger value="practice" data-testid="tab-knights-practice">Practice</TabsTrigger>
            </TabsList>
          </Tabs>

          <p className="text-muted-foreground text-center">
            {selectedTab === 'challenge' 
              ? 'Complete 5 knight paths as fast as you can!'
              : 'Practice knight movement with no time pressure.'}
          </p>

          <div className="flex items-center gap-3 w-full max-w-xs">
            <Switch
              id="hide-knight"
              checked={hideKnight}
              onCheckedChange={setHideKnight}
              data-testid="switch-hide-knight"
            />
            <Label htmlFor="hide-knight" className="flex items-center gap-2">
              {hideKnight ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              Hide knight (blindfold mode)
            </Label>
          </div>

          <div className="flex items-center gap-3 w-full max-w-xs">
            <Switch
              id="audio-input"
              checked={audioInputEnabled}
              onCheckedChange={setAudioInputEnabled}
              data-testid="switch-audio-input-knights"
            />
            <Label htmlFor="audio-input" className="flex items-center gap-2">
              {audioInputEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
              Voice input (say coordinates)
            </Label>
          </div>

          {selectedTab === 'challenge' && stats && stats.knightsPathBest !== null && (
            <p className="text-sm text-muted-foreground">
              Your best: <span className="font-semibold text-green-500">{formatTime(stats.knightsPathBest)}</span>
            </p>
          )}

          <Button size="lg" onClick={() => startGame(selectedTab === 'practice')} data-testid="button-start-knights">
            Start
          </Button>
        </div>
      </div>
    );
  }

  if (gameState === 'finished') {
    return (
      <div className="flex flex-col h-full p-3 max-w-md mx-auto">
        <div className="flex items-center gap-2 mb-3">
          <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-knights-back-finished">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Knight's Path</h1>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <Trophy className={`h-16 w-16 ${isNewBest ? 'text-green-500' : 'text-muted-foreground'}`} />
          <div className="text-center space-y-2">
            <h2 className="text-4xl font-bold">{formatTime(elapsedTime)}</h2>
            <p className="text-lg text-muted-foreground">to complete 5 knight paths</p>
            {isNewBest && (
              <Badge className="bg-green-500 text-white">New Personal Best!</Badge>
            )}
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={onBack} data-testid="button-knights-menu">
              Menu
            </Button>
            <Button onClick={() => startGame(false)} data-testid="button-knights-retry">
              Play Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col h-full p-3 max-w-md mx-auto">
        <div className="flex items-center justify-between mb-2">
          <p className="text-lg font-semibold">
            Get to: <span className="text-2xl font-mono">{challenge.end}</span>
          </p>
          <div className="flex items-center gap-2">
            {isPracticeMode ? (
              <Badge variant="outline">Practice</Badge>
            ) : (
              <span className="text-lg font-mono tabular-nums">{formatTime(elapsedTime)}</span>
            )}
          </div>
        </div>

        {!isPracticeMode && <Progress value={(pathsCompleted / totalPaths) * 100} className="mb-2" />}
        <p className="text-sm text-muted-foreground text-center mb-2">
          {isPracticeMode ? `${pathsCompleted} paths completed` : `${pathsCompleted}/${totalPaths} paths`}
        </p>

        {audioInputEnabled && isListening && (
          <div className="flex items-center gap-2 text-green-500 mb-2">
            <Mic className="h-4 w-4 animate-pulse" />
            <span className="text-sm">Listening...</span>
          </div>
        )}

        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="grid grid-cols-8 gap-0 aspect-square w-full max-w-sm border border-border rounded-md overflow-hidden">
            {['8', '7', '6', '5', '4', '3', '2', '1'].map((rank) =>
              FILES.map((file) => {
                const square = `${file}${rank}`;
                const fileIdx = FILES.indexOf(file);
                const rankIdx = RANKS.indexOf(rank);
                const isDark = isDarkSquare(fileIdx, rankIdx);
                const isKnight = square === currentPosition;
                const isTarget = square === challenge.end;
                const isFlashing = flashSquare?.square === square;
                const isInPath = userPath.includes(square);
                const isStartSquare = square === challenge.start;
                
                let bgColor = isDark ? 'bg-amber-700' : 'bg-amber-100';
                if (isFlashing) {
                  bgColor = flashSquare.correct ? 'bg-green-500' : 'bg-red-500';
                } else if (isTarget) {
                  bgColor = 'bg-blue-400';
                } else if (isStartSquare) {
                  bgColor = 'bg-yellow-400';
                } else if (isInPath && !isKnight) {
                  bgColor = isDark ? 'bg-green-700' : 'bg-green-300';
                }
                
                return (
                  <button
                    key={square}
                    className={`aspect-square ${bgColor} transition-colors duration-100 flex items-center justify-center`}
                    onClick={() => handleSquareClick(file, rank)}
                    data-testid={`square-${square}`}
                  >
                    {isKnight && !hideKnight && <img src="/pieces/bN.svg" alt="Knight" className="w-4/5 h-4/5" />}
                  </button>
                );
              })
            )}
          </div>
          
          <Button
            variant="outline"
            onClick={() => setShowResignConfirm(true)}
            className="mt-4"
            data-testid="button-knights-resign"
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
              Your progress ({pathsCompleted}/{totalPaths} paths) will not be saved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-knights-resign-cancel">Continue</AlertDialogCancel>
            <AlertDialogAction onClick={onBack} data-testid="button-knights-resign-confirm">
              Quit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ============ ENDGAME DRILLS GAME ============
interface EndgameDrillsGameProps {
  onBack: () => void;
  onComplete: (time: number, variant?: string) => void;
  stats: TrainingStats | null;
  onGameStateChange?: (state: 'ready' | 'playing' | 'finished') => void;
}

type PeekDifficulty = 'easy' | 'medium' | 'hard' | 'expert' | 'master' | 'grandmaster';
const PEEK_CONFIG: Record<PeekDifficulty, { maxPeeks: number; label: string }> = {
  easy: { maxPeeks: Number.POSITIVE_INFINITY, label: 'Easy (Unlimited Peeks)' },
  medium: { maxPeeks: 20, label: 'Medium (20 Peeks)' },
  hard: { maxPeeks: 10, label: 'Hard (10 Peeks)' },
  expert: { maxPeeks: 5, label: 'Expert (5 Peeks)' },
  master: { maxPeeks: 2, label: 'Master (2 Peeks)' },
  grandmaster: { maxPeeks: 0, label: 'Grandmaster (No Peeks)' },
};

function EndgameDrillsGame({ onBack, onComplete, stats, onGameStateChange }: EndgameDrillsGameProps) {
  const [gameState, setGameState] = useState<'ready' | 'memorizing' | 'playing' | 'finished'>('ready');
  const [selectedEndgame, setSelectedEndgame] = useState<EndgameType>('KQ_vs_K');
  const [peekDifficulty, setPeekDifficulty] = useState<PeekDifficulty>('easy');
  const [remainingPeeks, setRemainingPeeks] = useState<number>(Number.POSITIVE_INFINITY);
  const [isPeeking, setIsPeeking] = useState(false);
  const [chess, setChess] = useState<Chess | null>(null);
  const [startTime, setStartTime] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [moveCount, setMoveCount] = useState(0);
  const [showResignConfirm, setShowResignConfirm] = useState(false);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [legalMoves, setLegalMoves] = useState<string[]>([]);
  const [showPieces, setShowPieces] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [audioInputEnabled, setAudioInputEnabled] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const nativeListenerRef = useRef<PluginListenerHandle | null>(null);
  const handleSquareClickRef = useRef<((file: string, rank: string) => void) | null>(null);
  const voiceActiveRef = useRef(false);
  const selectedSquareRef = useRef<string | null>(null);
  const chessRef = useRef<Chess | null>(null);
  const isNewBest = stats?.endgameDrillsBest !== null && elapsedTime > 0 && elapsedTime < (stats?.endgameDrillsBest || Infinity);

  const handlePeekStart = () => {
    if (remainingPeeks <= 0) return;
    setIsPeeking(true);
  };

  const handlePeekEnd = () => {
    if (isPeeking && remainingPeeks > 0) {
      setRemainingPeeks(prev => prev - 1);
    }
    setIsPeeking(false);
  };

  useEffect(() => {
    if (gameState === 'memorizing' || gameState === 'playing') {
      onGameStateChange?.('playing');
    } else {
      onGameStateChange?.(gameState as 'ready' | 'finished');
    }
  }, [gameState, onGameStateChange]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (gameState === 'playing') {
      interval = setInterval(() => {
        setElapsedTime(Date.now() - startTime);
      }, 100);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [gameState, startTime]);

  const stopVoiceSession = useCallback(async () => {
    voiceActiveRef.current = false;
    try {
      await BlindfoldNative.stopSession();
    } catch {}
    if (nativeListenerRef.current) {
      try {
        await nativeListenerRef.current.remove();
      } catch {}
      nativeListenerRef.current = null;
    }
    setIsListening(false);
  }, []);

  useEffect(() => {
    return () => { stopVoiceSession(); };
  }, [stopVoiceSession]);

  const parseVoiceMoveForEndgame = useCallback((text: string): { from: string; to: string } | null => {
    const normalized = text.toLowerCase();
    const natoMap: Record<string, string> = {
      alpha: 'a', alfa: 'a', bravo: 'b', charlie: 'c', delta: 'd',
      echo: 'e', foxtrot: 'f', golf: 'g', hotel: 'h',
      one: '1', two: '2', three: '3', four: '4',
      five: '5', six: '6', seven: '7', eight: '8'
    };
    let processed = normalized;
    for (const [nato, letter] of Object.entries(natoMap)) {
      processed = processed.replace(new RegExp(nato, 'g'), letter);
    }
    processed = processed.replace(/[^a-h1-8]/g, '');
    const matches = processed.match(/([a-h])([1-8])/g);
    if (matches && matches.length >= 2) {
      return { from: matches[0], to: matches[1] };
    }
    if (matches && matches.length === 1) {
      return { from: '', to: matches[0] };
    }
    return null;
  }, []);

  useEffect(() => {
    if (!isNativePlatform || !audioInputEnabled || gameState !== 'playing') {
      if (isNativePlatform && (gameState !== 'playing' || !audioInputEnabled)) {
        stopVoiceSession();
      }
      return;
    }

    let cancelled = false;
    const setupVoice = async () => {
      try {
        await waitForVoiceReady();
        if (cancelled) return;

        nativeListenerRef.current = await BlindfoldNative.addListener('onSpeechResult', (data) => {
          if (!voiceActiveRef.current) return;
          const result = data.text?.toLowerCase().trim() || '';
          if (result) {
            const parsed = parseVoiceMoveForEndgame(result);
            if (parsed && parsed.to) {
              if (parsed.from && parsed.from.length === 2) {
                handleSquareClickRef.current?.(parsed.from[0], parsed.from[1]);
                setTimeout(() => {
                  handleSquareClickRef.current?.(parsed.to[0], parsed.to[1]);
                }, 100);
              } else if (selectedSquareRef.current) {
                handleSquareClickRef.current?.(parsed.to[0], parsed.to[1]);
              } else {
                const currentChess = chessRef.current;
                if (currentChess) {
                  const whitePieces = currentChess.board().flat().filter(p => p && p.color === 'w');
                  for (const piece of whitePieces) {
                    if (!piece) continue;
                    const moves = currentChess.moves({ square: piece.square as any, verbose: true });
                    const move = moves.find(m => m.to === parsed.to);
                    if (move) {
                      handleSquareClickRef.current?.(piece.square[0], piece.square[1]);
                      setTimeout(() => {
                        handleSquareClickRef.current?.(parsed.to[0], parsed.to[1]);
                      }, 100);
                      break;
                    }
                  }
                }
              }
            }
            if (voiceActiveRef.current) {
              BlindfoldNative.startListening().catch(() => {});
            }
          }
        });

        voiceActiveRef.current = true;
        await BlindfoldNative.startSession();
        await BlindfoldNative.startListening();
        setIsListening(true);
      } catch (error) {
        console.error('[EndgameDrills] Voice setup failed:', error);
      }
    };

    setupVoice();
    return () => { cancelled = true; stopVoiceSession(); };
  }, [gameState, audioInputEnabled, stopVoiceSession, parseVoiceMoveForEndgame]);

  const setupGame = () => {
    const scenario = generateEndgame(selectedEndgame);
    const newChess = new Chess(scenario.fen);
    setChess(newChess);
    setMoveCount(0);
    setElapsedTime(0);
    setSelectedSquare(null);
    setLegalMoves([]);
    setShowPieces(true);
    setIsPeeking(false);
    setRemainingPeeks(PEEK_CONFIG[peekDifficulty].maxPeeks);
    setMoveHistory([]);
    setGameState('memorizing');
  };

  const startPlaying = () => {
    setShowPieces(false);
    setStartTime(Date.now());
    setGameState('playing');
  };

  const handleSquareClick = useCallback((file: string, rank: string) => {
    if (gameState !== 'playing' || !chess) return;
    const clickedSquare = `${file}${rank}`;
    
    if (selectedSquare) {
      const move = chess.moves({ square: selectedSquare as any, verbose: true })
        .find(m => m.to === clickedSquare);
      
      if (move) {
        chess.move(move);
        setMoveCount(prev => prev + 1);
        setMoveHistory(prev => [...prev, move.san]);
        Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
        
        if (chess.isCheckmate()) {
          const finalTime = Date.now() - startTime;
          setElapsedTime(finalTime);
          setGameState('finished');
          const variant = selectedEndgame === 'KQ_vs_K' ? 'kq_vs_k' : selectedEndgame === 'KR_vs_K' ? 'kr_vs_k' : undefined;
          onComplete(finalTime, variant);
        } else if (!chess.isGameOver()) {
          const moves = chess.moves({ verbose: true });
          if (moves.length > 0) {
            const randomMove = moves[Math.floor(Math.random() * moves.length)];
            setTimeout(() => {
              chess.move(randomMove);
              setMoveHistory(prev => [...prev, randomMove.san]);
              if (audioEnabled) {
                speak(randomMove.san).catch(() => {});
              }
              setChess(new Chess(chess.fen()));
            }, 300);
          }
        }
        
        setSelectedSquare(null);
        setLegalMoves([]);
        setChess(new Chess(chess.fen()));
      } else {
        const piece = chess.get(clickedSquare as any);
        if (piece && piece.color === 'w') {
          setSelectedSquare(clickedSquare);
          const moves = chess.moves({ square: clickedSquare as any, verbose: true });
          setLegalMoves(moves.map(m => m.to));
        } else {
          setSelectedSquare(null);
          setLegalMoves([]);
        }
      }
    } else {
      const piece = chess.get(clickedSquare as any);
      if (piece && piece.color === 'w') {
        setSelectedSquare(clickedSquare);
        const moves = chess.moves({ square: clickedSquare as any, verbose: true });
        setLegalMoves(moves.map(m => m.to));
      }
    }
  }, [gameState, chess, selectedSquare, startTime, onComplete, audioEnabled]);

  useEffect(() => {
    handleSquareClickRef.current = handleSquareClick;
  }, [handleSquareClick]);

  useEffect(() => {
    selectedSquareRef.current = selectedSquare;
  }, [selectedSquare]);

  useEffect(() => {
    chessRef.current = chess;
  }, [chess]);

  const renderPiece = (piece: { type: string; color: string } | null) => {
    if (!piece) return null;
    const pieceMap: Record<string, string> = {
      k: 'K', q: 'Q', r: 'R', b: 'B', n: 'N', p: 'P'
    };
    const fileName = `${piece.color}${pieceMap[piece.type]}`;
    return <img src={`/pieces/${fileName}.svg`} alt={fileName} className="w-4/5 h-4/5" />;
  };

  if (gameState === 'ready') {
    return (
      <div className="flex flex-col h-full p-3 max-w-md mx-auto">
        <div className="flex items-center gap-2 mb-3">
          <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-endgame-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Endgame Drills</h1>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="text-center space-y-2">
            <Crown className="h-12 w-12 text-orange-500 mx-auto" />
            <h2 className="text-2xl font-bold">Select Endgame</h2>
          </div>

          <Select value={selectedEndgame} onValueChange={(v) => setSelectedEndgame(v as EndgameType)}>
            <SelectTrigger className="w-full max-w-xs" data-testid="select-endgame-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {getEndgameTypes().map(type => (
                <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={peekDifficulty} onValueChange={(v) => setPeekDifficulty(v as PeekDifficulty)}>
            <SelectTrigger className="w-full max-w-xs" data-testid="select-peek-difficulty">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(PEEK_CONFIG) as PeekDifficulty[]).map(key => (
                <SelectItem key={key} value={key}>{PEEK_CONFIG[key].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-3 w-full max-w-xs">
            <Switch
              id="audio-enabled"
              checked={audioEnabled}
              onCheckedChange={setAudioEnabled}
              data-testid="switch-audio-enabled"
            />
            <Label htmlFor="audio-enabled" className="flex items-center gap-2">
              {audioEnabled ? <Volume2 className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
              Announce opponent moves
            </Label>
          </div>

          <div className="flex items-center gap-3 w-full max-w-xs">
            <Switch
              id="audio-input-endgame"
              checked={audioInputEnabled}
              onCheckedChange={setAudioInputEnabled}
              data-testid="switch-audio-input-endgame"
            />
            <Label htmlFor="audio-input-endgame" className="flex items-center gap-2">
              {audioInputEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
              Voice input (say moves)
            </Label>
          </div>

          <p className="text-muted-foreground text-center">
            Checkmate the lone king as fast as possible!
          </p>

          {stats && stats.endgameDrillsBest !== null && (
            <p className="text-sm text-muted-foreground">
              Your best: <span className="font-semibold text-orange-500">{formatTime(stats.endgameDrillsBest)}</span>
            </p>
          )}

          <Button size="lg" onClick={setupGame} data-testid="button-start-endgame">
            Start
          </Button>
        </div>
      </div>
    );
  }

  if (gameState === 'memorizing') {
    return (
      <div className="flex flex-col h-full p-3 max-w-md mx-auto">
        <div className="flex items-center gap-2 mb-3">
          <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-endgame-back-memorizing">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Memorize the Position</h1>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="grid grid-cols-8 gap-0 aspect-square w-full max-w-sm border border-border rounded-md overflow-hidden">
            {['8', '7', '6', '5', '4', '3', '2', '1'].map((rank) =>
              FILES.map((file) => {
                const square = `${file}${rank}`;
                const fileIdx = FILES.indexOf(file);
                const rankIdx = RANKS.indexOf(rank);
                const isDark = isDarkSquare(fileIdx, rankIdx);
                const piece = chess?.get(square as any);
                
                const bgColor = isDark ? 'bg-amber-700' : 'bg-amber-100';
                
                return (
                  <div
                    key={square}
                    className={`aspect-square ${bgColor} flex items-center justify-center`}
                    data-testid={`square-${square}`}
                  >
                    {renderPiece(piece || null)}
                  </div>
                );
              })
            )}
          </div>
          
          <p className="text-muted-foreground text-center mt-4 mb-2">
            Study the position, then tap Start to play blindfolded
          </p>
          
          <Button size="lg" onClick={startPlaying} className="mt-2" data-testid="button-start-playing">
            Start Playing
          </Button>
        </div>
      </div>
    );
  }

  if (gameState === 'finished') {
    return (
      <div className="flex flex-col h-full p-3 max-w-md mx-auto">
        <div className="flex items-center gap-2 mb-3">
          <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-endgame-back-finished">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Endgame Drills</h1>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <Trophy className={`h-16 w-16 ${isNewBest ? 'text-orange-500' : 'text-muted-foreground'}`} />
          <div className="text-center space-y-2">
            <h2 className="text-4xl font-bold">{formatTime(elapsedTime)}</h2>
            <p className="text-lg text-muted-foreground">Checkmate in {moveCount} moves</p>
            {isNewBest && (
              <Badge className="bg-orange-500 text-white">New Personal Best!</Badge>
            )}
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={onBack} data-testid="button-endgame-menu">
              Menu
            </Button>
            <Button onClick={setupGame} data-testid="button-endgame-retry">
              Play Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col h-full p-3 max-w-md mx-auto">
        <div className="flex items-center justify-between mb-2">
          <p className="text-lg font-semibold">
            Moves: <span className="text-2xl font-mono">{moveCount}</span>
          </p>
          <span className="text-lg font-mono tabular-nums">{formatTime(elapsedTime)}</span>
        </div>

        <p className="text-sm text-muted-foreground text-center mb-2">
          {isPeeking ? 'Peeking at the board...' : 'Playing blindfolded - pieces are hidden'}
        </p>

        {moveHistory.length > 0 && (
          <div className="mb-2 p-2 bg-muted/50 rounded-md w-full max-w-sm mx-auto">
            <p className="text-xs text-muted-foreground mb-1">Move history:</p>
            <div className="text-sm font-mono flex flex-wrap gap-1">
              {moveHistory.map((move, i) => (
                <span key={i} className={i % 2 === 0 ? 'text-foreground' : 'text-muted-foreground'}>
                  {i % 2 === 0 ? `${Math.floor(i/2) + 1}. ` : ''}{move}
                </span>
              ))}
            </div>
          </div>
        )}

        {audioInputEnabled && isListening && (
          <div className="flex items-center gap-2 text-green-500 mb-2">
            <Mic className="h-4 w-4 animate-pulse" />
            <span className="text-sm">Listening...</span>
          </div>
        )}

        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="grid grid-cols-8 gap-0 aspect-square w-full max-w-sm border border-border rounded-md overflow-hidden">
            {['8', '7', '6', '5', '4', '3', '2', '1'].map((rank) =>
              FILES.map((file) => {
                const square = `${file}${rank}`;
                const fileIdx = FILES.indexOf(file);
                const rankIdx = RANKS.indexOf(rank);
                const isDark = isDarkSquare(fileIdx, rankIdx);
                const piece = chess?.get(square as any);
                const isSelected = square === selectedSquare;
                const isLegalMove = legalMoves.includes(square);
                
                let bgColor = isDark ? 'bg-amber-700' : 'bg-amber-100';
                if (isSelected) {
                  bgColor = 'bg-yellow-400';
                } else if (isLegalMove) {
                  bgColor = isDark ? 'bg-green-600' : 'bg-green-300';
                }
                
                return (
                  <button
                    key={square}
                    className={`aspect-square ${bgColor} transition-colors duration-100 flex items-center justify-center`}
                    onClick={() => handleSquareClick(file, rank)}
                    data-testid={`square-${square}`}
                  >
                    {(showPieces || isPeeking) ? renderPiece(piece || null) : null}
                  </button>
                );
              })
            )}
          </div>
          
          {peekDifficulty !== 'grandmaster' && (
            <div className="mt-4 space-y-2 w-full max-w-xs">
              <Button
                variant={isPeeking ? "default" : "outline"}
                className={`w-full ${isPeeking ? "bg-amber-400 hover:bg-amber-500 text-black" : ""}`}
                onMouseDown={handlePeekStart}
                onMouseUp={handlePeekEnd}
                onMouseLeave={handlePeekEnd}
                onTouchStart={handlePeekStart}
                onTouchEnd={handlePeekEnd}
                onTouchCancel={handlePeekEnd}
                disabled={remainingPeeks <= 0}
                data-testid="button-endgame-peek"
              >
                <Eye className="h-4 w-4 mr-2" />
                {isPeeking ? "Peeking..." : "Hold to Peek"}
              </Button>
              <p className="text-center text-sm text-muted-foreground" data-testid="text-peeks-remaining">
                {isFinite(remainingPeeks) ? `${remainingPeeks} peeks left` : "Unlimited peeks"}
              </p>
            </div>
          )}

          <Button
            variant="outline"
            onClick={() => setShowResignConfirm(true)}
            className="mt-4"
            data-testid="button-endgame-resign"
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
              Your progress will not be saved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-endgame-resign-cancel">Continue</AlertDialogCancel>
            <AlertDialogAction onClick={onBack} data-testid="button-endgame-resign-confirm">
              Quit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ============ BLINDFOLD MARATHON GAME ============
interface BlindfoldsMarathonGameProps {
  onBack: () => void;
  onComplete: (time: number, streak: number, variant?: string) => void;
  stats: TrainingStats | null;
  onGameStateChange?: (state: 'ready' | 'playing' | 'finished') => void;
}

function BlindfoldsMarathonGame({ onBack, onComplete, stats, onGameStateChange }: BlindfoldsMarathonGameProps) {
  const [gameState, setGameState] = useState<'ready' | 'playing' | 'finished'>('ready');
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyTier>('10-20');
  const [scenario, setScenario] = useState<MarathonScenario | null>(null);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(0);
  const [isReviewingMoves, setIsReviewingMoves] = useState(true);
  const [waitingForAnswer, setWaitingForAnswer] = useState(false);
  const [startTime, setStartTime] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [showResignConfirm, setShowResignConfirm] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [streak, setStreak] = useState(0);
  const nativeListenerRef = useRef<{ remove: () => Promise<void> } | null>(null);
  const isNewBest = stats?.blindfoldMarathonBest !== null && elapsedTime > 0 && elapsedTime < (stats?.blindfoldMarathonBest || Infinity);

  useEffect(() => {
    onGameStateChange?.(gameState);
  }, [gameState, onGameStateChange]);

  // Stop native voice session
  const stopVoiceSession = useCallback(async () => {
    try {
      await BlindfoldNative.stopSession();
    } catch {}
    if (nativeListenerRef.current) {
      try {
        await nativeListenerRef.current.remove();
      } catch {}
      nativeListenerRef.current = null;
    }
    setIsListening(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => { stopVoiceSession(); };
  }, [stopVoiceSession]);

  // Start/stop voice recognition when waiting for answer on native platform
  useEffect(() => {
    if (!isNativePlatform || !waitingForAnswer) {
      if (isNativePlatform && !waitingForAnswer) {
        stopVoiceSession();
      }
      return;
    }

    let cancelled = false;
    const setupVoice = async () => {
      try {
        await waitForVoiceReady();
        if (cancelled) return;

        nativeListenerRef.current = await BlindfoldNative.addListener('onSpeechResult', (data) => {
          const result = data.text?.toLowerCase().trim() || '';
          if (result) {
            setUserAnswer(result);
            BlindfoldNative.startListening().catch(() => {});
          }
        });

        await BlindfoldNative.startSession();
        await BlindfoldNative.startListening();
        setIsListening(true);
      } catch (error) {
        console.error('[Marathon] Voice setup failed:', error);
      }
    };

    setupVoice();
    return () => { cancelled = true; stopVoiceSession(); };
  }, [waitingForAnswer, stopVoiceSession]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (gameState === 'playing' && waitingForAnswer) {
      interval = setInterval(() => {
        setElapsedTime(Date.now() - startTime);
      }, 100);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [gameState, startTime, waitingForAnswer]);

  const startGame = () => {
    const tier = getDifficultyTiers().find(t => t.value === selectedDifficulty)!;
    const newScenario = getRandomMarathon(tier.minMoves, tier.maxMoves);
    setScenario(newScenario);
    setCurrentMoveIndex(0);
    setIsReviewingMoves(true);
    setWaitingForAnswer(false);
    setUserAnswer('');
    setIsCorrect(null);
    setGameState('playing');
  };

  const goToPreviousMove = () => {
    if (currentMoveIndex > 0) {
      setCurrentMoveIndex(prev => prev - 1);
    }
  };

  const goToNextMove = () => {
    if (!scenario) return;
    if (currentMoveIndex < scenario.pgnMoves.length - 1) {
      setCurrentMoveIndex(prev => prev + 1);
    } else {
      setIsReviewingMoves(false);
      setWaitingForAnswer(true);
      setStartTime(Date.now());
    }
  };

  const getDifficultyVariant = (difficulty: DifficultyTier): string => {
    if (difficulty === '10-20') return 'easy';
    if (difficulty === '20-30') return 'medium';
    return 'hard';
  };

  const checkAnswer = () => {
    if (!scenario) return;
    
    const normalizedAnswer = userAnswer.toLowerCase().replace(/[^a-z0-9]/g, '');
    const normalizedSolution = scenario.solution.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    const correct = normalizedAnswer.includes(normalizedSolution) || 
                    normalizedSolution.includes(normalizedAnswer);
    
    setIsCorrect(correct);
    
    if (correct) {
      const newStreak = streak + 1;
      setStreak(newStreak);
      const finalTime = Date.now() - startTime;
      setElapsedTime(finalTime);
      setGameState('finished');
      const variant = getDifficultyVariant(selectedDifficulty);
      onComplete(finalTime, newStreak, variant);
    } else {
      setStreak(0);
      setTimeout(() => {
        setGameState('finished');
        setElapsedTime(0);
      }, 1000);
    }
  };

  const handleResign = () => {
    onBack();
  };

  if (gameState === 'ready') {
    return (
      <div className="flex flex-col h-full p-3 max-w-md mx-auto">
        <div className="flex items-center gap-2 mb-3">
          <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-marathon-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Blindfold Marathon</h1>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="text-center space-y-2">
            <Brain className="h-12 w-12 text-red-500 mx-auto" />
            <h2 className="text-2xl font-bold">Select Difficulty</h2>
          </div>

          <Select value={selectedDifficulty} onValueChange={(v) => setSelectedDifficulty(v as DifficultyTier)}>
            <SelectTrigger className="w-full max-w-xs" data-testid="select-marathon-difficulty">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {getDifficultyTiers().map(tier => (
                <SelectItem key={tier.value} value={tier.value}>{tier.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <p className="text-muted-foreground text-center text-sm">
            Step through moves at your own pace, then find the winning move!
          </p>

          {stats && stats.blindfoldMarathonBest !== null && (
            <p className="text-sm text-muted-foreground">
              Your best: <span className="font-semibold text-red-500">{formatTime(stats.blindfoldMarathonBest)}</span>
            </p>
          )}

          <Button size="lg" onClick={startGame} data-testid="button-start-marathon">
            Start
          </Button>
        </div>
      </div>
    );
  }

  if (gameState === 'finished') {
    return (
      <div className="flex flex-col h-full p-3 max-w-md mx-auto">
        <div className="flex items-center gap-2 mb-3">
          <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-marathon-back-finished">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Blindfold Marathon</h1>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <Trophy className={`h-16 w-16 ${isCorrect && isNewBest ? 'text-red-500' : isCorrect ? 'text-green-500' : 'text-muted-foreground'}`} />
          <div className="text-center space-y-2">
            {isCorrect ? (
              <>
                <h2 className="text-4xl font-bold">{formatTime(elapsedTime)}</h2>
                <p className="text-lg text-muted-foreground">to find the winning move</p>
                {isNewBest && (
                  <Badge className="bg-red-500 text-white">New Personal Best!</Badge>
                )}
              </>
            ) : (
              <>
                <h2 className="text-2xl font-bold text-red-500">Incorrect</h2>
                <p className="text-lg text-muted-foreground">
                  The answer was: <span className="font-mono font-bold">{scenario?.solution}</span>
                </p>
              </>
            )}
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={onBack} data-testid="button-marathon-menu">
              Menu
            </Button>
            <Button onClick={startGame} data-testid="button-marathon-retry">
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col h-full p-3 max-w-md mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold">{scenario?.description}</h1>
          {waitingForAnswer && (
            <span className="text-lg font-mono tabular-nums">{formatTime(elapsedTime)}</span>
          )}
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-6">
          {isReviewingMoves ? (
            <div className="text-center space-y-4 w-full max-w-xs">
              <p className="text-sm text-muted-foreground">
                {scenario?.white} vs {scenario?.black}
              </p>
              <div className="text-5xl font-mono font-bold min-h-[4rem] flex items-center justify-center">
                {currentMoveIndex % 2 === 0 ? `${Math.floor(currentMoveIndex / 2) + 1}. ` : ''}{scenario?.pgnMoves[currentMoveIndex]}
              </div>
              <p className="text-muted-foreground">
                Move {currentMoveIndex + 1} of {scenario?.pgnMoves.length || 0}
              </p>
              <Progress value={((currentMoveIndex + 1) / (scenario?.pgnMoves.length || 1)) * 100} className="w-full" />
              
              <div className="flex gap-4 justify-center mt-4">
                <Button 
                  size="lg" 
                  variant="outline"
                  onClick={goToPreviousMove} 
                  disabled={currentMoveIndex === 0}
                  data-testid="button-marathon-back-move"
                >
                  <ArrowLeft className="h-5 w-5 mr-1" />
                  Back
                </Button>
                <Button 
                  size="lg"
                  onClick={goToNextMove}
                  data-testid="button-marathon-next-move"
                >
                  {currentMoveIndex === (scenario?.pgnMoves.length || 0) - 1 ? 'Done' : 'Next'}
                  {currentMoveIndex !== (scenario?.pgnMoves.length || 0) - 1 && <ChevronRight className="h-5 w-5 ml-1" />}
                </Button>
              </div>
            </div>
          ) : waitingForAnswer ? (
            <div className="text-center space-y-4 w-full max-w-xs">
              <h2 className="text-2xl font-bold">Find the Best Move!</h2>
              <p className="text-muted-foreground">{scenario?.white} to move</p>
              
              {isListening && (
                <div className="flex items-center justify-center gap-2 text-red-500">
                  <Mic className="h-5 w-5 animate-pulse" />
                  <span className="text-sm">Listening...</span>
                </div>
              )}
              
              <input
                type="text"
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                placeholder={isListening ? "Speak or type your move" : "Enter your move (e.g., Qb8+)"}
                className="w-full px-4 py-2 border rounded-md text-center text-lg font-mono text-black bg-white"
                autoFocus
                data-testid="input-marathon-answer"
              />
              <Button size="lg" onClick={checkAnswer} disabled={!userAnswer.trim()} data-testid="button-marathon-submit">
                Submit Answer
              </Button>
            </div>
          ) : null}
          
          <Button
            variant="outline"
            onClick={() => setShowResignConfirm(true)}
            className="mt-4"
            data-testid="button-marathon-resign"
          >
            <Flag className="h-4 w-4 mr-2" />
            Quit
          </Button>
        </div>
      </div>

      <AlertDialog open={showResignConfirm} onOpenChange={setShowResignConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Quit Game?</AlertDialogTitle>
            <AlertDialogDescription>
              Your progress will not be saved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-marathon-resign-cancel">Continue</AlertDialogCancel>
            <AlertDialogAction onClick={handleResign} data-testid="button-marathon-resign-confirm">
              Quit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
