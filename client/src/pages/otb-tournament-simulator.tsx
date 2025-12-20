import { useLocation } from "wouter";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SEOCrossLinks } from "@/components/seo-cross-links";
import { Clock, Trophy, Hand, Users, BookOpen, AlertTriangle, Target } from "lucide-react";

export default function OTBTournamentSimulator() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>OTB Tournament Simulator - Over the Board Chess Practice | SimulChess</title>
        <meta name="description" content="Practice over-the-board chess with realistic tournament conditions. Master touch-move rules, physical clock mechanics, and proper OTB etiquette before your next tournament." />
        <meta property="og:title" content="OTB Tournament Simulator - SimulChess" />
        <meta property="og:description" content="Prepare for real chess tournaments with our OTB simulator. Practice touch-move, clock handling, and tournament etiquette." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://simulchess.com/otb-tournament-simulator" />
        <meta property="og:image" content="https://simulchess.com/og-otb.png" />
        <link rel="canonical" href="https://simulchess.com/otb-tournament-simulator" />
      </Helmet>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Trophy className="h-10 w-10 text-primary" />
            <h1 className="text-3xl md:text-4xl font-bold">OTB Tournament Simulator</h1>
          </div>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Train with realistic over-the-board conditions to dominate your next tournament
          </p>
        </div>

        <Card className="mb-8">
          <CardContent className="pt-6">
            <div className="grid md:grid-cols-3 gap-4 mb-6">
              <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                <Hand className="h-6 w-6 text-primary shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold">Touch-Move Rules</h3>
                  <p className="text-sm text-muted-foreground">Practice proper piece handling</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                <Clock className="h-6 w-6 text-primary shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold">Manual Clock</h3>
                  <p className="text-sm text-muted-foreground">Tap to complete your move</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                <AlertTriangle className="h-6 w-6 text-primary shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold">Arbiter System</h3>
                  <p className="text-sm text-muted-foreground">Warnings for rule violations</p>
                </div>
              </div>
            </div>

            <Button 
              size="lg" 
              className="w-full"
              onClick={() => setLocation("/otb")}
              data-testid="button-start-otb-training"
            >
              <Trophy className="mr-2 h-5 w-5" />
              Start OTB Training
            </Button>
            <p className="text-sm text-muted-foreground text-center mt-3">
              Experience realistic tournament conditions with touch-move and manual clocks
            </p>
          </CardContent>
        </Card>

        <article className="prose prose-neutral dark:prose-invert max-w-none">
          <h2 className="flex items-center gap-2">
            <BookOpen className="h-6 w-6" />
            Master Over-the-Board Chess: The Complete Tournament Preparation Guide
          </h2>

          <p>
            Over-the-board (OTB) chess is a fundamentally different experience from online play. The physical 
            presence of your opponent, the tactile sensation of moving pieces, the ritual of pressing the clock — 
            these elements create a unique competitive environment that catches many online players off guard. 
            Our OTB Tournament Simulator bridges this gap, helping you develop the habits and skills needed 
            for real tournament success.
          </p>

          <h3>The Critical Difference: Touch-Move Rule</h3>
          <p>
            In online chess, you can hover over pieces, consider moves, and change your mind freely. In OTB 
            tournament play, the touch-move rule changes everything: if you touch a piece, you must move it. 
            If you touch an opponent's piece, you must capture it if legal. This rule eliminates the casual 
            exploring that online play allows and demands complete certainty before making physical contact 
            with any piece.
          </p>

          <p>
            Our simulator enforces touch-move strictly. When you click a piece, that selection is final — 
            you must move that piece. This trains the essential habit of completing your entire calculation 
            before touching the board. Many tournament newcomers have lost games by reflexively grabbing a 
            piece while still thinking, only to realize their intended move was illegal or tactically unsound.
          </p>

          <h3>Clock Mechanics: More Than Just Time</h3>
          <p>
            Physical chess clocks work differently from digital timers. In our OTB simulator, your time 
            continues running until you explicitly press the clock after making your move. This mimics real 
            tournament play where forgetting to press your clock means watching your time drain away while 
            your opponent waits.
          </p>

          <p>
            The manual clock requirement teaches you to develop a consistent move-press rhythm. Tournament 
            players who practice with automatic clocks often struggle with clock discipline, either forgetting 
            to press entirely or pressing before completing their move (a technical violation). Our system 
            builds the muscle memory needed for smooth, confident clock handling under pressure.
          </p>

          <h3>OTB Castling: The King-Rook Sequence</h3>
          <p>
            Castling in OTB chess follows a specific procedure that trips up many online players. You must 
            move the king first, then the rook. In our simulator, you click the king, then click the rook 
            you're castling with — exactly as you would physically pick up and place the pieces. This 
            differs from online platforms where you might click the king's destination square directly.
          </p>

          <p>
            Understanding proper castling technique matters because touching the rook first technically 
            means you've committed to a rook move, not castling. Tournament arbiters enforce this strictly, 
            and games have been decided by castling violations. Practice with our authentic OTB mechanics 
            ensures you'll never make this costly mistake.
          </p>

          <h3>The Arbiter Warning System</h3>
          <p>
            Real tournaments have arbiters who monitor games for rule violations. Our built-in arbiter 
            system provides warnings when you attempt illegal actions, helping you internalize tournament 
            etiquette. From touch-move violations to improper clock handling, the feedback system trains 
            you to play cleanly without needing actual tournament experience.
          </p>

          <h3>Why OTB Skills Matter for Online Players</h3>
          <p>
            Even if you primarily play online, OTB skills translate to stronger overall play. The discipline 
            required for touch-move forces deeper calculation before committing to moves. The clock awareness 
            developed in OTB play improves time management in all formats. Many players find that OTB 
            training creates a more focused, deliberate thinking process that elevates their entire game.
          </p>

          <h3>Preparing for Your First Tournament</h3>
          <p>
            If you're preparing for your first OTB tournament, our simulator is essential preparation. 
            Practice several games with the touch-move and manual clock settings. Focus on developing a 
            pre-move routine: complete your calculation, visualize the move, touch the piece, execute, 
            press the clock. This sequence should become automatic before tournament day.
          </p>

          <p>
            Pay attention to notation if your tournament requires it. While our simulator focuses on 
            physical play mechanics, the mental discipline of OTB play extends to recording moves 
            accurately. Consider practicing with a physical board and notation sheet alongside the simulator.
          </p>

          <h3>Common OTB Mistakes to Avoid</h3>
          <p>
            New tournament players frequently make avoidable errors that cost games or create awkward 
            situations. Hovering your hand over pieces while thinking signals indecision and can lead to 
            accidental touches. Pressing the clock before completing your move is a violation. Announcing 
            "check" is optional in most tournaments (and considered unnecessary). Taking back moves, normal 
            in casual play, is absolutely forbidden.
          </p>

          <p>
            Our simulator helps you eliminate these habits before they cost you rating points. The 
            strict enforcement of proper procedures builds confidence for tournament play, so you can 
            focus on chess rather than worrying about protocol.
          </p>

          <h3>From Simulation to Success</h3>
          <p>
            The transition from online to OTB chess challenges every player, but proper preparation 
            makes the difference between a frustrating debut and a confident performance. Our OTB 
            Tournament Simulator provides the realistic training environment you need to develop 
            authentic tournament skills. Master touch-move discipline, perfect your clock technique, 
            and internalize proper castling mechanics — all from the comfort of your screen, ready 
            to transfer to the tournament hall.
          </p>

          <SEOCrossLinks currentPath="/otb-tournament-simulator" />
        </article>
      </div>
    </div>
  );
}
