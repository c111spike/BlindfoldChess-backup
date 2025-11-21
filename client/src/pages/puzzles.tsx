import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { ChessBoard } from "@/components/chess-board";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Brain, CheckCircle2, XCircle, SkipForward } from "lucide-react";
import type { Puzzle } from "@shared/schema";

export default function Puzzles() {
  const [currentPuzzle, setCurrentPuzzle] = useState<Puzzle | null>(null);
  const [solved, setSolved] = useState<boolean | null>(null);
  const [moveIndex, setMoveIndex] = useState(0);

  const { data: puzzle, isLoading } = useQuery<Puzzle>({
    queryKey: ["/api/puzzles/random"],
  });

  const handleSolve = () => {
    setSolved(true);
  };

  const handleSkip = () => {
    setSolved(null);
    setMoveIndex(0);
    queryClient.invalidateQueries({ queryKey: ["/api/puzzles/random"] });
  };

  return (
    <div className="h-screen flex items-center justify-center p-8 bg-muted/30">
      <div className="w-full max-w-5xl grid md:grid-cols-2 gap-8">
        <div className="space-y-4">
          {isLoading ? (
            <Skeleton className="aspect-square w-full" />
          ) : (
            <ChessBoard
              fen={puzzle?.fen || "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"}
              orientation="white"
              showCoordinates={true}
            />
          )}
          
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleSkip}
              data-testid="button-skip-puzzle"
            >
              <SkipForward className="mr-2 h-4 w-4" />
              Skip
            </Button>
            <Button
              className="flex-1"
              onClick={handleSolve}
              disabled={solved !== null}
              data-testid="button-check-solution"
            >
              {solved === null ? "Check Solution" : solved ? "Correct!" : "Try Again"}
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5" />
                  Puzzle Training
                </CardTitle>
                {puzzle?.rating && (
                  <Badge variant="secondary" className="font-mono">
                    {puzzle.rating}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ) : (
                <>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">
                      Find the best move
                    </p>
                    <p className="text-lg">
                      White to move and win
                    </p>
                  </div>

                  {puzzle?.themes && puzzle.themes.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-2">Themes</p>
                      <div className="flex flex-wrap gap-2">
                        {puzzle.themes.map((theme, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {theme}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {solved !== null && (
                    <div className={`p-4 rounded-lg border ${
                      solved 
                        ? "bg-green-500/10 border-green-500/20" 
                        : "bg-red-500/10 border-red-500/20"
                    }`}>
                      <div className="flex items-center gap-2 mb-2">
                        {solved ? (
                          <>
                            <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                            <p className="font-semibold text-green-600 dark:text-green-400">
                              Correct!
                            </p>
                          </>
                        ) : (
                          <>
                            <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                            <p className="font-semibold text-red-600 dark:text-red-400">
                              Not quite
                            </p>
                          </>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {solved 
                          ? "Excellent! You found the winning move." 
                          : "Keep trying or skip to the next puzzle."}
                      </p>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Your Progress</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold">0</p>
                  <p className="text-xs text-muted-foreground">Solved Today</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">0</p>
                  <p className="text-xs text-muted-foreground">Total Solved</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">0%</p>
                  <p className="text-xs text-muted-foreground">Success Rate</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="p-4 bg-muted rounded-lg">
            <h4 className="font-semibold text-sm mb-2">Puzzle Database</h4>
            <p className="text-sm text-muted-foreground">
              Puzzles sourced from Lichess's open database under CC0 license. 
              Millions of tactical puzzles rated from 600 to 3000.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
