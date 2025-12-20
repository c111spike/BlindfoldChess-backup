import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Info, Target, Users, Brain, Trophy } from "lucide-react";

export default function About() {
  return (
    <div className="min-h-full p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader className="flex flex-row items-center gap-3">
            <Info className="h-8 w-8 text-primary" />
            <div>
              <CardTitle className="text-2xl md:text-3xl">About SimulChess</CardTitle>
              <p className="text-sm text-muted-foreground mt-1" data-testid="text-about-subtitle">Professional chess training platform</p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              <section>
                <h2 className="text-xl font-semibold mb-3 flex items-center gap-2" data-testid="text-mission-heading">
                  <Target className="h-5 w-5 text-primary" />
                  Our Mission
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-4" data-testid="text-mission-description">
                  SimulChess is designed to enhance over-the-board (OTB) chess habits, strengthen memory, and master simultaneous exhibition gameplay. We believe that while there are many places to play chess online, SimulChess is where you go to become a better chess player.
                </p>
                <p className="text-muted-foreground leading-relaxed mb-4" data-testid="text-mission-origin">
                  <strong>Founded in 2025</strong>, SimulChess began as a project to help players bridge the gap between fast-paced online play and the deep concentration required for tournament chess.
                </p>
                <p className="text-muted-foreground leading-relaxed" data-testid="text-mission-active-learning">
                  We focus on <strong>Active Learning</strong>—the idea that you learn best by doing. Whether it's managing 5 boards at once or recreating a position from memory, our tools are designed to push your cognitive limits.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3 flex items-center gap-2" data-testid="text-features-heading">
                  <Brain className="h-5 w-5 text-primary" />
                  Training Modes
                </h2>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="p-4 rounded-lg border" data-testid="feature-otb">
                    <h3 className="font-semibold mb-2">OTB Tournament Mode</h3>
                    <p className="text-sm text-muted-foreground">
                      Simulates real over-the-board tournament conditions with touch-move rules, manual clock management, and arbiter warnings.
                    </p>
                  </div>
                  <div className="p-4 rounded-lg border" data-testid="feature-blindfold">
                    <h3 className="font-semibold mb-2">Blindfold Training</h3>
                    <p className="text-sm text-muted-foreground">
                      Develop your visualization and memory skills with our progressive blindfold training system.
                    </p>
                  </div>
                  <div className="p-4 rounded-lg border" data-testid="feature-simul">
                    <h3 className="font-semibold mb-2">Simul vs Simul</h3>
                    <p className="text-sm text-muted-foreground">
                      Train multi-board management with our unique Simul vs Simul championships.
                    </p>
                  </div>
                  <div className="p-4 rounded-lg border" data-testid="feature-puzzles">
                    <h3 className="font-semibold mb-2">Puzzles & Challenges</h3>
                    <p className="text-sm text-muted-foreground">
                      Sharpen your tactics with Board Spin, N-Piece Challenge, Knight's Tour, and community puzzles.
                    </p>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3 flex items-center gap-2" data-testid="text-community-heading">
                  <Users className="h-5 w-5 text-primary" />
                  Community
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-4" data-testid="text-community-description">
                  SimulChess is built by chess enthusiasts for chess enthusiasts. Join our growing community of players who are serious about improving their over-the-board performance. All training modes are completely free, supported by non-intrusive advertising.
                </p>
                <p className="text-muted-foreground leading-relaxed" data-testid="text-community-puzzles">
                  <strong>Our community is the heart of SimulChess.</strong> By creating and rating puzzles, our users help curate the most instructive training material available on the web.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3 flex items-center gap-2" data-testid="text-tech-heading">
                  <Trophy className="h-5 w-5 text-primary" />
                  Technology
                </h2>
                <p className="text-muted-foreground leading-relaxed" data-testid="text-tech-description">
                  Our platform uses Stockfish, one of the strongest chess engines in the world, to power game analysis, bot opponents, and position evaluation. This ensures you receive accurate feedback to improve your game.
                </p>
              </section>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
