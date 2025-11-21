import { useState } from "react";
import { ChessBoard } from "@/components/chess-board";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, EyeOff, Mic, MicOff, Play, Volume2 } from "lucide-react";

export default function BlindfoldMode() {
  const [gameStarted, setGameStarted] = useState(false);
  const [peeksRemaining, setPeeksRemaining] = useState(3);
  const [boardHidden, setBoardHidden] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [level, setLevel] = useState("beginner");
  const [lastMove, setLastMove] = useState<string>("");

  const levelSettings = {
    beginner: { peeks: 5, description: "5 peeks · Voice hints enabled" },
    intermediate: { peeks: 3, description: "3 peeks · No hints" },
    advanced: { peeks: 1, description: "1 peek · Full blindfold" },
    expert: { peeks: 0, description: "0 peeks · Pure memory" },
  };

  const handlePeek = () => {
    if (peeksRemaining > 0) {
      setBoardHidden(false);
      setPeeksRemaining(peeksRemaining - 1);
      setTimeout(() => setBoardHidden(true), 3000);
    }
  };

  const handleStartGame = () => {
    setGameStarted(true);
    setBoardHidden(true);
    const initialPeeks = levelSettings[level as keyof typeof levelSettings].peeks;
    setPeeksRemaining(initialPeeks);
  };

  return (
    <div className="h-screen flex items-center justify-center p-8 bg-background">
      <div className="w-full max-w-5xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Blindfold Mode</h1>
            <p className="text-muted-foreground">Train your memory · Voice-controlled gameplay</p>
          </div>
          {gameStarted && (
            <div className="flex items-center gap-3">
              <Button
                variant={voiceEnabled ? "default" : "outline"}
                size="icon"
                onClick={() => setVoiceEnabled(!voiceEnabled)}
                data-testid="button-toggle-voice"
              >
                {voiceEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
              </Button>
              <Badge variant="secondary" className="text-base px-4 py-2">
                <Eye className="mr-2 h-4 w-4" />
                {peeksRemaining} peek{peeksRemaining !== 1 ? 's' : ''} remaining
              </Badge>
            </div>
          )}
        </div>

        {!gameStarted ? (
          <Card>
            <CardHeader>
              <CardTitle>Start Blindfold Training</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium">Difficulty Level</label>
                <Select value={level} onValueChange={setLevel}>
                  <SelectTrigger data-testid="select-difficulty">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">
                      <div className="flex flex-col items-start">
                        <span className="font-medium">Beginner</span>
                        <span className="text-xs text-muted-foreground">
                          {levelSettings.beginner.description}
                        </span>
                      </div>
                    </SelectItem>
                    <SelectItem value="intermediate">
                      <div className="flex flex-col items-start">
                        <span className="font-medium">Intermediate</span>
                        <span className="text-xs text-muted-foreground">
                          {levelSettings.intermediate.description}
                        </span>
                      </div>
                    </SelectItem>
                    <SelectItem value="advanced">
                      <div className="flex flex-col items-start">
                        <span className="font-medium">Advanced</span>
                        <span className="text-xs text-muted-foreground">
                          {levelSettings.advanced.description}
                        </span>
                      </div>
                    </SelectItem>
                    <SelectItem value="expert">
                      <div className="flex flex-col items-start">
                        <span className="font-medium">Expert</span>
                        <span className="text-xs text-muted-foreground">
                          {levelSettings.expert.description}
                        </span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="p-4 bg-muted rounded-lg space-y-2">
                <h4 className="font-semibold text-sm">Voice Commands</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• "Knight to f3" - Move piece</li>
                  <li>• "Castle kingside" - Special moves</li>
                  <li>• "Peek" - Use one peek</li>
                  <li>• "Last move" - Hear opponent's last move</li>
                </ul>
              </div>

              <Button onClick={handleStartGame} className="w-full" data-testid="button-start-blindfold">
                <Play className="mr-2 h-4 w-4" />
                Start Blindfold Training
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="relative">
              {boardHidden ? (
                <Card className="aspect-square flex items-center justify-center bg-black/90">
                  <div className="text-center space-y-4">
                    <EyeOff className="h-16 w-16 mx-auto text-white/50" />
                    <p className="text-white/70 text-lg">Board Hidden</p>
                    <p className="text-white/50 text-sm">Use your memory or peek to see the position</p>
                  </div>
                </Card>
              ) : (
                <div className="relative">
                  <ChessBoard orientation="white" showCoordinates={true} />
                  <div className="absolute inset-0 border-4 border-primary rounded-lg pointer-events-none" />
                </div>
              )}
            </div>

            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Game Controls</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button
                    onClick={handlePeek}
                    disabled={peeksRemaining === 0 || !boardHidden}
                    className="w-full"
                    size="lg"
                    data-testid="button-peek"
                  >
                    <Eye className="mr-2 h-5 w-5" />
                    {boardHidden ? "Use Peek" : "Peeking..."}
                    <span className="ml-auto text-sm">({peeksRemaining} left)</span>
                  </Button>

                  <div className="grid grid-cols-2 gap-3">
                    <Button variant="outline" data-testid="button-last-move">
                      <Volume2 className="mr-2 h-4 w-4" />
                      Last Move
                    </Button>
                    <Button variant="outline" data-testid="button-position">
                      <Volume2 className="mr-2 h-4 w-4" />
                      Read Position
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Move Input</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {voiceEnabled ? (
                    <div className="text-center py-8">
                      <div className="relative inline-block">
                        <Mic className="h-12 w-12 text-primary animate-pulse" />
                        <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
                      </div>
                      <p className="mt-4 text-sm text-muted-foreground">
                        Listening for voice command...
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <input
                        type="text"
                        placeholder="e.g., e4, Nf3, O-O"
                        className="w-full px-4 py-3 rounded-lg border bg-background font-mono"
                        data-testid="input-move"
                      />
                      <Button className="w-full" data-testid="button-submit-move">
                        Submit Move
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {lastMove && (
                <Card className="bg-muted">
                  <CardContent className="py-4">
                    <p className="text-sm text-muted-foreground mb-1">Opponent's last move:</p>
                    <p className="font-mono font-semibold text-lg">{lastMove}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
