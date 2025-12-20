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
        <title>N-Piece Chess Challenge - Piece Coordination Training | SimulChess</title>
        <meta name="description" content="Master chess piece coordination with our N-Piece Challenge. Practice with limited pieces to understand their unique strengths, movements, and tactical potential." />
        <meta property="og:title" content="N-Piece Chess Challenge - SimulChess" />
        <meta property="og:description" content="Train with limited pieces to master each chess piece's strengths. Develop deep understanding of bishops, knights, rooks, and queens." />
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
                  <h3 className="font-semibold">Piece Focus</h3>
                  <p className="text-sm text-muted-foreground">Master each piece's unique abilities</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                <Target className="h-6 w-6 text-primary shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold">Endgame Skills</h3>
                  <p className="text-sm text-muted-foreground">Practice essential checkmate patterns</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                <Zap className="h-6 w-6 text-primary shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold">Tactical Clarity</h3>
                  <p className="text-sm text-muted-foreground">Fewer pieces, clearer patterns</p>
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
            Mastering Chess Pieces: The N-Piece Training Method
          </h2>

          <p>
            Every chess player knows how the pieces move, but true mastery requires understanding 
            their deeper characteristics — their optimal squares, coordination patterns, and tactical 
            potential. The N-Piece Challenge isolates this learning by having you play with limited 
            material, forcing you to extract maximum value from each piece. This focused approach 
            accelerates skill development far beyond what normal games can provide.
          </p>

          <h3>Why Limited Material Training Works</h3>
          <p>
            In a full chess game, with 32 pieces creating complex interactions, it's difficult to 
            learn lessons about individual pieces. Mistakes blend into the overall chaos, and good 
            decisions may go unrecognized. By reducing the piece count, the N-Piece Challenge creates 
            positions where every move matters and the consequences of your decisions become 
            immediately apparent.
          </p>

          <p>
            This training method has been used by chess coaches for generations. Studies of endgame 
            positions with few pieces teach essential patterns that recur throughout chess. But our 
            N-Piece Challenge extends this approach to middle-game positions with custom piece 
            selections, allowing you to train specific weaknesses in your understanding.
          </p>

          <h3>Mastering the Knight</h3>
          <p>
            Knights confuse many players with their L-shaped movement and unique ability to jump 
            over other pieces. The N-Piece Challenge with knight-focused setups teaches you to 
            appreciate the knight's strengths: its power in closed positions, its ability to reach 
            squares bishops cannot, and its devastating potential in fork positions.
          </p>

          <p>
            Practice with knight-heavy positions reveals the piece's weaknesses too. Knights struggle 
            to control long diagonals, move slowly across the board, and lose effectiveness in open 
            positions. Understanding when knights shine and when they struggle is essential knowledge 
            that develops naturally through focused training.
          </p>

          <h3>The Power of Bishops</h3>
          <p>
            Bishops are long-range pieces that control diagonals but are restricted to squares of 
            one color. Bishop training teaches you to appreciate the bishop pair's strength, the 
            importance of diagonal clearance, and the deadly potential of bishops in open positions. 
            You'll learn to avoid placing pawns on squares that block your own bishops while 
            targeting your opponent's.
          </p>

          <p>
            Opposite-colored bishop positions deserve special attention. These endgames have unique 
            drawing characteristics that every serious player must understand. With our N-Piece 
            Challenge, you can practice these positions repeatedly until the patterns become 
            second nature.
          </p>

          <h3>Rook Endgame Mastery</h3>
          <p>
            "All rook endgames are drawn" goes the old adage — except when they're not. Rook 
            endgames are the most common endgame type and require specific technical knowledge. 
            Concepts like the Lucena position, Philidor defense, and rook activity principles are 
            essential for any serious player.
          </p>

          <p>
            The N-Piece Challenge allows intensive rook endgame practice, building the pattern 
            recognition needed to handle these positions correctly. You'll learn when to activate 
            your rook, how to use the king, and when passed pawns should advance. This knowledge 
            saves countless half-points in tournament play.
          </p>

          <h3>Queen Power and Precision</h3>
          <p>
            The queen is the most powerful piece but requires precise handling. Queen training 
            teaches you to avoid early queen development, recognize queen sacrifice opportunities, 
            and use the queen's mobility without exposing it to attack. The queen's ability to 
            control multiple diagonals and files simultaneously creates unique tactical possibilities.
          </p>

          <p>
            Queen and pawn endgames present their own challenges. These positions require understanding 
            of perpetual check resources, queen exchanges, and the race between passed pawns. Our 
            N-Piece Challenge provides the repetition needed to develop confidence in these complex 
            situations.
          </p>

          <h3>Piece Coordination Principles</h3>
          <p>
            Perhaps the most valuable lesson from N-Piece training is understanding how pieces 
            work together. Two pieces supporting each other are worth more than the sum of their 
            parts. Learning to coordinate your pieces — having them protect each other, control 
            complementary squares, and create combined threats — elevates your entire game.
          </p>

          <p>
            Different piece combinations have different strengths. Bishop and knight together 
            control squares of both colors. Two rooks on the same file create unstoppable pressure. 
            Queen and knight create fork possibilities that queen and bishop cannot. Understanding 
            these synergies helps you make better trades and positional decisions in full games.
          </p>

          <h3>From Training to Tournament Play</h3>
          <p>
            The patterns you learn in N-Piece training appear constantly in regular games. An 
            endgame that seems impossibly complex becomes manageable when you recognize a familiar 
            pattern from your training. Middle-game decisions improve as you instinctively understand 
            which piece combinations to seek and which to avoid.
          </p>

          <p>
            We recommend rotating through different piece configurations in your training. Don't 
            just practice what you're already good at — focus extra attention on the pieces and 
            positions that give you trouble. Systematic practice across all piece types builds 
            complete chess understanding rather than leaving gaps that opponents can exploit.
          </p>

          <h3>Structured Training Recommendations</h3>
          <p>
            For maximum benefit, approach N-Piece training systematically. Start with simple 
            king and pawn endings — the foundation of all endgame knowledge. Progress to rook 
            endings, then minor piece endings, then queen endings. Each category builds on the 
            previous, creating a comprehensive understanding of chess endgames.
          </p>

          <p>
            Mix endgame study with middle-game piece coordination exercises. Positions with three 
            or four pieces per side allow you to practice tactical themes without the complexity 
            of full positions. This middle ground develops practical skills that translate directly 
            to tournament games while remaining accessible enough for meaningful improvement.
          </p>

          <SEOCrossLinks currentPath="/chess-piece-challenge" />
        </article>
      </div>
    </div>
  );
}
