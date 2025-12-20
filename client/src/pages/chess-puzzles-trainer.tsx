import { useLocation } from "wouter";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SEOCrossLinks } from "@/components/seo-cross-links";
import { Puzzle, Brain, Trophy, Users, BookOpen, Target, Lightbulb } from "lucide-react";

export default function ChessPuzzlesTrainer() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Chess Puzzles Trainer - Tactical Training | SimulChess</title>
        <meta name="description" content="Master chess tactics with SimulChess. Solve a huge variety of community-rated puzzles, from beginner forks to master combinations. Start your training now!" />
        <meta property="og:title" content="Chess Puzzles Trainer - SimulChess" />
        <meta property="og:description" content="Master chess tactics with SimulChess. Solve a huge variety of community-rated puzzles, from beginner forks to master combinations." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://simulchess.com/chess-puzzles-trainer" />
        <meta property="og:image" content="https://simulchess.com/og-puzzles.png" />
        <link rel="canonical" href="https://simulchess.com/chess-puzzles-trainer" />
      </Helmet>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Puzzle className="h-10 w-10 text-primary" />
            <h1 className="text-3xl md:text-4xl font-bold">Chess Puzzles Trainer</h1>
          </div>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Sharpen your tactical vision with daily puzzles from our community
          </p>
        </div>

        <Card className="mb-8">
          <CardContent className="pt-6">
            <div className="grid md:grid-cols-3 gap-4 mb-6">
              <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                <Target className="h-6 w-6 text-primary shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold">Pattern Training</h3>
                  <p className="text-sm text-muted-foreground">Recognize tactical motifs instantly</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                <Users className="h-6 w-6 text-primary shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold">Community Puzzles</h3>
                  <p className="text-sm text-muted-foreground">Create and share your own</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                <Trophy className="h-6 w-6 text-primary shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold">Difficulty Levels</h3>
                  <p className="text-sm text-muted-foreground">From beginner to master</p>
                </div>
              </div>
            </div>

            <Button 
              size="lg" 
              className="w-full"
              onClick={() => setLocation("/puzzles")}
              data-testid="button-start-puzzles"
            >
              <Puzzle className="mr-2 h-5 w-5" />
              Start Solving Puzzles
            </Button>
            <p className="text-sm text-muted-foreground text-center mt-3">
              Solve puzzles created by the SimulChess community
            </p>
          </CardContent>
        </Card>

        <article className="prose prose-neutral dark:prose-invert max-w-none">
          <h2 className="flex items-center gap-2">
            <BookOpen className="h-6 w-6" />
            Chess Puzzle Training: The Fastest Path to Tactical Mastery
          </h2>

          <p>
            Master chess tactics with SimulChess. Solve a huge variety of community-rated puzzles, 
            from beginner forks to master combinations. Each puzzle presents a position with a winning 
            combination, challenging you to find the key moves that deliver checkmate, win material, 
            or achieve a decisive advantage. Regular puzzle training builds the pattern recognition 
            that separates strong players from weaker ones.
          </p>

          <h3>Why Puzzles Work</h3>
          <p>
            The effectiveness of puzzle training comes from concentrated exposure to tactical patterns. 
            In a normal game, tactical opportunities might arise once or twice. In a puzzle training 
            session, you encounter dozens of tactical positions in the same time period. This density 
            of practice accelerates pattern acquisition far beyond what game experience alone can provide.
          </p>

          <p>
            Puzzles also guarantee that a solution exists. Unlike real games where positions may be 
            unclear, puzzles have definite answers. This certainty allows your brain to search more 
            confidently, knowing that sufficient calculation will reveal the winning idea. Over time, 
            this trained confidence transfers to regular games.
          </p>

          <h3>Core Tactical Motifs</h3>
          <p>
            Chess tactics operate through a finite set of recurring patterns. Forks attack two pieces 
            simultaneously. Pins immobilize pieces protecting more valuable ones. Skewers force pieces 
            to move, exposing targets behind them. Discoveries reveal attacks when pieces move out of 
            the way. These motifs appear in countless forms but follow consistent underlying logic.
          </p>

          <p>
            Our puzzle collection systematically exposes you to all major tactical themes. Through 
            repetition, you'll develop instant recognition of common patterns, allowing you to identify 
            opportunities in seconds rather than minutes. This speed is crucial in time-sensitive 
            game situations where lengthy calculation isn't possible.
          </p>

          <h3>The Community Puzzle System</h3>
          <p>
            SimulChess features a unique community puzzle system where players can create and share 
            their own puzzles. This creates an ever-expanding library of challenges while giving 
            creative players an outlet for their tactical discoveries. Perhaps you'll find a brilliant 
            combination in your own game and share it with the community.
          </p>

          <p>
            Community creation also ensures puzzle diversity. While computer-generated puzzles tend 
            toward optimal but sometimes sterile solutions, human-created puzzles capture the creative, 
            surprising combinations that emerge in real games. Both types have value, and our mixed 
            approach provides comprehensive training.
          </p>

          <h3>Choosing the Right Difficulty</h3>
          <p>
            Effective puzzle training requires appropriate challenge levels. Puzzles too easy provide 
            little learning; puzzles too hard frustrate without teaching. Each puzzle in our collection 
            includes a difficulty rating assigned by its creator, helping you find challenges that 
            match your current skill level.
          </p>

          <p>
            We recommend starting with puzzles slightly above your comfort zone. If you solve everything 
            instantly, move up in difficulty. If you're constantly frustrated, step back to easier puzzles 
            and build your pattern library. The sweet spot is puzzles that require genuine thought but 
            remain solvable with focused effort — that's where the fastest learning happens.
          </p>

          <h3>Effective Puzzle Solving Technique</h3>
          <p>
            Maximize your training benefits by solving puzzles correctly. Before moving, visualize 
            the entire solution including your opponent's best responses. Check your calculation by 
            considering defensive resources — many wrong puzzle answers fail because they ignore 
            the opponent's strongest reply.
          </p>

          <p>
            When you solve incorrectly, study why. Was the tactical motif unfamiliar? Did you 
            miscalculate a variation? Did you miss an opponent's defense? Understanding your errors 
            prevents repeating them. The puzzle you got wrong teaches more than the puzzle you 
            solved instantly.
          </p>

          <h3>Building a Puzzle Habit</h3>
          <p>
            Consistency matters more than volume. Ten puzzles daily provides more benefit than 
            one hundred puzzles occasionally. Short daily sessions keep tactical patterns fresh 
            in your memory, while marathon sessions lead to fatigue and careless errors. Aim for 
            fifteen to thirty minutes of focused puzzle work each day.
          </p>

          <p>
            Many players incorporate puzzles into their morning routine, warming up their chess 
            thinking before work or school. Others prefer evening sessions as active relaxation. 
            Find what works for your schedule and stick with it — the habit itself is more 
            important than the optimal timing.
          </p>

          <h3>From Puzzles to Games</h3>
          <p>
            Puzzle skills transfer to games when you actively look for tactical opportunities during 
            play. Before each move, briefly scan for checks, captures, and threats — the elements 
            that create tactical combinations. This habit of tactical awareness is what puzzle 
            training develops.
          </p>

          <p>
            After games, use our post-game Review tab to identify where you misjudged positions. 
            The VSS Mismatch feature highlights moments where your evaluation differed significantly 
            from reality — often tactical opportunities you missed or threats you overlooked. 
            Connecting these insights to puzzle patterns strengthens the transfer between training 
            and competitive performance.
          </p>

          <h3>Creating Your Own Puzzles</h3>
          <p>
            The puzzle creator feature lets you contribute to the community while deepening your 
            own understanding. Positions you found beautiful or instructive in your games can 
            become training material for others. The process of setting up puzzles — ensuring 
            they have unique solutions and appropriate difficulty — develops your analytical 
            skills from a new angle.
          </p>

          <p>
            Consider creating puzzles that highlight your favorite tactical themes or common 
            patterns in your opening repertoire. Sharing your tactical discoveries benefits the 
            community while reinforcing your own pattern recognition. The best puzzle creators 
            often become the best puzzle solvers.
          </p>

          <div className="not-prose mt-8 mb-8">
            <Button 
              size="lg" 
              className="w-full"
              onClick={() => setLocation("/puzzles")}
              data-testid="button-start-puzzles-bottom"
            >
              <Puzzle className="mr-2 h-5 w-5" />
              Start Solving Puzzles
            </Button>
          </div>

          <SEOCrossLinks currentPath="/chess-puzzles-trainer" />
        </article>
      </div>
    </div>
  );
}
