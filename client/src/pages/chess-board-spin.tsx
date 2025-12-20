import { useLocation } from "wouter";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SEOCrossLinks } from "@/components/seo-cross-links";
import { RotateCw, Brain, Timer, Zap, BookOpen, Target, Eye } from "lucide-react";

export default function ChessBoardSpin() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Board Spin Chess Training - Memory and Tactics Game | SimulChess</title>
        <meta name="description" content="Test your chess memory with Board Spin. Memorize positions, find the best move, and race against time. A unique training game combining visualization, memory, and tactical calculation." />
        <meta property="og:title" content="Board Spin - Chess Memory Training | SimulChess" />
        <meta property="og:description" content="Memorize chess positions and find the best move. Train your visualization and tactical pattern recognition." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://simulchess.com/chess-board-spin" />
        <meta property="og:image" content="https://simulchess.com/og-boardspin.png" />
        <link rel="canonical" href="https://simulchess.com/chess-board-spin" />
      </Helmet>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <RotateCw className="h-10 w-10 text-primary" />
            <h1 className="text-3xl md:text-4xl font-bold">Board Spin</h1>
          </div>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Memory meets tactics in this unique chess training game
          </p>
        </div>

        <Card className="mb-8">
          <CardContent className="pt-6">
            <div className="grid md:grid-cols-3 gap-4 mb-6">
              <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                <Eye className="h-6 w-6 text-primary shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold">Memorize Positions</h3>
                  <p className="text-sm text-muted-foreground">Study the board before it spins</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                <Zap className="h-6 w-6 text-primary shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold">Find Best Moves</h3>
                  <p className="text-sm text-muted-foreground">Stockfish-verified solutions</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                <Timer className="h-6 w-6 text-primary shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold">Beat the Clock</h3>
                  <p className="text-sm text-muted-foreground">Race against time for high scores</p>
                </div>
              </div>
            </div>

            <Button 
              size="lg" 
              className="w-full"
              onClick={() => setLocation("/boardspin")}
              data-testid="button-start-boardspin"
            >
              <RotateCw className="mr-2 h-5 w-5" />
              Start Board Spin
            </Button>
            <p className="text-sm text-muted-foreground text-center mt-3">
              Memorize, spin, and solve — how many rounds can you survive?
            </p>
          </CardContent>
        </Card>

        <article className="prose prose-neutral dark:prose-invert max-w-none">
          <h2 className="flex items-center gap-2">
            <BookOpen className="h-6 w-6" />
            Board Spin: The Ultimate Chess Memory and Tactics Challenge
          </h2>

          <p>
            Board Spin is a unique training game that combines position memorization with tactical 
            solving. You're shown a chess position for a limited time, then the board "spins" and 
            you must find the best move from memory. This innovative format simultaneously trains 
            visualization, memory retention, and tactical calculation — three skills that compound 
            to create stronger chess players.
          </p>

          <h3>How Board Spin Works</h3>
          <p>
            Each round begins with a chess position displayed for study. You have limited time to 
            memorize where every piece stands and begin calculating the tactical possibilities. 
            When time expires, the pieces disappear and you must find the best move based purely 
            on your mental image of the position.
          </p>

          <p>
            Your solutions are verified by Stockfish, the world's strongest chess engine. Only 
            moves that match the engine's top choices score points. This ensures you're not just 
            remembering positions but actually finding correct tactical solutions — the combination 
            of memory and accuracy that defines strong chess vision.
          </p>

          <h3>Why Memory Training Matters for Chess</h3>
          <p>
            Chess masters can glance at a position and remember it accurately for hours. This 
            ability isn't innate — it develops through practice. Research by cognitive psychologist 
            Adriaan de Groot showed that expert chess memory depends on recognizing meaningful 
            patterns rather than memorizing individual piece locations. Board Spin directly trains 
            this pattern-based memory system.
          </p>

          <p>
            Strong position memory provides practical advantages in games. When calculating 
            variations, you must hold both the current position and hypothetical future positions 
            in mind. The better your position memory, the deeper you can calculate without losing 
            track of the pieces. Board Spin builds this mental capacity through concentrated practice.
          </p>

          <h3>Connecting Visualization to Tactics</h3>
          <p>
            The game's real power comes from combining memory with tactical solving. You can't 
            succeed by merely remembering piece locations — you must also understand the position 
            well enough to find the best move. This forces deep processing during the study phase 
            rather than passive observation.
          </p>

          <p>
            As you improve, you'll develop efficient study strategies. Strong players don't try 
            to memorize each piece individually. Instead, they perceive the position in terms of 
            tactical elements: attacking formations, defensive structures, key squares, and piece 
            relationships. This structured perception is exactly what distinguishes masters from 
            amateurs.
          </p>

          <h3>The Time Pressure Element</h3>
          <p>
            The timer creates productive pressure that mimics real game situations. You can't 
            spend forever studying — you must quickly identify what matters and commit it to 
            memory. This trains rapid position assessment, a crucial skill for time-scramble 
            situations in tournament games.
          </p>

          <p>
            The pressure also reveals weaknesses in your chess understanding. Positions involving 
            your weaker areas — perhaps knight forks or back-rank threats — will prove harder to 
            remember and solve. These difficulties highlight exactly what needs additional study, 
            making Board Spin a diagnostic tool as well as a training exercise.
          </p>

          <h3>Progressive Challenge</h3>
          <p>
            Each successful round advances to a more challenging position. Early rounds feature 
            simpler tactical motifs and cleaner positions. Later rounds introduce complex positions 
            with multiple tactical possibilities. Seeing how far you can progress provides both 
            motivation and a measure of your current ability level.
          </p>

          <p>
            High scores require mastering a range of tactical themes and position types. You might 
            excel at sharp attacking positions but struggle with quiet positional puzzles, or vice 
            versa. Well-rounded improvement shows in consistently higher scores across all position 
            types.
          </p>

          <h3>The Science of Visual Chess Memory</h3>
          <p>
            Research on chess memory reveals that experts encode positions differently than novices. 
            While beginners see individual pieces, masters perceive meaningful structures — pawn 
            chains, piece coordination patterns, attacking formations. Board Spin accelerates the 
            development of this expert perception through repeated exposure to varied positions.
          </p>

          <p>
            Interestingly, when shown random piece placements (rather than positions from real games), 
            masters show no memory advantage over beginners. This confirms that chess memory depends 
            on pattern recognition rather than raw memorization ability. Board Spin uses realistic 
            positions generated by Stockfish, ensuring you're training the right kind of memory.
          </p>

          <h3>Integration With Other Training</h3>
          <p>
            Board Spin complements other training methods perfectly. Use it as a warm-up before 
            tactical puzzles or game analysis. The memory component activates your visualization 
            systems while the tactical element engages your calculation abilities. Five to ten 
            minutes of Board Spin primes your brain for productive chess work.
          </p>

          <p>
            The game also serves as a quick training option when you have limited time. Unlike 
            full games or lengthy puzzle sessions, Board Spin provides meaningful practice in 
            brief sessions. Waiting in line or taking a break? A few rounds of Board Spin keeps 
            your chess thinking sharp.
          </p>

          <h3>Tracking Your Progress</h3>
          <p>
            Your high scores provide clear measures of improvement. As your visualization and 
            tactical abilities grow, you'll consistently reach higher rounds before errors end 
            your run. Watching your high score climb motivates continued practice and validates 
            the effectiveness of your training.
          </p>

          <p>
            Pay attention to which positions end your runs. Repeated failures on certain position 
            types signal areas needing focused study. Perhaps knight endgames are causing trouble, 
            or positions with multiple candidate moves overwhelm your memory. Use these insights 
            to direct your broader chess improvement efforts.
          </p>

          <div className="not-prose mt-8 mb-8">
            <Button 
              size="lg" 
              className="w-full"
              onClick={() => setLocation("/boardspin")}
              data-testid="button-start-boardspin-bottom"
            >
              <RotateCw className="mr-2 h-5 w-5" />
              Start Board Spin
            </Button>
          </div>

          <SEOCrossLinks currentPath="/chess-board-spin" />
        </article>
      </div>
    </div>
  );
}
