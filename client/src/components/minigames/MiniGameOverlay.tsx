import { useState, lazy, Suspense } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { RotateCw, Crown, Target, X, Gamepad2 } from 'lucide-react';

const KnightsTourEmbed = lazy(() => import('./KnightsTourEmbed').then(m => ({ default: m.KnightsTourEmbed })));
const NPieceChallengeEmbed = lazy(() => import('./NPieceChallengeEmbed').then(m => ({ default: m.NPieceChallengeEmbed })));
const BoardSpinEmbed = lazy(() => import('./BoardSpinEmbed').then(m => ({ default: m.BoardSpinEmbed })));

type MiniGame = 'knights-tour' | 'n-piece' | 'board-spin' | null;

interface MiniGameOverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAnalysisComplete?: () => void;
}

const GAMES = [
  {
    id: 'knights-tour' as const,
    name: "Knight's Tour",
    description: "Visit every square with a knight",
    icon: Crown,
    color: "text-yellow-500",
  },
  {
    id: 'n-piece' as const,
    name: "N-Piece Challenge",
    description: "Place pieces without conflicts",
    icon: Target,
    color: "text-blue-500",
  },
  {
    id: 'board-spin' as const,
    name: "Board Spin",
    description: "Memorize and recreate positions",
    icon: RotateCw,
    color: "text-green-500",
  },
];

function GameSelector({ onSelect }: { onSelect: (game: MiniGame) => void }) {
  return (
    <div className="space-y-4 p-2">
      <div className="text-center mb-4">
        <Gamepad2 className="h-8 w-8 mx-auto text-primary mb-2" />
        <p className="text-sm text-muted-foreground">
          Analysis takes a few minutes. Play a quick game while you wait!
        </p>
      </div>
      
      <div className="grid gap-3">
        {GAMES.map((game) => (
          <Card
            key={game.id}
            className="cursor-pointer hover-elevate transition-all"
            onClick={() => onSelect(game.id)}
          >
            <CardContent className="p-4 flex items-center gap-4">
              <div className={`p-2 rounded-lg bg-muted ${game.color}`}>
                <game.icon className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">{game.name}</h3>
                <p className="text-sm text-muted-foreground">{game.description}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function GameLoading() {
  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-4">
      <Skeleton className="w-64 h-64 rounded-lg" />
      <Skeleton className="w-32 h-8" />
    </div>
  );
}

export function MiniGameOverlay({ open, onOpenChange, onAnalysisComplete }: MiniGameOverlayProps) {
  const [selectedGame, setSelectedGame] = useState<MiniGame>(null);
  
  const handleClose = () => {
    setSelectedGame(null);
    onOpenChange(false);
  };
  
  const handleBack = () => {
    setSelectedGame(null);
  };
  
  const getGameTitle = () => {
    if (!selectedGame) return "Play While You Wait";
    const game = GAMES.find(g => g.id === selectedGame);
    return game?.name || "Mini Game";
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              {selectedGame && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 mr-1"
                  onClick={handleBack}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
              {getGameTitle()}
            </DialogTitle>
          </div>
          {!selectedGame && (
            <DialogDescription>
              Choose a game to play while your analysis runs
            </DialogDescription>
          )}
        </DialogHeader>
        
        {!selectedGame ? (
          <GameSelector onSelect={setSelectedGame} />
        ) : (
          <Suspense fallback={<GameLoading />}>
            {selectedGame === 'knights-tour' && <KnightsTourEmbed onClose={handleBack} />}
            {selectedGame === 'n-piece' && <NPieceChallengeEmbed onClose={handleBack} />}
            {selectedGame === 'board-spin' && <BoardSpinEmbed onClose={handleBack} />}
          </Suspense>
        )}
      </DialogContent>
    </Dialog>
  );
}
