import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Trophy, Crown, Minus, Calendar, Clock, Search, ChevronLeft, Star } from "lucide-react";
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';
import { toggleFavorite, type SavedGame } from "@/lib/gameHistory";
import { useState, useEffect } from "react";

interface HistoryGameReportProps {
  game: SavedGame | null;
  open: boolean;
  onClose: () => void;
  onAnalyze: (moveHistory: string[]) => void;
}

function parsePgnToMoves(pgn: string): string[] {
  const moves: string[] = [];
  const regex = /\d+\.\s*(\S+)(?:\s+(\S+))?/g;
  let match;
  
  // Game result markers to exclude (not moves)
  const resultMarkers = ['1-0', '0-1', '1/2-1/2', '*'];
  
  while ((match = regex.exec(pgn)) !== null) {
    if (match[1] && !resultMarkers.includes(match[1])) {
      moves.push(match[1]);
    }
    if (match[2] && !resultMarkers.includes(match[2])) {
      moves.push(match[2]);
    }
  }
  
  return moves;
}

export function HistoryGameReport({ game, open, onClose, onAnalyze }: HistoryGameReportProps) {
  const [isFavorite, setIsFavorite] = useState(game?.isFavorite ?? false);
  
  useEffect(() => {
    if (game) {
      setIsFavorite(game.isFavorite);
    }
  }, [game]);
  
  if (!game || !open) return null;
  
  const resultIcon = game.result === 'win' 
    ? <Trophy className="h-10 w-10 text-amber-500" />
    : game.result === 'loss'
    ? <Crown className="h-10 w-10 text-stone-400" />
    : <Minus className="h-10 w-10 text-stone-500" />;
    
  const resultText = game.result === 'win' ? 'Victory' : game.result === 'loss' ? 'Defeat' : 'Draw';
  const resultColor = game.result === 'win' 
    ? 'text-green-600 dark:text-green-400' 
    : game.result === 'loss' 
    ? 'text-red-600 dark:text-red-400' 
    : 'text-muted-foreground';
  
  const formattedDate = new Date(game.date).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
  
  const formattedTime = new Date(game.date).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit'
  });
  
  const handleAnalyze = () => {
    const moves = parsePgnToMoves(game.pgn);
    onAnalyze(moves);
  };
  
  const handleToggleFavorite = async () => {
    if (Capacitor.isNativePlatform()) {
      await Haptics.impact({ style: ImpactStyle.Light });
    }
    const newState = await toggleFavorite(game.id);
    setIsFavorite(newState);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col" data-testid="history-game-report">
      <header className="flex items-center justify-between p-3 border-b border-border">
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          data-testid="button-history-report-back"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold">Game Details</h1>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleToggleFavorite}
          data-testid="button-history-report-favorite"
        >
          <Star className={`h-5 w-5 ${isFavorite ? 'fill-amber-400 text-amber-400' : ''}`} />
        </Button>
      </header>
      
      <div className="flex-1 p-4 overflow-auto">
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex flex-col items-center gap-3 py-4">
              {resultIcon}
              <h2 className={`text-3xl font-bold ${resultColor}`}>{resultText}</h2>
              <p className="text-lg">
                vs <span className="font-semibold">{game.botName}</span>
                <span className="text-muted-foreground ml-2">({game.botElo})</span>
              </p>
            </div>
            
            <Separator />
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>{formattedDate}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>{formattedTime}</span>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Played as</span>
                <div className="flex items-center gap-2 mt-1">
                  <div className={`w-4 h-4 rounded-full ${game.playerColor === 'white' ? 'bg-white border border-stone-400' : 'bg-black'}`} />
                  <span className="font-medium capitalize">{game.playerColor}</span>
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Moves</span>
                <p className="font-medium mt-1">{game.moveCount}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Time Control</span>
                <p className="font-medium mt-1">{game.timeControl}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Reconstruction Score</span>
                <p className="font-medium mt-1">{Math.round(game.clarityScore)}%</p>
              </div>
            </div>
            
            <Separator />
            
            <Button
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              onClick={handleAnalyze}
              data-testid="button-history-analyze"
            >
              <Search className="mr-2 h-4 w-4" />
              Analyze Game
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
