import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ChevronLeft, Star, Trash2, Trophy, Crown, Minus, Calendar, Clock } from "lucide-react";
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';
import { 
  getAllGames, 
  getFavoriteGames, 
  toggleFavorite, 
  deleteGame, 
  type SavedGame 
} from "@/lib/gameHistory";

interface GameHistoryProps {
  onBack: () => void;
  onViewGame: (game: SavedGame) => void;
}

function GameCard({ 
  game, 
  onView, 
  onToggleFavorite,
  onDelete 
}: { 
  game: SavedGame;
  onView: () => void;
  onToggleFavorite: () => void;
  onDelete: () => void;
}) {
  const resultIcon = game.result === 'win' 
    ? <Trophy className="h-5 w-5 text-amber-500" />
    : game.result === 'loss'
    ? <Crown className="h-5 w-5 text-stone-400" />
    : <Minus className="h-5 w-5 text-stone-500" />;
    
  const resultText = game.result === 'win' ? 'Victory' : game.result === 'loss' ? 'Defeat' : 'Draw';
  const resultColor = game.result === 'win' ? 'text-green-600 dark:text-green-400' : game.result === 'loss' ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground';
  
  const formattedDate = new Date(game.date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
  
  const formattedTime = new Date(game.date).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit'
  });

  const handleFavoriteClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (Capacitor.isNativePlatform()) {
      await Haptics.impact({ style: ImpactStyle.Light });
    }
    onToggleFavorite();
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete();
  };

  return (
    <Card 
      className="cursor-pointer hover-elevate active-elevate-2 transition-all"
      onClick={onView}
      data-testid={`card-game-${game.id}`}
    >
      <CardContent className="p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex-shrink-0">
              {resultIcon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`font-semibold ${resultColor}`}>{resultText}</span>
                <span className="text-muted-foreground">vs</span>
                <span className="font-medium truncate">{game.botName}</span>
                <span className="text-sm text-muted-foreground">({game.botElo})</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formattedDate}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formattedTime}
                </span>
                <span>{game.moveCount} moves</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleFavoriteClick}
              data-testid={`button-favorite-${game.id}`}
            >
              <Star 
                className={`h-5 w-5 ${game.isFavorite ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground'}`} 
              />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDeleteClick}
              data-testid={`button-delete-${game.id}`}
            >
              <Trash2 className="h-5 w-5 text-muted-foreground hover:text-destructive" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function GameHistory({ onBack, onViewGame }: GameHistoryProps) {
  const [allGames, setAllGames] = useState<SavedGame[]>([]);
  const [favoriteGames, setFavoriteGames] = useState<SavedGame[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteConfirmGame, setDeleteConfirmGame] = useState<SavedGame | null>(null);
  const [activeTab, setActiveTab] = useState<string>("all");

  const loadGames = async () => {
    setIsLoading(true);
    const [all, favorites] = await Promise.all([
      getAllGames(),
      getFavoriteGames()
    ]);
    // Filter out 0-move games (cleanup for any existing ghost entries)
    setAllGames(all.filter(g => g.moveCount > 0));
    setFavoriteGames(favorites.filter(g => g.moveCount > 0));
    setIsLoading(false);
  };

  useEffect(() => {
    loadGames();
  }, []);

  const handleToggleFavorite = async (game: SavedGame) => {
    const newFavoriteState = await toggleFavorite(game.id);
    
    setAllGames(prev => prev.map(g => 
      g.id === game.id ? { ...g, isFavorite: newFavoriteState } : g
    ));
    
    if (newFavoriteState) {
      setFavoriteGames(prev => [{ ...game, isFavorite: true }, ...prev.filter(g => g.id !== game.id)]);
    } else {
      setFavoriteGames(prev => prev.filter(g => g.id !== game.id));
    }
  };

  const handleDeleteGame = async () => {
    if (!deleteConfirmGame) return;
    
    const success = await deleteGame(deleteConfirmGame.id);
    if (success) {
      setAllGames(prev => prev.filter(g => g.id !== deleteConfirmGame.id));
      setFavoriteGames(prev => prev.filter(g => g.id !== deleteConfirmGame.id));
    }
    setDeleteConfirmGame(null);
  };

  const currentGames = activeTab === "favorites" ? favoriteGames : allGames;

  return (
    <div className="min-h-screen bg-background flex flex-col" data-testid="game-history-page">
      <header className="flex items-center gap-2 p-3 border-b border-border">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          data-testid="button-history-back"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold">Game History</h1>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="px-3 pt-3">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="all" data-testid="tab-all-games">
              All Games ({allGames.length})
            </TabsTrigger>
            <TabsTrigger value="favorites" data-testid="tab-favorites">
              Favorites ({favoriteGames.length})
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value={activeTab} className="flex-1 mt-0 px-3 pb-3">
          <ScrollArea className="h-[calc(100vh-140px)]">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-pulse text-muted-foreground">Loading games...</div>
              </div>
            ) : currentGames.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="text-muted-foreground mb-2">
                  {activeTab === "favorites" ? "No favorite games yet" : "No games played yet"}
                </div>
                <div className="text-sm text-muted-foreground">
                  {activeTab === "favorites" 
                    ? "Star a game to add it to your favorites"
                    : "Complete a game to see it here"
                  }
                </div>
              </div>
            ) : (
              <div className="space-y-2 py-2">
                {currentGames.map(game => (
                  <GameCard
                    key={game.id}
                    game={game}
                    onView={() => onViewGame(game)}
                    onToggleFavorite={() => handleToggleFavorite(game)}
                    onDelete={() => setDeleteConfirmGame(game)}
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>

      <AlertDialog open={deleteConfirmGame !== null} onOpenChange={() => setDeleteConfirmGame(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this game from history?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The game record will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-delete-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteGame}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-delete-confirm"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
