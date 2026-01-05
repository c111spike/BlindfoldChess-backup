import { Link, useLocation } from "wouter";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SEOCrossLinks } from "@/components/seo-cross-links";
import { Book, Database, RefreshCw, TrendingUp, Target, Brain, Play, CheckCircle, ArrowLeft } from "lucide-react";

export default function OpeningRepertoireTrainer() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Opening Repertoire Trainer - Build Your Chess Opening System | SimulChess</title>
        <meta name="description" content="Master your chess openings with the SimulChess Repertoire Trainer. Build a custom opening library, use spaced repetition drilling, and learn ECO-classified lines today!" />
        <meta property="og:title" content="Opening Repertoire Trainer - SimulChess" />
        <meta property="og:description" content="Master your chess openings with the SimulChess Repertoire Trainer. Build a custom opening library, use spaced repetition drilling, and learn ECO-classified lines today!" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://simulchess.com/opening-repertoire-trainer" />
        <meta property="og:image" content="https://simulchess.com/og-repertoire.png" />
        <link rel="canonical" href="https://simulchess.com/opening-repertoire-trainer" />
      </Helmet>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Book className="h-10 w-10 text-primary" />
            <h1 className="text-3xl md:text-4xl font-bold">Opening Repertoire Trainer</h1>
          </div>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Build, organize, and master your personal opening repertoire with intelligent drilling
          </p>
        </div>

        <Card className="mb-8">
          <CardContent className="pt-6">
            <div className="grid md:grid-cols-3 gap-4 mb-6">
              <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                <Database className="h-6 w-6 text-primary shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold">Opening Database</h3>
                  <p className="text-sm text-muted-foreground">ECO-classified openings library</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                <RefreshCw className="h-6 w-6 text-primary shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold">Spaced Repetition</h3>
                  <p className="text-sm text-muted-foreground">Smart review scheduling</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                <TrendingUp className="h-6 w-6 text-primary shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold">Progress Tracking</h3>
                  <p className="text-sm text-muted-foreground">Monitor your mastery level</p>
                </div>
              </div>
            </div>

            <div className="flex justify-center">
              <Button 
                size="lg" 
                onClick={() => setLocation("/signup")}
                data-testid="button-start-repertoire-training"
              >
                <Book className="mr-2 h-5 w-5" />
                Start Building Your Repertoire
              </Button>
            </div>
          </CardContent>
        </Card>

        <article className="prose dark:prose-invert max-w-none">
          <h2>Why Build a Chess Opening Repertoire?</h2>
          <p>
            A well-developed opening repertoire is one of the most valuable assets for any serious chess player. 
            Rather than memorizing random openings, a structured repertoire gives you confidence in the first 
            phase of the game and helps you reach positions you understand deeply.
          </p>

          <div className="not-prose grid md:grid-cols-2 gap-4 my-6">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <Target className="h-5 w-5 text-primary shrink-0 mt-1" />
                  <div>
                    <h4 className="font-semibold mb-1">Consistent Positions</h4>
                    <p className="text-sm text-muted-foreground">
                      Reach familiar middlegame positions where you know the plans and ideas
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <Brain className="h-5 w-5 text-primary shrink-0 mt-1" />
                  <div>
                    <h4 className="font-semibold mb-1">Deeper Understanding</h4>
                    <p className="text-sm text-muted-foreground">
                      Learn the strategic ideas behind your openings, not just the moves
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <Play className="h-5 w-5 text-primary shrink-0 mt-1" />
                  <div>
                    <h4 className="font-semibold mb-1">Time Advantage</h4>
                    <p className="text-sm text-muted-foreground">
                      Play prepared moves quickly while opponents think on the clock
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-primary shrink-0 mt-1" />
                  <div>
                    <h4 className="font-semibold mb-1">Reduced Anxiety</h4>
                    <p className="text-sm text-muted-foreground">
                      Start every game with confidence knowing your responses
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <h2>How SimulChess Repertoire Trainer Works</h2>
          
          <h3>1. Browse the Opening Database</h3>
          <p>
            Explore our comprehensive database of chess openings, organized by the ECO (Encyclopedia of 
            Chess Openings) classification system. Filter by ECO code (A-E), search by name, and 
            choose openings for White or Black.
          </p>

          <h3>2. Build Your Personal Repertoire</h3>
          <p>
            Create separate repertoires for White and Black. Add the openings and variations you want 
            to play. Customize your repertoire to match your playing style - whether you prefer sharp 
            tactical battles or solid positional play.
          </p>

          <h3>3. Train with Spaced Repetition</h3>
          <p>
            Our intelligent drilling system uses spaced repetition to ensure you remember your lines. 
            Lines you struggle with appear more frequently, while mastered variations are reviewed 
            less often. This optimizes your study time for maximum retention.
          </p>

          <h3>4. Track Your Progress</h3>
          <p>
            Monitor your mastery of each opening line. See which variations need more work and which 
            ones you've fully internalized. Practice history helps you understand your strengths and 
            areas for improvement.
          </p>

          <h2>Building an Effective Repertoire: Tips</h2>
          
          <h3>Start with What You Know</h3>
          <p>
            Begin by adding openings you already play. This gives you a foundation to build on and 
            lets you immediately benefit from structured training on familiar territory.
          </p>

          <h3>Learn the Ideas, Not Just Moves</h3>
          <p>
            Understanding why moves are played is more important than memorizing long lines. Our 
            opening database includes the key strategic ideas behind each variation, with lines 
            verified against master games and <strong>Stockfish engine analysis</strong> for theoretical accuracy.
          </p>

          <h3>Cover Main Lines First</h3>
          <p>
            Focus on the most common responses before diving into rare sidelines. You'll face the 
            main lines far more often in actual games, so prioritize those.
          </p>

          <h3>Practice Regularly</h3>
          <p>
            Consistent daily practice of 10-15 minutes is more effective than occasional marathon 
            sessions. Use the training mode regularly to keep your lines fresh.
          </p>

          <h3>Review Your Games</h3>
          <p>
            Our integrated{" "}
            <Link href="/chess-game-review" className="text-primary hover:underline">Game Review system</Link>{" "}
            tracks when you follow your repertoire lines and identifies where you deviate. After each 
            game, see how well you applied your opening preparation and discover which lines need more drilling.
          </p>

          <h2>The ECO Classification System</h2>
          <p>
            The Encyclopedia of Chess Openings (ECO) codes provide a standardized way to categorize 
            chess openings. The system uses letters A through E:
          </p>
          <ul>
            <li><strong>A:</strong> Flank openings (English, Reti, etc.)</li>
            <li><strong>B:</strong> Semi-open games except French (Sicilian, Caro-Kann, etc.)</li>
            <li><strong>C:</strong> Open games and French Defense (Italian, Spanish, etc.)</li>
            <li><strong>D:</strong> Closed games and Semi-Closed (Queen's Gambit, etc.)</li>
            <li><strong>E:</strong> Indian defenses (Nimzo-Indian, King's Indian, etc.)</li>
          </ul>

          <h3>Popular Openings Covered</h3>
          <p>
            Our database includes all major openings that players search for and study, including:
          </p>
          <ul>
            <li><strong>Sicilian Defense</strong> — The most popular response to 1.e4, with aggressive counterplay</li>
            <li><strong>Queen's Gambit</strong> — A classical opening that controls the center with d4 and c4</li>
            <li><strong>King's Indian Defense</strong> — A hypermodern setup with dynamic attacking chances</li>
            <li><strong>Italian Game</strong> — A solid opening emphasizing piece development and center control</li>
            <li><strong>Caro-Kann Defense</strong> — A reliable, solid choice against 1.e4</li>
            <li><strong>French Defense</strong> — A strategic opening with characteristic pawn structures</li>
            <li><strong>Ruy Lopez (Spanish Opening)</strong> — One of the oldest and most respected openings</li>
            <li><strong>London System</strong> — A universal system for White with easy-to-learn plans</li>
          </ul>

          <div className="flex justify-center my-8">
            <Button 
              size="lg" 
              onClick={() => setLocation("/signup")}
              data-testid="button-start-repertoire-training-bottom"
            >
              <Book className="mr-2 h-5 w-5" />
              Start Building Your Repertoire
            </Button>
          </div>

          <SEOCrossLinks currentPath="/opening-repertoire-trainer" />
        </article>
      </div>
    </div>
  );
}
