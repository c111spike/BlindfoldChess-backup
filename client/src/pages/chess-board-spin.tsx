import { Link, useLocation } from "wouter";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SEOCrossLinks } from "@/components/seo-cross-links";
import { RotateCw, Brain, Timer, Zap, BookOpen, Target, Eye, ArrowLeft } from "lucide-react";

export default function ChessBoardSpin() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Board Spin Chess Training - Memory and Tactics Game | SimulChess</title>
        <meta name="description" content="Build elite chess visualization with Board Spin on SimulChess. Study meaningful positions, recreate them from new perspectives, and find the best move to master the cognitive science of chess memory." />
        <meta property="og:title" content="Board Spin - Chess Memory Training | SimulChess" />
        <meta property="og:description" content="Build elite chess visualization with Board Spin on SimulChess. Study meaningful positions, recreate them from new perspectives, and find the best move to master the cognitive science of chess memory." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://simulchess.com/chess-board-spin" />
        <meta property="og:image" content="https://simulchess.com/og-boardspin.png" />
        <link rel="canonical" href="https://simulchess.com/chess-board-spin" />
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
                  <h3 className="font-semibold">Study &amp; Spin</h3>
                  <p className="text-sm text-muted-foreground">Take your time, then spin when ready</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                <Brain className="h-6 w-6 text-primary shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold">Recreate From Memory</h3>
                  <p className="text-sm text-muted-foreground">Rebuild the position in 2 minutes</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                <Zap className="h-6 w-6 text-primary shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold">Bonus Round</h3>
                  <p className="text-sm text-muted-foreground">Find the best move to double points</p>
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
              Study, spin, recreate — can you rebuild the position from memory?
            </p>
          </CardContent>
        </Card>

        <article className="prose prose-neutral dark:prose-invert max-w-none">
          <h2 className="flex items-center gap-2">
            <BookOpen className="h-6 w-6" />
            Board Spin: The Ultimate Chess Memory Challenge
          </h2>

          <p>
            Test your memory with Board Spin on SimulChess. Study, rotate, and recreate positions 
            to build elite visualization — then find the best move in the bonus round to double 
            your score. You study a position for as long as you need, press Spin, and the board 
            rotates while the pieces vanish. Your challenge: recreate the entire position from 
            memory within two minutes. This innovative format trains visualization, memory retention, 
            and tactical calculation — three skills that compound to create stronger chess players.
          </p>

          <h3>How Board Spin Works</h3>
          <p>
            Each round begins with a chess position displayed for study. Take as long as you need 
            to memorize where every piece stands — there's no pressure during the study phase. 
            When you feel confident, press the Spin button. The board rotates to a new viewing 
            angle and the pieces disappear. Now a two-minute timer starts, and you must place 
            every piece back in its correct position from memory.
          </p>

          <p>
            Successfully recreating the position earns points and unlocks a bonus round. In the 
            bonus round, the position reappears and you have a chance to find the best move, 
            verified by Stockfish — the world's strongest chess engine. Find the correct move 
            and you double your points for that round. This two-stage format rewards both accurate 
            memory and tactical understanding.
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

          <h3>The Study Phase Strategy</h3>
          <p>
            Since you control when to spin, the study phase becomes a strategic decision. How long 
            should you study before testing yourself? Studying too briefly leads to recreation 
            errors. Studying too long may indicate you're not developing efficient memorization 
            techniques. Finding your optimal study time — and watching it decrease as you improve — 
            provides a natural measure of progress.
          </p>

          <p>
            Cognitive psychologists call this process <strong>"Chunking."</strong> A grandmaster doesn't 
            remember 32 pieces; they remember 4-5 "chunks" of coordinated pieces. Board Spin forces your 
            brain to develop these larger mental templates, effectively expanding your working memory. 
            Strong players perceive positions in terms of meaningful chunks: attacking formations, 
            defensive structures, key squares, and piece relationships. As you practice, you'll develop 
            this structured perception — the same skill that distinguishes masters from amateurs.
          </p>

          <h3>Overcoming Viewpoint Dependency</h3>
          <p>
            Many players can only see tactics from their own perspective. By rotating the board, 
            we challenge your brain to maintain the 3-D "logic" of the position, regardless of the 
            orientation. This is a critical skill for over-the-board play where you must often 
            visualize the board from your opponent's seat to understand their threats and plans.
          </p>

          <h3>The Recreation Challenge</h3>
          <p>
            Once the board spins, a two-minute timer begins. This pressure creates productive 
            urgency that mimics time-scramble situations in tournament games. You must quickly 
            translate your mental image into piece placements, working systematically to avoid 
            errors. The timer reveals how well you truly internalized the position versus merely 
            glancing at it.
          </p>

          <p>
            Recreation failures are informative. Did you forget a piece entirely? Misplace it by 
            one square? Confuse which color controlled a square? Each error type suggests different 
            weaknesses in your visualization process. Pay attention to your mistakes — they guide 
            what to focus on during future study phases.
          </p>

          <h3>The Bonus Round</h3>
          <p>
            Successfully recreating a position unlocks the bonus round — your chance to double 
            your points by finding the best move. The position reappears, and now tactical 
            calculation takes over. Can you spot the winning combination, the defensive resource, 
            or the positional breakthrough that Stockfish identifies as optimal?
          </p>

          <p>
            The bonus round connects memory training to practical chess improvement. Positions 
            that tactical engines find interesting often feature the patterns that appear in 
            real games: forks, pins, discovered attacks, and sacrifices. By practicing both 
            memorization and tactical solving, you're building complete chess vision.
          </p>

          <h3>Progressive Difficulty</h3>
          <p>
            Each successful round advances to a more challenging position. Early rounds feature 
            fewer pieces and simpler arrangements that beginners can handle. As difficulty 
            increases, positions include more pieces to remember, making accurate recreation 
            harder. The board also appears from different viewing angles, challenging you to 
            maintain your mental image regardless of perspective.
          </p>

          <p>
            These escalating challenges prevent plateau effects. Just when you've mastered 
            positions with eight pieces, you'll face ten. Just when you're comfortable with 
            the standard board view, you'll see it rotated. This continuous progression keeps 
            your training effective and engaging.
          </p>

          <h3>The Science of Visual Chess Memory</h3>
          <p>
            Research on chess memory reveals that experts encode positions differently than novices. 
            While beginners see individual pieces, masters perceive meaningful structures — pawn 
            chains, piece coordination patterns, attacking formations. Board Spin accelerates the 
            development of this expert perception through repeated exposure to varied positions.
          </p>

          <p>
            Interestingly, research shows that masters lose their memory advantage when pieces are 
            placed randomly on the board. This proves that chess memory is a <strong>"software" 
            skill</strong> you can upgrade by learning patterns, rather than a "hardware" limitation 
            of your brain. Board Spin uses realistic positions generated by Stockfish, ensuring 
            you're training the right kind of memory — the same pattern-based recognition that 
            distinguishes titled players from amateurs.
          </p>

          <h3>Integration With Other Training</h3>
          <p>
            Board Spin complements other training methods perfectly. Use it as a warm-up before 
            tactical puzzles or game analysis. The memory component activates your visualization 
            systems while the bonus round engages your calculation abilities. Five to ten 
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
            memory abilities grow, you'll consistently reach higher rounds before errors end 
            your run. Watching your high score climb motivates continued practice and validates 
            the effectiveness of your training.
          </p>

          <p>
            Pay attention to which positions end your runs. Repeated failures on certain position 
            types signal areas needing focused study. Perhaps positions with many knights cause 
            trouble, or complex pawn structures overwhelm your memory. Use these insights to 
            direct your broader chess improvement efforts.
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
