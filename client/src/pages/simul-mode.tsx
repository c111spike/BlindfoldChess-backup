import { useState } from "react";
import { ChessBoard } from "@/components/chess-board";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Play, Clock, Trophy } from "lucide-react";

interface SimulBoard {
  id: string;
  opponent: string;
  fen: string;
  material: number;
  timeRemaining: number;
  isActive: boolean;
  result?: "win" | "loss" | "draw";
}

export default function SimulMode() {
  const [gameStarted, setGameStarted] = useState(false);
  const [boardCount, setBoardCount] = useState("4");
  const [activeBoard, setActiveBoard] = useState(0);
  const [boards, setBoards] = useState<SimulBoard[]>([]);

  const handleStartSimul = () => {
    const count = parseInt(boardCount);
    const newBoards: SimulBoard[] = Array.from({ length: count }, (_, i) => ({
      id: `board-${i}`,
      opponent: `Opponent ${i + 1}`,
      fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      material: 0,
      timeRemaining: 600,
      isActive: i === 0,
    }));
    setBoards(newBoards);
    setGameStarted(true);
    setActiveBoard(0);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getMaterialDisplay = (material: number) => {
    if (material === 0) return "=";
    return material > 0 ? `+${material}` : `${material}`;
  };

  return (
    <div className="h-screen flex">
      {gameStarted && (
        <div className="w-80 border-r bg-card flex flex-col">
          <div className="p-4 border-b space-y-3">
            <h3 className="font-semibold">Simul Boards ({boards.length})</h3>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Trophy className="h-4 w-4" />
              <span>
                {boards.filter(b => b.result === "win").length}W · 
                {boards.filter(b => b.result === "loss").length}L · 
                {boards.filter(b => b.result === "draw").length}D
              </span>
            </div>
          </div>
          
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-2">
              {boards.map((board, index) => (
                <Card
                  key={board.id}
                  className={`cursor-pointer ${
                    activeBoard === index ? "border-primary ring-2 ring-primary/20" : ""
                  } ${board.isActive ? "bg-primary/5" : ""}`}
                  onClick={() => setActiveBoard(index)}
                  data-testid={`board-item-${index}`}
                >
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{board.opponent}</span>
                      {board.result && (
                        <Badge 
                          variant={
                            board.result === "win" ? "default" : 
                            board.result === "draw" ? "secondary" : 
                            "destructive"
                          }
                          className="text-xs"
                        >
                          {board.result.toUpperCase()}
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <span className={`font-mono font-semibold ${
                        board.material > 0 ? "text-green-600 dark:text-green-400" :
                        board.material < 0 ? "text-red-600 dark:text-red-400" :
                        "text-muted-foreground"
                      }`}>
                        {getMaterialDisplay(board.material)}
                      </span>
                      <span className="font-mono text-muted-foreground">
                        {formatTime(board.timeRemaining)}
                      </span>
                    </div>

                    {board.isActive && (
                      <div className="pt-2 border-t">
                        <div className="flex items-center gap-2 text-xs text-primary">
                          <Clock className="h-3 w-3 animate-pulse" />
                          <span>Clock running</span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>

          <div className="p-4 border-t">
            <div className="text-xs text-muted-foreground mb-2">
              FIFO Order: Clock runs only on active board
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 flex items-center justify-center p-8 bg-muted/30">
        {!gameStarted ? (
          <Card className="w-full max-w-md">
            <CardContent className="pt-6 space-y-6">
              <div>
                <h2 className="text-2xl font-bold mb-2">Start Simultaneous Exhibition</h2>
                <p className="text-muted-foreground">
                  Play multiple opponents with revolutionary per-move clock system
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Number of Boards</label>
                <Select value={boardCount} onValueChange={setBoardCount}>
                  <SelectTrigger data-testid="select-board-count">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2">2 boards (Beginner)</SelectItem>
                    <SelectItem value="4">4 boards (Intermediate)</SelectItem>
                    <SelectItem value="8">8 boards (Advanced)</SelectItem>
                    <SelectItem value="12">12 boards (Expert)</SelectItem>
                    <SelectItem value="16">16 boards (Master)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="p-4 bg-muted rounded-lg space-y-2">
                <h4 className="font-semibold text-sm">Per-Move Clock System</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Clock runs ONLY when viewing a board</li>
                  <li>• Switch boards freely without time pressure</li>
                  <li>• Make move → auto-switch to next board (FIFO)</li>
                  <li>• Enables stress-free 100+ board simuls</li>
                </ul>
              </div>

              <Button onClick={handleStartSimul} className="w-full" size="lg" data-testid="button-start-simul">
                <Play className="mr-2 h-4 w-4" />
                Start Simultaneous Exhibition
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="w-full max-w-3xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">
                  {boards[activeBoard]?.opponent || "Board"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Board {activeBoard + 1} of {boards.length}
                </p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-mono font-bold">
                  {formatTime(boards[activeBoard]?.timeRemaining || 0)}
                </div>
                <div className={`text-sm font-mono font-semibold ${
                  (boards[activeBoard]?.material || 0) > 0 ? "text-green-600 dark:text-green-400" :
                  (boards[activeBoard]?.material || 0) < 0 ? "text-red-600 dark:text-red-400" :
                  "text-muted-foreground"
                }`}>
                  Material: {getMaterialDisplay(boards[activeBoard]?.material || 0)}
                </div>
              </div>
            </div>

            <ChessBoard
              fen={boards[activeBoard]?.fen}
              orientation="white"
              showCoordinates={true}
            />

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                disabled={activeBoard === 0}
                onClick={() => setActiveBoard(activeBoard - 1)}
                data-testid="button-prev-board"
              >
                ← Previous Board
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                disabled={activeBoard === boards.length - 1}
                onClick={() => setActiveBoard(activeBoard + 1)}
                data-testid="button-next-board"
              >
                Next Board →
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
