import { Link, useLocation } from "wouter";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SEOCrossLinks } from "@/components/seo-cross-links";
import { 
  BarChart3, 
  Brain, 
  Target, 
  Clock, 
  BookOpen, 
  Eye,
  Zap,
  AlertTriangle,
  TrendingUp,
  Puzzle,
  Book,
  GraduationCap,
  Play,
  ArrowLeft,
  Activity,
  Timer,
  Flame,
  Focus,
  Crosshair
} from "lucide-react";

export default function ChessGameReview() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Chess Game Review - Psychology-Based Analysis | SimulChess</title>
        <meta name="description" content="Go beyond engine scores. SimulChess Game Review analyzes your thinking patterns, focus, and VSS Mismatch to show you WHY you blundered, not just what you missed." />
        <meta property="og:title" content="Chess Game Review - Psychology-Based Analysis | SimulChess" />
        <meta property="og:description" content="Go beyond engine scores. SimulChess Game Review analyzes your thinking patterns, focus, and VSS Mismatch to show you WHY you blundered, not just what you missed." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://simulchess.com/chess-game-review" />
        <meta property="og:image" content="https://simulchess.com/og-review.png" />
        <link rel="canonical" href="https://simulchess.com/chess-game-review" />
      </Helmet>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-6">
          <Link href="/">
            <Button variant="ghost" size="sm" data-testid="button-back-home">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </Link>
        </div>

        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <BarChart3 className="h-10 w-10 text-primary" />
            <h1 className="text-3xl md:text-4xl font-bold">Game Review</h1>
          </div>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Go beyond engine scores. SimulChess Game Review analyzes your thinking patterns, focus, and VSS Mismatch to show you WHY you blundered, not just what you missed.
          </p>
        </div>

        <Card className="mb-8">
          <CardContent className="pt-6">
            <div className="grid md:grid-cols-3 gap-4 mb-6">
              <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                <Brain className="h-6 w-6 text-primary shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold">Psychology Analysis</h3>
                  <p className="text-sm text-muted-foreground">Understand your decision-making patterns</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                <Puzzle className="h-6 w-6 text-primary shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold">Training Integration</h3>
                  <p className="text-sm text-muted-foreground">Connect insights to puzzles and repertoire</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                <Eye className="h-6 w-6 text-primary shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold">Blindfold Tracking</h3>
                  <p className="text-sm text-muted-foreground">Monitor your visualization progress</p>
                </div>
              </div>
            </div>

            <div className="text-center">
              <Button 
                size="lg" 
                onClick={() => setLocation("/")}
                data-testid="button-start-review"
              >
                <BarChart3 className="mr-2 h-5 w-5" />
                Play a Game to Review
              </Button>
            </div>
          </CardContent>
        </Card>

        <article className="prose prose-neutral dark:prose-invert max-w-none">
          <h2 className="flex items-center gap-2 text-xl font-semibold mb-4">
            <Target className="h-5 w-5 text-primary" />
            Why Game Review Matters
          </h2>
          <p className="text-muted-foreground mb-6">
            Most chess analysis tools show you cold engine evaluations: "This move was a mistake, 
            here's the computer's preferred line." But that approach misses the most important question: 
            <strong> Why did you make that decision?</strong>
          </p>
          <p className="text-muted-foreground mb-6">
            SimulChess Game Review goes deeper. We analyze your <em>thinking patterns</em>, 
            not just your moves. By understanding the psychology behind your decisions—time pressure, 
            focus lapses, visualization gaps—you can make targeted improvements that actually stick.
          </p>
          <p className="text-muted-foreground mb-8">
            And because review is connected to the rest of SimulChess, you can immediately act on 
            what you learn: drill the repertoire line you forgot, practice the tactic you missed, 
            or replay critical positions to train your instincts.
          </p>

          <h2 className="flex items-center gap-2 text-xl font-semibold mb-4">
            <BarChart3 className="h-5 w-5 text-primary" />
            Two Powerful Analysis Modes
          </h2>
          <p className="text-muted-foreground mb-4">
            Game Review provides two complementary perspectives through a tabbed interface:
          </p>

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <div className="p-5 rounded-lg border">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="h-5 w-5 text-yellow-500" />
                <h3 className="font-semibold text-lg m-0">Analyze Tab</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                Engine-powered evaluation using Stockfish. Every move is classified:
              </p>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li><span className="text-purple-500 font-medium">Genius</span> — Found a brilliant move the engine didn't expect</li>
                <li><span className="text-blue-500 font-medium">Fantastic</span> — Found a great move in a complex position</li>
                <li><span className="text-green-500 font-medium">Best</span> — The engine's top choice</li>
                <li><span className="text-emerald-500 font-medium">Good</span> — Strong move, near-optimal</li>
                <li><span className="text-yellow-500 font-medium">Imprecise</span> — Slightly inaccurate</li>
                <li><span className="text-orange-500 font-medium">Mistake</span> — Cost significant advantage</li>
                <li><span className="text-red-500 font-medium">Blunder</span> — Major error</li>
              </ul>
              <p className="text-sm text-muted-foreground mt-3">
                Includes accuracy percentage and evaluation graph to track momentum.
              </p>
            </div>

            <div className="p-5 rounded-lg border">
              <div className="flex items-center gap-2 mb-3">
                <Brain className="h-5 w-5 text-purple-500" />
                <h3 className="font-semibold text-lg m-0">Review Tab</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                Psychology-focused coaching that analyzes <em>how</em> you think:
              </p>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li><strong>Focus Check</strong> — Measures decision consistency (0-100% with letter grade)</li>
                <li><strong>Efficiency Factor</strong> — Time spent vs. move quality (0-100% with letter grade)</li>
                <li><strong>Time Trouble</strong> — Detects when clock pressure hurt you</li>
                <li><strong>Burnout Detection</strong> — Identifies late-game fatigue patterns</li>
                <li><strong>VSS Mismatch</strong> — Spots visualization failures with replay</li>
                <li><strong>Repertoire Check</strong> — Shows opening deviations</li>
                <li><strong>Peek Statistics</strong> — Tracks blindfold training progress</li>
              </ul>
            </div>
          </div>

          <h2 className="flex items-center gap-2 text-xl font-semibold mb-4">
            <Activity className="h-5 w-5 text-primary" />
            Psychology Markers Explained
          </h2>

          <div className="space-y-6 mb-8">
            <div className="p-4 rounded-lg bg-muted/30 border-l-4 border-blue-500">
              <h3 className="font-semibold flex items-center gap-2 mb-2">
                <Crosshair className="h-4 w-4" />
                Focus Check (0-100%)
              </h3>
              <p className="text-sm text-muted-foreground">
                Measures your decision-making consistency throughout the game. High focus means 
                you're making deliberate decisions. Low focus suggests you might be on autopilot 
                or distracted. The score factors in move time variance, evaluation swings after 
                your moves, and pattern recognition.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-muted/30 border-l-4 border-green-500">
              <h3 className="font-semibold flex items-center gap-2 mb-2">
                <Timer className="h-4 w-4" />
                Efficiency Factor (0-100% with letter grade)
              </h3>
              <p className="text-sm text-muted-foreground">
                Compares time spent to move quality. A high score (A/B grade) means you're using your 
                time wisely—thinking longer leads to better moves. A score around 50% (C grade) means 
                neutral correlation. Low efficiency (D/F grade) might mean you're overthinking simple 
                moves or rushing complex ones.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-muted/30 border-l-4 border-orange-500">
              <h3 className="font-semibold flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4" />
                Time Trouble Detection
              </h3>
              <p className="text-sm text-muted-foreground">
                Identifies when low clock time correlated with mistakes. If you consistently 
                blunder under 2 minutes, this marker will flag it—helping you understand whether 
                time management is a skill to work on, or if you just need to play longer time controls.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-muted/30 border-l-4 border-red-500">
              <h3 className="font-semibold flex items-center gap-2 mb-2">
                <Flame className="h-4 w-4" />
                Burnout Detection
              </h3>
              <p className="text-sm text-muted-foreground">
                Looks for declining performance in the final third of the game. If your accuracy 
                drops significantly after move 30, it might indicate mental fatigue. This is 
                especially useful for tournament preparation—knowing your endurance limits helps 
                you train for longer games.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-muted/30 border-l-4 border-purple-500">
              <h3 className="font-semibold flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4" />
                VSS Mismatch Alerts
              </h3>
              <p className="text-sm text-muted-foreground mb-3">
                <strong>Visual-Spatial-Strategic Mismatch</strong> — Detects when you likely 
                miscalculated or mis-visualized the position. Maybe you missed that a piece was 
                defended, or didn't see a back-rank threat.
              </p>
              <p className="text-sm text-muted-foreground">
                <strong>Replay Feature:</strong> Each VSS mismatch is clickable. Jump to that 
                exact position and try to find the best move yourself. This turns analysis into 
                active training—you're not just reading what went wrong, you're practicing the 
                pattern until it clicks.
              </p>
            </div>
          </div>

          <h2 className="flex items-center gap-2 text-xl font-semibold mb-4">
            <Eye className="h-5 w-5 text-primary" />
            Blindfold Progress Tracking
          </h2>
          <p className="text-muted-foreground mb-4">
            When you play in Blindfold mode, Game Review tracks your visualization journey:
          </p>
          <div className="grid md:grid-cols-2 gap-4 mb-8">
            <div className="p-4 rounded-lg border">
              <h3 className="font-semibold mb-2">Peek Statistics</h3>
              <p className="text-sm text-muted-foreground">
                How often did you need to see the board? Which game phases were hardest? 
                The review shows your peek count, average peek duration, and which moves 
                triggered the most peeks—revealing exactly where your visualization breaks down.
              </p>
            </div>
            <div className="p-4 rounded-lg border">
              <h3 className="font-semibold mb-2">Visualization Zones</h3>
              <p className="text-sm text-muted-foreground">
                Identifies which squares or pieces you struggled to track. If you consistently 
                peek when there are knights in the center, that's a specific weakness to train. 
                Over time, you'll see these zones shrink as your visualization strengthens.
              </p>
            </div>
          </div>

          <h2 className="flex items-center gap-2 text-xl font-semibold mb-4">
            <Book className="h-5 w-5 text-primary" />
            Repertoire Integration
          </h2>
          <p className="text-muted-foreground mb-4">
            Game Review connects directly to your opening repertoire, showing exactly where 
            you deviated from your preparation:
          </p>
          <div className="p-5 rounded-lg border mb-6">
            <h3 className="font-semibold mb-3">When You Deviate from Your Repertoire</h3>
            <p className="text-sm text-muted-foreground mb-4">
              The review highlights every position where you played something different from 
              your prepared lines. But we don't just show you the deviation—we give you 
              <strong> instant action buttons</strong>:
            </p>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 mb-2">
                  <GraduationCap className="h-4 w-4 text-primary" />
                  <span className="font-medium">Drill Line</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  One click takes you to the Repertoire Trainer, starting from that exact 
                  position. Practice until the correct move is automatic.
                </p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 mb-2">
                  <BookOpen className="h-4 w-4 text-primary" />
                  <span className="font-medium">Add as Alternative</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  If your deviation was intentional—maybe you found a playable sideline—add 
                  it to your repertoire as an official alternative.
                </p>
              </div>
            </div>
          </div>

          <h2 className="flex items-center gap-2 text-xl font-semibold mb-4">
            <Puzzle className="h-5 w-5 text-primary" />
            Puzzle Integration
          </h2>
          <p className="text-muted-foreground mb-4">
            VSS Mismatch alerts don't just identify problems—they connect you to solutions:
          </p>
          <div className="p-5 rounded-lg border mb-8">
            <div className="flex items-center gap-2 mb-3">
              <Play className="h-5 w-5 text-green-500" />
              <h3 className="font-semibold m-0">Replay to Train</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              When the review identifies a VSS mismatch—a position where you miscalculated 
              or missed something—you can click to replay that moment. The board resets to 
              that position, and you try to find the best move.
            </p>
            <p className="text-sm text-muted-foreground">
              This transforms passive analysis into active pattern training. You're not just 
              reading "you should have played Nf6" — you're <em>experiencing</em> the position 
              until the pattern is burned into your chess intuition.
            </p>
          </div>

          <h2 className="flex items-center gap-2 text-xl font-semibold mb-4">
            <TrendingUp className="h-5 w-5 text-primary" />
            Thinking Time Analysis
          </h2>
          <p className="text-muted-foreground mb-4">
            Every move's thinking time is recorded, revealing patterns in your decision-making:
          </p>
          <ul className="text-muted-foreground space-y-2 mb-8">
            <li>
              <strong>Quick Blunders:</strong> Did you make mistakes when you moved too fast? 
              This might indicate overconfidence or pattern misfiring.
            </li>
            <li>
              <strong>Overthinking:</strong> Spending 3 minutes on obvious moves wastes clock 
              time you might need later. The review identifies these time sinks.
            </li>
            <li>
              <strong>Critical Moment Recognition:</strong> Did you speed up when you should 
              have slowed down? Knowing when to invest time is a trainable skill.
            </li>
          </ul>

          <h2 className="flex items-center gap-2 text-xl font-semibold mb-4">
            <Target className="h-5 w-5 text-primary" />
            The Living Organism Approach
          </h2>
          <p className="text-muted-foreground mb-6">
            We call SimulChess a "living organism" because every part connects. Game Review 
            isn't an isolated feature—it's the nervous system that links your games to your 
            training:
          </p>
          <ul className="text-muted-foreground space-y-2 mb-8">
            <li>Deviation in a game → Drill button → Repertoire Trainer</li>
            <li>Missed tactic → VSS Mismatch replay → Pattern training</li>
            <li>Blindfold peek → Visualization zone tracking → Targeted practice</li>
            <li>Time trouble errors → Focus on time management → Improved discipline</li>
          </ul>
          <p className="text-muted-foreground mb-8">
            Every game you play feeds back into your training, and every training session 
            improves your next game. That's how real improvement happens.
          </p>

          <div className="text-center mt-8 mb-8">
            <Button 
              size="lg" 
              className="w-full"
              onClick={() => setLocation("/")}
              data-testid="button-start-review-bottom"
            >
              <BarChart3 className="mr-2 h-5 w-5" />
              Start Playing to Unlock Review
            </Button>
          </div>

          <SEOCrossLinks currentPath="/chess-game-review" />
        </article>
      </div>
    </div>
  );
}
