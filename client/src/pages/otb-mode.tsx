import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { Chess } from "chess.js";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications } from "@/hooks/useNotifications";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useHighlightColors } from "@/hooks/useHighlightColors";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { UserSettings } from "@shared/schema";
import { ChessBoard } from "@/components/chess-board";
import { PerspectiveChessBoard } from "@/components/perspective-chess-board";
import { NotationInput } from "@/components/notation-input";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, Play, HandshakeIcon, Flag, AlertTriangle, Settings, Gavel, XCircle, CheckCircle, Trophy, Bot, ChevronLeft, BarChart3, Crown, Shuffle, MessageSquareWarning, Ban, FileText, X, RotateCcw, Loader2, Infinity as InfinityIcon } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { generateBotMoveClient, getThinkTime, LastMoveInfo, recordPosition, clearPositionHistory, countBotPieces, detectRecapture } from "@/lib/botEngine";
import { OTBTutorial, useOTBTutorial } from "@/components/otb-tutorial";
import { SuspensionBanner } from "@/components/suspension-banner";

// Piece values for recapture detection (must match botEngine.ts)
const PIECE_VALUES_OTB: Record<string, number> = {
  p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000
};

// Helper to extract LastMoveInfo from a chess.js Move object
function extractLastMoveInfoOTB(move: { from: string; to: string; captured?: string } | null): LastMoveInfo | undefined {
  if (!move) return undefined;
  return {
    from: move.from,
    to: move.to,
    captured: move.captured,
    capturedValue: move.captured ? PIECE_VALUES_OTB[move.captured] : undefined
  };
}

// Calculate human-like bot move delay based on game state
// Priority order:
// 1. Recapture available → 1 second (reflexive move)
// 2. Clock under 1 minute → 1 second (time pressure)
// 3. Piece count determines endgame phase
// 4. Move count determines opening/middlegame phase
function getBotMoveDelay(
  moveNumber: number, 
  remainingTimeSeconds: number,
  fen: string,
  botColor: 'white' | 'black',
  lastMove: LastMoveInfo | undefined
): number {
  // 1. Recapture available - quick reflexive move
  if (detectRecapture(lastMove, fen)) {
    return 1000;
  }
  
  // 2. Time pressure mode - quick moves when low on time
  if (remainingTimeSeconds < 60) {
    return 1000;
  }
  
  // 3. Check piece count for endgame phases
  const pieceCount = countBotPieces(fen, botColor);
  
  if (pieceCount === 1) {
    // Lone king - no choices, instant move
    return 1000;
  } else if (pieceCount >= 2 && pieceCount <= 5) {
    // Endgame low - simplified calculation
    return 2000 + Math.random() * 1000; // 2-3s
  } else if (pieceCount >= 6 && pieceCount <= 11) {
    // Endgame mid - moderate calculation
    return 3000 + Math.random() * 1000; // 3-4s
  }
  
  // 4. Full board (12-16 pieces) - use move count
  if (moveNumber <= 5) {
    // Opening - quick book moves
    return 1000;
  } else if (moveNumber <= 11) {
    // Early development
    return 2000 + Math.random() * 1000; // 2-3s
  }
  
  // Middlegame - deep thinking
  return 3000 + Math.random() * 3000; // 3-6s
}

// Promise-based delay utility
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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
  moverColor: "white" | "black"; // Explicit mover color for reliable lastMoveBy tracking
}

export default function OTBMode() {
  const { user } = useAuth();
  const { toast } = useNotifications();
  const [, setLocation] = useLocation();
  const highlightColors = useHighlightColors();
  const { showTutorial, setShowTutorial, triggerTutorial, hasSeenTutorial, markComplete } = useOTBTutorial();
  
  const { data: userSettings } = useQuery<UserSettings>({
    queryKey: ["/api/settings"],
  });
  
  const [tiltAngle, setTiltAngle] = useState(45);
  
  useEffect(() => {
    if (userSettings?.otbTiltAngle) {
      setTiltAngle(userSettings.otbTiltAngle);
    }
  }, [userSettings?.otbTiltAngle]);
  
  // Load OTB highlight preferences from saved settings
  useEffect(() => {
    if (userSettings) {
      // Only update if the setting exists (not null/undefined) - otherwise use default (true)
      if (userSettings.otbHighlightLastMove !== null && userSettings.otbHighlightLastMove !== undefined) {
        setHighlightLastMove(userSettings.otbHighlightLastMove);
      }
      if (userSettings.otbShowLegalMoves !== null && userSettings.otbShowLegalMoves !== undefined) {
        setShowLegalMoves(userSettings.otbShowLegalMoves);
      }
      if (userSettings.otbShowPieceHighlight !== null && userSettings.otbShowPieceHighlight !== undefined) {
        setShowPieceHighlight(userSettings.otbShowPieceHighlight);
      }
    }
  }, [userSettings]);
  
  const saveTiltMutation = useMutation({
    mutationFn: async (newTilt: number) => {
      await apiRequest("PATCH", "/api/settings", { otbTiltAngle: newTilt });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
    },
  });
  
  // Mutation to save OTB highlight preferences
  const saveHighlightPreferencesMutation = useMutation({
    mutationFn: async (prefs: { 
      otbHighlightLastMove?: boolean; 
      otbShowLegalMoves?: boolean; 
      otbShowPieceHighlight?: boolean; 
    }) => {
      await apiRequest("PATCH", "/api/settings", prefs);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
    },
  });
  
  const handleTiltChange = useCallback((newTilt: number) => {
    setTiltAngle(newTilt);
    saveTiltMutation.mutate(newTilt);
  }, [saveTiltMutation]);
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
  const [lastMoveSquares, setLastMoveSquares] = useState<string[]>([]);
  const [showLegalMoves, setShowLegalMoves] = useState(true);
  const [highlightLastMove, setHighlightLastMove] = useState(true);
  const [showPieceHighlight, setShowPieceHighlight] = useState(true);
  const [perspective3d, setPerspective3d] = useState(false);
  const [notationPractice, setNotationPractice] = useState(false);
  const [pendingNotation, setPendingNotation] = useState<string | null>(null);
  const [confirmedMoves, setConfirmedMoves] = useState<MoveRecord[]>([]);
  // Notation queue for Move → Clock → Write flow
  // Stores moves that need to be recorded (both player's and opponent's/bot's moves)
  const [notationQueue, setNotationQueue] = useState<{
    notation: string;
    isPlayerMove: boolean;
    moveNumber: number;
    isWhiteMove: boolean;
  }[]>([]);
  // Track the last player move notation to add to queue after clock press
  const [pendingPlayerNotation, setPendingPlayerNotation] = useState<string | null>(null);
  // Flag to pause bot until player records their move
  const [waitingForNotation, setWaitingForNotation] = useState(false);
  
  const [myViolations, setMyViolations] = useState({ unsportsmanlike: 0, illegal: 0, distraction: 0 });
  const [opponentViolations, setOpponentViolations] = useState({ unsportsmanlike: 0, illegal: 0, distraction: 0, threefold: 0, fiftymove: 0 });
  const [myFalseClaims, setMyFalseClaims] = useState({ unsportsmanlike: 0, illegal: 0, distraction: 0, threefold: 0, fiftymove: 0 });
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
  
  // Post-game handshake state (courtesy gesture after game ends)
  const [postGameHandshakeOffered, setPostGameHandshakeOffered] = useState(false);
  const [opponentPostGameHandshakeOffered, setOpponentPostGameHandshakeOffered] = useState(false);
  const [postGameHandshakeComplete, setPostGameHandshakeComplete] = useState(false);
  
  const [touchedPiece, setTouchedPiece] = useState<string | null>(null);
  const [lockedPiece, setLockedPiece] = useState<string | null>(null); // Touch-move: piece must be moved if it has legal moves
  const [mobileScoreSheetOpen, setMobileScoreSheetOpen] = useState(false);
  const [arbiterResult, setArbiterResult] = useState<{
    type: "illegal" | "legal" | null;
    message: string;
  } | null>(null);
  const [pendingCheckmate, setPendingCheckmate] = useState<{
    winner: "white" | "black";
    countdown: number;
    isIllegalMove: boolean;
  } | null>(null);
  const [legalChessGame, setLegalChessGame] = useState<Chess | null>(null);
  const [opponentName, setOpponentName] = useState<string>("Opponent");
  const [opponentId, setOpponentId] = useState<string | null>(null);
  const [opponentRating, setOpponentRating] = useState<number>(1200);
  const [playerRating, setPlayerRating] = useState<number>(1200);
  const [initialPlayerRating, setInitialPlayerRating] = useState<number | null>(null);
  const [ratingChange, setRatingChange] = useState<number | null>(null);
  const [clockTurn, setClockTurn] = useState<"white" | "black">("white");
  const [hasMadeMove, setHasMadeMove] = useState(false);
  // Track who made the last move for arbiter bonus calculation
  // Set when a move is committed, cleared when arbiter claim is resolved
  const [lastMoveBy, setLastMoveBy] = useState<"white" | "black" | null>(null);
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
  const [gameOverReason, setGameOverReason] = useState<string | null>(null); // Arbiter forfeit reason
  
  const [showBotSelection, setShowBotSelection] = useState(false);
  const [selectedBot, setSelectedBot] = useState<BotProfile | null>(null);
  const [isBotGame, setIsBotGame] = useState(false);
  const [botThinking, setBotThinking] = useState(false);
  const [selectedBotDifficulty, setSelectedBotDifficulty] = useState<BotDifficulty | null>(null);
  const [selectedBotPersonality, setSelectedBotPersonality] = useState<BotProfile | null>(null);
  const [botTimeControl, setBotTimeControl] = useState<"blitz" | "rapid" | "practice">("blitz");
  const [queueCountdown, setQueueCountdown] = useState<number | null>(null);
  
  // Rematch state
  const [rematchRequested, setRematchRequested] = useState(false);
  const [opponentWantsRematch, setOpponentWantsRematch] = useState(false);
  const [rematchDeclined, setRematchDeclined] = useState(false);
  
  // Draw offer state
  const [drawOffered, setDrawOffered] = useState(false);
  const [opponentOfferedDraw, setOpponentOfferedDraw] = useState(false);
  
  const gameRef = useRef<Chess | null>(null);
  const gameIdRef = useRef<string | null>(null);
  const matchIdRef = useRef<string | null>(null);
  const whiteTimeRef = useRef(180);
  const blackTimeRef = useRef(180);
  const saveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pendingCheckmateRef = useRef<NodeJS.Timeout | null>(null);
  const handleGameEndRef = useRef<((result: "white_win" | "black_win" | "draw") => void) | null>(null);
  const arbiterTimerRef = useRef<NodeJS.Timeout | null>(null);
  const gameStartTimeRef = useRef<number | null>(null);
  const legalChessGameRef = useRef<Chess | null>(null);
  const previousLegalFenRef = useRef<string | null>(null); // Tracks FEN before opponent's move for illegal move claims
  const pendingNotationRef = useRef<string | null>(null); // Ref to avoid stale closure in callbacks
  const botAutoFillInProgressRef = useRef(false);

  useEffect(() => {
    gameRef.current = game;
    gameIdRef.current = gameId;
    matchIdRef.current = matchId;
    whiteTimeRef.current = whiteTime;
    blackTimeRef.current = blackTime;
  }, [game, gameId, matchId, whiteTime, blackTime]);

  // Keep legalChessGameRef in sync to avoid stale closure issues in executeBotTurn
  useEffect(() => {
    legalChessGameRef.current = legalChessGame;
  }, [legalChessGame]);

  // Keep pendingNotationRef in sync to avoid stale closure issues in rollback handlers
  useEffect(() => {
    pendingNotationRef.current = pendingNotation;
  }, [pendingNotation]);

  // Close mobile score sheet when game ends
  useEffect(() => {
    if (gameResult) {
      setMobileScoreSheetOpen(false);
    }
  }, [gameResult]);

  // Automatically clear waitingForNotation when notation queue empties
  useEffect(() => {
    if (notationQueue.length === 0 && waitingForNotation) {
      setWaitingForNotation(false);
    }
  }, [notationQueue.length, waitingForNotation]);

  // Sync increment and notation practice with time control changes
  useEffect(() => {
    // Set increment based on time control (15+30 for rapid, 0 for blitz)
    setIncrement(getIncrementForTimeControl(timeControl));
    
    // Disable notation practice for 5-minute games (OTB rules)
    if (timeControl === "5" && notationPractice) {
      setNotationPractice(false);
    }
  }, [timeControl]);

  // Trigger OTB tutorial on first visit
  useEffect(() => {
    if (!hasSeenTutorial) {
      triggerTutorial();
    }
  }, [hasSeenTutorial, triggerTutorial]);

  // Record positions for bot draw-seeking behavior (threefold repetition detection)
  useEffect(() => {
    if (isBotGame && legalChessGame && gameStarted && !gameResult) {
      recordPosition(legalChessGame.fen());
    }
  }, [legalChessGame, isBotGame, gameStarted, gameResult]);

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

  // Generate proper SAN notation from move details
  // Uses chess.js to generate standard algebraic notation (e4, Nf3, exd5, O-O, etc.)
  const generateSanNotation = (
    fen: string,
    from: string,
    to: string,
    promotion?: string
  ): string | null => {
    try {
      const tempGame = new Chess(fen);
      const result = tempGame.move({
        from,
        to,
        promotion: promotion?.toLowerCase() as 'q' | 'r' | 'b' | 'n' | undefined,
      });
      return result ? result.san : null;
    } catch {
      return null;
    }
  };

  // Get the time increment for a given time control
  const getIncrementForTimeControl = (tc: string): number => {
    // Rapid (15 min) gets 30 second increment
    // Blitz (5 min) gets no increment
    return tc === "15" ? 30 : 0;
  };

  // Check if notation practice is allowed for current time control
  const isNotationAllowed = timeControl !== "5";

  const handleOpponentMove = useCallback((data: { matchId: string; move: string; fen: string; whiteTime: number; blackTime: number; from?: string; to?: string; piece?: string; captured?: string; promotion?: string }) => {
    // Use ref to get the latest matchId value and avoid stale closure issues
    if (data.matchId !== matchIdRef.current) return;
    
    console.log('[OTB] Received opponent message:', data.move);
    
    // Handle clock press message - opponent pressed their clock, now it's our turn
    if (data.move === "__CLOCK_PRESS__") {
      console.log('[OTB] Opponent pressed clock, switching turn');
      setClockTurn(playerColor);
      setActiveColor(playerColor);
      setHasMadeMove(false);
      setWhiteTime(data.whiteTime);
      setBlackTime(data.blackTime);
      setLockedPiece(null);
      return;
    }
    
    // Handle castling moves - use FEN to rebuild board correctly
    if (data.move === 'O-O' || data.move === 'O-O-O') {
      // For castling, rebuild board from the received FEN (which has both pieces moved)
      if (data.fen) {
        const fenParts = data.fen.split(' ')[0];
        const rows = fenParts.split('/');
        const newBoard: (string | null)[][] = [];
        for (const row of rows) {
          const boardRow: (string | null)[] = [];
          for (const char of row) {
            if (isNaN(parseInt(char))) {
              boardRow.push(char);
            } else {
              for (let i = 0; i < parseInt(char); i++) {
                boardRow.push(null);
              }
            }
          }
          newBoard.push(boardRow);
        }
        setBoardState(newBoard);
        
        // Save previous FEN before updating for illegal move claims
        // Use ref to avoid stale closure - legalChessGameRef is kept in sync
        if (legalChessGameRef.current) {
          previousLegalFenRef.current = legalChessGameRef.current.fen();
          console.log('[OTB] Saved previousFen before castling:', previousLegalFenRef.current);
        }
        
        // Update legalChessGame from the received FEN
        const newLegalGame = new Chess(data.fen);
        setLegalChessGame(newLegalGame);
        
        // Check for checkmate/stalemate after castling (rare but possible)
        if (newLegalGame.isCheckmate()) {
          const opponentColor = playerColor === "white" ? "black" : "white";
          console.log('[OTB] Opponent delivered checkmate via castling! Winner:', opponentColor);
          const result = opponentColor === "white" ? "white_win" : "black_win";
          setGameResult(result);
          if (handleGameEndRef.current) {
            handleGameEndRef.current(result);
          }
        } else if (newLegalGame.isStalemate() || newLegalGame.isDraw()) {
          console.log('[OTB] Draw after opponent castling!');
          setGameResult("draw");
          if (handleGameEndRef.current) {
            handleGameEndRef.current("draw");
          }
        }
      }
      
      const opponentMoverColor: "white" | "black" = playerColor === "white" ? "black" : "white";
      const castlingMove: MoveRecord = {
        from: data.from || '',
        to: data.to || '',
        piece: 'K',
        notation: data.move,
        timestamp: Date.now(),
        moverColor: opponentMoverColor,
      };
      setMoves(prev => [...prev, castlingMove]);
      // Opponent moves are auto-confirmed (player doesn't record them)
      setConfirmedMoves(prev => [...prev, castlingMove]);
      
      if (data.from && data.to) {
        setLastMoveSquares([data.from, data.to]);
      }
      
      // Track that opponent made this castling move for arbiter bonus calculation
      setLastMoveBy(opponentMoverColor);
      
      setWhiteTime(data.whiteTime);
      setBlackTime(data.blackTime);
      
      toast({
        title: "Opponent castled",
        description: data.move,
      });
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
        
        // Handle en passant capture - pawn moves diagonally to empty square
        const isPawn = piece?.toLowerCase() === 'p';
        const isDiagonalMove = Math.abs(toFile - fromFile) === 1;
        const destinationWasEmpty = !data.captured;
        
        if (isPawn && isDiagonalMove && destinationWasEmpty) {
          // This is en passant - remove the captured pawn from its actual position
          const capturedPawnRank = fromRank;
          const capturedPawnFile = toFile;
          const capturedPawn = newBoard[capturedPawnRank][capturedPawnFile];
          
          if (capturedPawn?.toLowerCase() === 'p') {
            newBoard[capturedPawnRank][capturedPawnFile] = null;
            console.log('[OTB] Opponent en passant: removed pawn from', String.fromCharCode(97 + capturedPawnFile) + (8 - capturedPawnRank));
          }
        }
        
        return newBoard;
      });
      
      const opponentMoverColor: "white" | "black" = playerColor === "white" ? "black" : "white";
      const opponentMove: MoveRecord = {
        from: data.from!,
        to: data.to!,
        piece: data.piece || "?",
        captured: data.captured,
        promotion: data.promotion,
        notation: data.move,
        timestamp: Date.now(),
        moverColor: opponentMoverColor,
      };
      
      setMoves(prev => {
        const newMoves = [...prev, opponentMove];
        
        // Check if this is opponent's first move and track handshake violation
        // Opponent is black if we're white: black's first move is when newMoves.length === 2
        // Opponent is white if we're black: white's first move is when newMoves.length === 1
        const isOpponentFirstMove = (playerColor === "white" && newMoves.length === 2) ||
                                    (playerColor === "black" && newMoves.length === 1);
        if (isOpponentFirstMove && !opponentHandshakeOffered) {
          setOpponentHandshakeViolation(true);
        }
        
        // Notation practice: add opponent's move to queue for player to record (PvP)
        if (notationPractice) {
          const moveNumber = Math.floor((newMoves.length - 1) / 2) + 1;
          const isWhiteMove = (newMoves.length - 1) % 2 === 0;
          
          setNotationQueue(prevQueue => [...prevQueue, {
            notation: data.move,
            isPlayerMove: false,
            moveNumber,
            isWhiteMove,
          }]);
        }
        
        return newMoves;
      });
      
      // Opponent moves are auto-confirmed (player doesn't record them in scoresheet)
      setConfirmedMoves(prev => [...prev, opponentMove]);
      
      setLastMoveSquares([data.from, data.to]);
      
      // Track that opponent made the last move for arbiter bonus calculation
      setLastMoveBy(opponentMoverColor);
      
      // Validate opponent's move legality for king capture differentiation
      let opponentMoveWasLegal = false;
      if (legalChessGameRef.current) {
        try {
          const testGame = new Chess(legalChessGameRef.current.fen());
          const moveResult = testGame.move({
            from: data.from,
            to: data.to,
            promotion: data.promotion?.toLowerCase() as 'q' | 'r' | 'b' | 'n' | undefined,
          });
          opponentMoveWasLegal = !!moveResult;
        } catch {
          opponentMoveWasLegal = false;
        }
      }
      
      // Handle king capture (opponent capturing our king)
      if (data.captured?.toLowerCase() === "k") {
        const checkmateWinner = data.captured === "K" ? "black" : "white";
        
        if (opponentMoveWasLegal) {
          // Legal checkmate by opponent - end game immediately
          console.log('[OTB] Opponent legal king capture - ending game immediately');
          setGameResult(checkmateWinner === "white" ? "white_win" : "black_win");
          if (handleGameEndRef.current) {
            handleGameEndRef.current(checkmateWinner === "white" ? "white_win" : "black_win");
          }
        } else {
          // Illegal move leading to checkmate - give us 30 seconds to call arbiter
          console.log('[OTB] Opponent illegal king capture - 30 second arbiter window');
          setPendingCheckmate({
            winner: checkmateWinner,
            countdown: 30,
            isIllegalMove: true,
          });
        }
      }
      
      // Update legalChessGame from the received FEN and check for checkmate/stalemate
      if (data.fen) {
        // Save previous FEN before updating for illegal move claims
        // Use ref to avoid stale closure - legalChessGameRef is kept in sync
        if (legalChessGameRef.current) {
          previousLegalFenRef.current = legalChessGameRef.current.fen();
          console.log('[OTB] Saved previousFen before opponent move:', previousLegalFenRef.current);
        }
        
        const newLegalGame = new Chess(data.fen);
        setLegalChessGame(newLegalGame);
        
        // Check if opponent's move resulted in checkmate/stalemate/draw
        if (newLegalGame.isCheckmate()) {
          // Opponent delivered checkmate - they win, end game immediately
          const opponentColor = playerColor === "white" ? "black" : "white";
          console.log('[OTB] Opponent delivered checkmate! Winner:', opponentColor);
          const result = opponentColor === "white" ? "white_win" : "black_win";
          setGameResult(result);
          if (handleGameEndRef.current) {
            handleGameEndRef.current(result);
          }
        } else if (newLegalGame.isStalemate()) {
          console.log('[OTB] Stalemate from opponent move!');
          setGameResult("draw");
          if (handleGameEndRef.current) {
            handleGameEndRef.current("draw");
          }
        } else if (newLegalGame.isDraw()) {
          console.log('[OTB] Draw from opponent move (50-move rule, insufficient material, or repetition)');
          setGameResult("draw");
          if (handleGameEndRef.current) {
            handleGameEndRef.current("draw");
          }
        }
      }
    }
    
    setWhiteTime(data.whiteTime);
    setBlackTime(data.blackTime);
    
    toast({
      title: "Opponent moved",
      description: data.move,
    });
  }, [matchId, toast, playerColor]);

  const handleArbiterCall = useCallback((data: { matchId: string; callerId: string; moveIndex: number }) => {
    // Use ref to get the latest matchId value and avoid stale closure issues
    if (data.matchId !== matchIdRef.current) return;
    
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
    previousFen?: string;
    claimType?: "unsportsmanlike" | "illegal" | "distraction";
  }) => {
    // Use ref to get the latest matchId value and avoid stale closure issues
    const currentMatchId = matchIdRef.current;
    
    console.log('[OTB Arbiter RECV] handleArbiterRuling called');
    console.log('[OTB Arbiter RECV] Full data:', JSON.stringify(data));
    console.log('[OTB Arbiter RECV] Current matchId (from ref):', currentMatchId);
    console.log('[OTB Arbiter RECV] Current user.id:', user?.id);
    console.log('[OTB Arbiter RECV] Am I violator?', data.violatorId === user?.id);
    console.log('[OTB Arbiter RECV] previousFen present?', !!data.previousFen);
    
    if (data.matchId !== currentMatchId) {
      console.log('[OTB Arbiter RECV] REJECTING - matchId mismatch:', data.matchId, '!==', currentMatchId);
      return;
    }
    
    console.log('[OTB Arbiter RECV] ACCEPTING - Processing ruling for claimType:', data.claimType);
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
    
    // Claim-type specific messages for valid claims (arbiter ruling)
    const validClaimMessagesYou: Record<string, string> = {
      unsportsmanlike: "Arbiter rewarded 2 mins to opponent for unsportsmanlike conduct.",
      illegal: "Arbiter rewarded 2 mins to opponent for an illegal move.",
      distraction: "Arbiter rewarded 2 mins to opponent for causing a distraction.",
    };
    const validClaimMessagesOpponent: Record<string, string> = {
      unsportsmanlike: "Arbiter rewarded 2 mins to you for opponent's unsportsmanlike conduct.",
      illegal: "Arbiter rewarded 2 mins to you for opponent's illegal move.",
      distraction: "Arbiter rewarded 2 mins to you for opponent causing a distraction.",
    };
    
    const claimType = data.claimType || "illegal";
    
    if (data.ruling === "illegal") {
      // Reset the board for BOTH players when a move is ruled illegal (only for illegal move claims)
      // Use the previousFen from the message to restore complete board state
      // This ensures both players have identical positions including castling/en-passant rights
      console.log('[OTB Arbiter RECV] Ruling is illegal, checking for board reset. claimType:', claimType, 'previousFen present:', !!data.previousFen);
      if (claimType === "illegal" && data.previousFen) {
        console.log('[OTB Arbiter RECV] RESETTING BOARD to previousFen:', data.previousFen);
        // Rebuild board from FEN
        const fenParts = data.previousFen.split(' ')[0];
        const rows = fenParts.split('/');
        const newBoard: (string | null)[][] = [];
        for (const row of rows) {
          const boardRow: (string | null)[] = [];
          for (const char of row) {
            if (isNaN(parseInt(char))) {
              boardRow.push(char);
            } else {
              for (let i = 0; i < parseInt(char); i++) {
                boardRow.push(null);
              }
            }
          }
          newBoard.push(boardRow);
        }
        setBoardState(newBoard);
        
        // Update legalChessGame with the authoritative FEN
        setLegalChessGame(new Chess(data.previousFen));
        
        // Determine whose turn it is from FEN
        const turnChar = data.previousFen.split(' ')[1];
        const newActiveColor = turnChar === 'w' ? 'white' : 'black';
        setActiveColor(newActiveColor);
        setClockTurn(newActiveColor);
        
        // Only slice moves if we have the FEN (guards against double-slice)
        setMoves(prev => {
          const newMoves = prev.slice(0, -1);
          // Recompute lastMoveBy after rollback using explicit moverColor field
          if (newMoves.length === 0) {
            setLastMoveBy(null);
          } else {
            // Use the explicit moverColor from the last remaining move
            const lastRemainingMove = newMoves[newMoves.length - 1];
            setLastMoveBy(lastRemainingMove.moverColor);
          }
          return newMoves;
        });
        // Only slice confirmedMoves if the move was already confirmed (no pending notation)
        // Use ref to get current value and avoid stale closure
        if (!pendingNotationRef.current) {
          setConfirmedMoves(prev => prev.slice(0, -1));
        }
        setPendingNotation(null);
        setLastMoveSquares([]);
        setHasMadeMove(false);
      }
      
      if (data.violatorId === user?.id) {
        setMyViolations(prev => ({ ...prev, [claimType]: prev[claimType] + 1 }));
        setArbiterResult({ type: "illegal", message: validClaimMessagesYou[claimType] });
      } else {
        setOpponentViolations(prev => ({ ...prev, [claimType]: prev[claimType] + 1 }));
        setArbiterResult({ type: "illegal", message: validClaimMessagesOpponent[claimType] });
      }
    } else {
      // For "legal" rulings (false claims), violatorId is the person who made the false claim
      const falseClaimMessagesYou: Record<string, string> = {
        unsportsmanlike: "Arbiter rewarded 2 mins to opponent for creating a false unsportsmanlike claim.",
        illegal: "Arbiter rewarded 2 mins to opponent for creating a false illegal move claim.",
        distraction: "Arbiter rewarded 2 mins to opponent for creating a false distraction claim.",
        threefold: "Arbiter rewarded 2 mins to opponent for creating a false 3-fold repetition claim.",
        fiftymove: "Arbiter rewarded 2 mins to opponent for creating a false 50-move rule claim.",
      };
      const falseClaimMessagesOpponent: Record<string, string> = {
        unsportsmanlike: "Arbiter rewarded 2 mins to you. Opponent made a false unsportsmanlike claim.",
        illegal: "Arbiter rewarded 2 mins to you. Opponent made a false illegal move claim.",
        distraction: "Arbiter rewarded 2 mins to you. Opponent made a false distraction claim.",
        threefold: "Arbiter rewarded 2 mins to you. Opponent made a false 3-fold repetition claim.",
        fiftymove: "Arbiter rewarded 2 mins to you. Opponent made a false 50-move rule claim.",
      };
      if (data.violatorId === user?.id) {
        // I made the false claim, so increment MY false claims
        setMyFalseClaims(prev => ({ ...prev, [claimType]: prev[claimType] + 1 }));
        setArbiterResult({ type: "legal", message: falseClaimMessagesYou[claimType] || "Your claim was false - opponent gains 2 minutes." });
      } else {
        // Opponent made a false claim against me
        setOpponentFalseClaims(prev => ({ ...prev, [claimType]: prev[claimType] + 1 }));
        setArbiterResult({ type: "legal", message: falseClaimMessagesOpponent[claimType] || "Opponent made a false claim. You gain 2 minutes." });
      }
    }
    
    setTimeout(() => setArbiterResult(null), 4000);
  }, [matchId, user?.id, playerColor, toast]);

  const handleOpponentGameEnd = useCallback(async (data: { result: string; reason: string }) => {
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
    
    // Refetch ratings and calculate change for non-bot games
    if (!isBotGame) {
      try {
        await queryClient.refetchQueries({ queryKey: ["/api/ratings"] });
        const freshRatings = queryClient.getQueryData<Rating>(["/api/ratings"]);
        if (freshRatings && initialPlayerRating !== null) {
          // Determine which rating pool was used based on time control
          const minutes = parseInt(timeControl);
          let newRating: number;
          if (minutes <= 3) {
            newRating = freshRatings.otbBullet || 1000;
          } else if (minutes <= 10) {
            newRating = freshRatings.otbBlitz || 1000;
          } else {
            newRating = freshRatings.otbRapid || 1000;
          }
          const change = newRating - initialPlayerRating;
          console.log('[OTB] Rating change calculated (opponent ended):', change, '(new:', newRating, 'old:', initialPlayerRating, ')');
          setRatingChange(change);
        }
      } catch (refetchError) {
        console.error('[OTB] Error refetching ratings:', refetchError);
      }
    }
    
    // Invalidate other queries to refresh data
    queryClient.invalidateQueries({ queryKey: ["/api/games/recent"] });
    queryClient.invalidateQueries({ queryKey: ["/api/games/history"] });
    queryClient.invalidateQueries({ queryKey: ["/api/statistics"] });
  }, [toast, isBotGame, timeControl, initialPlayerRating]);

  const handleOpponentHandshake = useCallback((data: { matchId: string }) => {
    // Use ref to get the latest matchId value and avoid stale closure issues
    if (data.matchId !== matchIdRef.current) return;
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

  // Rematch handlers
  const handleRematchRequest = useCallback((data: { matchId: string; from: string }) => {
    // Use ref to get the latest matchId value and avoid stale closure issues
    if (data.matchId !== matchIdRef.current) return;
    console.log('[OTB] Opponent wants rematch');
    setOpponentWantsRematch(true);
    toast({
      title: "Rematch Request",
      description: "Your opponent wants a rematch!",
    });
  }, [matchId, toast]);

  const handleRematchResponse = useCallback((data: { 
    matchId: string; 
    accepted: boolean; 
    newMatchId?: string;
    game?: any;
    color?: string;
    opponent?: { name: string; rating: number };
    timeControl?: string;
    playerRating?: number;
  }) => {
    console.log('[OTB] Rematch response:', data);
    if (data.accepted && data.newMatchId) {
      // Reset game state for rematch
      setRematchRequested(false);
      setOpponentWantsRematch(false);
      setRematchDeclined(false);
      setGameResult(null);
      setGameOverReason(null);
      setMatchId(data.newMatchId);
      matchIdRef.current = data.newMatchId; // Sync ref immediately to avoid stale closure issues
      
      // Set the game ID from server response
      if (data.game?.id) {
        setGameId(data.game.id);
      }
      
      // Clear position history for draw-seeking behavior
      clearPositionHistory();
      
      const newGame = new Chess();
      setGame(newGame);
      setLegalChessGame(new Chess());
      setBoardState(INITIAL_BOARD.map(row => [...row]));
      setMoves([]);
      setConfirmedMoves([]);
      setLastMoveBy(null);
      setPendingNotation(null);
      setNotationQueue([]);
      setPendingPlayerNotation(null);
      setWaitingForNotation(false);
      setLastMoveSquares([]);
      setActiveColor("white");
      setClockTurn("white");
      
      // Use server-provided color (random assignment) instead of swapping
      const newColor = (data.color as "white" | "black") || (playerColor === "white" ? "black" : "white");
      setPlayerColor(newColor);
      
      // Update opponent info from server
      if (data.opponent) {
        setOpponentName((data.opponent.name || '').trim().split(/\s+/)[0] || 'Opponent');
        setOpponentRating(data.opponent.rating);
      }
      if (data.playerRating) {
        setPlayerRating(data.playerRating);
      }
      
      // Reset times - use server-provided timeControl or fall back to current
      const tcFromServer = data.timeControl || timeControl;
      const minutes = parseInt(tcFromServer);
      const seconds = minutes * 60;
      setWhiteTime(seconds);
      setBlackTime(seconds);
      
      // Reset all other game state
      setClockPresses(0);
      setMyViolations({ unsportsmanlike: 0, illegal: 0, distraction: 0 });
      setOpponentViolations({ unsportsmanlike: 0, illegal: 0, distraction: 0, threefold: 0, fiftymove: 0 });
      setMyFalseClaims({ unsportsmanlike: 0, illegal: 0, distraction: 0, threefold: 0, fiftymove: 0 });
      setOpponentFalseClaims({ unsportsmanlike: 0, illegal: 0, distraction: 0 });
      setMyHandshakeOffered(false);
      setOpponentHandshakeOffered(false);
      setHandshakeComplete(false);
      setShowHandshakeUI(true);
      setMyHandshakeBeforeFirstMove(false);
      setOpponentHandshakeBeforeFirstMove(false);
      setOpponentHandshakeViolation(false);
      setPostGameHandshakeOffered(false);
      setOpponentPostGameHandshakeOffered(false);
      setPostGameHandshakeComplete(false);
      setTouchedPiece(null);
      setArbiterResult(null);
      setHasMadeMove(false);
      setPendingCheckmate(null);
      setArbiterPending(false);
      setDrawOffered(false);
      setOpponentOfferedDraw(false);
      
      // Ensure game is started
      setGameStarted(true);
      
      gameStartTimeRef.current = Date.now();
      
      toast({
        title: "Rematch Started!",
        description: `You are now playing as ${newColor}`,
      });
    } else {
      setRematchDeclined(true);
      toast({
        title: "Rematch Declined",
        description: "Your opponent declined the rematch.",
      });
    }
  }, [playerColor, timeControl, toast]);

  // Draw offer handlers
  const handleDrawOfferReceived = useCallback((data: { matchId: string; from: string }) => {
    // Use ref to get the latest matchId value and avoid stale closure issues
    if (data.matchId !== matchIdRef.current) return;
    console.log('[OTB] Opponent offered draw');
    setOpponentOfferedDraw(true);
    toast({
      title: "Draw Offer",
      description: "Your opponent offers a draw. Accept or decline.",
    });
  }, [matchId, toast]);

  const handleDrawResponse = useCallback((data: { matchId: string; accepted: boolean }) => {
    // Use ref to get the latest matchId value and avoid stale closure issues
    if (data.matchId !== matchIdRef.current) return;
    console.log('[OTB] Draw response:', data.accepted);
    setDrawOffered(false);
    
    if (data.accepted) {
      // Draw was accepted - end the game
      if (handleGameEndRef.current) {
        handleGameEndRef.current("draw");
      }
      toast({
        title: "Draw Accepted",
        description: "The game is a draw by agreement.",
      });
    } else {
      toast({
        title: "Draw Declined",
        description: "Your opponent declined the draw offer.",
      });
    }
  }, [matchId, toast]);

  // Handler for post-game handshake offer from opponent
  const handlePostGameHandshakeOffer = useCallback((data: { matchId: string }) => {
    if (data.matchId !== matchIdRef.current) return;
    console.log('[OTB] Received post-game handshake offer from opponent');
    setOpponentPostGameHandshakeOffered(true);
    
    // If we already offered, mark as complete
    if (postGameHandshakeOffered) {
      setPostGameHandshakeComplete(true);
      toast({
        title: "Good Game!",
        description: "You and your opponent shook hands.",
      });
    } else {
      toast({
        title: "Handshake Offered",
        description: "Your opponent is offering a post-game handshake.",
      });
    }
  }, [postGameHandshakeOffered, toast]);

  const { sendMove, sendArbiterCall, sendArbiterRuling, sendGameEnd, sendHandshakeOffer, sendPostGameHandshakeOffer, sendRematchRequest, sendRematchResponse, sendDrawOffer, sendDrawResponse, joinMatch, isConnected, isAuthenticated, sendPlayerAway, sendPlayerBack } = useWebSocket({
    userId: user?.id,
    matchId: matchId || undefined,
    onMove: handleOpponentMove,
    onArbiterCall: handleArbiterCall,
    onArbiterRuling: handleArbiterRuling,
    onGameEnd: handleOpponentGameEnd,
    onHandshakeOffer: handleOpponentHandshake,
    onPostGameHandshakeOffer: handlePostGameHandshakeOffer,
    onJoinedMatch: handleJoinedMatch,
    onRematchRequest: handleRematchRequest,
    onRematchResponse: handleRematchResponse,
    onDrawOffer: handleDrawOfferReceived,
    onDrawResponse: handleDrawResponse,
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
      const currentGameId = gameIdRef.current;
      if (!currentGameId) return;
      await apiRequest("PATCH", `/api/games/${currentGameId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ratings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/games/recent"] });
      queryClient.invalidateQueries({ queryKey: ["/api/games/history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/statistics"] });
    },
  });

  const { data: ongoingGame } = useQuery<Game>({
    queryKey: ["/api/games/ongoing"],
    enabled: !restoredGame && !gameStarted && !inQueue,
  });

  // Fetch ratings to calculate rating change after game ends
  const { data: ratingsData } = useQuery<Rating>({
    queryKey: ["/api/ratings"],
    enabled: !!user,
  });

  // Fallback: Calculate rating change when ratingsData updates (in case callbacks didn't set it)
  // This runs when ratingsData is refetched and ratingChange hasn't been set yet
  useEffect(() => {
    if (gameResult && !isBotGame && ratingsData && initialPlayerRating !== null && ratingChange === null) {
      // Determine which rating pool was used based on time control
      const minutes = parseInt(timeControl);
      let newRating: number;
      if (minutes <= 3) {
        newRating = ratingsData.otbBullet || 1000;
      } else if (minutes <= 10) {
        newRating = ratingsData.otbBlitz || 1000;
      } else {
        newRating = ratingsData.otbRapid || 1000;
      }
      
      const change = newRating - initialPlayerRating;
      if (change !== 0) {
        console.log('[OTB] Rating change calculated (fallback):', change);
        setRatingChange(change);
      }
    }
  }, [gameResult, isBotGame, ratingsData, initialPlayerRating, timeControl, ratingChange]);

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

  // Queue countdown timer - auto-fill with bot after 30 seconds
  useEffect(() => {
    if (inQueue) {
      // Start 30 second countdown when joining queue
      setQueueCountdown(30);
      
      const countdownInterval = setInterval(() => {
        setQueueCountdown(prev => {
          if (prev === null || prev <= 1) {
            clearInterval(countdownInterval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      return () => {
        clearInterval(countdownInterval);
        setQueueCountdown(null);
      };
    } else {
      // Reset the bot auto-fill guard when we leave the queue
      botAutoFillInProgressRef.current = false;
      setQueueCountdown(null);
    }
  }, [inQueue]);

  // Auto-fill with bot when countdown reaches 0
  useEffect(() => {
    if (queueCountdown === 0 && inQueue) {
      // Guard against duplicate execution
      if (botAutoFillInProgressRef.current) return;
      botAutoFillInProgressRef.current = true;
      
      // Leave the queue first
      leaveQueueMutation.mutate({ queueType });
      
      // Get player's rating (use 1200 as default for OTB mode)
      const playerElo = 1200;
      
      // Find the two closest bot difficulty brackets
      const difficultyElos = Object.entries(BOT_DIFFICULTY_ELO) as [BotDifficulty, number][];
      const sortedByDistance = difficultyElos
        .map(([diff, elo]) => ({ diff, elo, distance: Math.abs(elo - playerElo) }))
        .sort((a, b) => a.distance - b.distance);
      
      // Get the two closest brackets (guard against only one bracket)
      const closest = sortedByDistance[0];
      const secondClosest = sortedByDistance[1] || closest;
      
      // Weighted probability: closer rating has higher chance
      const totalDistance = closest.distance + secondClosest.distance;
      const closestProbability = totalDistance > 0 
        ? (totalDistance - closest.distance) / totalDistance 
        : 0.5;
      
      const selectedDifficulty = Math.random() < closestProbability 
        ? closest.diff 
        : secondClosest.diff;
      
      // Random personality
      const randomPersonality = ALL_PERSONALITIES[Math.floor(Math.random() * ALL_PERSONALITIES.length)];
      
      // Get matching bot using getBotByConfig
      const selectedBot = getBotByConfig(selectedDifficulty, randomPersonality);
      
      if (selectedBot) {
        // Set time control based on queue type (OTB uses blitz/rapid patterns)
        if (queueType?.includes('rapid') || queueType?.includes('15') || queueType?.includes('10')) {
          setBotTimeControl('rapid');
        } else {
          setBotTimeControl('blitz');
        }
        
        // Format personality name nicely (e.g., "tactician" -> "Tactician")
        const personalityDisplay = randomPersonality.charAt(0).toUpperCase() + randomPersonality.slice(1).replace('_', ' ');
        
        toast({
          title: "No players found",
          description: `Matching you with ${selectedBot.name} (${personalityDisplay}, ${selectedBot.elo} Elo)...`,
        });
        
        // Start bot game with random color
        handleStartBotGame(selectedBot, "random");
      }
      // Note: botAutoFillInProgressRef is reset when inQueue becomes false in the countdown effect
    }
  }, [queueCountdown, inQueue, queueType]);

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
          matchIdRef.current = response.matchId; // Sync ref immediately to avoid stale closure issues
          
          // Clear position history for draw-seeking behavior
          clearPositionHistory();
          
          const chess = new Chess();
          setGame(chess);
          setLegalChessGame(new Chess());
          setBoardState(INITIAL_BOARD.map(row => [...row]));
          setMoves([]);
          setConfirmedMoves([]);
          setLastMoveBy(null);
          setPendingNotation(null);
          setNotationQueue([]);
          setPendingPlayerNotation(null);
          setWaitingForNotation(false);
          setLastMoveSquares([]);
          setSelectedSquare(null);
          setGameResult(null);
          setGameOverReason(null);
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
          setOpponentViolations({ unsportsmanlike: 0, illegal: 0, distraction: 0, threefold: 0, fiftymove: 0 });
          setMyFalseClaims({ unsportsmanlike: 0, illegal: 0, distraction: 0, threefold: 0, fiftymove: 0 });
          setOpponentFalseClaims({ unsportsmanlike: 0, illegal: 0, distraction: 0 });
          setMyHandshakeOffered(false);
          setOpponentHandshakeOffered(false);
          setHandshakeComplete(false);
          setShowHandshakeUI(true);
          setMyHandshakeBeforeFirstMove(false);
          setOpponentHandshakeBeforeFirstMove(false);
          setOpponentHandshakeViolation(false);
          setPostGameHandshakeOffered(false);
          setOpponentPostGameHandshakeOffered(false);
          setPostGameHandshakeComplete(false);
          setTouchedPiece(null);
          setHasMadeMove(false);
          setPendingCheckmate(null);
          setArbiterPending(false);
          setArbiterResult(null);
          
          if (response.opponent) {
            setOpponentName((response.opponent.name || '').trim().split(/\s+/)[0] || "Opponent");
            setOpponentId(response.opponent.id || null);
            setOpponentRating(response.opponent.rating || 1200);
          }
          if (response.playerRating) {
            setPlayerRating(response.playerRating);
            setInitialPlayerRating(response.playerRating);
          }
          setRatingChange(null);

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
      setGameOverReason(null);
      setRestoredGame(true);
    }
  }, [ongoingGame, restoredGame, gameStarted]);

  const saveGameState = useCallback(async () => {
    const currentGameId = gameIdRef.current;
    
    if (!currentGameId) return;
    
    try {
      // Use legalChessGame FEN when available for accurate castling rights
      // Fall back to boardToFen for compatibility
      const fen = legalChessGameRef.current?.fen() || boardToFen(boardState, activeColor);
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
    const currentGameId = gameIdRef.current;
    if (!currentGameId) {
      console.warn('[OTB] handleGameEnd called but no gameId available');
      // Still set game result to show the UI
      setGameResult(result);
      return;
    }

    if (saveIntervalRef.current) {
      clearInterval(saveIntervalRef.current);
      saveIntervalRef.current = null;
    }
    
    if (pendingCheckmateRef.current) {
      clearTimeout(pendingCheckmateRef.current);
      pendingCheckmateRef.current = null;
    }

    // Use legalChessGame FEN when available for accurate castling rights
    const fen = legalChessGameRef.current?.fen() || boardToFen(boardState, activeColor);
    
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
    
    // For multiplayer games, let the match complete API set the result on BOTH games
    // This prevents race condition where each player sets different results on their own game
    const currentMatchId = matchIdRef.current;
    const isMultiplayer = !!currentMatchId && !isBotGame;
    
    // Only set result directly for bot games - multiplayer games get result from completeMatch
    updateGameMutation.mutate({
      status: "completed",
      // CRITICAL: Don't set result for multiplayer - let completeMatch handle it atomically
      ...(isMultiplayer ? {} : { result }),
      completedAt: new Date(),
      fen,
      moves: sanMoves,
      whiteTime,
      blackTime,
      thinkingTimes,
      manualClockPresses: clockPresses,
    });

    // For multiplayer games, call match complete API to notify both players
    // This API atomically sets the SAME result on BOTH players' games
    if (currentMatchId) {
      apiRequest("POST", `/api/matches/${currentMatchId}/complete`, { result })
        .then(async () => {
          console.log('[OTB] Match complete API called successfully');
          // Wait for ratings to be refetched before calculating change
          try {
            await queryClient.refetchQueries({ queryKey: ["/api/ratings"] });
            const freshRatings = queryClient.getQueryData<Rating>(["/api/ratings"]);
            if (freshRatings && initialPlayerRating !== null) {
              // Determine which rating pool was used based on time control
              const minutes = parseInt(timeControl);
              let newRating: number;
              if (minutes <= 3) {
                newRating = freshRatings.otbBullet || 1000;
              } else if (minutes <= 10) {
                newRating = freshRatings.otbBlitz || 1000;
              } else {
                newRating = freshRatings.otbRapid || 1000;
              }
              const change = newRating - initialPlayerRating;
              console.log('[OTB] Rating change calculated:', change, '(new:', newRating, 'old:', initialPlayerRating, ')');
              setRatingChange(change);
            }
          } catch (refetchError) {
            console.error('[OTB] Error refetching ratings:', refetchError);
          }
        })
        .catch(async (error) => {
          console.error('[OTB] Error calling match complete API:', error);
          // Even if API fails (e.g., match already completed by other player), 
          // still refetch ratings since they may have been updated
          try {
            await queryClient.refetchQueries({ queryKey: ["/api/ratings"] });
            const freshRatings = queryClient.getQueryData<Rating>(["/api/ratings"]);
            if (freshRatings && initialPlayerRating !== null) {
              const minutes = parseInt(timeControl);
              let newRating: number;
              if (minutes <= 3) {
                newRating = freshRatings.otbBullet || 1000;
              } else if (minutes <= 10) {
                newRating = freshRatings.otbBlitz || 1000;
              } else {
                newRating = freshRatings.otbRapid || 1000;
              }
              const change = newRating - initialPlayerRating;
              console.log('[OTB] Rating change calculated (after API error):', change);
              setRatingChange(change);
            }
          } catch (refetchError) {
            console.error('[OTB] Error refetching ratings after API error:', refetchError);
          }
        });
    }

    toast({
      title: "Game Over",
      description: result === "draw" ? "Game drawn" : result === "white_win" ? "White wins!" : "Black wins!",
    });

    // Keep board visible by setting gameResult instead of immediately hiding
    setGameResult(result);
    setPendingCheckmate(null);
  }, [boardState, activeColor, updateGameMutation, moves, whiteTime, blackTime, clockPresses, toast, timeControl, initialPlayerRating, isBotGame]);

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
    
    // Block clock press if notation practice is on and queue has items BUT player doesn't have a pending move
    // This allows clock press for Move → Clock → Write flow while blocking during queue catch-up
    if (notationPractice && notationQueue.length > 0 && !pendingPlayerNotation) {
      toast({
        title: "Record your moves first",
        description: "Clear your notation queue before pressing the clock",
        variant: "destructive",
      });
      return;
    }
    
    // In multiplayer, can only press clock on your turn
    if (matchId && clockTurn !== playerColor) {
      return; // Not your turn, can't press clock
    }
    
    // Must have made a move before pressing clock (in multiplayer and bot games)
    if ((matchId || isBotGame) && !hasMadeMove) {
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
    
    // NEW: After clock press, add player's move to notation queue (Move → Clock → Write flow)
    if (notationPractice && pendingPlayerNotation) {
      const currentMoveCount = moves.length;
      const moveNumber = Math.floor((currentMoveCount - 1) / 2) + 1;
      const isWhiteMove = (currentMoveCount - 1) % 2 === 0;
      
      setNotationQueue(prev => [...prev, {
        notation: pendingPlayerNotation,
        isPlayerMove: true,
        moveNumber,
        isWhiteMove,
      }]);
      setPendingPlayerNotation(null);
      
      // For bot games, set waiting flag to pause bot until notation is recorded
      if (isBotGame) {
        setWaitingForNotation(true);
      }
    }
    
    // Send clock press to opponent via WebSocket
    if (matchId) {
      sendMove(matchId, "__CLOCK_PRESS__", "", whiteTime, blackTime, undefined);
    }
  }, [gameStarted, clockTurn, increment, clockPresses, arbiterPending, pendingCheckmate, matchId, isBotGame, hasMadeMove, playerColor, toast, sendMove, whiteTime, blackTime, notationPractice, notationQueue, pendingPlayerNotation, moves.length]);

  const handleStartGame = () => {
    const minutes = parseInt(timeControl);
    const seconds = minutes * 60;
    
    // Clear position history for draw-seeking behavior
    clearPositionHistory();
    
    setWhiteTime(seconds);
    setBlackTime(seconds);
    setIncrement(getIncrementForTimeControl(timeControl));
    setGameResult(null);
    setGameOverReason(null);
    setGameStarted(true);
    gameStartTimeRef.current = Date.now(); // Track game start for first move timing
    
    const newGame = new Chess();
    setGame(newGame);
    setLegalChessGame(new Chess());
    setBoardState(INITIAL_BOARD.map(row => [...row]));
    setMoves([]);
    setConfirmedMoves([]);
    setLastMoveBy(null);
    setPendingNotation(null);
    setNotationQueue([]);
    setPendingPlayerNotation(null);
    setWaitingForNotation(false);
    setLastMoveSquares([]);
    setActiveColor("white");
    setPlayerColor("white");
    setClockTurn("white");
    setClockPresses(0);
    setMyViolations({ unsportsmanlike: 0, illegal: 0, distraction: 0 });
    setOpponentViolations({ unsportsmanlike: 0, illegal: 0, distraction: 0, threefold: 0, fiftymove: 0 });
    setMyFalseClaims({ unsportsmanlike: 0, illegal: 0, distraction: 0, threefold: 0, fiftymove: 0 });
    setOpponentFalseClaims({ unsportsmanlike: 0, illegal: 0, distraction: 0 });
    setMyHandshakeOffered(false);
    setOpponentHandshakeOffered(false);
    setHandshakeComplete(false);
    setShowHandshakeUI(false);
    setMyHandshakeBeforeFirstMove(false);
    setOpponentHandshakeBeforeFirstMove(false);
    setOpponentHandshakeViolation(false);
    setPostGameHandshakeOffered(false);
    setOpponentPostGameHandshakeOffered(false);
    setPostGameHandshakeComplete(false);
    setTouchedPiece(null);
    setOpponentName("Practice Partner");
    setOpponentId(null);
    setOpponentRating(1200);
    setIsBotGame(false);
    setSelectedBot(null);
    setRematchRequested(false);
    setOpponentWantsRematch(false);
    setRematchDeclined(false);
    
    const mode = minutes <= 3 ? "otb_bullet" : minutes <= 10 ? "otb_blitz" : "otb_rapid";
    
    const gameIncrement = getIncrementForTimeControl(timeControl);
    setIncrement(gameIncrement);
    
    createGameMutation.mutate({
      mode,
      playerColor: "white",
      timeControl: minutes,
      increment: gameIncrement,
      fen: newGame.fen(),
      moves: [],
      whiteTime: seconds,
      blackTime: seconds,
      opponentName: "Practice",
    });
  };

  const requestBotMove = useCallback(async (currentFen: string, botId: string, moveHistorySAN?: string[], lastMoveInfo?: LastMoveInfo) => {
    try {
      // Parse bot ID to get difficulty and personality
      // Format: bot_<difficulty>_<personality> where personality may contain underscores
      const parts = botId.split('_');
      if (parts.length < 3) {
        throw new Error("Invalid bot ID format");
      }
      
      const difficulty = parts[1] as BotDifficulty;
      // Rejoin remaining parts for personalities like 'knight_lover' or 'bishop_lover'
      const personality = parts.slice(2).join('_') as BotPersonality;
      
      // Get bot's remaining time
      const botRemainingTime = playerColor === 'white' ? blackTime * 1000 : whiteTime * 1000;
      const moveCount = moveHistorySAN?.length || 0;
      
      // Use client-side bot engine with Stockfish + personality
      const result = await generateBotMoveClient(
        currentFen,
        personality,
        difficulty,
        botRemainingTime,
        moveCount,
        lastMoveInfo
      );
      
      if (!result) {
        throw new Error("Bot failed to generate move");
      }
      
      return result;
    } catch (error) {
      console.error("Error getting bot move:", error);
      toast({
        title: "Error",
        description: "Bot failed to respond",
        variant: "destructive",
      });
      return null;
    }
  }, [toast, playerColor, blackTime, whiteTime]);

  const handleStartBotGame = async (bot: BotProfile, colorChoice: "white" | "black" | "random") => {
    if (!user) return;
    
    // Clear position history for draw-seeking behavior
    clearPositionHistory();
    
    // Reset bot thinking state to prevent frozen board on rematch
    setBotThinking(false);
    
    // Reset hasMadeMove to allow player to make moves on rematch
    setHasMadeMove(false);
    
    // Use botTimeControl for bot games instead of general timeControl
    const isPracticeMode = botTimeControl === "practice";
    const minutes = isPracticeMode ? 99999999 : (botTimeControl === "blitz" ? 5 : 15);
    const seconds = isPracticeMode ? 99999999 : minutes * 60;
    
    setWhiteTime(seconds);
    setBlackTime(seconds);
    setGameResult(null);
    setGameOverReason(null);
    
    const newGame = new Chess();
    setGame(newGame);
    setLegalChessGame(new Chess());
    setBoardState(INITIAL_BOARD.map(row => [...row]));
    setMoves([]);
    setConfirmedMoves([]);
    setLastMoveBy(null);
    setPendingNotation(null);
    setNotationQueue([]);
    setPendingPlayerNotation(null);
    setWaitingForNotation(false);
    setLastMoveSquares([]);
    setActiveColor("white");
    setClockTurn("white");
    setClockPresses(0);
    setMyViolations({ unsportsmanlike: 0, illegal: 0, distraction: 0 });
    setOpponentViolations({ unsportsmanlike: 0, illegal: 0, distraction: 0, threefold: 0, fiftymove: 0 });
    setMyFalseClaims({ unsportsmanlike: 0, illegal: 0, distraction: 0, threefold: 0, fiftymove: 0 });
    setOpponentFalseClaims({ unsportsmanlike: 0, illegal: 0, distraction: 0 });
    setMyHandshakeOffered(false);
    setOpponentHandshakeOffered(true);
    setHandshakeComplete(false);
    setShowHandshakeUI(true);
    setMyHandshakeBeforeFirstMove(false);
    setOpponentHandshakeBeforeFirstMove(true);
    setOpponentHandshakeViolation(false);
    setPostGameHandshakeOffered(false);
    setOpponentPostGameHandshakeOffered(false);
    setPostGameHandshakeComplete(false);
    setTouchedPiece(null);
    setIsBotGame(true);
    setSelectedBot(bot);
    setShowBotSelection(false);
    setSelectedBotDifficulty(null);
    setSelectedBotPersonality(null);
    setRematchRequested(false);
    setOpponentWantsRematch(false);
    setRematchDeclined(false);
    
    const assignedColor = colorChoice === "random" 
      ? (Math.random() < 0.5 ? "white" : "black")
      : colorChoice;
    setPlayerColor(assignedColor);
    
    setOpponentName(bot.name);
    setOpponentId(null);
    setOpponentRating(bot.elo);
    
    // Practice mode uses a special mode that won't affect ratings
    const mode = isPracticeMode ? "otb_practice" : (botTimeControl === "blitz" ? "otb_blitz" : "otb_rapid");
    const gameIncrement = isPracticeMode ? 0 : (botTimeControl === "rapid" ? 30 : 0);
    setIncrement(gameIncrement);
    
    createGameMutation.mutate({
      mode,
      playerColor: assignedColor,
      timeControl: minutes,
      increment: gameIncrement,
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
      // Bot plays white and moves first - use human-like delay
      (async () => {
        const initialFen = newGame.fen();
        const thinkingDelay = getBotMoveDelay(1, seconds, initialFen, 'white', undefined); // Move 1, full time remaining, no last move
        console.log('[OTB Bot] Initial move delay:', thinkingDelay, 'ms');
        await delay(thinkingDelay);
        
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
            const botMoverColor: "white" | "black" = "white"; // Bot is white when player is black
            setMoves([{
              from: move.from,
              to: move.to,
              piece: piece || (move.color === 'w' ? pieceChar : pieceChar.toLowerCase()),
              captured: captured || undefined,
              notation: move.san, // Use standard algebraic notation from chess.js
              timestamp: Date.now(),
              moverColor: botMoverColor,
            }]);
            // Track that bot made this initial move
            setLastMoveBy(botMoverColor);
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
      })();
    }
  };

  const executeBotTurn = useCallback(async () => {
    // Use ref to get the LATEST legalChessGame state, avoiding stale closure issues
    const currentLegalGame = legalChessGameRef.current;
    if (!isBotGame || !selectedBot || !currentLegalGame || gameResult) return;
    
    const botColor = playerColor === "white" ? "black" : "white";
    if (activeColor !== botColor) return;
    
    // Set botThinking immediately to prevent re-triggers
    setBotThinking(true);
    
    // Track the validated game state (with player's move applied) for bot use
    let validatedGameState: Chess | null = null;
    
    if (moves.length > 0) {
      const lastMove = moves[moves.length - 1];
      
      // Validate only the CURRENT move against legalChessGame state
      // Don't replay all moves from scratch - that fails for OTB free movement games
      // Use the ref value to ensure we have the latest state
      const currentFenForValidation = currentLegalGame.fen();
      const validationChess = new Chess(currentFenForValidation);
      const moveHistory = currentLegalGame.history();
      console.log('[OTB Bot] === VALIDATION START ===');
      console.log('[OTB Bot] FEN:', currentFenForValidation);
      console.log('[OTB Bot] Move history:', moveHistory);
      console.log('[OTB Bot] Player move:', lastMove.from, '->', lastMove.to, lastMove.promotion ? `(promote: ${lastMove.promotion})` : '');
      console.log('[OTB Bot] Legal moves for', lastMove.from + ':', validationChess.moves({ square: lastMove.from as any, verbose: true }).map(m => m.to).join(', ') || 'NONE');
      let isLegal = true;
      let validationError: string | null = null;
      
      // Store player's move result for recapture detection
      let playerMoveResult: { from: string; to: string; captured?: string } | null = null;
      
      try {
        // Try to apply the player's last move to the current legal game state
        const result = validationChess.move({
          from: lastMove.from,
          to: lastMove.to,
          promotion: lastMove.promotion?.toLowerCase() as 'q' | 'r' | 'b' | 'n' | undefined,
        });
        isLegal = !!result;
        if (result) {
          console.log('[OTB Bot] Move VALID:', result.san);
          playerMoveResult = { from: result.from, to: result.to, captured: result.captured };
        }
      } catch (e: any) {
        isLegal = false;
        validationError = e?.message || String(e);
        console.log('[OTB Bot] Move INVALID - Error:', validationError);
      }
      console.log('[OTB Bot] === VALIDATION END ===');
      
      if (!isLegal) {
        setArbiterPending(true);
        
        const newIllegalCount = myViolations.illegal + 1;
        
        if (newIllegalCount >= 2) {
          const forfeitReason = "You lost due to a forced forfeit by the arbiter for making illegal moves.";
          toast({
            title: "Game Over - Forfeit",
            description: forfeitReason,
            variant: "destructive",
          });
          setGameOverReason(forfeitReason);
          setBotThinking(false);
          handleGameEnd(playerColor === "white" ? "black_win" : "white_win");
          return;
        }
        
        setMyViolations(prev => ({ ...prev, illegal: newIllegalCount }));
        toast({
          title: "Illegal Move Warning",
          description: "Arbiter rewarded 2 mins to opponent for an illegal move. One more and you forfeit.",
          variant: "destructive",
        });
        setArbiterResult({ type: "illegal", message: "Arbiter rewarded 2 mins to opponent for an illegal move." });
        
        const { rank: fromRank, file: fromFile } = squareToIndices(lastMove.from);
        const { rank: toRank, file: toFile } = squareToIndices(lastMove.to);
        
        setBoardState(prev => {
          const newBoard = prev.map(row => [...row]);
          newBoard[fromRank][fromFile] = lastMove.piece;
          newBoard[toRank][toFile] = lastMove.captured || null;
          return newBoard;
        });
        
        setMoves(prev => {
          const newMoves = prev.slice(0, -1);
          // Recompute lastMoveBy after rollback using explicit moverColor field
          if (newMoves.length === 0) {
            setLastMoveBy(null);
          } else {
            const lastRemainingMove = newMoves[newMoves.length - 1];
            setLastMoveBy(lastRemainingMove.moverColor);
          }
          return newMoves;
        });
        // Only slice confirmedMoves if the move was already confirmed (no pending notation)
        // Use ref to get current value and avoid stale closure
        if (!pendingNotationRef.current) {
          setConfirmedMoves(prev => prev.slice(0, -1));
        }
        setPendingNotation(null);
        setLastMoveSquares([]);
        
        if (botColor === "white") {
          setWhiteTime(prev => prev + 120);
        } else {
          setBlackTime(prev => prev + 120);
        }
        
        // legalChessGame stays unchanged - it's still at the correct state before the illegal move
        
        setActiveColor(playerColor);
        setClockTurn(playerColor);
        setHasMadeMove(false); // Allow player to retry with a legal move
        setBotThinking(false);
        
        setTimeout(() => {
          setArbiterResult(null);
          setArbiterPending(false);
        }, 3000);
        
        return;
      }
      
      // Move was legal - update legalChessGame to the validated state
      console.log('[OTB Bot] Player move validated, updating legalChessGame to:', validationChess.fen());
      setLegalChessGame(validationChess);
      validatedGameState = validationChess;
    }
    
    // Use validatedGameState if we just validated a move (it has the updated state)
    // Otherwise use currentLegalGame (for bot's opening move when player is black)
    const gameStateForBot = validatedGameState || currentLegalGame;
    
    // Check if the player's move resulted in checkmate, stalemate, or draw
    // This must happen BEFORE requesting bot move to avoid "No legal moves" error
    if (validatedGameState) {
      if (validatedGameState.isCheckmate()) {
        // Player delivered checkmate - player wins!
        // Set gameResult IMMEDIATELY to prevent race condition where useEffect triggers
        // executeBotTurn again before handleGameEnd runs
        const result = playerColor === "white" ? "white_win" : "black_win";
        setGameResult(result);
        setBotThinking(false);
        setTimeout(() => {
          handleGameEnd(result);
        }, 500);
        return;
      }
      
      if (validatedGameState.isDraw() || validatedGameState.isStalemate()) {
        // Player's move resulted in stalemate or draw
        // Set gameResult IMMEDIATELY to prevent race condition
        setGameResult("draw");
        setBotThinking(false);
        setTimeout(() => {
          handleGameEnd("draw");
        }, 500);
        return;
      }
    }
    
    const currentFen = gameStateForBot.fen();
    const moveHistorySAN = gameStateForBot.history();
    
    // Extract last move info for recapture detection
    // Need to look at the move BEFORE the current position (player's last move)
    const historyVerbose = gameStateForBot.history({ verbose: true });
    const playerLastMoveInfo = historyVerbose.length > 0 
      ? extractLastMoveInfoOTB(historyVerbose[historyVerbose.length - 1])
      : undefined;
    
    console.log('[OTB Bot] === BOT MOVE REQUEST ===');
    console.log('[OTB Bot] FEN sent to bot:', currentFen);
    console.log('[OTB Bot] Move history:', moveHistorySAN);
    if (playerLastMoveInfo?.captured) {
      console.log('[OTB Bot] Recapture opportunity: Player captured', playerLastMoveInfo.captured, 'on', playerLastMoveInfo.to);
    }
    const botMove = await requestBotMove(currentFen, selectedBot.id, moveHistorySAN, playerLastMoveInfo);
    console.log('[OTB Bot] Bot response:', botMove);
    
    // Add human-like delay before applying the move
    let thinkingDelay: number;
    
    if (botMove?.isFreeCapture) {
      // Free piece capture - quick reflexive "obvious take" timing (2 seconds)
      thinkingDelay = 2000;
      console.log('[OTB Bot] Free piece capture - using 2s reflexive delay');
    } else {
      // Move number is (current moves + 1) since bot is about to make a move
      const botMoveNumber = Math.ceil((moves.length + 1) / 2); // Convert to full move number (each side)
      const botRemainingTime = botColor === 'white' ? whiteTimeRef.current : blackTimeRef.current;
      thinkingDelay = getBotMoveDelay(botMoveNumber, botRemainingTime, currentFen, botColor, playerLastMoveInfo);
      console.log('[OTB Bot] Thinking delay:', thinkingDelay, 'ms (move', botMoveNumber, ', time:', botRemainingTime, 's)');
    }
    await delay(thinkingDelay);
    
    if (botMove && botMove.move) {
      console.log('[OTB Bot] Applying bot move:', botMove.move);
      const newLegalGame = new Chess(gameStateForBot.fen());
      const moveResult = newLegalGame.move(botMove.move);
      console.log('[OTB Bot] Move result:', moveResult ? moveResult.san : 'FAILED');
      console.log('[OTB Bot] FEN after bot move:', newLegalGame.fen());
      
      if (moveResult) {
        setLegalChessGame(newLegalGame);
        console.log('[OTB Bot] Updated legalChessGame to:', newLegalGame.fen());
        
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
          
          // Handle castling - also move the rook
          const isCastling = moveResult.flags.includes('k') || moveResult.flags.includes('q');
          if (isCastling) {
            const isKingside = moveResult.flags.includes('k');
            const rookRank = moveResult.color === 'w' ? 7 : 0; // rank 7 for white (row 0 visually), rank 0 for black (row 7 visually)
            const rookPiece = moveResult.color === 'w' ? 'R' : 'r';
            
            if (isKingside) {
              // Kingside: rook moves from h-file (file 7) to f-file (file 5)
              newBoard[rookRank][7] = null;
              newBoard[rookRank][5] = rookPiece;
              console.log('[OTB Bot] Castling kingside - moved rook from h to f file');
            } else {
              // Queenside: rook moves from a-file (file 0) to d-file (file 3)
              newBoard[rookRank][0] = null;
              newBoard[rookRank][3] = rookPiece;
              console.log('[OTB Bot] Castling queenside - moved rook from a to d file');
            }
          }
          
          const pieceChar = moveResult.piece.toUpperCase();
          const botMoveRecord: MoveRecord = {
            from: moveResult.from,
            to: moveResult.to,
            piece: piece || (moveResult.color === 'w' ? pieceChar : pieceChar.toLowerCase()),
            captured: captured || undefined,
            promotion: moveResult.promotion,
            notation: moveResult.san, // Use standard algebraic notation from chess.js
            timestamp: Date.now(),
            moverColor: botColor as "white" | "black",
          };
          setMoves(prevMoves => [...prevMoves, botMoveRecord]);
          // Bot moves are auto-confirmed (player doesn't record them)
          setConfirmedMoves(prev => [...prev, botMoveRecord]);
          
          return newBoard;
        });
        
        setLastMoveSquares([moveResult.from, moveResult.to]);
        
        // Track that bot made the last move for arbiter bonus calculation
        setLastMoveBy(botColor);
        
        // Notation practice: add bot's move to queue for player to record
        if (notationPractice) {
          const currentMoveCount = moves.length + 1; // +1 for the bot move just added
          const moveNumber = Math.floor((currentMoveCount - 1) / 2) + 1;
          const isWhiteMove = (currentMoveCount - 1) % 2 === 0;
          
          setNotationQueue(prev => [...prev, {
            notation: moveResult.san,
            isPlayerMove: false,
            moveNumber,
            isWhiteMove,
          }]);
          // Player must record bot's move before making their next move
          setWaitingForNotation(true);
        }
        
        if (newLegalGame.isCheckmate()) {
          // Set gameResult IMMEDIATELY to prevent race condition
          const result = botColor === "white" ? "white_win" : "black_win";
          setGameResult(result);
          setBotThinking(false);
          setTimeout(() => {
            handleGameEnd(result);
          }, 500);
          return;
        }
        
        if (newLegalGame.isDraw() || newLegalGame.isStalemate()) {
          // Set gameResult IMMEDIATELY to prevent race condition
          setGameResult("draw");
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
          setHasMadeMove(false); // Allow player to make next move
          setBotThinking(false);
        }, 500);
      } else {
        // Bot move failed to execute, reset thinking state
        setHasMadeMove(false);
        setBotThinking(false);
      }
    } else {
      // No valid bot move received, reset thinking state
      setHasMadeMove(false);
      setBotThinking(false);
    }
  }, [isBotGame, selectedBot, legalChessGame, gameResult, playerColor, activeColor, moves, myViolations, toast, handleGameEnd, requestBotMove, increment]);

  useEffect(() => {
    // Pause bot if waiting for player to record notation (Move → Clock → Write flow)
    if (isBotGame && gameStarted && !botThinking && !arbiterPending && !gameResult && !waitingForNotation) {
      const botColor = playerColor === "white" ? "black" : "white";
      if (clockTurn === botColor && activeColor === botColor) {
        const timer = setTimeout(() => {
          executeBotTurn();
        }, 300);
        return () => clearTimeout(timer);
      }
    }
  }, [isBotGame, gameStarted, botThinking, arbiterPending, gameResult, playerColor, clockTurn, activeColor, executeBotTurn, waitingForNotation]);

  const isPawnPromotion = (piece: string | null, toRank: number): boolean => {
    if (!piece) return false;
    const isPawn = piece.toLowerCase() === 'p';
    if (!isPawn) return false;
    const isWhitePawn = piece === 'P';
    return (isWhitePawn && toRank === 0) || (!isWhitePawn && toRank === 7);
  };
  
  // Check if a piece on a given square has any legal moves
  // Returns true if legalChessGame is unavailable (conservative for touch-move enforcement)
  const pieceHasLegalMoves = (square: string): boolean => {
    if (!legalChessGame) return true; // Assume piece has moves to enforce touch-move
    try {
      const moves = legalChessGame.moves({ square: square as any, verbose: true });
      return moves.length > 0;
    } catch {
      return true; // Assume piece has moves on error
    }
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
    // SAFETY GUARD: Prevent king two-square moves from corrupting legalChessGame
    // This should never be reached due to guards in handleSquareClick, but acts as a fail-safe
    const isKing = originalPiece?.toLowerCase() === 'k';
    const fileDiff = Math.abs(toFile - fromFile);
    const rankDiff = Math.abs(toRank - fromRank);
    if (isKing && (fileDiff > 1 || rankDiff > 1)) {
      console.error('[completeMove] BLOCKED: King two-square move attempted - this should not happen!', fromSquare, '->', toSquare);
      toast({
        title: "Invalid Move",
        description: "King cannot move more than one square (except via castling)",
        variant: "destructive",
      });
      setSelectedSquare(null);
      setLockedPiece(null);
      setTouchedPiece(null);
      return;
    }
    
    const newBoard = boardState.map(row => [...row]);
    newBoard[fromRank][fromFile] = null;
    newBoard[toRank][toFile] = promotedPiece || originalPiece;
    
    // Handle en passant capture - requires ALL four conditions:
    // 1. Moving piece is a pawn
    // 2. Move is exactly one rank forward and one file sideways (diagonal)
    // 3. Destination square was empty (not a normal capture)
    // 4. Captured pawn must be on the correct en passant rank AND be an OPPONENT's pawn
    //    - White (uppercase P) captures from rank 5 (index 3), moving forward (decreasing rank index)
    //    - Black (lowercase p) captures from rank 4 (index 4), moving forward (increasing rank index)
    const isPawn = originalPiece?.toLowerCase() === 'p';
    const isWhitePawn = originalPiece === 'P';
    const isDiagonalMove = Math.abs(toFile - fromFile) === 1;
    const isOneRankMove = Math.abs(toRank - fromRank) === 1;
    const destinationWasEmpty = !captured;
    
    // Check rank eligibility for en passant
    // White pawns capture en passant from rank 5 (board index 3) moving to rank 6 (index 2)
    // Black pawns capture en passant from rank 4 (board index 4) moving to rank 3 (index 5)
    const isCorrectEnPassantRank = isWhitePawn 
      ? (fromRank === 3 && toRank === 2)  // White: from rank 5 to rank 6
      : (fromRank === 4 && toRank === 5); // Black: from rank 4 to rank 3
    
    if (isPawn && isDiagonalMove && isOneRankMove && destinationWasEmpty && isCorrectEnPassantRank) {
      // Potential en passant - verify captured pawn is an opponent's pawn
      const capturedPawnRank = fromRank;
      const capturedPawnFile = toFile;
      const capturedPawn = newBoard[capturedPawnRank][capturedPawnFile];
      
      // Captured pawn must exist AND be the opponent's color
      const isOpponentPawn = capturedPawn && (
        (isWhitePawn && capturedPawn === 'p') ||  // White capturing black pawn
        (!isWhitePawn && capturedPawn === 'P')    // Black capturing white pawn
      );
      
      if (isOpponentPawn) {
        newBoard[capturedPawnRank][capturedPawnFile] = null;
        console.log('[OTB] En passant capture: removed pawn from', String.fromCharCode(97 + capturedPawnFile) + (8 - capturedPawnRank));
      }
    }
    
    setBoardState(newBoard);
    
    // Try to get SAN from chess.js, fall back to generating SAN from board state
    let moveNotation: string;
    let newFenFromChess: string | null = null;
    
    const pieceIsWhite = originalPiece === originalPiece.toUpperCase();
    const nextTurn: "white" | "black" = pieceIsWhite ? "black" : "white";
    
    // Track if this move ends the game (checkmate/stalemate/draw)
    let gameEndingResult: "white_win" | "black_win" | "draw" | null = null;
    
    // Track if the move was legal (for king capture differentiation)
    let moveWasLegal = false;
    
    // Helper to generate SAN from current board state (before move was applied)
    const generateSanFromBoardState = (): string => {
      // Reconstruct FEN from board state before the move
      const preMoveFen = boardToFen(boardState, pieceIsWhite ? "white" : "black");
      const sanResult = generateSanNotation(preMoveFen, fromSquare, toSquare, promotedPiece);
      if (sanResult) {
        return sanResult;
      }
      // Ultimate fallback for truly illegal moves - mark as illegal
      const promotionSuffix = promotedPiece ? `=${promotedPiece.toUpperCase()}` : '';
      return `${fromSquare}${toSquare}${promotionSuffix}`;
    };
    
    // For multiplayer: try to make the move in chess.js to get SAN
    if (legalChessGame) {
      const newLegalGame = new Chess(legalChessGame.fen());
      try {
        const sanMoveResult = newLegalGame.move({
          from: fromSquare,
          to: toSquare,
          promotion: promotedPiece ? promotedPiece.toLowerCase() as 'q' | 'r' | 'b' | 'n' : undefined,
        });
        if (sanMoveResult) {
          moveNotation = sanMoveResult.san;
          newFenFromChess = newLegalGame.fen();
          moveWasLegal = true; // Move validated by chess.js
          if (matchId) {
            setLegalChessGame(newLegalGame);
            
            // Check for checkmate/stalemate/draw after legal move in multiplayer OTB
            if (newLegalGame.isCheckmate()) {
              const winnerColor = pieceIsWhite ? "white" : "black";
              console.log('[OTB] Legal checkmate detected! Winner:', winnerColor);
              gameEndingResult = winnerColor === "white" ? "white_win" : "black_win";
            } else if (newLegalGame.isStalemate()) {
              console.log('[OTB] Stalemate detected!');
              gameEndingResult = "draw";
            } else if (newLegalGame.isDraw()) {
              console.log('[OTB] Draw detected (50-move rule, insufficient material, or repetition)');
              gameEndingResult = "draw";
            }
          }
        } else {
          // Move returned null - generate SAN from board state
          moveNotation = generateSanFromBoardState();
        }
      } catch (e) {
        // Move threw error - generate SAN from board state
        moveNotation = generateSanFromBoardState();
        if (matchId) {
          const newFenForLegal = boardToFen(newBoard, nextTurn);
          const freshGame = new Chess(newFenForLegal);
          setLegalChessGame(freshGame);
        }
      }
    } else {
      // No legalChessGame - generate SAN from board state
      moveNotation = generateSanFromBoardState();
    }
    
    const newMove: MoveRecord = {
      from: fromSquare,
      to: toSquare,
      piece: originalPiece,
      captured: captured || undefined,
      promotion: promotedPiece,
      notation: moveNotation,
      timestamp: Date.now(),
      moverColor: activeColor as "white" | "black",
    };
    
    setMoves(prev => [...prev, newMove]);
    setSelectedSquare(null);
    setLockedPiece(null); // Reset touch-move lock after completing a move
    setLastMoveSquares([fromSquare, toSquare]);
    
    // Notation practice: store notation to add to queue after clock press (Move → Clock → Write flow)
    if (notationPractice) {
      setPendingPlayerNotation(moveNotation);
      // Auto-confirm the move - the notation queue handles the writing requirement
      setConfirmedMoves(prev => [...prev, newMove]);
    } else {
      // If not practicing notation, auto-confirm the move
      setConfirmedMoves(prev => [...prev, newMove]);
    }
    
    // Set hasMadeMove for both multiplayer AND bot games to prevent multiple moves before clock/validation
    if (matchId || isBotGame) {
      setHasMadeMove(true);
    }
    
    // Always track who made the last move for arbiter bonus calculation
    // This works for promotions too since they flow through completeMove
    setLastMoveBy(activeColor);
    
    // Use the FEN from chess.js if we have it, otherwise compute from board
    const newFen = newFenFromChess || boardToFen(newBoard, nextTurn);
    
    if (matchId) {
      sendMove(matchId, moveNotation, newFen, whiteTime, blackTime, {
        from: fromSquare,
        to: toSquare,
        piece: originalPiece,
        captured: captured || undefined,
        promotion: promotedPiece || undefined,
        playerColor: playerColor,
      });
    }
    
    // Handle king capture (checkmate in OTB mode)
    if (captured?.toLowerCase() === "k") {
      const checkmateWinner = captured === "K" ? "black" : "white";
      
      if (moveWasLegal) {
        // Legal checkmate - end game immediately, no arbiter window needed
        console.log('[OTB] Legal king capture - ending game immediately');
        setGameResult(checkmateWinner === "white" ? "white_win" : "black_win");
        handleGameEnd(checkmateWinner === "white" ? "white_win" : "black_win");
      } else {
        // Illegal move leading to checkmate - give opponent 30 seconds to call arbiter
        console.log('[OTB] Illegal king capture - 30 second arbiter window');
        setPendingCheckmate({
          winner: checkmateWinner,
          countdown: 30,
          isIllegalMove: true,
        });
      }
    }
    
    saveGameState();
    
    // If this move ended the game (checkmate/stalemate/draw), handle it after sending move
    if (gameEndingResult) {
      setHasMadeMove(false);
      setGameResult(gameEndingResult);
      handleGameEnd(gameEndingResult);
    }
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
    
    // Block moves while waiting for notation queue to be cleared
    if (notationPractice && notationQueue.length > 0) {
      toast({
        title: "Record your moves first",
        description: "Clear your notation queue before making another move",
        variant: "destructive",
      });
      return;
    }
    
    const isMyTurn = activeColor === playerColor;
    if (!isMyTurn && matchId) return;
    if (!isMyTurn && isBotGame) return;
    
    if (hasMadeMove && (matchId || isBotGame)) {
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
        setLockedPiece(null);
        return;
      }
      
      // Block king moving more than 1 square (except via OTB castling)
      // This MUST come first to prevent any king-2-squares move from reaching completeMove
      const isKing = movingPiece?.toLowerCase() === 'k';
      const fileDiff = Math.abs(file - fromFile);
      const rankDiff = Math.abs(rank - fromRank);
      
      if (isKing && (fileDiff > 1 || rankDiff > 1)) {
        // Check if this is OTB-style castling (king to own rook)
        const isRook = pieceOnSquare?.toLowerCase() === 'r';
        const clickedOwnRook = pieceColor === activeColor && isRook;
        
        if (clickedOwnRook) {
          // This is OTB castling - process it
          const kingFile = fromFile;
          const rookFile = file;
          const isKingside = rookFile > kingFile;
          const isQueenside = rookFile < kingFile;
          
          const currentLegalGame = legalChessGameRef.current;
          if (currentLegalGame) {
            // Determine target squares for chess.js castling move
            const kingRank = fromRank;
            const newKingFile = isKingside ? 6 : 2; // g-file or c-file
            const newRookFile = isKingside ? 5 : 3; // f-file or d-file
            const kingToSquare = indicesToSquare(kingRank, newKingFile);
            const rookToSquare = indicesToSquare(kingRank, newRookFile);
            
            // Execute castling on chess.js FIRST (it moves both pieces internally)
            const newLegalGame = new Chess(currentLegalGame.fen());
            try {
              const moveResult = newLegalGame.move({ from: selectedSquare, to: kingToSquare });
              
              if (moveResult && (moveResult.flags.includes('k') || moveResult.flags.includes('q'))) {
                // Castling succeeded
                // For multiplayer: update legalChessGame immediately
                // For bot games: do NOT update here - let executeBotTurn handle validation
                // This prevents double-applying the castling move
                if (matchId) {
                  setLegalChessGame(newLegalGame);
                }
                
                // Mirror the result to boardState
                const newBoard = boardState.map(row => [...row]);
                newBoard[fromRank][fromFile] = null;
                newBoard[rank][file] = null;
                newBoard[kingRank][newKingFile] = movingPiece;
                newBoard[kingRank][newRookFile] = pieceOnSquare;
                setBoardState(newBoard);
                
                const castlingNotation = isKingside ? 'O-O' : 'O-O-O';
                const newMove: MoveRecord = {
                  from: selectedSquare,
                  to: kingToSquare,
                  piece: movingPiece!,
                  notation: castlingNotation,
                  timestamp: Date.now(),
                  moverColor: activeColor as "white" | "black",
                };
                
                setMoves(prev => [...prev, newMove]);
                setSelectedSquare(null);
                setLockedPiece(null);
                setTouchedPiece(null);
                setLastMoveSquares([selectedSquare, kingToSquare, square, rookToSquare]);
                
                if (matchId || isBotGame) {
                  setHasMadeMove(true);
                  // Track who made this move for arbiter bonus calculation
                  setLastMoveBy(activeColor);
                }
                
                // Use legalChessGame FEN for accurate castling rights
                const newFen = newLegalGame.fen();
                
                if (matchId) {
                  sendMove(matchId, castlingNotation, newFen, whiteTime, blackTime, {
                    from: selectedSquare,
                    to: kingToSquare,
                    piece: movingPiece!,
                    playerColor: playerColor,
                  });
                }
                
                saveGameState();
                return;
              }
            } catch (e) {
              console.log('[OTB Castling] Move rejected by chess.js:', e);
            }
          }
          
          // Castling not legal
          toast({
            title: "Castling not allowed",
            description: "Castling is not legal in this position",
            variant: "destructive",
          });
          setSelectedSquare(null);
          setLockedPiece(null);
          setTouchedPiece(null);
          return;
        }
        
        // King moving more than 1 square but not clicking rook - illegal
        toast({
          title: "Invalid King Move",
          description: "In OTB mode, castle by clicking your king then clicking your rook",
          variant: "destructive",
        });
        setSelectedSquare(null);
        setLockedPiece(null);
        setTouchedPiece(null);
        return;
      }
      
      // Touch-move rule: Can only switch pieces if the locked piece has NO legal moves
      if (pieceColor === activeColor) {
        // Check if trying to switch to a different piece
        if (square !== selectedSquare) {
          // Only allow switching if locked piece has no legal moves
          if (lockedPiece && pieceHasLegalMoves(lockedPiece)) {
            toast({
              title: "Touch-Move Rule",
              description: "You touched a piece with legal moves. You must move it.",
              variant: "destructive",
            });
            return;
          }
          // Can switch - new piece becomes the selection (and potentially locked)
          setSelectedSquare(square);
          if (pieceHasLegalMoves(square)) {
            setLockedPiece(square);
          }
        }
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
        // Touch-move: if piece has legal moves, lock to it
        if (pieceHasLegalMoves(square)) {
          setLockedPiece(square);
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
      threefold: myFalseClaims.threefold + 1,
      fiftymove: myFalseClaims.fiftymove + 1,
    };
    
    const hasForfeit = newFalseClaims.unsportsmanlike >= 2 || newFalseClaims.illegal >= 2 || newFalseClaims.distraction >= 2 || newFalseClaims.threefold >= 2 || newFalseClaims.fiftymove >= 2;
    
    if (hasForfeit) {
      const forfeitReason = "You lost due to a forced forfeit by the arbiter for making multiple false claims.";
      toast({
        title: "Game Over - Forfeit",
        description: forfeitReason,
        variant: "destructive",
      });
      setGameOverReason(forfeitReason);
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
  
  const handleArbiterClaim = (claimType: "unsportsmanlike" | "illegal" | "distraction" | "threefold" | "fiftymove") => {
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
    } else if (claimType === "threefold") {
      // Check for threefold repetition using the current game state
      if (legalChessGame) {
        isValidClaim = legalChessGame.isThreefoldRepetition();
      } else {
        isValidClaim = false;
      }
    } else if (claimType === "fiftymove") {
      // Check 50-move rule: halfMoveClock >= 100 (100 half-moves = 50 full moves)
      if (legalChessGame) {
        // Get the FEN and extract halfmove clock (5th field)
        const fenParts = legalChessGame.fen().split(' ');
        const halfMoveClock = parseInt(fenParts[4], 10);
        isValidClaim = halfMoveClock >= 100;
      } else {
        isValidClaim = false;
      }
    }
    
    // Handle draw claims differently - they end the game in a draw if valid
    if ((claimType === "threefold" || claimType === "fiftymove") && isValidClaim) {
      const drawMessage = claimType === "threefold" 
        ? "The arbiter called a draw due to 3-fold repetition."
        : "The arbiter called a draw due to the 50-move rule.";
      toast({
        title: "Game Over - Draw",
        description: drawMessage,
      });
      handleGameEnd("draw");
      setArbiterPending(false);
      return;
    }
    
    if (isValidClaim) {
      const newViolationCount = opponentViolations[claimType] + 1;
      
      if (newViolationCount >= 2) {
        const forfeitMessages: Record<string, string> = {
          unsportsmanlike: "Opponent lost due to a forced forfeit by the arbiter for unsportsmanlike conduct.",
          illegal: "Opponent lost due to a forced forfeit by the arbiter for making illegal moves.",
          distraction: "Opponent lost due to a forced forfeit by the arbiter for causing repeated distractions.",
        };
        const forfeitReason = forfeitMessages[claimType] || `Opponent forfeited due to 2 ${claimType} violations.`;
        toast({
          title: "Game Over - You Win!",
          description: forfeitReason,
        });
        setGameOverReason(forfeitReason);
        handleGameEnd(playerColor === "white" ? "white_win" : "black_win");
        return;
      }
      
      const messages: Record<string, string> = {
        unsportsmanlike: "Arbiter rewarded 2 mins to you for opponent's unsportsmanlike conduct.",
        illegal: "Arbiter rewarded 2 mins to you for opponent's illegal move.",
        distraction: "Arbiter rewarded 2 mins to you for opponent causing a distraction.",
      };
      
      toast({
        title: "Arbiter Ruling",
        description: messages[claimType],
      });
      
      // Get previousFen from ref (saved BEFORE opponent's move was applied) for FEN-based restoration
      // This is the position before the illegal move, not after
      let previousFen: string | undefined;
      if (claimType === "illegal") {
        // Use the saved previous FEN from before opponent's move was applied
        if (previousLegalFenRef.current) {
          previousFen = previousLegalFenRef.current;
          console.log('[OTB Arbiter] Using saved previousFen:', previousFen);
        } else if (moves.length > 0) {
          // Fallback: rebuild FEN from move history minus the last move
          const tempChess = new Chess();
          try {
            for (let i = 0; i < moves.length - 1; i++) {
              const move = moves[i];
              tempChess.move({ from: move.from, to: move.to, promotion: move.promotion as any });
            }
            previousFen = tempChess.fen();
            console.log('[OTB Arbiter] Using rebuilt previousFen from moves:', previousFen);
          } catch {
            previousFen = new Chess().fen(); // Ultimate fallback: starting position
            console.log('[OTB Arbiter] Using fallback starting position');
          }
        }
      }
      
      // For multiplayer games, send arbiter ruling via WebSocket - handleArbiterRuling will apply changes
      // For bot games (no matchId), apply changes locally immediately
      // IMPORTANT: Award time bonus to the OPPONENT of whoever made the last move (the offender)
      // Use lastMoveBy state which explicitly tracks who made the last move
      const victimColor = lastMoveBy === "white" ? "black" : "white";
      const timeAdj = victimColor === "white" 
        ? { white: 120, black: 0 } 
        : { white: 0, black: 120 };
      
      // Generate claim-type specific messages (for bot games local display)
      const claimMessages: Record<string, string> = {
        unsportsmanlike: "Arbiter rewarded 2 mins to you for opponent's unsportsmanlike conduct.",
        illegal: "Arbiter rewarded 2 mins to you for opponent's illegal move.",
        distraction: "Arbiter rewarded 2 mins to you for opponent causing a distraction.",
      };
      
      if (matchId && opponentId) {
        // Multiplayer: send WebSocket message - broadcast will apply changes for both players
        // Pass claimType so both players get claim-type specific messages
        console.log('[OTB Arbiter SEND] Sending arbiter ruling:', {
          matchId,
          ruling: "illegal",
          violatorId: opponentId,
          timeAdj,
          previousFen: previousFen ? previousFen.substring(0, 50) + '...' : 'undefined',
          claimType,
        });
        sendArbiterRuling(matchId, "illegal", opponentId, timeAdj, false, undefined, previousFen, claimType);
      } else {
        // Bot game or no matchId: apply changes locally
        setWhiteTime(prev => prev + timeAdj.white);
        setBlackTime(prev => prev + timeAdj.black);
        setOpponentViolations(prev => ({ ...prev, [claimType]: prev[claimType] + 1 }));
        
        // For illegal move claims only, reset the board
        if (claimType === "illegal" && previousFen) {
          const fenParts = previousFen.split(' ')[0];
          const rows = fenParts.split('/');
          const newBoard: (string | null)[][] = [];
          for (const row of rows) {
            const boardRow: (string | null)[] = [];
            for (const char of row) {
              if (isNaN(parseInt(char))) {
                boardRow.push(char);
              } else {
                for (let i = 0; i < parseInt(char); i++) {
                  boardRow.push(null);
                }
              }
            }
            newBoard.push(boardRow);
          }
          setBoardState(newBoard);
          // Use full FEN for proper Chess state including castling/en-passant rights
          setLegalChessGame(new Chess(previousFen));
          
          const turnChar = previousFen.split(' ')[1];
          const newActiveColor = turnChar === 'w' ? 'white' : 'black';
          setActiveColor(newActiveColor);
          setClockTurn(newActiveColor);
          setMoves(prev => {
            const newMoves = prev.slice(0, -1);
            // Recompute lastMoveBy after rollback using explicit moverColor field
            if (newMoves.length === 0) {
              setLastMoveBy(null);
            } else {
              const lastRemainingMove = newMoves[newMoves.length - 1];
              setLastMoveBy(lastRemainingMove.moverColor);
            }
            return newMoves;
          });
          // Only slice confirmedMoves if the move was already confirmed (no pending notation)
          // Use ref to get current value and avoid stale closure
          if (!pendingNotationRef.current) {
            setConfirmedMoves(prev => prev.slice(0, -1));
          }
          setPendingNotation(null);
          setLastMoveSquares([]);
          setHasMadeMove(false);
        }
        
        // Use claim-type specific message
        setArbiterResult({ type: "illegal", message: claimMessages[claimType] });
        setTimeout(() => setArbiterResult(null), 4000);
      }
    } else {
      const newFalseClaimCount = myFalseClaims[claimType] + 1;
      
      // Specific forfeit messages for each false claim type
      const forfeitMessages: Record<string, string> = {
        unsportsmanlike: "You lost due to a forced forfeit by the arbiter for making multiple false unsportsmanlike claims.",
        illegal: "You lost due to a forced forfeit by the arbiter for making multiple false illegal move claims.",
        distraction: "You lost due to a forced forfeit by the arbiter for making multiple false distraction claims.",
        threefold: "You lost due to a forced forfeit by the arbiter for making multiple false 3-fold repetition claims.",
        fiftymove: "You lost due to a forced forfeit by the arbiter for making multiple false 50-move rule claims.",
      };
      
      // Specific warning messages for each false claim type
      const warningMessages: Record<string, string> = {
        unsportsmanlike: "Arbiter rewarded 2 mins to opponent for creating a false unsportsmanlike claim. One more and you forfeit.",
        illegal: "Arbiter rewarded 2 mins to opponent for creating a false illegal move claim. One more and you forfeit.",
        distraction: "Arbiter rewarded 2 mins to opponent for creating a false distraction claim. One more and you forfeit.",
        threefold: "Arbiter rewarded 2 mins to opponent for creating a false 3-fold repetition claim. One more and you forfeit.",
        fiftymove: "Arbiter rewarded 2 mins to opponent for creating a false 50-move rule claim. One more and you forfeit.",
      };
      
      // Bot game local false claim arbiter result messages
      const falseClaimArbiterMessages: Record<string, string> = {
        unsportsmanlike: "Arbiter rewarded 2 mins to opponent for creating a false unsportsmanlike claim.",
        illegal: "Arbiter rewarded 2 mins to opponent for creating a false illegal move claim.",
        distraction: "Arbiter rewarded 2 mins to opponent for creating a false distraction claim.",
        threefold: "Arbiter rewarded 2 mins to opponent for creating a false 3-fold repetition claim.",
        fiftymove: "Arbiter rewarded 2 mins to opponent for creating a false 50-move rule claim.",
      };
      
      if (newFalseClaimCount >= 2) {
        toast({
          title: "Game Over - Forfeit",
          description: forfeitMessages[claimType],
          variant: "destructive",
        });
        setGameOverReason(forfeitMessages[claimType]);
        handleGameEnd(playerColor === "white" ? "black_win" : "white_win");
        return;
      }
      
      toast({
        title: "False Claim Warning",
        description: warningMessages[claimType],
        variant: "destructive",
      });
      
      // For multiplayer games, send ruling via WebSocket - handleArbiterRuling will apply changes
      // For bot games (no matchId), apply changes locally immediately
      const timeAdj = playerColor === "white" 
        ? { white: 0, black: 120 } 
        : { white: 120, black: 0 };
      
      if (matchId && user?.id) {
        // Multiplayer: send WebSocket message - broadcast will apply changes for both players
        // Pass claimType so both players track the correct false claim type
        sendArbiterRuling(matchId, "legal", user.id, timeAdj, false, undefined, undefined, claimType);
      } else {
        // Bot game or no matchId: apply changes locally
        setWhiteTime(prev => prev + timeAdj.white);
        setBlackTime(prev => prev + timeAdj.black);
        setMyFalseClaims(prev => ({ ...prev, [claimType]: prev[claimType] + 1 }));
        setArbiterResult({ type: "legal", message: falseClaimArbiterMessages[claimType] });
        setTimeout(() => setArbiterResult(null), 4000);
      }
    }
    
    setArbiterPending(false);
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
    // For bot games, accept the draw immediately
    if (isBotGame) {
      handleGameEnd("draw");
      return;
    }
    
    // For multiplayer, send a draw offer and wait for response
    if (matchId) {
      setDrawOffered(true);
      sendDrawOffer(matchId);
      toast({
        title: "Draw Offered",
        description: "Waiting for opponent's response...",
      });
    }
  };

  // Handle accepting draw offer from opponent
  const handleAcceptDraw = () => {
    if (matchId) {
      sendDrawResponse(matchId, true);
      setOpponentOfferedDraw(false);
      handleGameEnd("draw");
    }
  };

  // Handle declining draw offer from opponent
  const handleDeclineDraw = () => {
    if (matchId) {
      sendDrawResponse(matchId, false);
      setOpponentOfferedDraw(false);
      toast({
        title: "Draw Declined",
        description: "You declined the draw offer.",
      });
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
      <Helmet>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="flex-1 flex items-center justify-center p-4 bg-muted/30 overflow-auto">
        <div className="w-full max-w-2xl space-y-3">
          <div>
            <h1 className="text-2xl font-bold">OTB Tournament Mode</h1>
            <p className="text-sm text-muted-foreground">Free movement · Arbiter resolves disputes</p>
          </div>

          <SuspensionBanner />

          {!gameStarted && !gameResult ? (
            <>
              {!inQueue ? (
                <Card>
                  <CardContent className="pt-6 space-y-4">
                    {!showBotSelection ? (
                      <>
                        {/* Training Wheels Toggle - collapsible like Blindfold Mode in Standard */}
                        <div className="flex items-center justify-between pb-4 border-b">
                          <Label htmlFor="training-wheels-toggle" className="text-base font-semibold">
                            Training Wheels
                          </Label>
                          <Switch
                            id="training-wheels-toggle"
                            checked={highlightLastMove || showLegalMoves || showPieceHighlight}
                            onCheckedChange={(checked) => {
                              setHighlightLastMove(checked);
                              setShowLegalMoves(checked);
                              setShowPieceHighlight(checked);
                              // Save all preferences at once
                              saveHighlightPreferencesMutation.mutate({
                                otbHighlightLastMove: checked,
                                otbShowLegalMoves: checked,
                                otbShowPieceHighlight: checked,
                              });
                            }}
                            data-testid="switch-training-wheels"
                          />
                        </div>
                        {(highlightLastMove || showLegalMoves || showPieceHighlight) && (
                          <div className="space-y-3 pb-4 border-b">
                            <p className="text-sm text-muted-foreground">
                              Visual aids to help you play. Disable for authentic OTB experience.
                            </p>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <Label htmlFor="highlight-last-move" className="text-sm cursor-pointer">Highlight Last Move</Label>
                                <Switch
                                  id="highlight-last-move"
                                  checked={highlightLastMove}
                                  onCheckedChange={(checked) => {
                                    setHighlightLastMove(checked);
                                    saveHighlightPreferencesMutation.mutate({ otbHighlightLastMove: checked });
                                  }}
                                  data-testid="switch-highlight-last-move"
                                />
                              </div>
                              <div className="flex items-center justify-between">
                                <Label htmlFor="show-legal-moves" className="text-sm cursor-pointer">Show Legal Moves</Label>
                                <Switch
                                  id="show-legal-moves"
                                  checked={showLegalMoves}
                                  onCheckedChange={(checked) => {
                                    setShowLegalMoves(checked);
                                    saveHighlightPreferencesMutation.mutate({ otbShowLegalMoves: checked });
                                  }}
                                  data-testid="switch-show-legal-moves"
                                />
                              </div>
                              <div className="flex items-center justify-between">
                                <Label htmlFor="show-piece-highlight" className="text-sm cursor-pointer">Highlight Selected Piece</Label>
                                <Switch
                                  id="show-piece-highlight"
                                  checked={showPieceHighlight}
                                  onCheckedChange={(checked) => {
                                    setShowPieceHighlight(checked);
                                    saveHighlightPreferencesMutation.mutate({ otbShowPieceHighlight: checked });
                                  }}
                                  data-testid="switch-show-piece-highlight"
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        {/* OTB Training Tools Toggle - collapsible */}
                        <div className="flex items-center justify-between pb-4 border-b">
                          <Label htmlFor="otb-tools-toggle" className="text-base font-semibold">
                            OTB Training Tools
                          </Label>
                          <Switch
                            id="otb-tools-toggle"
                            checked={perspective3d || notationPractice}
                            onCheckedChange={(checked) => {
                              setPerspective3d(checked);
                              if (isNotationAllowed) {
                                setNotationPractice(checked);
                              }
                            }}
                            data-testid="switch-otb-tools"
                          />
                        </div>
                        {(perspective3d || notationPractice) && (
                          <div className="space-y-3 pb-4 border-b">
                            <p className="text-sm text-muted-foreground">
                              Realistic tournament simulation features.
                            </p>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                  <Label htmlFor="perspective-3d" className="text-sm cursor-pointer">3D Perspective View</Label>
                                  <p className="text-xs text-muted-foreground">View board as if sitting at a table</p>
                                </div>
                                <Switch
                                  id="perspective-3d"
                                  checked={perspective3d}
                                  onCheckedChange={setPerspective3d}
                                  data-testid="switch-perspective-3d"
                                />
                              </div>
                              <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                  <Label 
                                    htmlFor="notation-practice" 
                                    className={`text-sm ${isNotationAllowed ? 'cursor-pointer' : 'text-muted-foreground cursor-not-allowed'}`}
                                  >
                                    Notation Practice
                                  </Label>
                                  <p className="text-xs text-muted-foreground">
                                    {isNotationAllowed 
                                      ? "Move → Clock → Write flow"
                                      : "Not required under 5 min (OTB rules)"
                                    }
                                  </p>
                                </div>
                                <Switch
                                  id="notation-practice"
                                  checked={notationPractice}
                                  onCheckedChange={setNotationPractice}
                                  disabled={!isNotationAllowed}
                                  data-testid="switch-notation-practice"
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Find Opponent Section */}
                        <h2 className="text-lg md:text-xl font-semibold">Find Opponent</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <Button 
                            variant="outline"
                            size="lg"
                            className="min-h-11"
                            onClick={() => handleJoinQueue("5")}
                            disabled={joinQueueMutation.isPending}
                            data-testid="button-queue-blitz"
                          >
                            <Clock className="mr-2 h-4 w-4" />
                            Blitz (5 min)
                          </Button>
                          <Button 
                            variant="outline"
                            size="lg"
                            className="min-h-11"
                            onClick={() => handleJoinQueue("15")}
                            disabled={joinQueueMutation.isPending}
                            data-testid="button-queue-rapid"
                          >
                            <Clock className="mr-2 h-4 w-4" />
                            Rapid (15 min)
                          </Button>
                        </div>
                        
                        {/* Practice vs Bot Section */}
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
                        
                        <div className="flex flex-wrap gap-2 mb-4">
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
                          <Button
                            variant={botTimeControl === "practice" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setBotTimeControl("practice")}
                            data-testid="button-bot-practice"
                          >
                            <InfinityIcon className="mr-1 h-3 w-3" />
                            Practice
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
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="pt-6 space-y-4 text-center">
                    <h2 className="text-xl font-semibold">Searching for Opponent</h2>
                    <div className="flex justify-center py-8">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                    </div>
                    <p className="text-muted-foreground">
                      {queueCountdown !== null && queueCountdown > 0 
                        ? `Finding opponent... Playing bot in ${queueCountdown}s`
                        : "Matching you with a bot..."}
                    </p>
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
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Trophy className="h-6 w-6 text-primary" />
                          <div>
                            <p className="font-semibold text-lg">Game Over</p>
                            <p className="text-sm text-muted-foreground">
                              {gameOverReason 
                                ? gameOverReason
                                : gameResult === "draw" 
                                  ? "Game drawn" 
                                  : gameResult === "white_win" 
                                    ? (playerColor === "white" ? "You win!" : "Opponent wins") 
                                    : (playerColor === "black" ? "You win!" : "Opponent wins")}
                            </p>
                            {ratingChange !== null && !isBotGame && (
                              <p className={`text-sm font-medium ${ratingChange >= 0 ? 'text-green-500' : 'text-red-500'}`} data-testid="text-rating-change">
                                {ratingChange >= 0 ? '+' : ''}{ratingChange} rating
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Post-game Handshake (PvP only) - courtesy gesture */}
                      {!isBotGame && matchId && !postGameHandshakeComplete && (
                        <div className="flex items-center gap-2">
                          {opponentPostGameHandshakeOffered && !postGameHandshakeOffered ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setPostGameHandshakeOffered(true);
                                setPostGameHandshakeComplete(true);
                                sendPostGameHandshakeOffer(matchId);
                                toast({
                                  title: "Good Game!",
                                  description: "You and your opponent shook hands.",
                                });
                              }}
                              data-testid="button-accept-postgame-handshake"
                            >
                              <HandshakeIcon className="mr-2 h-4 w-4" />
                              Accept Handshake
                            </Button>
                          ) : postGameHandshakeOffered && !opponentPostGameHandshakeOffered ? (
                            <div className="flex items-center gap-2 text-muted-foreground text-sm">
                              <HandshakeIcon className="h-4 w-4" />
                              <span>Handshake offered...</span>
                            </div>
                          ) : !postGameHandshakeOffered && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setPostGameHandshakeOffered(true);
                                sendPostGameHandshakeOffer(matchId);
                                toast({
                                  title: "Handshake Offered",
                                  description: "Waiting for opponent to shake hands...",
                                });
                              }}
                              data-testid="button-offer-postgame-handshake"
                            >
                              <HandshakeIcon className="mr-2 h-4 w-4" />
                              Offer Handshake
                            </Button>
                          )}
                        </div>
                      )}
                      
                      {/* Post-game handshake complete message */}
                      {!isBotGame && matchId && postGameHandshakeComplete && (
                        <div className="flex items-center gap-2 text-green-500 text-sm">
                          <HandshakeIcon className="h-4 w-4" />
                          <span>Good game! Handshake complete.</span>
                        </div>
                      )}
                      
                      {/* Rematch status for PvP */}
                      {!isBotGame && matchId && (
                        <div className="text-sm">
                          {opponentWantsRematch && !rematchRequested && (
                            <div className="flex items-center gap-2 text-primary">
                              <RotateCcw className="h-4 w-4" />
                              <span>Opponent wants a rematch!</span>
                            </div>
                          )}
                          {rematchRequested && !opponentWantsRematch && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span>Waiting for opponent...</span>
                            </div>
                          )}
                          {rematchDeclined && (
                            <div className="text-muted-foreground">
                              Rematch declined
                            </div>
                          )}
                        </div>
                      )}
                      
                      <div className="flex flex-wrap gap-2">
                        {/* Rematch Request - works for both bot and PvP */}
                        {(isBotGame || (matchId && !rematchRequested && !opponentWantsRematch && !rematchDeclined)) && (
                          <Button
                            variant="default"
                            onClick={() => {
                              if (isBotGame) {
                                // Bot auto-accepts rematch - reset game state locally
                                setGameResult(null);
                                setGameOverReason(null);
                                setBoardState(INITIAL_BOARD.map(row => [...row]));
                                setLegalChessGame(new Chess());
                                setMoves([]);
                                setConfirmedMoves([]);
                                setLastMoveBy(null);
                                setPendingNotation(null);
                                setNotationQueue([]);
                                setPendingPlayerNotation(null);
                                setWaitingForNotation(false);
                                setLastMoveSquares([]);
                                setActiveColor("white");
                                setClockTurn("white");
                                
                                // Clear game identifiers for fresh session
                                setGameId(null);
                                setMatchId(null);
                                matchIdRef.current = null;
                                
                                // Swap colors for variety
                                const newColor = playerColor === "white" ? "black" : "white";
                                setPlayerColor(newColor);
                                
                                // Reset times
                                const minutes = parseInt(timeControl);
                                const seconds = minutes * 60;
                                setWhiteTime(seconds);
                                setBlackTime(seconds);
                                
                                // Reset all other game state
                                setClockPresses(0);
                                setMyViolations({ unsportsmanlike: 0, illegal: 0, distraction: 0 });
                                setOpponentViolations({ unsportsmanlike: 0, illegal: 0, distraction: 0, threefold: 0, fiftymove: 0 });
                                setMyFalseClaims({ unsportsmanlike: 0, illegal: 0, distraction: 0, threefold: 0, fiftymove: 0 });
                                setOpponentFalseClaims({ unsportsmanlike: 0, illegal: 0, distraction: 0 });
                                setMyHandshakeOffered(false);
                                setOpponentHandshakeOffered(false);
                                setHandshakeComplete(false);
                                setShowHandshakeUI(true);
                                setMyHandshakeBeforeFirstMove(false);
                                setOpponentHandshakeBeforeFirstMove(false);
                                setOpponentHandshakeViolation(false);
                                setPostGameHandshakeOffered(false);
                                setOpponentPostGameHandshakeOffered(false);
                                setPostGameHandshakeComplete(false);
                                setTouchedPiece(null);
                                setArbiterResult(null);
                                setHasMadeMove(false);
                                setPendingCheckmate(null);
                                setArbiterPending(false);
                                setDrawOffered(false);
                                setOpponentOfferedDraw(false);
                                setSelectedSquare(null);
                                setLockedPiece(null);
                                setBotThinking(false);
                                setRematchRequested(false);
                                setOpponentWantsRematch(false);
                                setRematchDeclined(false);
                                
                                // Start the new game (keep selectedBot and difficulty for rematch)
                                setGameStarted(true);
                                gameStartTimeRef.current = Date.now();
                                
                                toast({
                                  title: "Rematch Started!",
                                  description: `You are now playing as ${newColor}`,
                                });
                              } else if (matchId) {
                                // PvP - send request to server
                                setRematchRequested(true);
                                sendRematchRequest(matchId);
                              }
                            }}
                            data-testid="button-request-rematch"
                          >
                            <RotateCcw className="mr-2 h-4 w-4" />
                            Rematch
                          </Button>
                        )}
                        
                        {/* PvP Accept/Decline Rematch */}
                        {!isBotGame && matchId && opponentWantsRematch && !rematchRequested && (
                          <>
                            <Button
                              variant="default"
                              onClick={() => {
                                setOpponentWantsRematch(false); // Prevent double-click
                                sendRematchResponse(matchId, true);
                              }}
                              data-testid="button-accept-rematch"
                            >
                              <CheckCircle className="mr-2 h-4 w-4" />
                              Accept Rematch
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => {
                                sendRematchResponse(matchId, false);
                                setOpponentWantsRematch(false);
                              }}
                              data-testid="button-decline-rematch"
                            >
                              <XCircle className="mr-2 h-4 w-4" />
                              Decline
                            </Button>
                          </>
                        )}
                        
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
                          variant="outline"
                          onClick={() => {
                            setLocation("/");
                            setGameResult(null);
                            setGameOverReason(null);
                            setGameStarted(false);
                            setGameId(null);
                            setMatchId(null);
                            matchIdRef.current = null; // Sync ref immediately to avoid stale closure issues
                            setMoves([]);
                            setConfirmedMoves([]);
                            setLastMoveBy(null);
                            setPendingNotation(null);
                            setNotationQueue([]);
                            setPendingPlayerNotation(null);
                            setWaitingForNotation(false);
                            setBoardState(INITIAL_BOARD.map(row => [...row]));
                            setSelectedSquare(null);
                            setClockPresses(0);
                            setMyViolations({ unsportsmanlike: 0, illegal: 0, distraction: 0 });
                            setOpponentViolations({ unsportsmanlike: 0, illegal: 0, distraction: 0, threefold: 0, fiftymove: 0 });
                            setMyFalseClaims({ unsportsmanlike: 0, illegal: 0, distraction: 0, threefold: 0, fiftymove: 0 });
                            setOpponentFalseClaims({ unsportsmanlike: 0, illegal: 0, distraction: 0 });
                            setMyHandshakeOffered(false);
                            setOpponentHandshakeOffered(false);
                            setHandshakeComplete(false);
                            setShowHandshakeUI(false);
                            setMyHandshakeBeforeFirstMove(false);
                            setOpponentHandshakeBeforeFirstMove(false);
                            setOpponentHandshakeViolation(false);
                            setPostGameHandshakeOffered(false);
                            setOpponentPostGameHandshakeOffered(false);
                            setPostGameHandshakeComplete(false);
                            setTouchedPiece(null);
                            setArbiterResult(null);
                            setRestoredGame(false);
                            setIsBotGame(false);
                            setSelectedBot(null);
                            setShowBotSelection(false);
                            setSelectedBotDifficulty(null);
                            setBotThinking(false);
                            setLegalChessGame(new Chess());
                            setMobileScoreSheetOpen(false);
                            setRematchRequested(false);
                            setOpponentWantsRematch(false);
                            setRematchDeclined(false);
                            setOpponentId(null);
                          }}
                          data-testid="button-main-menu"
                        >
                          Main Menu
                        </Button>
                        {!isBotGame && opponentId && (
                          <ReportPlayerDialog
                            reportedUserId={opponentId}
                            reportedUserName={opponentName}
                            gameId={gameId || undefined}
                            trigger={<span className="text-xs text-muted-foreground cursor-pointer hover:underline" data-testid="link-report-player-otb">Report player</span>}
                          />
                        )}
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
                      {whiteTime >= 99999 ? "∞" : formatTime(playerColor === "white" ? blackTime : whiteTime)}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Board with OTB controls on right side */}
              <div className="flex gap-1">
                {/* Left Tilt Control Column - only shown in 3D perspective mode */}
                {perspective3d && (
                  <div 
                    className="flex flex-col"
                    style={{ width: 'calc(100% * 2 / 10)', aspectRatio: '2 / 8' }}
                  >
                    {/* Empty space (1 tile) */}
                    <div style={{ height: '12.5%' }} />
                    
                    {/* Empty space (1 tile) */}
                    <div style={{ height: '12.5%' }} />
                    
                    {/* Tilt slider (4 tiles tall x 2 tiles wide) - same height as clock */}
                    <div
                      className="w-full rounded-lg border-4 border-muted-foreground/30 bg-muted/50 flex flex-col items-center justify-center gap-2"
                      style={{ height: '50%' }}
                      data-testid="tilt-slider-container"
                    >
                      <span className="text-sm font-bold text-muted-foreground">Tilt</span>
                      <input
                        type="range"
                        min="20"
                        max="70"
                        value={tiltAngle}
                        onChange={(e) => handleTiltChange(Number(e.target.value))}
                        className="w-24 h-3 appearance-none bg-muted-foreground/30 rounded-full cursor-pointer"
                        style={{
                          transform: 'rotate(-90deg)',
                        }}
                        data-testid="input-tilt-slider"
                      />
                      <span className="text-xs text-muted-foreground">{tiltAngle}°</span>
                    </div>
                    
                    {/* Empty space (1 tile) */}
                    <div style={{ height: '12.5%' }} />
                    
                    {/* Empty space (1 tile) */}
                    <div style={{ height: '12.5%' }} />
                  </div>
                )}
                
                <PerspectiveChessBoard 
                  fen={fen}
                  orientation={playerColor}
                  showCoordinates={true}
                  highlightedSquares={[]}
                  legalMoveSquares={legalMoveSquares}
                  lastMoveSquares={highlightLastMove ? lastMoveSquares : []}
                  selectedSquare={showPieceHighlight ? selectedSquare : null}
                  lockedPiece={showPieceHighlight ? lockedPiece : null}
                  onSquareClick={handleSquareClick}
                  highlightColor="red"
                  perspective3d={perspective3d}
                  customHighlightColors={highlightColors}
                  tiltAngle={tiltAngle}
                  onTiltChange={perspective3d ? handleTiltChange : undefined}
                  hideSelectionHighlight={!showPieceHighlight}
                />
                
                {/* OTB Control Column - 2 tiles wide, 8 tiles tall */}
                <div 
                  className="flex flex-col"
                  style={{ width: 'calc(100% * 2 / 10)', aspectRatio: '2 / 8' }}
                >
                  {/* Top section: Handshake button (1x1) positioned at top-right */}
                  <div className="flex justify-end" style={{ height: '12.5%' }}>
                    {showHandshakeUI && !handshakeComplete && moves.length < 2 && (
                      <button
                        onClick={() => {
                          setMyHandshakeOffered(true);
                          const myFirstMoveNotMade = (playerColor === "white" && moves.length === 0) || 
                                                     (playerColor === "black" && moves.length < 2);
                          if (myFirstMoveNotMade) {
                            setMyHandshakeBeforeFirstMove(true);
                          }
                          if (matchId && !isBotGame) {
                            sendHandshakeOffer(matchId, playerColor);
                          }
                          if (opponentHandshakeOffered) {
                            setHandshakeComplete(true);
                            gameStartTimeRef.current = Date.now();
                            toast({ title: "Handshake accepted!", description: "Good luck!" });
                          }
                        }}
                        disabled={myHandshakeOffered}
                        className={`aspect-square h-full rounded-md border-2 transition-all flex items-center justify-center
                          ${myHandshakeOffered 
                            ? "bg-green-500/20 border-green-500 text-green-600" 
                            : opponentHandshakeOffered 
                              ? "bg-primary/20 border-primary text-primary animate-pulse" 
                              : "bg-card border-border hover:bg-accent hover:border-primary"
                          }
                          ${myHandshakeOffered ? "cursor-not-allowed" : "cursor-pointer active:scale-95"}
                        `}
                        data-testid="button-offer-handshake"
                        title={myHandshakeOffered ? "Handshake Offered" : opponentHandshakeOffered ? "Accept Handshake" : "Offer Handshake"}
                      >
                        <HandshakeIcon className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                  
                  {/* Empty space (1 tile) */}
                  <div style={{ height: '12.5%' }} />
                  
                  {/* Clock button (4 tiles tall x 2 tiles wide) */}
                  <button
                    onClick={handleClockPress}
                    disabled={arbiterPending || !!pendingCheckmate || !gameStarted}
                    className={`w-full rounded-lg border-4 transition-all flex flex-col items-center justify-center gap-1
                      ${clockTurn === playerColor 
                        ? "bg-primary text-primary-foreground border-primary shadow-lg" 
                        : "bg-muted text-muted-foreground border-muted-foreground/30"
                      }
                      ${(arbiterPending || !!pendingCheckmate || !gameStarted) 
                        ? "opacity-50 cursor-not-allowed" 
                        : "cursor-pointer hover:shadow-xl active:scale-[0.98]"
                      }
                    `}
                    style={{ height: '50%' }}
                    data-testid="button-press-clock"
                  >
                    <Clock className="w-8 h-8" />
                    <span className="text-sm font-bold">CLOCK</span>
                    <span className="text-xs opacity-70">(Space)</span>
                  </button>
                  
                  {/* Empty space (1 tile) */}
                  <div style={{ height: '12.5%' }} />
                  
                  {/* Call Arbiter button (1x1 tile) at bottom-right corner */}
                  {/* Available: before any moves (handshake), or when opponent made the last move */}
                  {/* Disabled if: mid-move, piece locked, you made the last move, or it's not your turn */}
                  <div className="flex justify-end" style={{ height: '12.5%' }}>
                    <button
                      onClick={handleCallArbiter}
                      disabled={arbiterPending || clockTurn !== playerColor || hasMadeMove || !!lockedPiece || lastMoveBy === playerColor}
                      className={`aspect-square h-full rounded-md border-2 transition-all flex items-center justify-center
                        ${arbiterPending || clockTurn !== playerColor || hasMadeMove || !!lockedPiece || lastMoveBy === playerColor
                          ? "bg-muted/50 text-muted-foreground border-muted cursor-not-allowed opacity-50"
                          : "bg-orange-500/10 text-orange-600 border-orange-500 hover:bg-orange-500/20 cursor-pointer active:scale-95"
                        }
                      `}
                      data-testid="button-call-arbiter"
                      title={lastMoveBy === playerColor ? "You made the last move" : (hasMadeMove ? "Press clock first" : (lockedPiece ? "Complete your move first" : "Call Arbiter"))}
                    >
                      <Gavel className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>

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
                      {whiteTime >= 99999 ? "∞" : formatTime(playerColor === "white" ? whiteTime : blackTime)}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Notation Practice Input - Move → Clock → Write flow */}
              {notationPractice && notationQueue.length > 0 && (
                <NotationInput
                  expectedNotation={notationQueue[0].notation}
                  onCorrect={() => {
                    // Remove the first item from the queue
                    // useEffect will clear waitingForNotation when queue empties
                    setNotationQueue(prev => prev.slice(1));
                  }}
                  moveNumber={notationQueue[0].moveNumber}
                  isWhiteMove={notationQueue[0].isWhiteMove}
                />
              )}

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
                  {!isBotGame && (
                    opponentOfferedDraw ? (
                      <>
                        <Button variant="default" size="sm" onClick={handleAcceptDraw} data-testid="button-accept-draw">
                          <CheckCircle className="mr-1 h-3 w-3" />
                          Accept Draw
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleDeclineDraw} data-testid="button-decline-draw">
                          <XCircle className="mr-1 h-3 w-3" />
                          Decline
                        </Button>
                      </>
                    ) : (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={handleOfferDraw} 
                        disabled={drawOffered}
                        data-testid="button-offer-draw"
                      >
                        <HandshakeIcon className="mr-1 h-3 w-3" />
                        {drawOffered ? "Draw Offered..." : "Draw"}
                      </Button>
                    )
                  )}
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

      {/* Desktop Score Sheet - Hidden on mobile */}
      {gameStarted && (
        <div className="hidden lg:flex w-72 border-l bg-card flex-col">
          <div className="p-4 border-b">
            <h3 className="font-semibold">Score Sheet</h3>
            {notationPractice && (
              <p className="text-xs text-muted-foreground mt-1">Recording moves as you play</p>
            )}
          </div>
          <ScrollArea className="h-80 p-4">
            {(notationPractice ? confirmedMoves : moves).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-2">
                No moves yet
              </p>
            ) : (
              <div className="font-mono text-sm">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-1 px-2 w-12 text-muted-foreground font-medium">#</th>
                      <th className="text-left py-1 px-2 font-medium">White</th>
                      <th className="text-left py-1 px-2 font-medium">Black</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const displayMoves = notationPractice ? confirmedMoves : moves;
                      return Array.from({ length: Math.ceil(displayMoves.length / 2) }).map((_, moveNumber) => {
                        const whiteMove = displayMoves[moveNumber * 2];
                        const blackMove = displayMoves[moveNumber * 2 + 1];
                        
                        return (
                          <tr key={moveNumber} className="border-b border-border/50" data-testid={`move-row-${moveNumber}`}>
                            <td className="py-1 px-2 text-muted-foreground">{moveNumber + 1}</td>
                            <td className="py-1 px-2" data-testid={`move-${moveNumber * 2}`}>{whiteMove?.notation || "-"}</td>
                            <td className="py-1 px-2" data-testid={`move-${moveNumber * 2 + 1}`}>{blackMove?.notation || "-"}</td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            )}
          </ScrollArea>
          
          <div className="p-2 border-t bg-muted/30 shrink-0">
            <h4 className="text-xs font-semibold mb-1">OTB Rules</h4>
            <ul className="text-xs text-muted-foreground space-y-0.5">
              <li><span className="font-medium text-foreground">Handshakes</span> - Shake hands with your opponent, unsportsmanlike behavior can lead to forced forfeits.</li>
              <li><span className="font-medium text-foreground">Castling</span> - Must click King first then Rook.</li>
              <li><span className="font-medium text-foreground">1 Click 1 Move</span> - If you click a piece you must move it if there is a legal move.</li>
              <li><span className="font-medium text-foreground">Clock Hand Rule</span> - Recommended to use spacebar with same hand as piece movement to get practice with OTB clock hand rule.</li>
              <li><span className="font-medium text-foreground">Calling the Arbiter</span> - Press call arbiter button if opponent doesn't shake hands or makes illegal moves.</li>
            </ul>
          </div>
          
          <div className="p-2 border-t bg-muted/30 shrink-0">
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

      {/* Mobile Score Sheet Button - Only visible on mobile when game is started */}
      {gameStarted && (
        <div className="lg:hidden fixed bottom-4 right-4 z-50">
          <Sheet open={mobileScoreSheetOpen} onOpenChange={setMobileScoreSheetOpen}>
            <SheetTrigger asChild>
              <Button
                size="icon"
                variant="secondary"
                data-testid="button-mobile-scoresheet"
              >
                <FileText className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80 p-0 flex flex-col">
              <SheetHeader className="p-4 border-b shrink-0">
                <SheetTitle className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Score Sheet
                </SheetTitle>
                {notationPractice && (
                  <p className="text-xs text-muted-foreground mt-1">Recording moves as you play</p>
                )}
              </SheetHeader>
              <ScrollArea className="h-80 p-4">
              {(notationPractice ? confirmedMoves : moves).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-2">
                  No moves yet
                </p>
              ) : (
                <div className="font-mono text-sm">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-1 px-2 w-12 text-muted-foreground font-medium">#</th>
                        <th className="text-left py-1 px-2 font-medium">White</th>
                        <th className="text-left py-1 px-2 font-medium">Black</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const displayMoves = notationPractice ? confirmedMoves : moves;
                        return Array.from({ length: Math.ceil(displayMoves.length / 2) }).map((_, moveNumber) => {
                          const whiteMove = displayMoves[moveNumber * 2];
                          const blackMove = displayMoves[moveNumber * 2 + 1];
                          
                          return (
                            <tr key={moveNumber} className="border-b border-border/50" data-testid={`mobile-move-row-${moveNumber}`}>
                              <td className="py-1 px-2 text-muted-foreground" data-testid={`text-mobile-move-number-${moveNumber}`}>{moveNumber + 1}</td>
                              <td className="py-1 px-2" data-testid={`text-mobile-white-move-${moveNumber}`}>{whiteMove?.notation || "-"}</td>
                              <td className="py-1 px-2" data-testid={`text-mobile-black-move-${moveNumber}`}>{blackMove?.notation || "-"}</td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              )}
            </ScrollArea>
            
            <div className="p-2 border-t bg-muted/30 shrink-0">
              <h4 className="text-xs font-semibold mb-1">OTB Rules</h4>
              <ul className="text-xs text-muted-foreground space-y-0.5">
                <li><span className="font-medium text-foreground">Handshakes</span> - Shake hands with your opponent, unsportsmanlike behavior can lead to forced forfeits.</li>
                <li><span className="font-medium text-foreground">Castling</span> - Must click King first then Rook.</li>
                <li><span className="font-medium text-foreground">1 Click 1 Move</span> - If you click a piece you must move it if there is a legal move.</li>
                <li><span className="font-medium text-foreground">Clock Hand Rule</span> - Recommended to use spacebar with same hand as piece movement to get practice with OTB clock hand rule.</li>
                <li><span className="font-medium text-foreground">Calling the Arbiter</span> - Press call arbiter button if opponent doesn't shake hands or makes illegal moves.</li>
              </ul>
            </div>
            
            <div className="p-2 border-t bg-muted/30 shrink-0">
              <h4 className="text-xs font-semibold mb-1">Arbiter Rules</h4>
              <ul className="text-xs text-muted-foreground space-y-0.5">
                <li>• Illegal move: Caller +2 min</li>
                <li>• 2nd illegal: Forfeit</li>
                <li>• False claim: Opponent +2 min</li>
                <li>• 2nd false claim: Forfeit</li>
              </ul>
            </div>
            </SheetContent>
          </Sheet>
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
              className="w-full justify-start h-auto py-3"
              onClick={() => handleArbiterClaim("threefold")}
              data-testid="button-claim-threefold"
            >
              <div className="flex items-center gap-3">
                <RotateCcw className="h-5 w-5 text-blue-500" />
                <div className="text-left">
                  <p className="font-semibold">Threefold Repetition</p>
                  <p className="text-xs text-muted-foreground">Claim draw - same position 3 times</p>
                </div>
              </div>
            </Button>
            
            <Button 
              variant="outline" 
              className="w-full justify-start h-auto py-3"
              onClick={() => handleArbiterClaim("fiftymove")}
              data-testid="button-claim-fiftymove"
            >
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-blue-500" />
                <div className="text-left">
                  <p className="font-semibold">50-Move Rule</p>
                  <p className="text-xs text-muted-foreground">Claim draw - 50 moves without pawn/capture</p>
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

      <OTBTutorial
        open={showTutorial}
        onOpenChange={setShowTutorial}
        onComplete={markComplete}
      />
    </div>
  );
}
