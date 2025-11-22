import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Brain, Grid3x3, Check, ArrowRight } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import heroImage from "@assets/generated_images/chess_tournament_hero_image.png";
import otbIcon from "@assets/generated_images/otb_tournament_mode_icon.png";
import blindfoldIcon from "@assets/generated_images/blindfold_mode_icon.png";
import simulIcon from "@assets/generated_images/simul_mode_icon.png";
import logoImage from "@assets/SimulChess Logo_1763799395309.png";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between max-w-7xl mx-auto px-4">
          <Link href="/" className="flex items-center space-x-2">
            <img src={logoImage} alt="SimulChess Logo" className="w-10 h-10 object-contain" />
            <span className="text-xl font-bold">SimulChess</span>
          </Link>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Button asChild variant="default" data-testid="button-login">
              <a href="/api/login">Log In</a>
            </Button>
          </div>
        </div>
      </header>

      <section className="relative w-full overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={heroImage}
            alt="Chess tournament player in deep concentration"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/50 to-black/70" />
        </div>
        <div className="relative container max-w-7xl mx-auto px-4 py-32 md:py-48">
          <div className="max-w-3xl space-y-8">
            <h1 className="text-5xl md:text-6xl font-bold text-white leading-tight">
              Master OTB. Strengthen Memory. Dominate Simuls.
            </h1>
            <p className="text-xl md:text-2xl text-white/90 leading-relaxed">
              Professional chess training platform designed to develop better OTB habits, 
              memory skills, and simultaneous exhibition gameplay.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button 
                size="lg" 
                asChild 
                className="bg-white/10 backdrop-blur-md border border-white/20 text-white hover:bg-white/20"
                data-testid="button-hero-start"
              >
                <a href="/api/login">
                  Start Training
                  <ArrowRight className="ml-2 h-5 w-5" />
                </a>
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                asChild 
                className="bg-white/10 backdrop-blur-md border border-white/20 text-white hover:bg-white/20"
                data-testid="button-hero-features"
              >
                <a href="#features">View Features</a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 bg-background" id="modes">
        <div className="container max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">Three Specialized Training Modes</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Each mode targets specific skills to elevate your chess performance
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="hover-elevate">
              <CardHeader className="space-y-4">
                <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center">
                  <img src={otbIcon} alt="OTB Tournament Mode" className="w-10 h-10" />
                </div>
                <CardTitle className="text-2xl">OTB Tournament Mode</CardTitle>
                <CardDescription className="text-base">
                  99% realistic FIDE tournament practice
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-muted-foreground">Manual clock pressing with physical feedback</p>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-muted-foreground">Arbiter AI with FIDE-accurate warnings</p>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-muted-foreground">3-level highlighting system</p>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-muted-foreground">Separate Elo for Bullet/Blitz/Rapid</p>
                </div>
              </CardContent>
            </Card>

            <Card className="hover-elevate">
              <CardHeader className="space-y-4">
                <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center">
                  <img src={blindfoldIcon} alt="Blindfold Mode" className="w-10 h-10" />
                </div>
                <CardTitle className="text-2xl">Blindfold Mode</CardTitle>
                <CardDescription className="text-base">
                  World's first voice-controlled blindfold chess
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-muted-foreground">Voice control for hands-free play</p>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-muted-foreground">Limited peek system to check your memory</p>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-muted-foreground">Progressive difficulty levels</p>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-muted-foreground">High-contrast visual design</p>
                </div>
              </CardContent>
            </Card>

            <Card className="hover-elevate">
              <CardHeader className="space-y-4">
                <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center">
                  <img src={simulIcon} alt="Simul Mode" className="w-10 h-10" />
                </div>
                <CardTitle className="text-2xl">FIFO Simul Mode</CardTitle>
                <CardDescription className="text-base">
                  Revolutionary per-move clock system
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-muted-foreground">Clock only runs when viewing a board</p>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-muted-foreground">Stress-free 100+ board simuls</p>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-muted-foreground">Text-only sidebar for quick scanning</p>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-muted-foreground">FIFO matchmaking and board ordering</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-24 bg-muted/30" id="features">
        <div className="container max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">Built for Serious Players</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Professional-grade training features trusted by tournament players worldwide
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-12 items-center mb-16">
            <div className="space-y-6">
              <h3 className="text-3xl font-semibold">Five Separate Elo Ratings</h3>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Track your progress across OTB Bullet, OTB Blitz, OTB Rapid, Blindfold, and Simul modes. 
                Each rating system uses proper Elo calculations to accurately reflect your skill development 
                in every discipline.
              </p>
              <div className="flex flex-wrap gap-3">
                <div className="px-4 py-2 bg-primary/10 rounded-lg border border-primary/20">
                  <span className="text-sm font-medium font-mono">OTB Bullet</span>
                </div>
                <div className="px-4 py-2 bg-primary/10 rounded-lg border border-primary/20">
                  <span className="text-sm font-medium font-mono">OTB Blitz</span>
                </div>
                <div className="px-4 py-2 bg-primary/10 rounded-lg border border-primary/20">
                  <span className="text-sm font-medium font-mono">OTB Rapid</span>
                </div>
                <div className="px-4 py-2 bg-primary/10 rounded-lg border border-primary/20">
                  <span className="text-sm font-medium font-mono">Blindfold</span>
                </div>
                <div className="px-4 py-2 bg-primary/10 rounded-lg border border-primary/20">
                  <span className="text-sm font-medium font-mono">Simul</span>
                </div>
              </div>
            </div>
            <div className="bg-card rounded-xl p-8 border space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">OTB Blitz</span>
                <span className="text-3xl font-bold font-mono">1487</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Blindfold</span>
                <span className="text-3xl font-bold font-mono">1312</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Simul</span>
                <span className="text-3xl font-bold font-mono">1556</span>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="bg-card rounded-xl p-8 border order-2 md:order-1">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Clock className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold">Game History</p>
                    <p className="text-sm text-muted-foreground">Last 50 games (Free)</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Brain className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold">Puzzle Training</p>
                    <p className="text-sm text-muted-foreground">Lichess database</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Grid3x3 className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold">Statistics Dashboard</p>
                    <p className="text-sm text-muted-foreground">Detailed analytics</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-6 order-1 md:order-2">
              <h3 className="text-3xl font-semibold">Complete Training Ecosystem</h3>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Beyond game modes, SimulChess offers puzzle training, comprehensive statistics, 
                and unlimited game history for premium users. Everything you need to improve your chess 
                in one professional platform.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 bg-background" id="pricing">
        <div className="container max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">Simple, Fair Pricing</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Start free, upgrade when you're ready. PPP-adjusted pricing for global accessibility.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            <Card>
              <CardHeader className="space-y-4">
                <CardTitle className="text-2xl">Free</CardTitle>
                <div>
                  <span className="text-5xl font-bold">$0</span>
                  <span className="text-muted-foreground ml-2">forever</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-3">
                  <li className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-sm">5 OTB games per day</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-sm">5 Blindfold games per day</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Last 50 games in history</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Unlimited puzzles</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Full statistics access</span>
                  </li>
                </ul>
                <Button variant="outline" className="w-full" asChild data-testid="button-pricing-free">
                  <a href="/api/login">Start Free</a>
                </Button>
              </CardContent>
            </Card>

            <Card className="border-primary shadow-lg">
              <CardHeader className="space-y-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-2xl">Premium</CardTitle>
                  <span className="px-3 py-1 bg-primary text-primary-foreground text-xs font-semibold rounded-full">
                    Popular
                  </span>
                </div>
                <div>
                  <span className="text-5xl font-bold">$4.99</span>
                  <span className="text-muted-foreground ml-2">/ month</span>
                </div>
                <p className="text-sm text-muted-foreground">PPP-adjusted: $0.99-$4.99 globally</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-3">
                  <li className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-sm font-semibold">Unlimited games across all modes</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-sm font-semibold">Unlimited game history</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Advanced statistics & analytics</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Priority support</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Early access to new features</span>
                  </li>
                </ul>
                <Button className="w-full" asChild data-testid="button-pricing-premium">
                  <a href="/api/login">Upgrade to Premium</a>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <footer className="bg-muted/30 border-t py-16">
        <div className="container max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2">
                <li><a href="#modes" className="text-sm text-muted-foreground hover:text-foreground">Modes</a></li>
                <li><a href="#features" className="text-sm text-muted-foreground hover:text-foreground">Features</a></li>
                <li><a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground">Pricing</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2">
                <li><a href="#" className="text-sm text-muted-foreground hover:text-foreground">About</a></li>
                <li><a href="#" className="text-sm text-muted-foreground hover:text-foreground">Blog</a></li>
                <li><a href="#" className="text-sm text-muted-foreground hover:text-foreground">Careers</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Resources</h4>
              <ul className="space-y-2">
                <li><a href="#" className="text-sm text-muted-foreground hover:text-foreground">Help Center</a></li>
                <li><a href="#" className="text-sm text-muted-foreground hover:text-foreground">Community</a></li>
                <li><a href="#" className="text-sm text-muted-foreground hover:text-foreground">Contact</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2">
                <li><a href="#" className="text-sm text-muted-foreground hover:text-foreground">Privacy</a></li>
                <li><a href="#" className="text-sm text-muted-foreground hover:text-foreground">Terms</a></li>
                <li><a href="#" className="text-sm text-muted-foreground hover:text-foreground">GDPR</a></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t text-center">
            <p className="text-sm text-muted-foreground mb-2">
              © 2025 SimulChess. All rights reserved.
            </p>
            <p className="text-xs text-muted-foreground">
              Age restriction: 13+ · Professional chess training platform
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
