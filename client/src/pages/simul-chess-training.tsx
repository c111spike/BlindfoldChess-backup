import { Link, useLocation } from "wouter";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SEOCrossLinks } from "@/components/seo-cross-links";
import { Users, Grid3X3, Clock, Brain, BookOpen, Trophy, Zap, ArrowLeft, Bot } from "lucide-react";

export default function SimulChessTraining() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Simul Chess Training - Simultaneous Exhibition Practice | SimulChess</title>
        <meta name="description" content="Master the art of multi-board chess with SimulChess. Train in unique Simul vs Simul modes, build elite pattern recognition through 'chunking,' and track your progress with specialized Simul ELO." />
        <meta property="og:title" content="Simul Chess Training - SimulChess" />
        <meta property="og:description" content="Master the art of multi-board chess with SimulChess. Train in unique Simul vs Simul modes, build elite pattern recognition through 'chunking,' and track your progress with specialized Simul ELO." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://simulchess.com/simul-chess-training" />
        <meta property="og:image" content="https://simulchess.com/og-simul.png" />
        <link rel="canonical" href="https://simulchess.com/simul-chess-training" />
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
            <Grid3X3 className="h-10 w-10 text-primary" />
            <h1 className="text-3xl md:text-4xl font-bold">Simul Chess Training</h1>
          </div>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Master the art of simultaneous exhibitions with multi-board training
          </p>
        </div>

        <Card className="mb-8">
          <CardContent className="pt-6">
            <div className="grid md:grid-cols-3 gap-4 mb-6">
              <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                <Grid3X3 className="h-6 w-6 text-primary shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold">Multiple Boards</h3>
                  <p className="text-sm text-muted-foreground">Manage 5 games simultaneously</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                <Users className="h-6 w-6 text-primary shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold">Simul vs Simul</h3>
                  <p className="text-sm text-muted-foreground">All players manage multiple games</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                <Clock className="h-6 w-6 text-primary shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold">Time Management</h3>
                  <p className="text-sm text-muted-foreground">30 seconds per move, per board</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-4 rounded-lg bg-primary/10 border border-primary/20 mb-6">
              <Bot className="h-6 w-6 text-primary shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold">Adaptive Bot Intelligence (ABI)</h3>
                <p className="text-sm text-muted-foreground">
                  Never wait for a Simul vs Simul match. Our Adaptive Bot Intelligence monitors the queue. 
                  If a human opponent isn't found within 60 seconds, our system injects Elo-weighted bot 
                  personalities to ensure your training never stops.
                </p>
              </div>
            </div>

            <Button 
              size="lg" 
              className="w-full"
              onClick={() => setLocation("/simul-vs-simul")}
              data-testid="button-start-simul-training"
            >
              <Grid3X3 className="mr-2 h-5 w-5" />
              Start Simul Training
            </Button>
            <p className="text-sm text-muted-foreground text-center mt-3">
              Challenge yourself with multiple simultaneous games against opponents
            </p>
          </CardContent>
        </Card>

        <article className="prose prose-neutral dark:prose-invert max-w-none">
          <h2 className="flex items-center gap-2">
            <BookOpen className="h-6 w-6" />
            Simultaneous Chess Exhibitions: Training for Multi-Board Mastery
          </h2>

          <p>
            Take on the ultimate multi-tasking challenge with SimulChess. Our unique Simul vs Simul mode lets 
            you practice simultaneous exhibitions while mastering time management and building elite pattern 
            recognition. Unlike traditional simuls where one master faces many opponents, Simul vs Simul has 
            all players managing multiple boards — creating an entirely new competitive format that trains 
            skills impossible to develop in single-game play.
          </p>

          <h3>What Makes Simul Chess Special</h3>
          <p>
            Simultaneous chess has a legendary history, from Paul Morphy's blindfold simuls to the 2011 
            world record set by GM Ehsan Ghaem Maghami, who played <strong>604 boards simultaneously 
            over 25 hours</strong>. While our training starts at 5 boards, it builds the same foundational 
            endurance used by record-breakers.
          </p>

          <p>
            In a simultaneous exhibition, the simul giver must maintain awareness of multiple positions 
            while making quick, accurate decisions at each board. There's no time for deep calculation on 
            any single game — instead, pattern recognition and positional understanding must guide rapid 
            move selection. This pressure-cooker environment develops chess intuition faster than any 
            other training method.
          </p>

          <p>
            Our Simul vs Simul format elevates this challenge further. When all players manage multiple 
            boards, the cognitive demands multiply. You must not only remember your positions but also 
            track your opponent's activity across games, making strategic decisions about which boards 
            to prioritize and when to play for quick wins versus solid draws. Our auto-switcher feature 
            keeps the action flowing — as soon as you make a move, the system automatically switches 
            to the next board awaiting your attention.
          </p>

          <h3>Cognitive Benefits of Multi-Board Play</h3>
          <p>
            Research in cognitive psychology has shown that managing multiple tasks simultaneously 
            strengthens executive function, working memory, and attention control. Simul chess provides 
            an ideal vehicle for developing these abilities in a chess-specific context. Players who 
            train with simuls often report improved focus and faster decision-making in single-game play.
          </p>

          <p>
            The context-switching required in simul chess also builds mental flexibility. Moving from a 
            sharp tactical position on one board to a quiet positional game on another exercises different 
            chess thinking modes in rapid succession. This variety within a single session provides more 
            comprehensive training than playing sequential single games.
          </p>

          <h3>Time Management Across Multiple Boards</h3>
          <p>
            Our Simul vs Simul mode uses a 30-second per-move timer for each board. The timer only 
            starts when you navigate to that specific board — giving you time to assess the position 
            before your clock begins. Once you're viewing a board where it's your turn, you have 30 
            seconds to make your move. After you move, the auto-switcher immediately takes you to the 
            next board and a fresh 30-second timer begins. This seamless flow keeps the pressure on 
            while eliminating manual board navigation.
          </p>

          <p>
            Successful simul players develop strategies for managing this time pressure. Some focus 
            on simplifying positions to reduce calculation needs. Others prioritize critical boards 
            while maintaining safe, waiting positions on others. The optimal approach depends on your 
            playing style and the specific positions you face, but practicing with time pressure is 
            essential for developing your personal strategy.
          </p>

          <p>
            <strong>Combatting Decision Fatigue:</strong> In a 5-board simul, you will make hundreds of 
            decisions in a short window. Successful trainers use the "First Best Move" principle: if a 
            move looks solid and safe, play it instantly to save your mental energy for the critical 
            tactical boards. Overthinking routine positions drains the cognitive resources you need 
            when complications arise.
          </p>

          <h3>Strategic Considerations in Simul Play</h3>
          <p>
            Multi-board chess introduces strategic elements that don't exist in single-game play. 
            You must decide how to allocate your mental energy across boards. Is it better to push 
            for wins on favorable boards or defend carefully on difficult ones? Should you play quickly 
            to pressure your opponent's time management, or focus on accuracy even if it means using 
            more clock?
          </p>

          <p>
            Board prioritization becomes crucial as games reach critical phases. Missing a tactical 
            opportunity on one board while focused on another is frustrating but inevitable — the 
            key is developing the judgment to identify which positions demand immediate attention 
            and which can wait.
          </p>

          <h3>Building Pattern Recognition Through Chunking</h3>
          <p>
            Perhaps the greatest benefit of simul training is accelerated pattern recognition development. 
            Cognitive scientists call this <strong>"Chunking"</strong> — the ability to group individual 
            pieces into meaningful clusters. By training with 5 boards at once, you force your brain to 
            stop "reading" move-by-move and start "recognizing" entire structures instantly. When you 
            can't calculate deeply, you must rely on positional patterns and tactical motifs you've 
            internalized, building the intuitive understanding that characterizes strong players.
          </p>

          <p>
            Over time, simul practice creates a library of positions you can assess almost instantly. 
            You'll recognize pawn structures, piece placements, and tactical setups at a glance, 
            making accurate decisions even under severe time pressure. These skills transfer directly 
            to regular play, where having deeper pattern recognition means faster, more accurate moves.
          </p>

          <h3>Preparing to Give Real Simuls</h3>
          <p>
            If your goal is giving actual simultaneous exhibitions, our training mode provides excellent 
            preparation. Currently, you can practice with 5 boards simultaneously — enough to develop 
            the core multi-board skills needed for real exhibitions. Pay attention to physical and mental 
            fatigue patterns — real simuls require stamina that develops only through practice. The bot 
            opponents in training mode help you maintain focus without the social complexity of multiple 
            human opponents.
          </p>

          <p>
            Real simuls require consistent opening play to simplify board maintenance. Consider developing 
            a narrow opening repertoire that leads to familiar structures, reducing the cognitive load 
            across many games. Our training mode lets you test different approaches and find what works 
            for your playing style.
          </p>

          <h3>The Unique Challenge of Simul vs Simul</h3>
          <p>
            Our Simul vs Simul format creates a competitive experience unavailable anywhere else. When 
            all players manage multiple boards, traditional advantages shift. A player who excels at 
            single-game calculation may struggle against someone with superior multi-tasking ability. 
            The format rewards different skills, making it an excellent supplement to traditional chess 
            training and a unique competitive format in its own right.
          </p>

          <h3>Track Your Progress with Simul ELO</h3>
          <p>
            SimulChess features a dedicated Simul ELO rating system, separate from your standard chess 
            rating. Your Simul rating reflects your multi-board management abilities specifically — 
            rewarding players who excel at juggling multiple games, making quick decisions, and maintaining 
            accuracy under the unique pressures of simultaneous play. Watch your Simul rating grow as you 
            develop these specialized skills.
          </p>

          <h3>Voice Input: Hands-Free Move Entry</h3>
          <p>
            Managing multiple boards means constant navigation and clicking — unless you enable voice input. 
            SimulChess offers optional voice commands that let you speak your moves: "knight to f3," "bishop 
            takes c6," "castle kingside." Voice commands work across all your boards, letting you make moves 
            without interrupting your visual scan of the positions. For serious simul players, hands-free 
            move entry transforms the multi-board experience.
          </p>

          <div className="not-prose mt-8 mb-8">
            <Button 
              size="lg" 
              className="w-full"
              onClick={() => setLocation("/simul-vs-simul")}
              data-testid="button-start-simul-training-bottom"
            >
              <Grid3X3 className="mr-2 h-5 w-5" />
              Start Simul Training
            </Button>
          </div>

          <SEOCrossLinks currentPath="/simul-chess-training" />
        </article>
      </div>
    </div>
  );
}
