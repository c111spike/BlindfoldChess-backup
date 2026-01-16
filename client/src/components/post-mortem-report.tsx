import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Trophy, Brain, Clock, Grid3X3, TrendingUp, TrendingDown, RotateCcw, Home, Activity, X, PuzzleIcon, Mic, Search } from "lucide-react";
import { formatResponseTime } from "@/lib/gameStats";

interface PostMortemReportProps {
  open: boolean;
  gameResult: "white_win" | "black_win" | "draw" | null;
  playerColor: "white" | "black";
  clarityScore: number;
  responseTimes: number[];
  squareInquiries: string[];
  reconstructionScore: number | null;
  reconstructionVoicePurity: number | null;
  reconstructionEnabled: boolean;
  onRematch: () => void;
  onMainMenu: () => void;
  onAnalyze?: () => void;
}

function MentalStaminaGraph({ responseTimes, onJumpToMove }: { responseTimes: number[], onJumpToMove?: (moveIndex: number) => void }) {
  if (responseTimes.length < 3) {
    return (
      <div className="text-sm text-muted-foreground text-center py-4">
        Not enough moves to display stamina graph
      </div>
    );
  }

  const maxTime = Math.max(...responseTimes, 1);
  const totalMoves = responseTimes.length;
  const MIN_BAR_WIDTH = 4;
  const graphWidth = Math.max(100, totalMoves * (MIN_BAR_WIDTH + 2));
  
  const getPhaseColor = (moveIndex: number, total: number): string => {
    const progress = moveIndex / total;
    if (progress < 0.15) return 'bg-green-500';
    if (progress < 0.60) return 'bg-amber-400';
    return 'bg-red-400';
  };
  
  const openingEnd = Math.floor(totalMoves * 0.15);
  const middlegameEnd = Math.floor(totalMoves * 0.60);
  
  const phases = {
    opening: responseTimes.slice(0, openingEnd),
    middlegame: responseTimes.slice(openingEnd, middlegameEnd),
    endgame: responseTimes.slice(middlegameEnd),
  };
  
  const avgOpening = phases.opening.length > 0 
    ? phases.opening.reduce((a, b) => a + b, 0) / phases.opening.length 
    : 0;
  const avgEndgame = phases.endgame.length > 0 
    ? phases.endgame.reduce((a, b) => a + b, 0) / phases.endgame.length 
    : 0;
  
  const driftPercentage = avgOpening > 0 
    ? Math.round(((avgEndgame - avgOpening) / avgOpening) * 100) 
    : 0;

  return (
    <div className="space-y-3" data-testid="mental-stamina-graph">
      <div className="w-full overflow-x-auto pb-1">
        <div 
          className="h-24 flex items-end bg-muted/30 rounded-md p-2 relative"
          style={{ width: `${graphWidth}px`, minWidth: '100%' }}
        >
          {responseTimes.map((time, idx) => {
            const height = Math.max(4, (time / maxTime) * 100);
            const bgColor = getPhaseColor(idx, totalMoves);
            
            return (
              <div
                key={idx}
                className={`${bgColor} rounded-t-sm flex-1 cursor-pointer hover:opacity-80 active:opacity-60`}
                style={{ 
                  height: `${height}%`,
                  minWidth: '4px',
                  marginLeft: '1px',
                  marginRight: '1px'
                }}
                onClick={() => onJumpToMove?.(idx)}
                title={`Move ${idx + 1}: ${formatResponseTime(time)}`}
                data-testid={`stamina-bar-${idx}`}
              />
            );
          })}
          <div className="absolute bottom-0 w-full h-[1px] bg-muted-foreground/20" />
        </div>
      </div>
      
      <div className="flex justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-green-500 rounded" />
          <span>Opening</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-amber-400 rounded" />
          <span>Middlegame</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-red-400 rounded" />
          <span>Endgame</span>
        </div>
      </div>
      
      {driftPercentage !== 0 && (
        <div className="flex items-center justify-center gap-2 text-sm">
          {driftPercentage > 0 ? (
            <>
              <TrendingDown className="h-4 w-4 text-red-500" />
              <span className="text-red-500">
                {driftPercentage}% slower in endgame
              </span>
            </>
          ) : (
            <>
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span className="text-green-500">
                {Math.abs(driftPercentage)}% faster in endgame
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function SpatialBlurHeatmap({ squareInquiries }: { squareInquiries: string[] }) {
  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];
  
  const inquiryCounts: Record<string, number> = {};
  for (const sq of squareInquiries) {
    const normalized = sq.toLowerCase();
    inquiryCounts[normalized] = (inquiryCounts[normalized] || 0) + 1;
  }
  
  const maxCount = Math.max(...Object.values(inquiryCounts), 1);
  
  const getHeatColor = (square: string): string => {
    const count = inquiryCounts[square] || 0;
    if (count === 0) return 'bg-muted/30';
    const intensity = (count / maxCount) * 100;
    if (intensity < 25) return 'bg-amber-200 dark:bg-amber-900/40';
    if (intensity < 50) return 'bg-amber-400 dark:bg-amber-700/60';
    if (intensity < 75) return 'bg-red-400 dark:bg-red-700/70';
    return 'bg-red-600 dark:bg-red-600/80';
  };
  
  if (squareInquiries.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-4">
        No square inquiries this game
      </div>
    );
  }

  return (
    <div className="space-y-2" data-testid="spatial-blur-heatmap">
      <div className="grid grid-cols-8 gap-0.5 aspect-square max-w-[180px] mx-auto">
        {ranks.map(rank => 
          files.map(file => {
            const square = `${file}${rank}`;
            const count = inquiryCounts[square] || 0;
            return (
              <div
                key={square}
                className={`${getHeatColor(square)} rounded-sm flex items-center justify-center text-[8px] font-mono`}
                title={`${square.toUpperCase()}: ${count} inquiries`}
                data-testid={`heatmap-square-${square}`}
              >
                {count > 0 && <span className="text-foreground/70">{count}</span>}
              </div>
            );
          })
        )}
      </div>
      <p className="text-xs text-muted-foreground text-center" data-testid="text-total-inquiries">
        {squareInquiries.length} total inquiries
      </p>
    </div>
  );
}

export function PostMortemReport({
  open,
  gameResult,
  playerColor,
  clarityScore,
  responseTimes,
  squareInquiries,
  reconstructionScore,
  reconstructionVoicePurity,
  reconstructionEnabled,
  onRematch,
  onMainMenu,
  onAnalyze,
}: PostMortemReportProps) {
  const playerWon = (gameResult === "white_win" && playerColor === "white") ||
                   (gameResult === "black_win" && playerColor === "black");
  
  const resultText = gameResult === "draw" 
    ? "Game Drawn" 
    : playerWon ? "Victory" : "Defeat";
  
  const resultColor = gameResult === "draw" 
    ? "text-amber-500" 
    : playerWon ? "text-green-500" : "text-red-500";
  
  const avgResponseTime = responseTimes.length > 0
    ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
    : 0;

  return (
    <Dialog open={open}>
      <DialogContent 
        className="max-w-md max-h-[90vh] overflow-y-auto [&>button.absolute]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-4 top-4 h-6 w-6 rounded-sm opacity-70 hover:opacity-100"
          onClick={onMainMenu}
          data-testid="button-postmortem-close"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </Button>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Trophy className={`h-6 w-6 ${resultColor}`} />
            <span className={resultColor}>{resultText}</span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Card className="bg-muted/30 border-0">
              <CardContent className="p-3 text-center">
                <Brain className="h-5 w-5 mx-auto mb-1 text-amber-500" />
                <p className="text-2xl font-bold text-amber-500">{clarityScore}%</p>
                <p className="text-xs text-muted-foreground">Reconstruction Score</p>
              </CardContent>
            </Card>
            
            <Card className="bg-muted/30 border-0">
              <CardContent className="p-3 text-center">
                <Clock className="h-5 w-5 mx-auto mb-1 text-blue-500" />
                <p className="text-2xl font-bold">{formatResponseTime(avgResponseTime)}</p>
                <p className="text-xs text-muted-foreground">Avg Response</p>
              </CardContent>
            </Card>
          </div>
          
          <Separator />
          
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Mental Stamina</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Response time changes throughout the game
            </p>
            <MentalStaminaGraph responseTimes={responseTimes} />
          </div>
          
          <Separator />
          
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Grid3X3 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Spatial Blurs</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Squares you needed to inquire about
            </p>
            <SpatialBlurHeatmap squareInquiries={squareInquiries} />
          </div>
          
          {reconstructionEnabled && reconstructionScore !== null && (
            <>
              <Separator />
              
              <div className="space-y-2" data-testid="reconstruction-stats">
                <div className="flex items-center gap-2">
                  <PuzzleIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Board Reconstruction</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Card className="bg-muted/30 border-0">
                    <CardContent className="p-3 text-center">
                      <p className={`text-xl font-bold ${reconstructionScore >= 80 ? 'text-green-500' : reconstructionScore >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
                        {reconstructionScore}%
                      </p>
                      <p className="text-xs text-muted-foreground">Accuracy</p>
                    </CardContent>
                  </Card>
                  
                  {reconstructionVoicePurity !== null && (
                    <Card className="bg-muted/30 border-0">
                      <CardContent className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1 mb-0.5">
                          <Mic className="h-3 w-3 text-purple-500" />
                          <p className={`text-xl font-bold ${reconstructionVoicePurity >= 80 ? 'text-purple-500' : reconstructionVoicePurity >= 50 ? 'text-amber-500' : 'text-muted-foreground'}`}>
                            {reconstructionVoicePurity}%
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground">Voice Purity</p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </>
          )}
          
          <Separator />
          
          {onAnalyze && (
            <Button
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              onClick={onAnalyze}
              data-testid="button-postmortem-analyze"
            >
              <Search className="mr-2 h-4 w-4" />
              Analyze Game
            </Button>
          )}
          
          <div className="flex gap-2">
            <Button
              className="flex-1 bg-black hover:bg-stone-800 text-white"
              onClick={onRematch}
              data-testid="button-postmortem-rematch"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Rematch
            </Button>
            <Button
              variant="outline"
              className="flex-1 bg-amber-400 hover:bg-amber-500 text-black border-black"
              onClick={onMainMenu}
              data-testid="button-postmortem-menu"
            >
              <Home className="mr-2 h-4 w-4" />
              Menu
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
