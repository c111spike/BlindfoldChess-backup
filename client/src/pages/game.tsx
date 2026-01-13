import { useState, useEffect, useRef, useCallback } from "react";
import { Chess } from "chess.js";
import { ChessBoard } from "@/components/chess-board";
import { PromotionDialog } from "@/components/promotion-dialog";
import { Card, CardContent } from "@/components/ui/card";
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Clock, Play, Eye, Bot, ChevronLeft, ArrowLeft, Shuffle, Crown, Trophy, RotateCcw, Mic, MicOff, Volume2, VolumeX, Infinity as InfinityIcon, Flag, Home, BarChart3, RefreshCw, Dumbbell } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import titleImage from "@assets/title_cropped.webp";
import { BoardReconstruction } from "@/components/board-reconstruction";
import { PostMortemReport } from "@/components/post-mortem-report";
import { AnalysisView } from "@/components/analysis-view";
import { KeepAwake } from '@capacitor-community/keep-awake';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';
import { voiceRecognition, speak, moveToSpeech, speechToMoveWithAmbiguity, parseDisambiguation, findMoveByDisambiguation, getSourceSquaresFromCandidates, VoiceRegistry, type AmbiguousMoveResult } from "@/lib/voice";
import BlindfoldNative, { waitForVoiceReady } from "@/lib/nativeVoice";
import { getBotMove, countBotPieces, detectRecapture, getBotMoveDelay as botMoveDelay, getHumanBotThinkingDelay, countAllPieces, type LastMoveInfo, type BotMoveResult } from "@/lib/botEngine";
import { loadStats, loadSettings, saveSettings, recordGameResult, getAveragePeekTime, formatPeekTime, resetStats, type GameStats, type BlindfoldSettings } from "@/lib/gameStats";
import { initGameHistoryDB, saveGame, type SavedGame } from "@/lib/gameHistory";
import { GameHistory } from "@/pages/game-history";
import { HistoryGameReport } from "@/components/history-game-report";
import { clientStockfish } from "@/lib/stockfish";
import type { BotProfile } from "@shared/botTypes";
import { 
  ALL_ELOS,
  BOTS,
  BOT_DIFFICULTY_ELO,
  getBotByElo 
} from "@shared/botTypes";

const PIECE_VALUES: Record<string, number> = {
  p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000
};

function extractLastMoveInfo(move: { from: string; to: string; captured?: string } | null): LastMoveInfo | undefined {
  if (!move) return undefined;
  return {
    from: move.from,
    to: move.to,
    captured: move.captured,
    capturedValue: move.captured ? PIECE_VALUES[move.captured] : undefined
  };
}

function getBotMoveDelay(
  moveNumber: number, 
  remainingTimeSeconds: number,
  fen: string,
  botColor: 'white' | 'black',
  lastMove: LastMoveInfo | undefined
): number {
  if (detectRecapture(lastMove, fen)) {
    return 1000;
  }
  
  if (remainingTimeSeconds < 60) {
    return 1000;
  }
  
  const pieceCount = countBotPieces(fen, botColor);
  
  if (pieceCount === 1) {
    return 1000;
  } else if (pieceCount >= 2 && pieceCount <= 5) {
    return 2000 + Math.random() * 1000;
  } else if (pieceCount >= 6 && pieceCount <= 11) {
    return 3000 + Math.random() * 1000;
  }
  
  if (moveNumber <= 5) {
    return 1000;
  } else if (moveNumber <= 11) {
    return 2000 + Math.random() * 1000;
  }
  
  return 3000 + Math.random() * 3000;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const BLINDFOLD_CONFIG = {
  easy: { maxPeeks: Number.POSITIVE_INFINITY },
  medium: { maxPeeks: 20 },
  hard: { maxPeeks: 10 },
  expert: { maxPeeks: 5 },
  master: { maxPeeks: 2 },
  grandmaster: { maxPeeks: 0 },
};

type BlindFoldDifficulty = keyof typeof BLINDFOLD_CONFIG;
type TimeControlOption = "practice" | "blitz" | "rapid" | "classical";
type BlindFoldDisplayMode = "empty_board" | "black_overlay" | "no_board";

export type GameViewState = 'idle' | 'setup' | 'in_game' | 'reconstruction' | 'analysis';

interface GamePageProps {
  historyTrigger?: number;
  onStateChange?: (state: GameViewState) => void;
  returnToTitleRef?: React.MutableRefObject<(() => void) | null>;
  onTrainNowClick?: () => void;
}

export default function GamePage({ historyTrigger, onStateChange, returnToTitleRef, onTrainNowClick }: GamePageProps) {
  const { toast } = useToast();
  
  const [showTitleScreen, setShowTitleScreen] = useState(true);
  const [game, setGame] = useState<Chess | null>(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [fen, setFen] = useState("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  const [moves, setMoves] = useState<string[]>([]);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [legalMoves, setLegalMoves] = useState<string[]>([]);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [playerColor, setPlayerColor] = useState<"white" | "black">("white");
  const [gameResult, setGameResult] = useState<"white_win" | "black_win" | "draw" | null>(null);
  
  const [whiteTime, setWhiteTime] = useState(300);
  const [blackTime, setBlackTime] = useState(300);
  const [timeControl, setTimeControl] = useState<TimeControlOption>(() => {
    const saved = localStorage.getItem('blindfold-settings-time');
    return (saved as TimeControlOption) || "blitz";
  });
  
  const [isBlindfold, setIsBlindfold] = useState(false);
  const [blindfoldDifficulty, setBlindFoldDifficulty] = useState<BlindFoldDifficulty>("medium");
  const [blindfoldDisplayMode, setBlindFoldDisplayMode] = useState<BlindFoldDisplayMode>("empty_board");
  const [showCoordinates, setShowCoordinates] = useState(true);
  const [remainingPeeks, setRemainingPeeks] = useState<number>(Number.POSITIVE_INFINITY);
  const [isPeeking, setIsPeeking] = useState(false);
  const peekStartTimeRef = useRef<number | null>(null);
  const gamePeekTimeRef = useRef<number>(0);
  
  // Peek-free streak tracking
  const [peekFreeStreak, setPeekFreeStreak] = useState(0);
  const [bestPeekFreeStreak, setBestPeekFreeStreak] = useState(0);
  const peekedSinceLastMoveRef = useRef(false);
  
  // Response time tracking
  const botMoveTimestampRef = useRef<number | null>(null);
  const responseTimesRef = useRef<number[]>([]);
  
  // Book moves tracking (how many moves were from opening book)
  const bookMovesRef = useRef<number>(0);
  
  // Voice command tracking
  const voiceCorrectionsRef = useRef<number>(0);
  const voiceCommandsRef = useRef<number>(0);
  
  // Reconstruction input tracking
  const reconstructionVoiceInputsRef = useRef<number>(0);
  const reconstructionTouchInputsRef = useRef<number>(0);
  
  // In-game voice vs touch move tracking
  const gameVoiceMovesRef = useRef<number>(0);
  const gameTouchMovesRef = useRef<number>(0);
  
  // Square inquiry tracking (for confusion heatmap)
  const squareInquiriesRef = useRef<string[]>([]);
  
  // Assisted game tracking (used eval or voice peek)
  const wasAssistedRef = useRef<boolean>(false);
  
  // Voice peek auto-hide timeout
  const voicePeekTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Capture bot elo at game start (avoid mid-game changes affecting stats)
  const gameBotEloRef = useRef<number>(1200);
  
  // Board reconstruction settings
  const [blindfoldSettings, setBlindFoldSettings] = useState<BlindfoldSettings>(() => loadSettings());
  
  const [stats, setStats] = useState<GameStats>(() => loadStats());
  
  useEffect(() => {
    initGameHistoryDB();
  }, []);
  
  // Listen for settings changes from Settings dialog
  useEffect(() => {
    const handleSettingsChanged = (event: Event) => {
      const customEvent = event as CustomEvent<BlindfoldSettings>;
      if (customEvent.detail) {
        setBlindFoldSettings(customEvent.detail);
      }
    };
    window.addEventListener('blindfoldSettingsChanged', handleSettingsChanged);
    return () => {
      window.removeEventListener('blindfoldSettingsChanged', handleSettingsChanged);
    };
  }, []);
  
  const [selectedBot, setSelectedBot] = useState<BotProfile | null>(null);
  const [botThinking, setBotThinking] = useState(false);
  const [extendedThinking, setExtendedThinking] = useState(false);
  const [selectedBotElo, setSelectedBotElo] = useState<number>(() => {
    const saved = localStorage.getItem('blindfold-settings-elo');
    return saved ? Number(saved) : 1200;
  });
  const [selectedColor, setSelectedColor] = useState<"white" | "black" | "random">(() => {
    const saved = localStorage.getItem('blindfold-settings-color');
    return (saved as "white" | "black" | "random") || "white";
  });
  
  // Settings transition animation
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  const [voiceInputEnabled, setVoiceInputEnabled] = useState(false);
  const [voiceOutputEnabled, setVoiceOutputEnabled] = useState(false);
  const [isVoiceListening, setIsVoiceListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState<string | null>(null);
  const [awaitingDisambiguation, setAwaitingDisambiguation] = useState<{
    candidates: string[];
    piece: string;
    targetSquare: string;
  } | null>(null);
  const disambiguationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [voiceRestartTrigger, setVoiceRestartTrigger] = useState(0);
  const lastSpokenMove = useRef<string>("");
  
  const [pendingPromotion, setPendingPromotion] = useState<{ from: string; to: string } | null>(null);
  const [showResignConfirm, setShowResignConfirm] = useState(false);
  
  // Board reconstruction state
  const [showReconstruction, setShowReconstruction] = useState(false);
  const [reconstructionFen, setReconstructionFen] = useState<string | null>(null);
  const pendingGameResultRef = useRef<{ result: "white_win" | "black_win" | "draw"; fen: string } | null>(null);
  
  // Countdown state for reconstruction transition
  const [reconstructionCountdown, setReconstructionCountdown] = useState<number | null>(null);
  const countdownTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Post-mortem report state
  const [showPostMortem, setShowPostMortem] = useState(false);
  const [lastGameResponseTimes, setLastGameResponseTimes] = useState<number[]>([]);
  const [lastGameSquareInquiries, setLastGameSquareInquiries] = useState<string[]>([]);
  const [lastReconstructionScore, setLastReconstructionScore] = useState<number | null>(null);
  const [lastReconstructionVoicePurity, setLastReconstructionVoicePurity] = useState<number | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [lastGameMoveHistory, setLastGameMoveHistory] = useState<string[]>([]);
  const [showGameHistory, setShowGameHistory] = useState(false);
  const [viewingHistoryGame, setViewingHistoryGame] = useState<SavedGame | null>(null);
  
  const gameRef = useRef<Chess | null>(null);
  const whiteTimeRef = useRef(300);
  const blackTimeRef = useRef(300);
  const movesRef = useRef<string[]>([]);
  const clockIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isTtsSpeaking = useRef(false);
  
  // Native Android voice loop state
  const isNativeVoiceActive = useRef(false);
  const nativeListenerRef = useRef<{ remove: () => Promise<void> } | null>(null);
  const [nativeFallbackToWeb, setNativeFallbackToWeb] = useState(false); // State to trigger re-render on fallback
  const isNativePlatform = Capacitor.isNativePlatform();
  
  useEffect(() => {
    return () => {
      clientStockfish.stopAnalysis();
      if (clockIntervalRef.current) {
        clearInterval(clockIntervalRef.current);
      }
      if (countdownTimeoutRef.current) {
        clearTimeout(countdownTimeoutRef.current);
      }
      // Cleanup native voice session
      if (isNativeVoiceActive.current) {
        BlindfoldNative.stopSession().catch(() => {});
        isNativeVoiceActive.current = false;
      }
      if (nativeListenerRef.current) {
        nativeListenerRef.current.remove().catch(() => {});
        nativeListenerRef.current = null;
      }
    };
  }, []);
  
  // Persist game settings to localStorage
  useEffect(() => {
    localStorage.setItem('blindfold-settings-elo', String(selectedBotElo));
  }, [selectedBotElo]);
  
  useEffect(() => {
    localStorage.setItem('blindfold-settings-color', selectedColor);
  }, [selectedColor]);
  
  useEffect(() => {
    localStorage.setItem('blindfold-settings-time', timeControl);
  }, [timeControl]);
  
  useEffect(() => {
    if (historyTrigger && historyTrigger > 0) {
      setShowGameHistory(true);
    }
  }, [historyTrigger]);
  
  useEffect(() => {
    gameRef.current = game;
    whiteTimeRef.current = whiteTime;
    blackTimeRef.current = blackTime;
    movesRef.current = moves;
  }, [game, whiteTime, blackTime, moves]);

  const resetGameState = useCallback(() => {
    if (clockIntervalRef.current) {
      clearInterval(clockIntervalRef.current);
      clockIntervalRef.current = null;
    }
    if (disambiguationTimeoutRef.current) {
      clearTimeout(disambiguationTimeoutRef.current);
      disambiguationTimeoutRef.current = null;
    }
    setGame(null);
    setGameStarted(false);
    setGameResult(null);
    setFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
    setMoves([]);
    setSelectedSquare(null);
    setLegalMoves([]);
    setLastMove(null);
    setSelectedBot(null);
    setBotThinking(false);
    setIsPeeking(false);
    setAwaitingDisambiguation(null);
    voiceRecognition.stop();
    gamePeekTimeRef.current = 0;
    setPeekFreeStreak(0);
    setBestPeekFreeStreak(0);
    peekedSinceLastMoveRef.current = false;
    botMoveTimestampRef.current = null;
    responseTimesRef.current = [];
    bookMovesRef.current = 0;
    voiceCorrectionsRef.current = 0;
    voiceCommandsRef.current = 0;
    reconstructionVoiceInputsRef.current = 0;
    reconstructionTouchInputsRef.current = 0;
    gameVoiceMovesRef.current = 0;
    gameTouchMovesRef.current = 0;
    squareInquiriesRef.current = [];
    wasAssistedRef.current = false;
    if (voicePeekTimeoutRef.current) {
      clearTimeout(voicePeekTimeoutRef.current);
      voicePeekTimeoutRef.current = null;
    }
    setShowReconstruction(false);
    setReconstructionFen(null);
    pendingGameResultRef.current = null;
    setLastReconstructionScore(null);
    setLastReconstructionVoicePurity(null);
    setReconstructionCountdown(null);
    if (countdownTimeoutRef.current) {
      clearTimeout(countdownTimeoutRef.current);
      countdownTimeoutRef.current = null;
    }
  }, []);

  // Report state changes to parent component
  useEffect(() => {
    if (!onStateChange) return;
    
    if (showReconstruction) {
      onStateChange('reconstruction');
    } else if (showAnalysis) {
      onStateChange('analysis');
    } else if (gameStarted && !gameResult) {
      onStateChange('in_game');
    } else if (!showTitleScreen) {
      // On setup/configuration screen but game hasn't started
      onStateChange('setup');
    } else {
      onStateChange('idle');
    }
  }, [showReconstruction, showAnalysis, gameStarted, gameResult, showTitleScreen, onStateChange]);

  // Expose returnToTitle function to parent
  const returnToTitle = useCallback(() => {
    // If in a game with moves, save as resignation
    if (gameStarted && gameRef.current && movesRef.current.length > 0 && !gameResult && selectedBot) {
      // Stop the clock
      if (clockIntervalRef.current) {
        clearInterval(clockIntervalRef.current);
        clockIntervalRef.current = null;
      }
      
      // Save the game as a loss (resignation)
      const pgn = gameRef.current.pgn() || "";
      const gameToSave = {
        date: new Date().toISOString(),
        result: 'loss' as const,
        playerColor,
        botName: String(selectedBot.elo),
        botElo: selectedBot.elo,
        moveCount: movesRef.current.length,
        pgn,
        clarityScore: 0,
        isFavorite: false,
        timeControl: timeControl
      };
      saveGame(gameToSave).then(id => {
        if (id) {
          console.log('[Game] Saved resigned game to history:', id);
        }
      });
    }
    
    // Clean up and return to title
    voiceRecognition.stop();
    setShowReconstruction(false);
    setShowAnalysis(false);
    setShowPostMortem(false);
    setShowGameHistory(false);
    setViewingHistoryGame(null);
    resetGameState();
    setShowTitleScreen(true);
  }, [gameStarted, gameResult, selectedBot, playerColor, timeControl, resetGameState]);

  // Attach to ref for parent access
  useEffect(() => {
    if (returnToTitleRef) {
      returnToTitleRef.current = returnToTitle;
    }
    return () => {
      if (returnToTitleRef) {
        returnToTitleRef.current = null;
      }
    };
  }, [returnToTitle, returnToTitleRef]);

  const finalizeGameResult = useCallback((result: "white_win" | "black_win" | "draw", clarityScore?: number, voicePurity?: number) => {
    const playerWon = (result === "white_win" && playerColor === "white") || 
                     (result === "black_win" && playerColor === "black");
    
    const statsResult = result === "draw" ? "draw" : playerWon ? "win" : "loss";
    const wasPeekFree = gamePeekTimeRef.current === 0;
    
    // Store response times and inquiries for post-mortem report
    setLastGameResponseTimes([...responseTimesRef.current]);
    setLastGameSquareInquiries([...squareInquiriesRef.current]);
    setLastGameMoveHistory([...movesRef.current]);
    const totalMoves = movesRef.current.length;
    
    const newStats = recordGameResult(
      statsResult, 
      gamePeekTimeRef.current,
      bestPeekFreeStreak,
      responseTimesRef.current,
      clarityScore,
      voicePurity,
      {
        botElo: gameBotEloRef.current,
        wasPeekFree,
        totalMoves,
        voiceCorrections: voiceCorrectionsRef.current,
        voiceCommands: voiceCommandsRef.current,
        reconstructionVoiceInputs: reconstructionVoiceInputsRef.current,
        reconstructionTouchInputs: reconstructionTouchInputsRef.current,
        gameVoiceMoves: gameVoiceMovesRef.current,
        gameTouchMoves: gameTouchMovesRef.current,
        squareInquiries: squareInquiriesRef.current,
        isBlindfold,
        wasAssisted: wasAssistedRef.current,
      }
    );
    setStats(newStats);
    window.dispatchEvent(new CustomEvent('statsUpdated'));
    
    // Show post-mortem report after game ends (only auto-show if reconstruction is NOT enabled)
    // If reconstruction is enabled, user can click "View Report" button after reviewing heatmap
    if (!blindfoldSettings.boardReconstructionEnabled) {
      setShowPostMortem(true);
    }
    
    // Auto-save game to history (only if moves were made)
    if (selectedBot && totalMoves > 0) {
      const pgn = gameRef.current?.pgn() || "";
      const gameToSave = {
        date: new Date().toISOString(),
        result: statsResult as "win" | "loss" | "draw",
        playerColor,
        botName: String(selectedBot.elo),
        botElo: selectedBot.elo,
        moveCount: totalMoves,
        pgn,
        clarityScore: clarityScore ?? 0,
        isFavorite: false,
        timeControl: timeControl
      };
      saveGame(gameToSave).then(id => {
        if (id) {
          console.log('[Game] Saved game to history:', id);
        }
      });
    } else if (selectedBot && totalMoves === 0) {
      console.log('[Game] Zero-move game detected. Not saving to history.');
    }
  }, [playerColor, bestPeekFreeStreak, isBlindfold, selectedBot, timeControl]);

  const handleGameEnd = useCallback((result: "white_win" | "black_win" | "draw") => {
    if (clockIntervalRef.current) {
      clearInterval(clockIntervalRef.current);
      clockIntervalRef.current = null;
    }
    setGameResult(result);
    
    // Stop voice recognition to prevent conflicts with reconstruction's own speech system
    voiceRecognition.stop();
    
    const playerWon = (result === "white_win" && playerColor === "white") || 
                     (result === "black_win" && playerColor === "black");
    const message = result === "draw" ? "Game drawn" : playerWon ? "You win!" : "You lose";
    
    if (voiceOutputEnabled) {
      speak(message);
    }
    
    // Check if board reconstruction is enabled (available for all game modes)
    if (blindfoldSettings.boardReconstructionEnabled && gameRef.current) {
      pendingGameResultRef.current = { result, fen: gameRef.current.fen() };
      setReconstructionFen(gameRef.current.fen());
      // Start countdown before showing reconstruction challenge
      setReconstructionCountdown(3);
    } else {
      // Finalize immediately without reconstruction
      finalizeGameResult(result);
    }
  }, [playerColor, voiceOutputEnabled, blindfoldSettings.boardReconstructionEnabled, finalizeGameResult]);
  
  // Countdown timer effect for reconstruction transition
  useEffect(() => {
    if (reconstructionCountdown === null) return;
    
    if (reconstructionCountdown > 0) {
      countdownTimeoutRef.current = setTimeout(() => {
        setReconstructionCountdown(prev => prev !== null ? prev - 1 : null);
      }, 1000);
    } else {
      // Countdown finished, show reconstruction challenge
      setShowReconstruction(true);
      setReconstructionCountdown(null);
    }
    
    return () => {
      if (countdownTimeoutRef.current) {
        clearTimeout(countdownTimeoutRef.current);
      }
    };
  }, [reconstructionCountdown]);

  const handleReconstructionComplete = useCallback((score: number, voicePurity: number, voiceInputs: number, touchInputs: number) => {
    // Store reconstruction input counts for statistics
    reconstructionVoiceInputsRef.current = voiceInputs;
    reconstructionTouchInputsRef.current = touchInputs;
    
    // Store reconstruction results for post-mortem report
    setLastReconstructionScore(score);
    setLastReconstructionVoicePurity(voicePurity);
    
    if (pendingGameResultRef.current) {
      finalizeGameResult(pendingGameResultRef.current.result, score, voicePurity);
      // Clear to prevent double finalization
      pendingGameResultRef.current = null;
    }
    // Keep showReconstruction true until user clicks Continue
    // The reconstruction component handles showing the score internally
  }, [finalizeGameResult]);
  
  const handleReconstructionContinue = useCallback(() => {
    setShowReconstruction(false);
    setReconstructionFen(null);
    pendingGameResultRef.current = null;
    // Navigate to main menu (title screen)
    returnToTitle();
  }, [returnToTitle]);

  const handleReconstructionSkip = useCallback(() => {
    // Clear reconstruction stats since we're skipping
    setLastReconstructionScore(null);
    setLastReconstructionVoicePurity(null);
    
    if (pendingGameResultRef.current) {
      finalizeGameResult(pendingGameResultRef.current.result);
    }
    setShowReconstruction(false);
    setReconstructionFen(null);
    pendingGameResultRef.current = null;
    // Open the post-mortem report instead of just closing
    setShowPostMortem(true);
  }, [finalizeGameResult]);

  const requestBotMove = useCallback(async (currentFen: string, botId: string, moveHistorySAN?: string[], lastMoveInfo?: LastMoveInfo) => {
    if (!botId) return null;
    
    setBotThinking(true);
    
    try {
      // Extract elo from botId (format: "elo_XXXX")
      const eloMatch = botId.match(/elo_(\d+)/);
      if (!eloMatch) {
        throw new Error("Invalid bot ID format");
      }
      const botElo = parseInt(eloMatch[1], 10);
      
      const botRemainingTime = playerColor === 'white' ? blackTimeRef.current : whiteTimeRef.current;
      const moveCount = moveHistorySAN?.length || 0;
      
      const result = await getBotMove(
        currentFen,
        botId,
        moveHistorySAN,
        lastMoveInfo
      );
      
      if (!result) {
        throw new Error("Bot failed to generate move");
      }
      
      // Track book moves for statistics
      if (result.isBookMove) {
        bookMovesRef.current++;
      }
      
      let thinkDelay: number;
      
      if (result.isFreeCapture) {
        thinkDelay = 2000;
      } else if (blindfoldSettings.botThinkingTimeEnabled) {
        // Human-like thinking delay when enabled
        const moveNumber = Math.ceil((moveCount + 2) / 2);
        const pieceCount = countAllPieces(currentFen);
        thinkDelay = getHumanBotThinkingDelay(moveNumber, pieceCount, botRemainingTime, timeControl);
      } else {
        // Standard delay when disabled
        const moveNumber = Math.ceil((moveCount + 2) / 2);
        const botColor: 'white' | 'black' = playerColor === 'white' ? 'black' : 'white';
        thinkDelay = botMoveDelay(moveNumber, botRemainingTime, currentFen, botColor, lastMoveInfo);
      }
      
      // Show extended thinking indicator for delays > 2s
      if (thinkDelay > 2000) {
        setExtendedThinking(true);
      }
      await delay(thinkDelay);
      setExtendedThinking(false);
      
      return result;
    } catch (error) {
      console.error("Error getting bot move:", error);
      toast({
        title: "Error",
        description: "Bot failed to respond",
        variant: "destructive",
      });
      return null;
    } finally {
      setBotThinking(false);
      setExtendedThinking(false);
    }
  }, [toast, playerColor, blindfoldSettings.botThinkingTimeEnabled, timeControl]);

  const handleStartGame = async (bot: BotProfile, colorChoice: "white" | "black" | "random") => {
    gamePeekTimeRef.current = 0;
    gameBotEloRef.current = bot.elo; // Capture bot elo at game start
    const newGame = new Chess();
    setGame(newGame);
    gameRef.current = newGame;
    setFen(newGame.fen());
    setMoves([]);
    movesRef.current = [];
    setSelectedSquare(null);
    setLegalMoves([]);
    setGameResult(null);
    setSelectedBot(bot);
    
    const assignedColor = colorChoice === "random" 
      ? (Math.random() < 0.5 ? "white" : "black")
      : colorChoice;
    setPlayerColor(assignedColor);
    
    const seconds = timeControl === "practice" ? 99999999 : (timeControl === "blitz" ? 300 : (timeControl === "rapid" ? 900 : 1800));
    setWhiteTime(seconds);
    setBlackTime(seconds);
    whiteTimeRef.current = seconds;
    blackTimeRef.current = seconds;
    
    if (isBlindfold) {
      setRemainingPeeks(BLINDFOLD_CONFIG[blindfoldDifficulty].maxPeeks);
    } else {
      setRemainingPeeks(Number.POSITIVE_INFINITY);
    }
    
    setGameStarted(true);
    setIsTransitioning(false); // Reset transition for fade-in
    
    if (assignedColor === "black") {
      const botMove = await requestBotMove(newGame.fen(), bot.id);
      if (botMove && gameRef.current) {
        const moveResult = gameRef.current.move(botMove.move);
        if (moveResult) {
          setLastMove({ from: moveResult.from, to: moveResult.to });
        }
        setFen(gameRef.current.fen());
        const newMoves = [botMove.move];
        setMoves(newMoves);
        movesRef.current = newMoves;
        
        // Record timestamp for response time tracking (first move when player is black)
        botMoveTimestampRef.current = Date.now();
        
        // Haptic feedback for bot move (double pulse)
        try {
          Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
          setTimeout(() => {
            Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
          }, 100);
        } catch (e) {}
        
        if (voiceOutputEnabled) {
          const spokenMove = moveToSpeech(botMove.move, botMove.move.includes('x'), gameRef.current.isCheck(), false);
          lastSpokenMove.current = spokenMove;
          speak(spokenMove);
        }
      }
    }
  };

  useEffect(() => {
    // Don't run timer if game has ended
    if (gameResult !== null) {
      if (clockIntervalRef.current) {
        clearInterval(clockIntervalRef.current);
        clockIntervalRef.current = null;
      }
      return;
    }
    
    if (gameStarted && game && timeControl !== "practice") {
      const timer = setInterval(() => {
        const currentTurn = game.turn();
        
        if (currentTurn === "w") {
          setWhiteTime((t) => {
            const newTime = Math.max(0, t - 1);
            whiteTimeRef.current = newTime;
            if (newTime === 0 && t > 0) {
              handleGameEnd("black_win");
            }
            return newTime;
          });
        } else {
          setBlackTime((t) => {
            const newTime = Math.max(0, t - 1);
            blackTimeRef.current = newTime;
            if (newTime === 0 && t > 0) {
              handleGameEnd("white_win");
            }
            return newTime;
          });
        }
      }, 1000);
      
      clockIntervalRef.current = timer;
      
      return () => {
        clearInterval(timer);
        clockIntervalRef.current = null;
      };
    }
  }, [gameStarted, game, handleGameEnd, timeControl, gameResult]);

  // Keep screen awake during blindfold games (critical for voice-only play)
  useEffect(() => {
    const manageKeepAwake = async () => {
      try {
        if (gameStarted && isBlindfold && blindfoldSettings.keepAwakeEnabled) {
          await KeepAwake.keepAwake();
          console.log('[KeepAwake] Screen wake lock enabled for blindfold game');
        } else {
          await KeepAwake.allowSleep();
          console.log('[KeepAwake] Screen wake lock released');
        }
      } catch (error) {
        // KeepAwake may not be available in web browser (only in Capacitor)
        console.log('[KeepAwake] Plugin not available (web mode):', error);
      }
    };
    
    manageKeepAwake();
    
    // Cleanup: release wake lock when component unmounts or game ends
    return () => {
      KeepAwake.allowSleep().catch(() => {});
    };
  }, [gameStarted, isBlindfold, blindfoldSettings.keepAwakeEnabled]);

  // NATIVE ANDROID VOICE LOOP - Uses BlindfoldNative plugin for 0ms mic restart
  // Permissions are requested once on app startup in App.tsx
  useEffect(() => {
    if (!isNativePlatform || !voiceInputEnabled || !gameStarted || !gameRef.current || gameResult !== null) {
      return;
    }

    let cancelled = false;

    const setupNativeVoice = async () => {
      try {
        // Wait for app-level permission request to complete
        const ready = await waitForVoiceReady();
        if (!ready || cancelled) {
          console.warn('[NativeVoice] Voice not ready or cancelled');
          return;
        }

        console.log('[NativeVoice] Starting voice session...');

        // Set up listener for speech results
        if (nativeListenerRef.current) {
          await nativeListenerRef.current.remove();
        }
        
        if (cancelled) return;
        
        console.log('[NativeVoice] Setting up onSpeechResult listener...');
        nativeListenerRef.current = await BlindfoldNative.addListener('onSpeechResult', (data) => {
          console.log('[NativeVoice] *** RECEIVED onSpeechResult:', data.text);
          const transcript = data.text;
          const currentGame = gameRef.current;
          if (!currentGame) {
            console.log('[NativeVoice] No game ref, ignoring');
            return;
          }

          const cleaned = transcript.trim();
          if (cleaned.length < 2) {
            console.log('[NativeVoice] Too short, ignoring:', cleaned);
            return;
          }

          voiceCommandsRef.current++;
          setVoiceTranscript(transcript);
          console.log('[NativeVoice] Processing transcript:', transcript);

          const lowerTranscript = transcript.toLowerCase();

          // Handle repeat command
          if (lowerTranscript.includes("repeat") || lowerTranscript.includes("say again")) {
            if (lastSpokenMove.current && voiceOutputEnabled) {
              BlindfoldNative.speakAndListen({ text: lastSpokenMove.current }).catch(() => {});
            } else {
              // No TTS to repeat, restart listening anyway
              BlindfoldNative.startListening().catch(() => {});
            }
            return;
          }

          // Parse and execute chess moves
          const allLegalMoves = currentGame.moves({ verbose: true }).map(m => m.san);
          const result = speechToMoveWithAmbiguity(transcript, allLegalMoves);

          if (result.move && !result.isAmbiguous) {
            try {
              const moveResult = currentGame.move(result.move);
              if (moveResult) {
                gameVoiceMovesRef.current++;
                setLastMove({ from: moveResult.from, to: moveResult.to });
                const newFen = currentGame.fen();
                setFen(newFen);
                const newMoves = [...movesRef.current, result.move];
                setMoves(newMoves);
                movesRef.current = newMoves;

                Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});

                if (currentGame.isCheckmate()) {
                  handleGameEnd(currentGame.turn() === "w" ? "black_win" : "white_win");
                } else if (currentGame.isDraw()) {
                  handleGameEnd("draw");
                }

                setVoiceTranscript(null);
                
                // CRITICAL: Keep mic alive after player move
                // Bot will use speakAndListen which handles its own restart
                // For player-only moves (or when voice output is off), we need explicit restart
                BlindfoldNative.startListening().catch(() => {});
              }
            } catch (e) {
              console.error('[NativeVoice] Move error:', e);
              // Restart listening even on error to keep mic active
              BlindfoldNative.startListening().catch(() => {});
            }
          } else {
            setVoiceTranscript(null);
            // Keep listening for next attempt (unrecognized or ambiguous input)
            BlindfoldNative.startListening().catch(() => {});
          }
        });

        if (cancelled) return;

        // Start the native voice session
        console.log('[NativeVoice] Calling startSession...');
        await BlindfoldNative.startSession();
        isNativeVoiceActive.current = true;
        setIsVoiceListening(true);
        // Reset fallback flag on success so native is used
        setNativeFallbackToWeb(false);
        console.log('[NativeVoice] Session started - listener active, waiting for speech');

      } catch (error) {
        console.error('[NativeVoice] Setup failed, falling back to web voice:', error);
        // Fallback to web voice recognition if native fails (state triggers re-render)
        setNativeFallbackToWeb(true);
        isNativeVoiceActive.current = false;
      }
    };

    setupNativeVoice();

    return () => {
      cancelled = true;
      if (isNativeVoiceActive.current) {
        BlindfoldNative.stopSession().catch(() => {});
        isNativeVoiceActive.current = false;
        setIsVoiceListening(false);
      }
    };
  }, [isNativePlatform, voiceInputEnabled, gameStarted, gameResult, voiceOutputEnabled, handleGameEnd]);

  // WEB FALLBACK VOICE - Uses voiceRecognition for browser (or native fallback)
  useEffect(() => {
    // Skip if on native platform unless native failed and we need to fallback
    if (isNativePlatform && !nativeFallbackToWeb) return;

    if (!voiceInputEnabled) {
      voiceRecognition.stop();
      return;
    }
    
    if (!gameStarted || !gameRef.current || gameResult !== null) {
      voiceRecognition.stop();
      return;
    }
    
    // PROTECTED LANE: Register game session (immune to training purge)
    VoiceRegistry.register('game');
    
    voiceRecognition.setOnResult(async (move, transcript) => {
      const currentGame = gameRef.current;
      if (!currentGame) return;
      
      // EMPTY TRANSCRIPT GUARD: Ignore ghost inputs from Android
      // S9+ often fires empty partial results before actual speech
      const cleaned = transcript.trim();
      if (cleaned.length < 2) {
        console.log('[Game] Ignoring empty/short transcript:', transcript);
        return;
      }
      
      // Track voice command for statistics
      voiceCommandsRef.current++;
      
      setVoiceTranscript(transcript);
      
      const lowerTranscript = transcript.toLowerCase();
      
      // Handle resign confirmation dialog voice commands
      if (showResignConfirm) {
        if (lowerTranscript.includes("yes") || lowerTranscript.includes("confirm") || lowerTranscript.includes("i confirm")) {
          // Confirm resignation
          try {
            Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
          } catch (e) {}
          setShowResignConfirm(false);
          handleGameEnd(playerColor === "white" ? "black_win" : "white_win");
          setVoiceTranscript(null);
          return;
        }
        if (lowerTranscript.includes("no") || lowerTranscript.includes("cancel") || lowerTranscript.includes("never mind")) {
          // Cancel resignation
          try {
            Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
          } catch (e) {}
          setShowResignConfirm(false);
          setVoiceTranscript(null);
          return;
        }
        // If dialog is open but command isn't yes/no, ignore and wait
        return;
      }
      
      if (lowerTranscript.includes("repeat") || lowerTranscript.includes("say again") || lowerTranscript.includes("what was that") || lowerTranscript.includes("again")) {
        // HOT ECHO: Short repeat phrases don't need mic pause
        if (lastSpokenMove.current && voiceOutputEnabled) {
          speak(lastSpokenMove.current).catch(e => console.warn('[Voice] Echo failed:', e));
        }
        return;
      }
      
      // Handle "what's on [square]" inquiries for confusion heatmap tracking
      const whatOnMatch = lowerTranscript.match(/what(?:'?s| is)?\s+(?:on\s+)?([a-h])[\s-]?([1-8])/);
      if (whatOnMatch) {
        const inquiredSquare = `${whatOnMatch[1]}${whatOnMatch[2]}`;
        // Only track confusion heatmap data if in Blindfold mode
        if (isBlindfold) {
          squareInquiriesRef.current.push(inquiredSquare);
        }
        
        // Tell the user what's on the square
        const piece = currentGame.get(inquiredSquare as any);
        let response = '';
        if (piece) {
          const colorName = piece.color === 'w' ? 'White' : 'Black';
          const pieceNames: Record<string, string> = { p: 'Pawn', n: 'Knight', b: 'Bishop', r: 'Rook', q: 'Queen', k: 'King' };
          const pieceName = pieceNames[piece.type] || piece.type;
          response = `${colorName} ${pieceName} on ${inquiredSquare}`;
        } else {
          response = `${inquiredSquare.toUpperCase()} is empty`;
        }
        
        // HOT ECHO: Info responses don't need mic pause
        if (voiceOutputEnabled) {
          speak(response).catch(e => console.warn('[Voice] Echo failed:', e));
        }
        setVoiceTranscript(null);
        return;
      }
      
      // Handle "last move" query - tells the player what opponent played
      if (lowerTranscript.includes("last move") || lowerTranscript.includes("previous move") || lowerTranscript.includes("opponent's move")) {
        // Haptic confirmation
        try {
          Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
        } catch (e) {}
        
        const history = currentGame.history({ verbose: true });
        let response = '';
        
        if (history.length === 0) {
          response = 'No moves have been made yet';
        } else {
          const lastMove = history[history.length - 1];
          const pieceNames: Record<string, string> = { p: 'Pawn', n: 'Knight', b: 'Bishop', r: 'Rook', q: 'Queen', k: 'King' };
          const pieceName = pieceNames[lastMove.piece] || lastMove.piece;
          const capture = lastMove.captured ? ' takes' : '';
          const from = lastMove.from.toUpperCase();
          const to = lastMove.to.toUpperCase();
          
          if (lastMove.piece === 'p') {
            response = `${from}${capture} ${to}`;
          } else {
            response = `${pieceName}${capture} ${to}`;
          }
        }
        
        // HOT ECHO: Info responses don't need mic pause
        if (voiceOutputEnabled) {
          speak(response).catch(e => console.warn('[Voice] Echo failed:', e));
        }
        setVoiceTranscript(null);
        return;
      }
      
      // Handle "how much time" / "clock" / "time" query (strict matching to avoid collision with other commands)
      const isTimeQuery = /\b(how much time|what('?s| is) the time|time left|clock|my time)\b/.test(lowerTranscript);
      if (isTimeQuery) {
        // Haptic confirmation
        try {
          Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
        } catch (e) {}
        
        const myTimeSeconds = playerColor === "white" ? whiteTimeRef.current : blackTimeRef.current;
        const botTimeSeconds = playerColor === "white" ? blackTimeRef.current : whiteTimeRef.current;
        
        const formatTimeVoice = (seconds: number): string => {
          const mins = Math.floor(seconds / 60);
          const secs = seconds % 60;
          if (mins > 0 && secs > 0) {
            return `${mins} minute${mins !== 1 ? 's' : ''} ${secs} second${secs !== 1 ? 's' : ''}`;
          } else if (mins > 0) {
            return `${mins} minute${mins !== 1 ? 's' : ''}`;
          } else {
            return `${secs} second${secs !== 1 ? 's' : ''}`;
          }
        };
        
        const response = `You have ${formatTimeVoice(myTimeSeconds)}. Opponent has ${formatTimeVoice(botTimeSeconds)}.`;
        
        // HOT ECHO: Time query responses don't need mic pause
        if (voiceOutputEnabled) {
          speak(response).catch(e => console.warn('[Voice] Echo failed:', e));
        }
        setVoiceTranscript(null);
        return;
      }
      
      // Handle "where is my [piece]" query
      const whereIsMatch = lowerTranscript.match(/where(?:'?s| is| are)?\s+(?:my\s+)?(\w+)/);
      if (whereIsMatch) {
        const pieceQuery = whereIsMatch[1].toLowerCase();
        const pieceMap: Record<string, string> = {
          'king': 'k', 'kings': 'k',
          'queen': 'q', 'queens': 'q',
          'rook': 'r', 'rooks': 'r', 'castle': 'r', 'castles': 'r',
          'bishop': 'b', 'bishops': 'b',
          'knight': 'n', 'knights': 'n', 'horse': 'n', 'horses': 'n',
          'pawn': 'p', 'pawns': 'p',
        };
        
        const pieceType = pieceMap[pieceQuery];
        if (pieceType) {
          // Haptic confirmation
          try {
            Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
          } catch (e) {}
          
          const playerColorCode = playerColor === "white" ? "w" : "b";
          const pieceFullNames: Record<string, string> = { k: 'King', q: 'Queen', r: 'Rook', b: 'Bishop', n: 'Knight', p: 'Pawn' };
          const pieceName = pieceFullNames[pieceType];
          
          // Find all squares with this piece
          const squares: string[] = [];
          const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
          for (const file of files) {
            for (let rank = 1; rank <= 8; rank++) {
              const square = `${file}${rank}`;
              const piece = currentGame.get(square as any);
              if (piece && piece.type === pieceType && piece.color === playerColorCode) {
                squares.push(square.toUpperCase());
              }
            }
          }
          
          let response = '';
          if (squares.length === 0) {
            response = `You have no ${pieceName}s`;
          } else if (squares.length === 1) {
            response = `Your ${pieceName} is on ${squares[0]}`;
          } else {
            response = `You have ${pieceName}s on ${squares.slice(0, -1).join(', ')} and ${squares[squares.length - 1]}`;
          }
          
          // HOT ECHO: Piece location responses don't need mic pause
          if (voiceOutputEnabled) {
            speak(response).catch(e => console.warn('[Voice] Echo failed:', e));
          }
          setVoiceTranscript(null);
          return;
        }
      }
      
      // Handle "material" / "material score" query
      if (lowerTranscript.includes("material")) {
        // Haptic confirmation
        try {
          Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
        } catch (e) {}
        
        const pieceValues: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 };
        const pieceNames: Record<string, string> = { p: 'Pawn', n: 'Knight', b: 'Bishop', r: 'Rook', q: 'Queen' };
        
        // Count pieces for each side
        const whitePieces: Record<string, number> = { p: 0, n: 0, b: 0, r: 0, q: 0 };
        const blackPieces: Record<string, number> = { p: 0, n: 0, b: 0, r: 0, q: 0 };
        
        const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
        for (const file of files) {
          for (let rank = 1; rank <= 8; rank++) {
            const square = `${file}${rank}`;
            const piece = currentGame.get(square as any);
            if (piece && piece.type !== 'k') {
              if (piece.color === 'w') {
                whitePieces[piece.type]++;
              } else {
                blackPieces[piece.type]++;
              }
            }
          }
        }
        
        // Calculate net difference
        const netDiff: Record<string, number> = {};
        let whiteAdvantage = 0;
        for (const type of ['q', 'r', 'b', 'n', 'p']) {
          const diff = whitePieces[type] - blackPieces[type];
          if (diff !== 0) {
            netDiff[type] = diff;
            whiteAdvantage += diff * pieceValues[type];
          }
        }
        
        let response = '';
        if (whiteAdvantage === 0) {
          response = 'Material is equal';
        } else {
          const advSide = whiteAdvantage > 0 ? 'White' : 'Black';
          const absDiff = Math.abs(whiteAdvantage);
          
          // Build natural language description of what's extra
          const extras: string[] = [];
          for (const type of ['q', 'r', 'b', 'n', 'p']) {
            const typeDiff = whiteAdvantage > 0 ? netDiff[type] : -(netDiff[type] || 0);
            if (typeDiff && typeDiff > 0) {
              const count = typeDiff;
              const name = pieceNames[type];
              extras.push(count === 1 ? `a ${name}` : `${count} ${name}s`);
            }
          }
          
          if (extras.length > 0) {
            const extraDesc = extras.length === 1 ? extras[0] : `${extras.slice(0, -1).join(', ')} and ${extras[extras.length - 1]}`;
            response = `${advSide} is up ${extraDesc}`;
          } else {
            response = `${advSide} is up by ${absDiff} point${absDiff !== 1 ? 's' : ''}`;
          }
        }
        
        // HOT ECHO: Material responses don't need mic pause
        if (voiceOutputEnabled) {
          speak(response).catch(e => console.warn('[Voice] Echo failed:', e));
        }
        setVoiceTranscript(null);
        return;
      }
      
      // Handle "legal moves for [piece]" query
      const legalMovesMatch = lowerTranscript.match(/legal\s+moves?\s+(?:for\s+)?(?:my\s+)?(\w+)/);
      if (legalMovesMatch) {
        const pieceQuery = legalMovesMatch[1].toLowerCase();
        const pieceMap: Record<string, string> = {
          'king': 'k', 'queen': 'q', 'rook': 'r', 'bishop': 'b', 'knight': 'n', 'pawn': 'p',
          'kings': 'k', 'queens': 'q', 'rooks': 'r', 'bishops': 'b', 'knights': 'n', 'pawns': 'p',
          'horse': 'n', 'horses': 'n', 'castle': 'r', 'castles': 'r',
        };
        
        const pieceType = pieceMap[pieceQuery];
        if (pieceType) {
          // Haptic confirmation
          try {
            Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
          } catch (e) {}
          
          const pieceFullNames: Record<string, string> = { k: 'King', q: 'Queen', r: 'Rook', b: 'Bishop', n: 'Knight', p: 'Pawn' };
          const pieceName = pieceFullNames[pieceType];
          
          // Get all legal moves for this piece type
          const allMoves = currentGame.moves({ verbose: true });
          const pieceMoves = allMoves.filter(m => m.piece === pieceType);
          
          // Extract unique destination squares
          const destinations = Array.from(new Set(pieceMoves.map(m => m.to.toUpperCase())));
          
          let response = '';
          if (destinations.length === 0) {
            response = `Your ${pieceName} has no legal moves`;
          } else if (destinations.length <= 4) {
            response = `Your ${pieceName} can move to ${destinations.join(', ')}`;
          } else {
            // More than 4 moves - give count and examples
            const examples = destinations.slice(0, 3);
            response = `Your ${pieceName} has ${destinations.length} legal moves, including ${examples.join(', ')}`;
          }
          
          // HOT ECHO: Legal moves responses don't need mic pause
          if (voiceOutputEnabled) {
            speak(response).catch(e => console.warn('[Voice] Echo failed:', e));
          }
          setVoiceTranscript(null);
          return;
        }
      }
      
      // Handle "resign" / "quit" / "give up" voice command
      if (lowerTranscript.includes("resign") || lowerTranscript.includes("quit") || 
          lowerTranscript.includes("give up") || lowerTranscript.includes("i resign")) {
        // Haptic confirmation
        try {
          Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
        } catch (e) {}
        
        // Trigger the resign confirmation dialog
        setShowResignConfirm(true);
        setVoiceTranscript(null);
        return;
      }
      
      // Handle "show board" / "peek" / "show" voice command (5 second auto-hide)
      if ((lowerTranscript.includes("show") && lowerTranscript.includes("board")) || 
          lowerTranscript === "peek" || lowerTranscript === "peak" ||
          lowerTranscript === "show") {
        // Block peeking in No Board mode or Grandmaster difficulty
        if (blindfoldDisplayMode === "no_board" || blindfoldDifficulty === "grandmaster") {
          // HOT ECHO: Short warnings don't need mic pause
          if (voiceOutputEnabled) {
            speak("Peeking is not allowed in this mode").catch(e => console.warn('[Voice] Echo failed:', e));
          }
          setVoiceTranscript(null);
          return;
        }
        
        // Haptic confirmation
        try {
          Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
        } catch (e) {}
        
        // Mark game as assisted (this is cheating aid)
        wasAssistedRef.current = true;
        
        // Trigger peek
        setIsPeeking(true);
        
        // Clear any existing timeout
        if (voicePeekTimeoutRef.current) {
          clearTimeout(voicePeekTimeoutRef.current);
        }
        
        // Auto-hide after 5 seconds
        voicePeekTimeoutRef.current = setTimeout(() => {
          setIsPeeking(false);
          voicePeekTimeoutRef.current = null;
        }, 5000);
        
        // HOT ECHO: Peek confirmation doesn't need mic pause
        if (voiceOutputEnabled) {
          speak("Board visible for 5 seconds").catch(e => console.warn('[Voice] Echo failed:', e));
        }
        setVoiceTranscript(null);
        return;
      }
      
      // Handle "evaluate" / "eval" / "evaluation" command
      if (lowerTranscript.includes("eval") || lowerTranscript.includes("evaluation")) {
        // Haptic confirmation
        try {
          Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
        } catch (e) {}
        
        // Mark game as assisted
        wasAssistedRef.current = true;
        
        // HOT ECHO: Evaluation responses don't need mic pause
        if (voiceOutputEnabled) {
          (async () => {
            try {
              const result = await clientStockfish.getBestMove(currentGame.fen(), { depth: 12 });
              let evalResponse = '';
              if (result.evaluation !== undefined) {
                const evalValue = result.evaluation;
                const sign = evalValue >= 0 ? 'plus' : 'minus';
                const absValue = Math.abs(evalValue).toFixed(1);
                if (Math.abs(evalValue) >= 100) {
                  evalResponse = evalValue > 0 ? 'White has checkmate' : 'Black has checkmate';
                } else if (Math.abs(evalValue) < 0.3) {
                  evalResponse = 'Position is equal';
                } else {
                  evalResponse = `Evaluation is ${sign} ${absValue}`;
                }
              } else {
                evalResponse = 'Unable to evaluate position';
              }
              await speak(evalResponse);
            } catch (e) {
              console.warn('[Voice] Eval failed:', e);
              speak("Unable to evaluate position").catch(() => {});
            }
          })();
        }
        setVoiceTranscript(null);
        return;
      }
      
      if (awaitingDisambiguation) {
        if (disambiguationTimeoutRef.current) {
          clearTimeout(disambiguationTimeoutRef.current);
          disambiguationTimeoutRef.current = null;
        }
        
        const disambigResult = parseDisambiguation(transcript);
        
        if (disambigResult.file || disambigResult.rank) {
          const matchingMove = findMoveByDisambiguation(awaitingDisambiguation.candidates, disambigResult);
          
          if (matchingMove) {
            setAwaitingDisambiguation(null);
            
            // HOT ECHO: Speak move without pausing mic
            if (voiceOutputEnabled) {
              const spokenMove = moveToSpeech(matchingMove, matchingMove.includes('x'), false, false);
              lastSpokenMove.current = spokenMove;
              speak(spokenMove).catch(e => console.warn('[Voice] Echo failed:', e));
            }
            
            if (!gameRef.current) return;
            const moveObj = gameRef.current.move(matchingMove);
            if (moveObj) {
              // Track voice move for stats
              gameVoiceMovesRef.current++;
              
              setFen(gameRef.current.fen());
              setLastMove({ from: moveObj.from, to: moveObj.to });
              
              const newMoves = [...movesRef.current, moveObj.san];
              setMoves(newMoves);
              movesRef.current = newMoves;
              
              setSelectedSquare(null);
              setLegalMoves([]);
              setVoiceTranscript(null);
              
              if (gameRef.current.isCheckmate()) {
                const result = gameRef.current.turn() === "w" ? "black_win" : "white_win";
                handleGameEnd(result);
              } else if (gameRef.current.isDraw() || gameRef.current.isStalemate() || gameRef.current.isThreefoldRepetition() || gameRef.current.isInsufficientMaterial()) {
                handleGameEnd("draw");
              }
            }
            return;
          }
        }
        
        // Track correction - disambiguation failed to resolve
        voiceCorrectionsRef.current++;
        
        // HOT ECHO: Short prompts don't need mic pause
        if (voiceOutputEnabled) {
          speak("I didn't catch that. Which piece?").catch(e => console.warn('[Voice] Echo failed:', e));
        }
        
        disambiguationTimeoutRef.current = setTimeout(async () => {
          setAwaitingDisambiguation(null);
          setVoiceTranscript(null);
          // HOT ECHO: Short messages don't need mic pause
          if (voiceOutputEnabled) {
            speak("Move cancelled").catch(e => console.warn('[Voice] Echo failed:', e));
          }
        }, 10000);
        return;
      }
      
      const allLegalMoves = currentGame.moves();
      const result = speechToMoveWithAmbiguity(transcript, allLegalMoves);
      
      if (result.move) {
        // HOT ECHO: Speak move confirmation without pausing mic
        // Mic stays hot - if it hears "e4" again, parser will handle harmlessly
        if (voiceOutputEnabled) {
          const spokenMove = moveToSpeech(result.move, result.move.includes('x'), false, false);
          lastSpokenMove.current = spokenMove;
          // Fire-and-forget TTS - don't block game logic
          speak(spokenMove).catch(e => console.warn('[Voice] Echo failed:', e));
        }
        
        // EXECUTE MOVE IMMEDIATELY - don't wait for TTS
        if (!gameRef.current) return;
        const moveObj = gameRef.current.move(result.move);
        if (moveObj) {
          // Track response time for voice moves (universal stamina tracking)
          if (botMoveTimestampRef.current !== null) {
            const responseTime = Date.now() - botMoveTimestampRef.current;
            responseTimesRef.current.push(responseTime);
            botMoveTimestampRef.current = null;
          }
          
          // Track peek-free streak for voice moves (blindfold only)
          if (isBlindfold) {
            if (!peekedSinceLastMoveRef.current) {
              const newStreak = peekFreeStreak + 1;
              setPeekFreeStreak(newStreak);
              if (newStreak > bestPeekFreeStreak) {
                setBestPeekFreeStreak(newStreak);
              }
            }
            peekedSinceLastMoveRef.current = false;
          }
          
          // Track voice move for stats
          gameVoiceMovesRef.current++;
          
          // Haptic feedback for successful voice move (light tap)
          try {
            Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
          } catch (e) {}
          
          setFen(gameRef.current.fen());
          setLastMove({ from: moveObj.from, to: moveObj.to });
          
          const newMoves = [...movesRef.current, moveObj.san];
          setMoves(newMoves);
          movesRef.current = newMoves;
          
          setSelectedSquare(null);
          setLegalMoves([]);
          setVoiceTranscript(null);
          
          if (gameRef.current.isCheckmate()) {
            const resultStr = gameRef.current.turn() === "w" ? "black_win" : "white_win";
            handleGameEnd(resultStr);
          } else if (gameRef.current.isDraw() || gameRef.current.isStalemate() || gameRef.current.isThreefoldRepetition() || gameRef.current.isInsufficientMaterial()) {
            handleGameEnd("draw");
          }
        }
      } else if (result.isAmbiguous && result.candidates.length > 1) {
        const sources = getSourceSquaresFromCandidates(result.candidates);
        const pieceName = result.piece === 'R' ? 'rook' : result.piece === 'N' ? 'knight' : result.piece === 'B' ? 'bishop' : result.piece === 'Q' ? 'queen' : 'piece';
        const prompt = sources.length === 2 
          ? `Two ${pieceName}s can move to ${result.targetSquare}. The one on ${sources[0]} or ${sources[1]}?`
          : `Multiple ${pieceName}s can move to ${result.targetSquare}. Which one?`;
        
        setAwaitingDisambiguation({
          candidates: result.candidates,
          piece: result.piece,
          targetSquare: result.targetSquare,
        });
        setVoiceTranscript(`Clarify: ${result.candidates.join(' or ')}`);
        
        // HOT ECHO: Disambiguation prompts don't need mic pause
        if (voiceOutputEnabled) {
          speak(prompt).catch(e => console.warn('[Voice] Echo failed:', e));
        }
        
        disambiguationTimeoutRef.current = setTimeout(async () => {
          setAwaitingDisambiguation(null);
          setVoiceTranscript(null);
          // HOT ECHO: Short messages don't need mic pause
          if (voiceOutputEnabled) {
            speak("Move cancelled").catch(e => console.warn('[Voice] Echo failed:', e));
          }
        }, 10000);
      } else {
        // Track correction - move not understood
        voiceCorrectionsRef.current++;
        
        toast({
          title: "Didn't understand",
          description: `Heard: "${transcript}". Try again.`,
          variant: "destructive",
        });
        setVoiceRestartTrigger(prev => prev + 1);
      }
    });
    
    voiceRecognition.setOnListeningChange(setIsVoiceListening);
    
    const currentGame = gameRef.current;
    const currentTurn = currentGame.turn();
    const isMyTurn = (currentTurn === "w" && playerColor === "white") || (currentTurn === "b" && playerColor === "black");
    
    // ALWAYS-ON MIC: Start once, never stop mid-game
    // Use software mute during bot turns instead of hardware stop
    if (isMyTurn && !botThinking && !pendingPromotion && gameResult === null && !isTtsSpeaking.current) {
      const allLegalMoves = currentGame.moves();
      voiceRecognition.setLegalMoves(allLegalMoves);
      voiceRecognition.start(); // Safe to call - has isStarted guard
      // Ensure loop is running when it's our turn (fire-and-forget, no await needed)
      if (voiceRecognition.getMuted()) {
        voiceRecognition.resumeLoop();
      }
    } else if (gameResult !== null) {
      // Only stop when game is over - hardware release is safe now
      voiceRecognition.stop();
    }
    // NOTE: No else stop() - mic stays hot during bot turns, just muted during TTS
    
    return () => {
      voiceRecognition.reset();
      // Clear protected lane when leaving game (unless transitioning to reconstruction)
      VoiceRegistry.clearProtectedLane();
      if (disambiguationTimeoutRef.current) {
        clearTimeout(disambiguationTimeoutRef.current);
        disambiguationTimeoutRef.current = null;
      }
    };
  }, [voiceInputEnabled, gameStarted, fen, playerColor, botThinking, pendingPromotion, gameResult, voiceOutputEnabled, toast, handleGameEnd, awaitingDisambiguation, voiceRestartTrigger, showResignConfirm, nativeFallbackToWeb]);

  useEffect(() => {
    if (!selectedBot || !gameRef.current) return;
    if (gameResult !== null) return;
    
    const currentGame = gameRef.current;
    const currentTurn = currentGame.turn();
    const isBotTurn = (currentTurn === "w" && playerColor === "black") || (currentTurn === "b" && playerColor === "white");
    
    if (isBotTurn && gameStarted && !botThinking) {
      const moveHistorySAN = currentGame.history();
      const currentFen = currentGame.fen();
      const lastMoveInfo = lastMove ? extractLastMoveInfo({ from: lastMove.from, to: lastMove.to }) : undefined;
      
      requestBotMove(currentFen, selectedBot.id, moveHistorySAN, lastMoveInfo).then(async (botMove) => {
        if (botMove && gameRef.current) {
          const botMoveResult = gameRef.current.move(botMove.move);
          if (botMoveResult) {
            setLastMove({ from: botMoveResult.from, to: botMoveResult.to });
          }
          const botNewFen = gameRef.current.fen();
          setFen(botNewFen);
          const updatedMoves = [...movesRef.current, botMove.move];
          setMoves(updatedMoves);
          movesRef.current = updatedMoves;
          
          // Record timestamp for response time tracking
          botMoveTimestampRef.current = Date.now();
          
          // Haptic feedback for bot move (double pulse)
          try {
            Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
            setTimeout(() => {
              Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
            }, 100);
          } catch (e) {}
          
          if (voiceOutputEnabled) {
            const isCheck = gameRef.current.isCheck();
            const isCheckmate = gameRef.current.isCheckmate();
            const isCapture = botMove.move.includes('x');
            const spokenMove = moveToSpeech(botMove.move, isCapture, isCheck, isCheckmate);
            lastSpokenMove.current = spokenMove;
            
            // Use native speakAndListen on Android (0ms mic restart after TTS)
            if (isNativePlatform && isNativeVoiceActive.current && voiceInputEnabled) {
              try {
                await BlindfoldNative.speakAndListen({ text: spokenMove });
              } catch (e) {
                console.error('[NativeVoice] TTS error:', e);
              }
            } else {
              // Web fallback
              isTtsSpeaking.current = true;
              try {
                await speak(spokenMove);
              } catch (e) {
                console.error('[Voice] TTS error:', e);
              } finally {
                isTtsSpeaking.current = false;
              }
            }
          }
          
          if (gameRef.current.isCheckmate()) {
            const result = gameRef.current.turn() === "w" ? "black_win" : "white_win";
            handleGameEnd(result);
          } else if (gameRef.current.isDraw() || gameRef.current.isStalemate() || gameRef.current.isThreefoldRepetition() || gameRef.current.isInsufficientMaterial()) {
            handleGameEnd("draw");
          }
        }
      });
    }
  }, [fen, selectedBot, playerColor, gameStarted, botThinking, gameResult, voiceOutputEnabled, voiceInputEnabled, requestBotMove, handleGameEnd, lastMove]);

  const formatTime = (seconds: number) => {
    if (seconds >= 99999) return "∞";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const isPromotionMove = (from: string, to: string): boolean => {
    if (!game) return false;
    const piece = game.get(from as any);
    if (!piece || piece.type !== 'p') return false;
    const toRank = to[1];
    return (piece.color === 'w' && toRank === '8') || (piece.color === 'b' && toRank === '1');
  };

  const executeMove = async (from: string, to: string, promotion: "q" | "r" | "b" | "n" = "q") => {
    if (!game) return;
    
    try {
      const move = game.move({ from, to, promotion });
      
      if (move) {
        // Track touch move for stats
        gameTouchMovesRef.current++;
        
        // Track response time for ALL games (universal stamina tracking)
        if (botMoveTimestampRef.current !== null) {
          const responseTime = Date.now() - botMoveTimestampRef.current;
          responseTimesRef.current.push(responseTime);
          botMoveTimestampRef.current = null;
        }
        
        // Track peek-free streak (blindfold only)
        if (isBlindfold) {
          if (!peekedSinceLastMoveRef.current) {
            const newStreak = peekFreeStreak + 1;
            setPeekFreeStreak(newStreak);
            if (newStreak > bestPeekFreeStreak) {
              setBestPeekFreeStreak(newStreak);
            }
          }
          peekedSinceLastMoveRef.current = false;
        }
        
        const newFen = game.fen();
        setFen(newFen);
        setLastMove({ from: move.from, to: move.to });
        
        const newMoves = [...movesRef.current, move.san];
        setMoves(newMoves);
        movesRef.current = newMoves;
        
        setSelectedSquare(null);
        setLegalMoves([]);
        
        if (game.isCheckmate()) {
          handleGameEnd(game.turn() === "w" ? "black_win" : "white_win");
        } else if (game.isDraw() || game.isStalemate() || game.isThreefoldRepetition() || game.isInsufficientMaterial()) {
          handleGameEnd("draw");
        }
      }
    } catch (e) {
      console.error("Invalid move:", e);
    }
  };

  const handleSquareClick = useCallback((square: string) => {
    if (!game || gameResult) return;
    
    const isMyTurn = (game.turn() === "w" && playerColor === "white") || 
                     (game.turn() === "b" && playerColor === "black");
    
    if (!isMyTurn) return;
    
    if (selectedSquare) {
      if (legalMoves.includes(square)) {
        if (isPromotionMove(selectedSquare, square)) {
          setPendingPromotion({ from: selectedSquare, to: square });
        } else {
          executeMove(selectedSquare, square);
        }
      } else {
        const piece = game.get(square as any);
        if (piece && ((piece.color === 'w' && playerColor === 'white') || (piece.color === 'b' && playerColor === 'black'))) {
          setSelectedSquare(square);
          const movesFromSquare = game.moves({ square: square as any, verbose: true });
          setLegalMoves(movesFromSquare.map(m => m.to));
        } else {
          setSelectedSquare(null);
          setLegalMoves([]);
        }
      }
    } else {
      const piece = game.get(square as any);
      if (piece && ((piece.color === 'w' && playerColor === 'white') || (piece.color === 'b' && playerColor === 'black'))) {
        setSelectedSquare(square);
        const movesFromSquare = game.moves({ square: square as any, verbose: true });
        setLegalMoves(movesFromSquare.map(m => m.to));
      }
    }
  }, [game, gameResult, playerColor, selectedSquare, legalMoves]);

  const handlePeekStart = () => {
    if (remainingPeeks <= 0) return;
    setIsPeeking(true);
    peekStartTimeRef.current = Date.now();
    peekedSinceLastMoveRef.current = true;
    // Reset current streak when peeking
    setPeekFreeStreak(0);
  };

  const handlePeekEnd = () => {
    if (isPeeking && remainingPeeks > 0) {
      setRemainingPeeks(prev => prev - 1);
      if (peekStartTimeRef.current) {
        const peekDuration = Date.now() - peekStartTimeRef.current;
        gamePeekTimeRef.current += peekDuration;
      }
    }
    setIsPeeking(false);
    peekStartTimeRef.current = null;
  };

  // Game history views - check FIRST so they work from any screen (title, menu, or game)
  if (viewingHistoryGame) {
    return (
      <HistoryGameReport
        game={viewingHistoryGame}
        open={true}
        onClose={() => {
          setViewingHistoryGame(null);
          setShowGameHistory(true);
        }}
        onAnalyze={(moves) => {
          setLastGameMoveHistory(moves);
          setViewingHistoryGame(null);
          setShowGameHistory(false);
          setShowAnalysis(true);
        }}
      />
    );
  }
  
  if (showGameHistory) {
    return (
      <GameHistory
        onBack={() => setShowGameHistory(false)}
        onViewGame={(game) => {
          setViewingHistoryGame(game);
        }}
      />
    );
  }

  // Analysis view - check BEFORE title screen so it works from game history
  if (showAnalysis && lastGameMoveHistory.length > 0) {
    return (
      <AnalysisView
        moveHistory={lastGameMoveHistory}
        playerColor={playerColor}
        gameResult={gameResult}
        botElo={selectedBotElo}
        onClose={() => {
          setShowAnalysis(false);
          setShowTitleScreen(true);
        }}
      />
    );
  }

  if (showTitleScreen) {
    return (
      <div 
        className="h-screen w-full flex flex-col items-center relative overflow-hidden"
        data-testid="screen-title"
      >
        <img 
          src={titleImage} 
          alt="Blindfold Chess" 
          className="absolute inset-0 w-full h-full object-cover object-center z-0"
        />
        <div className="relative z-10 flex flex-col items-center gap-2 p-6 pt-12 w-full">
          <h1 
            className="text-4xl md:text-5xl font-bold text-black text-center tracking-tight"
            data-testid="text-title"
          >
            Blindfold Chess
          </h1>
          <p className="text-black/70 text-center text-base md:text-lg">
            Train your visualization and memory
          </p>
        </div>
        <div className="flex-1" />
        <div className="relative z-10 flex flex-col items-center gap-3 p-6 pb-[120px] w-full max-w-sm">
          <Button 
            size="lg" 
            variant="ghost"
            className="w-full text-lg py-6 bg-amber-400 hover:bg-amber-500 text-stone-900 border border-amber-500 dark:bg-black dark:hover:bg-black/90 dark:text-white dark:border-black"
            onClick={() => onTrainNowClick?.()}
            data-testid="button-train-now"
          >
            <Dumbbell className="mr-2 h-5 w-5" />
            Train Now
          </Button>
          <Button 
            size="lg" 
            variant="ghost"
            className="w-full text-lg py-6 bg-amber-400 hover:bg-amber-500 text-stone-900 border border-amber-500 dark:bg-black dark:hover:bg-black/90 dark:text-white dark:border-black"
            onClick={() => setShowTitleScreen(false)}
            data-testid="button-start-now"
          >
            <Play className="mr-2 h-5 w-5" />
            Play Now
          </Button>
        </div>
      </div>
    );
  }

  if (!gameStarted) {
    const handleStartGameClick = async () => {
      const bot = getBotByElo(selectedBotElo);
      if (bot) {
        // Haptic thud for "entering battle"
        try {
          await Haptics.impact({ style: ImpactStyle.Heavy });
        } catch (e) {
          // Haptics not available (browser)
        }
        // Trigger fade-out transition
        setIsTransitioning(true);
        setTimeout(() => {
          handleStartGame(bot, selectedColor);
        }, 200);
      }
    };

    return (
      <div className={`h-full flex flex-col max-w-lg mx-auto px-4 py-2 transition-opacity duration-200 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}>
        <div className="flex items-center gap-3 mb-4">
          <Button variant="ghost" size="icon" onClick={() => setShowTitleScreen(true)} data-testid="button-setup-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Game Set-up</h1>
        </div>
        <Card className="flex flex-col">
          <CardContent className="overflow-y-auto pt-4 pb-2 space-y-3">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="blindfold-toggle">Blindfold Challenge</Label>
                <Switch
                  id="blindfold-toggle"
                  checked={isBlindfold}
                  onCheckedChange={setIsBlindfold}
                  className="data-[state=checked]:bg-amber-400 data-[state=unchecked]:bg-white border border-stone-300"
                  data-testid="switch-blindfold"
                />
              </div>
              
              {isBlindfold && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Blindfold Difficulty</Label>
                    <Select value={blindfoldDifficulty} onValueChange={(v) => setBlindFoldDifficulty(v as BlindFoldDifficulty)}>
                      <SelectTrigger data-testid="select-blindfold-difficulty">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="easy">Easy (Unlimited Peeks)</SelectItem>
                        <SelectItem value="medium">Medium (20 Peeks)</SelectItem>
                        <SelectItem value="hard">Hard (10 Peeks)</SelectItem>
                        <SelectItem value="expert">Expert (5 Peeks)</SelectItem>
                        <SelectItem value="master">Master (2 Peeks)</SelectItem>
                        <SelectItem value="grandmaster">Grandmaster (No Peeks)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Display Mode</Label>
                    <Select value={blindfoldDisplayMode} onValueChange={(v) => {
                      const mode = v as BlindFoldDisplayMode;
                      setBlindFoldDisplayMode(mode);
                      if (mode === "no_board") {
                        setShowCoordinates(false);
                        setVoiceInputEnabled(true);
                        setVoiceOutputEnabled(true);
                      }
                    }}>
                      <SelectTrigger data-testid="select-blindfold-display">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="empty_board">Empty Board</SelectItem>
                        <SelectItem value="black_overlay">Black Overlay</SelectItem>
                        <SelectItem value="no_board">No Board</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {blindfoldDisplayMode !== "no_board" && (
                    <div className="flex items-center justify-between">
                      <Label htmlFor="coordinates-toggle">Show Coordinates (1-8, a-h)</Label>
                      <Switch
                        id="coordinates-toggle"
                        checked={showCoordinates}
                        onCheckedChange={setShowCoordinates}
                        className="data-[state=checked]:bg-amber-400 data-[state=unchecked]:bg-white border border-stone-300"
                        data-testid="switch-coordinates"
                      />
                    </div>
                  )}
                  
                </div>
              )}
              
              <div className="flex items-center justify-between">
                <Label htmlFor="reconstruction-toggle" className="text-sm">
                  Board Reconstruction Challenge
                </Label>
                <Switch
                  id="reconstruction-toggle"
                  checked={blindfoldSettings.boardReconstructionEnabled}
                  onCheckedChange={(checked) => {
                    const newSettings = { ...blindfoldSettings, boardReconstructionEnabled: checked };
                    setBlindFoldSettings(newSettings);
                    saveSettings(newSettings);
                  }}
                  className="data-[state=checked]:bg-amber-400 data-[state=unchecked]:bg-white border border-stone-300"
                  data-testid="switch-board-reconstruction"
                />
              </div>
              {blindfoldSettings.boardReconstructionEnabled && (
                <p className="text-xs text-muted-foreground">
                  After each game, reconstruct the final position to test your memory.
                </p>
              )}
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mic className="h-4 w-4" />
                  <Label htmlFor="voice-input">Voice Input</Label>
                </div>
                <Switch
                  id="voice-input"
                  checked={voiceInputEnabled}
                  onCheckedChange={setVoiceInputEnabled}
                  className="data-[state=checked]:bg-amber-400 data-[state=unchecked]:bg-white border border-stone-300"
                  data-testid="switch-voice-input"
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Volume2 className="h-4 w-4" />
                  <Label htmlFor="voice-output">Voice Output</Label>
                </div>
                <Switch
                  id="voice-output"
                  checked={voiceOutputEnabled}
                  onCheckedChange={setVoiceOutputEnabled}
                  className="data-[state=checked]:bg-amber-400 data-[state=unchecked]:bg-white border border-stone-300"
                  data-testid="switch-voice-output"
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-0.5">
                  <Label htmlFor="bot-thinking-toggle" className="text-sm">Bot Thinking Time</Label>
                  <span className="text-xs text-muted-foreground">Human-like delays</span>
                </div>
                <Switch
                  id="bot-thinking-toggle"
                  checked={blindfoldSettings.botThinkingTimeEnabled}
                  onCheckedChange={(checked) => {
                    const newSettings = { ...blindfoldSettings, botThinkingTimeEnabled: checked };
                    setBlindFoldSettings(newSettings);
                    saveSettings(newSettings);
                  }}
                  className="data-[state=checked]:bg-amber-400 data-[state=unchecked]:bg-white border border-stone-300"
                  data-testid="switch-bot-thinking-time"
                />
              </div>
              
            </div>
            
            <div className="space-y-2">
              <Label>Time Control</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className={timeControl === "blitz" ? "bg-amber-400 border-amber-500 text-stone-900" : "bg-white text-stone-900"}
                  onClick={() => setTimeControl("blitz")}
                  data-testid="button-time-blitz"
                >
                  <Clock className="mr-1 h-3 w-3" />
                  5 min
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className={timeControl === "rapid" ? "bg-amber-400 border-amber-500 text-stone-900" : "bg-white text-stone-900"}
                  onClick={() => setTimeControl("rapid")}
                  data-testid="button-time-rapid"
                >
                  <Clock className="mr-1 h-3 w-3" />
                  15 min
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className={timeControl === "classical" ? "bg-amber-400 border-amber-500 text-stone-900" : "bg-white text-stone-900"}
                  onClick={() => setTimeControl("classical")}
                  data-testid="button-time-classical"
                >
                  <Clock className="mr-1 h-3 w-3" />
                  30 min
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className={timeControl === "practice" ? "bg-amber-400 border-amber-500 text-stone-900" : "bg-white text-stone-900"}
                  onClick={() => setTimeControl("practice")}
                  data-testid="button-time-practice"
                >
                  <InfinityIcon className="mr-1 h-3 w-3" />
                  Practice
                </Button>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Bot Rating</Label>
              <Select value={String(selectedBotElo)} onValueChange={(v) => setSelectedBotElo(Number(v))}>
                <SelectTrigger data-testid="select-bot-elo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALL_ELOS.map((elo) => (
                    <SelectItem key={elo} value={String(elo)}>
                      {elo} Elo
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Your Color</Label>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className={selectedColor === "white" ? "bg-amber-400 border-amber-500 text-stone-900" : "bg-white text-stone-900"}
                  onClick={() => setSelectedColor("white")}
                  data-testid="button-color-white"
                >
                  <div className="w-4 h-4 rounded-full bg-white border border-gray-400 mr-1" />
                  White
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className={selectedColor === "black" ? "bg-amber-400 border-amber-500 text-stone-900" : "bg-white text-stone-900"}
                  onClick={() => setSelectedColor("black")}
                  data-testid="button-color-black"
                >
                  <div className="w-4 h-4 rounded-full bg-gray-900 mr-1" />
                  Black
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className={selectedColor === "random" ? "bg-amber-400 border-amber-500 text-stone-900" : "bg-white text-stone-900"}
                  onClick={() => setSelectedColor("random")}
                  data-testid="button-color-random"
                >
                  <Shuffle className="w-4 h-4 mr-1" />
                  Random
                </Button>
              </div>
            </div>
            
          </CardContent>
          <div className="p-4 pt-2 border-t">
            <Button
              size="lg"
              className="w-full bg-amber-400 hover:bg-amber-500 text-stone-900 border border-black"
              onClick={handleStartGameClick}
              data-testid="button-start-game"
            >
              <Play className="mr-2 h-5 w-5" />
              Start Game
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto p-2 md:p-4 animate-in fade-in duration-300">
      {showReconstruction && reconstructionFen && (
        <div className="mb-3">
          <BoardReconstruction
            actualFen={reconstructionFen}
            playerColor={playerColor}
            onComplete={handleReconstructionComplete}
            onSkip={handleReconstructionSkip}
            onContinue={handleReconstructionContinue}
            onViewReport={() => setShowPostMortem(true)}
          />
        </div>
      )}
      
      <PostMortemReport
        open={showPostMortem && !showAnalysis}
        gameResult={gameResult}
        playerColor={playerColor}
        clarityScore={stats.lastClarityScore}
        responseTimes={lastGameResponseTimes}
        squareInquiries={lastGameSquareInquiries}
        reconstructionScore={lastReconstructionScore}
        reconstructionVoicePurity={lastReconstructionVoicePurity}
        reconstructionEnabled={blindfoldSettings.boardReconstructionEnabled}
        onRematch={() => {
          if (selectedBot) {
            const newColor = playerColor === "white" ? "black" : "white";
            setShowPostMortem(false);
            setShowAnalysis(false);
            resetGameState();
            setTimeout(() => handleStartGame(selectedBot, newColor), 100);
          }
        }}
        onMainMenu={() => {
          setShowPostMortem(false);
          setShowAnalysis(false);
          resetGameState();
        }}
        onAnalyze={() => {
          setShowAnalysis(true);
        }}
      />
      
      {showAnalysis && lastGameMoveHistory.length > 0 && (
        <AnalysisView
          moveHistory={lastGameMoveHistory}
          playerColor={playerColor}
          gameResult={gameResult}
          botElo={selectedBotElo}
          onClose={() => setShowAnalysis(false)}
        />
      )}
      
      {!showReconstruction && (
      <div className="space-y-2">
        <Card className={`lg:hidden ${game && ((playerColor === "white" && game.turn() === "b") || (playerColor === "black" && game.turn() === "w")) ? "ring-2 ring-amber-400" : ""}`}>
          <CardContent className="py-2 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${playerColor === "white" ? "bg-black" : "bg-white border border-gray-400"}`} />
                <Bot className="h-4 w-4 text-amber-500" />
                <span className="font-medium text-sm">
                  {selectedBot ? `${selectedBot.elo} Elo Bot` : "Bot"}
                </span>
                {botThinking && (
                  <span className={`text-xs animate-pulse ${extendedThinking ? 'text-amber-500 font-medium' : 'text-primary'}`}>
                    {extendedThinking ? 'Thinking...' : 'thinking...'}
                  </span>
                )}
              </div>
              <div className={`text-2xl font-mono font-bold ${
                game && ((playerColor === "white" && game.turn() === "b") || (playerColor === "black" && game.turn() === "w")) ? "text-foreground" : "text-muted-foreground"
              }`}>
                {formatTime(playerColor === "white" ? blackTime : whiteTime)}
              </div>
            </div>
          </CardContent>
        </Card>
        
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="flex flex-col gap-2">
            <Card className={`hidden lg:block ${game && ((playerColor === "white" && game.turn() === "b") || (playerColor === "black" && game.turn() === "w")) ? "ring-2 ring-amber-400" : ""}`}>
              <CardContent className="py-2 px-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${playerColor === "white" ? "bg-black" : "bg-white border border-gray-400"}`} />
                    <Bot className="h-4 w-4 text-amber-500" />
                    <span className="font-medium text-sm" data-testid="text-opponent-name">
                      {selectedBot ? `${selectedBot.elo} Elo Bot` : "Bot"}
                    </span>
                    {botThinking && (
                      <span className={`text-xs animate-pulse ${extendedThinking ? 'text-amber-500 font-medium' : 'text-primary'}`} data-testid="text-bot-thinking">
                        {extendedThinking ? 'Thinking...' : 'thinking...'}
                      </span>
                    )}
                  </div>
                  <div className={`text-2xl font-mono font-bold ${
                    game && ((playerColor === "white" && game.turn() === "b") || (playerColor === "black" && game.turn() === "w")) ? "text-foreground" : "text-muted-foreground"
                  }`} data-testid="text-opponent-time">
                    {formatTime(playerColor === "white" ? blackTime : whiteTime)}
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className={`aspect-square w-full max-w-full md:max-w-[600px] p-1 md:p-2 ${
              isBlindfold && blindfoldDisplayMode === "no_board" && !isPeeking ? "invisible" : ""
            }`}>
            <div className="relative w-full h-full">
              <ChessBoard 
                  fen={fen}
                  orientation={playerColor}
                  showCoordinates={isBlindfold && showCoordinates}
                  highlightedSquares={legalMoves}
                  lastMove={lastMove || undefined}
                  onSquareClick={handleSquareClick}
                  noCard={true}
                />
                
                {reconstructionCountdown !== null && (
                  <div 
                    className="absolute inset-0 flex items-center justify-center bg-black/60 z-50"
                    data-testid="overlay-reconstruction-countdown"
                    aria-live="polite"
                  >
                    <div className="text-center">
                      <div className="text-8xl md:text-9xl font-bold text-amber-400 animate-pulse" data-testid="text-countdown-number">
                        {reconstructionCountdown}
                      </div>
                      <div className="text-lg md:text-xl text-white mt-4 font-medium">
                        Memorize the position...
                      </div>
                    </div>
                  </div>
                )}
                
                {isBlindfold && !isPeeking && blindfoldDisplayMode === "empty_board" && (
                  <div className="absolute inset-0 pointer-events-none overflow-visible">
                    <div className="absolute inset-0 grid grid-cols-8 grid-rows-8">
                      {Array.from({ length: 64 }).map((_, i) => {
                        const row = Math.floor(i / 8);
                        const col = i % 8;
                        const isLight = (row + col) % 2 === 0;
                        const files = playerColor === "white" 
                          ? ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
                          : ['h', 'g', 'f', 'e', 'd', 'c', 'b', 'a'];
                        const ranks = playerColor === "white"
                          ? ['8', '7', '6', '5', '4', '3', '2', '1']
                          : ['1', '2', '3', '4', '5', '6', '7', '8'];
                        const showRank = col === 0;
                        const showFile = row === 7;
                        return (
                          <div
                            key={i}
                            className={`relative ${isLight ? 'bg-amber-100' : 'bg-amber-700'}`}
                          >
                            {showCoordinates && showRank && (
                              <span className={`absolute bottom-0.5 left-1 text-xs font-semibold select-none ${isLight ? 'text-amber-800/70' : 'text-amber-100/70'}`}>
                                {ranks[row]}
                              </span>
                            )}
                            {showCoordinates && showFile && (
                              <span className={`absolute bottom-0.5 right-1 text-xs font-semibold select-none ${isLight ? 'text-amber-800/70' : 'text-amber-100/70'}`}>
                                {files[col]}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                
                {isBlindfold && !isPeeking && blindfoldDisplayMode === "black_overlay" && (
                  <div className="absolute inset-0 bg-black pointer-events-none overflow-visible">
                    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 8 8" preserveAspectRatio="none">
                      {Array.from({ length: 9 }).map((_, i) => (
                        <line key={`h-${i}`} x1="0" y1={i} x2="8" y2={i} stroke="white" strokeWidth="0.02" />
                      ))}
                      {Array.from({ length: 9 }).map((_, i) => (
                        <line key={`v-${i}`} x1={i} y1="0" x2={i} y2="8" stroke="white" strokeWidth="0.02" />
                      ))}
                    </svg>
                    {showCoordinates && (
                      <div className="absolute inset-0 grid grid-cols-8 grid-rows-8">
                        {Array.from({ length: 64 }).map((_, i) => {
                          const row = Math.floor(i / 8);
                          const col = i % 8;
                          const files = playerColor === "white" 
                            ? ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
                            : ['h', 'g', 'f', 'e', 'd', 'c', 'b', 'a'];
                          const ranks = playerColor === "white"
                            ? ['8', '7', '6', '5', '4', '3', '2', '1']
                            : ['1', '2', '3', '4', '5', '6', '7', '8'];
                          const showRank = col === 0;
                          const showFile = row === 7;
                          return (
                            <div key={i} className="relative">
                              {showRank && (
                                <span className="absolute bottom-0.5 left-1 text-xs font-semibold select-none text-white/70">
                                  {ranks[row]}
                                </span>
                              )}
                              {showFile && (
                                <span className="absolute bottom-0.5 right-1 text-xs font-semibold select-none text-white/70">
                                  {files[col]}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Card>
            
            <Card className={`hidden lg:block ${game && ((playerColor === "white" && game.turn() === "w") || (playerColor === "black" && game.turn() === "b")) ? "ring-2 ring-amber-400" : ""}`}>
              <CardContent className="py-2 px-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${playerColor === "white" ? "bg-white border border-gray-400" : "bg-black"}`} />
                    <span className="font-medium text-sm" data-testid="text-player-name">You</span>
                  </div>
                  <div className={`text-2xl font-mono font-bold ${
                    game && ((playerColor === "white" && game.turn() === "w") || (playerColor === "black" && game.turn() === "b")) ? "text-foreground" : "text-muted-foreground"
                  }`} data-testid="text-player-time">
                    {formatTime(playerColor === "white" ? whiteTime : blackTime)}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <div className="flex flex-col gap-2 lg:w-48">
            {isBlindfold && blindfoldDifficulty !== 'grandmaster' && (
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
                data-testid="button-peek"
              >
                <Eye className="mr-2 h-4 w-4" />
                {isPeeking ? "Peeking..." : "Hold to Peek"}
              </Button>
            )}
            
            {isBlindfold && (
              <div className="text-center text-sm text-muted-foreground" data-testid="text-peeks-remaining">
                {isFinite(remainingPeeks) ? `${remainingPeeks} peeks left` : "Unlimited peeks"}
              </div>
            )}
            
            {isBlindfold && (
              <div className="text-center text-sm" data-testid="text-peek-free-streak">
                <span className="text-muted-foreground">Streak: </span>
                <span className="font-semibold text-amber-500">{peekFreeStreak}</span>
                {bestPeekFreeStreak > 0 && (
                  <span className="text-muted-foreground/70 text-xs ml-1">(best: {bestPeekFreeStreak})</span>
                )}
              </div>
            )}
            
            {voiceInputEnabled && (
              <div className="flex items-center justify-center gap-2 text-sm">
                {awaitingDisambiguation ? (
                  <>
                    <Mic className="h-4 w-4 text-amber-500 animate-pulse" />
                    <span className="text-amber-500">Which piece?</span>
                  </>
                ) : isVoiceListening ? (
                  <>
                    <Mic className="h-4 w-4 text-primary animate-pulse" />
                    <span className="text-primary">Listening...</span>
                  </>
                ) : (
                  <>
                    <MicOff className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Voice paused</span>
                  </>
                )}
              </div>
            )}
            
            {voiceTranscript && (
              <div className={`text-xs text-center ${awaitingDisambiguation ? 'text-amber-500 font-medium' : 'text-muted-foreground'}`}>
                {awaitingDisambiguation ? voiceTranscript : `Heard: "${voiceTranscript}"`}
              </div>
            )}
            
            <Card className={`lg:hidden ${game && ((playerColor === "white" && game.turn() === "w") || (playerColor === "black" && game.turn() === "b")) ? "ring-2 ring-amber-400" : ""}`}>
              <CardContent className="py-2 px-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${playerColor === "white" ? "bg-white border border-gray-400" : "bg-black"}`} />
                    <span className="font-medium text-sm">You</span>
                  </div>
                  <div className={`text-2xl font-mono font-bold ${
                    game && ((playerColor === "white" && game.turn() === "w") || (playerColor === "black" && game.turn() === "b")) ? "text-foreground" : "text-muted-foreground"
                  }`}>
                    {formatTime(playerColor === "white" ? whiteTime : blackTime)}
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="flex-1">
              <CardContent className="p-2">
                <ScrollArea className="h-24 lg:h-48">
                  <div className="text-xs font-mono space-y-1">
                    {moves.map((move, i) => (
                      <span key={i} className={i % 2 === 0 ? "font-semibold" : ""}>
                        {i % 2 === 0 && <span className="text-muted-foreground">{Math.floor(i/2) + 1}. </span>}
                        {move}{" "}
                      </span>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
            
            {!gameResult && (
              <Button
                variant="outline"
                size="sm"
                className="w-full text-red-600 border-red-300 hover:bg-red-50"
                onClick={() => setShowResignConfirm(true)}
                data-testid="button-resign"
              >
                <Flag className="mr-2 h-4 w-4" />
                Resign
              </Button>
            )}
          </div>
        </div>
      </div>
      )}
      
      <PromotionDialog
        open={!!pendingPromotion}
        color={playerColor}
        onSelect={(piece) => {
          if (pendingPromotion) {
            executeMove(pendingPromotion.from, pendingPromotion.to, piece);
            setPendingPromotion(null);
          }
        }}
      />
      
      <AlertDialog open={showResignConfirm} onOpenChange={setShowResignConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resign Game?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to resign? This will count as a loss.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-resign-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                const result = playerColor === "white" ? "black_win" : "white_win";
                handleGameEnd(result);
                setShowResignConfirm(false);
              }}
              data-testid="button-resign-confirm"
            >
              Resign
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
