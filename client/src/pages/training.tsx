import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Zap, Target, Trophy, Mic, MicOff } from "lucide-react";
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { saveTrainingSession, getTrainingStats, type TrainingStats } from "@/lib/trainingStats";
import { speak } from "@/lib/voice";

type TrainingMode = 'menu' | 'color_blitz' | 'coordinate_sniper';

interface TrainingPageProps {
  onBack: () => void;
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

export default function TrainingPage({ onBack }: TrainingPageProps) {
  const [mode, setMode] = useState<TrainingMode>('menu');
  const [stats, setStats] = useState<TrainingStats | null>(null);

  useEffect(() => {
    getTrainingStats().then(setStats);
  }, [mode]);

  const handleGameComplete = async (gameMode: 'color_blitz' | 'coordinate_sniper', score: number, streak: number) => {
    await saveTrainingSession(gameMode, score, streak);
    setStats(await getTrainingStats());
    window.dispatchEvent(new CustomEvent('trainingStatsUpdated'));
  };

  if (mode === 'color_blitz') {
    return <ColorBlitzGame onBack={() => setMode('menu')} onComplete={(score, streak) => handleGameComplete('color_blitz', score, streak)} stats={stats} />;
  }

  if (mode === 'coordinate_sniper') {
    return <CoordinateSniperGame onBack={() => setMode('menu')} onComplete={(score, streak) => handleGameComplete('coordinate_sniper', score, streak)} stats={stats} />;
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

      {stats && stats.totalSessions > 0 && (
        <div className="mt-6 p-3 rounded-lg bg-muted/50 text-center">
          <p className="text-sm text-muted-foreground">
            Total training sessions: <span className="font-semibold text-foreground">{stats.totalSessions}</span>
          </p>
        </div>
      )}
    </div>
  );
}

interface ColorBlitzGameProps {
  onBack: () => void;
  onComplete: (score: number, streak: number) => void;
  stats: TrainingStats | null;
}

function ColorBlitzGame({ onBack, onComplete, stats }: ColorBlitzGameProps) {
  const [gameState, setGameState] = useState<'ready' | 'playing' | 'finished'>('ready');
  const [currentSquare, setCurrentSquare] = useState(() => getRandomSquare());
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [voiceMode, setVoiceMode] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isNewBest = stats !== null && stats.colorBlitzBest !== null && score > stats.colorBlitzBest;

  const startGame = () => {
    setGameState('playing');
    setScore(0);
    setStreak(0);
    setBestStreak(0);
    setTimeLeft(60);
    setCurrentSquare(getRandomSquare());
  };

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

  const handleAnswer = useCallback((answer: 'light' | 'dark') => {
    if (gameState !== 'playing') return;
    
    const isCorrect = (answer === 'dark') === isDarkSquare(currentSquare.fileIndex, currentSquare.rankIndex);
    
    if (isCorrect) {
      setScore(prev => prev + 1);
      setStreak(prev => {
        const newStreak = prev + 1;
        setBestStreak(best => Math.max(best, newStreak));
        if (newStreak === 10) {
          Haptics.notification({ type: NotificationType.Success }).catch(() => {});
        } else {
          Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
        }
        return newStreak;
      });
      setCurrentSquare(getRandomSquare());
    } else {
      setStreak(0);
      Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {});
      Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {});
    }
  }, [gameState, currentSquare]);

  if (gameState === 'ready') {
    return (
      <div className="flex flex-col h-full p-4 max-w-md mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-colorblitz-back">
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
          <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-colorblitz-back-finished">
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
            <Button variant="outline" onClick={onBack} data-testid="button-colorblitz-menu">
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
    <div className="flex flex-col h-full p-4 max-w-md mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold tabular-nums">{timeLeft}s</span>
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
      </div>
    </div>
  );
}

interface CoordinateSniperGameProps {
  onBack: () => void;
  onComplete: (score: number, streak: number) => void;
  stats: TrainingStats | null;
}

function CoordinateSniperGame({ onBack, onComplete, stats }: CoordinateSniperGameProps) {
  const [gameState, setGameState] = useState<'ready' | 'playing' | 'finished'>('ready');
  const [currentSquare, setCurrentSquare] = useState(() => getRandomSquare());
  const [foundCount, setFoundCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [startTime, setStartTime] = useState<number>(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [flashSquare, setFlashSquare] = useState<{ square: string; correct: boolean } | null>(null);
  const [correctSquareFlash, setCorrectSquareFlash] = useState<string | null>(null);
  const totalSquares = 10;
  const isNewBest = stats !== null && stats.coordinateSniperBest !== null && elapsedTime < stats.coordinateSniperBest && elapsedTime > 0;

  const startGame = () => {
    setGameState('playing');
    setFoundCount(0);
    setStreak(0);
    setBestStreak(0);
    setStartTime(Date.now());
    setElapsedTime(0);
    const sq = getRandomSquare();
    setCurrentSquare(sq);
    speak(`Find ${sq.file} ${sq.rank}`);
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
        speak("Complete!");
      } else {
        setTimeout(() => {
          setFlashSquare(null);
          const newSquare = getRandomSquare();
          setCurrentSquare(newSquare);
          speak(`Find ${newSquare.file} ${newSquare.rank}`);
        }, 200);
      }
    } else {
      Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {});
      Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {});
      setFlashSquare({ square: clickedSquare, correct: false });
      setCorrectSquareFlash(targetSquare);
      setStreak(0);
      speak(`No, that's ${clickedFile} ${clickedRank}`);
      
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
    <div className="flex flex-col h-full p-4 max-w-md mx-auto">
      <div className="flex items-center justify-between mb-4">
        <p className="text-lg font-semibold">
          Find: <span className="text-2xl font-mono">{currentSquare.file}{currentSquare.rank}</span>
        </p>
        <span className="text-lg font-mono tabular-nums">{formatTime(elapsedTime)}</span>
      </div>

      <Progress value={(foundCount / totalSquares) * 100} className="mb-4" />
      <p className="text-sm text-muted-foreground text-center mb-4">{foundCount}/{totalSquares} found</p>

      <div className="flex-1 flex items-center justify-center">
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
      </div>
    </div>
  );
}
