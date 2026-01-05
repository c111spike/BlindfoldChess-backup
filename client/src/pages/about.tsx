import { Link } from "wouter";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Info, Target, Eye, Zap, Scale, Cpu, ArrowLeft, ArrowRight, Code2 } from "lucide-react";
import { SiReplit, SiCloudflare, SiPostgresql } from "react-icons/si";

export default function About() {
  return (
    <div className="min-h-full p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader className="flex flex-row items-center gap-3">
            <Info className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold leading-none tracking-tight">About SimulChess</h1>
              <p className="text-sm text-muted-foreground mt-1" data-testid="text-about-subtitle">Where you go to be better at chess</p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              {/* Philosophy Section */}
              <section>
                <p className="text-muted-foreground leading-relaxed mb-4" data-testid="text-philosophy-intro">
                  Our "About" page isn't just a list of features—it's the philosophy behind our code. At SimulChess, we recognize that the greatest hurdle for the modern player is the <strong>"Online-to-OTB Gap."</strong> While digital platforms are great for volume, they often fail to train the stamina, visualization, and etiquette required in a tournament hall.
                </p>
              </section>

              {/* The Problem */}
              <section>
                <h2 className="text-xl font-semibold mb-3 flex items-center gap-2" data-testid="text-problem-heading">
                  <Target className="h-5 w-5 text-primary" />
                  The Problem: The "Click-to-Piece" Gap
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-4" data-testid="text-problem-description">
                  Most online players struggle when they transition to a physical board. The perspective changes, the pieces feel different, and the safety net of "illegal move prevention" disappears.
                </p>
                <p className="text-muted-foreground leading-relaxed font-medium" data-testid="text-problem-solution">
                  SimulChess was built to close this gap by reintroducing the friction and focus of real-world chess into a digital environment.
                </p>
              </section>

              {/* Core Pillars */}
              <section>
                <h2 className="text-xl font-semibold mb-4" data-testid="text-pillars-heading">Our Core Pillars of Training</h2>
                
                <div className="space-y-6">
                  {/* Pillar 1: Visual-Spatial Mastery */}
                  <div className="p-4 rounded-lg border" data-testid="pillar-visual">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Eye className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold mb-2">1. Visual-Spatial Mastery</h3>
                        <p className="text-muted-foreground leading-relaxed mb-3">
                          We don't just want you to <em>see</em> the board; we want you to <strong>know</strong> it. Our Board Spin and Blindfold modes are based on cognitive "Chunking" research—the science of how Grandmasters recognize patterns rather than individual squares.
                        </p>
                        <ul className="text-sm text-muted-foreground space-y-2">
                          <li><strong>Chunking Theory:</strong> Masters perceive the board in "chunks" of 3-5 coordinated pieces.</li>
                          <li><strong>Orientation Training:</strong> By rotating the board, we break "viewpoint dependency," ensuring you can spot tactics even when looking from your opponent's perspective.</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Pillar 2: Simultaneous Advantage */}
                  <div className="p-4 rounded-lg border" data-testid="pillar-simul">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Zap className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold mb-2">2. The Simultaneous Advantage</h3>
                        <p className="text-muted-foreground leading-relaxed mb-3">
                          Simultaneous exhibitions (Simuls) are the ultimate test of pattern recognition speed. When you play 5 boards at once, you don't have time to calculate every line. You must rely on pure intuition.
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Our <strong>Simul vs. Simul</strong> mode trains you to make high-quality "instinct moves," a skill that is invaluable in time-scrambles during OTB tournaments.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Pillar 3: Professional Etiquette */}
                  <div className="p-4 rounded-lg border" data-testid="pillar-etiquette">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Scale className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold mb-2">3. Professional Etiquette & Rules</h3>
                        <p className="text-muted-foreground leading-relaxed mb-3">
                          In a real tournament, an illegal move can cost you the game. SimulChess is one of the few platforms that simulates these stakes.
                        </p>
                        <ul className="text-sm text-muted-foreground space-y-2">
                          <li><strong>Touch-Move & Manual Clocks:</strong> Encourages deliberate movement.</li>
                          <li><strong>The Handshake Ritual:</strong> Builds the habit of sportsmanship that defines the OTB community.</li>
                          <li><strong>The 30-Second Arbiter Rule:</strong> Keeps you alert. In our OTB mode, you must catch your opponent's mistakes yourself, just like in a real game.</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Technology Section */}
              <section>
                <h2 className="text-xl font-semibold mb-3 flex items-center gap-2" data-testid="text-tech-heading">
                  <Cpu className="h-5 w-5 text-primary" />
                  Our Technology: Powering Performance
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-4" data-testid="text-tech-description">
                  While our mission is human-centric, our engine is world-class.
                </p>
                <ul className="text-muted-foreground space-y-2">
                  <li><strong>Stockfish Integration:</strong> Every game is analyzed to show you not just the "Best Move," but your Accuracy of Game and Burnout Levels.</li>
                  <li><strong>Secure Authentication:</strong> We use Better-Auth, a world-class authentication framework, to ensure your identity and training data are protected. By using a secure, database-backed session model rather than vulnerable client-side storage, we guarantee that your VSS Mismatch scores and puzzle progress stay private, encrypted, and accessible only to you.</li>
                </ul>
              </section>

              {/* Built With - Tech Stack Transparency */}
              <section>
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2" data-testid="text-built-with-heading">
                  <Code2 className="h-5 w-5 text-primary" />
                  Built With
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-4" data-testid="text-built-with-description">
                  SimulChess is built by a solo developer passionate about bridging the online-to-OTB gap. 
                  Here's the technology stack powering your training:
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 rounded-lg border text-center" data-testid="tech-replit">
                    <SiReplit className="h-8 w-8 mx-auto mb-2 text-orange-500" />
                    <p className="font-medium text-sm">Replit</p>
                    <p className="text-xs text-muted-foreground">Development & Hosting</p>
                  </div>
                  <div className="p-4 rounded-lg border text-center" data-testid="tech-cloudflare">
                    <SiCloudflare className="h-8 w-8 mx-auto mb-2 text-orange-400" />
                    <p className="font-medium text-sm">Cloudflare</p>
                    <p className="text-xs text-muted-foreground">CDN & Security</p>
                  </div>
                  <div className="p-4 rounded-lg border text-center" data-testid="tech-postgresql">
                    <SiPostgresql className="h-8 w-8 mx-auto mb-2 text-blue-500" />
                    <p className="font-medium text-sm">PostgreSQL</p>
                    <p className="text-xs text-muted-foreground">Neon Serverless DB</p>
                  </div>
                  <div className="p-4 rounded-lg border text-center" data-testid="tech-stockfish">
                    <Cpu className="h-8 w-8 mx-auto mb-2 text-green-500" />
                    <p className="font-medium text-sm">Stockfish</p>
                    <p className="text-xs text-muted-foreground">Client-Side WASM</p>
                  </div>
                </div>
              </section>

              {/* Call to Action */}
              <section className="p-6 rounded-lg border bg-primary/5" data-testid="section-cta">
                <h2 className="text-xl font-semibold mb-3" data-testid="text-cta-heading">Join the Evolution</h2>
                <p className="text-muted-foreground leading-relaxed mb-4" data-testid="text-cta-description">
                  SimulChess is more than a game; it's a high-performance gym for your chess brain. We are constantly evolving, adding features like YouTube-linked puzzles and Psychology Analysis to give you the edge you need to succeed in the tournament hall.
                </p>
                <Link href="/signup">
                  <Button data-testid="button-start-playing">
                    Start Training
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </section>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
