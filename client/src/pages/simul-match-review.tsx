import { useParams, useLocation } from "wouter";
import { Helmet } from "react-helmet-async";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  ArrowLeft, 
  BarChart3, 
  Crown, 
  Users, 
  Loader2,
  Trophy,
  Clock
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ChessBoard } from "@/components/chess-board";

interface MatchBoard {
  pairingId: string;
  gameId: string | null;
  boardNumber: number;
  color: 'white' | 'black';
  opponentName: string;
  opponentId: string | null;
  isOpponentBot: boolean;
  fen: string;
  moves: string[];
  moveCount: number;
  result: string;
}

interface MatchReviewData {
  matchId: string;
  status: string;
  boardCount: number;
  playerCount: number;
  boards: MatchBoard[];
  score: {
    wins: number;
    losses: number;
    draws: number;
  };
  playerName: string;
  createdAt: string;
  completedAt: string | null;
}

function getResultDisplay(result: string, playerColor: 'white' | 'black') {
  if (result === 'draw') {
    return { text: 'Draw', variant: 'secondary' as const };
  }
  if (result === 'white_win') {
    return playerColor === 'white' 
      ? { text: 'Win', variant: 'default' as const }
      : { text: 'Loss', variant: 'destructive' as const };
  }
  if (result === 'black_win') {
    return playerColor === 'black'
      ? { text: 'Win', variant: 'default' as const }
      : { text: 'Loss', variant: 'destructive' as const };
  }
  if (result === 'white_timeout') {
    return playerColor === 'white'
      ? { text: 'Timeout', variant: 'destructive' as const }
      : { text: 'Win', variant: 'default' as const };
  }
  if (result === 'black_timeout') {
    return playerColor === 'black'
      ? { text: 'Timeout', variant: 'destructive' as const }
      : { text: 'Win', variant: 'default' as const };
  }
  return null;
}

export default function SimulMatchReview() {
  const { matchId } = useParams<{ matchId: string }>();
  const [, setLocation] = useLocation();

  const { data, isLoading, error } = useQuery<MatchReviewData>({
    queryKey: ['/api/simul-vs-simul/match', matchId, 'review'],
    enabled: !!matchId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin" data-testid="loader-match-review" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container max-w-4xl mx-auto p-4">
        <Card>
          <CardContent className="p-8 text-center">
            <h2 className="text-xl font-bold mb-4">Match Not Found</h2>
            <p className="text-muted-foreground mb-4">
              Unable to load match data. The match may have been deleted or you may not have access.
            </p>
            <Button 
              onClick={() => setLocation('/history')}
              data-testid="button-back-history"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to History
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { boards, score, playerName, completedAt } = data;

  return (
    <div className="container max-w-6xl mx-auto p-4">
      <Helmet>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => setLocation('/history')}
            data-testid="button-back-history"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to History
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <Crown className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold" data-testid="text-match-title">
                Simul vs Simul Match Review
              </h1>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
              <div className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                <span>{data.playerCount} Players</span>
              </div>
              {completedAt && (
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  <span>{new Date(completedAt).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex items-center justify-center gap-8">
            <div className="text-center">
              <div className="flex items-center gap-2 justify-center mb-2">
                <Trophy className="h-6 w-6 text-primary" />
                <span className="text-lg font-semibold">{playerName}'s Results</span>
              </div>
              <div className="flex items-center gap-4 text-2xl font-bold">
                <span className="text-green-500" data-testid="text-wins">{score.wins}W</span>
                <span className="text-muted-foreground" data-testid="text-draws">{score.draws}D</span>
                <span className="text-red-500" data-testid="text-losses">{score.losses}L</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <h2 className="text-xl font-semibold mb-4">All Boards</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {boards.map((board, index) => {
          const resultDisplay = getResultDisplay(board.result, board.color);
          
          return (
            <Card 
              key={board.pairingId}
              className="overflow-hidden"
              data-testid={`card-board-${index}`}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono bg-muted px-2 py-0.5 rounded">
                      #{board.boardNumber}
                    </span>
                    <CardTitle className="text-base" data-testid={`text-opponent-${index}`}>
                      vs {board.opponentName}
                    </CardTitle>
                  </div>
                  <Badge variant={board.color === 'white' ? 'outline' : 'secondary'}>
                    {board.color}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="w-full aspect-square max-w-[200px] mx-auto">
                  <ChessBoard
                    fen={board.fen}
                    orientation={board.color}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {board.moveCount} moves
                  </span>
                  {resultDisplay && (
                    <Badge 
                      variant={resultDisplay.variant}
                      data-testid={`badge-result-${index}`}
                    >
                      {resultDisplay.text}
                    </Badge>
                  )}
                </div>

                {board.isOpponentBot && (
                  <Badge variant="outline" className="text-xs">
                    Bot Game (Unrated)
                  </Badge>
                )}

                {board.gameId ? (
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => setLocation(`/analysis/${board.gameId}?matchId=${matchId}`)}
                    data-testid={`button-analyze-${index}`}
                  >
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Analyze Game
                  </Button>
                ) : (
                  <Button
                    className="w-full"
                    variant="outline"
                    disabled
                    data-testid={`button-analyze-${index}-disabled`}
                  >
                    <BarChart3 className="h-4 w-4 mr-2" />
                    No Analysis Available
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="mt-6 flex justify-center">
        <Button
          variant="outline"
          onClick={() => setLocation('/simul-vs-simul')}
          data-testid="button-play-again"
        >
          Play Another Match
        </Button>
      </div>
    </div>
  );
}
