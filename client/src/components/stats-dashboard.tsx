import { useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Eye, Brain, Target, TrendingUp, TrendingDown, Mic, Hand, Clock, Grid3X3, Trophy, AlertTriangle, Lightbulb, CheckCircle } from "lucide-react";
import type { GameStats, Insight } from "@/lib/gameStats";
import {
  getPeekFreePercentage,
  getVoiceTouchRatio,
  getAverageResponseByPhase,
  getClarityByMoveCount,
  getVoiceCorrectionRate,
  getSquareHeatIntensity,
  getTopConfusedSquares,
  getTierWinRate,
  formatResponseTime,
  getAverageResponseTime,
  generateInsights,
  DIFFICULTY_TIERS,
} from "@/lib/gameStats";
import { BOT_DIFFICULTY_ELO, BOT_DIFFICULTY_NAMES } from "@shared/botTypes";

interface StatsDashboardProps {
  stats: GameStats;
}

function InsightCard({ insight }: { insight: Insight }) {
  const icons = {
    info: <Lightbulb className="h-4 w-4" />,
    warning: <AlertTriangle className="h-4 w-4" />,
    success: <CheckCircle className="h-4 w-4" />,
    tip: <Lightbulb className="h-4 w-4" />,
  };
  
  const colors = {
    info: "text-blue-500",
    warning: "text-amber-500",
    success: "text-green-500",
    tip: "text-purple-500",
  };
  
  return (
    <div className="flex gap-3 p-3 rounded-md bg-muted/50">
      <div className={colors[insight.type]}>
        {icons[insight.type]}
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium">{insight.title}</p>
        <p className="text-xs text-muted-foreground">{insight.message}</p>
      </div>
    </div>
  );
}

function StatRow({ label, value, subValue }: { label: string; value: string | number; subValue?: string }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="text-right">
        <span className="font-medium">{value}</span>
        {subValue && <span className="text-xs text-muted-foreground ml-2">{subValue}</span>}
      </div>
    </div>
  );
}

// 8x8 Coordinate Heatmap component
function CoordinateHeatmap({ stats }: { stats: GameStats }) {
  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];
  
  const getHeatColor = (intensity: number): string => {
    if (intensity === 0) return 'bg-muted/30';
    if (intensity < 25) return 'bg-amber-200 dark:bg-amber-900/40';
    if (intensity < 50) return 'bg-amber-400 dark:bg-amber-700/60';
    if (intensity < 75) return 'bg-red-400 dark:bg-red-700/70';
    return 'bg-red-600 dark:bg-red-600/80';
  };
  
  return (
    <div className="grid grid-cols-8 gap-0.5 aspect-square max-w-[200px] mx-auto">
      {ranks.map(rank => 
        files.map(file => {
          const square = `${file}${rank}`;
          const intensity = getSquareHeatIntensity(stats, square);
          return (
            <div
              key={square}
              className={`aspect-square ${getHeatColor(intensity)} rounded-sm flex items-center justify-center`}
              title={`${square.toUpperCase()}: ${stats.squareInquiryHeatmap[square] || 0} inquiries`}
            >
              {intensity > 50 && (
                <span className="text-[6px] text-white font-bold">{square}</span>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

export function StatsDashboard({ stats }: StatsDashboardProps) {
  const insights = useMemo(() => generateInsights(stats), [stats]);
  const peekFreePercentage = getPeekFreePercentage(stats);
  const voiceTouchRatio = getVoiceTouchRatio(stats);
  const phaseResponse = getAverageResponseByPhase(stats);
  const clarityByMoves = getClarityByMoveCount(stats);
  const voiceCorrectionRate = getVoiceCorrectionRate(stats);
  const avgResponseTime = getAverageResponseTime(stats);
  const topConfused = getTopConfusedSquares(stats, 5);
  
  const visualizationInsights = insights.filter(i => i.category === 'visualization');
  const cognitiveInsights = insights.filter(i => i.category === 'cognitive');
  const tacticalInsights = insights.filter(i => i.category === 'tactical');
  
  return (
    <Tabs defaultValue="visualization" className="w-full">
      <TabsList className="grid w-full grid-cols-3 mb-4">
        <TabsTrigger value="visualization" className="flex items-center gap-1 text-xs">
          <Eye className="h-3 w-3" />
          <span className="hidden sm:inline">Visualization</span>
        </TabsTrigger>
        <TabsTrigger value="cognitive" className="flex items-center gap-1 text-xs">
          <Brain className="h-3 w-3" />
          <span className="hidden sm:inline">Cognitive</span>
        </TabsTrigger>
        <TabsTrigger value="tactical" className="flex items-center gap-1 text-xs">
          <Target className="h-3 w-3" />
          <span className="hidden sm:inline">Tactical</span>
        </TabsTrigger>
      </TabsList>
      
      <TabsContent value="visualization" className="space-y-4 max-h-[60vh] overflow-y-auto">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-500" />
              Visualization Ceiling
            </CardTitle>
            <CardDescription className="text-xs">
              The strongest opponent you've beaten without peeking at the board
            </CardDescription>
          </CardHeader>
          <CardContent>
            {stats.visualizationCeiling > 0 ? (
              <div className="text-center">
                <p className="text-3xl font-bold text-amber-500">{stats.visualizationCeiling}</p>
                <p className="text-sm text-muted-foreground">
                  Highest Elo beaten without peeking
                </p>
                {stats.visualizationCeilingTier && (
                  <Badge variant="outline" className="mt-2">
                    {BOT_DIFFICULTY_NAMES[stats.visualizationCeilingTier]}
                  </Badge>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                Beat a bot without peeking to set your ceiling!
              </p>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Peek-Free Progress</CardTitle>
            <CardDescription className="text-xs">
              How often you complete games without looking at the board
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{peekFreePercentage}%</span>
              <span className="text-sm text-muted-foreground">
                {stats.totalPeekFreeGames} of {stats.totalGamesPlayed} games
              </span>
            </div>
            <Progress value={peekFreePercentage} className="h-2" />
            
            <Separator />
            
            <StatRow 
              label="Best Peek-Free Streak" 
              value={`${stats.bestPeekFreeGameStreak} games`} 
            />
            <StatRow 
              label="Best Peek-Free Moves" 
              value={stats.bestPeekFreeStreak} 
              subValue="in a single game"
            />
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Clarity by Game Length</CardTitle>
            <CardDescription className="text-xs">
              How well you remember the board position as games get longer
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            
            <div className="space-y-2">
              {[
                { label: "≤10 moves", value: clarityByMoves.moves10 },
                { label: "11-20 moves", value: clarityByMoves.moves20 },
                { label: "21-30 moves", value: clarityByMoves.moves30 },
                { label: "31-40 moves", value: clarityByMoves.moves40 },
                { label: "40+ moves", value: clarityByMoves.moves50plus },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-20">{label}</span>
                  <Progress value={value} className="flex-1 h-2" />
                  <span className="text-xs font-medium w-10 text-right">
                    {value > 0 ? `${value}%` : "-"}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              Voice vs Touch
              <Badge variant="secondary" className="text-xs">Reconstruction</Badge>
            </CardTitle>
            <CardDescription className="text-xs">
              Voice-only reconstruction is "pure" blindfold training
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Mic className="h-4 w-4 text-blue-500" />
                <span className="font-medium">{voiceTouchRatio.voice}%</span>
              </div>
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500" 
                  style={{ width: `${voiceTouchRatio.voice}%` }} 
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{voiceTouchRatio.touch}%</span>
                <Hand className="h-4 w-4 text-orange-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        {visualizationInsights.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Insights</h4>
            {visualizationInsights.map((insight, i) => (
              <InsightCard key={i} insight={insight} />
            ))}
          </div>
        )}
      </TabsContent>
      
      <TabsContent value="cognitive" className="space-y-4 max-h-[60vh] overflow-y-auto">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Mean Response Time
            </CardTitle>
            <CardDescription className="text-xs">
              How quickly you find moves - faster often means clearer visualization
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center mb-4">
              <p className="text-3xl font-bold">{formatResponseTime(avgResponseTime)}</p>
            </div>
            
            <Separator className="my-4" />
            
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground">By Game Phase</p>
              <StatRow 
                label="Opening (moves 1-10)" 
                value={formatResponseTime(phaseResponse.opening)} 
              />
              <StatRow 
                label="Middlegame (moves 11-30)" 
                value={formatResponseTime(phaseResponse.middlegame)} 
              />
              <StatRow 
                label="Endgame (moves 31+)" 
                value={formatResponseTime(phaseResponse.endgame)} 
              />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              Endgame Drift
              {stats.lastGameEndgameDrift > 30 ? (
                <TrendingDown className="h-4 w-4 text-red-500" />
              ) : (
                <TrendingUp className="h-4 w-4 text-green-500" />
              )}
            </CardTitle>
            <CardDescription className="text-xs">
              Slowing down late-game may indicate "mental blur" from fewer pieces
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center">
              <p className={`text-3xl font-bold ${stats.lastGameEndgameDrift > 30 ? 'text-red-500' : 'text-green-500'}`}>
                {stats.lastGameEndgameDrift > 0 ? `+${stats.lastGameEndgameDrift}%` : "0%"}
              </p>
            </div>
            {stats.lastGameEndgameDrift > 50 && (
              <p className="text-xs text-amber-500 text-center mt-3">
                High drift may indicate "mental blur" - difficulty tracking fewer pieces
              </p>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Voice Accuracy</CardTitle>
            <CardDescription className="text-xs">
              How often your voice commands are understood correctly
            </CardDescription>
          </CardHeader>
          <CardContent>
            <StatRow 
              label="Total Voice Commands" 
              value={stats.voiceCommandsTotal} 
            />
            <StatRow 
              label="Corrections Needed" 
              value={stats.voiceCorrections} 
            />
            <StatRow 
              label="Correction Rate" 
              value={`${voiceCorrectionRate}%`} 
            />
            <StatRow 
              label="Last Game Corrections" 
              value={stats.lastGameVoiceCorrections} 
            />
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Mental Clarity</CardTitle>
            <CardDescription className="text-xs">
              Moments when you took much longer than usual - may indicate confusion
            </CardDescription>
          </CardHeader>
          <CardContent>
            <StatRow 
              label="Mental Blur Events" 
              value={stats.mentalBlurCount} 
            />
          </CardContent>
        </Card>
        
        {cognitiveInsights.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Insights</h4>
            {cognitiveInsights.map((insight, i) => (
              <InsightCard key={i} insight={insight} />
            ))}
          </div>
        )}
      </TabsContent>
      
      <TabsContent value="tactical" className="space-y-4 max-h-[60vh] overflow-y-auto">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Overall Record</CardTitle>
            <CardDescription className="text-xs">
              Your wins, draws, and losses across all games
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="space-y-1">
                <p className="text-2xl font-bold text-green-600">{stats.wins}</p>
                <p className="text-xs text-muted-foreground">Wins</p>
              </div>
              <div className="space-y-1">
                <p className="text-2xl font-bold text-gray-500">{stats.draws}</p>
                <p className="text-xs text-muted-foreground">Draws</p>
              </div>
              <div className="space-y-1">
                <p className="text-2xl font-bold text-red-600">{stats.losses}</p>
                <p className="text-xs text-muted-foreground">Losses</p>
              </div>
            </div>
            
            <Separator className="my-4" />
            
            <StatRow label="Current Win Streak" value={stats.currentWinStreak} />
            <StatRow label="Best Win Streak" value={stats.bestWinStreak} />
            <StatRow label="Fastest Win" value={stats.fastestWin > 0 ? `${stats.fastestWin} moves` : "-"} />
            <StatRow label="Longest Game" value={stats.longestGame > 0 ? `${stats.longestGame} moves` : "-"} />
          </CardContent>
        </Card>
        
        {stats.stockfishThreshold && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Target className="h-4 w-4 text-amber-500" />
                Stockfish Threshold
              </CardTitle>
              <CardDescription className="text-xs">
                The difficulty level where your win rate starts dropping
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <p className="text-3xl font-bold text-amber-500">
                  {BOT_DIFFICULTY_ELO[stats.stockfishThreshold]}
                </p>
                <Badge variant="outline" className="mt-2">
                  {BOT_DIFFICULTY_NAMES[stats.stockfishThreshold]}
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Grid3X3 className="h-4 w-4" />
              Confusion Heatmap
            </CardTitle>
            <CardDescription className="text-xs">
              Squares you inquire about most often - your mental "blind spots"
            </CardDescription>
          </CardHeader>
          <CardContent>
            {stats.totalSquareInquiries > 0 ? (
              <>
                <CoordinateHeatmap stats={stats} />
                <p className="text-xs text-muted-foreground text-center mt-3">
                  Red = frequently forgotten, Gray = clear
                </p>
                {topConfused.length > 0 && (
                  <div className="mt-4 space-y-1">
                    <p className="text-xs font-medium">Top Blind Spots:</p>
                    <div className="flex flex-wrap gap-1">
                      {topConfused.map(({ square, count }) => (
                        <Badge key={square} variant="secondary" className="text-xs">
                          {square.toUpperCase()} ({count})
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                Ask about squares during games to see which ones you forget!
              </p>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Win Rate by Tier</CardTitle>
            <CardDescription className="text-xs">
              Your success rate at each difficulty level
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {DIFFICULTY_TIERS.map(tier => {
                const tierStat = stats.tierStats[tier];
                const winRate = getTierWinRate(stats, tier);
                const games = tierStat?.totalGames || 0;
                
                if (games === 0) return null;
                
                return (
                  <div key={tier} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-24 truncate">
                      {BOT_DIFFICULTY_NAMES[tier]}
                    </span>
                    <Progress 
                      value={winRate} 
                      className="flex-1 h-2" 
                    />
                    <span className="text-xs font-medium w-16 text-right">
                      {winRate}% ({games}g)
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
        
        {tacticalInsights.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Insights</h4>
            {tacticalInsights.map((insight, i) => (
              <InsightCard key={i} insight={insight} />
            ))}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
