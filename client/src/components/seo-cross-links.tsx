import { Link } from "wouter";
import { Eye, Trophy, Grid3X3, Waypoints, Layers, Puzzle, RotateCw } from "lucide-react";

const trainingModes = [
  { path: "/blindfold-chess-training", name: "Blindfold Training", icon: Eye, description: "Visualization practice" },
  { path: "/otb-tournament-simulator", name: "OTB Simulator", icon: Trophy, description: "Tournament preparation" },
  { path: "/simul-chess-training", name: "Simul Training", icon: Grid3X3, description: "Multi-board practice" },
  { path: "/knights-tour-puzzle", name: "Knight's Tour", icon: Waypoints, description: "Classic puzzle" },
  { path: "/chess-piece-challenge", name: "N-Piece Challenge", icon: Layers, description: "Piece mastery" },
  { path: "/chess-puzzles-trainer", name: "Puzzles", icon: Puzzle, description: "Tactical training" },
  { path: "/chess-board-spin", name: "Board Spin", icon: RotateCw, description: "Memory game" },
];

interface SEOCrossLinksProps {
  currentPath: string;
}

export function SEOCrossLinks({ currentPath }: SEOCrossLinksProps) {
  const otherModes = trainingModes.filter(mode => mode.path !== currentPath);

  return (
    <div className="mt-12 pt-8 border-t">
      <h3 className="text-lg font-semibold mb-4">Explore More Training Modes</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {otherModes.map((mode) => (
          <Link 
            key={mode.path} 
            href={mode.path}
            className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 hover-elevate transition-colors"
            data-testid={`link-${mode.path.slice(1)}`}
          >
            <mode.icon className="h-4 w-4 text-primary shrink-0" />
            <div className="min-w-0">
              <div className="font-medium text-sm truncate">{mode.name}</div>
              <div className="text-xs text-muted-foreground truncate">{mode.description}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
