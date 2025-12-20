import { useLocation } from "wouter";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SEOCrossLinks } from "@/components/seo-cross-links";
import { Crown, Target, Brain, Zap, BookOpen, Layers, Clock } from "lucide-react";

export default function ChessPieceChallenge() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>N-Queens Puzzle and Chess Piece Challenges | SimulChess</title>
        <meta name="description" content="Solve the famous N-Queens puzzle and learn chess piece movement with our N-Piece Challenge. From beginner-friendly rook and bishop exercises to the classic queen placement problem studied for centuries." />
        <meta property="og:title" content="N-Queens Puzzle and Chess Piece Challenges | SimulChess" />
        <meta property="og:description" content="Master the legendary N-Queens puzzle. Plus beginner-friendly challenges with knights, bishops, and rooks to learn how each chess piece moves." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://simulchess.com/chess-piece-challenge" />
        <meta property="og:image" content="https://simulchess.com/og-npiece.png" />
        <link rel="canonical" href="https://simulchess.com/chess-piece-challenge" />
      </Helmet>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Layers className="h-10 w-10 text-primary" />
            <h1 className="text-3xl md:text-4xl font-bold">N-Piece Chess Challenge</h1>
          </div>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Master piece coordination by training with limited material
          </p>
        </div>

        <Card className="mb-8">
          <CardContent className="pt-6">
            <div className="grid md:grid-cols-3 gap-4 mb-6">
              <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                <Crown className="h-6 w-6 text-primary shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold">N-Queens Puzzle</h3>
                  <p className="text-sm text-muted-foreground">The famous mathematical challenge</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                <Target className="h-6 w-6 text-primary shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold">All Piece Types</h3>
                  <p className="text-sm text-muted-foreground">Knights, bishops, rooks, and queens</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                <Brain className="h-6 w-6 text-primary shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold">Learn Piece Movement</h3>
                  <p className="text-sm text-muted-foreground">Perfect for beginners and experts</p>
                </div>
              </div>
            </div>

            <Button 
              size="lg" 
              className="w-full"
              onClick={() => setLocation("/n-piece")}
              data-testid="button-start-npiece-challenge"
            >
              <Layers className="mr-2 h-5 w-5" />
              Start N-Piece Challenge
            </Button>
            <p className="text-sm text-muted-foreground text-center mt-3">
              Select your pieces and master their coordination
            </p>
          </CardContent>
        </Card>

        <article className="prose prose-neutral dark:prose-invert max-w-none">
          <h2 className="flex items-center gap-2">
            <BookOpen className="h-6 w-6" />
            The N-Queens Puzzle and Chess Piece Challenges
          </h2>

          <p>
            The N-Queens puzzle is one of the most famous problems in mathematics and computer science. 
            The challenge: place N queens on an N×N chessboard so that no two queens threaten each other. 
            First posed in 1848 by chess composer Max Bezzel, this deceptively simple puzzle has captivated 
            mathematicians for nearly two centuries. Our N-Piece Challenge brings this legendary puzzle 
            to life — and extends it with beginner-friendly variations using other chess pieces to help 
            players of all levels learn how each piece moves and attacks.
          </p>

          <h3>The Famous N-Queens Problem</h3>
          <p>
            The classic N-Queens puzzle asks you to place 8 queens on a standard 8×8 chessboard such that 
            no queen can capture another. Since queens attack along rows, columns, and diagonals, finding 
            a valid arrangement requires careful thought. There are exactly 92 distinct solutions to the 
            8-queens problem — but finding even one without guidance challenges most people.
          </p>

          <p>
            The puzzle's fame extends beyond chess. It's a standard benchmark problem in computer science, 
            used to teach backtracking algorithms, constraint satisfaction, and optimization techniques. 
            Legendary mathematicians including Carl Friedrich Gauss worked on generalizations of the problem. 
            When you solve the N-Queens puzzle, you're engaging with a problem that has occupied some of 
            history's greatest minds.
          </p>

          <h3>Why We Added Other Pieces</h3>
          <p>
            While the N-Queens puzzle is the star attraction, it assumes you already understand how queens 
            move. For beginners still learning chess, jumping straight to queens can be overwhelming. 
            That's why SimulChess extends the concept to all major piece types: rooks, bishops, knights, 
            and even kings. Each piece type creates its own unique puzzle with different difficulty levels.
          </p>

          <p>
            Starting with simpler pieces helps new players internalize movement patterns through hands-on 
            practice. Rather than memorizing rules from a book, you discover each piece's attacking range 
            by experimenting with placement. This active learning approach builds intuition that transfers 
            directly to real chess games.
          </p>

          <h3>N-Rooks: The Beginner-Friendly Starting Point</h3>
          <p>
            Rooks attack along rows and columns — the simplest movement pattern among the major pieces. 
            The N-Rooks challenge asks you to place N rooks on an N×N board so none threaten each other. 
            The solution is straightforward: one rook per row and one per column. This makes it perfect 
            for absolute beginners learning how rooks move.
          </p>

          <p>
            Though the solution pattern is simple, working through it builds confidence with the puzzle 
            format and reinforces the rook's straight-line attacking ability. Many beginners in actual 
            chess games forget that rooks can attack across the entire board — this exercise makes that 
            power viscerally clear.
          </p>

          <h3>N-Bishops: Understanding Diagonal Movement</h3>
          <p>
            Bishops attack along diagonals, and unlike rooks, they're restricted to squares of one color. 
            The N-Bishops puzzle exploits this property: since a light-squared bishop never threatens a 
            dark-squared bishop, you can place more bishops than you might expect. This puzzle teaches 
            both diagonal movement and the critical concept of bishop color restriction.
          </p>

          <p>
            Many developing chess players struggle with bishops because diagonal vision doesn't come 
            naturally to everyone. The N-Bishops challenge provides concentrated practice seeing diagonal 
            lines across the board. After solving several configurations, players find themselves 
            spotting diagonal attacks in real games much more quickly.
          </p>

          <h3>N-Knights: The Tricky L-Shape</h3>
          <p>
            Knights move in an L-shape — two squares in one direction, then one square perpendicular. 
            This unusual pattern confuses many beginners and even intermediate players. The N-Knights 
            challenge forces you to really understand which squares a knight controls, building the 
            visualization skill that makes knights effective in actual games.
          </p>

          <p>
            Because knights don't attack in straight lines, you can often fit more knights on the board 
            than other pieces. Discovering the maximum placement through experimentation teaches the 
            knight's unique characteristics better than any lecture could. Players who complete the 
            N-Knights challenge consistently report improved comfort with knight movement in their games.
          </p>

          <h3>The Queen Challenge: Putting It All Together</h3>
          <p>
            The queen combines the rook's straight-line attacks with the bishop's diagonal attacks, making 
            the N-Queens puzzle the ultimate test. Every row, column, and diagonal becomes a constraint. 
            If you've worked through the other piece challenges first, you'll have internalized both 
            movement patterns — making the queen's combined power feel natural rather than overwhelming.
          </p>

          <p>
            Solving the 8-Queens puzzle demonstrates genuine spatial reasoning ability. The constraint 
            satisfaction skills you develop — placing pieces while tracking multiple attack patterns 
            simultaneously — transfer directly to chess calculation. When you can visualize queen attacks 
            across an empty board, seeing threats in actual game positions becomes significantly easier.
          </p>

          <h3>Scaling the Challenge</h3>
          <p>
            Our N-Piece Challenge lets you adjust the board size and number of pieces. Board sizes range 
            from 5×5 through 12×12 — smaller boards provide quicker puzzles perfect for learning, while 
            larger boards offer extended challenges for experienced solvers. This flexibility means the 
            puzzle grows with your skills — there's always a harder variation waiting when you're ready.
          </p>

          <p>
            Experimenting with different configurations reveals interesting mathematical properties. 
            Some board sizes have many solutions while others have few or none. Discovering these 
            patterns yourself provides insight into combinatorial mathematics while keeping the 
            experience engaging and game-like.
          </p>

          <h3>From Puzzle to Chess Improvement</h3>
          <p>
            The skills developed through N-Piece challenges transfer directly to chess performance. 
            Players who thoroughly understand how each piece attacks make fewer blunders in games. 
            They spot threats faster, calculate more accurately, and use their pieces more effectively. 
            The investment in piece movement fundamentals pays dividends throughout your chess journey.
          </p>

          <p>
            We recommend starting with whatever piece gives you the most trouble in actual games. 
            Struggle with knights? Work through the N-Knights challenge until the L-shape becomes 
            second nature. Miss diagonal threats? The N-Bishops puzzle will sharpen that awareness. 
            Then tackle the legendary N-Queens problem as the capstone challenge that integrates 
            everything you've learned.
          </p>

          <div className="not-prose mt-8 mb-8">
            <Button 
              size="lg" 
              className="w-full"
              onClick={() => setLocation("/n-piece")}
              data-testid="button-start-npiece-challenge-bottom"
            >
              <Layers className="mr-2 h-5 w-5" />
              Start N-Piece Challenge
            </Button>
          </div>

          <SEOCrossLinks currentPath="/chess-piece-challenge" />
        </article>
      </div>
    </div>
  );
}
