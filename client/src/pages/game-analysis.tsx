import { useState, useEffect, useCallback } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Chess } from 'chess.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
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
  good: 'Good',
  imprecise: 'Imprecise',
  mistake: 'Mistake',
  blunder: 'Blunder',
  book: 'Book',
  forced: 'Forced',
};

function EvaluationGraph({ 
  moves, 
  currentIndex, 
  onMoveClick 
}: { 
  moves: MoveAnalysis[]; 
  currentIndex: number;
  onMoveClick: (index: number) => void;
}) {
  if (moves.length === 0) return null;

  const maxEval = 5;
  const minEval = -5;

  const clampEval = (val: number) => Math.max(minEval, Math.min(maxEval, val));

  return (
    <div className="w-full h-32 relative bg-muted rounded-lg overflow-hidden" data-testid="evaluation-graph">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full h-px bg-muted-foreground/30" />
      </div>
      
      <svg className="w-full h-full" viewBox={`0 0 ${moves.length} 100`} preserveAspectRatio="none">
        <defs>
          <linearGradient id="evalGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity="0.3" />
            <stop offset="50%" stopColor="hsl(var(--chart-1))" stopOpacity="0.1" />
            <stop offset="100%" stopColor="hsl(var(--chart-2))" stopOpacity="0.3" />
          </linearGradient>
        </defs>
        
        <path
          d={moves.map((m, i) => {
            const eval_val = m.evalAfter ?? 0;
            const y = 50 - (clampEval(eval_val) / maxEval) * 45;
            return `${i === 0 ? 'M' : 'L'} ${i} ${y}`;
          }).join(' ')}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="0.5"
        />
        
        {moves.map((m, i) => {
          const eval_val = m.evalAfter ?? 0;
          const y = 50 - (clampEval(eval_val) / maxEval) * 45;
          const isCritical = m.isCriticalMoment;
          
          return (
            <g key={i}>
              <rect
                x={i - 0.4}
                y={0}
                width={0.8}
                height={100}
                fill="transparent"
                className="cursor-pointer"
                onClick={() => onMoveClick(i)}
              />
              {isCritical && (
                <circle
                  cx={i}
                  cy={y}
                  r={2}
                  fill="hsl(var(--destructive))"
                />
              )}
              {i === currentIndex && (
                <line
                  x1={i}
                  y1={0}
                  x2={i}
                  y2={100}
                  stroke="hsl(var(--primary))"
                  strokeWidth="0.3"
                />
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function MoveList({
  moves,
  currentIndex,
  onMoveClick,
}: {
  moves: MoveAnalysis[];
  currentIndex: number;
  onMoveClick: (index: number) => void;
}) {
  const groupedMoves: { white?: MoveAnalysis; black?: MoveAnalysis; moveNumber: number }[] = [];
  
  for (let i = 0; i < moves.length; i++) {
    const move = moves[i];
    const pairIndex = Math.floor(i / 2);
    
    if (!groupedMoves[pairIndex]) {
      groupedMoves[pairIndex] = { moveNumber: move.moveNumber };
    }
    
    if (move.color === 'white') {
      groupedMoves[pairIndex].white = move;
    } else {
      groupedMoves[pairIndex].black = move;
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
                <span className="font-mono">{pair.white.move}</span>
                {pair.white.classification && (
                  <Badge 
                    variant="outline" 
                    className={`text-xs px-1 py-0 ${CLASSIFICATION_COLORS[pair.white.classification]}`}
                  >
                    {CLASSIFICATION_LABELS[pair.white.classification][0]}
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
                <span className="font-mono">{pair.black.move}</span>
                {pair.black.classification && (
                  <Badge 
                    variant="outline" 
                    className={`text-xs px-1 py-0 ${CLASSIFICATION_COLORS[pair.black.classification]}`}
                  >
                    {CLASSIFICATION_LABELS[pair.black.classification][0]}
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
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            {(['genius', 'fantastic', 'good', 'imprecise', 'mistake', 'blunder'] as MoveClassification[]).map(c => (
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

function ReviewTab({ analysis }: { analysis: GameAnalysis }) {
  return (
    <div className="space-y-4">
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
              Time spent vs. move quality correlation
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
      
      {analysis.vssMismatchAlerts && (analysis.vssMismatchAlerts as number[]).length > 0 && (
        <Card data-testid="vss-mismatch">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Brain className="w-4 h-4" />
              VSS Mismatch Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-2">
              Positions where you may have misjudged the evaluation
            </p>
            <div className="flex flex-wrap gap-2">
              {(analysis.vssMismatchAlerts as number[]).map((move, i) => (
                <Badge key={i} variant="outline">Move {move}</Badge>
              ))}
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
    </div>
  );
}

function ChessBoard({ fen, lastMove }: { fen: string; lastMove?: { from: string; to: string } }) {
  const chess = new Chess(fen);
  const board = chess.board();
  
  const pieceSymbols: Record<string, string> = {
    'k': '\u265A', 'q': '\u265B', 'r': '\u265C', 'b': '\u265D', 'n': '\u265E', 'p': '\u265F',
    'K': '\u2654', 'Q': '\u2655', 'R': '\u2656', 'B': '\u2657', 'N': '\u2658', 'P': '\u2659',
  };

  const getSquareColor = (row: number, col: number) => {
    const isLight = (row + col) % 2 === 0;
    const file = String.fromCharCode(97 + col);
    const rank = 8 - row;
    const square = `${file}${rank}`;
    
    if (lastMove && (lastMove.from === square || lastMove.to === square)) {
      return isLight ? 'bg-yellow-200' : 'bg-yellow-400';
    }
    
    return isLight ? 'bg-amber-100' : 'bg-amber-700';
  };

  return (
    <div className="aspect-square w-full max-w-md mx-auto" data-testid="chessboard">
      <div className="grid grid-cols-8 grid-rows-8 w-full h-full border-2 border-foreground/20 rounded overflow-hidden">
        {board.map((row, rowIndex) =>
          row.map((square, colIndex) => (
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
          ))
        )}
      </div>
    </div>
  );
}

export default function GameAnalysisPage() {
  const { gameId, shareCode } = useParams<{ gameId?: string; shareCode?: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);
  const [copied, setCopied] = useState(false);

  const isSharedView = !!shareCode;

  const { data, isLoading, error } = useQuery<AnalysisData>({
    queryKey: isSharedView ? ['/api/analysis/shared', shareCode] : ['/api/analysis', gameId],
    enabled: !!(gameId || shareCode),
  });

  const startAnalysisMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/analysis/start/${gameId}`);
      return response.json();
    },
    onSuccess: (result) => {
      if (result.status === 'started') {
        toast({ title: 'Analysis started', description: 'This usually takes 15-30 seconds...' });
        queryClient.invalidateQueries({ queryKey: ['/api/analysis', gameId] });
      }
    },
    onError: () => {
      toast({ title: 'Failed to start analysis', variant: 'destructive' });
    },
  });

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
    if (!data?.moves || currentMoveIndex < 0) {
      return 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    }
    return data.moves[currentMoveIndex]?.fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  }, [data?.moves, currentMoveIndex]);

  const currentMove = currentMoveIndex >= 0 && data?.moves ? data.moves[currentMoveIndex] : null;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!data?.moves) return;
      
      switch (e.key) {
        case 'ArrowLeft':
          setCurrentMoveIndex(prev => Math.max(-1, prev - 1));
          break;
        case 'ArrowRight':
          setCurrentMoveIndex(prev => Math.min(data.moves.length - 1, prev + 1));
          break;
        case 'Home':
          setCurrentMoveIndex(-1);
          break;
        case 'End':
          setCurrentMoveIndex(data.moves.length - 1);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [data?.moves]);

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
            <h2 className="text-xl font-bold mb-4">Analysis Not Found</h2>
            {!isSharedView && gameId && (
              <Button 
                onClick={() => startAnalysisMutation.mutate()}
                disabled={startAnalysisMutation.isPending}
                data-testid="button-start-analysis"
              >
                {startAnalysisMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : null}
                Start Analysis
              </Button>
            )}
            <Button 
              variant="outline" 
              className="ml-2"
              onClick={() => setLocation('/history')}
              data-testid="button-back-history"
            >
              Back to History
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { analysis, moves, game } = data!;
  const playerColor = game.playerColor;

  return (
    <div className="container max-w-7xl mx-auto p-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Game Analysis</h1>
          <p className="text-muted-foreground">
            {game.mode?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} 
            {game.opponentName && ` vs ${game.opponentName}`}
          </p>
        </div>
        
        {!isSharedView && (
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Tabs defaultValue="analyze" className="w-full">
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
                  <ChessBoard 
                    fen={currentFen()} 
                    lastMove={currentMove ? { 
                      from: currentMove.move.substring(0, 2), 
                      to: currentMove.move.substring(2, 4) 
                    } : undefined}
                  />
                  
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
                      onClick={() => setCurrentMoveIndex(prev => Math.min(moves.length - 1, prev + 1))}
                      disabled={currentMoveIndex >= moves.length - 1}
                      data-testid="button-next-move"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => setCurrentMoveIndex(moves.length - 1)}
                      disabled={currentMoveIndex >= moves.length - 1}
                      data-testid="button-last-move"
                    >
                      <ChevronsRight className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
              
              <EvaluationGraph 
                moves={moves} 
                currentIndex={currentMoveIndex}
                onMoveClick={setCurrentMoveIndex}
              />
              
              {currentMove && (
                <Card data-testid="current-move-details">
                  <CardContent className="p-4">
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
                        Eval: {currentMove.evalAfter?.toFixed(2) ?? '--'}
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
                          (eval: {currentMove.bestMoveEval?.toFixed(2)})
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
                  </CardContent>
                </Card>
              )}
            </TabsContent>
            
            <TabsContent value="review">
              <ReviewTab analysis={analysis} />
            </TabsContent>
          </Tabs>
        </div>
        
        <div className="space-y-4">
          <QuickSummary analysis={analysis} moves={moves} playerColor={playerColor} />
          <PhaseBreakdown analysis={analysis} />
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Moves</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <MoveList
                moves={moves}
                currentIndex={currentMoveIndex}
                onMoveClick={setCurrentMoveIndex}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
