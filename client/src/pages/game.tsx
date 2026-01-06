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
import { Clock, Play, Eye, Bot, ChevronLeft, Shuffle, Crown, Trophy, RotateCcw, Mic, MicOff, Volume2, VolumeX, Infinity as InfinityIcon, Flag, Home, BarChart3, RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import titleImage from "@assets/title_cropped.jpg";
import { voiceRecognition, speak, moveToSpeech, speechToMoveWithAmbiguity, parseDisambiguation, findMoveByDisambiguation, getSourceSquaresFromCandidates, type AmbiguousMoveResult } from "@/lib/voice";
import { generateBotMoveClient, countBotPieces, detectRecapture, LastMoveInfo, clearPositionHistory, recordPosition } from "@/lib/botEngine";
import { loadStats, recordGameResult, getAveragePeekTime, formatPeekTime, resetStats, type GameStats } from "@/lib/gameStats";
import { clientStockfish } from "@/lib/stockfish";
import type { BotProfile, BotDifficulty, BotPersonality } from "@shared/botTypes";
import { 
  ALL_DIFFICULTIES, 
  ALL_PERSONALITIES, 
  BOTS,
  BOT_DIFFICULTY_ELO, 
  BOT_DIFFICULTY_NAMES,
  BOT_PERSONALITY_NAMES,
  BOT_PERSONALITY_DESCRIPTIONS,
  BOT_PERSONALITY_ICONS,
  getBotByConfig 
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

export default function GamePage() {
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
  const [timeControl, setTimeControl] = useState<TimeControlOption>("blitz");
  
  const [isBlindfold, setIsBlindfold] = useState(false);
  const [blindfoldDifficulty, setBlindFoldDifficulty] = useState<BlindFoldDifficulty>("medium");
  const [blindfoldDisplayMode, setBlindFoldDisplayMode] = useState<BlindFoldDisplayMode>("empty_board");
  const [showCoordinates, setShowCoordinates] = useState(true);
  const [remainingPeeks, setRemainingPeeks] = useState<number>(Number.POSITIVE_INFINITY);
  const [isPeeking, setIsPeeking] = useState(false);
  const peekStartTimeRef = useRef<number | null>(null);
  const gamePeekTimeRef = useRef<number>(0);
  
  const [stats, setStats] = useState<GameStats>(() => loadStats());
  
  const [selectedBot, setSelectedBot] = useState<BotProfile | null>(null);
  const [botThinking, setBotThinking] = useState(false);
  const [selectedBotDifficulty, setSelectedBotDifficulty] = useState<BotDifficulty>("club");
  const [selectedBotPersonalityType, setSelectedBotPersonalityType] = useState<BotPersonality>("balanced");
  const [selectedColor, setSelectedColor] = useState<"white" | "black" | "random">("white");
  
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
  
  const gameRef = useRef<Chess | null>(null);
  const whiteTimeRef = useRef(300);
  const blackTimeRef = useRef(300);
  const movesRef = useRef<string[]>([]);
  const clockIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isTtsSpeaking = useRef(false);
  
  useEffect(() => {
    return () => {
      clientStockfish.stopAnalysis();
      if (clockIntervalRef.current) {
        clearInterval(clockIntervalRef.current);
      }
    };
  }, []);
  
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
    clearPositionHistory();
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
  }, []);

  const handleGameEnd = useCallback((result: "white_win" | "black_win" | "draw") => {
    if (clockIntervalRef.current) {
      clearInterval(clockIntervalRef.current);
      clockIntervalRef.current = null;
    }
    setGameResult(result);
    voiceRecognition.stop();
    
    const playerWon = (result === "white_win" && playerColor === "white") || 
                     (result === "black_win" && playerColor === "black");
    const message = result === "draw" ? "Game drawn" : playerWon ? "You win!" : "You lose";
    
    const statsResult = result === "draw" ? "draw" : playerWon ? "win" : "loss";
    const newStats = recordGameResult(statsResult, gamePeekTimeRef.current);
    setStats(newStats);
    window.dispatchEvent(new CustomEvent('statsUpdated'));
    
    if (voiceOutputEnabled) {
      speak(message);
    }
  }, [playerColor, voiceOutputEnabled]);

  const requestBotMove = useCallback(async (currentFen: string, botId: string, moveHistorySAN?: string[], lastMoveInfo?: LastMoveInfo) => {
    if (!botId) return null;
    
    setBotThinking(true);
    
    try {
      const parts = botId.split('_');
      if (parts.length < 3) {
        throw new Error("Invalid bot ID format");
      }
      
      const difficulty = parts[1] as BotDifficulty;
      const personality = parts.slice(2).join('_') as BotPersonality;
      
      const botRemainingTime = playerColor === 'white' ? blackTimeRef.current : whiteTimeRef.current;
      const moveCount = moveHistorySAN?.length || 0;
      
      const result = await generateBotMoveClient(
        currentFen,
        personality,
        difficulty,
        botRemainingTime * 1000,
        moveCount,
        lastMoveInfo
      );
      
      if (!result) {
        throw new Error("Bot failed to generate move");
      }
      
      let thinkDelay: number;
      
      if (result.isFreeCapture) {
        thinkDelay = 2000;
      } else {
        const moveNumber = Math.ceil((moveCount + 2) / 2);
        const botColor: 'white' | 'black' = playerColor === 'white' ? 'black' : 'white';
        thinkDelay = getBotMoveDelay(moveNumber, botRemainingTime, currentFen, botColor, lastMoveInfo);
      }
      await delay(thinkDelay);
      
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
    }
  }, [toast, playerColor]);

  const handleStartGame = async (bot: BotProfile, colorChoice: "white" | "black" | "random") => {
    gamePeekTimeRef.current = 0;
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
    
    if (assignedColor === "black") {
      const botMove = await requestBotMove(newGame.fen(), bot.id);
      if (botMove && gameRef.current) {
        const moveResult = gameRef.current.move(botMove.move);
        if (moveResult) {
          setLastMove({ from: moveResult.from, to: moveResult.to });
          recordPosition(gameRef.current.fen());
        }
        setFen(gameRef.current.fen());
        const newMoves = [botMove.move];
        setMoves(newMoves);
        movesRef.current = newMoves;
        
        if (voiceOutputEnabled) {
          const spokenMove = moveToSpeech(botMove.move, botMove.move.includes('x'), gameRef.current.isCheck(), false);
          lastSpokenMove.current = spokenMove;
          speak(spokenMove);
        }
      }
    }
  };

  useEffect(() => {
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
  }, [gameStarted, game, handleGameEnd, timeControl]);

  useEffect(() => {
    if (!voiceInputEnabled) {
      voiceRecognition.stop();
      return;
    }
    
    if (!gameStarted || !gameRef.current || gameResult !== null) {
      voiceRecognition.stop();
      return;
    }
    
    voiceRecognition.setOnResult(async (move, transcript) => {
      const currentGame = gameRef.current;
      if (!currentGame) return;
      
      setVoiceTranscript(transcript);
      
      const lowerTranscript = transcript.toLowerCase();
      if (lowerTranscript.includes("repeat") || lowerTranscript.includes("say again") || lowerTranscript.includes("what was that") || lowerTranscript.includes("again")) {
        if (lastSpokenMove.current && voiceOutputEnabled) {
          isTtsSpeaking.current = true;
          voiceRecognition.stop();
          try {
            await speak(lastSpokenMove.current);
          } catch (e) {
            console.error('[Voice] TTS error:', e);
          } finally {
            isTtsSpeaking.current = false;
            setVoiceRestartTrigger(prev => prev + 1);
          }
        }
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
            
            if (voiceOutputEnabled) {
              isTtsSpeaking.current = true;
              voiceRecognition.stop();
              const spokenMove = moveToSpeech(matchingMove, matchingMove.includes('x'), false, false);
              lastSpokenMove.current = spokenMove;
              try {
                await speak(spokenMove);
              } catch (e) {
                console.error('[Voice] TTS error:', e);
              } finally {
                isTtsSpeaking.current = false;
              }
            }
            
            if (!gameRef.current) return;
            const moveObj = gameRef.current.move(matchingMove);
            if (moveObj) {
              setFen(gameRef.current.fen());
              setLastMove({ from: moveObj.from, to: moveObj.to });
              recordPosition(gameRef.current.fen());
              
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
        
        if (voiceOutputEnabled) {
          isTtsSpeaking.current = true;
          voiceRecognition.stop();
          try {
            await speak("I didn't catch that. Which piece?");
          } catch (e) {
            console.error('[Voice] TTS error:', e);
          } finally {
            isTtsSpeaking.current = false;
          }
        }
        
        disambiguationTimeoutRef.current = setTimeout(async () => {
          setAwaitingDisambiguation(null);
          setVoiceTranscript(null);
          if (voiceOutputEnabled) {
            isTtsSpeaking.current = true;
            voiceRecognition.stop();
            try {
              await speak("Move cancelled");
            } catch (e) {
              console.error('[Voice] TTS error:', e);
            } finally {
              isTtsSpeaking.current = false;
              setVoiceRestartTrigger(prev => prev + 1);
            }
          } else {
            setVoiceRestartTrigger(prev => prev + 1);
          }
        }, 10000);
        return;
      }
      
      const allLegalMoves = currentGame.moves();
      const result = speechToMoveWithAmbiguity(transcript, allLegalMoves);
      
      if (result.move) {
        if (voiceOutputEnabled) {
          isTtsSpeaking.current = true;
          voiceRecognition.stop();
          const spokenMove = moveToSpeech(result.move, result.move.includes('x'), false, false);
          lastSpokenMove.current = spokenMove;
          try {
            await speak(spokenMove);
          } catch (e) {
            console.error('[Voice] TTS error:', e);
          } finally {
            isTtsSpeaking.current = false;
          }
        }
        
        if (!gameRef.current) return;
        const moveObj = gameRef.current.move(result.move);
        if (moveObj) {
          setFen(gameRef.current.fen());
          setLastMove({ from: moveObj.from, to: moveObj.to });
          recordPosition(gameRef.current.fen());
          
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
        
        if (voiceOutputEnabled) {
          isTtsSpeaking.current = true;
          voiceRecognition.stop();
          try {
            await speak(prompt);
          } catch (e) {
            console.error('[Voice] TTS error:', e);
          } finally {
            isTtsSpeaking.current = false;
          }
        }
        
        disambiguationTimeoutRef.current = setTimeout(async () => {
          setAwaitingDisambiguation(null);
          setVoiceTranscript(null);
          if (voiceOutputEnabled) {
            isTtsSpeaking.current = true;
            voiceRecognition.stop();
            try {
              await speak("Move cancelled");
            } catch (e) {
              console.error('[Voice] TTS error:', e);
            } finally {
              isTtsSpeaking.current = false;
              setVoiceRestartTrigger(prev => prev + 1);
            }
          } else {
            setVoiceRestartTrigger(prev => prev + 1);
          }
        }, 10000);
      } else {
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
    
    if (isMyTurn && !botThinking && !pendingPromotion && gameResult === null && !isTtsSpeaking.current) {
      const allLegalMoves = currentGame.moves();
      voiceRecognition.setLegalMoves(allLegalMoves);
      voiceRecognition.start();
    } else {
      voiceRecognition.stop();
    }
    
    return () => {
      voiceRecognition.reset();
      if (disambiguationTimeoutRef.current) {
        clearTimeout(disambiguationTimeoutRef.current);
        disambiguationTimeoutRef.current = null;
      }
    };
  }, [voiceInputEnabled, gameStarted, fen, playerColor, botThinking, pendingPromotion, gameResult, voiceOutputEnabled, toast, handleGameEnd, awaitingDisambiguation, voiceRestartTrigger]);

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
            recordPosition(gameRef.current.fen());
          }
          const botNewFen = gameRef.current.fen();
          setFen(botNewFen);
          const updatedMoves = [...movesRef.current, botMove.move];
          setMoves(updatedMoves);
          movesRef.current = updatedMoves;
          
          if (voiceOutputEnabled) {
            isTtsSpeaking.current = true;
            voiceRecognition.stop();
            
            const isCheck = gameRef.current.isCheck();
            const isCheckmate = gameRef.current.isCheckmate();
            const isCapture = botMove.move.includes('x');
            const spokenMove = moveToSpeech(botMove.move, isCapture, isCheck, isCheckmate);
            lastSpokenMove.current = spokenMove;
            
            try {
              await speak(spokenMove);
            } catch (e) {
              console.error('[Voice] TTS error:', e);
            } finally {
              isTtsSpeaking.current = false;
              
              if (gameRef.current && !gameRef.current.isGameOver() && voiceInputEnabled) {
                const currentTurn = gameRef.current.turn();
                const isMyTurn = (currentTurn === "w" && playerColor === "white") || (currentTurn === "b" && playerColor === "black");
                if (isMyTurn) {
                  voiceRecognition.setLegalMoves(gameRef.current.moves());
                  voiceRecognition.start();
                }
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
        const newFen = game.fen();
        setFen(newFen);
        setLastMove({ from: move.from, to: move.to });
        recordPosition(newFen);
        
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
        <div className="absolute inset-0 bg-gradient-to-b from-white/80 via-transparent to-white/90 z-[1]" />
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
        <div className="relative z-10 flex flex-col items-center p-6 pb-[120px] w-full max-w-sm">
          <Button 
            size="lg" 
            variant="ghost"
            className="w-full text-lg py-6 bg-black text-white hover:bg-black/90 !border-black"
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
    const handleStartGameClick = () => {
      const bot = getBotByConfig(selectedBotDifficulty, selectedBotPersonalityType);
      if (bot) {
        handleStartGame(bot, selectedColor);
      }
    };

    return (
      <div className="container max-w-lg mx-auto p-4">
        <Card>
          <CardContent className="pt-6 space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="blindfold-toggle">Blindfold Mode</Label>
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
            </div>
            
            <div className="space-y-2">
              <Label>Time Control</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className={timeControl === "blitz" ? "bg-amber-200 border-amber-400 text-stone-900" : "bg-white text-stone-900"}
                  onClick={() => setTimeControl("blitz")}
                  data-testid="button-time-blitz"
                >
                  <Clock className="mr-1 h-3 w-3" />
                  5 min
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className={timeControl === "rapid" ? "bg-amber-200 border-amber-400 text-stone-900" : "bg-white text-stone-900"}
                  onClick={() => setTimeControl("rapid")}
                  data-testid="button-time-rapid"
                >
                  <Clock className="mr-1 h-3 w-3" />
                  15 min
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className={timeControl === "classical" ? "bg-amber-200 border-amber-400 text-stone-900" : "bg-white text-stone-900"}
                  onClick={() => setTimeControl("classical")}
                  data-testid="button-time-classical"
                >
                  <Clock className="mr-1 h-3 w-3" />
                  30 min
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className={timeControl === "practice" ? "bg-amber-200 border-amber-400 text-stone-900" : "bg-white text-stone-900"}
                  onClick={() => setTimeControl("practice")}
                  data-testid="button-time-practice"
                >
                  <InfinityIcon className="mr-1 h-3 w-3" />
                  Practice
                </Button>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Bot Difficulty</Label>
              <Select value={selectedBotDifficulty} onValueChange={(v) => setSelectedBotDifficulty(v as BotDifficulty)}>
                <SelectTrigger data-testid="select-bot-difficulty">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALL_DIFFICULTIES.map((difficulty) => (
                    <SelectItem key={difficulty} value={difficulty}>
                      {BOT_DIFFICULTY_ELO[difficulty]} Elo
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Playstyle</Label>
              <Select value={selectedBotPersonalityType} onValueChange={(v) => setSelectedBotPersonalityType(v as BotPersonality)}>
                <SelectTrigger data-testid="select-bot-playstyle">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALL_PERSONALITIES.map((personality) => (
                    <SelectItem key={personality} value={personality}>
                      {BOT_PERSONALITY_NAMES[personality]}
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
                  className={selectedColor === "white" ? "bg-amber-200 border-amber-400 text-stone-900" : "bg-white text-stone-900"}
                  onClick={() => setSelectedColor("white")}
                  data-testid="button-color-white"
                >
                  <div className="w-4 h-4 rounded-full bg-white border border-gray-400 mr-1" />
                  White
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className={selectedColor === "black" ? "bg-amber-200 border-amber-400 text-stone-900" : "bg-white text-stone-900"}
                  onClick={() => setSelectedColor("black")}
                  data-testid="button-color-black"
                >
                  <div className="w-4 h-4 rounded-full bg-gray-900 mr-1" />
                  Black
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className={selectedColor === "random" ? "bg-amber-200 border-amber-400 text-stone-900" : "bg-white text-stone-900"}
                  onClick={() => setSelectedColor("random")}
                  data-testid="button-color-random"
                >
                  <Shuffle className="w-4 h-4 mr-1" />
                  Random
                </Button>
              </div>
            </div>
            
            <Button
              size="lg"
              className="w-full bg-amber-400 hover:bg-amber-500 text-stone-900"
              onClick={handleStartGameClick}
              data-testid="button-start-game"
            >
              <Play className="mr-2 h-5 w-5" />
              Start Game
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto p-2 md:p-4">
      {gameResult && (
        <Card className="mb-3 border-amber-400 bg-amber-100/50">
          <CardContent className="py-4">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Trophy className="h-6 w-6 text-amber-500" />
                  <div>
                    <p className="font-semibold text-lg">Game Over</p>
                    <p className="text-sm text-muted-foreground">
                      {gameResult === "draw" 
                        ? "Game drawn" 
                        : gameResult === "white_win" 
                          ? (playerColor === "white" ? "You win!" : "Bot wins") 
                          : (playerColor === "black" ? "You win!" : "Bot wins")}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="default"
                  size="sm"
                  className="bg-amber-400 hover:bg-amber-500 text-stone-900"
                  onClick={() => {
                    if (selectedBot) {
                      const newColor = playerColor === "white" ? "black" : "white";
                      resetGameState();
                      setTimeout(() => handleStartGame(selectedBot, newColor), 100);
                    }
                  }}
                  data-testid="button-rematch"
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Rematch
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetGameState}
                  data-testid="button-main-menu"
                >
                  <Home className="mr-2 h-4 w-4" />
                  Back to Menu
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      <div className="space-y-2">
        <Card className={`${game && ((playerColor === "white" && game.turn() === "b") || (playerColor === "black" && game.turn() === "w")) ? "ring-2 ring-amber-400" : ""}`}>
          <CardContent className="py-2 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${playerColor === "white" ? "bg-black" : "bg-white border border-gray-400"}`} />
                <Bot className="h-4 w-4 text-amber-500" />
                <span className="font-medium text-sm" data-testid="text-opponent-name">
                  {selectedBot ? `${selectedBot.elo} ${BOT_PERSONALITY_NAMES[selectedBot.personality]}` : "Bot"}
                </span>
                {botThinking && (
                  <span className="text-xs text-primary animate-pulse" data-testid="text-bot-thinking">
                    thinking...
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
        
        <div className="flex flex-col lg:flex-row gap-3">
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
          
          <div className="flex flex-col gap-2 lg:w-48">
            {isBlindfold && blindfoldDifficulty !== 'grandmaster' && (
              <Button
                variant={isPeeking ? "default" : "outline"}
                className="w-full"
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
        
        <Card className={`${game && ((playerColor === "white" && game.turn() === "w") || (playerColor === "black" && game.turn() === "b")) ? "ring-2 ring-amber-400" : ""}`}>
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
