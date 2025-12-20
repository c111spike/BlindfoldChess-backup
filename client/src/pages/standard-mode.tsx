import { useState, useEffect, useRef, useCallback } from "react";
import { Chess } from "chess.js";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications } from "@/hooks/useNotifications";
import { useWebSocket } from "@/hooks/useWebSocket";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ChessBoard } from "@/components/chess-board";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Clock, Play, HandshakeIcon, Flag, Eye, Infinity as InfinityIcon, Bot, ChevronLeft, BarChart3, Pencil, Crown, Shuffle, Mic, MicOff, Volume2 } from "lucide-react";
import { voiceRecognition, speak, moveToSpeech } from "@/lib/voice";
import { PromotionDialog } from "@/components/promotion-dialog";
import { ReportPlayerDialog } from "@/components/ReportPlayerDialog";
import type { Game, Rating } from "@shared/schema";
import type { BotProfile, BotDifficulty, BotPersonality } from "@shared/botTypes";
import { 
  ALL_DIFFICULTIES, 
  ALL_PERSONALITIES, 
  BOT_DIFFICULTY_ELO, 
  BOT_DIFFICULTY_NAMES,
  BOT_PERSONALITY_NAMES,
  BOT_PERSONALITY_DESCRIPTIONS,
  BOT_PERSONALITY_ICONS,
  getBotByConfig 
} from "@shared/botTypes";

const getRatingCategory = (tc: number): 'bullet' | 'blitz' | 'rapid' | 'classical' => {
  if (tc <= 180) return 'bullet';
  if (tc <= 600) return 'blitz';
  if (tc <= 1200) return 'rapid';
  return 'classical';
};

const BLINDFOLD_CONFIG = {
  easy: { maxPeeks: Number.POSITIVE_INFINITY },
  medium: { maxPeeks: 20 },
  hard: { maxPeeks: 10 },
  expert: { maxPeeks: 5 },
  master: { maxPeeks: 2 },
  grandmaster: { maxPeeks: 0 },
};

export default function StandardMode() {
  const { user } = useAuth();
  const { toast } = useNotifications();
  const [, setLocation] = useLocation();
  
  const { data: playerRatings } = useQuery<Rating>({
    queryKey: ["/api/ratings"],
  });
  
  const { data: userSettings } = useQuery<any>({
    queryKey: ["/api/settings"],
  });
  
  const { data: bots } = useQuery<BotProfile[]>({
    queryKey: ["/api/bots"],
  });
  
  const [game, setGame] = useState<Chess | null>(null);
  const [gameId, setGameId] = useState<string | null>(null);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [whiteTime, setWhiteTime] = useState(180);
  const [blackTime, setBlackTime] = useState(180);
  const [moves, setMoves] = useState<string[]>([]);
  const [fen, setFen] = useState("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [legalMoves, setLegalMoves] = useState<string[]>([]);
  const [restoredGame, setRestoredGame] = useState(false);
  const [inQueue, setInQueue] = useState(false);
  const [queueType, setQueueType] = useState<string | null>(null);
  const [isBlindfold, setIsBlindfold] = useState(false);
  const [activeBlindfoldDifficulty, setActiveBlindfoldDifficulty] = useState<string | null>(null);
  const [playerColor, setPlayerColor] = useState<"white" | "black">("white");
  const [increment, setIncrement] = useState(0);
  const [opponentName, setOpponentName] = useState<string>("");
  const [opponentId, setOpponentId] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState<string>("");
  const [opponentRating, setOpponentRating] = useState<number>(1200);
  const [playerRating, setPlayerRating] = useState<number>(1200);
  const [timeControl, setTimeControl] = useState<number>(180);
  const [showDrawOfferDialog, setShowDrawOfferDialog] = useState(false);
  const [showRematchDialog, setShowRematchDialog] = useState(false);
  const [showGameEndDialog, setShowGameEndDialog] = useState(false);
  const [gameResult, setGameResult] = useState<"white_win" | "black_win" | "draw" | null>(null);
  const [waitingForDrawResponse, setWaitingForDrawResponse] = useState(false);
  const [waitingForRematchResponse, setWaitingForRematchResponse] = useState(false);
  const [rematchDenied, setRematchDenied] = useState(false);
  const [initialPlayerRating, setInitialPlayerRating] = useState<number | null>(null);
  const [ratingChange, setRatingChange] = useState<number | null>(null);
  
  const [remainingPeeks, setRemainingPeeks] = useState<number>(Number.POSITIVE_INFINITY);
  const [isPeeking, setIsPeeking] = useState(false);
  const [peekDurations, setPeekDurations] = useState<number[]>([]);
  const [totalPeekTime, setTotalPeekTime] = useState(0);
  const peekButtonRef = useRef<HTMLDivElement>(null);
  const peekKeyHeldRef = useRef<boolean>(false);
  const peekStartTimeRef = useRef<number | null>(null);
  const peekDurationsRef = useRef<number[]>([]);
  const totalPeekTimeRef = useRef<number>(0);
  
  const [showBotSelection, setShowBotSelection] = useState(false);
  const [selectedBot, setSelectedBot] = useState<BotProfile | null>(null);
  const [isBotGame, setIsBotGame] = useState(false);
  const [botThinking, setBotThinking] = useState(false);
  const [botTimeControl, setBotTimeControl] = useState<"blitz" | "rapid">("blitz");
  const [selectedBotDifficulty, setSelectedBotDifficulty] = useState<BotDifficulty | null>(null);
  const [selectedBotPersonality, setSelectedBotPersonality] = useState<BotProfile | null>(null);
  
  const [pendingPromotion, setPendingPromotion] = useState<{
    from: string;
    to: string;
  } | null>(null);
  
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [premove, setPremove] = useState<{ from: string; to: string } | null>(null);
  const [arrowDrawMode, setArrowDrawMode] = useState(false);
  
  const [isVoiceListening, setIsVoiceListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState<string | null>(null);
  const [thinkingTimes, setThinkingTimes] = useState<number[]>([]);
  
  const gameRef = useRef<Chess | null>(null);
  const gameIdRef = useRef<string | null>(null);
  const matchIdRef = useRef<string | null>(null);
  const premoveRef = useRef<{ from: string; to: string } | null>(null);
  const sendMoveRef = useRef<((matchId: string, move: string, fen: string, whiteTime: number, blackTime: number) => void) | null>(null);
  const rematchExitIntentRef = useRef<boolean>(false);
  const didSendRematchRequestRef = useRef<boolean>(false);
  const gameFromMatchmakingRef = useRef<boolean>(false);
  const whiteTimeRef = useRef(180);
  const blackTimeRef = useRef(180);
  const movesRef = useRef<string[]>([]);
  const thinkingTimesRef = useRef<number[]>([]);
  const turnStartTimeRef = useRef<number>(Date.now());
  const saveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const clockIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const gameCompletionInProgressRef = useRef(false);

  useEffect(() => {
    gameRef.current = game;
    gameIdRef.current = gameId;
    matchIdRef.current = matchId;
    whiteTimeRef.current = whiteTime;
    blackTimeRef.current = blackTime;
    movesRef.current = moves;
    premoveRef.current = premove;
    thinkingTimesRef.current = thinkingTimes;
  }, [game, gameId, matchId, whiteTime, blackTime, moves, premove, thinkingTimes]);

  const completeGame = useCallback(async (result: "white_win" | "black_win" | "draw") => {
    // Guard against duplicate execution
    if (gameCompletionInProgressRef.current) {
      console.log('[completeGame] Already in progress, skipping duplicate call');
      return;
    }
    
    const currentGame = gameRef.current;
    const currentGameId = gameIdRef.current;
    const currentMatchId = matchIdRef.current;
    
    if (!currentGameId || !currentGame) {
      console.log('[completeGame] No gameId or game, skipping');
      return;
    }

    try {
      // Set guard flag
      gameCompletionInProgressRef.current = true;

      // Stop all intervals and timers
      if (saveIntervalRef.current) {
        clearInterval(saveIntervalRef.current);
        saveIntervalRef.current = null;
      }
      if (clockIntervalRef.current) {
        clearInterval(clockIntervalRef.current);
        clockIntervalRef.current = null;
      }

      // Update UI state first - keep board visible until user clicks Main Menu
      setGameResult(result);

      // Save final game state - MUST succeed before completion
      // If no matchId, also mark game as completed here since there's no match to complete
      try {
        const gameUpdatePayload: Record<string, any> = {
          pgn: currentGame.pgn(),
          moves: movesRef.current,
          whiteTime: whiteTimeRef.current,
          blackTime: blackTimeRef.current,
          thinkingTimes: thinkingTimesRef.current,
          peekDurations: peekDurationsRef.current,
          totalPeekTime: totalPeekTimeRef.current,
          peeksUsed: peekDurationsRef.current.length,
        };
        
        // For games without a match, mark as completed directly
        if (!currentMatchId) {
          gameUpdatePayload.status = 'completed';
          gameUpdatePayload.result = result;
          console.log('[completeGame] No matchId, marking game as completed directly');
        }
        
        await apiRequest("PATCH", `/api/games/${currentGameId}`, gameUpdatePayload);
      } catch (error) {
        console.error("Error saving final game state:", error);
        // Don't proceed to completion if game state save failed
        toast({
          title: "Error",
          description: "Failed to save game state. Please try again.",
          variant: "destructive",
        });
        return;
      }

      // Complete match (centralized - handles stats, ratings, WebSocket broadcast)
      // Only proceed if PATCH succeeded above and there's a match to complete
      try {
        if (currentMatchId) {
          console.log('[completeGame] Calling POST /api/matches/:id/complete');
          await apiRequest("POST", `/api/matches/${currentMatchId}/complete`, { result });
        }
        
        // Invalidate queries
        queryClient.invalidateQueries({ queryKey: ["/api/ratings"] });
        queryClient.invalidateQueries({ queryKey: ["/api/games/recent"] });
        queryClient.invalidateQueries({ queryKey: ["/api/games/history"] });
        queryClient.invalidateQueries({ queryKey: ["/api/statistics"] });
        queryClient.invalidateQueries({ queryKey: ["/api/games/ongoing"] });
      } catch (error) {
        console.error("Error completing match:", error);
        // Show error to user but don't block - WebSocket might still handle it
        toast({
          title: "Error",
          description: "Match completion error. Please check your connection.",
          variant: "destructive",
        });
      }

      // Show game end dialog after server updates
      setShowGameEndDialog(true);
    } finally {
      // Always reset guard flag so future games can complete
      gameCompletionInProgressRef.current = false;
    }
  }, []);

  const resetGameState = useCallback(() => {
    if (saveIntervalRef.current) {
      clearInterval(saveIntervalRef.current);
      saveIntervalRef.current = null;
    }
    if (clockIntervalRef.current) {
      clearInterval(clockIntervalRef.current);
      clockIntervalRef.current = null;
    }
    gameCompletionInProgressRef.current = false;
    setGame(null);
    setGameId(null);
    setMatchId(null);
    setGameStarted(false);
    setGameResult(null);
    setWhiteTime(180);
    setBlackTime(180);
    setMoves([]);
    setFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
    setSelectedSquare(null);
    setLegalMoves([]);
    setLastMove(null);
    setPremove(null);
    setArrowDrawMode(false);
    setRestoredGame(false);
    setPlayerColor("white");
    setIncrement(0);
    setIsPeeking(false);
    setActiveBlindfoldDifficulty(null);
    setIsBotGame(false);
    setSelectedBot(null);
    setOpponentId(null);
    setBotThinking(false);
    setShowBotSelection(false);
    setThinkingTimes([]);
    setShowRematchDialog(false);
    setWaitingForRematchResponse(false);
    setRematchDenied(false);
    rematchExitIntentRef.current = false;
    didSendRematchRequestRef.current = false;
    gameRef.current = null;
    gameIdRef.current = null;
    matchIdRef.current = null;
    thinkingTimesRef.current = [];
    turnStartTimeRef.current = Date.now();
    whiteTimeRef.current = 180;
    blackTimeRef.current = 180;
    movesRef.current = [];
  }, []);

  const handleOpponentMove = useCallback(async (data: { matchId: string; move: string; fen: string; whiteTime: number; blackTime: number }) => {
    console.log('[handleOpponentMove] Received opponent move:', data);
    console.log('[handleOpponentMove] Current matchIdRef:', matchIdRef.current);
    console.log('[handleOpponentMove] Game ref exists:', !!gameRef.current);
    
    if (data.matchId !== matchIdRef.current) {
      console.log('[handleOpponentMove] SKIPPED - matchId mismatch (data:', data.matchId, 'ref:', matchIdRef.current, ')');
      return;
    }
    
    const currentGame = gameRef.current;
    if (!currentGame) {
      console.log('[handleOpponentMove] SKIPPED - no game ref');
      return;
    }
    
    try {
      if (!data.fen || !data.move) {
        throw new Error("Invalid move payload");
      }
      
      console.log('[handleOpponentMove] Loading FEN:', data.fen);
      
      const prevFen = currentGame.fen();
      const tempGame = new Chess(prevFen);
      const moveResult = tempGame.move(data.move);
      if (moveResult) {
        setLastMove({ from: moveResult.from, to: moveResult.to });
      }
      
      currentGame.load(data.fen);
      setFen(data.fen);
      
      const newMoves = [...movesRef.current, data.move];
      console.log('[handleOpponentMove] Updating moves:', newMoves);
      setMoves(newMoves);
      movesRef.current = newMoves;
      
      // Record opponent's thinking time (we don't know exact time, so we estimate from clock difference)
      // This records the opponent's move time slot - the actual time is tracked server-side
      const opponentThinkingTime = (Date.now() - turnStartTimeRef.current) / 1000;
      const newThinkingTimes = [...thinkingTimesRef.current, opponentThinkingTime];
      setThinkingTimes(newThinkingTimes);
      thinkingTimesRef.current = newThinkingTimes;
      
      // Reset turn start time for player's turn
      turnStartTimeRef.current = Date.now();
      
      setWhiteTime(data.whiteTime);
      setBlackTime(data.blackTime);
      whiteTimeRef.current = data.whiteTime;
      blackTimeRef.current = data.blackTime;
      
      // Check for game end conditions after opponent's move
      if (currentGame.isCheckmate()) {
        console.log('[handleOpponentMove] Checkmate detected - game over');
        const result = currentGame.turn() === "w" ? "black_win" : "white_win";
        await completeGame(result);
      } else if (currentGame.isDraw() || currentGame.isStalemate() || currentGame.isThreefoldRepetition() || currentGame.isInsufficientMaterial()) {
        console.log('[handleOpponentMove] Draw detected - game over');
        await completeGame("draw");
      } else {
        console.log('[handleOpponentMove] Move processed successfully');
        toast({
          title: "Opponent moved",
          description: data.move,
        });
        
        if (userSettings?.voiceOutputEnabled) {
          const isCheck = currentGame.isCheck();
          const isCapture = data.move.includes('x');
          const spokenMove = moveToSpeech(data.move, isCapture, isCheck, false);
          speak(spokenMove);
        }
        
        if (premoveRef.current) {
          const pendingPremove = premoveRef.current;
          console.log('[handleOpponentMove] Executing premove:', pendingPremove);
          setPremove(null);
          premoveRef.current = null;
          
          setTimeout(() => {
            try {
              const premoveMoveObj = currentGame.move({
                from: pendingPremove.from,
                to: pendingPremove.to,
                promotion: 'q',
              });
              
              if (premoveMoveObj) {
                const newFen = currentGame.fen();
                setFen(newFen);
                setLastMove({ from: premoveMoveObj.from, to: premoveMoveObj.to });
                
                // Record thinking time for premove (effectively instant since pre-planned)
                const premoveThinkingTime = (Date.now() - turnStartTimeRef.current) / 1000;
                const premoveNewThinkingTimes = [...thinkingTimesRef.current, premoveThinkingTime];
                setThinkingTimes(premoveNewThinkingTimes);
                thinkingTimesRef.current = premoveNewThinkingTimes;
                
                const updatedMoves = [...movesRef.current, premoveMoveObj.san];
                setMoves(updatedMoves);
                movesRef.current = updatedMoves;
                
                if (matchIdRef.current && sendMoveRef.current) {
                  sendMoveRef.current(matchIdRef.current, premoveMoveObj.san, newFen, data.whiteTime, data.blackTime);
                }
                
                if (currentGame.isCheckmate()) {
                  const result = currentGame.turn() === "w" ? "black_win" : "white_win";
                  completeGame(result);
                } else if (currentGame.isDraw() || currentGame.isStalemate() || currentGame.isThreefoldRepetition() || currentGame.isInsufficientMaterial()) {
                  completeGame("draw");
                }
              } else {
                console.log('[handleOpponentMove] Premove was illegal, cancelled');
                toast({
                  title: "Premove cancelled",
                  description: "The planned move is no longer legal.",
                  variant: "destructive",
                });
              }
            } catch (e) {
              console.log('[handleOpponentMove] Premove error:', e);
              toast({
                title: "Premove cancelled",
                description: "The planned move is no longer legal.",
                variant: "destructive",
              });
            }
          }, 50);
        }
      }
    } catch (error) {
      console.error("[handleOpponentMove] Error:", error);
      toast({
        title: "Error",
        description: "Failed to process opponent's move. Please refresh.",
        variant: "destructive",
      });
    }
  }, [toast, completeGame]);

  const handleMatchFound = useCallback((matchData: { matchId: string; game: any; timeControl: string; color: string; opponent: { name: string; rating: number }; playerRating?: number }) => {
    try {
      console.log('[handleMatchFound] Received match data:', matchData);
      console.log('[handleMatchFound] PLAYER COLOR RECEIVED:', matchData.color);
      const gameData = matchData.game;
      console.log('[handleMatchFound] Game data:', gameData);
      
      if (!gameData || !gameData.id) {
        throw new Error(`Invalid game data: ${JSON.stringify(gameData)}`);
      }
      
      // Clear any pending game completion flags for the OLD game
      // The old game has already been completed by completeGame() or the server
      gameCompletionInProgressRef.current = false;
      
      // Set refs immediately for synchronous access
      gameIdRef.current = gameData.id;
      matchIdRef.current = matchData.matchId;
      rematchExitIntentRef.current = false; // Clear exit intent for new match
      didSendRematchRequestRef.current = false; // Reset rematch request flag for new game
      gameFromMatchmakingRef.current = true; // Mark that this game came from matchmaking (not restoration)
      console.log('[handleMatchFound] Set matchIdRef to:', matchIdRef.current);
      
      setGameId(gameData.id);
      setMatchId(matchData.matchId);
      setRematchDenied(false); // Reset denied state for new game
      const chess = new Chess(gameData.fen);
      gameRef.current = chess;
      setGame(chess);
      setPlayerColor(matchData.color as "white" | "black");
      console.log('[handleMatchFound] SET playerColor STATE TO:', matchData.color);
      setFen(gameData.fen);
      
      const matchMoves = gameData.moves || [];
      setMoves(matchMoves);
      movesRef.current = matchMoves;
      
      setWhiteTime(gameData.whiteTime || 180);
      setBlackTime(gameData.blackTime || 180);
      setIncrement(gameData.increment || 0);
      setOpponentName(matchData.opponent.name);
      setOpponentRating(matchData.opponent.rating);
      if (matchData.playerRating) {
        setPlayerRating(matchData.playerRating);
        setInitialPlayerRating(matchData.playerRating);
      }
      const computedOpponentId = matchData.color === 'white' ? gameData.blackPlayerId : gameData.whitePlayerId;
      setOpponentId(computedOpponentId || null);
      setPlayerName(`${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'You');
      
      // Handle named time controls ('blitz', 'rapid') or numeric strings ('5', '15')
      const timeControlMap: Record<string, number> = { bullet: 1, blitz: 5, rapid: 15, classical: 30 };
      const tcMinutes = timeControlMap[matchData.timeControl] || parseInt(matchData.timeControl) || 5;
      const tcSeconds = tcMinutes * 60;
      setTimeControl(tcSeconds);
      
      // Lock blindfold difficulty at game start
      if (isBlindfold && userSettings?.blindfoldDifficulty) {
        setActiveBlindfoldDifficulty(userSettings.blindfoldDifficulty);
      }
      
      // Reset peek tracking for new game
      setPeekDurations([]);
      setTotalPeekTime(0);
      peekStartTimeRef.current = null;
      peekDurationsRef.current = [];
      totalPeekTimeRef.current = 0;
      
      // Reset thinking time tracking for new game
      setThinkingTimes([]);
      thinkingTimesRef.current = [];
      turnStartTimeRef.current = Date.now();
      
      setGameResult(null);
      setGameStarted(true);
      setInQueue(false);
      
      // Store initial rating for change calculation later (only if not already set from server)
      if (!matchData.playerRating) {
        const ratingCategory = getRatingCategory(tcSeconds);
        const currentRating = playerRatings?.[ratingCategory] || 1200;
        setPlayerRating(currentRating);
        setInitialPlayerRating(currentRating);
      }
      setRatingChange(null);
      
      toast({
        title: "Match found!",
        description: `Playing as ${matchData.color} against ${matchData.opponent.name}`,
      });
    } catch (error) {
      console.error("[handleMatchFound] Error loading match:", error);
      console.error("[handleMatchFound] Error stack:", error instanceof Error ? error.stack : 'No stack');
      console.error("[handleMatchFound] Error message:", error instanceof Error ? error.message : String(error));
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load match. Please try again.",
        variant: "destructive",
      });
    }
  }, [toast, isBlindfold, userSettings, user, playerRatings]);

  const handleDrawOffer = useCallback((data: { matchId: string; from: string }) => {
    if (data.matchId === matchIdRef.current) {
      setShowDrawOfferDialog(true);
    }
  }, []);

  const handleDrawResponse = useCallback(async (data: { matchId: string; accepted: boolean }) => {
    if (data.matchId === matchIdRef.current) {
      if (data.accepted) {
        // Reset waiting state before completing game
        setWaitingForDrawResponse(false);
        // Complete the game for both players
        await completeGame("draw");
      } else {
        setWaitingForDrawResponse(false);
        toast({
          title: "Draw declined",
          description: "Your opponent declined the draw offer",
        });
      }
    }
  }, [toast, completeGame]);

  const handleRematchRequest = useCallback((data: { matchId: string; from: string }) => {
    if (data.matchId === matchIdRef.current) {
      rematchExitIntentRef.current = false; // Clear exit intent for new rematch
      didSendRematchRequestRef.current = false; // We received a request, so we didn't send it
      setShowRematchDialog(true);
    }
  }, []);

  const handleRematchResponse = useCallback((data: { matchId: string; accepted: boolean; newMatchId?: string }) => {
    console.log('[handleRematchResponse] Received:', data);
    console.log('[handleRematchResponse] Current matchId:', matchIdRef.current, 'Response matchId:', data.matchId);
    console.log('[handleRematchResponse] didSendRematchRequestRef.current:', didSendRematchRequestRef.current);
    console.log('[handleRematchResponse] rematchExitIntentRef.current:', rematchExitIntentRef.current);
    
    // Ignore responses from old matches
    if (data.matchId !== matchIdRef.current) {
      console.log('[handleRematchResponse] Ignoring stale response from old match');
      return;
    }
    
    // Clear waiting state
    setWaitingForRematchResponse(false);
    
    // If user clicked Main Menu, ignore this response (they've already left)
    if (rematchExitIntentRef.current) {
      console.log('[handleRematchResponse] Exit intent detected, ignoring response');
      rematchExitIntentRef.current = false; // Clear for next time
      return;
    }
    
    if (data.accepted) {
      // Close both dialogs and wait for match_found event from server
      setShowGameEndDialog(false);
      setShowRematchDialog(false);
      setRematchDenied(false); // Reset denied state on successful rematch
      toast({
        title: "Rematch accepted!",
        description: "Starting new game...",
      });
      // Don't reset game state - the match_found event will set up the new game
    } else {
      console.log('[handleRematchResponse] Rematch declined');
      // Opponent declined (clicked Main Menu or No)
      setShowRematchDialog(false);
      // Don't re-open Game End dialog - it's already open
      setRematchDenied(true); // Mark as denied - button should stay disabled until next game
      
      // Only show toast if WE sent the rematch request
      if (didSendRematchRequestRef.current) {
        console.log('[handleRematchResponse] Showing toast - we sent the request');
        toast({
          title: "Rematch denied",
          description: "Your opponent declined the rematch",
          variant: "destructive",
        });
      } else {
        console.log('[handleRematchResponse] NOT showing toast - we did not send the request');
      }
      
      // Reset the flag for next time
      didSendRematchRequestRef.current = false;
    }
  }, [toast]);

  const handleGameEndEvent = useCallback((data: { result: string; reason: string }) => {
    console.log('[handleGameEndEvent] Received game_end WebSocket event:', data);
    
    // Set the game result so the Game Over dialog shows the correct winner
    setGameResult(data.result as "white_win" | "black_win" | "draw");
    
    // Show the Game Over dialog
    setShowGameEndDialog(true);
    
    // Stop all timers
    if (saveIntervalRef.current) {
      clearInterval(saveIntervalRef.current);
      saveIntervalRef.current = null;
    }
    if (clockIntervalRef.current) {
      clearInterval(clockIntervalRef.current);
      clockIntervalRef.current = null;
    }
    
    // Don't set gameStarted to false - keep board visible until user clicks Main Menu
  }, []);

  const { sendMove, isConnected, joinQueue, leaveQueue: wsLeaveQueue, queueStatus, joinMatch, sendDrawOffer, sendDrawResponse, sendRematchRequest, sendRematchResponse, sendPlayerAway, sendPlayerBack } = useWebSocket({
    userId: user?.id,
    onMove: handleOpponentMove,
    onMatchFound: handleMatchFound,
    onDrawOffer: handleDrawOffer,
    onDrawResponse: handleDrawResponse,
    onRematchRequest: handleRematchRequest,
    onRematchResponse: handleRematchResponse,
    onGameEnd: handleGameEndEvent,
  });

  useEffect(() => {
    sendMoveRef.current = sendMove;
  }, [sendMove]);

  // Join the match room when a match is found
  useEffect(() => {
    if (matchId && isConnected) {
      console.log('[useEffect] Joining match room:', matchId);
      joinMatch(matchId);
    }
  }, [matchId, isConnected, joinMatch]);

  // Calculate rating change when game ends (for PvP games only)
  useEffect(() => {
    if (gameResult && !isBotGame && playerRatings && initialPlayerRating !== null) {
      const ratingCategory = getRatingCategory(timeControl);
      const newRating = playerRatings[ratingCategory] || 1200;
      const change = newRating - initialPlayerRating;
      setRatingChange(change);
    }
  }, [gameResult, isBotGame, playerRatings, initialPlayerRating, timeControl]);

  // Warn player when trying to leave during an active game
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Only warn if game is active and not already finished
      if (gameStarted && !gameResult && !isBotGame) {
        e.preventDefault();
        e.returnValue = 'You have an active game. Leaving will count as a forfeit.';
        return e.returnValue;
      }
    };

    const handleVisibilityChange = () => {
      // Notify server when player switches tabs during active PvP game
      if (gameStarted && !gameResult && !isBotGame && matchId) {
        if (document.visibilityState === 'hidden') {
          sendPlayerAway(matchId);
          toast({
            title: "Warning",
            description: "You switched tabs. Return within 30 seconds or forfeit.",
            variant: "destructive",
          });
        } else if (document.visibilityState === 'visible') {
          sendPlayerBack(matchId);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [gameStarted, gameResult, isBotGame, matchId, sendPlayerAway, sendPlayerBack, toast]);

  const createGameMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/games", data);
      return response.json();
    },
    onSuccess: (data: Game) => {
      setGameId(data.id);
      toast({
        title: "Game started",
        description: "Good luck!",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to start game",
        variant: "destructive",
      });
    },
  });

  const updateGameMutation = useMutation({
    mutationFn: async (data: any) => {
      const currentGameId = gameIdRef.current;
      const currentMatchId = matchIdRef.current;
      if (!currentGameId) return;
      await apiRequest("PATCH", `/api/games/${currentGameId}`, data);
      if (currentMatchId && data.status === 'completed') {
        await apiRequest("PATCH", `/api/matches/${currentMatchId}`, { status: 'completed' });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ratings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/games/recent"] });
      queryClient.invalidateQueries({ queryKey: ["/api/games/history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/statistics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/games/ongoing"] });
      resetGameState();
    },
  });

  const { data: ongoingGame } = useQuery<Game>({
    queryKey: ["/api/games/ongoing"],
    enabled: !restoredGame && !gameStarted && !inQueue,
  });

  // Settings mutations for blindfold and voice options with optimistic updates
  const updateSettingsMutation = useMutation({
    mutationFn: async (settings: Record<string, any>) => {
      const response = await apiRequest("PATCH", "/api/settings", settings);
      return response.json();
    },
    onMutate: async (newSettings) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/settings"] });
      
      // Snapshot the previous value
      const previousSettings = queryClient.getQueryData(["/api/settings"]);
      
      // Optimistically update to the new value
      queryClient.setQueryData(["/api/settings"], (old: any) => ({
        ...old,
        ...newSettings,
      }));
      
      // Return context with the previous value
      return { previousSettings };
    },
    onError: (err, newSettings, context) => {
      // Rollback to previous value on error
      if (context?.previousSettings) {
        queryClient.setQueryData(["/api/settings"], context.previousSettings);
      }
      toast({
        title: "Error",
        description: "Failed to save setting",
        variant: "destructive",
      });
    },
    onSettled: () => {
      // Refetch to ensure server state is synced
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
    },
  });

  const blindfoldDifficultyOptions = [
    { value: "easy", label: "Easy", description: "Unlimited peeks" },
    { value: "medium", label: "Medium", description: "20 peeks" },
    { value: "hard", label: "Hard", description: "10 peeks" },
    { value: "expert", label: "Expert", description: "5 peeks" },
    { value: "master", label: "Master", description: "2 peeks" },
    { value: "grandmaster", label: "Grandmaster", description: "0 peeks (pure blindfold)" },
  ];

  useEffect(() => {
    setInQueue(queueStatus.inQueue);
  }, [queueStatus]);

  const handleJoinQueue = (timeControl: string) => {
    if (!isConnected) {
      toast({
        title: "Not connected",
        description: "Please wait for connection...",
        variant: "destructive",
      });
      return;
    }

    resetGameState();
    setQueueType(`standard_${timeControl}`);
    joinQueue(timeControl);
    
    toast({
      title: "Joined queue",
      description: `Looking for ${timeControl} game...`,
    });
  };

  const handleLeaveQueue = () => {
    wsLeaveQueue();
    setQueueType(null);
    toast({
      title: "Left queue",
    });
  };

  const requestBotMove = useCallback(async (currentFen: string, botId: string, moveHistorySAN?: string[]) => {
    if (!botId) return;
    
    setBotThinking(true);
    
    try {
      const response = await apiRequest("POST", "/api/bots/move", {
        fen: currentFen,
        botId,
        moveHistory: moveHistorySAN || [],
      });
      
      if (!response.ok) {
        throw new Error("Failed to get bot move");
      }
      
      const data = await response.json();
      return data;
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
  }, [toast]);

  const handleStartBotGame = async (bot: BotProfile, colorChoice: "white" | "black" | "random") => {
    if (!user) return;
    
    const newGame = new Chess();
    setGame(newGame);
    setFen(newGame.fen());
    setMoves([]);
    setSelectedSquare(null);
    setLegalMoves([]);
    setGameResult(null);
    setIsBotGame(true);
    setSelectedBot(bot);
    setShowBotSelection(false);
    setSelectedBotDifficulty(null);
    setSelectedBotPersonality(null);
    
    const assignedColor = colorChoice === "random" 
      ? (Math.random() < 0.5 ? "white" : "black")
      : colorChoice;
    setPlayerColor(assignedColor);
    
    const seconds = botTimeControl === "blitz" ? 300 : 900;
    const inc = botTimeControl === "blitz" ? 0 : 10;
    setWhiteTime(seconds);
    setBlackTime(seconds);
    whiteTimeRef.current = seconds;
    blackTimeRef.current = seconds;
    setTimeControl(seconds);
    setIncrement(inc);
    
    setOpponentName(bot.name);
    setOpponentRating(bot.elo);
    setPlayerName(user.firstName || "Player");
    
    // Set player rating for display using correct category
    const botRatingCategory = botTimeControl === "blitz" ? "blitz" : "rapid";
    const currentPlayerRating = playerRatings?.[botRatingCategory] || 1200;
    setPlayerRating(currentPlayerRating);
    
    const mode = botTimeControl === "blitz" ? "standard_blitz" : "standard_rapid";
    
    createGameMutation.mutate({
      mode,
      playerColor: assignedColor,
      timeControl: seconds / 60,
      increment: inc,
      fen: newGame.fen(),
      moves: [],
      whiteTime: seconds,
      blackTime: seconds,
      opponentName: bot.name,
      blindfoldEnabled: isBlindfold,
      blindfoldDifficulty: isBlindfold ? (userSettings?.blindfoldDifficulty || 'medium') : undefined,
    });
    
    // Reset peek tracking for new game
    setPeekDurations([]);
    setTotalPeekTime(0);
    peekStartTimeRef.current = null;
    peekDurationsRef.current = [];
    totalPeekTimeRef.current = 0;
    
    setGameStarted(true);
    
    if (assignedColor === "black") {
      const botMove = await requestBotMove(newGame.fen(), bot.id);
      if (botMove) {
        const moveResult = newGame.move(botMove.move);
        if (moveResult) {
          setLastMove({ from: moveResult.from, to: moveResult.to });
        }
        setFen(newGame.fen());
        setMoves([botMove.move]);
        movesRef.current = [botMove.move];
      }
    }
  };

  useEffect(() => {
    if (ongoingGame && !restoredGame && !gameStarted && !inQueue && ongoingGame.status === 'active') {
      const restoreGame = async () => {
        try {
          const matchResponse = await apiRequest("GET", "/api/matches/active");
          
          if (!matchResponse.ok) {
            setRestoredGame(true);
            return;
          }
          
          const matchData = await matchResponse.json();
          if (!matchData || !matchData.matchId || matchData.status === 'completed') {
            setRestoredGame(true);
            return;
          }
          
          if (queueType && ongoingGame.mode !== queueType) {
            setRestoredGame(true);
            return;
          }
          
          if (!queueType) {
            setQueueType(ongoingGame.mode);
          }
          
          setMatchId(matchData.matchId);
          
          const chess = new Chess(ongoingGame.fen || undefined);
          setGame(chess);
          setGameId(ongoingGame.id);
          setPlayerColor((ongoingGame as any).playerColor || "white");
          setFen(ongoingGame.fen || "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
          
          const restoredMoves = ongoingGame.moves || [];
          setMoves(restoredMoves);
          movesRef.current = restoredMoves;
          
          setWhiteTime(ongoingGame.whiteTime || 180);
          setBlackTime(ongoingGame.blackTime || 180);
          setIncrement(ongoingGame.increment || 0);
          
          // Normalize timeControl to seconds (server stores in minutes)
          const storedTc = ongoingGame.timeControl || 3;
          const tcInSeconds = storedTc < 60 ? storedTc * 60 : storedTc;
          setTimeControl(tcInSeconds);
          
          // Set player rating from ratings query using normalized time control
          const ratingCategory = getRatingCategory(tcInSeconds);
          const restoredPlayerRating = playerRatings?.[ratingCategory] || 1200;
          setPlayerRating(restoredPlayerRating);
          setInitialPlayerRating(restoredPlayerRating);
          
          // Restore blindfold difficulty if it was saved with the game
          if ((ongoingGame as any).blindfoldDifficulty) {
            setActiveBlindfoldDifficulty((ongoingGame as any).blindfoldDifficulty);
            setIsBlindfold(true);
          }
          
          setGameResult(null);
          setGameStarted(true);
          setRestoredGame(true);
          
          // Only show "Game restored" toast if this is a real restoration (not a new game from matchmaking)
          if (!gameFromMatchmakingRef.current) {
            toast({
              title: "Game restored",
              description: "Your ongoing game has been loaded with live sync",
            });
          }
          
          // Reset the matchmaking flag after restoration logic runs
          gameFromMatchmakingRef.current = false;
        } catch (error) {
          console.error("Error restoring game:", error);
          toast({
            title: "Error",
            description: "Failed to restore game. Please refresh.",
            variant: "destructive",
          });
          setRestoredGame(true);
        }
      };
      
      restoreGame();
    }
  }, [ongoingGame, restoredGame, gameStarted, toast, playerRatings]);

  const saveGameState = useCallback(async () => {
    const currentGame = gameRef.current;
    const currentGameId = gameIdRef.current;
    
    if (!currentGameId || !currentGame) return;
    
    try {
      await apiRequest("PATCH", `/api/games/${currentGameId}`, {
        fen: currentGame.fen(),
        moves: movesRef.current,
        whiteTime: whiteTimeRef.current,
        blackTime: blackTimeRef.current,
        pgn: currentGame.pgn(),
      });
    } catch (error) {
      console.error("Error saving game state:", error);
    }
  }, []);

  const handleGameEnd = useCallback(async (result: "white_win" | "black_win" | "draw") => {
    await completeGame(result);
  }, [completeGame]);

  useEffect(() => {
    if (gameStarted && game) {
      const timer = setInterval(() => {
        const currentTurn = game.turn();
        
        if (currentTurn === "w") {
          setWhiteTime((t) => {
            const newTime = Math.max(0, t - 1);
            // Always update ref for the current turn
            whiteTimeRef.current = newTime;
            // Check for timeout - white loses, black wins
            if (newTime === 0 && t > 0) {
              handleGameEnd("black_win");
            }
            return newTime;
          });
        } else {
          setBlackTime((t) => {
            const newTime = Math.max(0, t - 1);
            // Always update ref for the current turn
            blackTimeRef.current = newTime;
            // Check for timeout - black loses, white wins
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
  }, [gameStarted, game, playerColor, handleGameEnd]);

  useEffect(() => {
    if (gameStarted && gameId) {
      saveIntervalRef.current = setInterval(() => {
        saveGameState();
      }, 10000);
    }

    return () => {
      if (saveIntervalRef.current) {
        clearInterval(saveIntervalRef.current);
        saveIntervalRef.current = null;
      }
    };
  }, [gameStarted, gameId, saveGameState]);

  useEffect(() => {
    if (!gameStarted || !game || !userSettings?.voiceInputEnabled) {
      voiceRecognition.stop();
      return;
    }
    
    const currentTurn = game.turn();
    const isMyTurn = (currentTurn === "w" && playerColor === "white") || (currentTurn === "b" && playerColor === "black");
    
    if (isMyTurn && !botThinking && !pendingPromotion && gameResult === null) {
      const allLegalMoves = game.moves();
      voiceRecognition.setLegalMoves(allLegalMoves);
      
      voiceRecognition.setOnResult((move, transcript) => {
        setVoiceTranscript(transcript);
        
        if (move) {
          const spokenConfirm = moveToSpeech(move, move.includes('x'), false, false);
          speak(spokenConfirm).then(() => {
            const moveObj = game.move(move);
            if (moveObj) {
              const newFen = game.fen();
              setFen(newFen);
              setLastMove({ from: moveObj.from, to: moveObj.to });
              
              const newMoves = [...movesRef.current, moveObj.san];
              setMoves(newMoves);
              movesRef.current = newMoves;
              
              setSelectedSquare(null);
              setLegalMoves([]);
              setVoiceTranscript(null);
              
              if (gameIdRef.current && matchIdRef.current) {
                sendMove(matchIdRef.current, moveObj.san, newFen, whiteTimeRef.current, blackTimeRef.current);
              }
              
              if (game.isCheckmate()) {
                const result = game.turn() === "w" ? "black_win" : "white_win";
                completeGame(result);
              } else if (game.isDraw() || game.isStalemate() || game.isThreefoldRepetition() || game.isInsufficientMaterial()) {
                completeGame("draw");
              } else if (isBotGame && selectedBot) {
                const moveHistorySAN = game.history();
                requestBotMove(newFen, selectedBot.id, moveHistorySAN).then((botMove) => {
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
                    
                    if (userSettings?.voiceOutputEnabled) {
                      const isCheck = gameRef.current.isCheck();
                      const isCapture = botMove.move.includes('x');
                      const spokenMove = moveToSpeech(botMove.move, isCapture, isCheck, gameRef.current.isCheckmate());
                      speak(spokenMove);
                    }
                  }
                });
              }
            }
          });
        } else {
          toast({
            title: "Didn't understand",
            description: `Heard: "${transcript}". Try again.`,
            variant: "destructive",
          });
        }
      });
      
      voiceRecognition.setOnListeningChange(setIsVoiceListening);
      voiceRecognition.start();
    } else {
      voiceRecognition.stop();
    }
    
    return () => {
      voiceRecognition.reset();
    };
  }, [gameStarted, game, fen, userSettings?.voiceInputEnabled, playerColor, botThinking, pendingPromotion, gameResult, isBotGame, selectedBot, toast, completeGame, sendMove, requestBotMove]);

  const formatTime = (seconds: number) => {
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
      const move = game.move({
        from,
        to,
        promotion,
      });

      console.log('[executeMove] Move result:', move);

      if (move) {
        const newFen = game.fen();
        console.log('[executeMove] New FEN:', newFen);
        console.log('[executeMove] Move SAN:', move.san);
        
        // Record thinking time for this move
        const thinkingTime = (Date.now() - turnStartTimeRef.current) / 1000;
        const newThinkingTimes = [...thinkingTimesRef.current, thinkingTime];
        setThinkingTimes(newThinkingTimes);
        thinkingTimesRef.current = newThinkingTimes;
        
        setFen(newFen);
        setLastMove({ from: move.from, to: move.to });
        
        const newMoves = [...movesRef.current, move.san];
        console.log('[executeMove] New moves array:', newMoves);
        setMoves(newMoves);
        movesRef.current = newMoves;
        
        setSelectedSquare(null);
        setLegalMoves([]);
        
        console.log('[executeMove] gameId:', gameId, 'matchId:', matchId);
        if (gameId && matchId) {
          console.log('[executeMove] Sending move via WebSocket');
          sendMove(matchId, move.san, newFen, whiteTime, blackTime);
        }
        
        if (game.isCheckmate()) {
          await handleGameEnd(game.turn() === "w" ? "black_win" : "white_win");
        } else if (game.isDraw() || game.isStalemate() || game.isThreefoldRepetition() || game.isInsufficientMaterial()) {
          await handleGameEnd("draw");
        } else {
          saveGameState();
          
          if (isBotGame && selectedBot) {
            const botThinkStartTime = Date.now();
            const moveHistorySAN = game.history();
            const botMove = await requestBotMove(newFen, selectedBot.id, moveHistorySAN);
            if (botMove && game) {
              // Record bot's thinking time
              const botThinkingTime = (Date.now() - botThinkStartTime) / 1000;
              const botNewThinkingTimes = [...thinkingTimesRef.current, botThinkingTime];
              setThinkingTimes(botNewThinkingTimes);
              thinkingTimesRef.current = botNewThinkingTimes;
              
              // Reset turn start time for player's next turn
              turnStartTimeRef.current = Date.now();
              
              const botMoveResult = game.move(botMove.move);
              if (botMoveResult) {
                setLastMove({ from: botMoveResult.from, to: botMoveResult.to });
              }
              const botNewFen = game.fen();
              setFen(botNewFen);
              const updatedMoves = [...movesRef.current, botMove.move];
              setMoves(updatedMoves);
              movesRef.current = updatedMoves;
              
              if (isBlindfold && userSettings?.voiceOutputEnabled) {
                const isCheck = game.isCheck();
                const isCapture = botMove.move.includes('x');
                const spokenMove = moveToSpeech(botMove.move, isCapture, isCheck, game.isCheckmate());
                speak(spokenMove);
              }
              
              if (game.isCheckmate()) {
                await handleGameEnd(game.turn() === "w" ? "black_win" : "white_win");
              } else if (game.isDraw() || game.isStalemate() || game.isThreefoldRepetition() || game.isInsufficientMaterial()) {
                await handleGameEnd("draw");
              } else {
                saveGameState();
              }
            }
          }
        }
      }
    } catch (e) {
      console.error('[executeMove] Move error:', e);
    }
  };

  const handlePromotionSelect = async (piece: "q" | "r" | "b" | "n") => {
    if (!pendingPromotion) return;
    await executeMove(pendingPromotion.from, pendingPromotion.to, piece);
    setPendingPromotion(null);
  };

  const handleSquareClick = async (square: string) => {
    console.log('[handleSquareClick] Square clicked:', square);
    console.log('[handleSquareClick] game:', !!game, 'gameStarted:', gameStarted);
    
    if (!game || !gameStarted || pendingPromotion || botThinking) {
      console.log('[handleSquareClick] Skipping - no game, not started, pending promotion, or bot thinking');
      return;
    }

    const currentTurn = game.turn();
    const isMyTurn = (currentTurn === "w" && playerColor === "white") || (currentTurn === "b" && playerColor === "black");
    
    if (!isMyTurn && !isBotGame) {
      const piece = game.get(square as any);
      const myPieceColor = playerColor === "white" ? "w" : "b";
      
      if (selectedSquare) {
        if (selectedSquare === square) {
          setSelectedSquare(null);
          setLegalMoves([]);
          setPremove(null);
          return;
        }
        
        setPremove({ from: selectedSquare, to: square });
        setSelectedSquare(null);
        setLegalMoves([]);
        console.log('[handleSquareClick] Premove set:', selectedSquare, '->', square);
        return;
      } else {
        if (piece && piece.color === myPieceColor) {
          setSelectedSquare(square);
          setLegalMoves([]);
          setPremove(null);
          console.log('[handleSquareClick] Selected piece for premove:', square);
        }
      }
      return;
    }

    if (selectedSquare) {
      console.log('[handleSquareClick] Selected square exists:', selectedSquare, '-> attempting move to:', square);
      
      const legalMovesForPiece = game.moves({ square: selectedSquare as any, verbose: true });
      const isLegalMove = legalMovesForPiece.some((m: any) => m.to === square);
      
      if (isLegalMove && isPromotionMove(selectedSquare, square)) {
        if (userSettings?.autoQueen) {
          await executeMove(selectedSquare, square, "q");
        } else {
          setPendingPromotion({ from: selectedSquare, to: square });
        }
        return;
      }
      
      await executeMove(selectedSquare, square);
      
      if (!game.get(square as any) || game.get(selectedSquare as any)) {
        const moves = game.moves({ square: square as any, verbose: true });
        if (moves.length > 0) {
          setSelectedSquare(square);
          setLegalMoves(moves.map((m: any) => m.to));
        }
      }
    } else {
      console.log('[handleSquareClick] No selected square - selecting:', square);
      const moves = game.moves({ square: square as any, verbose: true });
      console.log('[handleSquareClick] Legal moves:', moves);
      if (moves.length > 0) {
        setSelectedSquare(square);
        setLegalMoves(moves.map((m: any) => m.to));
      }
    }
  };

  const handleResign = async () => {
    if (!game) return;
    // The resigning player loses, so opponent wins
    await completeGame(playerColor === "white" ? "black_win" : "white_win");
  };

  const handleOfferDraw = () => {
    if (!matchId) return;
    setWaitingForDrawResponse(true);
    sendDrawOffer(matchId);
    toast({
      title: "Draw offer sent",
      description: "Waiting for opponent's response...",
    });
  };

  const handlePeekStart = () => {
    if (!isBlindfold || remainingPeeks <= 0 || isPeeking) return;
    
    const effectiveDifficulty = activeBlindfoldDifficulty || userSettings?.blindfoldDifficulty || 'easy';
    const config = BLINDFOLD_CONFIG[effectiveDifficulty as keyof typeof BLINDFOLD_CONFIG];
    
    if (config.maxPeeks === 0) return;
    
    if (isFinite(config.maxPeeks)) {
      setRemainingPeeks(prev => prev - 1);
    }
    
    peekStartTimeRef.current = Date.now();
    setIsPeeking(true);
  };

  const handlePeekEnd = () => {
    if (isPeeking && peekStartTimeRef.current) {
      const duration = (Date.now() - peekStartTimeRef.current) / 1000;
      setPeekDurations(prev => {
        const newDurations = [...prev, duration];
        peekDurationsRef.current = newDurations;
        return newDurations;
      });
      setTotalPeekTime(prev => {
        const newTotal = prev + duration;
        totalPeekTimeRef.current = newTotal;
        return newTotal;
      });
      peekStartTimeRef.current = null;
    }
    setIsPeeking(false);
  };

  const handlePeekKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === ' ' || e.key === 'Enter')) {
      e.preventDefault();
      e.stopPropagation();
      if (!e.repeat) {
        if (isPeeking) {
          handlePeekEnd();
        } else {
          handlePeekStart();
        }
      }
    }
  };
  
  useEffect(() => {
    // Reset peek state
    setIsPeeking(false);
    
    // Determine which difficulty to use: active game difficulty takes precedence
    const effectiveDifficulty = activeBlindfoldDifficulty || userSettings?.blindfoldDifficulty;
    
    // Initialize peek count based on mode
    if (isBlindfold && effectiveDifficulty) {
      const config = BLINDFOLD_CONFIG[effectiveDifficulty as keyof typeof BLINDFOLD_CONFIG];
      setRemainingPeeks(config.maxPeeks);
    } else {
      // Not in blindfold mode - reset to infinity (doesn't matter)
      setRemainingPeeks(Number.POSITIVE_INFINITY);
    }
  }, [isBlindfold, activeBlindfoldDifficulty, userSettings?.blindfoldDifficulty]);

  return (
    <div className="h-full md:h-screen flex flex-col md:flex-row overflow-auto md:overflow-hidden">
      <div className="flex-1 flex items-center justify-center p-4 md:p-8 bg-muted/30 md:overflow-auto">
        <div className="w-full max-w-3xl space-y-4 md:space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">Standard Mode</h1>
              <p className="text-sm md:text-base text-muted-foreground">Online chess with automatic clocks</p>
            </div>
            {(gameStarted || isBotGame) && !gameResult && (
              <div className="flex items-center gap-2 shrink-0">
                <Pencil className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="arrow-draw-mode-header" className="text-xs whitespace-nowrap">
                  Draw Arrows
                </Label>
                <Switch
                  id="arrow-draw-mode-header"
                  checked={arrowDrawMode}
                  onCheckedChange={setArrowDrawMode}
                  data-testid="switch-arrow-draw-mode"
                />
              </div>
            )}
          </div>

          {!gameStarted && !gameResult ? (
            <>
              {!inQueue ? (
                <Card>
                  <CardContent className="pt-6 space-y-4">
                    <div className="flex items-center justify-between pb-4 border-b">
                      <Label htmlFor="blindfold-toggle" className="text-base font-semibold">
                        Blindfold Mode
                      </Label>
                      <Switch
                        id="blindfold-toggle"
                        checked={isBlindfold}
                        onCheckedChange={setIsBlindfold}
                        data-testid="switch-blindfold"
                      />
                    </div>
                    {isBlindfold && (
                      <div className="space-y-4 pb-4 border-b">
                        <p className="text-sm text-muted-foreground">
                          Board will be hidden. Use the peek button to view it briefly.
                        </p>
                        
                        <div className="space-y-3">
                          <div>
                            <Label className="text-sm font-medium mb-2 block">Difficulty</Label>
                            <Select
                              value={userSettings?.blindfoldDifficulty || "medium"}
                              onValueChange={(value) => updateSettingsMutation.mutate({ blindfoldDifficulty: value })}
                              disabled={updateSettingsMutation.isPending}
                            >
                              <SelectTrigger className="w-full" data-testid="select-blindfold-difficulty">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {blindfoldDifficultyOptions.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium">{option.label}</span>
                                      <span className="text-xs text-muted-foreground">({option.description})</span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="flex items-center justify-between">
                            <Label htmlFor="show-coordinates" className="text-sm cursor-pointer">
                              Show tile names (a1-h8)
                            </Label>
                            <Switch
                              id="show-coordinates"
                              checked={userSettings?.blindfoldShowCoordinates || false}
                              onCheckedChange={(checked) => updateSettingsMutation.mutate({ blindfoldShowCoordinates: checked })}
                              disabled={updateSettingsMutation.isPending}
                              data-testid="switch-blindfold-coordinates"
                            />
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <Label htmlFor="voice-announcements" className="text-sm cursor-pointer">
                                Voice Announcements
                              </Label>
                              <p className="text-xs text-muted-foreground">Hear moves spoken aloud</p>
                            </div>
                            <Switch
                              id="voice-announcements"
                              checked={userSettings?.voiceOutputEnabled || false}
                              onCheckedChange={(checked) => updateSettingsMutation.mutate({ voiceOutputEnabled: checked })}
                              disabled={updateSettingsMutation.isPending}
                              data-testid="switch-voice-output"
                            />
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <Label htmlFor="voice-commands" className="text-sm cursor-pointer">
                                Voice Commands
                              </Label>
                              <p className="text-xs text-muted-foreground">Speak your moves instead of clicking</p>
                            </div>
                            <Switch
                              id="voice-commands"
                              checked={userSettings?.voiceInputEnabled || false}
                              onCheckedChange={(checked) => updateSettingsMutation.mutate({ voiceInputEnabled: checked })}
                              disabled={updateSettingsMutation.isPending}
                              data-testid="switch-voice-input"
                            />
                          </div>
                        </div>
                        
                        <div className="mt-4 p-4 bg-muted/50 rounded-lg" data-testid="blindfold-how-to">
                          <h3 className="font-semibold text-sm mb-2">How Blindfold Chess Works</h3>
                          <div className="space-y-2 text-sm text-muted-foreground">
                            <p>
                              <strong>Playing without seeing:</strong> The board is hidden during your game. 
                              You must visualize piece positions in your mind and make moves based on memory.
                            </p>
                            <p>
                              <strong>Peeking:</strong> Press and hold the peek button (or spacebar) to briefly 
                              view the board. Different difficulty levels limit how many peeks you get.
                            </p>
                            <p>
                              <strong>Coordinate notation:</strong> Enable "Show tile names" to see square 
                              coordinates (a1-h8), helping you think in chess notation.
                            </p>
                          </div>
                          
                          <h3 className="font-semibold text-sm mt-4 mb-2">Memory Benefits</h3>
                          <div className="space-y-2 text-sm text-muted-foreground">
                            <p>
                              <strong>Visualization skills:</strong> Strengthen your ability to see the board 
                              in your mind, a crucial skill for calculating variations during real games.
                            </p>
                            <p>
                              <strong>Pattern recognition:</strong> Your brain learns to track multiple pieces 
                              and their relationships without visual cues, improving tactical awareness.
                            </p>
                            <p>
                              <strong>Working memory:</strong> Holding the board position in your head exercises 
                              short-term memory, helping you think further ahead during over-the-board play.
                            </p>
                            <p>
                              <strong>Focus and concentration:</strong> Without the board visible, you develop 
                              deeper concentration habits that transfer to tournament play.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {!showBotSelection ? (
                      <>
                        <h2 className="text-lg md:text-xl font-semibold">Find Opponent</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <Button 
                            variant="outline"
                            size="lg"
                            className="min-h-11"
                            onClick={() => handleJoinQueue('blitz')}
                            disabled={!isConnected}
                            data-testid="button-queue-blitz"
                          >
                            <Clock className="mr-2 h-4 w-4" />
                            Blitz (5 min)
                          </Button>
                          <Button 
                            variant="outline"
                            size="lg"
                            className="min-h-11"
                            onClick={() => handleJoinQueue('rapid')}
                            disabled={!isConnected}
                            data-testid="button-queue-rapid"
                          >
                            <Clock className="mr-2 h-4 w-4" />
                            Rapid (15 min)
                          </Button>
                        </div>
                        
                        <div className="pt-4 border-t">
                          <h2 className="text-lg md:text-xl font-semibold mb-3">Practice vs Bot</h2>
                          <Button 
                            variant="default"
                            size="lg"
                            className="w-full min-h-11"
                            onClick={() => setShowBotSelection(true)}
                            data-testid="button-play-bot"
                          >
                            <Bot className="mr-2 h-4 w-4" />
                            Choose Bot Opponent
                          </Button>
                        </div>
                      </>
                    ) : !selectedBotDifficulty ? (
                      <>
                        <div className="flex items-center gap-2 mb-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setShowBotSelection(false);
                              setSelectedBotDifficulty(null);
                            }}
                            data-testid="button-back-from-bots"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <h2 className="text-lg md:text-xl font-semibold">Select Difficulty</h2>
                        </div>
                        
                        <div className="flex gap-2 mb-4">
                          <Button
                            variant={botTimeControl === "blitz" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setBotTimeControl("blitz")}
                            data-testid="button-bot-blitz"
                          >
                            <Clock className="mr-1 h-3 w-3" />
                            Blitz (5 min)
                          </Button>
                          <Button
                            variant={botTimeControl === "rapid" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setBotTimeControl("rapid")}
                            data-testid="button-bot-rapid"
                          >
                            <Clock className="mr-1 h-3 w-3" />
                            Rapid (15+0)
                          </Button>
                        </div>
                        
                        <div className="grid grid-cols-1 gap-2">
                          {ALL_DIFFICULTIES.map((difficulty) => (
                            <Card 
                              key={difficulty}
                              className="cursor-pointer hover-elevate"
                              onClick={() => setSelectedBotDifficulty(difficulty)}
                              data-testid={`card-difficulty-${difficulty}`}
                            >
                              <CardContent className="p-3">
                                <div className="flex items-center justify-between">
                                  <span className="font-semibold">{BOT_DIFFICULTY_NAMES[difficulty]}</span>
                                  <Badge variant="secondary">
                                    {BOT_DIFFICULTY_ELO[difficulty]} Elo
                                  </Badge>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
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
                          <h2 className="text-lg md:text-xl font-semibold">Select Playstyle</h2>
                          <Badge variant="secondary" className="ml-auto">
                            {BOT_DIFFICULTY_ELO[selectedBotDifficulty]} Elo
                          </Badge>
                        </div>
                        
                        <p className="text-sm text-muted-foreground mb-4">
                          Choose your {BOT_DIFFICULTY_NAMES[selectedBotDifficulty]} opponent's playstyle
                        </p>
                        
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
                                      <div className="flex items-center gap-2">
                                        <span className="font-semibold">{BOT_PERSONALITY_NAMES[personality]}</span>
                                      </div>
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
                          <h2 className="text-lg md:text-xl font-semibold">Choose Your Color</h2>
                          <Badge variant="secondary" className="ml-auto">
                            {BOT_DIFFICULTY_ELO[selectedBotDifficulty]} Elo
                          </Badge>
                        </div>
                        
                        <p className="text-sm text-muted-foreground mb-4">
                          Playing against {selectedBotPersonality.name}
                        </p>
                        
                        <div className="grid grid-cols-1 gap-3">
                          <Card 
                            className="cursor-pointer hover-elevate"
                            onClick={() => handleStartBotGame(selectedBotPersonality, "white")}
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
                            onClick={() => handleStartBotGame(selectedBotPersonality, "black")}
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
                            onClick={() => handleStartBotGame(selectedBotPersonality, "random")}
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
              ) : (
                <Card>
                  <CardContent className="pt-6 space-y-4 text-center">
                    <h2 className="text-xl font-semibold">Searching for Opponent</h2>
                    <div className="flex justify-center py-8">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                    </div>
                    <p className="text-muted-foreground">Open another browser window and queue up to play against yourself!</p>
                    <Button 
                      variant="outline" 
                      onClick={handleLeaveQueue}
                      className="w-full"
                      data-testid="button-leave-queue"
                    >
                      Cancel
                    </Button>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Card className={`${game && ((playerColor === "white" && game.turn() === "b") || (playerColor === "black" && game.turn() === "w")) ? "ring-2 ring-primary" : ""}`}>
                  <CardContent className="py-2 px-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${playerColor === "white" ? "bg-black" : "bg-white border border-gray-400"}`} />
                        {isBotGame && <Bot className="h-4 w-4 text-primary" />}
                        <span className="font-medium text-sm" data-testid="text-opponent-name">{opponentName}</span>
                        <span className="text-xs text-muted-foreground" data-testid="text-opponent-rating">({opponentRating})</span>
                        {botThinking && (
                          <span className="text-xs text-primary animate-pulse" data-testid="text-bot-thinking">
                            thinking...
                          </span>
                        )}
                      </div>
                      <div className={`text-2xl font-mono font-bold ${
                        game && ((playerColor === "white" && game.turn() === "b") || (playerColor === "black" && game.turn() === "w")) ? "text-foreground" : "text-muted-foreground"
                      }`} data-testid={playerColor === "white" ? "text-black-time" : "text-white-time"}>
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
                        enableArrows={true}
                        enablePremoves={!isBotGame}
                        isPlayerTurn={game ? ((game.turn() === "w" && playerColor === "white") || (game.turn() === "b" && playerColor === "black")) : true}
                        premove={premove}
                        onPremove={setPremove}
                        arrowDrawMode={arrowDrawMode}
                        noCard={true}
                      />
                      
                      {isBlindfold && !isPeeking && (
                        <div className="absolute inset-0 bg-black pointer-events-none overflow-visible">
                          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 8 8" preserveAspectRatio="none">
                            {Array.from({ length: 9 }).map((_, i) => (
                              <line
                                key={`h-${i}`}
                                x1="0"
                                y1={i}
                                x2="8"
                                y2={i}
                                stroke="white"
                                strokeWidth="0.02"
                              />
                            ))}
                            {Array.from({ length: 9 }).map((_, i) => (
                              <line
                                key={`v-${i}`}
                                x1={i}
                                y1="0"
                                x2={i}
                                y2="8"
                                stroke="white"
                                strokeWidth="0.02"
                              />
                            ))}
                          </svg>
                          {userSettings?.blindfoldShowCoordinates && (
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
                                    data-testid={`tile-label-${squareName}`}
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
                  
                  {isBlindfold && (
                    <div className="flex flex-col justify-center gap-4">
                      {(userSettings?.blindfoldDifficulty !== 'grandmaster') && (
                        <div className="flex flex-col items-center gap-2">
                          <div
                            ref={peekButtonRef}
                            role="button"
                            tabIndex={remainingPeeks === 0 ? -1 : 0}
                            onMouseDown={handlePeekStart}
                            onMouseUp={handlePeekEnd}
                            onMouseLeave={handlePeekEnd}
                            onTouchStart={handlePeekStart}
                            onTouchEnd={handlePeekEnd}
                            onTouchCancel={handlePeekEnd}
                            onKeyDown={handlePeekKeyDown}
                            className={`inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-10 px-6 select-none cursor-pointer ${
                              remainingPeeks === 0 
                                ? "pointer-events-none opacity-50 border border-input bg-background" 
                                : isPeeking 
                                  ? "bg-primary text-primary-foreground shadow hover:bg-primary/90" 
                                  : "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground"
                            }`}
                            aria-disabled={remainingPeeks === 0}
                            data-testid="button-peek"
                          >
                            <Eye className="mr-2 h-5 w-5" />
                            {isPeeking ? "Peeking..." : "Hold to Peek"}
                          </div>
                          <div className="text-sm text-muted-foreground text-center" data-testid="text-remaining-peeks">
                            {!isFinite(remainingPeeks) ? (
                              <span className="flex items-center gap-1">
                                <InfinityIcon className="h-4 w-4" /> peeks left
                              </span>
                            ) : (
                              <span>{remainingPeeks} peeks left</span>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {userSettings?.voiceInputEnabled && (
                        <div className="flex flex-col items-center gap-2">
                          <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${isVoiceListening ? 'bg-primary/10 border border-primary' : 'bg-muted'}`} data-testid="voice-status">
                            {isVoiceListening ? (
                              <>
                                <Mic className="h-5 w-5 text-primary animate-pulse" />
                                <span className="text-sm font-medium">Listening...</span>
                              </>
                            ) : (
                              <>
                                <MicOff className="h-5 w-5 text-muted-foreground" />
                                <span className="text-sm text-muted-foreground">Voice off</span>
                              </>
                            )}
                          </div>
                          {voiceTranscript && (
                            <div className="text-sm text-muted-foreground italic text-center">
                              "{voiceTranscript}"
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                <Card className={`${game && ((playerColor === "white" && game.turn() === "w") || (playerColor === "black" && game.turn() === "b")) ? "ring-2 ring-primary" : ""}`}>
                  <CardContent className="py-2 px-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${playerColor === "white" ? "bg-white border border-gray-400" : "bg-black"}`} />
                        <span className="font-medium text-sm" data-testid="text-player-name">{playerName}</span>
                        <span className="text-xs text-muted-foreground" data-testid="text-player-rating">({playerRating})</span>
                        <Badge variant="outline" className="text-xs py-0">You</Badge>
                      </div>
                      <div className={`text-2xl font-mono font-bold ${
                        game && ((playerColor === "white" && game.turn() === "w") || (playerColor === "black" && game.turn() === "b")) ? "text-foreground" : "text-muted-foreground"
                      }`} data-testid={playerColor === "white" ? "text-white-time" : "text-black-time"}>
                        {formatTime(playerColor === "white" ? whiteTime : blackTime)}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardContent className="py-4 md:py-6 space-y-3">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button 
                      variant="outline" 
                      className="flex-1" 
                      onClick={handleOfferDraw} 
                      disabled={waitingForDrawResponse}
                      data-testid="button-offer-draw"
                    >
                      <HandshakeIcon className="mr-2 h-4 w-4" />
                      {waitingForDrawResponse ? "Waiting..." : "Offer Draw"}
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" className="flex-1" data-testid="button-resign">
                          <Flag className="mr-2 h-4 w-4" />
                          Resign
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Resign Game?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to resign? This will count as a loss.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel data-testid="button-resign-cancel">Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handleResign} data-testid="button-resign-confirm">
                            Yes, Resign
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>

      {gameStarted && (
        <div className="w-full md:w-80 md:max-h-screen border-t md:border-t-0 md:border-l bg-card flex flex-col">
          {isBlindfold ? (
            <>
              <div className="p-4 border-b">
                <h3 className="font-semibold">Last Move</h3>
              </div>
              <div className="flex-1 p-4">
                {(() => {
                  // Compute both your last move and opponent's last move
                  let myLastMove: string | null = null;
                  let opponentLastMove: string | null = null;
                  
                  if (moves.length > 0 && (matchId || isBotGame) && playerColor) {
                    const myColor = playerColor === "white" ? 'w' : 'b';
                    
                    // Find your last move and opponent's last move
                    for (let i = moves.length - 1; i >= 0; i--) {
                      const moveIsWhite = i % 2 === 0;
                      const moveColor = moveIsWhite ? 'w' : 'b';
                      
                      if (moveColor === myColor && myLastMove === null) {
                        myLastMove = moves[i];
                      } else if (moveColor !== myColor && opponentLastMove === null) {
                        opponentLastMove = moves[i];
                      }
                      
                      // Stop once we have both
                      if (myLastMove && opponentLastMove) break;
                    }
                  }
                  
                  if (moves.length === 0) {
                    return (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        No moves yet
                      </p>
                    );
                  }
                  
                  return (
                    <Card className="bg-muted/50">
                      <CardContent className="p-4 space-y-4">
                        {myLastMove && (
                          <div>
                            <div className="text-sm text-muted-foreground mb-1">
                              Your move:
                            </div>
                            <div className="font-mono text-2xl font-semibold" data-testid="text-your-last-move">
                              {myLastMove}
                            </div>
                          </div>
                        )}
                        
                        <div>
                          {opponentLastMove ? (
                            <>
                              <div className="text-sm text-muted-foreground mb-1">
                                Opponent's move:
                              </div>
                              <div className="font-mono text-2xl font-semibold" data-testid="text-last-opponent-move">
                                {opponentLastMove}
                              </div>
                            </>
                          ) : (
                            <div className="text-sm text-muted-foreground italic text-center">
                              Waiting for opponent...
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })()}
              </div>
            </>
          ) : (
            <>
              <div className="p-4 border-b">
                <h3 className="font-semibold">Score Sheet</h3>
              </div>
              <ScrollArea className="flex-1 p-4">
                {moves.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No moves yet
                  </p>
                ) : (
                  <div className="font-mono text-sm">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-2 w-12 text-muted-foreground font-medium">#</th>
                          <th className="text-left py-2 px-2 font-medium">White</th>
                          <th className="text-left py-2 px-2 font-medium">Black</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.from({ length: Math.ceil(moves.length / 2) }).map((_, moveNumber) => {
                          const whiteMove = moves[moveNumber * 2];
                          const blackMove = moves[moveNumber * 2 + 1];
                          
                          return (
                            <tr key={moveNumber} className="border-b border-border/50">
                              <td className="py-2 px-2 text-muted-foreground">{moveNumber + 1}</td>
                              <td className="py-2 px-2">{whiteMove || "-"}</td>
                              <td className="py-2 px-2">{blackMove || "-"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </ScrollArea>
            </>
          )}
        </div>
      )}

      {/* Draw Offer Dialog */}
      <Dialog open={showDrawOfferDialog} onOpenChange={setShowDrawOfferDialog}>
        <DialogContent data-testid="dialog-draw-offer">
          <DialogHeader>
            <DialogTitle>Draw Offer</DialogTitle>
            <DialogDescription>
              Your opponent is offering a draw. Do you accept?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                if (matchId) sendDrawResponse(matchId, false);
                setShowDrawOfferDialog(false);
              }}
              data-testid="button-decline-draw"
            >
              Decline
            </Button>
            <Button
              onClick={async () => {
                if (matchId) {
                  // Close dialog immediately
                  setShowDrawOfferDialog(false);
                  
                  // Send acceptance to opponent
                  sendDrawResponse(matchId, true);
                  
                  // Complete the game
                  await completeGame("draw");
                }
              }}
              data-testid="button-accept-draw"
            >
              Accept
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rematch Request Dialog */}
      <Dialog open={showRematchDialog} onOpenChange={(open) => {
        // Don't allow closing while waiting for response
        if (!waitingForRematchResponse) {
          setShowRematchDialog(open);
        }
      }}>
        <DialogContent data-testid="dialog-rematch-request">
          <DialogHeader>
            <DialogTitle>Rematch Request</DialogTitle>
            <DialogDescription>
              {waitingForRematchResponse ? "Creating rematch..." : "Your opponent wants to play again."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={() => {
                  if (matchId) {
                    sendRematchResponse(matchId, true);
                    setWaitingForRematchResponse(true);
                  }
                }}
                disabled={waitingForRematchResponse}
                data-testid="button-accept-rematch"
              >
                Yes
              </Button>
              <Button
                className="flex-1"
                variant="outline"
                onClick={() => {
                  if (matchId) sendRematchResponse(matchId, false);
                  setShowRematchDialog(false);
                }}
                disabled={waitingForRematchResponse}
                data-testid="button-decline-rematch"
              >
                No
              </Button>
            </div>
            <Button
              variant="secondary"
              onClick={() => {
                if (matchId) sendRematchResponse(matchId, false);
                // Mark exit intent so response handler ignores late responses
                rematchExitIntentRef.current = true;
                setShowRematchDialog(false);
                setShowGameEndDialog(false);
                resetGameState();
                setLocation('/');
              }}
              disabled={waitingForRematchResponse}
              data-testid="button-rematch-main-menu"
            >
              Main Menu
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Game End Dialog */}
      <Dialog open={showGameEndDialog} onOpenChange={setShowGameEndDialog}>
        <DialogContent data-testid="dialog-game-end">
          <DialogHeader>
            <DialogTitle>Game Over</DialogTitle>
            <DialogDescription>
              {gameResult === "draw" 
                ? "The game ended in a draw"
                : gameResult === "white_win"
                ? "White wins!"
                : "Black wins!"}
              {ratingChange !== null && !isBotGame && (
                <span className={`block mt-1 font-medium ${ratingChange >= 0 ? 'text-green-500' : 'text-red-500'}`} data-testid="text-rating-change">
                  {ratingChange >= 0 ? '+' : ''}{ratingChange} rating
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowGameEndDialog(false);
                  resetGameState();
                  setLocation('/');
                }}
                data-testid="button-main-menu"
              >
                Main Menu
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  if (matchId) {
                    setWaitingForRematchResponse(true);
                    didSendRematchRequestRef.current = true;
                    console.log('[Rematch Button] Set didSendRematchRequestRef to true');
                    sendRematchRequest(matchId);
                    toast({
                      title: "Rematch requested",
                      description: "Waiting for opponent...",
                    });
                  }
                }}
                disabled={waitingForRematchResponse || rematchDenied || isBotGame}
                data-testid="button-request-rematch"
              >
                {waitingForRematchResponse ? "Waiting..." : "Ask for Rematch"}
              </Button>
            </div>
            <Button
              variant="secondary"
              onClick={() => {
                if (gameId) {
                  setShowGameEndDialog(false);
                  resetGameState();
                  setLocation(`/analysis/${gameId}`);
                }
              }}
              disabled={!gameId}
              data-testid="button-analyze-game"
            >
              <BarChart3 className="w-4 h-4 mr-2" />
              Analyze Game
            </Button>
            {!isBotGame && opponentId && (
              <div className="mt-2 text-center">
                <ReportPlayerDialog
                  reportedUserId={opponentId}
                  reportedUserName={opponentName}
                  gameId={gameId || undefined}
                  trigger={
                    <span 
                      className="text-xs text-muted-foreground cursor-pointer hover:underline"
                      data-testid="link-report-player"
                    >
                      Report player
                    </span>
                  }
                />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <PromotionDialog
        open={!!pendingPromotion}
        color={playerColor}
        onSelect={handlePromotionSelect}
      />
    </div>
  );
}
