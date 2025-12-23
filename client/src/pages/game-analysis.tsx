import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Helmet } from "react-helmet-async";
import { useParams, useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Chess, Square } from 'chess.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useClientAnalysis } from '@/hooks/useClientAnalysis';
import { SyzygyIndicator } from '@/components/syzygy-indicator';
import { MiniGameOverlay, MiniGameType } from '@/components/minigames/MiniGameOverlay';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Share2,
  Copy,
  Check,
  Brain,
  Target,
  TrendingUp,
  TrendingDown,
  Clock,
  Zap,
  AlertTriangle,
  Lightbulb,
  BarChart3,
  Activity,
  Eye,
  Loader2,
  ArrowLeft,
  Play,
  HelpCircle,
  XCircle,
  CheckCircle,
  Book,
  Plus,
  Download,
  GraduationCap,
  Gamepad2,
  RotateCw,
  Crown,
} from 'lucide-react';
import type { GameAnalysis, MoveAnalysis, Game, MoveClassification, GamePhase } from '@shared/schema';

interface AnalysisData {
  analysis: GameAnalysis;
  moves: MoveAnalysis[];
  game: Game;
}

const CLASSIFICATION_COLORS: Record<MoveClassification, string> = {
  genius: 'bg-purple-500 text-white',
  fantastic: 'bg-blue-500 text-white',
  best: 'bg-teal-500 text-white',
  good: 'bg-green-500 text-white',
  imprecise: 'bg-yellow-500 text-black',
  mistake: 'bg-orange-500 text-white',
  blunder: 'bg-red-500 text-white',
  book: 'bg-gray-500 text-white',
  forced: 'bg-gray-400 text-white',
};

const CLASSIFICATION_LABELS: Record<MoveClassification, string> = {
  genius: 'Genius',
  fantastic: 'Fantastic',
  best: 'Best',
  good: 'Good',
  imprecise: 'Imprecise',
  mistake: 'Mistake',
  blunder: 'Blunder',
  book: 'Book',
  forced: 'Forced',
};

// Helper to convert evaluation to player's perspective
// Evaluations are stored from white's perspective, flip if player is black
function getPlayerEval(evaluation: number | null | undefined, playerColor: string): number | null {
  if (evaluation == null) return null;
  return playerColor === 'black' ? -evaluation : evaluation;
}

function VerticalEvalBar({ 
  evaluation,
  flipped = false,
  isCheckmate = false,
  checkmateWinner
}: { 
  evaluation: number | null;
  flipped?: boolean;
  isCheckmate?: boolean;
  checkmateWinner?: 'white' | 'black';
}) {
  const maxEval = 10;
  
  // If checkmate, show maxed-out evaluation for the winner
  let rawValue = evaluation ?? 0;
  if (isCheckmate && checkmateWinner) {
    rawValue = checkmateWinner === 'white' ? 999 : -999;
  }
  
  // Evaluation is stored from white's perspective
  // If player is black (flipped=true), flip to show from their perspective
  const playerEval = flipped ? -rawValue : rawValue;
  const clampedEval = Math.max(-maxEval, Math.min(maxEval, playerEval));
  
  // Bar shows player's advantage: positive = bar fills toward player's side
  // When not flipped: white at bottom, black at top (standard orientation)
  // When flipped: black at bottom, white at top
  const displayValue = isCheckmate ? (checkmateWinner === 'white' ? maxEval : -maxEval) : Math.max(-maxEval, Math.min(maxEval, rawValue));
  const whitePercentage = 50 + (displayValue / maxEval) * 50;
  const blackPercentage = 100 - whitePercentage;
  
  const formatEval = (val: number) => {
    if (Math.abs(val) >= 999) {
      return val > 0 ? 'M' : '-M';
    }
    return val > 0 ? `+${val.toFixed(1)}` : val.toFixed(1);
  };

  return (
    <div 
      className={`w-6 h-full rounded overflow-hidden border border-border flex relative ${
        flipped ? 'flex-col-reverse' : 'flex-col'
      }`}
      data-testid="eval-bar"
    >
      <div 
        className="bg-zinc-800 transition-all duration-300"
        style={{ height: `${blackPercentage}%` }}
      />
      <div 
        className="bg-zinc-100 transition-all duration-300"
        style={{ height: `${whitePercentage}%` }}
      />
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-center">
        <span 
          className={`text-[10px] font-bold px-0.5 rounded ${
            playerEval >= 0 ? 'bg-zinc-100 text-zinc-800' : 'bg-zinc-800 text-zinc-100'
          }`}
        >
          {formatEval(playerEval)}
        </span>
      </div>
    </div>
  );
}

function MoveList({
  gameMoves,
  analyzedMoves,
  currentIndex,
  onMoveClick,
}: {
  gameMoves: string[];
  analyzedMoves?: MoveAnalysis[];
  currentIndex: number;
  onMoveClick: (index: number) => void;
}) {
  // Group moves into pairs (white + black per row)
  interface MovePair {
    white?: { san: string; analysis?: MoveAnalysis };
    black?: { san: string; analysis?: MoveAnalysis };
    moveNumber: number;
  }
  const groupedMoves: MovePair[] = [];
  
  for (let i = 0; i < gameMoves.length; i++) {
    const san = gameMoves[i];
    const analysis = analyzedMoves?.[i];
    const pairIndex = Math.floor(i / 2);
    const isWhite = i % 2 === 0;
    
    if (!groupedMoves[pairIndex]) {
      groupedMoves[pairIndex] = { moveNumber: pairIndex + 1 };
    }
    
    if (isWhite) {
      groupedMoves[pairIndex].white = { san, analysis };
    } else {
      groupedMoves[pairIndex].black = { san, analysis };
    }
  }

  return (
    <ScrollArea className="h-64" data-testid="move-list">
      <div className="space-y-1 p-2">
        {groupedMoves.map((pair, pairIndex) => (
          <div key={pairIndex} className="flex items-center gap-2 text-sm">
            <span className="w-8 text-muted-foreground">{pair.moveNumber}.</span>
            
            {pair.white && (
              <button
                className={`flex-1 px-2 py-1 rounded text-left hover-elevate flex items-center gap-1 ${
                  currentIndex === pairIndex * 2 ? 'bg-primary/20' : ''
                }`}
                onClick={() => onMoveClick(pairIndex * 2)}
                data-testid={`move-white-${pair.moveNumber}`}
              >
                <span className="font-mono">{pair.white.san}</span>
                {pair.white.analysis?.classification && (
                  <Badge 
                    variant="outline" 
                    className={`text-xs px-1 py-0 ${CLASSIFICATION_COLORS[pair.white.analysis.classification]}`}
                  >
                    {CLASSIFICATION_LABELS[pair.white.analysis.classification][0]}
                  </Badge>
                )}
              </button>
            )}
            
            {pair.black && (
              <button
                className={`flex-1 px-2 py-1 rounded text-left hover-elevate flex items-center gap-1 ${
                  currentIndex === pairIndex * 2 + 1 ? 'bg-primary/20' : ''
                }`}
                onClick={() => onMoveClick(pairIndex * 2 + 1)}
                data-testid={`move-black-${pair.moveNumber}`}
              >
                <span className="font-mono">{pair.black.san}</span>
                {pair.black.analysis?.classification && (
                  <Badge 
                    variant="outline" 
                    className={`text-xs px-1 py-0 ${CLASSIFICATION_COLORS[pair.black.analysis.classification]}`}
                  >
                    {CLASSIFICATION_LABELS[pair.black.analysis.classification][0]}
                  </Badge>
                )}
              </button>
            )}
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

function QuickSummary({ analysis, moves, playerColor }: { 
  analysis: GameAnalysis; 
  moves: MoveAnalysis[];
  playerColor: string;
}) {
  const playerAccuracy = playerColor === 'white' ? analysis.whiteAccuracy : analysis.blackAccuracy;
  const opponentAccuracy = playerColor === 'white' ? analysis.blackAccuracy : analysis.whiteAccuracy;
  
  const classifications = moves
    .filter(m => m.color === playerColor)
    .reduce((acc, m) => {
      if (m.classification) {
        acc[m.classification] = (acc[m.classification] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

  return (
    <Card data-testid="quick-summary">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <BarChart3 className="w-5 h-5" />
          Quick Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-muted rounded-lg">
            <div className="text-3xl font-bold" data-testid="player-accuracy">
              {playerAccuracy?.toFixed(1) ?? '--'}%
            </div>
            <div className="text-sm text-muted-foreground">Your Accuracy</div>
          </div>
          <div className="text-center p-3 bg-muted rounded-lg">
            <div className="text-3xl font-bold" data-testid="opponent-accuracy">
              {opponentAccuracy?.toFixed(1) ?? '--'}%
            </div>
            <div className="text-sm text-muted-foreground">Opponent</div>
          </div>
        </div>
        
        <Separator />
        
        <div className="space-y-2">
          <div className="text-sm font-medium">Move Breakdown</div>
          <div className="grid grid-cols-4 gap-2 text-center text-sm">
            {(['genius', 'fantastic', 'best', 'forced', 'good', 'imprecise', 'mistake', 'blunder'] as MoveClassification[]).map(c => (
              <div key={c} className="flex flex-col items-center">
                <Badge className={`${CLASSIFICATION_COLORS[c]} mb-1`}>
                  {classifications[c] || 0}
                </Badge>
                <span className="text-xs text-muted-foreground">{CLASSIFICATION_LABELS[c]}</span>
              </div>
            ))}
          </div>
        </div>
        
        {analysis.biggestSwings && (analysis.biggestSwings as any[]).length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <div className="text-sm font-medium flex items-center gap-1">
                <Zap className="w-4 h-4" />
                Biggest Swings
              </div>
              <div className="space-y-1 text-sm">
                {(analysis.biggestSwings as { moveNumber: number; swing: number }[]).slice(0, 3).map((swing, i) => (
                  <div key={i} className="flex justify-between">
                    <span>Move {swing.moveNumber}</span>
                    <span className={swing.swing > 0 ? 'text-green-500' : 'text-red-500'}>
                      {swing.swing > 0 ? '+' : ''}{swing.swing.toFixed(1)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function PhaseBreakdown({ analysis }: { analysis: GameAnalysis }) {
  return (
    <Card data-testid="phase-breakdown">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Target className="w-5 h-5" />
          Phase Breakdown
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>Opening</span>
              <span className="font-medium">{analysis.openingAccuracy?.toFixed(1) ?? '--'}%</span>
            </div>
            <Progress value={analysis.openingAccuracy ?? 0} className="h-2" />
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>Middlegame</span>
              <span className="font-medium">{analysis.middlegameAccuracy?.toFixed(1) ?? '--'}%</span>
            </div>
            <Progress value={analysis.middlegameAccuracy ?? 0} className="h-2" />
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>Endgame</span>
              <span className="font-medium">{analysis.endgameAccuracy?.toFixed(1) ?? '--'}%</span>
            </div>
            <Progress value={analysis.endgameAccuracy ?? 0} className="h-2" />
          </div>
        </div>
        
        {analysis.openingName && (
          <div className="pt-2 border-t">
            <div className="text-sm text-muted-foreground">Opening Played</div>
            <div className="font-medium" data-testid="opening-name">{analysis.openingName}</div>
            {analysis.openingDeviationMove && (
              <div className="text-xs text-muted-foreground mt-1">
                Deviated from theory at move {analysis.openingDeviationMove}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PeekStatistics({ game }: { game: Game }) {
  const peekDurations = (game.peekDurations as number[] | null) || [];
  const totalPeekTime = game.totalPeekTime || 0;
  const peeksUsed = game.peeksUsed || 0;
  const blindfoldEnabled = game.blindfoldEnabled;
  
  const { data: blindfoldHistory } = useQuery<{ games: Game[] }>({
    queryKey: ['/api/games/blindfold-history'],
    enabled: blindfoldEnabled === true && peeksUsed > 0,
  });
  
  if (!blindfoldEnabled || peeksUsed === 0) {
    return null;
  }
  
  const formatDuration = (seconds: number) => {
    return seconds < 60 
      ? `${seconds.toFixed(1)}s` 
      : `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(0).padStart(2, '0')}`;
  };
  
  const previousGames = blindfoldHistory?.games?.filter(g => g.id !== game.id) || [];
  const lastGame = previousGames[0];
  const lastGamePeekTime = lastGame?.totalPeekTime || 0;
  
  const allPeekTimes = previousGames.map(g => g.totalPeekTime || 0).filter(t => t > 0);
  const avgPeekTime = allPeekTimes.length > 0 
    ? allPeekTimes.reduce((a, b) => a + b, 0) / allPeekTimes.length 
    : 0;
  
  const vsLastGame = lastGamePeekTime > 0 ? totalPeekTime - lastGamePeekTime : null;
  const vsAverage = avgPeekTime > 0 ? totalPeekTime - avgPeekTime : null;
  
  return (
    <Card data-testid="peek-statistics">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Eye className="w-4 h-4" />
          Blindfold Peek Statistics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-2xl font-bold">{peeksUsed}</div>
            <p className="text-sm text-muted-foreground">Times peeked</p>
          </div>
          <div>
            <div className="text-2xl font-bold">{formatDuration(totalPeekTime)}</div>
            <p className="text-sm text-muted-foreground">Total peek time</p>
          </div>
        </div>
        
        {peekDurations.length > 0 && (
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Individual peeks:</p>
            <div className="flex flex-wrap gap-2">
              {peekDurations.map((duration, i) => (
                <Badge key={i} variant="outline" data-testid={`peek-duration-${i}`}>
                  Peek {i + 1}: {formatDuration(duration)}
                </Badge>
              ))}
            </div>
          </div>
        )}
        
        {(vsLastGame !== null || vsAverage !== null) && (
          <div className="pt-3 border-t space-y-2">
            <p className="text-sm font-medium">Comparison</p>
            {vsLastGame !== null && (
              <p className="text-sm">
                {vsLastGame < 0 ? (
                  <span className="text-green-500">
                    {formatDuration(Math.abs(vsLastGame))} less than your last blindfold game
                  </span>
                ) : vsLastGame > 0 ? (
                  <span className="text-yellow-500">
                    {formatDuration(vsLastGame)} more than your last blindfold game
                  </span>
                ) : (
                  <span className="text-muted-foreground">Same as your last blindfold game</span>
                )}
              </p>
            )}
            {vsAverage !== null && (
              <p className="text-sm">
                {vsAverage < 0 ? (
                  <span className="text-green-500">
                    {formatDuration(Math.abs(vsAverage))} better than your average ({formatDuration(avgPeekTime)})
                  </span>
                ) : vsAverage > 0 ? (
                  <span className="text-yellow-500">
                    {formatDuration(vsAverage)} more than your average ({formatDuration(avgPeekTime)})
                  </span>
                ) : (
                  <span className="text-muted-foreground">Equal to your average</span>
                )}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ReviewTab({ 
  analysis, 
  game, 
  moves,
  onNavigateToMove 
}: { 
  analysis: GameAnalysis; 
  game: Game;
  moves: MoveAnalysis[];
  onNavigateToMove?: (moveIndex: number) => void;
}) {
  const [trainerOpen, setTrainerOpen] = useState(false);
  const [selectedMismatch, setSelectedMismatch] = useState<{
    plyIndex: number;
    fen: string;
    bestMove?: string;
  } | null>(null);
  
  const thinkingTimes = (game.thinkingTimes as number[] | null) || [];
  const playerColor = game.playerColor;
  const remainingTime = playerColor === 'white' ? game.whiteTime : game.blackTime;
  const initialTime = game.timeControl;
  
  // Get FEN at a specific ply index (position BEFORE the move at that ply)
  const getFenAtPly = useCallback((plyIndex: number): string => {
    const chess = new Chess();
    // Handle both array and string formats for game.moves
    const gameMoves = Array.isArray(game.moves) 
      ? game.moves as string[]
      : (typeof game.moves === 'string' ? (game.moves as string).split(' ') : []);
    
    for (let i = 0; i < plyIndex && i < gameMoves.length; i++) {
      try {
        chess.move(gameMoves[i]);
      } catch (e) {
        break;
      }
    }
    return chess.fen();
  }, [game.moves]);
  
  const handleVSSMismatchClick = useCallback((plyIndex: number) => {
    // Only open trainer if remaining time >= 60 seconds
    if (remainingTime && remainingTime >= 60) {
      const fen = getFenAtPly(plyIndex);
      // moveNumber is 1-indexed, plyIndex is 0-indexed
      // Even plyIndex = white's move, odd plyIndex = black's move
      const moveNumber = Math.floor(plyIndex / 2) + 1;
      const color = plyIndex % 2 === 0 ? 'white' : 'black';
      const moveAnalysis = moves.find(m => m.moveNumber === moveNumber && m.color === color);
      setSelectedMismatch({
        plyIndex,
        fen,
        bestMove: moveAnalysis?.bestMove || undefined,
      });
      setTrainerOpen(true);
    } else {
      // Just navigate if not enough time
      onNavigateToMove?.(plyIndex);
    }
  }, [getFenAtPly, moves, remainingTime, onNavigateToMove]);
  
  const playerThinkingTimes = thinkingTimes.filter((_, i) => 
    (playerColor === 'white' && i % 2 === 0) || (playerColor === 'black' && i % 2 === 1)
  );
  const avgTimePerMove = playerThinkingTimes.length > 0 
    ? playerThinkingTimes.reduce((a, b) => a + b, 0) / playerThinkingTimes.length 
    : 0;
  
  const hasTimeRemaining = remainingTime != null && remainingTime > 60;
  const allVssMismatches = (analysis.vssMismatchAlerts as number[] | null) || [];
  // Filter to only show the player's own moves (white = even ply indices, black = odd ply indices)
  const vssMismatches = allVssMismatches.filter(plyIndex => 
    (playerColor === 'white' && plyIndex % 2 === 0) || (playerColor === 'black' && plyIndex % 2 === 1)
  );
  const hadMismatchesWithTimeLeft = hasTimeRemaining && vssMismatches.length > 0;
  
  const formatTime = (seconds: number, showDecimals = true) => {
    const mins = Math.floor(seconds / 60);
    if (mins > 0) {
      const secs = Math.floor(seconds % 60);
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    // For sub-minute times, show one decimal place for averages
    return showDecimals ? `${seconds.toFixed(1)}s` : `${Math.floor(seconds)}s`;
  };

  return (
    <div className="space-y-4">
      {initialTime && (
        <Card data-testid="time-management">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Time Management
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-2xl font-bold">{formatTime(avgTimePerMove)}</div>
                <p className="text-sm text-muted-foreground">Average per move</p>
              </div>
              <div>
                <div className="text-2xl font-bold">{remainingTime != null ? formatTime(remainingTime) : '--'}</div>
                <p className="text-sm text-muted-foreground">Time remaining</p>
              </div>
            </div>
            {hadMismatchesWithTimeLeft && (
              <div className="mt-3 p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 shrink-0" />
                  <p className="text-sm">
                    You had <strong>{formatTime(remainingTime!)}</strong> left on the clock. 
                    On {vssMismatches.length === 1 ? 'move' : 'moves'}{' '}
                    {vssMismatches.map((ply, i) => (
                      <span key={ply}>
                        {i > 0 && (i === vssMismatches.length - 1 ? ' and ' : ', ')}
                        <strong>{Math.floor(ply / 2) + 1}</strong>
                      </span>
                    ))}
                    {' '}you may have misjudged the position - taking more time here could have helped.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card data-testid="focus-check">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Focus Check
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analysis.focusCheckScore != null ? `${(analysis.focusCheckScore * 100).toFixed(0)}%` : '--'}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Measures consistency in move quality throughout the game
            </p>
          </CardContent>
        </Card>
        
        <Card data-testid="efficiency-factor">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Efficiency Factor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analysis.efficiencyFactor != null ? analysis.efficiencyFactor.toFixed(2) : '--'}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {analysis.efficiencyFactor != null && analysis.efficiencyFactor >= 0.5 
                ? "Your thinking time is being used productively - longer thinks lead to better moves."
                : analysis.efficiencyFactor != null 
                  ? "Move quality doesn't improve with longer thinks. You may be rushing critical positions or overthinking easy ones."
                  : "Time spent vs. move quality correlation"}
            </p>
          </CardContent>
        </Card>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card data-testid="time-trouble">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Time Trouble
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analysis.timeTroubleStartMove ? (
              <>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-500" />
                  <span className="text-lg font-medium">Started at move {analysis.timeTroubleStartMove}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  You may have rushed moves after this point
                </p>
              </>
            ) : (
              <div className="text-green-500 flex items-center gap-2">
                <Check className="w-5 h-5" />
                <span>Good time management</span>
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card data-testid="burnout-line">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingDown className="w-4 h-4" />
              Burnout Detection
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analysis.burnoutDetected ? (
              <>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-orange-500" />
                  <span className="text-lg font-medium">Burnout detected</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Your move quality decreased significantly in the later stages
                </p>
              </>
            ) : (
              <div className="text-green-500 flex items-center gap-2">
                <Check className="w-5 h-5" />
                <span>Consistent performance</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      {vssMismatches.length > 0 && (
        <Card data-testid="vss-mismatch">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Brain className="w-4 h-4" />
              VSS Mismatch Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              Positions where you may have misjudged the evaluation
              {hasTimeRemaining && (
                <span className="block mt-1 text-primary">
                  Click a move to practice finding the best move!
                </span>
              )}
            </p>
            <div className="space-y-2">
              {vssMismatches.map((plyIndex, i) => {
                const moveTime = thinkingTimes[plyIndex];
                const moveNumber = Math.floor(plyIndex / 2) + 1;
                const isBlackMove = plyIndex % 2 === 1;
                return (
                  <div 
                    key={i}
                    className={`flex items-center justify-between p-2 rounded-lg bg-muted/50 cursor-pointer hover-elevate`}
                    onClick={() => handleVSSMismatchClick(plyIndex)}
                    data-testid={`vss-move-${plyIndex}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        Move {moveNumber}{isBlackMove ? '...' : ''}
                      </span>
                      {hasTimeRemaining && (
                        <Badge variant="outline" className="text-xs">
                          <Play className="w-3 h-3 mr-1" />
                          Practice
                        </Badge>
                      )}
                    </div>
                    {moveTime != null && (
                      <span className="text-sm text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTime(moveTime)} spent
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
      
      {analysis.improvementSuggestions && (analysis.improvementSuggestions as string[]).length > 0 && (
        <Card data-testid="improvement-suggestions">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Lightbulb className="w-4 h-4" />
              Improvement Suggestions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {(analysis.improvementSuggestions as string[]).map((suggestion, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <TrendingUp className="w-4 h-4 mt-0.5 text-primary" />
                  <span>{suggestion}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
      
      <RepertoireCheck 
        game={game} 
        moves={moves}
        onNavigateToMove={onNavigateToMove}
      />
      
      <PeekStatistics game={game} />
      
      {/* VSS Interactive Training Dialog */}
      {selectedMismatch && (
        <VSSTrainerDialog
          open={trainerOpen}
          onOpenChange={setTrainerOpen}
          fen={selectedMismatch.fen}
          plyIndex={selectedMismatch.plyIndex}
          gameId={String(game.id)}
          remainingTime={Math.floor(remainingTime || 60)}
          playerColor={playerColor || 'white'}
          bestMove={selectedMismatch.bestMove}
        />
      )}
    </div>
  );
}

interface RepertoireDeviation {
  moveNumber: number;
  ply: number;
  position: string;
  movePlayed: string;
  expectedMoves: string[];
  isPlayerMove: boolean;
  repertoireName: string;
  deviationType: 'player_deviation' | 'opponent_deviation';
}

interface RepertoireCheckResult {
  hasRepertoire: boolean;
  deviations: RepertoireDeviation[];
  repertoiresChecked?: string[];
  noLines?: boolean;
  message?: string;
}

interface Repertoire {
  id: string;
  name: string;
  color: string;
}

function RepertoireCheck({ 
  game,
  moves,
  onNavigateToMove 
}: { 
  game: Game;
  moves: MoveAnalysis[];
  onNavigateToMove?: (moveIndex: number) => void;
}) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [checkResult, setCheckResult] = useState<RepertoireCheckResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [repertoires, setRepertoires] = useState<Repertoire[]>([]);
  const [addLineDialogOpen, setAddLineDialogOpen] = useState(false);
  const [selectedDeviation, setSelectedDeviation] = useState<RepertoireDeviation | null>(null);
  const [selectedRepertoireId, setSelectedRepertoireId] = useState<string>("");
  const [addingLine, setAddingLine] = useState(false);
  const [addAlternativeDialogOpen, setAddAlternativeDialogOpen] = useState(false);
  const [drillDialogOpen, setDrillDialogOpen] = useState(false);

  useEffect(() => {
    const checkRepertoire = async () => {
      if (!game.playerColor) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        // Extract just the SAN moves from the move analysis
        const moveSans = moves.map(m => m.move);
        
        // Fetch repertoires and check game in parallel
        const [checkResponse, repResponse] = await Promise.all([
          fetch('/api/repertoires/check-game', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              moves: moveSans,
              playerColor: game.playerColor
            })
          }),
          fetch('/api/repertoires', { credentials: 'include' })
        ]);

        if (!checkResponse.ok) {
          throw new Error('Failed to check repertoire');
        }

        const result = await checkResponse.json();
        setCheckResult(result);
        
        if (repResponse.ok) {
          const reps = await repResponse.json();
          setRepertoires(reps.filter((r: Repertoire) => r.color === game.playerColor));
        }
      } catch (err) {
        setError('Failed to check game against repertoire');
      } finally {
        setLoading(false);
      }
    };

    checkRepertoire();
  }, [game.id, game.playerColor, moves]);

  const handleAddLine = async () => {
    if (!selectedDeviation || !selectedRepertoireId) return;
    
    setAddingLine(true);
    try {
      const response = await fetch(`/api/repertoires/${selectedRepertoireId}/lines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          fen: selectedDeviation.position,
          correctMove: selectedDeviation.movePlayed,
          moveSan: selectedDeviation.movePlayed,
          moveNumber: selectedDeviation.moveNumber,
          isUserAdded: true,
          frequency: 100,
        })
      });

      if (!response.ok) {
        throw new Error('Failed to add line');
      }

      toast({
        title: "Line added",
        description: `Added ${selectedDeviation.movePlayed} to your repertoire.`,
      });
      
      setAddLineDialogOpen(false);
      setSelectedDeviation(null);
      setSelectedRepertoireId("");
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to add line to repertoire",
        variant: "destructive",
      });
    } finally {
      setAddingLine(false);
    }
  };

  const openAddLineDialog = (deviation: RepertoireDeviation) => {
    setSelectedDeviation(deviation);
    if (repertoires.length === 1) {
      setSelectedRepertoireId(repertoires[0].id);
    }
    setAddLineDialogOpen(true);
  };

  const openAddAlternativeDialog = (deviation: RepertoireDeviation) => {
    setSelectedDeviation(deviation);
    if (repertoires.length === 1) {
      setSelectedRepertoireId(repertoires[0].id);
    }
    setAddAlternativeDialogOpen(true);
  };

  const handleAddAlternative = async () => {
    if (!selectedDeviation || !selectedRepertoireId) return;
    
    setAddingLine(true);
    try {
      const response = await fetch(`/api/repertoires/${selectedRepertoireId}/lines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          fen: selectedDeviation.position,
          correctMove: selectedDeviation.movePlayed,
          moveSan: selectedDeviation.movePlayed,
          moveNumber: selectedDeviation.moveNumber,
          isUserAdded: true,
          frequency: 50,
        })
      });

      if (!response.ok) {
        throw new Error('Failed to add alternative');
      }

      toast({
        title: "Alternative added",
        description: `Added ${selectedDeviation.movePlayed} as an alternative move in your repertoire.`,
      });
      
      setAddAlternativeDialogOpen(false);
      setSelectedDeviation(null);
      setSelectedRepertoireId("");
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to add alternative to repertoire",
        variant: "destructive",
      });
    } finally {
      setAddingLine(false);
    }
  };

  const openDrillDialog = (deviation: RepertoireDeviation) => {
    setSelectedDeviation(deviation);
    setDrillDialogOpen(true);
  };

  const handleDrillNow = () => {
    if (!selectedDeviation || repertoires.length === 0) return;
    
    // Navigate to repertoire trainer with the position to drill
    const repertoireId = repertoires[0].id;
    setLocation(`/repertoire-trainer?drill=${encodeURIComponent(selectedDeviation.position)}&rep=${repertoireId}`);
  };

  if (loading) {
    return (
      <Card data-testid="repertoire-check">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Book className="w-4 h-4" />
            Repertoire Check
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Checking against your repertoire...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !checkResult) {
    return null;
  }

  if (!checkResult.hasRepertoire) {
    return (
      <Card data-testid="repertoire-check">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Book className="w-4 h-4" />
            Repertoire Check
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No {game.playerColor} repertoire found. Create one in the Repertoire Trainer to track your opening preparation.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (checkResult.noLines) {
    return (
      <Card data-testid="repertoire-check">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Book className="w-4 h-4" />
            Repertoire Check
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Your repertoire has no lines yet. Add lines in the Repertoire Trainer to track deviations.
          </p>
        </CardContent>
      </Card>
    );
  }

  const playerDeviations = checkResult.deviations.filter(d => d.deviationType === 'player_deviation');
  const opponentDeviations = checkResult.deviations.filter(d => d.deviationType === 'opponent_deviation');

  return (
    <Card data-testid="repertoire-check">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Book className="w-4 h-4" />
          Repertoire Check
        </CardTitle>
        {checkResult.repertoiresChecked && checkResult.repertoiresChecked.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Checked against: {checkResult.repertoiresChecked.join(', ')}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {checkResult.deviations.length === 0 ? (
          <div className="flex items-center gap-2 text-green-500">
            <CheckCircle className="w-5 h-5" />
            <span>Perfect! You followed your repertoire throughout the opening.</span>
          </div>
        ) : (
          <>
            {playerDeviations.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-orange-500">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="font-medium">Your Deviations ({playerDeviations.length})</span>
                </div>
                <div className="space-y-2">
                  {playerDeviations.map((dev, i) => (
                    <div 
                      key={i}
                      className="p-3 rounded-lg bg-muted/50"
                      data-testid={`deviation-player-${dev.ply}`}
                    >
                      <div 
                        className="flex-1 cursor-pointer hover:underline"
                        onClick={() => onNavigateToMove?.(dev.ply)}
                      >
                        <span className="font-medium">Move {dev.moveNumber}: </span>
                        <span className="text-orange-500">{dev.movePlayed}</span>
                        <span className="text-muted-foreground"> instead of </span>
                        <span className="text-green-500">{dev.expectedMoves.join(' or ')}</span>
                      </div>
                      <div className="flex gap-2 mt-2">
                        {repertoires.length > 0 && (
                          <>
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => openDrillDialog(dev)}
                              data-testid={`drill-line-${dev.ply}`}
                            >
                              <GraduationCap className="w-4 h-4 mr-1" />
                              Drill Line
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openAddAlternativeDialog(dev)}
                              data-testid={`add-alternative-${dev.ply}`}
                            >
                              <Plus className="w-4 h-4 mr-1" />
                              Add as Alternative
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {opponentDeviations.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-blue-500">
                  <HelpCircle className="w-4 h-4" />
                  <span className="font-medium">Opponent's Unexpected Moves ({opponentDeviations.length})</span>
                </div>
                <div className="space-y-1">
                  {opponentDeviations.map((dev, i) => (
                    <div 
                      key={i}
                      className="flex items-center justify-between p-2 rounded-lg bg-muted/50 cursor-pointer hover-elevate"
                      onClick={() => onNavigateToMove?.(dev.ply)}
                      data-testid={`deviation-opponent-${dev.ply}`}
                    >
                      <div className="flex-1">
                        <span className="font-medium">Move {dev.moveNumber}: </span>
                        <span className="text-blue-500">{dev.movePlayed}</span>
                        <span className="text-muted-foreground"> (not in your prep)</span>
                      </div>
                      {repertoires.length > 0 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            openAddLineDialog(dev);
                          }}
                          data-testid={`add-line-${dev.ply}`}
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Add Line
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
      
      {/* Add Line Dialog */}
      <Dialog open={addLineDialogOpen} onOpenChange={setAddLineDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Line to Repertoire</DialogTitle>
            <DialogDescription>
              Add this opponent move to your repertoire so you can practice responding to it.
            </DialogDescription>
          </DialogHeader>
          
          {selectedDeviation && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-muted">
                <div className="text-sm">
                  <span className="font-medium">Move {selectedDeviation.moveNumber}: </span>
                  <span className="text-blue-500 font-bold">{selectedDeviation.movePlayed}</span>
                </div>
              </div>
              
              {repertoires.length > 1 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Select Repertoire</label>
                  <div className="space-y-2">
                    {repertoires.map((rep) => (
                      <div
                        key={rep.id}
                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedRepertoireId === rep.id
                            ? "border-primary bg-primary/10"
                            : "hover:bg-muted"
                        }`}
                        onClick={() => setSelectedRepertoireId(rep.id)}
                        data-testid={`select-repertoire-${rep.id}`}
                      >
                        <div className="font-medium">{rep.name}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddLineDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAddLine}
              disabled={addingLine || !selectedRepertoireId}
              data-testid="button-confirm-add-line"
            >
              {addingLine ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add to Repertoire"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Add Alternative Dialog */}
      <Dialog open={addAlternativeDialogOpen} onOpenChange={setAddAlternativeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add as Alternative Move</DialogTitle>
            <DialogDescription>
              Add this move as an alternative in your repertoire. This is useful if you've discovered a playable sideline.
            </DialogDescription>
          </DialogHeader>
          
          {selectedDeviation && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-muted">
                <div className="text-sm">
                  <span className="font-medium">Move {selectedDeviation.moveNumber}: </span>
                  <span className="text-orange-500 font-bold">{selectedDeviation.movePlayed}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Your repertoire recommends: <span className="text-green-500">{selectedDeviation.expectedMoves.join(' or ')}</span>
                </div>
              </div>
              
              {repertoires.length > 1 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Select Repertoire</label>
                  <div className="space-y-2">
                    {repertoires.map((rep) => (
                      <div
                        key={rep.id}
                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedRepertoireId === rep.id
                            ? "border-primary bg-primary/10"
                            : "hover:bg-muted"
                        }`}
                        onClick={() => setSelectedRepertoireId(rep.id)}
                        data-testid={`select-alt-repertoire-${rep.id}`}
                      >
                        <div className="font-medium">{rep.name}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddAlternativeDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAddAlternative}
              disabled={addingLine || !selectedRepertoireId}
              data-testid="button-confirm-add-alternative"
            >
              {addingLine ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add Alternative"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Drill Line Dialog */}
      <Dialog open={drillDialogOpen} onOpenChange={setDrillDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Drill This Line</DialogTitle>
            <DialogDescription>
              Practice the correct move for this position in the Repertoire Trainer.
            </DialogDescription>
          </DialogHeader>
          
          {selectedDeviation && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-muted">
                <div className="text-sm">
                  <span className="font-medium">Position at move {selectedDeviation.moveNumber}</span>
                </div>
                <div className="text-sm mt-2">
                  <span className="text-muted-foreground">You played: </span>
                  <span className="text-orange-500 font-bold">{selectedDeviation.movePlayed}</span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Correct move: </span>
                  <span className="text-green-500 font-bold">{selectedDeviation.expectedMoves.join(' or ')}</span>
                </div>
              </div>
              
              <p className="text-sm text-muted-foreground">
                Opening the Repertoire Trainer will let you practice this position until you've memorized the correct response.
              </p>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setDrillDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleDrillNow}
              data-testid="button-drill-now"
            >
              <GraduationCap className="w-4 h-4 mr-2" />
              Drill Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

interface TopMove {
  rank: number;
  move: string;
  uci: string;
  evaluation: number;
  isMate: boolean;
  mateIn?: number;
}

function EngineSuggestions({ fen, playerColor }: { fen: string; playerColor: string }) {
  const [topMoves, setTopMoves] = useState<TopMove[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingControllerRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentFenRef = useRef<string>(fen);

  useEffect(() => {
    // Track the current FEN to prevent stale updates
    currentFenRef.current = fen;
    
    // Cancel any pending debounce timer
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // Cancel any in-flight request from a previous FEN
    if (pendingControllerRef.current) {
      pendingControllerRef.current.abort();
      pendingControllerRef.current = null;
    }

    // Clear previous moves immediately when FEN changes to avoid showing stale data
    setTopMoves([]);
    setLoading(true);

    // Debounce: wait 150ms before fetching to avoid rapid consecutive requests
    timeoutRef.current = setTimeout(() => {
      const controller = new AbortController();
      const requestFen = fen; // Capture the FEN for this request
      pendingControllerRef.current = controller;
      
      const fetchTopMoves = async () => {
        setError(null);
        
        try {
          const response = await fetch('/api/analysis/top-moves', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fen: requestFen }),
            credentials: 'include',
            signal: controller.signal,
          });
          
          if (!response.ok) {
            throw new Error('Failed to fetch top moves');
          }
          
          const data = await response.json();
          // Filter out any malformed entries
          const validMoves = (data.moves || []).filter(
            (m: TopMove) => m.move && typeof m.evaluation === 'number'
          );
          
          // Only update state if FEN hasn't changed and this is still the current request
          if (currentFenRef.current === requestFen && pendingControllerRef.current === controller) {
            setTopMoves(validMoves);
            setLoading(false);
          }
        } catch (err: any) {
          if (err.name !== 'AbortError' && currentFenRef.current === requestFen && pendingControllerRef.current === controller) {
            setError('Unable to load engine suggestions');
            setTopMoves([]);
            setLoading(false);
          }
        }
      };

      fetchTopMoves();
    }, 150);
    
    // Cleanup: abort pending request and clear timeout when FEN changes
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (pendingControllerRef.current) {
        pendingControllerRef.current.abort();
        pendingControllerRef.current = null;
      }
    };
  }, [fen]);

  const formatEval = (move: TopMove) => {
    if (move.isMate) {
      const mateValue = move.evaluation > 0 ? move.mateIn : -(move.mateIn || 0);
      // Adjust for player perspective
      const adjustedMate = playerColor === 'black' ? -mateValue! : mateValue;
      return adjustedMate! > 0 ? `M${Math.abs(adjustedMate!)}` : `-M${Math.abs(adjustedMate!)}`;
    }
    // Adjust evaluation for player perspective (stored from white's view)
    const adjustedEval = playerColor === 'black' ? -move.evaluation : move.evaluation;
    return adjustedEval > 0 ? `+${adjustedEval.toFixed(1)}` : adjustedEval.toFixed(1);
  };

  const getEvalColor = (move: TopMove) => {
    const adjustedEval = playerColor === 'black' ? -move.evaluation : move.evaluation;
    if (move.isMate) {
      return adjustedEval > 0 ? 'text-green-500' : 'text-red-500';
    }
    if (adjustedEval > 0.5) return 'text-green-500';
    if (adjustedEval < -0.5) return 'text-red-500';
    return 'text-muted-foreground';
  };

  return (
    <Card data-testid="engine-suggestions">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Zap className="w-4 h-4" />
          Engine Suggestions
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Analyzing...</span>
          </div>
        ) : error ? (
          <p className="text-sm text-muted-foreground">{error}</p>
        ) : topMoves.length === 0 ? (
          <p className="text-sm text-muted-foreground">No moves available</p>
        ) : (
          <div className="space-y-2">
            {topMoves.map((move, index) => (
              <div 
                key={index}
                className={`flex items-center justify-between p-2 rounded-lg ${
                  index === 0 ? 'bg-primary/10' : 'bg-muted/50'
                }`}
                data-testid={`top-move-${index + 1}`}
              >
                <div className="flex items-center gap-2">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                    index === 0 ? 'bg-primary text-primary-foreground' : 'bg-muted-foreground/20 text-muted-foreground'
                  }`}>
                    {move.rank}
                  </span>
                  <span className="font-mono font-medium">{move.move}</span>
                </div>
                <span className={`font-mono text-sm font-medium ${getEvalColor(move)}`}>
                  {formatEval(move)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ChessBoard({ fen, lastMove, flipped = false }: { fen: string; lastMove?: { from: string; to: string }; flipped?: boolean }) {
  const chess = new Chess(fen);
  const board = chess.board();
  
  const pieceSymbols: Record<string, string> = {
    'k': '\u265A', 'q': '\u265B', 'r': '\u265C', 'b': '\u265D', 'n': '\u265E', 'p': '\u265F',
    'K': '\u2654', 'Q': '\u2655', 'R': '\u2656', 'B': '\u2657', 'N': '\u2658', 'P': '\u2659',
  };

  const getSquareColor = (displayRow: number, displayCol: number) => {
    const actualRow = flipped ? 7 - displayRow : displayRow;
    const actualCol = flipped ? 7 - displayCol : displayCol;
    const isLight = (actualRow + actualCol) % 2 === 0;
    const file = String.fromCharCode(97 + actualCol);
    const rank = 8 - actualRow;
    const square = `${file}${rank}`;
    
    if (lastMove && (lastMove.from === square || lastMove.to === square)) {
      return isLight ? 'bg-yellow-200' : 'bg-yellow-400';
    }
    
    return isLight ? 'bg-amber-100' : 'bg-amber-700';
  };

  const getSquareContent = (displayRow: number, displayCol: number) => {
    const actualRow = flipped ? 7 - displayRow : displayRow;
    const actualCol = flipped ? 7 - displayCol : displayCol;
    return board[actualRow][actualCol];
  };

  return (
    <div className="aspect-square w-full max-w-md mx-auto" data-testid="chessboard">
      <div className="grid grid-cols-8 grid-rows-8 w-full h-full border-2 border-foreground/20 rounded overflow-hidden">
        {Array.from({ length: 8 }).map((_, rowIndex) =>
          Array.from({ length: 8 }).map((_, colIndex) => {
            const square = getSquareContent(rowIndex, colIndex);
            return (
              <div
                key={`${rowIndex}-${colIndex}`}
                className={`flex items-center justify-center aspect-square ${getSquareColor(rowIndex, colIndex)}`}
              >
                {square && (
                  <span className={`text-2xl md:text-4xl ${square.color === 'w' ? 'text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]' : 'text-gray-900'}`}>
                    {pieceSymbols[square.color === 'w' ? square.type.toUpperCase() : square.type]}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// Interactive chessboard for VSS training
function InteractiveTrainerBoard({ 
  fen, 
  flipped = false,
  onMove,
  highlightSquares = [],
  disabled = false,
}: { 
  fen: string; 
  flipped?: boolean;
  onMove: (from: string, to: string) => void;
  highlightSquares?: string[];
  disabled?: boolean;
}) {
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [legalMoves, setLegalMoves] = useState<string[]>([]);
  
  const chess = useMemo(() => new Chess(fen), [fen]);
  const board = chess.board();
  
  const pieceSymbols: Record<string, string> = {
    'k': '\u265A', 'q': '\u265B', 'r': '\u265C', 'b': '\u265D', 'n': '\u265E', 'p': '\u265F',
    'K': '\u2654', 'Q': '\u2655', 'R': '\u2656', 'B': '\u2657', 'N': '\u2658', 'P': '\u2659',
  };

  const handleSquareClick = (square: string) => {
    if (disabled) return;
    
    if (selectedSquare) {
      if (legalMoves.includes(square)) {
        onMove(selectedSquare, square);
        setSelectedSquare(null);
        setLegalMoves([]);
      } else {
        // Select new square
        const piece = chess.get(square as Square);
        if (piece && piece.color === chess.turn()) {
          setSelectedSquare(square);
          const moves = chess.moves({ square: square as Square, verbose: true });
          setLegalMoves(moves.map(m => m.to));
        } else {
          setSelectedSquare(null);
          setLegalMoves([]);
        }
      }
    } else {
      const piece = chess.get(square as Square);
      if (piece && piece.color === chess.turn()) {
        setSelectedSquare(square);
        const moves = chess.moves({ square: square as Square, verbose: true });
        setLegalMoves(moves.map(m => m.to));
      }
    }
  };

  const getSquareColor = (displayRow: number, displayCol: number) => {
    const actualRow = flipped ? 7 - displayRow : displayRow;
    const actualCol = flipped ? 7 - displayCol : displayCol;
    const isLight = (actualRow + actualCol) % 2 === 0;
    const file = String.fromCharCode(97 + actualCol);
    const rank = 8 - actualRow;
    const square = `${file}${rank}`;
    
    if (selectedSquare === square) {
      return 'bg-blue-400';
    }
    if (legalMoves.includes(square)) {
      return isLight ? 'bg-green-200' : 'bg-green-500';
    }
    if (highlightSquares.includes(square)) {
      return isLight ? 'bg-yellow-200' : 'bg-yellow-500';
    }
    
    return isLight ? 'bg-amber-100' : 'bg-amber-700';
  };

  const getSquareContent = (displayRow: number, displayCol: number) => {
    const actualRow = flipped ? 7 - displayRow : displayRow;
    const actualCol = flipped ? 7 - displayCol : displayCol;
    return board[actualRow][actualCol];
  };

  const getSquareName = (displayRow: number, displayCol: number) => {
    const actualRow = flipped ? 7 - displayRow : displayRow;
    const actualCol = flipped ? 7 - displayCol : displayCol;
    const file = String.fromCharCode(97 + actualCol);
    const rank = 8 - actualRow;
    return `${file}${rank}`;
  };

  return (
    <div className="aspect-square w-full max-w-sm mx-auto" data-testid="trainer-chessboard">
      <div className="grid grid-cols-8 grid-rows-8 w-full h-full border-2 border-foreground/20 rounded overflow-hidden">
        {Array.from({ length: 8 }).map((_, rowIndex) =>
          Array.from({ length: 8 }).map((_, colIndex) => {
            const square = getSquareContent(rowIndex, colIndex);
            const squareName = getSquareName(rowIndex, colIndex);
            return (
              <div
                key={`${rowIndex}-${colIndex}`}
                className={`flex items-center justify-center aspect-square cursor-pointer transition-colors ${getSquareColor(rowIndex, colIndex)} ${disabled ? 'cursor-not-allowed opacity-75' : 'hover:brightness-110'}`}
                onClick={() => handleSquareClick(squareName)}
                data-testid={`square-${squareName}`}
              >
                {square && (
                  <span className={`text-2xl md:text-3xl ${square.color === 'w' ? 'text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]' : 'text-gray-900'}`}>
                    {pieceSymbols[square.color === 'w' ? square.type.toUpperCase() : square.type]}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// VSS Interactive Training Dialog
function VSSTrainerDialog({
  open,
  onOpenChange,
  fen,
  plyIndex,
  gameId,
  remainingTime,
  playerColor,
  bestMove,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fen: string;
  plyIndex: number;
  gameId: string;
  remainingTime: number;
  playerColor: string;
  bestMove?: string;
}) {
  const { toast } = useToast();
  const [timeLeft, setTimeLeft] = useState(remainingTime);
  const [attempts, setAttempts] = useState(0);
  const [result, setResult] = useState<'pending' | 'correct' | 'incorrect' | 'timeout'>('pending');
  const [highlightSquares, setHighlightSquares] = useState<string[]>([]);
  const [revealedMove, setRevealedMove] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  const moveNumber = Math.floor(plyIndex / 2) + 1;
  const isBlackMove = plyIndex % 2 === 1;
  const flipped = playerColor === 'black';
  
  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setTimeLeft(remainingTime);
      setAttempts(0);
      setResult('pending');
      setHighlightSquares([]);
      setRevealedMove(null);
    }
  }, [open, remainingTime]);
  
  // Countdown timer
  useEffect(() => {
    if (open && result === 'pending') {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            setResult('timeout');
            if (bestMove) {
              setRevealedMove(bestMove);
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      return () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
      };
    }
  }, [open, result, bestMove]);
  
  // Clean up timer on close
  useEffect(() => {
    if (!open && timerRef.current) {
      clearInterval(timerRef.current);
    }
  }, [open]);
  
  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  const handleMove = async (from: string, to: string) => {
    if (result !== 'pending') return;
    
    setIsValidating(true);
    const userMove = `${from}${to}`;
    
    try {
      const response = await apiRequest('POST', `/api/game-analyses/${gameId}/vss-train`, {
        plyIndex,
        userMove,
      });
      const data = await response.json();
      
      if (data.correct) {
        setResult('correct');
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
        toast({ title: 'Correct!', description: 'You found the best move!' });
      } else {
        setAttempts(prev => prev + 1);
        
        if (attempts >= 1) {
          // Third attempt - reveal the answer
          setResult('incorrect');
          if (timerRef.current) {
            clearInterval(timerRef.current);
          }
          setRevealedMove(data.bestMove || bestMove);
          toast({ title: 'Not quite', description: 'The best move has been revealed.', variant: 'destructive' });
        } else if (attempts === 0) {
          // First wrong attempt - show hint squares
          if (data.hintSquares) {
            setHighlightSquares(data.hintSquares);
          }
          toast({ title: 'Try again', description: 'Look at the highlighted squares for a hint.' });
        }
      }
    } catch (error) {
      console.error('Error validating move:', error);
      toast({ title: 'Error', description: 'Failed to validate move', variant: 'destructive' });
    } finally {
      setIsValidating(false);
    }
  };
  
  const getResultIcon = () => {
    switch (result) {
      case 'correct':
        return <CheckCircle className="w-8 h-8 text-green-500" />;
      case 'incorrect':
      case 'timeout':
        return <XCircle className="w-8 h-8 text-red-500" />;
      default:
        return null;
    }
  };
  
  const getTimerColor = () => {
    if (timeLeft <= 10) return 'text-red-500';
    if (timeLeft <= 30) return 'text-yellow-500';
    return 'text-foreground';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" data-testid="vss-trainer-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5" />
            Find the Best Move
          </DialogTitle>
          <DialogDescription>
            Move {moveNumber}{isBlackMove ? '...' : ''} - You had {formatCountdown(remainingTime)} left when the game ended.
            Can you find the best move?
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Timer */}
          <div className="flex items-center justify-center gap-2">
            <Clock className="w-5 h-5" />
            <span className={`text-2xl font-mono font-bold ${getTimerColor()}`} data-testid="trainer-timer">
              {formatCountdown(timeLeft)}
            </span>
            {result === 'pending' && attempts > 0 && (
              <Badge variant="outline" className="ml-2">
                Attempt {attempts + 1}/3
              </Badge>
            )}
          </div>
          
          {/* Board */}
          <InteractiveTrainerBoard
            fen={fen}
            flipped={flipped}
            onMove={handleMove}
            highlightSquares={highlightSquares}
            disabled={result !== 'pending' || isValidating}
          />
          
          {/* Result feedback */}
          {result !== 'pending' && (
            <div className="flex flex-col items-center gap-2 p-4 rounded-lg bg-muted">
              {getResultIcon()}
              <p className="font-semibold">
                {result === 'correct' && 'Well done!'}
                {result === 'incorrect' && 'Better luck next time!'}
                {result === 'timeout' && 'Time\'s up!'}
              </p>
              {revealedMove && (
                <p className="text-sm text-muted-foreground">
                  The best move was: <span className="font-mono font-bold">{revealedMove}</span>
                </p>
              )}
              {result === 'correct' && (
                <p className="text-sm text-muted-foreground">
                  Remember: taking your time on critical positions pays off!
                </p>
              )}
            </div>
          )}
          
          {isValidating && (
            <div className="flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} data-testid="button-close-trainer">
            {result === 'pending' ? 'Cancel' : 'Close'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function GameAnalysisPage() {
  const { gameId, shareCode } = useParams<{ gameId?: string; shareCode?: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState("analyze");
  
  const simulMatchId = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('matchId');
  }, []);

  const handleNavigateToMove = (moveIndex: number) => {
    setCurrentMoveIndex(moveIndex);
    setActiveTab("analyze");
  };

  const isSharedView = !!shareCode;
  const [autoStarted, setAutoStarted] = useState(false);
  const [useClientSide, setUseClientSide] = useState(false);
  const [miniGameOpen, setMiniGameOpen] = useState(false);
  const [initialMiniGame, setInitialMiniGame] = useState<MiniGameType>(null);
  
  const clientAnalysis = useClientAnalysis();

  const { data, isLoading, error, refetch } = useQuery<AnalysisData>({
    queryKey: isSharedView ? ['/api/analysis/shared', shareCode] : ['/api/analysis', gameId],
    enabled: !!(gameId || shareCode),
    refetchInterval: (query) => {
      const analysisData = query.state.data as AnalysisData | undefined;
      if (analysisData?.analysis?.status === 'processing') {
        return 3000;
      }
      return false;
    },
  });

  // Use raw game moves for navigation - always available even before analysis completes
  const gameMoves: string[] = useMemo(() => {
    if (!data?.game?.moves) return [];
    if (Array.isArray(data.game.moves)) return data.game.moves as string[];
    if (typeof data.game.moves === 'string') return (data.game.moves as string).split(' ').filter(m => m.trim());
    return [];
  }, [data?.game?.moves]);
  
  // Compute FEN positions for each move using chess.js (so navigation works before analysis)
  const computedFens = useMemo(() => {
    const fens: string[] = [];
    const chess = new Chess();
    for (const move of gameMoves) {
      try {
        chess.move(move);
        fens.push(chess.fen());
      } catch {
        break; // Stop on invalid move
      }
    }
    return fens;
  }, [gameMoves]);

  const startAnalysisMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/analysis/start/${gameId}`);
      return response.json();
    },
    onSuccess: (result) => {
      if (result.status === 'started') {
        toast({ title: 'Analysis started', description: 'This usually takes 15-30 seconds...' });
        setTimeout(() => refetch(), 1000);
      } else if (result.status === 'already_completed') {
        refetch();
      }
    },
    onError: () => {
      toast({ title: 'Failed to start analysis', variant: 'destructive' });
    },
  });

  useEffect(() => {
    if (!isSharedView && gameId && error && !autoStarted && !startAnalysisMutation.isPending) {
      setAutoStarted(true);
      toast({ title: 'Starting analysis...', description: 'This usually takes 15-30 seconds' });
      startAnalysisMutation.mutate();
    }
  }, [error, gameId, isSharedView, autoStarted, startAnalysisMutation.isPending]);

  useEffect(() => {
    if (autoStarted && error) {
      const pollInterval = setInterval(() => {
        refetch();
      }, 3000);
      return () => clearInterval(pollInterval);
    }
  }, [autoStarted, error, refetch]);

  const shareAnalysisMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/analysis/${gameId}/share`);
      return response.json();
    },
    onSuccess: (result) => {
      const fullUrl = `${window.location.origin}/analysis/shared/${result.shareCode}`;
      navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: 'Link copied!', description: 'Share link copied to clipboard' });
    },
    onError: () => {
      toast({ title: 'Failed to create share link', variant: 'destructive' });
    },
  });

  const currentFen = useCallback(() => {
    const startingFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    if (currentMoveIndex < 0) {
      return startingFen;
    }
    // First try analyzed moves (have FEN stored), then fall back to computed FENs
    if (data?.moves && data.moves[currentMoveIndex]?.fen) {
      return data.moves[currentMoveIndex].fen;
    }
    // Use computed FEN from game moves (works before analysis completes)
    return computedFens[currentMoveIndex] || startingFen;
  }, [data?.moves, currentMoveIndex, computedFens]);

  // Pre-move FEN: the position BEFORE the current move was made
  // This is what Engine Suggestions should analyze to show what moves are best
  const preMoveFen = useCallback(() => {
    const startingFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    if (currentMoveIndex < 0) {
      return startingFen;
    }
    // For move at index N, get the FEN from index N-1 (position before this move)
    // For index 0 (first move), use starting position
    if (currentMoveIndex === 0) {
      return startingFen;
    }
    // First try analyzed moves, then fall back to computed FENs
    if (data?.moves && data.moves[currentMoveIndex - 1]?.fen) {
      return data.moves[currentMoveIndex - 1].fen;
    }
    return computedFens[currentMoveIndex - 1] || startingFen;
  }, [data?.moves, currentMoveIndex, computedFens]);

  const currentMove = currentMoveIndex >= 0 && data?.moves ? data.moves[currentMoveIndex] : null;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameMoves.length === 0) return;
      
      switch (e.key) {
        case 'ArrowLeft':
          setCurrentMoveIndex(prev => Math.max(-1, prev - 1));
          break;
        case 'ArrowRight':
          setCurrentMoveIndex(prev => Math.min(gameMoves.length - 1, prev + 1));
          break;
        case 'Home':
          setCurrentMoveIndex(-1);
          break;
        case 'End':
          setCurrentMoveIndex(gameMoves.length - 1);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameMoves.length]);

  // Auto-start analysis when status is 'not_started' - must be before early returns
  useEffect(() => {
    if (data?.analysis?.status === 'not_started' && !autoStarted && !startAnalysisMutation.isPending && !isSharedView && gameId) {
      setAutoStarted(true);
      toast({ title: 'Starting analysis...', description: 'This usually takes 15-30 seconds' });
      startAnalysisMutation.mutate();
    }
  }, [data?.analysis?.status, autoStarted, startAnalysisMutation.isPending, isSharedView, gameId]);

  // Track if analysis is in progress (server or client)
  const isAnalyzing = clientAnalysis.analyzing || 
    data?.analysis?.status === 'processing' || 
    (autoStarted && !data?.analysis) ||
    startAnalysisMutation.isPending;

  // Auto-advance to move 1 when analysis starts (so user sees analysis in action)
  const hasAutoAdvanced = useRef(false);
  useEffect(() => {
    if (isAnalyzing && gameMoves.length > 0 && currentMoveIndex === -1 && !hasAutoAdvanced.current) {
      hasAutoAdvanced.current = true;
      setCurrentMoveIndex(0);
    }
  }, [isAnalyzing, gameMoves.length, currentMoveIndex]);

  // Notify when analysis completes if mini-game is open
  const prevIsAnalyzing = useRef(isAnalyzing);
  useEffect(() => {
    if (prevIsAnalyzing.current && !isAnalyzing && miniGameOpen) {
      toast({
        title: 'Analysis Complete!',
        description: 'Your game analysis is ready to view.',
      });
    }
    prevIsAnalyzing.current = isAnalyzing;
  }, [isAnalyzing, miniGameOpen, toast]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (error || (!data && !isLoading)) {
    return (
      <div className="container max-w-6xl mx-auto p-4">
        <Card>
          <CardContent className="p-8 text-center">
            {clientAnalysis.analyzing ? (
              <>
                <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-primary" />
                <h2 className="text-xl font-bold mb-2">Analyzing Locally</h2>
                <p className="text-muted-foreground mb-2">
                  Using your device to analyze the game...
                </p>
                <Progress 
                  value={(clientAnalysis.progress / clientAnalysis.totalMoves) * 100} 
                  className="w-64 mx-auto mb-2"
                />
                <p className="text-sm text-muted-foreground mb-4">
                  Move {clientAnalysis.progress} of {clientAnalysis.totalMoves}
                </p>
                <Button
                  variant="outline"
                  onClick={() => setMiniGameOpen(true)}
                  data-testid="button-play-while-waiting-local"
                >
                  <Gamepad2 className="w-4 h-4 mr-2" />
                  Play While You Wait
                </Button>
              </>
            ) : autoStarted || startAnalysisMutation.isPending ? (
              <>
                <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-primary" />
                <h2 className="text-xl font-bold mb-2">Analyzing Your Game</h2>
                <p className="text-muted-foreground mb-4">
                  Stockfish is evaluating each move. This usually takes 15-30 seconds...
                </p>
                <div className="flex flex-col gap-2 items-center">
                  <Button
                    variant="outline"
                    onClick={() => setMiniGameOpen(true)}
                    data-testid="button-play-while-waiting-server"
                  >
                    <Gamepad2 className="w-4 h-4 mr-2" />
                    Play While You Wait
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setUseClientSide(true);
                      clientAnalysis.startAnalysis(gameMoves);
                    }}
                    disabled={gameMoves.length === 0}
                    data-testid="button-analyze-locally"
                  >
                    <Zap className="w-4 h-4 mr-2" />
                    Analyze Locally Instead
                  </Button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-xl font-bold mb-4">Analysis Not Found</h2>
                <div className="flex flex-col gap-2 items-center">
                  {!isSharedView && gameId && (
                    <Button 
                      onClick={() => startAnalysisMutation.mutate()}
                      disabled={startAnalysisMutation.isPending}
                      data-testid="button-start-analysis"
                    >
                      Start Server Analysis
                    </Button>
                  )}
                  {gameMoves.length > 0 && (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setUseClientSide(true);
                        clientAnalysis.startAnalysis(gameMoves);
                      }}
                      data-testid="button-analyze-locally-alt"
                    >
                      <Zap className="w-4 h-4 mr-2" />
                      Analyze Locally (Faster)
                    </Button>
                  )}
                </div>
              </>
            )}
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => setLocation('/history')}
              data-testid="button-back-history"
            >
              Back to History
            </Button>
          </CardContent>
        </Card>
        
        <MiniGameOverlay 
          open={miniGameOpen} 
          onOpenChange={(open) => {
            setMiniGameOpen(open);
            if (!open) setInitialMiniGame(null);
          }}
          initialGame={initialMiniGame}
        />
      </div>
    );
  }

  const { analysis, moves, game } = data!;
  const playerColor = game.playerColor;

  // Generate PGN for download
  const generatePGN = () => {
    const chess = new Chess();
    
    // Handle both array and string formats for game.moves (same as getFenAtPly)
    const gameMovesList = Array.isArray(game.moves) 
      ? game.moves as string[]
      : (typeof game.moves === 'string' ? (game.moves as string).split(' ').filter(m => m.length > 0) : []);
    
    gameMovesList.forEach((move: string) => {
      try {
        chess.move(move);
      } catch (e) {
        // Skip invalid moves
      }
    });
    
    // Build PGN headers
    const date = game.createdAt ? new Date(game.createdAt) : new Date();
    const dateStr = `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
    
    const headers: string[] = [
      `[Event "SimulChess ${game.mode?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Game'}"]`,
      `[Site "SimulChess"]`,
      `[Date "${dateStr}"]`,
      `[White "${playerColor === 'white' ? 'Player' : (game.opponentName || 'Opponent')}"]`,
      `[Black "${playerColor === 'black' ? 'Player' : (game.opponentName || 'Opponent')}"]`,
      `[Result "${game.result === 'white_win' ? '1-0' : game.result === 'black_win' ? '0-1' : game.result === 'draw' ? '1/2-1/2' : '*'}"]`,
    ];
    
    if (game.timeControl) {
      headers.push(`[TimeControl "${game.timeControl}"]`);
    }
    
    // Get the PGN moves from chess.js
    const pgnMoves = chess.pgn({ maxWidth: 80 }).split('\n').filter(line => !line.startsWith('[')).join('\n').trim();
    
    // Get the final position FEN
    const finalFen = chess.fen();
    
    return headers.join('\n') + '\n\n' + pgnMoves + '\n\n{ Final position FEN: ' + finalFen + ' }';
  };

  const handleDownloadPGN = () => {
    const pgn = generatePGN();
    const blob = new Blob([pgn], { type: 'application/x-chess-pgn' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dateStr = game.createdAt ? new Date(game.createdAt).toISOString().split('T')[0] : 'game';
    a.download = `simulchess_${game.mode || 'game'}_${dateStr}.pgn`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: 'PGN Downloaded', description: 'Game exported successfully.' });
  };

  return (
    <div className="container max-w-7xl mx-auto p-4">
      <Helmet>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          {simulMatchId ? (
            <Button
              variant="outline"
              onClick={() => setLocation(`/simul-match/${simulMatchId}`)}
              data-testid="button-back-match"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Match
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={() => setLocation('/history')}
              data-testid="button-back-history-header"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to History
            </Button>
          )}
          <div>
            <h1 className="text-2xl font-bold">Game Analysis</h1>
            <p className="text-muted-foreground">
              {game.mode?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} 
              {game.opponentName && ` vs ${game.opponentName}`}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleDownloadPGN}
            data-testid="button-download-pgn"
          >
            <Download className="w-4 h-4 mr-2" />
            Download PGN
          </Button>
          {!isSharedView && analysis.status === 'completed' && (
            <Button
              variant="outline"
              onClick={() => shareAnalysisMutation.mutate()}
              disabled={shareAnalysisMutation.isPending}
              data-testid="button-share-analysis"
            >
              {copied ? <Check className="w-4 h-4 mr-2" /> : <Share2 className="w-4 h-4 mr-2" />}
              {copied ? 'Copied!' : 'Share'}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="analyze" data-testid="tab-analyze">
                <BarChart3 className="w-4 h-4 mr-2" />
                Analyze
              </TabsTrigger>
              <TabsTrigger value="review" data-testid="tab-review">
                <Brain className="w-4 h-4 mr-2" />
                Review
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="analyze" className="space-y-4">
              <Card>
                <CardContent className="p-4">
                  <div className="grid gap-0" style={{ gridTemplateColumns: '24px 1fr' }}>
                    {(() => {
                      const fen = currentFen();
                      const chess = new Chess(fen);
                      const isCheckmate = chess.isCheckmate();
                      const checkmateWinner = isCheckmate ? (chess.turn() === 'w' ? 'black' : 'white') : undefined;
                      return (
                        <VerticalEvalBar 
                          evaluation={currentMove?.evalAfter ?? 0} 
                          flipped={playerColor === 'black'}
                          isCheckmate={isCheckmate}
                          checkmateWinner={checkmateWinner}
                        />
                      );
                    })()}
                    <ChessBoard 
                      fen={currentFen()} 
                      lastMove={currentMove ? { 
                        from: currentMove.move.substring(0, 2), 
                        to: currentMove.move.substring(2, 4) 
                      } : undefined}
                      flipped={playerColor === 'black'}
                    />
                  </div>
                  
                  <div className="flex items-center justify-center gap-2 mt-4">
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => setCurrentMoveIndex(-1)}
                      disabled={currentMoveIndex < 0}
                      data-testid="button-first-move"
                    >
                      <ChevronsLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => setCurrentMoveIndex(prev => Math.max(-1, prev - 1))}
                      disabled={currentMoveIndex < 0}
                      data-testid="button-prev-move"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="px-4 text-sm text-muted-foreground">
                      {currentMoveIndex < 0 ? 'Start' : `Move ${Math.floor(currentMoveIndex / 2) + 1}`}
                    </span>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => setCurrentMoveIndex(prev => Math.min(gameMoves.length - 1, prev + 1))}
                      disabled={currentMoveIndex >= gameMoves.length - 1}
                      data-testid="button-next-move"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => setCurrentMoveIndex(gameMoves.length - 1)}
                      disabled={currentMoveIndex >= gameMoves.length - 1}
                      data-testid="button-last-move"
                    >
                      <ChevronsRight className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
              
              {/* Syzygy Tablebase Indicator for endgame positions */}
              <SyzygyIndicator fen={currentFen()} />
              
              {currentMoveIndex >= 0 && (
                <Card data-testid="current-move-details">
                  <CardContent className="p-4">
                    {currentMove ? (
                      <>
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-mono text-lg">{currentMove.move}</span>
                            {currentMove.classification && (
                              <Badge className={`ml-2 ${CLASSIFICATION_COLORS[currentMove.classification]}`}>
                                {CLASSIFICATION_LABELS[currentMove.classification]}
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Eval: {getPlayerEval(currentMove.evalAfter, playerColor)?.toFixed(2) ?? '--'}
                            {currentMove.centipawnLoss != null && currentMove.centipawnLoss > 0 && (
                              <span className="text-red-500 ml-2">
                                ({currentMove.centipawnLoss} cp loss)
                              </span>
                            )}
                          </div>
                        </div>
                        
                        {currentMove.bestMove && currentMove.move !== currentMove.bestMove && (
                          <div className="mt-2 p-2 bg-muted rounded text-sm">
                            <span className="text-muted-foreground">Best was: </span>
                            <span className="font-mono">{currentMove.bestMove}</span>
                            <span className="text-muted-foreground ml-2">
                              (eval: {getPlayerEval(currentMove.bestMoveEval, playerColor)?.toFixed(2)})
                            </span>
                          </div>
                        )}
                        
                        {currentMove.missedTactics && (currentMove.missedTactics as any[]).length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {(currentMove.missedTactics as { pattern: string }[]).map((t, i) => (
                              <Badge key={i} variant="outline" className="bg-red-500/10">
                                Missed {t.pattern}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="font-mono">{gameMoves[currentMoveIndex]}</span>
                        <span className="text-sm">- Analyzing move...</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
              
              {analysis.status === 'completed' && (
                <EngineSuggestions fen={preMoveFen()} playerColor={playerColor} />
              )}
            </TabsContent>
            
            <TabsContent value="review">
              {analysis.status === 'completed' ? (
                <ReviewTab analysis={analysis} game={game} moves={moves} onNavigateToMove={handleNavigateToMove} />
              ) : (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">Analysis in Progress</h3>
                    <p className="text-muted-foreground">
                      The Review tab will be available once analysis completes.
                      You can navigate through moves in the Analyze tab while waiting.
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
        
        <div className="space-y-4">
          {analysis.status === 'completed' ? (
            <>
              <QuickSummary analysis={analysis} moves={moves} playerColor={playerColor} />
              <PhaseBreakdown analysis={analysis} />
            </>
          ) : (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="font-medium">Analyzing...</span>
                </div>
                <Progress value={moves.length / gameMoves.length * 100} className="h-2" />
                <p className="text-sm text-muted-foreground mt-2">
                  {moves.length} of {gameMoves.length} moves analyzed
                </p>
              </CardContent>
            </Card>
          )}
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Moves</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <MoveList
                gameMoves={gameMoves}
                analyzedMoves={moves}
                currentIndex={currentMoveIndex}
                onMoveClick={setCurrentMoveIndex}
              />
            </CardContent>
          </Card>
          
          {isAnalyzing && (
            <Card data-testid="card-play-while-waiting">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Gamepad2 className="w-4 h-4" />
                  Play While You Wait
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Analysis takes a few minutes. Try a quick puzzle game!
                </p>
                <div className="grid grid-cols-1 gap-2">
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => { setInitialMiniGame('n-piece'); setMiniGameOpen(true); }}
                    data-testid="button-minigame-npiece"
                  >
                    <Target className="w-4 h-4 mr-2 text-blue-500" />
                    N-Piece Challenge
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => { setInitialMiniGame('board-spin'); setMiniGameOpen(true); }}
                    data-testid="button-minigame-boardspin"
                  >
                    <RotateCw className="w-4 h-4 mr-2 text-green-500" />
                    Board Spin
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => { setInitialMiniGame('knights-tour'); setMiniGameOpen(true); }}
                    data-testid="button-minigame-knights"
                  >
                    <Crown className="w-4 h-4 mr-2 text-yellow-500" />
                    Knight's Tour
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      
      <MiniGameOverlay 
        open={miniGameOpen} 
        onOpenChange={(open) => {
          setMiniGameOpen(open);
          if (!open) setInitialMiniGame(null);
        }}
        initialGame={initialMiniGame}
      />
    </div>
  );
}
