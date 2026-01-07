import { useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Eye, Brain, Target, TrendingUp, TrendingDown, Mic, Hand, Clock, BookOpen, Trophy, AlertTriangle, Lightbulb, CheckCircle } from "lucide-react";
import type { GameStats, Insight } from "@/lib/gameStats";
import {
  loadStats,
  getPeekFreePercentage,
  getVoiceTouchRatio,
  getAverageResponseByPhase,
  getClarityByMoveCount,
  getVoiceCorrectionRate,
  getAverageBookDepth,
  getTierWinRate,
  formatResponseTime,
  formatPeekTime,
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

export function StatsDashboard({ stats }: StatsDashboardProps) {
  const insights = useMemo(() => generateInsights(stats), [stats]);
  const peekFreePercentage = getPeekFreePercentage(stats);
  const voiceTouchRatio = getVoiceTouchRatio(stats);
  const phaseResponse = getAverageResponseByPhase(stats);
  const clarityByMoves = getClarityByMoveCount(stats);
  const voiceCorrectionRate = getVoiceCorrectionRate(stats);
  const avgBookDepth = getAverageBookDepth(stats);
  const avgResponseTime = getAverageResponseTime(stats);
  
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
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground mb-3">
              Board reconstruction accuracy at different move counts
            </p>
            
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
            <p className="text-xs text-muted-foreground text-center mt-2">
              Voice input is a higher "purity" level of training
            </p>
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
          </CardHeader>
          <CardContent>
            <div className="text-center mb-4">
              <p className="text-3xl font-bold">{formatResponseTime(avgResponseTime)}</p>
              <p className="text-sm text-muted-foreground">Average time to make a move</p>
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
          </CardHeader>
          <CardContent>
            <div className="text-center">
              <p className={`text-3xl font-bold ${stats.lastGameEndgameDrift > 30 ? 'text-red-500' : 'text-green-500'}`}>
                {stats.lastGameEndgameDrift > 0 ? `+${stats.lastGameEndgameDrift}%` : "0%"}
              </p>
              <p className="text-sm text-muted-foreground">
                Response time change in endgame vs opening
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
          </CardHeader>
          <CardContent>
            <StatRow 
              label="Mental Blur Events" 
              value={stats.mentalBlurCount} 
              subValue="response time > 2x average"
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
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <p className="text-3xl font-bold text-amber-500">
                  {BOT_DIFFICULTY_ELO[stats.stockfishThreshold]}
                </p>
                <p className="text-sm text-muted-foreground">
                  Win rate drops below 50% at this level
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
              <BookOpen className="h-4 w-4" />
              Opening Mastery
            </CardTitle>
          </CardHeader>
          <CardContent>
            <StatRow 
              label="Average Book Depth" 
              value={avgBookDepth > 0 ? `${avgBookDepth} moves` : "-"} 
            />
            <StatRow 
              label="Deepest Book Line" 
              value={stats.deepestBookLine > 0 ? `${stats.deepestBookLine} moves` : "-"} 
            />
            <StatRow 
              label="Last Game" 
              value={stats.lastGameBookMoves > 0 ? `${stats.lastGameBookMoves} moves in book` : "-"} 
            />
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Win Rate by Tier</CardTitle>
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
