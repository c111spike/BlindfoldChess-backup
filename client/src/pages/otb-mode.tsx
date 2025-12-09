import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Chess } from "chess.js";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useWebSocket } from "@/hooks/useWebSocket";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ChessBoard } from "@/components/chess-board";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, Play, HandshakeIcon, Flag, AlertTriangle, Settings, Gavel, XCircle, CheckCircle, Trophy, Bot, ChevronLeft, BarChart3, Crown, Shuffle, MessageSquareWarning, Ban } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PromotionDialog } from "@/components/promotion-dialog";
import type { Game } from "@shared/schema";
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

const INITIAL_BOARD = [
  ["r", "n", "b", "q", "k", "b", "n", "r"],
  ["p", "p", "p", "p", "p", "p", "p", "p"],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  ["P", "P", "P", "P", "P", "P", "P", "P"],
  ["R", "N", "B", "Q", "K", "B", "N", "R"],
];

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"];

interface MoveRecord {
  from: string;
  to: string;
  piece: string;
  captured?: string;
  promotion?: string;
  notation: string;
  timestamp: number;
}

export default function OTBMode() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [game, setGame] = useState<Chess | null>(null);
  const [gameId, setGameId] = useState<string | null>(null);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [whiteTime, setWhiteTime] = useState(180);
  const [blackTime, setBlackTime] = useState(180);
  const [activeColor, setActiveColor] = useState<"white" | "black">("white");
  const [playerColor, setPlayerColor] = useState<"white" | "black">("white");
  const [timeControl, setTimeControl] = useState("5");
  const [increment, setIncrement] = useState(0);
  const [moves, setMoves] = useState<MoveRecord[]>([]);
  const [boardState, setBoardState] = useState<(string | null)[][]>(INITIAL_BOARD.map(row => [...row]));
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [clockPresses, setClockPresses] = useState(0);
  const [restoredGame, setRestoredGame] = useState(false);
  const [inQueue, setInQueue] = useState(false);
  const [queueType, setQueueType] = useState<string | null>(null);
  const [opponentTouchedSquare, setOpponentTouchedSquare] = useState<string | null>(null);
  const [lastMoveSquares, setLastMoveSquares] = useState<string[]>([]);
  const [showLegalMoves, setShowLegalMoves] = useState(false);
  const [highlightLastMove, setHighlightLastMove] = useState(true);
  
  const [myViolations, setMyViolations] = useState({ unsportsmanlike: 0, illegal: 0, distraction: 0 });
  const [opponentViolations, setOpponentViolations] = useState({ unsportsmanlike: 0, illegal: 0, distraction: 0 });
  const [myFalseClaims, setMyFalseClaims] = useState({ unsportsmanlike: 0, illegal: 0, distraction: 0 });
  const [opponentFalseClaims, setOpponentFalseClaims] = useState({ unsportsmanlike: 0, illegal: 0, distraction: 0 });
  const [arbiterPending, setArbiterPending] = useState(false);
  const [arbiterDialogOpen, setArbiterDialogOpen] = useState(false);
  const [arbiterDialogTimer, setArbiterDialogTimer] = useState(15);
  
  const [myHandshakeOffered, setMyHandshakeOffered] = useState(false);
  const [opponentHandshakeOffered, setOpponentHandshakeOffered] = useState(false);
  const [handshakeComplete, setHandshakeComplete] = useState(false);
  const [showHandshakeUI, setShowHandshakeUI] = useState(false);
  const [myHandshakeBeforeFirstMove, setMyHandshakeBeforeFirstMove] = useState(false);
  const [opponentHandshakeBeforeFirstMove, setOpponentHandshakeBeforeFirstMove] = useState(false);
  const [opponentHandshakeViolation, setOpponentHandshakeViolation] = useState(false);
  
  const [touchedPiece, setTouchedPiece] = useState<string | null>(null);
  const [arbiterResult, setArbiterResult] = useState<{
    type: "illegal" | "legal" | null;
    message: string;
  } | null>(null);
  const [pendingCheckmate, setPendingCheckmate] = useState<{
    winner: "white" | "black";
    countdown: number;
  } | null>(null);
  const [legalChessGame, setLegalChessGame] = useState<Chess | null>(null);
  const [opponentName, setOpponentName] = useState<string>("Opponent");
  const [opponentRating, setOpponentRating] = useState<number>(1200);
  const [playerRating, setPlayerRating] = useState<number>(1200);
  const [clockTurn, setClockTurn] = useState<"white" | "black">("white");
  const [hasMadeMove, setHasMadeMove] = useState(false);
  const [pendingPromotion, setPendingPromotion] = useState<{
    from: string;
    to: string;
    fromRank: number;
    fromFile: number;
    toRank: number;
    toFile: number;
    piece: string;
    captured: string | null;
  } | null>(null);
  const [gameResult, setGameResult] = useState<"white_win" | "black_win" | "draw" | null>(null);
  
  const [showBotSelection, setShowBotSelection] = useState(false);
  const [selectedBot, setSelectedBot] = useState<BotProfile | null>(null);
  const [isBotGame, setIsBotGame] = useState(false);
  const [botThinking, setBotThinking] = useState(false);
  const [selectedBotDifficulty, setSelectedBotDifficulty] = useState<BotDifficulty | null>(null);
  const [selectedBotPersonality, setSelectedBotPersonality] = useState<BotProfile | null>(null);
  
  const gameRef = useRef<Chess | null>(null);
  const gameIdRef = useRef<string | null>(null);
  const whiteTimeRef = useRef(180);
  const blackTimeRef = useRef(180);
  const saveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pendingCheckmateRef = useRef<NodeJS.Timeout | null>(null);
  const handleGameEndRef = useRef<((result: "white_win" | "black_win" | "draw") => void) | null>(null);
  const arbiterTimerRef = useRef<NodeJS.Timeout | null>(null);
  const gameStartTimeRef = useRef<number | null>(null);

  useEffect(() => {
    gameRef.current = game;
    gameIdRef.current = gameId;
    whiteTimeRef.current = whiteTime;
    blackTimeRef.current = blackTime;
  }, [game, gameId, whiteTime, blackTime]);

  const squareToIndices = (square: string): { rank: number; file: number } => {
    const file = FILES.indexOf(square[0]);
    const rank = RANKS.indexOf(square[1]);
    return { rank, file };
  };

  const indicesToSquare = (rank: number, file: number): string => {
    return `${FILES[file]}${RANKS[rank]}`;
  };

  const boardToFen = (board: (string | null)[][], turn: "white" | "black"): string => {
    let fen = "";
    for (let rank = 0; rank < 8; rank++) {
      let emptyCount = 0;
      for (let file = 0; file < 8; file++) {
        const piece = board[rank][file];
        if (piece) {
          if (emptyCount > 0) {
            fen += emptyCount;
            emptyCount = 0;
          }
          fen += piece;
        } else {
          emptyCount++;
        }
      }
      if (emptyCount > 0) {
        fen += emptyCount;
      }
      if (rank < 7) fen += "/";
    }
    fen += ` ${turn === "white" ? "w" : "b"} KQkq - 0 1`;
    return fen;
  };

  const getPieceColor = (piece: string | null): "white" | "black" | null => {
    if (!piece) return null;
    return piece === piece.toUpperCase() ? "white" : "black";
  };

  const handleOpponentMove = useCallback((data: { matchId: string; move: string; fen: string; whiteTime: number; blackTime: number; from?: string; to?: string; piece?: string; captured?: string; promotion?: string }) => {
    if (data.matchId !== matchId) return;
    
    console.log('[OTB] Received opponent message:', data.move);
    
    // Handle clock press message - opponent pressed their clock, now it's our turn
    if (data.move === "__CLOCK_PRESS__") {
      console.log('[OTB] Opponent pressed clock, switching turn');
      setClockTurn(playerColor);
      setActiveColor(playerColor);
      setHasMadeMove(false);
      setWhiteTime(data.whiteTime);
      setBlackTime(data.blackTime);
      setOpponentTouchedSquare(null);
      return;
    }
    
    // Handle regular move
    if (data.from && data.to) {
      const { rank: fromRank, file: fromFile } = squareToIndices(data.from);
      const { rank: toRank, file: toFile } = squareToIndices(data.to);
      
      setBoardState(prev => {
        const newBoard = prev.map(row => [...row]);
        const piece = newBoard[fromRank][fromFile];
        newBoard[fromRank][fromFile] = null;
        // If there's a promotion piece, use that instead of the original pawn
        newBoard[toRank][toFile] = data.promotion || piece;
        return newBoard;
      });
      
      setMoves(prev => {
        const newMoves = [...prev, {
          from: data.from!,
          to: data.to!,
          piece: data.piece || "?",
          captured: data.captured,
          promotion: data.promotion,
          notation: data.move,
          timestamp: Date.now(),
        }];
        
        // Check if this is opponent's first move and track handshake violation
        // Opponent is black if we're white: black's first move is when newMoves.length === 2
        // Opponent is white if we're black: white's first move is when newMoves.length === 1
        const isOpponentFirstMove = (playerColor === "white" && newMoves.length === 2) ||
                                    (playerColor === "black" && newMoves.length === 1);
        if (isOpponentFirstMove && !opponentHandshakeOffered) {
          setOpponentHandshakeViolation(true);
        }
        
        return newMoves;
      });
      
      setLastMoveSquares([data.from, data.to]);
      
      if (data.captured?.toLowerCase() === "k") {
        setPendingCheckmate({
          winner: data.captured === "K" ? "black" : "white",
          countdown: 5,
        });
      }
    }
    
    setWhiteTime(data.whiteTime);
    setBlackTime(data.blackTime);
    setOpponentTouchedSquare(null);
    
    toast({
      title: "Opponent moved",
      description: data.move,
    });
  }, [matchId, toast, playerColor]);

  const handleOpponentTouch = useCallback((data: { matchId: string; square: string }) => {
    if (data.matchId !== matchId) return;
    setOpponentTouchedSquare(data.square);
  }, [matchId]);

  const handleArbiterCall = useCallback((data: { matchId: string; callerId: string; moveIndex: number }) => {
    if (data.matchId !== matchId) return;
    
    setArbiterPending(true);
    toast({
      title: "Arbiter Called!",
      description: "Opponent is disputing the last move...",
    });
  }, [matchId, toast]);

  const handleArbiterRuling = useCallback((data: { 
    matchId: string; 
    ruling: "illegal" | "legal"; 
    violatorId: string;
    timeAdjustment: { white: number; black: number };
    forfeit?: boolean;
    forfeitReason?: string;
  }) => {
    if (data.matchId !== matchId) return;
    
    setArbiterPending(false);
    
    if (data.forfeit) {
      toast({
        title: "Game Over - Forfeit",
        description: data.forfeitReason || "Forfeit due to violations",
        variant: "destructive",
      });
      
      // Use ref to access latest handleGameEnd
      const result = data.violatorId === user?.id ? 
        (playerColor === "white" ? "black_win" : "white_win") : 
        (playerColor === "white" ? "white_win" : "black_win");
      
      if (handleGameEndRef.current) {
        handleGameEndRef.current(result);
      }
      return;
    }
    
    setWhiteTime(prev => prev + data.timeAdjustment.white);
    setBlackTime(prev => prev + data.timeAdjustment.black);
    
    if (data.ruling === "illegal") {
      // Reset the board for BOTH players when a move is ruled illegal
      if (moves.length > 0) {
        const lastMove = moves[moves.length - 1];
        const { rank: fromRank, file: fromFile } = squareToIndices(lastMove.from);
        const { rank: toRank, file: toFile } = squareToIndices(lastMove.to);
        
        setBoardState(prev => {
          const newBoard = prev.map(row => [...row]);
          newBoard[fromRank][fromFile] = lastMove.piece;
          newBoard[toRank][toFile] = lastMove.captured || null;
          return newBoard;
        });
        
        setMoves(prev => prev.slice(0, -1));
        setLastMoveSquares([]);
        setActiveColor(prev => prev === "white" ? "black" : "white");
        setClockTurn(prev => prev === "white" ? "black" : "white");
        setHasMadeMove(false);
      }
      
      if (data.violatorId === user?.id) {
        setMyViolations(prev => ({ ...prev, illegal: prev.illegal + 1 }));
        setArbiterResult({ type: "illegal", message: "Your move was illegal! Opponent gains 2 minutes." });
      } else {
        setOpponentViolations(prev => ({ ...prev, illegal: prev.illegal + 1 }));
        setArbiterResult({ type: "illegal", message: "Opponent's move was illegal! You gain 2 minutes." });
      }
    } else {
      if (data.violatorId === user?.id) {
        setOpponentFalseClaims(prev => ({ ...prev, illegal: prev.illegal + 1 }));
        setArbiterResult({ type: "legal", message: "Move was legal! Opponent made a false claim. You gain 2 minutes." });
      } else {
        setMyFalseClaims(prev => ({ ...prev, illegal: prev.illegal + 1 }));
        setArbiterResult({ type: "legal", message: "Move was legal! False claim - opponent gains 2 minutes." });
      }
    }
    
    setTimeout(() => setArbiterResult(null), 4000);
  }, [matchId, user?.id, playerColor, moves, toast]);

  const handleOpponentGameEnd = useCallback((data: { result: string; reason: string }) => {
    console.log('[OTB] Opponent ended game:', data);
    
    if (saveIntervalRef.current) {
      clearInterval(saveIntervalRef.current);
      saveIntervalRef.current = null;
    }
    
    if (pendingCheckmateRef.current) {
      clearTimeout(pendingCheckmateRef.current);
      pendingCheckmateRef.current = null;
    }
    
    toast({
      title: "Game Over",
      description: data.reason,
    });
    
    // Keep board visible by setting gameResult
    const resultValue = data.result as "white_win" | "black_win" | "draw";
    setGameResult(resultValue);
    setPendingCheckmate(null);
    
    // Invalidate queries to refresh data
    queryClient.invalidateQueries({ queryKey: ["/api/ratings"] });
    queryClient.invalidateQueries({ queryKey: ["/api/games/recent"] });
    queryClient.invalidateQueries({ queryKey: ["/api/statistics"] });
  }, [toast]);

  const handleOpponentHandshake = useCallback((data: { matchId: string }) => {
    if (data.matchId !== matchId) return;
    console.log('[OTB] Opponent offered handshake');
    
    // Track if opponent offered handshake before their first move
    // Opponent is black if we're white: black hasn't moved yet if moves.length < 2
    // Opponent is white if we're black: white hasn't moved yet if moves.length < 1
    const opponentHasntMovedYet = (playerColor === "white" && moves.length < 2) ||
                                   (playerColor === "black" && moves.length < 1);
    if (opponentHasntMovedYet) {
      setOpponentHandshakeBeforeFirstMove(true);
    }
    
    setOpponentHandshakeOffered(true);
    
    if (myHandshakeOffered) {
      setHandshakeComplete(true);
      gameStartTimeRef.current = Date.now(); // Reset timer on handshake complete
      toast({ title: "Handshake complete!", description: "Good luck!" });
    }
  }, [matchId, playerColor, moves.length, myHandshakeOffered, toast]);
  
  // Handle receiving handshake state when joining a match (detect violations retroactively)
  const handleJoinedMatch = useCallback((data: { 
    matchId: string; 
    handshakeState: { 
      whiteOfferedHandshake: boolean; 
      blackOfferedHandshake: boolean; 
      whiteMoved: boolean; 
      blackMoved: boolean;
      whiteOfferedBeforeFirstMove: boolean;
      blackOfferedBeforeFirstMove: boolean;
    } | null 
  }) => {
    console.log('[OTB] Joined match, handshake state:', data.handshakeState);
    
    if (!data.handshakeState) return;
    
    const { 
      whiteOfferedHandshake, blackOfferedHandshake, 
      whiteMoved, blackMoved,
      whiteOfferedBeforeFirstMove, blackOfferedBeforeFirstMove
    } = data.handshakeState;
    
    if (playerColor === "white") {
      // Restore my own handshake state (I am white)
      if (whiteOfferedHandshake) {
        setMyHandshakeOffered(true);
      }
      // Server tracks if handshake was offered before first move
      if (whiteOfferedBeforeFirstMove) {
        setMyHandshakeBeforeFirstMove(true);
      }
      
      // Set opponent's handshake offer state (opponent is black)
      if (blackOfferedHandshake) {
        setOpponentHandshakeOffered(true);
      }
      if (blackOfferedBeforeFirstMove) {
        setOpponentHandshakeBeforeFirstMove(true);
      }
      
      // Detect if opponent (black) moved without offering handshake first
      if (blackMoved && !blackOfferedBeforeFirstMove) {
        setOpponentHandshakeViolation(true);
        console.log('[OTB] Detected handshake violation: Black moved without offering handshake first');
      }
    } else {
      // Restore my own handshake state (I am black)
      if (blackOfferedHandshake) {
        setMyHandshakeOffered(true);
      }
      if (blackOfferedBeforeFirstMove) {
        setMyHandshakeBeforeFirstMove(true);
      }
      
      // Set opponent's handshake offer state (opponent is white)
      if (whiteOfferedHandshake) {
        setOpponentHandshakeOffered(true);
      }
      if (whiteOfferedBeforeFirstMove) {
        setOpponentHandshakeBeforeFirstMove(true);
      }
      
      // Detect if opponent (white) moved without offering handshake first
      if (whiteMoved && !whiteOfferedBeforeFirstMove) {
        setOpponentHandshakeViolation(true);
        console.log('[OTB] Detected handshake violation: White moved without offering handshake first');
      }
    }
  }, [playerColor]);

  const { sendMove, sendPieceTouch, sendArbiterCall, sendArbiterRuling, sendGameEnd, sendHandshakeOffer, joinMatch, isConnected, isAuthenticated } = useWebSocket({
    userId: user?.id,
    matchId: matchId || undefined,
    onMove: handleOpponentMove,
    onPieceTouch: handleOpponentTouch,
    onArbiterCall: handleArbiterCall,
    onArbiterRuling: handleArbiterRuling,
    onGameEnd: handleOpponentGameEnd,
    onHandshakeOffer: handleOpponentHandshake,
    onJoinedMatch: handleJoinedMatch,
  });

  useEffect(() => {
    if (matchId && isConnected && isAuthenticated) {
      console.log('[OTB] Joining match room:', matchId);
      joinMatch(matchId);
    }
  }, [matchId, isConnected, isAuthenticated, joinMatch]);

  const createGameMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/games", data);
      return await response.json();
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
      if (!gameId) return;
      await apiRequest("PATCH", `/api/games/${gameId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ratings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/games/recent"] });
      queryClient.invalidateQueries({ queryKey: ["/api/statistics"] });
    },
  });

  const { data: ongoingGame } = useQuery<Game>({
    queryKey: ["/api/games/ongoing"],
    enabled: !restoredGame && !gameStarted && !inQueue,
  });

  const joinQueueMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/queue/join", data);
      return response;
    },
    onSuccess: () => {
      setInQueue(true);
      toast({
        title: "Joined queue",
        description: "Waiting for opponent...",
      });
      pollMatch();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to join queue",
        variant: "destructive",
      });
    },
  });

  const leaveQueueMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", "/api/queue/leave", data);
    },
    onSuccess: () => {
      setInQueue(false);
      setQueueType(null);
      toast({
        title: "Left queue",
      });
    },
  });

  const pollMatch = useCallback(async () => {
    let attempts = 0;
    const maxAttempts = 120;
    
    const checkMatch = async () => {
      if (attempts >= maxAttempts) return;
      attempts++;

      try {
        const res = await apiRequest("POST", "/api/queue/findMatch", { queueType });
        const response = await res.json();
        if (response.matched && response.game) {
          if (!response.matchId) {
            toast({
              title: "Match Error",
              description: "Failed to join match room. Please try again.",
              variant: "destructive",
            });
            setInQueue(false);
            return;
          }
          
          setGameId(response.game.id);
          setMatchId(response.matchId);
          
          const chess = new Chess();
          setGame(chess);
          setLegalChessGame(new Chess());
          setBoardState(INITIAL_BOARD.map(row => [...row]));
          setMoves([]);
          setLastMoveSquares([]);
          setSelectedSquare(null);
          setGameResult(null);
          setGameStarted(true);
          setInQueue(false);
          gameStartTimeRef.current = Date.now(); // Track game start for first move timing
          const assignedColor = response.game.playerColor === "white" ? "white" : "black";
          setPlayerColor(assignedColor);
          setActiveColor("white");
          setClockTurn("white");
          
          setWhiteTime(response.game.whiteTime || 300);
          setBlackTime(response.game.blackTime || 300);
          setIncrement(response.game.increment || 0);
          
          setMyViolations({ unsportsmanlike: 0, illegal: 0, distraction: 0 });
          setOpponentViolations({ unsportsmanlike: 0, illegal: 0, distraction: 0 });
          setMyFalseClaims({ unsportsmanlike: 0, illegal: 0, distraction: 0 });
          setOpponentFalseClaims({ unsportsmanlike: 0, illegal: 0, distraction: 0 });
          setMyHandshakeOffered(false);
          setOpponentHandshakeOffered(false);
          setHandshakeComplete(false);
          setShowHandshakeUI(true);
          setMyHandshakeBeforeFirstMove(false);
          setOpponentHandshakeBeforeFirstMove(false);
          setOpponentHandshakeViolation(false);
          setTouchedPiece(null);
          setHasMadeMove(false);
          setPendingCheckmate(null);
          setArbiterPending(false);
          setArbiterResult(null);
          
          if (response.opponent) {
            setOpponentName(response.opponent.name || "Opponent");
            setOpponentRating(response.opponent.rating || 1200);
          }
          if (response.playerRating) {
            setPlayerRating(response.playerRating);
          }

          toast({
            title: "Match found!",
            description: `You are playing as ${assignedColor}`,
          });
          return;
        }
      } catch (error) {
        console.error("Error checking match:", error);
      }

      setTimeout(checkMatch, 1000);
    };

    checkMatch();
  }, [queueType, toast]);

  const handleJoinQueue = (time: string) => {
    const queueMap: Record<string, string> = {
      '1': 'otb_bullet',
      '5': 'otb_blitz',
      '15': 'otb_rapid',
      '30': 'otb_classical',
    };

    const queue = queueMap[time];
    setQueueType(queue);
    joinQueueMutation.mutate({ queueType: queue, isBlindfold: false });
  };

  useEffect(() => {
    if (ongoingGame && !restoredGame && !gameStarted && ongoingGame.status === 'active') {
      setGameResult(null);
      setRestoredGame(true);
    }
  }, [ongoingGame, restoredGame, gameStarted]);

  const saveGameState = useCallback(async () => {
    const currentGameId = gameIdRef.current;
    
    if (!currentGameId) return;
    
    try {
      const fen = boardToFen(boardState, activeColor);
      await apiRequest("PATCH", `/api/games/${currentGameId}`, {
        fen,
        moves: moves.map(m => m.notation),
        whiteTime: whiteTimeRef.current,
        blackTime: blackTimeRef.current,
      });
    } catch (error) {
      console.error("Error saving game state:", error);
    }
  }, [boardState, activeColor, moves]);

  const handleGameEnd = useCallback((result: "white_win" | "black_win" | "draw") => {
    if (!gameId) return;

    if (saveIntervalRef.current) {
      clearInterval(saveIntervalRef.current);
      saveIntervalRef.current = null;
    }
    
    if (pendingCheckmateRef.current) {
      clearTimeout(pendingCheckmateRef.current);
      pendingCheckmateRef.current = null;
    }

    const fen = boardToFen(boardState, activeColor);
    
    // Convert OTB move records to proper SAN notation for analysis
    // OTB stores moves as {from, to, piece, captured, promotion} which we need to convert to SAN
    const sanMoves: string[] = [];
    const replayChess = new Chess();
    
    for (const move of moves) {
      try {
        // Try to make the move using from/to squares
        const moveResult = replayChess.move({
          from: move.from,
          to: move.to,
          promotion: move.promotion?.toLowerCase() as 'q' | 'r' | 'b' | 'n' | undefined,
        });
        
        if (moveResult) {
          // chess.js returns the SAN notation in the result
          sanMoves.push(moveResult.san);
        } else {
          // If move fails in chess.js, fall back to the custom notation
          // This might happen for illegal moves in OTB mode
          console.warn('[OTB] Could not convert move to SAN, using custom notation:', move.notation);
          sanMoves.push(move.notation);
        }
      } catch (error) {
        console.warn('[OTB] Error converting move to SAN:', move.notation, error);
        sanMoves.push(move.notation);
      }
    }
    
    console.log('[OTB] Converted moves to SAN:', sanMoves);
    
    // Calculate thinking times from move timestamps
    // Each move's thinking time is the difference from the previous move (or game start)
    const thinkingTimes: number[] = [];
    for (let i = 0; i < moves.length; i++) {
      if (i === 0) {
        // First move - use game start time if available
        if (gameStartTimeRef.current) {
          const timeDiff = (moves[i].timestamp - gameStartTimeRef.current) / 1000;
          thinkingTimes.push(Math.max(0, timeDiff));
        } else {
          thinkingTimes.push(0);
        }
      } else {
        const timeDiff = (moves[i].timestamp - moves[i - 1].timestamp) / 1000;
        thinkingTimes.push(Math.max(0, timeDiff));
      }
    }
    
    console.log('[OTB] Calculated thinking times:', thinkingTimes);
    
    updateGameMutation.mutate({
      status: "completed",
      result,
      completedAt: new Date(),
      fen,
      moves: sanMoves,
      whiteTime,
      blackTime,
      thinkingTimes,
      manualClockPresses: clockPresses,
    });

    toast({
      title: "Game Over",
      description: result === "draw" ? "Game drawn" : result === "white_win" ? "White wins!" : "Black wins!",
    });

    // Keep board visible by setting gameResult instead of immediately hiding
    setGameResult(result);
    setPendingCheckmate(null);
  }, [gameId, boardState, activeColor, updateGameMutation, moves, whiteTime, blackTime, clockPresses, toast]);

  // Keep ref updated with latest handleGameEnd
  useEffect(() => {
    handleGameEndRef.current = handleGameEnd;
  }, [handleGameEnd]);

  useEffect(() => {
    if (pendingCheckmate) {
      if (pendingCheckmate.countdown <= 0) {
        handleGameEnd(pendingCheckmate.winner === "white" ? "white_win" : "black_win");
        return;
      }
      
      pendingCheckmateRef.current = setTimeout(() => {
        setPendingCheckmate(prev => prev ? { ...prev, countdown: prev.countdown - 1 } : null);
      }, 1000);
      
      return () => {
        if (pendingCheckmateRef.current) {
          clearTimeout(pendingCheckmateRef.current);
        }
      };
    }
  }, [pendingCheckmate, handleGameEnd]);

  useEffect(() => {
    if (gameStarted && !pendingCheckmate && !arbiterPending && !gameResult) {
      const timer = setInterval(() => {
        if (clockTurn === "white") {
          setWhiteTime((t) => {
            const newTime = Math.max(0, t - 1);
            if (newTime === 0 && t > 0) {
              handleGameEnd("black_win");
            }
            return newTime;
          });
        } else {
          setBlackTime((t) => {
            const newTime = Math.max(0, t - 1);
            if (newTime === 0 && t > 0) {
              handleGameEnd("white_win");
            }
            return newTime;
          });
        }
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [gameStarted, clockTurn, handleGameEnd, pendingCheckmate, arbiterPending, gameResult]);

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

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleClockPress = useCallback(() => {
    if (!gameStarted || arbiterPending || pendingCheckmate) return;
    
    // In multiplayer, can only press clock on your turn
    if (matchId && clockTurn !== playerColor) {
      return; // Not your turn, can't press clock
    }
    
    // Must have made a move before pressing clock (in multiplayer)
    if (matchId && !hasMadeMove) {
      toast({
        title: "Make a move first",
        description: "You must make a move before pressing the clock",
        variant: "destructive",
      });
      return;
    }

    if (clockTurn === "white") {
      setWhiteTime((t) => t + increment);
    } else {
      setBlackTime((t) => t + increment);
    }

    const newClockTurn = clockTurn === "white" ? "black" : "white";
    setClockTurn(newClockTurn);
    setActiveColor(newClockTurn);
    setClockPresses(clockPresses + 1);
    setHasMadeMove(false);
    
    // Send clock press to opponent via WebSocket
    if (matchId) {
      sendMove(matchId, "__CLOCK_PRESS__", "", whiteTime, blackTime, undefined);
    }
  }, [gameStarted, clockTurn, increment, clockPresses, arbiterPending, pendingCheckmate, matchId, hasMadeMove, playerColor, toast, sendMove, whiteTime, blackTime]);

  const handleStartGame = () => {
    const minutes = parseInt(timeControl);
    const seconds = minutes * 60;
    
    setWhiteTime(seconds);
    setBlackTime(seconds);
    setIncrement(0);
    setGameResult(null);
    setGameStarted(true);
    gameStartTimeRef.current = Date.now(); // Track game start for first move timing
    
    const newGame = new Chess();
    setGame(newGame);
    setLegalChessGame(new Chess());
    setBoardState(INITIAL_BOARD.map(row => [...row]));
    setMoves([]);
    setActiveColor("white");
    setPlayerColor("white");
    setClockTurn("white");
    setClockPresses(0);
    setMyViolations({ unsportsmanlike: 0, illegal: 0, distraction: 0 });
    setOpponentViolations({ unsportsmanlike: 0, illegal: 0, distraction: 0 });
    setMyFalseClaims({ unsportsmanlike: 0, illegal: 0, distraction: 0 });
    setOpponentFalseClaims({ unsportsmanlike: 0, illegal: 0, distraction: 0 });
    setMyHandshakeOffered(false);
    setOpponentHandshakeOffered(false);
    setHandshakeComplete(false);
    setShowHandshakeUI(false);
    setMyHandshakeBeforeFirstMove(false);
    setOpponentHandshakeBeforeFirstMove(false);
    setOpponentHandshakeViolation(false);
    setTouchedPiece(null);
    setOpponentName("Practice Partner");
    setOpponentRating(1200);
    setIsBotGame(false);
    setSelectedBot(null);
    
    const mode = minutes <= 3 ? "otb_bullet" : minutes <= 10 ? "otb_blitz" : "otb_rapid";
    
    createGameMutation.mutate({
      mode,
      playerColor: "white",
      timeControl: minutes,
      increment: 0,
      fen: newGame.fen(),
      moves: [],
      whiteTime: seconds,
      blackTime: seconds,
      opponentName: "Practice",
    });
  };

  const requestBotMove = useCallback(async (currentFen: string, botId: string, moveHistorySAN?: string[]) => {
    try {
      const response = await apiRequest("POST", "/api/bots/move", {
        fen: currentFen,
        botId,
        isOtbMode: true,
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
    }
  }, [toast]);

  const handleStartBotGame = async (bot: BotProfile, colorChoice: "white" | "black" | "random") => {
    if (!user) return;
    
    const minutes = parseInt(timeControl);
    const seconds = minutes * 60;
    
    setWhiteTime(seconds);
    setBlackTime(seconds);
    setIncrement(0);
    setGameResult(null);
    
    const newGame = new Chess();
    setGame(newGame);
    setLegalChessGame(new Chess());
    setBoardState(INITIAL_BOARD.map(row => [...row]));
    setMoves([]);
    setActiveColor("white");
    setClockTurn("white");
    setClockPresses(0);
    setMyViolations({ unsportsmanlike: 0, illegal: 0, distraction: 0 });
    setOpponentViolations({ unsportsmanlike: 0, illegal: 0, distraction: 0 });
    setMyFalseClaims({ unsportsmanlike: 0, illegal: 0, distraction: 0 });
    setOpponentFalseClaims({ unsportsmanlike: 0, illegal: 0, distraction: 0 });
    setMyHandshakeOffered(false);
    setOpponentHandshakeOffered(true);
    setHandshakeComplete(false);
    setShowHandshakeUI(true);
    setMyHandshakeBeforeFirstMove(false);
    setOpponentHandshakeBeforeFirstMove(true);
    setOpponentHandshakeViolation(false);
    setTouchedPiece(null);
    setIsBotGame(true);
    setSelectedBot(bot);
    setShowBotSelection(false);
    setSelectedBotDifficulty(null);
    setSelectedBotPersonality(null);
    
    const assignedColor = colorChoice === "random" 
      ? (Math.random() < 0.5 ? "white" : "black")
      : colorChoice;
    setPlayerColor(assignedColor);
    
    setOpponentName(bot.name);
    setOpponentRating(bot.elo);
    
    const mode = minutes <= 3 ? "otb_bullet" : minutes <= 10 ? "otb_blitz" : "otb_rapid";
    
    createGameMutation.mutate({
      mode,
      playerColor: assignedColor,
      timeControl: minutes,
      increment: 0,
      fen: newGame.fen(),
      moves: [],
      whiteTime: seconds,
      blackTime: seconds,
      opponentName: bot.name,
    });
    
    // If player is black, set botThinking BEFORE gameStarted to prevent useEffect from also triggering
    if (assignedColor === "black") {
      setBotThinking(true);
    }
    
    setGameStarted(true);
    gameStartTimeRef.current = Date.now(); // Track game start for first move timing
    
    if (assignedColor === "black") {
      setTimeout(async () => {
        const botMove = await requestBotMove(newGame.fen(), bot.id);
        if (botMove) {
          const legalGame = new Chess();
          legalGame.move(botMove.move);
          setLegalChessGame(legalGame);
          
          const move = legalGame.history({ verbose: true })[0];
          if (move) {
            const { rank: fromRank, file: fromFile } = squareToIndices(move.from);
            const { rank: toRank, file: toFile } = squareToIndices(move.to);
            const newBoard = INITIAL_BOARD.map(row => [...row]);
            const piece = newBoard[fromRank][fromFile];
            const captured = newBoard[toRank][toFile];
            newBoard[fromRank][fromFile] = null;
            newBoard[toRank][toFile] = move.promotion ? 
              (move.color === 'w' ? move.promotion.toUpperCase() : move.promotion.toLowerCase()) : 
              piece;
            setBoardState(newBoard);
            
            const pieceChar = move.piece.toUpperCase();
            const moveNotation = `${pieceChar}${move.from}-${move.to}${captured ? 'x' + captured.toUpperCase() : ''}`;
            setMoves([{
              from: move.from,
              to: move.to,
              piece: piece || (move.color === 'w' ? pieceChar : pieceChar.toLowerCase()),
              captured: captured || undefined,
              notation: moveNotation,
              timestamp: Date.now(),
            }]);
            setLastMoveSquares([move.from, move.to]);
            
            setTimeout(() => {
              setClockTurn("black");
              setActiveColor("black");
              setClockPresses(1);
              setBotThinking(false);
            }, 500);
          } else {
            setBotThinking(false);
          }
        } else {
          setBotThinking(false);
        }
      }, 500);
    }
  };

  const executeBotTurn = useCallback(async () => {
    if (!isBotGame || !selectedBot || !legalChessGame || gameResult) return;
    
    const botColor = playerColor === "white" ? "black" : "white";
    if (activeColor !== botColor) return;
    
    // Set botThinking immediately to prevent re-triggers
    setBotThinking(true);
    
    if (moves.length > 0) {
      const lastMove = moves[moves.length - 1];
      const tempChess = new Chess();
      let isLegal = true;
      
      try {
        for (let i = 0; i < moves.length - 1; i++) {
          const move = moves[i];
          const result = tempChess.move({
            from: move.from,
            to: move.to,
            promotion: 'q',
          });
          if (!result) {
            isLegal = false;
            break;
          }
        }
        
        if (isLegal) {
          const result = tempChess.move({
            from: lastMove.from,
            to: lastMove.to,
            promotion: 'q',
          });
          isLegal = !!result;
        }
      } catch (e) {
        isLegal = false;
      }
      
      if (!isLegal) {
        setArbiterPending(true);
        
        const newIllegalCount = myViolations.illegal + 1;
        
        if (newIllegalCount >= 2) {
          toast({
            title: "Game Over - Forfeit",
            description: "You forfeited due to 2 illegal moves. You did not heed the warning and now lose Elo.",
            variant: "destructive",
          });
          setBotThinking(false);
          handleGameEnd(playerColor === "white" ? "black_win" : "white_win");
          return;
        }
        
        setMyViolations(prev => ({ ...prev, illegal: newIllegalCount }));
        toast({
          title: "Illegal Move Warning",
          description: "Your move was illegal! Bot gains 2 minutes. One more illegal move and you forfeit the game.",
          variant: "destructive",
        });
        setArbiterResult({ type: "illegal", message: "Bot called arbiter: Your move was illegal! Bot gains 2 minutes." });
        
        const { rank: fromRank, file: fromFile } = squareToIndices(lastMove.from);
        const { rank: toRank, file: toFile } = squareToIndices(lastMove.to);
        
        setBoardState(prev => {
          const newBoard = prev.map(row => [...row]);
          newBoard[fromRank][fromFile] = lastMove.piece;
          newBoard[toRank][toFile] = lastMove.captured || null;
          return newBoard;
        });
        
        setMoves(prev => prev.slice(0, -1));
        setLastMoveSquares([]);
        
        if (botColor === "white") {
          setWhiteTime(prev => prev + 120);
        } else {
          setBlackTime(prev => prev + 120);
        }
        
        setActiveColor(playerColor);
        setClockTurn(playerColor);
        setBotThinking(false);
        
        setTimeout(() => {
          setArbiterResult(null);
          setArbiterPending(false);
        }, 3000);
        
        return;
      }
      
      setLegalChessGame(tempChess);
    }
    
    const currentFen = legalChessGame.fen();
    const moveHistorySAN = legalChessGame.history();
    const botMove = await requestBotMove(currentFen, selectedBot.id, moveHistorySAN);
    
    if (botMove && botMove.move) {
      const newLegalGame = new Chess(legalChessGame.fen());
      const moveResult = newLegalGame.move(botMove.move);
      
      if (moveResult) {
        setLegalChessGame(newLegalGame);
        
        const { rank: fromRank, file: fromFile } = squareToIndices(moveResult.from);
        const { rank: toRank, file: toFile } = squareToIndices(moveResult.to);
        
        setBoardState(prev => {
          const newBoard = prev.map(row => [...row]);
          const piece = newBoard[fromRank][fromFile];
          const captured = newBoard[toRank][toFile];
          newBoard[fromRank][fromFile] = null;
          newBoard[toRank][toFile] = moveResult.promotion ? 
            (moveResult.color === 'w' ? moveResult.promotion.toUpperCase() : moveResult.promotion.toLowerCase()) : 
            piece;
          
          const pieceChar = moveResult.piece.toUpperCase();
          const moveNotation = `${pieceChar}${moveResult.from}-${moveResult.to}${captured ? 'x' + captured.toUpperCase() : ''}`;
          setMoves(prevMoves => [...prevMoves, {
            from: moveResult.from,
            to: moveResult.to,
            piece: piece || (moveResult.color === 'w' ? pieceChar : pieceChar.toLowerCase()),
            captured: captured || undefined,
            promotion: moveResult.promotion,
            notation: moveNotation,
            timestamp: Date.now(),
          }]);
          
          return newBoard;
        });
        
        setLastMoveSquares([moveResult.from, moveResult.to]);
        
        if (newLegalGame.isCheckmate()) {
          setBotThinking(false);
          setTimeout(() => {
            handleGameEnd(botColor === "white" ? "white_win" : "black_win");
          }, 500);
          return;
        }
        
        if (newLegalGame.isDraw() || newLegalGame.isStalemate()) {
          setBotThinking(false);
          setTimeout(() => {
            handleGameEnd("draw");
          }, 500);
          return;
        }
        
        setTimeout(() => {
          if (botColor === "white") {
            setWhiteTime(t => t + increment);
          } else {
            setBlackTime(t => t + increment);
          }
          setClockTurn(playerColor);
          setActiveColor(playerColor);
          setClockPresses(prev => prev + 1);
          setBotThinking(false);
        }, 500);
      } else {
        // Bot move failed to execute, reset thinking state
        setBotThinking(false);
      }
    } else {
      // No valid bot move received, reset thinking state
      setBotThinking(false);
    }
  }, [isBotGame, selectedBot, legalChessGame, gameResult, playerColor, activeColor, moves, myViolations, toast, handleGameEnd, requestBotMove, increment]);

  useEffect(() => {
    if (isBotGame && gameStarted && !botThinking && !arbiterPending && !gameResult) {
      const botColor = playerColor === "white" ? "black" : "white";
      if (clockTurn === botColor && activeColor === botColor) {
        const timer = setTimeout(() => {
          executeBotTurn();
        }, 300);
        return () => clearTimeout(timer);
      }
    }
  }, [isBotGame, gameStarted, botThinking, arbiterPending, gameResult, playerColor, clockTurn, activeColor, executeBotTurn]);

  const isPawnPromotion = (piece: string | null, toRank: number): boolean => {
    if (!piece) return false;
    const isPawn = piece.toLowerCase() === 'p';
    if (!isPawn) return false;
    const isWhitePawn = piece === 'P';
    return (isWhitePawn && toRank === 0) || (!isWhitePawn && toRank === 7);
  };

  const completeMove = (
    fromSquare: string,
    toSquare: string,
    fromRank: number,
    fromFile: number,
    toRank: number,
    toFile: number,
    originalPiece: string,
    captured: string | null,
    promotedPiece?: string
  ) => {
    const newBoard = boardState.map(row => [...row]);
    newBoard[fromRank][fromFile] = null;
    newBoard[toRank][toFile] = promotedPiece || originalPiece;
    setBoardState(newBoard);
    
    const promotionSuffix = promotedPiece ? `=${promotedPiece.toUpperCase()}` : '';
    const moveNotation = `${originalPiece.toUpperCase()}${fromSquare}-${toSquare}${captured ? 'x' + captured.toUpperCase() : ''}${promotionSuffix}`;
    const newMove: MoveRecord = {
      from: fromSquare,
      to: toSquare,
      piece: originalPiece,
      captured: captured || undefined,
      promotion: promotedPiece,
      notation: moveNotation,
      timestamp: Date.now(),
    };
    
    setMoves(prev => [...prev, newMove]);
    setSelectedSquare(null);
    setLastMoveSquares([fromSquare, toSquare]);
    
    if (matchId) {
      setHasMadeMove(true);
    }
    
    // Update legalChessGame for bot games so the FEN reflects the correct turn
    // Derive next turn from the piece that just moved (uppercase = white moved, so black's turn next)
    if (isBotGame && legalChessGame) {
      const pieceIsWhite = originalPiece === originalPiece.toUpperCase();
      const nextTurn: "white" | "black" = pieceIsWhite ? "black" : "white";
      
      const newLegalGame = new Chess(legalChessGame.fen());
      try {
        newLegalGame.move({
          from: fromSquare,
          to: toSquare,
          promotion: promotedPiece ? promotedPiece.toLowerCase() as 'q' | 'r' | 'b' | 'n' : undefined,
        });
        setLegalChessGame(newLegalGame);
      } catch (e) {
        // Move might be illegal in chess.js but allowed in OTB mode (touch-move etc.)
        // In this case, manually construct a new game from the board position using correct next turn
        const newFenForLegal = boardToFen(newBoard, nextTurn);
        const freshGame = new Chess(newFenForLegal);
        setLegalChessGame(freshGame);
      }
    }
    
    const newFen = boardToFen(newBoard, activeColor === "white" ? "black" : "white");
    
    if (matchId) {
      sendMove(matchId, moveNotation, newFen, whiteTime, blackTime, {
        from: fromSquare,
        to: toSquare,
        piece: originalPiece,
        captured: captured || undefined,
        promotion: promotedPiece || undefined,
        playerColor: playerColor,
      });
      sendPieceTouch(null);
    }
    
    if (captured?.toLowerCase() === "k") {
      setPendingCheckmate({
        winner: captured === "K" ? "black" : "white",
        countdown: 5,
      });
    }
    
    saveGameState();
  };

  const handlePromotionSelect = (promotionPiece: "q" | "r" | "b" | "n") => {
    if (!pendingPromotion) return;
    
    const { from, to, fromRank, fromFile, toRank, toFile, piece, captured } = pendingPromotion;
    const isWhite = piece === 'P';
    const promotedPiece = isWhite ? promotionPiece.toUpperCase() : promotionPiece.toLowerCase();
    
    completeMove(from, to, fromRank, fromFile, toRank, toFile, piece, captured, promotedPiece);
    setPendingPromotion(null);
  };

  const handleSquareClick = (square: string) => {
    if (!gameStarted || arbiterPending || pendingCheckmate || pendingPromotion || botThinking) return;
    
    const isMyTurn = activeColor === playerColor;
    if (!isMyTurn && matchId) return;
    if (!isMyTurn && isBotGame) return;
    
    if (hasMadeMove && matchId) {
      toast({
        title: "Press clock first",
        description: "You must press the clock before making another move",
        variant: "destructive",
      });
      return;
    }

    const { rank, file } = squareToIndices(square);
    const pieceOnSquare = boardState[rank][file];
    const pieceColor = getPieceColor(pieceOnSquare);

    if (selectedSquare) {
      const { rank: fromRank, file: fromFile } = squareToIndices(selectedSquare);
      const movingPiece = boardState[fromRank][fromFile];
      const movingPieceColor = getPieceColor(movingPiece);
      
      if (movingPieceColor !== activeColor) {
        setSelectedSquare(null);
        return;
      }
      
      if (pieceColor === activeColor) {
        setSelectedSquare(square);
        return;
      }
      
      const captured = boardState[rank][file];
      
      if (isPawnPromotion(movingPiece, rank)) {
        setPendingPromotion({
          from: selectedSquare,
          to: square,
          fromRank,
          fromFile,
          toRank: rank,
          toFile: file,
          piece: movingPiece!,
          captured,
        });
        return;
      }
      
      completeMove(selectedSquare, square, fromRank, fromFile, rank, file, movingPiece!, captured);
    } else {
      if (pieceOnSquare && pieceColor === activeColor) {
        setSelectedSquare(square);
        if (matchId) {
          sendPieceTouch(square);
        }
      }
    }
  };

  const handleCallArbiter = () => {
    if (arbiterPending || arbiterDialogOpen) return;
    setArbiterDialogOpen(true);
    setArbiterDialogTimer(15);
    
    if (arbiterTimerRef.current) {
      clearInterval(arbiterTimerRef.current);
    }
    
    arbiterTimerRef.current = setInterval(() => {
      setArbiterDialogTimer(prev => {
        if (prev <= 1) {
          handleArbiterTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };
  
  const handleArbiterTimeout = () => {
    if (arbiterTimerRef.current) {
      clearInterval(arbiterTimerRef.current);
      arbiterTimerRef.current = null;
    }
    setArbiterDialogOpen(false);
    
    toast({
      title: "Arbiter Call Timed Out",
      description: "You didn't select a reason within 15 seconds. This counts as a false claim for all offense types.",
      variant: "destructive",
    });
    
    const newFalseClaims = {
      unsportsmanlike: myFalseClaims.unsportsmanlike + 1,
      illegal: myFalseClaims.illegal + 1,
      distraction: myFalseClaims.distraction + 1,
    };
    
    const hasForfeit = newFalseClaims.unsportsmanlike >= 2 || newFalseClaims.illegal >= 2 || newFalseClaims.distraction >= 2;
    
    if (hasForfeit) {
      toast({
        title: "Game Over - Forfeit",
        description: "You forfeited due to 2 false arbiter claims. You lose Elo.",
        variant: "destructive",
      });
      handleGameEnd(playerColor === "white" ? "black_win" : "white_win");
      return;
    }
    
    setMyFalseClaims(newFalseClaims);
    
    if (playerColor === "white") {
      setBlackTime(prev => prev + 120);
    } else {
      setWhiteTime(prev => prev + 120);
    }
  };
  
  const handleArbiterClaim = (claimType: "unsportsmanlike" | "illegal" | "distraction") => {
    if (arbiterTimerRef.current) {
      clearInterval(arbiterTimerRef.current);
      arbiterTimerRef.current = null;
    }
    setArbiterDialogOpen(false);
    setArbiterPending(true);
    
    let isValidClaim = false;
    
    if (claimType === "unsportsmanlike") {
      // Valid claim if:
      // 1. Opponent committed a handshake violation (moved before offering handshake)
      // 2. You have "clean hands" (offered handshake before your first move)
      //    - If you haven't made your first move yet, you still have clean hands
      //    - If you made your first move but offered handshake before it, you still have clean hands
      //    - Clean hands persist even after making subsequent moves
      // 3. Haven't already penalized opponent for this
      const alreadyPenalized = opponentViolations.unsportsmanlike > 0;
      
      // Check if player has "clean hands":
      // - Either they haven't made their first move yet (can still offer handshake)
      // - OR they offered handshake before making their first move (clean hands persist)
      const myFirstMoveNotMade = (playerColor === "white" && moves.length === 0) || 
                                  (playerColor === "black" && moves.length < 2);
      // Clean hands = offered before first move, OR haven't moved yet (still have chance to offer)
      const haveCleanHands = myHandshakeBeforeFirstMove || myFirstMoveNotMade;
      
      isValidClaim = opponentHandshakeViolation && haveCleanHands && !alreadyPenalized;
      
      // Only show "lost the right" message if they've made their first move without offering handshake
      const madeMoveWithoutHandshake = !myHandshakeBeforeFirstMove && !myFirstMoveNotMade;
      if (opponentHandshakeViolation && madeMoveWithoutHandshake && !alreadyPenalized) {
        // Player lost the right to complain because they also didn't handshake before their first move
        toast({
          title: "Claim Invalid",
          description: "You cannot claim unsportsmanlike conduct because you also moved without offering a handshake.",
          variant: "destructive",
        });
      }
    } else if (claimType === "illegal") {
      if (moves.length === 0) {
        isValidClaim = false;
      } else {
        const lastMove = moves[moves.length - 1];
        const tempChess = new Chess();
        
        try {
          for (let i = 0; i < moves.length - 1; i++) {
            const move = moves[i];
            tempChess.move({ from: move.from, to: move.to, promotion: 'q' });
          }
          const result = tempChess.move({ from: lastMove.from, to: lastMove.to, promotion: 'q' });
          isValidClaim = !result;
        } catch {
          isValidClaim = true;
        }
      }
    } else if (claimType === "distraction") {
      isValidClaim = false;
    }
    
    if (isValidClaim) {
      const newViolationCount = opponentViolations[claimType] + 1;
      
      if (newViolationCount >= 2) {
        toast({
          title: "Opponent Forfeits",
          description: `Opponent forfeited due to 2 ${claimType} violations. You win!`,
        });
        handleGameEnd(playerColor === "white" ? "white_win" : "black_win");
        return;
      }
      
      setOpponentViolations(prev => ({ ...prev, [claimType]: newViolationCount }));
      
      if (playerColor === "white") {
        setWhiteTime(prev => prev + 120);
      } else {
        setBlackTime(prev => prev + 120);
      }
      
      const messages: Record<string, string> = {
        unsportsmanlike: "Opponent failed to offer handshake! You gain 2 minutes.",
        illegal: "Opponent's move was illegal! You gain 2 minutes.",
        distraction: "Opponent was distracting you! You gain 2 minutes.",
      };
      
      setArbiterResult({ type: "illegal", message: messages[claimType] });
      
      if (claimType === "illegal" && moves.length > 0) {
        const lastMove = moves[moves.length - 1];
        const { rank: fromRank, file: fromFile } = squareToIndices(lastMove.from);
        const { rank: toRank, file: toFile } = squareToIndices(lastMove.to);
        
        setBoardState(prev => {
          const newBoard = prev.map(row => [...row]);
          newBoard[fromRank][fromFile] = lastMove.piece;
          newBoard[toRank][toFile] = lastMove.captured || null;
          return newBoard;
        });
        
        setMoves(prev => prev.slice(0, -1));
        setActiveColor(prev => prev === "white" ? "black" : "white");
        setPendingCheckmate(null);
      }
    } else {
      const newFalseClaimCount = myFalseClaims[claimType] + 1;
      
      if (newFalseClaimCount >= 2) {
        toast({
          title: "Game Over - Forfeit",
          description: `You forfeited due to 2 false ${claimType} claims. You lose Elo.`,
          variant: "destructive",
        });
        handleGameEnd(playerColor === "white" ? "black_win" : "white_win");
        return;
      }
      
      setMyFalseClaims(prev => ({ ...prev, [claimType]: newFalseClaimCount }));
      
      toast({
        title: "False Claim Warning",
        description: `Your ${claimType} claim was invalid! Opponent gains 2 minutes. One more false ${claimType} claim and you forfeit.`,
        variant: "destructive",
      });
      
      if (playerColor === "white") {
        setBlackTime(prev => prev + 120);
      } else {
        setWhiteTime(prev => prev + 120);
      }
      
      setArbiterResult({ type: "legal", message: `False ${claimType} claim! Opponent gains 2 minutes.` });
    }
    
    setTimeout(() => {
      setArbiterResult(null);
      setArbiterPending(false);
    }, 3000);
  };

  const handleResign = () => {
    const result = playerColor === "white" ? "black_win" : "white_win";
    handleGameEnd(result);
    
    // Notify opponent via WebSocket
    if (matchId) {
      sendGameEnd(matchId, result, "Opponent resigned");
    }
  };

  const handleOfferDraw = () => {
    handleGameEnd("draw");
    
    // Notify opponent via WebSocket
    if (matchId) {
      sendGameEnd(matchId, "draw", "Game drawn by agreement");
    }
  };

  useEffect(() => {
    if (!gameStarted) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.key === " ") {
        e.preventDefault();
        handleClockPress();
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [gameStarted, handleClockPress]);

  useEffect(() => {
    if (myHandshakeOffered && opponentHandshakeOffered && !handshakeComplete) {
      setHandshakeComplete(true);
      gameStartTimeRef.current = Date.now(); // Reset timer on handshake complete
      toast({ title: "Handshake complete!", description: "Good luck!" });
    }
  }, [myHandshakeOffered, opponentHandshakeOffered, handshakeComplete, toast]);

  const fen = boardToFen(boardState, activeColor);

  const legalMoveSquares = useMemo(() => {
    if (!showLegalMoves || !selectedSquare || !legalChessGame) return [];
    
    try {
      const moves = legalChessGame.moves({ square: selectedSquare as any, verbose: true });
      return moves.map(move => move.to);
    } catch {
      return [];
    }
  }, [showLegalMoves, selectedSquare, legalChessGame]);

  return (
    <div className="h-screen flex">
      <div className="flex-1 flex items-center justify-center p-4 bg-muted/30 overflow-auto">
        <div className="w-full max-w-2xl space-y-3">
          <div>
            <h1 className="text-2xl font-bold">OTB Tournament Mode</h1>
            <p className="text-sm text-muted-foreground">Free movement · FIDE-style arbiter disputes</p>
          </div>

          {!gameStarted && !gameResult ? (
            <>
              {!inQueue ? (
                <Card>
                  <CardContent className="pt-6 space-y-4">
                    <h2 className="text-xl font-semibold">Find Opponent</h2>
                    <div className="grid grid-cols-2 gap-3">
                      <Button 
                        variant="outline" 
                        onClick={() => handleJoinQueue('5')}
                        disabled={joinQueueMutation.isPending}
                        data-testid="button-queue-blitz"
                      >
                        <Clock className="mr-2 h-4 w-4" />
                        Blitz (5 min)
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={() => handleJoinQueue('15')}
                        disabled={joinQueueMutation.isPending}
                        data-testid="button-queue-rapid"
                      >
                        <Clock className="mr-2 h-4 w-4" />
                        Rapid (15 min)
                      </Button>
                    </div>

                    <div className="pt-4 border-t">
                      {!showBotSelection ? (
                        <>
                          <h3 className="text-lg font-semibold mb-4">or Start Practice Game</h3>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Time Control</label>
                            <Select value={timeControl} onValueChange={setTimeControl}>
                              <SelectTrigger data-testid="select-time-control">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="5">Blitz: 5 min</SelectItem>
                                <SelectItem value="15">Rapid: 15 min</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <Button 
                            variant="default"
                            onClick={() => setShowBotSelection(true)} 
                            className="w-full mt-4" 
                            data-testid="button-play-bot"
                          >
                            <Bot className="mr-2 h-4 w-4" />
                            Practice vs Bot
                          </Button>
                        </>
                      ) : !selectedBotDifficulty ? (
                        <>
                          <div className="flex items-center gap-2 mb-4">
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
                            <h3 className="text-lg font-semibold">Select Bot Difficulty</h3>
                          </div>
                          
                          <div className="space-y-2 mb-4">
                            <label className="text-sm font-medium">Time Control</label>
                            <Select value={timeControl} onValueChange={setTimeControl}>
                              <SelectTrigger data-testid="select-bot-time-control">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="5">Blitz: 5 min</SelectItem>
                                <SelectItem value="15">Rapid: 15 min</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <ScrollArea className="h-[280px] pr-2">
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
                          </ScrollArea>
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
                            <h3 className="text-lg font-semibold">Select Playstyle</h3>
                            <Badge variant="secondary" className="ml-auto">
                              {BOT_DIFFICULTY_ELO[selectedBotDifficulty]} Elo
                            </Badge>
                          </div>
                          
                          <p className="text-sm text-muted-foreground mb-4">
                            Choose your {BOT_DIFFICULTY_NAMES[selectedBotDifficulty]} opponent's playstyle
                          </p>
                          
                          <ScrollArea className="h-[280px] pr-2">
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
                          </ScrollArea>
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
                            <h3 className="text-lg font-semibold">Choose Your Color</h3>
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
                    </div>

                    <div className="pt-4 border-t">
                      <h3 className="text-sm font-semibold mb-3">Training Wheels</h3>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="highlight-last-move-pregame" className="text-sm cursor-pointer">
                            Highlight Last Move
                          </Label>
                          <Switch
                            id="highlight-last-move-pregame"
                            checked={highlightLastMove}
                            onCheckedChange={setHighlightLastMove}
                            data-testid="switch-highlight-last-move"
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label htmlFor="show-legal-moves-pregame" className="text-sm cursor-pointer">
                            Show Legal Moves
                          </Label>
                          <Switch
                            id="show-legal-moves-pregame"
                            checked={showLegalMoves}
                            onCheckedChange={setShowLegalMoves}
                            data-testid="switch-show-legal-moves"
                          />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">Settings cannot be changed during gameplay</p>
                    </div>
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
                      onClick={() => leaveQueueMutation.mutate({ queueType })}
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
              {pendingCheckmate && (
                <Card className="border-destructive bg-destructive/10">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <AlertTriangle className="h-6 w-6 text-destructive" />
                        <div>
                          <p className="font-semibold">King Captured!</p>
                          <p className="text-sm text-muted-foreground">
                            {pendingCheckmate.winner === playerColor ? "You win" : "Opponent wins"} in {pendingCheckmate.countdown}s...
                          </p>
                        </div>
                      </div>
                      <Button 
                        variant="destructive" 
                        onClick={handleCallArbiter}
                        disabled={arbiterPending || moves.length === 0}
                        data-testid="button-call-arbiter-checkmate"
                      >
                        <Gavel className="mr-2 h-4 w-4" />
                        Call Arbiter
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {arbiterResult && (
                <Card className={arbiterResult.type === "illegal" ? "border-green-500 bg-green-500/10" : "border-red-500 bg-red-500/10"}>
                  <CardContent className="py-4">
                    <div className="flex items-center gap-3">
                      {arbiterResult.type === "illegal" ? (
                        <CheckCircle className="h-6 w-6 text-green-500" />
                      ) : (
                        <XCircle className="h-6 w-6 text-red-500" />
                      )}
                      <div>
                        <p className="font-semibold">Arbiter Ruling</p>
                        <p className="text-sm">{arbiterResult.message}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Game Result Overlay */}
              {gameResult && (
                <Card className="border-primary bg-primary/10">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Trophy className="h-6 w-6 text-primary" />
                        <div>
                          <p className="font-semibold text-lg">Game Over</p>
                          <p className="text-sm text-muted-foreground">
                            {gameResult === "draw" 
                              ? "Game drawn" 
                              : gameResult === "white_win" 
                                ? (playerColor === "white" ? "You win!" : "Opponent wins") 
                                : (playerColor === "black" ? "You win!" : "Opponent wins")}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="secondary"
                          onClick={() => {
                            if (gameId) {
                              setLocation(`/analysis/${gameId}`);
                            }
                          }}
                          disabled={!gameId}
                          data-testid="button-analyze-game"
                        >
                          <BarChart3 className="mr-2 h-4 w-4" />
                          Analyze
                        </Button>
                        <Button 
                          onClick={() => {
                            setGameResult(null);
                            setGameStarted(false);
                            setGameId(null);
                            setMatchId(null);
                            setMoves([]);
                            setBoardState(INITIAL_BOARD.map(row => [...row]));
                            setSelectedSquare(null);
                            setClockPresses(0);
                            setMyViolations({ unsportsmanlike: 0, illegal: 0, distraction: 0 });
                            setOpponentViolations({ unsportsmanlike: 0, illegal: 0, distraction: 0 });
                            setMyFalseClaims({ unsportsmanlike: 0, illegal: 0, distraction: 0 });
                            setOpponentFalseClaims({ unsportsmanlike: 0, illegal: 0, distraction: 0 });
                            setMyHandshakeOffered(false);
                            setOpponentHandshakeOffered(false);
                            setHandshakeComplete(false);
                            setShowHandshakeUI(false);
                            setMyHandshakeBeforeFirstMove(false);
                            setOpponentHandshakeBeforeFirstMove(false);
                            setOpponentHandshakeViolation(false);
                            setTouchedPiece(null);
                            setArbiterResult(null);
                            setRestoredGame(false);
                            setIsBotGame(false);
                            setSelectedBot(null);
                            setShowBotSelection(false);
                            setSelectedBotDifficulty(null);
                            setBotThinking(false);
                            setLegalChessGame(new Chess());
                          }}
                          data-testid="button-main-menu"
                        >
                          Main Menu
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Opponent timer (top) */}
              <Card className={`${clockTurn !== playerColor ? "ring-2 ring-primary" : ""}`}>
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
                      clockTurn !== playerColor ? "text-foreground" : "text-muted-foreground"
                    }`} data-testid={playerColor === "white" ? "text-black-time" : "text-white-time"}>
                      {formatTime(playerColor === "white" ? blackTime : whiteTime)}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <ChessBoard 
                fen={fen}
                orientation={playerColor}
                showCoordinates={true}
                highlightedSquares={[]}
                legalMoveSquares={legalMoveSquares}
                touchedSquare={opponentTouchedSquare}
                lastMoveSquares={highlightLastMove ? lastMoveSquares : []}
                selectedSquare={selectedSquare}
                onSquareClick={handleSquareClick}
              />

              {/* Player timer (bottom) */}
              <Card className={`${clockTurn === playerColor ? "ring-2 ring-primary" : ""}`}>
                <CardContent className="py-2 px-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${playerColor === "white" ? "bg-white border border-gray-400" : "bg-black"}`} />
                      <span className="font-medium text-sm">{user?.firstName || "You"}</span>
                      <span className="text-xs text-muted-foreground">({playerRating})</span>
                      <Badge variant="outline" className="text-xs py-0">You</Badge>
                    </div>
                    <div className={`text-2xl font-mono font-bold ${
                      clockTurn === playerColor ? "text-foreground" : "text-muted-foreground"
                    }`} data-testid={playerColor === "white" ? "text-white-time" : "text-black-time"}>
                      {formatTime(playerColor === "white" ? whiteTime : blackTime)}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Violations and game controls */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-xs">
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">Illegal:</span>
                    <Badge variant={myViolations.illegal > 0 ? "destructive" : "secondary"} className="text-xs py-0">{myViolations.illegal}/2</Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">Unsport:</span>
                    <Badge variant={myViolations.unsportsmanlike > 0 ? "destructive" : "secondary"} className="text-xs py-0">{myViolations.unsportsmanlike}/2</Badge>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleOfferDraw} data-testid="button-offer-draw">
                    <HandshakeIcon className="mr-1 h-3 w-3" />
                    Draw
                  </Button>
                  <Button variant="destructive" size="sm" onClick={handleResign} data-testid="button-resign">
                    <Flag className="mr-1 h-3 w-3" />
                    Resign
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {gameStarted && (
        <div className="w-72 border-l bg-card flex flex-col">
          <div className="p-3 border-b space-y-2">
            <Button
              onClick={handleClockPress}
              size="lg"
              className="w-full min-h-12 text-base font-semibold"
              disabled={arbiterPending || !!pendingCheckmate}
              data-testid="button-press-clock"
            >
              <Clock className="mr-2 h-5 w-5" />
              Press Clock
              <span className="ml-2 text-xs font-normal opacity-70">(Space)</span>
            </Button>
            
            {/* Handshake button - only available before both players' first moves */}
            {showHandshakeUI && !handshakeComplete && moves.length < 2 && (
              <Button
                onClick={() => {
                  setMyHandshakeOffered(true);
                  // Track if I offered handshake before my first move
                  const myFirstMoveNotMade = (playerColor === "white" && moves.length === 0) || 
                                             (playerColor === "black" && moves.length < 2);
                  if (myFirstMoveNotMade) {
                    setMyHandshakeBeforeFirstMove(true);
                  }
                  // Send handshake offer to opponent via WebSocket for multiplayer
                  if (matchId && !isBotGame) {
                    sendHandshakeOffer(matchId, playerColor);
                  }
                  if (opponentHandshakeOffered) {
                    setHandshakeComplete(true);
                    gameStartTimeRef.current = Date.now(); // Reset timer on handshake complete
                    toast({ title: "Handshake accepted!", description: "Good luck!" });
                  }
                }}
                size="default"
                variant="outline"
                className={`w-full ${myHandshakeOffered ? "border-green-500 text-green-600" : "border-primary"}`}
                disabled={myHandshakeOffered}
                data-testid="button-offer-handshake"
              >
                <HandshakeIcon className="mr-2 h-4 w-4" />
                {myHandshakeOffered ? "Handshake Offered" : opponentHandshakeOffered ? "Accept Handshake" : "Offer Handshake"}
              </Button>
            )}
            
            {!isBotGame && (
              <Button
                onClick={handleCallArbiter}
                size="default"
                variant="outline"
                className="w-full border-orange-500 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950"
                disabled={arbiterPending || moves.length === 0 || clockTurn !== playerColor}
                data-testid="button-call-arbiter"
              >
                <Gavel className="mr-2 h-4 w-4" />
                Call Arbiter
              </Button>
            )}
            {isBotGame && (
              <p className="text-xs text-center text-muted-foreground">
                Bot will call arbiter if you make an illegal move
              </p>
            )}
          </div>
          
          <div className="p-3 border-b">
            <h3 className="font-semibold text-sm">Move List</h3>
            <p className="text-xs text-muted-foreground">Free movement - arbiter validates</p>
          </div>
          <ScrollArea className="flex-1 p-3">
            {moves.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-3">
                No moves yet
              </p>
            ) : (
              <div className="space-y-1 font-mono text-sm">
                {moves.map((move, i) => (
                  <div key={i} className="flex items-center gap-2" data-testid={`move-${i}`}>
                    <span className="text-muted-foreground w-6 text-xs">{Math.floor(i / 2) + 1}.</span>
                    <span className="text-sm">{move.notation}</span>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
          
          <div className="p-3 border-t bg-muted/30">
            <h4 className="text-xs font-semibold mb-1">Arbiter Rules</h4>
            <ul className="text-xs text-muted-foreground space-y-0.5">
              <li>• Illegal move: Caller +2 min</li>
              <li>• 2nd illegal: Forfeit</li>
              <li>• False claim: Opponent +2 min</li>
              <li>• 2nd false claim: Forfeit</li>
            </ul>
          </div>
        </div>
      )}

      <PromotionDialog
        open={!!pendingPromotion}
        color={activeColor}
        onSelect={handlePromotionSelect}
      />

      {/* Arbiter Reason Dialog */}
      <Dialog open={arbiterDialogOpen} onOpenChange={(open) => {
        if (!open && arbiterDialogOpen) {
          handleArbiterTimeout();
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gavel className="h-5 w-5" />
              Call Arbiter - Select Reason
            </DialogTitle>
            <DialogDescription>
              Choose the reason for calling the arbiter. You have {arbiterDialogTimer} seconds to select.
            </DialogDescription>
          </DialogHeader>
          
          <Progress value={(arbiterDialogTimer / 15) * 100} className="h-2" />
          
          <div className="space-y-3 pt-2">
            <Button 
              variant="outline" 
              className="w-full justify-start h-auto py-3"
              onClick={() => handleArbiterClaim("unsportsmanlike")}
              data-testid="button-claim-unsportsmanlike"
            >
              <div className="flex items-center gap-3">
                <HandshakeIcon className="h-5 w-5 text-orange-500" />
                <div className="text-left">
                  <p className="font-semibold">Unsportsmanlike Conduct</p>
                  <p className="text-xs text-muted-foreground">Opponent failed to offer handshake</p>
                </div>
              </div>
            </Button>
            
            <Button 
              variant="outline" 
              className="w-full justify-start h-auto py-3"
              onClick={() => handleArbiterClaim("illegal")}
              data-testid="button-claim-illegal"
            >
              <div className="flex items-center gap-3">
                <Ban className="h-5 w-5 text-red-500" />
                <div className="text-left">
                  <p className="font-semibold">Illegal Move</p>
                  <p className="text-xs text-muted-foreground">Opponent made an illegal move</p>
                </div>
              </div>
            </Button>
            
            <Button 
              variant="outline" 
              className="w-full justify-start h-auto py-3 opacity-50"
              disabled
              data-testid="button-claim-distraction"
            >
              <div className="flex items-center gap-3">
                <MessageSquareWarning className="h-5 w-5 text-gray-400" />
                <div className="text-left">
                  <p className="font-semibold">Distraction</p>
                  <p className="text-xs text-muted-foreground">Coming soon - Chat log verification</p>
                </div>
              </div>
            </Button>
          </div>
          
          <p className="text-xs text-center text-muted-foreground mt-2">
            Warning: False claims result in +2 min for opponent. 2nd false claim = forfeit.
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
