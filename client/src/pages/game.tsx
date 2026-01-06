import { useState, useEffect, useRef, useCallback } from "react";
import { Chess } from "chess.js";
import { ChessBoard } from "@/components/chess-board";
import { PromotionDialog } from "@/components/promotion-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Clock, Play, Eye, Bot, ChevronLeft, Shuffle, Crown, Trophy, RotateCcw, Mic, MicOff, Volume2, VolumeX, Infinity as InfinityIcon } from "lucide-react";
import { voiceRecognition, speak, moveToSpeech } from "@/lib/voice";
import { generateBotMoveClient, countBotPieces, detectRecapture, LastMoveInfo, clearPositionHistory, recordPosition } from "@/lib/botEngine";
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
type TimeControlOption = "practice" | "blitz" | "rapid";

export default function GamePage() {
  const { toast } = useToast();
  
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
  const [remainingPeeks, setRemainingPeeks] = useState<number>(Number.POSITIVE_INFINITY);
  const [isPeeking, setIsPeeking] = useState(false);
  const [showCoordinates, setShowCoordinates] = useState(true);
  const peekStartTimeRef = useRef<number | null>(null);
  
  const [selectedBot, setSelectedBot] = useState<BotProfile | null>(null);
  const [botThinking, setBotThinking] = useState(false);
  const [selectedBotDifficulty, setSelectedBotDifficulty] = useState<BotDifficulty | null>(null);
  const [selectedBotPersonality, setSelectedBotPersonality] = useState<BotProfile | null>(null);
  
  const [voiceInputEnabled, setVoiceInputEnabled] = useState(false);
  const [voiceOutputEnabled, setVoiceOutputEnabled] = useState(false);
  const [isVoiceListening, setIsVoiceListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState<string | null>(null);
  
  const [pendingPromotion, setPendingPromotion] = useState<{ from: string; to: string } | null>(null);
  
  const gameRef = useRef<Chess | null>(null);
  const whiteTimeRef = useRef(300);
  const blackTimeRef = useRef(300);
  const movesRef = useRef<string[]>([]);
  const clockIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
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
    setSelectedBotDifficulty(null);
    setSelectedBotPersonality(null);
    setBotThinking(false);
    setIsPeeking(false);
    voiceRecognition.stop();
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
    
    if (voiceOutputEnabled) {
      speak(message);
    }
    
    toast({
      title: "Game Over",
      description: message,
    });
  }, [playerColor, voiceOutputEnabled, toast]);

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
    setSelectedBotDifficulty(null);
    setSelectedBotPersonality(null);
    
    const assignedColor = colorChoice === "random" 
      ? (Math.random() < 0.5 ? "white" : "black")
      : colorChoice;
    setPlayerColor(assignedColor);
    
    const seconds = timeControl === "practice" ? 99999999 : (timeControl === "blitz" ? 300 : 900);
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
    
    voiceRecognition.setOnResult((move, transcript) => {
      const currentGame = gameRef.current;
      if (!currentGame) return;
      
      setVoiceTranscript(transcript);
      
      if (move) {
        if (voiceOutputEnabled) {
          speak(moveToSpeech(move, move.includes('x'), false, false));
        }
        
        setTimeout(() => {
          if (!gameRef.current) return;
          const moveObj = gameRef.current.move(move);
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
        }, 500);
      } else {
        toast({
          title: "Didn't understand",
          description: `Heard: "${transcript}". Try again.`,
          variant: "destructive",
        });
      }
    });
    
    voiceRecognition.setOnListeningChange(setIsVoiceListening);
    
    const currentGame = gameRef.current;
    const currentTurn = currentGame.turn();
    const isMyTurn = (currentTurn === "w" && playerColor === "white") || (currentTurn === "b" && playerColor === "black");
    
    if (isMyTurn && !botThinking && !pendingPromotion && gameResult === null) {
      const allLegalMoves = currentGame.moves();
      voiceRecognition.setLegalMoves(allLegalMoves);
      voiceRecognition.start();
    } else {
      voiceRecognition.stop();
    }
    
    return () => {
      voiceRecognition.reset();
    };
  }, [voiceInputEnabled, gameStarted, fen, playerColor, botThinking, pendingPromotion, gameResult, voiceOutputEnabled, toast, handleGameEnd]);

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
      
      requestBotMove(currentFen, selectedBot.id, moveHistorySAN, lastMoveInfo).then((botMove) => {
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
            const isCheck = gameRef.current.isCheck();
            const isCheckmate = gameRef.current.isCheckmate();
            const isCapture = botMove.move.includes('x');
            const spokenMove = moveToSpeech(botMove.move, isCapture, isCheck, isCheckmate);
            speak(spokenMove);
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
  }, [fen, selectedBot, playerColor, gameStarted, botThinking, gameResult, voiceOutputEnabled, requestBotMove, handleGameEnd, lastMove]);

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
    }
    setIsPeeking(false);
    peekStartTimeRef.current = null;
  };

  if (!gameStarted) {
    return (
      <div className="container max-w-lg mx-auto p-4">
        <Card>
          <CardContent className="pt-6 space-y-6">
            {!selectedBotDifficulty ? (
              <>
                <div className="space-y-4">
                  <h2 className="text-xl font-semibold">Game Settings</h2>
                  
                  <div className="flex items-center justify-between">
                    <Label htmlFor="blindfold-toggle">Blindfold Mode</Label>
                    <Switch
                      id="blindfold-toggle"
                      checked={isBlindfold}
                      onCheckedChange={setIsBlindfold}
                      data-testid="switch-blindfold"
                    />
                  </div>
                  
                  {isBlindfold && (
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
                      
                      <div className="flex items-center justify-between">
                        <Label htmlFor="coords-toggle">Show Coordinates</Label>
                        <Switch
                          id="coords-toggle"
                          checked={showCoordinates}
                          onCheckedChange={setShowCoordinates}
                          data-testid="switch-coordinates"
                        />
                      </div>
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
                      data-testid="switch-voice-output"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Time Control</Label>
                  <div className="flex gap-2">
                    <Button
                      variant={timeControl === "blitz" ? "default" : "outline"}
                      size="sm"
                      className="flex-1"
                      onClick={() => setTimeControl("blitz")}
                      data-testid="button-time-blitz"
                    >
                      <Clock className="mr-1 h-3 w-3" />
                      5 min
                    </Button>
                    <Button
                      variant={timeControl === "rapid" ? "default" : "outline"}
                      size="sm"
                      className="flex-1"
                      onClick={() => setTimeControl("rapid")}
                      data-testid="button-time-rapid"
                    >
                      <Clock className="mr-1 h-3 w-3" />
                      15 min
                    </Button>
                    <Button
                      variant={timeControl === "practice" ? "default" : "outline"}
                      size="sm"
                      className="flex-1"
                      onClick={() => setTimeControl("practice")}
                      data-testid="button-time-practice"
                    >
                      <InfinityIcon className="mr-1 h-3 w-3" />
                      Practice
                    </Button>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">Select Bot Difficulty</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {ALL_DIFFICULTIES.map((difficulty) => (
                      <Card 
                        key={difficulty}
                        className="cursor-pointer hover-elevate"
                        onClick={() => setSelectedBotDifficulty(difficulty)}
                        data-testid={`card-difficulty-${difficulty}`}
                      >
                        <CardContent className="p-3">
                          <div className="flex flex-col">
                            <span className="font-medium text-sm">{BOT_DIFFICULTY_NAMES[difficulty]}</span>
                            <span className="text-xs text-muted-foreground">{BOT_DIFFICULTY_ELO[difficulty]} Elo</span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </>
            ) : !selectedBotPersonality ? (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelectedBotDifficulty(null)}
                    data-testid="button-back-from-personality"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <h2 className="text-lg font-semibold">Select Playstyle</h2>
                  <Badge variant="secondary" className="ml-auto">
                    {BOT_DIFFICULTY_ELO[selectedBotDifficulty]} Elo
                  </Badge>
                </div>
                
                <div className="grid grid-cols-1 gap-2">
                  {ALL_PERSONALITIES.map((personality) => {
                    const bot = getBotByConfig(selectedBotDifficulty, personality);
                    if (!bot) return null;
                    return (
                      <Card 
                        key={personality}
                        className="cursor-pointer hover-elevate"
                        onClick={() => setSelectedBotPersonality(bot)}
                        data-testid={`card-personality-${personality}`}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarFallback className="bg-primary/10 text-primary font-bold text-lg">
                                {BOT_PERSONALITY_ICONS[personality]}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <span className="font-semibold">{BOT_PERSONALITY_NAMES[personality]}</span>
                              <p className="text-xs text-muted-foreground">
                                {BOT_PERSONALITY_DESCRIPTIONS[personality]}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelectedBotPersonality(null)}
                    data-testid="button-back-from-color"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <h2 className="text-lg font-semibold">Choose Your Color</h2>
                </div>
                
                <p className="text-sm text-muted-foreground mb-4">
                  Playing against {selectedBotPersonality.name}
                </p>
                
                <div className="grid grid-cols-1 gap-3">
                  <Card 
                    className="cursor-pointer hover-elevate"
                    onClick={() => handleStartGame(selectedBotPersonality, "white")}
                    data-testid="card-color-white"
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-white border-2 border-gray-300 flex items-center justify-center">
                          <Crown className="h-6 w-6 text-gray-700" />
                        </div>
                        <div>
                          <span className="font-semibold text-lg">Play as White</span>
                          <p className="text-sm text-muted-foreground">You move first</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card 
                    className="cursor-pointer hover-elevate"
                    onClick={() => handleStartGame(selectedBotPersonality, "black")}
                    data-testid="card-color-black"
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-gray-900 border-2 border-gray-700 flex items-center justify-center">
                          <Crown className="h-6 w-6 text-white" />
                        </div>
                        <div>
                          <span className="font-semibold text-lg">Play as Black</span>
                          <p className="text-sm text-muted-foreground">Bot moves first</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card 
                    className="cursor-pointer hover-elevate"
                    onClick={() => handleStartGame(selectedBotPersonality, "random")}
                    data-testid="card-color-random"
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-r from-white to-gray-900 border-2 border-gray-500 flex items-center justify-center">
                          <Shuffle className="h-6 w-6 text-gray-500" />
                        </div>
                        <div>
                          <span className="font-semibold text-lg">Random</span>
                          <p className="text-sm text-muted-foreground">Let fate decide</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto p-2 md:p-4">
      {gameResult && (
        <Card className="mb-3 border-primary bg-primary/10">
          <CardContent className="py-4">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Trophy className="h-6 w-6 text-primary" />
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
                  New Game
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      <div className="space-y-2">
        <Card className={`${game && ((playerColor === "white" && game.turn() === "b") || (playerColor === "black" && game.turn() === "w")) ? "ring-2 ring-primary" : ""}`}>
          <CardContent className="py-2 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${playerColor === "white" ? "bg-black" : "bg-white border border-gray-400"}`} />
                <Bot className="h-4 w-4 text-primary" />
                <span className="font-medium text-sm" data-testid="text-opponent-name">{selectedBot?.name || "Bot"}</span>
                <span className="text-xs text-muted-foreground">({selectedBot?.elo || 1200})</span>
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
          <Card className="aspect-square w-full max-w-full md:max-w-[600px] p-1 md:p-2">
            <div className="relative w-full h-full">
              <ChessBoard 
                fen={fen}
                orientation={playerColor}
                showCoordinates={true}
                highlightedSquares={legalMoves}
                lastMove={lastMove || undefined}
                onSquareClick={handleSquareClick}
                noCard={true}
              />
              
              {isBlindfold && !isPeeking && (
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
                        const squareName = files[col] + ranks[row];
                        return (
                          <div
                            key={squareName}
                            className="flex items-center justify-center text-white/70 font-mono text-xs md:text-sm"
                          >
                            {squareName}
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
                {isVoiceListening ? (
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
              <div className="text-xs text-center text-muted-foreground">
                Heard: "{voiceTranscript}"
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
          </div>
        </div>
        
        <Card className={`${game && ((playerColor === "white" && game.turn() === "w") || (playerColor === "black" && game.turn() === "b")) ? "ring-2 ring-primary" : ""}`}>
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
    </div>
  );
}
