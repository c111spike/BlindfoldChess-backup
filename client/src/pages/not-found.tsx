import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Home, RotateCw, Sparkles } from "lucide-react";
import { useLocation } from "wouter";
import { Helmet } from "react-helmet-async";
import { BoardSpinEmbed } from "@/components/minigames/BoardSpinEmbed";
import { motion, AnimatePresence } from "framer-motion";

function getEncouragementMessage(accuracy: number): string {
  if (accuracy === 100) return "Nice focus!";
  if (accuracy >= 67) return "Good job!";
  if (accuracy >= 34) return "Not bad!";
  return "Nice try!";
}

export default function NotFound() {
  const [, setLocation] = useLocation();
  const [hasPlayed, setHasPlayed] = useState(false);
  const [showGame, setShowGame] = useState(false);
  const [lastAccuracy, setLastAccuracy] = useState(0);

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
      <Helmet>
        <title>404 - Page Not Found | SimulChess</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      
      <div className="w-full max-w-md space-y-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="p-4 rounded-full bg-blue-500/10">
                <RotateCw className="h-12 w-12 text-blue-500" />
              </div>
              <div>
                <h1 className="text-3xl font-bold mb-2" data-testid="text-404-title">404</h1>
                <h2 className="text-xl font-semibold text-muted-foreground mb-2" data-testid="text-404-subtitle">
                  We've Spun Off Course!
                </h2>
                <p className="text-sm text-muted-foreground mb-4" data-testid="text-404-description">
                  This page doesn't exist, but why waste the visit? 
                  Test your memory with a quick Board Spin challenge!
                </p>
              </div>

              {!showGame && (
                <div className="flex flex-col gap-2 w-full">
                  <Button 
                    onClick={() => setShowGame(true)}
                    variant="default"
                    className="gap-2 w-full"
                    size="lg"
                    data-testid="button-play-board-spin"
                  >
                    <RotateCw className="h-4 w-4" />
                    Play Board Spin
                  </Button>
                  <Button 
                    onClick={() => setLocation("/")} 
                    variant="outline"
                    className="gap-2 w-full"
                    data-testid="button-return-home"
                  >
                    <Home className="h-4 w-4" />
                    Return to SimulChess
                  </Button>
                </div>
              )}

              <AnimatePresence>
                {hasPlayed && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full p-4 rounded-lg bg-green-500/10 border border-green-500/30"
                  >
                    <div className="flex items-center justify-center gap-2 text-green-600 dark:text-green-400 font-medium mb-3">
                      <Sparkles className="h-4 w-4" />
                      {getEncouragementMessage(lastAccuracy)} Ready for more training?
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <Button 
                      onClick={() => setLocation("/")} 
                      className="gap-2 w-full"
                      size="lg"
                      data-testid="button-return-home-reward"
                    >
                      <Home className="h-4 w-4" />
                      Let's Go!
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </CardContent>
        </Card>

        <AnimatePresence>
          {showGame && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <Card>
                <CardContent className="p-2 sm:p-4">
                  <BoardSpinEmbed 
                    onClose={() => setShowGame(false)}
                    onGameComplete={(accuracy) => {
                      setLastAccuracy(accuracy);
                      setHasPlayed(true);
                    }}
                  />
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
