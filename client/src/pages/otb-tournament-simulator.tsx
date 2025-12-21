import { Link, useLocation } from "wouter";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SEOCrossLinks } from "@/components/seo-cross-links";
import { Clock, Trophy, Hand, Users, BookOpen, AlertTriangle, Target, ArrowLeft } from "lucide-react";

export default function OTBTournamentSimulator() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>OTB Tournament Simulator - Over the Board Chess Practice | SimulChess</title>
        <meta name="description" content="Bridge the gap between online and over-the-board play. Master touch-move, manual clock discipline, and FIDE-standard castling with the SimulChess OTB Tournament Simulator." />
        <meta property="og:title" content="OTB Tournament Simulator - SimulChess" />
        <meta property="og:description" content="Bridge the gap between online and over-the-board play. Master touch-move, manual clock discipline, and FIDE-standard castling with the SimulChess OTB Tournament Simulator." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://simulchess.com/otb-tournament-simulator" />
        <meta property="og:image" content="https://simulchess.com/og-otb.png" />
        <link rel="canonical" href="https://simulchess.com/otb-tournament-simulator" />
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
                  <p className="text-sm text-muted-foreground">Warnings and forced forfeits</p>
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
            Prepare for real tournaments with SimulChess's OTB Simulator. Master touch-move rules and manual 
            clocks while building the habits you need to dominate the board. The physical presence of your 
            opponent, the tactile sensation of moving pieces, the ritual of pressing the clock — these elements 
            create a unique competitive environment that catches many online players off guard. Our simulator 
            bridges this gap, developing the skills needed for tournament success.
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
            builds the muscle memory needed for smooth, confident clock handling under pressure. We recommend 
            hitting the spacebar with the same hand you used to move the piece — this simulates the natural 
            motion of reaching across to tap a physical clock after completing your move.
          </p>

          <h3>Visual Realism: True Perspective Fixed 3D View</h3>
          <p>
            Stop training on a flat 2D grid that looks nothing like a real tournament table. In an actual event, 
            you see the board from a fixed, angled perspective. Our <strong>Fixed 3D Perspective</strong> mimics 
            the exact eye-level of a seated player.
          </p>

          <p>
            <strong>The Benefit:</strong> Most online players struggle to see "long diagonals" or knight forks on 
            a real board because the spatial geometry is different.
          </p>

          <p>
            <strong>The Result:</strong> By locking the camera in a realistic 3D position, you build the specific 
            spatial awareness needed to spot tactics in a physical environment.
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
            system simulates this experience — but just like in real tournaments, the arbiter only acts 
            when your opponent calls you out on a violation. This keeps both players engaged and attentive 
            throughout the game, as each player must watch for their opponent's mistakes while avoiding 
            their own. The feedback system trains you to play cleanly and stay alert without needing 
            actual tournament experience.
          </p>

          <p>
            Our arbiter follows a consistent <strong>two-strike system</strong> for all violations. The first 
            offense triggers a warning with <strong>two minutes added to your opponent's clock</strong>. A second 
            offense of the same type results in a <strong>forced forfeit</strong>. Here's how each violation is handled:
          </p>

          <ul>
            <li>
              <strong>Handshake Violations:</strong> Refusing or failing to shake hands before the game? Your 
              opponent can call the arbiter. First offense adds two minutes to their clock. Refuse again and 
              you forfeit the game.
            </li>
            <li>
              <strong>Illegal Moves:</strong> Playing an illegal move and pressing the clock commits the violation. 
              First illegal move adds two minutes to your opponent. A second illegal move means immediate loss.
            </li>
            <li>
              <strong>False Claims:</strong> Incorrectly claiming a draw (threefold repetition, 50-move rule, etc.) 
              when the conditions aren't met? First false claim adds two minutes to your opponent. A second false 
              claim forfeits the game.
            </li>
          </ul>

          <p>
            <strong>Coming Soon:</strong> Chat distraction penalties. Attempting to distract your opponent through 
            inappropriate chat messages will trigger the same two-strike system — first offense adds two minutes 
            to their clock, second offense results in forfeit.
          </p>

          <p>
            This penalty structure mirrors real tournament rules and trains you to play with discipline. 
            Our simulator helps you avoid these costly mistakes by enforcing clean play and training you 
            to verify your moves before committing.
          </p>

          <h3>Proper OTB Etiquette</h3>
          <p>
            Tournament chess follows unwritten codes of conduct that new players often overlook. Our 
            simulator incorporates the pre-game handshake — a traditional gesture of sportsmanship 
            before the first move. This simple ritual sets the tone for respectful competition and 
            is expected at virtually every serious OTB event. Practicing this habit, even against 
            a computer opponent, prepares you for the social customs of tournament play.
          </p>

          <p>
            Beyond the handshake, good etiquette includes sitting quietly, avoiding distracting 
            behaviors, and treating your opponent with respect regardless of the game's outcome. 
            Keep your phone silenced and away from the board — many tournaments require phones to 
            be stored outside the playing area entirely or switched completely off in a bag at the table. 
            Even a phone vibrating can result in an <strong>immediate forfeit</strong> under 2025 FIDE and 
            US Chess regulations. These behaviors demonstrate professionalism and help you focus on the 
            game rather than external distractions.
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

          <h3>Pawn Promotion Mastery</h3>
          <p>
            In OTB chess, pawn promotion follows a specific sequence that online players often overlook. 
            The move is not complete until the new piece replaces the pawn on the board <strong>and</strong> you 
            press the clock. Our simulator mirrors this sequence, ensuring you don't accidentally leave a 
            pawn on the 8th rank — a technical "illegal move" in real tournaments that can cost you time 
            penalties or even the game.
          </p>

          <h3>Notation Mastery: Mastering the Scoresheet</h3>
          <p>
            In a rated tournament, if you don't write down your moves, you can't claim a draw or dispute an 
            illegal move. Our simulator removes the "automatic move list" safety net.
          </p>

          <p>
            <strong>Active Learning:</strong> You have the option to type your own moves in Standard Algebraic 
            Notation (SAN).
          </p>

          <p>
            <strong>The Interactive Arbiter:</strong> If you type a move incorrectly (e.g., writing Nf3 when it 
            should be Nxf3), a message instantly alerts you to the error and provides a mini-lesson on how to 
            correctly record that specific move.
          </p>

          <p>
            <strong>The Routine:</strong> This trains the essential <em>Move → Press Clock → Record</em> rhythm, 
            ensuring you never feel rushed or confused by your scoresheet during a real game.
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

          <div className="not-prose mt-8 mb-8">
            <Button 
              size="lg" 
              className="w-full"
              onClick={() => setLocation("/otb")}
              data-testid="button-start-otb-training-bottom"
            >
              <Trophy className="mr-2 h-5 w-5" />
              Start OTB Training
            </Button>
          </div>

          <SEOCrossLinks currentPath="/otb-tournament-simulator" />
        </article>
      </div>
    </div>
  );
}
