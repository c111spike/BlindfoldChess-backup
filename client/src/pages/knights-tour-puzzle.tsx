import { useLocation } from "wouter";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SEOCrossLinks } from "@/components/seo-cross-links";
import { Waypoints, Brain, Target, Timer, BookOpen, Puzzle, Trophy } from "lucide-react";

export default function KnightsTourPuzzle() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Knight's Tour Puzzle - Chess Brain Training | SimulChess</title>
        <meta name="description" content="Take on the classic Knight's Tour challenge at SimulChess. Improve your visualization with Warnsdorff's Rule and master knight movement today!" />
        <meta property="og:title" content="Knight's Tour Puzzle - SimulChess" />
        <meta property="og:description" content="Take on the classic Knight's Tour challenge at SimulChess. Improve your visualization with Warnsdorff's Rule and master knight movement." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://simulchess.com/knights-tour-puzzle" />
        <meta property="og:image" content="https://simulchess.com/og-knights-tour.png" />
        <link rel="canonical" href="https://simulchess.com/knights-tour-puzzle" />
      </Helmet>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Waypoints className="h-10 w-10 text-primary" />
            <h1 className="text-3xl md:text-4xl font-bold">Knight's Tour Puzzle</h1>
          </div>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Visit every square on the board using only knight moves — the classic chess challenge
          </p>
        </div>

        <Card className="mb-8">
          <CardContent className="pt-6">
            <div className="grid md:grid-cols-3 gap-4 mb-6">
              <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                <Puzzle className="h-6 w-6 text-primary shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold">64 Squares</h3>
                  <p className="text-sm text-muted-foreground">Visit every square exactly once</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                <Brain className="h-6 w-6 text-primary shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold">Visualization Training</h3>
                  <p className="text-sm text-muted-foreground">Master knight movement patterns</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                <Timer className="h-6 w-6 text-primary shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold">Time Challenge</h3>
                  <p className="text-sm text-muted-foreground">Race against the clock</p>
                </div>
              </div>
            </div>

            <Button 
              size="lg" 
              className="w-full"
              onClick={() => setLocation("/knights-tour")}
              data-testid="button-start-knights-tour"
            >
              <Waypoints className="mr-2 h-5 w-5" />
              Start Knight's Tour
            </Button>
            <p className="text-sm text-muted-foreground text-center mt-3">
              Can you complete the tour and visit all 64 squares?
            </p>
          </CardContent>
        </Card>

        <article className="prose prose-neutral dark:prose-invert max-w-none">
          <h2 className="flex items-center gap-2">
            <BookOpen className="h-6 w-6" />
            The Knight's Tour: History, Strategy, and Chess Benefits
          </h2>

          <p>
            Take on the classic Knight's Tour challenge at SimulChess. Improve your visualization with 
            Warnsdorff's Rule and master knight movement as you visit every square on the chessboard 
            exactly once. With 64 squares and the knight's unusual L-shaped movement, finding a complete 
            tour requires careful planning and spatial reasoning that directly improves your chess ability.
          </p>

          <h3>A Puzzle With Over 1,000 Years of History</h3>
          <p>
            The Knight's Tour has fascinated mathematicians and chess players since at least the 9th 
            century. Arab chess masters created the first known solutions, and the puzzle appears in 
            medieval European manuscripts. Legendary mathematician Leonhard Euler studied it extensively 
            in the 18th century, developing systematic methods for finding solutions that are still 
            taught today.
          </p>

          <p>
            The puzzle's longevity reflects its perfect combination of accessibility and depth. Anyone 
            who knows how a knight moves can attempt the tour, yet finding solutions requires genuine 
            mental effort. There are approximately 26 trillion possible knight's tours on a standard 
            8×8 board, but reaching even one requires navigating countless dead ends where no legal 
            move leads to an unvisited square.
          </p>

          <h3>Why Chess Players Should Practice the Knight's Tour</h3>
          <p>
            The knight is often the hardest piece for developing players to use effectively. Its 
            non-linear movement creates visualization challenges that other pieces don't present. 
            The Knight's Tour forces intensive practice with knight movement, building intuition 
            for the piece's capabilities that transfers directly to game play.
          </p>

          <p>
            After completing several knight's tours, players typically find that calculating knight 
            maneuvers becomes significantly easier. The L-shaped pattern becomes deeply internalized, 
            allowing you to see knight forks, outposts, and attacking routes that might have been 
            invisible before. Many coaches recommend the Knight's Tour specifically for players who 
            struggle with knight usage.
          </p>

          <h3>Cognitive Benefits Beyond Chess</h3>
          <p>
            Research has shown that spatial reasoning puzzles like the Knight's Tour provide genuine 
            cognitive training benefits. Regular practice improves working memory, planning ability, 
            and mental rotation skills. These benefits extend beyond chess into areas like mathematics, 
            engineering, and any field requiring systematic problem-solving.
          </p>

          <p>
            The Knight's Tour is particularly valuable for developing what psychologists call 
            "prospective memory" — the ability to remember future intentions while pursuing current 
            actions. Completing a tour requires holding your overall strategy in mind while executing 
            individual moves, strengthening the mental architecture used for complex planning in 
            all domains.
          </p>

          <h3>Strategies for Solving the Knight's Tour</h3>
          <p>
            While intuition plays a role, successful knight's tours typically require strategic 
            thinking. The most famous approach is Warnsdorff's Rule, developed in 1823: always 
            move to the square with the fewest onward moves available. This heuristic works 
            because squares with limited access are hardest to reach — visiting them early prevents 
            dead ends later.
          </p>

          <p>
            Corner and edge squares deserve special attention because they have fewer accessible 
            squares (2-4) compared to central squares (8). Experienced solvers develop patterns for 
            handling the board's edges efficiently, often visiting corner regions early before moving 
            to the more forgiving central area.
          </p>

          <h3>Open Tours vs. Closed Tours</h3>
          <p>
            A "closed" knight's tour ends on a square from which the knight can return to its 
            starting position, forming a complete loop. Closed tours are more difficult to find 
            but have elegant mathematical properties. Our puzzle accepts both open and closed tours, 
            but achieving a closed tour demonstrates mastery of the challenge.
          </p>

          <p>
            <strong>Mathematical note:</strong> Closed tours are only possible on boards with an 
            even number of squares. This is because a knight alternates between light and dark 
            squares with every move — to return to your starting square, you need equal numbers 
            of light and dark squares. On an 8×8 board (64 squares) or 6×6 board (36 squares), 
            closed tours are possible. On a 5×5 board (25 squares) or 7×7 board (49 squares), 
            only open tours can exist.
          </p>

          <p>
            Finding closed tours requires additional planning beyond simply completing all squares. 
            If you can consistently produce closed tours on even-numbered boards, you've developed 
            exceptional knight visualization skills.
          </p>

          <h3>Variations and Advanced Challenges</h3>
          <p>
            Once you've mastered the standard 8×8 tour, consider additional challenges. Can you 
            complete a tour starting from a specific corner? Can you find a closed tour? How 
            quickly can you finish? Setting personal goals and tracking improvement adds motivation 
            and measurable progress to your practice.
          </p>

          <p>
            On SimulChess, you can practice on board sizes ranging from 5×5 through 12×12, allowing 
            you to develop more general knight intuition. Smaller boards like 5×5 offer quicker 
            practice sessions, while larger boards like 10×10 or 12×12 provide extended challenges 
            that push your memory and planning to the limit. This variety prevents rote memorization 
            and ensures you're building genuine visualization skills rather than just learning 
            specific solutions.
          </p>

          <h3>Integration With Chess Training</h3>
          <p>
            The Knight's Tour works excellently as a warm-up before studying chess or playing games. 
            A quick tour activates the spatial reasoning centers of your brain and establishes focus 
            for the session ahead. Many coaches recommend starting training sessions with a few minutes 
            of knight's tour practice before moving to tactics or game analysis.
          </p>

          <p>
            For maximum benefit, try to complete tours without using undo functions or hints. The 
            struggle of working through dead ends and backtracking mentally is where the real 
            learning happens. Easy solutions feel good but provide less cognitive challenge. Embrace 
            the difficulty — it's the source of the puzzle's training value.
          </p>

          <div className="not-prose mt-8 mb-8">
            <Button 
              size="lg" 
              className="w-full"
              onClick={() => setLocation("/knights-tour")}
              data-testid="button-start-knights-tour-bottom"
            >
              <Waypoints className="mr-2 h-5 w-5" />
              Start Knight's Tour
            </Button>
          </div>

          <SEOCrossLinks currentPath="/knights-tour-puzzle" />
        </article>
      </div>
    </div>
  );
}
