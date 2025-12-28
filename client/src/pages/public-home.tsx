import { Link } from "wouter";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Eye, Clock, Brain, Navigation, Crown, Puzzle, RotateCw, Book, Users } from "lucide-react";
import heroImage from "@assets/stock_images/simulchess-hero-2025.webp";

const landingPages = [
  {
    title: "Blindfold Chess Training",
    description: "Our voice-controlled blindfold system allows you to practice visualization without looking at a screen, mimicking the mental calculation grandmasters use during deep mid-game analysis.",
    url: "/blindfold-chess-training",
    icon: Eye,
  },
  {
    title: "OTB Tournament Simulator",
    description: "Practice real over-the-board tournament conditions. Manual clock pressing, touch-move rules, and arbiter warnings.",
    url: "/otb-tournament-simulator",
    icon: Clock,
  },
  {
    title: "Simul Chess Training",
    description: "Manage up to 12 boards simultaneously using our First-In-First-Out (FIFO) queue, specifically designed to help simul givers maintain a steady rhythm and avoid time pressure blunders.",
    url: "/simul-chess-training",
    icon: Users,
  },
  {
    title: "Knight's Tour Puzzle",
    description: "The classic mathematical chess puzzle. Visit every square exactly once with your knight.",
    url: "/knights-tour-puzzle",
    icon: Navigation,
  },
  {
    title: "N-Piece Challenge",
    description: "Maneuver different piece types into non-attacking positions in this complex evolution of the classic N-Queens challenge.",
    url: "/chess-piece-challenge",
    icon: Crown,
  },
  {
    title: "Chess Puzzles",
    description: "Sharpen your tactics with community-created puzzles. Solve, rate, and create your own challenges.",
    url: "/chess-puzzles-trainer",
    icon: Puzzle,
  },
  {
    title: "Board Spin",
    description: "Improve board orientation with randomly rotated positions. Train to see the board from any angle.",
    url: "/chess-board-spin",
    icon: RotateCw,
  },
  {
    title: "Opening Repertoire Trainer",
    description: "Build and drill your opening repertoire. Practice lines until they become second nature.",
    url: "/opening-repertoire-trainer",
    icon: Book,
  },
];

export default function PublicHomePage() {
  return (
    <div className="min-h-screen -m-4">
      <Helmet>
        <title>SimulChess: Chess Training | Master OTB, Blindfold & Simul Chess</title>
        <meta name="description" content="SimulChess: a chess training platform. Master OTB, strengthen memory with blindfold training, and dominate simul games. Free chess trainer." />
        <meta property="og:title" content="SimulChess: Chess Training | Master OTB, Blindfold & Simul Chess" />
        <meta property="og:description" content="SimulChess: a chess training platform. Master OTB, strengthen memory with blindfold training, and dominate simul games. Free chess trainer." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://simulchess.com/" />
        <meta property="og:image" content="https://simulchess.com/og-home.png" />
        <link rel="canonical" href="https://simulchess.com/" />
      </Helmet>
      <section className="hero-container relative z-0 w-full min-h-[80vh] overflow-hidden pt-12">
        <div className="absolute inset-0">
          <img
            src={heroImage}
            alt="Chess tournament player in deep concentration"
            className="w-full h-full object-cover object-center"
            fetchPriority="high"
            decoding="async"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-black/80" />
        </div>
        <div className="relative h-full flex items-center px-8 py-8 md:py-24">
          <div className="max-w-2xl space-y-6">
            <h1 className="hero-title text-4xl md:text-5xl font-bold text-white leading-tight" data-testid="text-hero-title">
              SimulChess: Professional OTB & Blindfold Chess Training Platform
            </h1>
            <p className="hero-subtitle text-lg md:text-xl text-white/90 leading-relaxed" data-testid="text-hero-subtitle">
              SimulChess is your professional chess training platform. Master OTB habits, 
              strengthen memory, and dominate simultaneous exhibitions.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button 
                size="lg" 
                asChild 
                className="bg-white/10 backdrop-blur-md border border-white/20 text-white hover:bg-white/20"
                data-testid="button-hero-join"
              >
                <a href="/signup">
                  Join Now
                  <ArrowRight className="ml-2 h-5 w-5" />
                </a>
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                asChild 
                className="bg-white/10 backdrop-blur-md border border-white/20 text-white hover:bg-white/20"
                data-testid="button-hero-explore"
              >
                <a href="#features">Explore Features</a>
              </Button>
            </div>
            <p className="text-sm text-white/70" data-testid="text-login-info">
              Secure, one-click login via Google or GitHub. Start your training instantly without managing another set of credentials, while your progress is safely synced across all devices.
            </p>
          </div>
        </div>
      </section>

      <section className="py-12 px-8" id="features">
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2" data-testid="text-features-title">Training Modes</h2>
          <p className="text-muted-foreground">
            Eight specialized modes to elevate every aspect of your chess game
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {landingPages.map((page) => (
            <Link key={page.url} href={page.url}>
              <Card className="h-full hover-elevate cursor-pointer" data-testid={`card-feature-${page.url.slice(1)}`}>
                <CardHeader className="pb-2">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                    <page.icon className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-lg">{page.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm">
                    {page.description}
                  </CardDescription>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section className="py-12 px-8 border-t">
        <div className="prose prose-neutral dark:prose-invert max-w-none">
          <h2 className="text-2xl font-bold mb-4" data-testid="text-about-title">Why SimulChess?</h2>
          
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-xl font-semibold mb-3">Train Like You Play</h3>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Most online chess platforms focus on rapid play with automatic move validation and instant clock switching. 
                SimulChess is different. We simulate the authentic over-the-board tournament experience where you must 
                physically press your clock, follow touch-move rules, and handle the psychological pressure of real competition.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Unlike traditional online chess servers that automate the boring parts, SimulChess forces you to develop the 
                muscle memory required for tournament success. By requiring manual clock presses and enforcing strict touch-move 
                protocols, we eliminate the "lazy habits" that often lead to blunders in real-world <Link href="/otb-tournament-simulator" className="text-primary hover:underline">Over-The-Board (OTB)</Link> settings. 
                Our platform is built for the competitive player who wants their digital practice to translate directly to the physical board.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Our Stockfish-powered analysis engine provides deep insights into your games, identifying patterns in your 
                play and offering personalized coaching based on your thinking time, accuracy, and psychological tendencies.
              </p>
            </div>
            
            <div>
              <h3 className="text-xl font-semibold mb-3">Visualization & Memory Training</h3>
              <p className="text-muted-foreground leading-relaxed mb-4">
                <Link href="/blindfold-chess-training" className="text-primary hover:underline">Blindfold chess</Link> is the ultimate test of visualization ability. Our progressive training system helps you 
                develop this crucial skill through voice-controlled gameplay and a unique peek system that gradually 
                weans you off visual dependency.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Combined with <Link href="/chess-board-spin" className="text-primary hover:underline">Board Spin</Link> exercises that challenge your spatial orientation and Knight's Tour puzzles that 
                sharpen your pattern recognition. Designed to become the new standard for competitive visualization training, 
                SimulChess bridges the gap between casual play and tournament-ready mental focus.
              </p>
            </div>
          </div>

          <div className="mt-8 p-6 bg-muted/50 rounded-lg">
            <h3 className="text-xl font-semibold mb-3">Simultaneous Exhibition Mastery</h3>
            <p className="text-muted-foreground leading-relaxed">
              Giving a simul requires a completely different skill set than standard chess. You need to manage multiple 
              positions simultaneously, maintain focus across 5 boards, and make quick but accurate decisions under time 
              pressure. Our revolutionary timer system only counts down when you're actively viewing a board, allowing you 
              to practice true simul conditions without artificial time stress. Join the <Link href="/simul-chess-training" className="text-primary hover:underline">Simul vs Simul</Link> games and compete 
              against other multi-board masters.
            </p>
          </div>
        </div>
      </section>

      <section className="py-8 px-8 border-t">
        <div className="text-center">
          <p className="text-muted-foreground mb-4" data-testid="text-cta">
            Ready to elevate your chess training?
          </p>
          <Button asChild size="lg" data-testid="button-footer-join">
            <a href="/signup">
              Start Training Free
              <ArrowRight className="ml-2 h-5 w-5" />
            </a>
          </Button>
        </div>
      </section>
    </div>
  );
}
