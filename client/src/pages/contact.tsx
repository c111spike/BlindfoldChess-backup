import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, MessageCircle, Bug, Shield, Lightbulb, DollarSign, Scale, Users, ArrowLeft, Clock } from "lucide-react";
import { SiDiscord } from "react-icons/si";

export default function Contact() {
  return (
    <div className="min-h-full p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link href="/">
            <Button variant="ghost" size="sm" data-testid="button-back-home">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </Link>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center gap-3">
            <Mail className="h-8 w-8 text-primary" />
            <div>
              <CardTitle className="text-2xl md:text-3xl">Contact Us</CardTitle>
              <p className="text-sm text-muted-foreground mt-1" data-testid="text-contact-subtitle">Get in touch with SimulChess</p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              <section>
                <p className="text-muted-foreground leading-relaxed mb-6" data-testid="text-contact-description">
                  Have questions, feedback, or need assistance? Reach out to us through any of the channels below. We typically respond to email inquiries within 48 hours.
                </p>
                
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="p-6 rounded-lg border hover-elevate" data-testid="container-discord">
                    <div className="flex items-start gap-4">
                      <div className="p-3 rounded-lg bg-[#5865F2]/10">
                        <SiDiscord className="h-6 w-6 text-[#5865F2]" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold mb-1" data-testid="text-discord-heading">Discord Community</h3>
                        <p className="text-sm text-muted-foreground mb-3" data-testid="text-discord-description">
                          Join our Discord server for real-time support, game discussions, and community updates. This is the fastest way to get help or find a practice partner.
                        </p>
                        <Button asChild variant="outline" size="sm" data-testid="link-discord">
                          <a 
                            href="https://discord.com/channels/1441838870588293203/1441838871221375100" 
                            target="_blank" 
                            rel="noopener noreferrer"
                          >
                            <MessageCircle className="h-4 w-4 mr-2" />
                            Join Discord
                          </a>
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 rounded-lg border hover-elevate" data-testid="container-email">
                    <div className="flex items-start gap-4">
                      <div className="p-3 rounded-lg bg-primary/10">
                        <Mail className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold mb-1" data-testid="text-email-heading">Email Support</h3>
                        <p className="text-sm text-muted-foreground mb-3" data-testid="text-email-description">
                          For account-specific issues, legal inquiries, or detailed bug reports, please email us directly.
                        </p>
                        <Button asChild variant="outline" size="sm" data-testid="link-email">
                          <a href="mailto:simulchess.com@gmail.com">
                            <Mail className="h-4 w-4 mr-2" />
                            simulchess.com@gmail.com
                          </a>
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-4" data-testid="text-faq-heading">Frequently Asked Questions</h2>
                <div className="space-y-6">
                  <div className="p-4 rounded-lg border" data-testid="faq-report-bug">
                    <div className="flex items-start gap-3">
                      <Bug className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <div>
                        <h3 className="font-medium mb-2" data-testid="text-faq-bug-question">How do I report a bug effectively?</h3>
                        <p className="text-muted-foreground leading-relaxed mb-3" data-testid="text-faq-bug-answer">
                          A good bug report saves hours of investigation. To help us fix issues quickly, please include:
                        </p>
                        <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                          <li><strong>Environment:</strong> Are you on mobile or desktop? Which browser?</li>
                          <li><strong>The "Trigger":</strong> What were you clicking when it happened? (e.g., "I clicked 'Spin' while the piece was still moving.")</li>
                          <li><strong>Visual Evidence:</strong> Use a screenshot.</li>
                          <li><strong>Game Link:</strong> If the bug happened during a specific game, please include the URL.</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-lg border" data-testid="faq-report-cheating">
                    <div className="flex items-start gap-3">
                      <Shield className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <div>
                        <h3 className="font-medium mb-2" data-testid="text-faq-cheating-question">How do I report a player for cheating?</h3>
                        <p className="text-muted-foreground leading-relaxed mb-3" data-testid="text-faq-cheating-answer">
                          We take fair play seriously. Our Anti-Cheat System performs:
                        </p>
                        <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                          <li><strong>Move Correlation:</strong> Comparing move choices to Stockfish's top lines.</li>
                          <li><strong>Timing Analysis:</strong> Detecting the robotic cadence of engine-assisted play.</li>
                          <li><strong>VSS Mismatch</strong> Check: If a player has zero "Visualization Lapses" over 50 games, they are flagged for human review.</li>
                        </ul>
                        <p className="text-sm text-muted-foreground mt-3">
                          Click the <strong>Report</strong> button on their profile or in the post-game summary. For high-stakes events, you can email evidence to our support team.
                        </p>
                        <p className="text-xs text-muted-foreground mt-2 italic">
                          Note: To maintain the integrity of our detection methods, we do not disclose specific details of our internal reviews.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-lg border" data-testid="faq-arbiter">
                    <div className="flex items-start gap-3">
                      <Scale className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <div>
                        <h3 className="font-medium mb-2" data-testid="text-faq-arbiter-question">How does the arbiter system work?</h3>
                        <p className="text-muted-foreground leading-relaxed mb-3" data-testid="text-faq-arbiter-answer">
                          In <Link href="/otb-tournament-simulator" className="text-primary hover:underline">OTB Mode</Link>, our virtual arbiter enforces official tournament rules to simulate tournament conditions if the arbiter is called by a player. The board doesn't "stop" you from making an illegal move—just like a real wooden board wouldn't.
                        </p>
                        <div className="space-y-2 text-sm text-muted-foreground">
                          <div className="flex items-start gap-2">
                            <Clock className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
                            <p><strong>Detection:</strong> If an illegal move is made, the virtual arbiter waits for the opponent to "claim" it.</p>
                          </div>
                          <div className="flex items-start gap-2">
                            <Clock className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
                            <p><strong>The 30-Second Rule:</strong> If your opponent delivers an illegal checkmate, you have 30 seconds to click the "Claim Violation" button. If you don't, the result stands!</p>
                          </div>
                          <div className="flex items-start gap-2">
                            <Clock className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
                            <p><strong>Penalties:</strong> First-time illegal moves result in a 2-minute time penalty; a second offense means immediate forfeit.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-lg border" data-testid="faq-feature-suggestion">
                    <div className="flex items-start gap-3">
                      <Lightbulb className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <div>
                        <h3 className="font-medium mb-2" data-testid="text-faq-feature-question">Can I suggest a new feature?</h3>
                        <p className="text-muted-foreground leading-relaxed" data-testid="text-faq-feature-answer">
                          Yes! Our current training modules, including Board Spin and the Handshake mechanic, were created because users like you requested them. We prioritize features that help "Bridge the Gap" between online and over-the-board play. Post your ideas in the <strong>#suggestions</strong> channel on our Discord or send us an email.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-lg border" data-testid="faq-free">
                    <div className="flex items-start gap-3">
                      <DollarSign className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <div>
                        <h3 className="font-medium mb-2" data-testid="text-faq-free-question">Is SimulChess really free?</h3>
                        <p className="text-muted-foreground leading-relaxed" data-testid="text-faq-free-answer">
                          Yes. All training tools, puzzles, and game modes are free to use. We are supported by non-intrusive advertising to keep our servers running and our engine analysis high-quality.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Community Section */}
              <section className="p-6 rounded-lg border bg-primary/5" data-testid="section-community">
                <div className="flex items-start gap-3">
                  <Users className="h-6 w-6 text-primary shrink-0 mt-0.5" />
                  <div>
                    <h2 className="text-lg font-semibold mb-2" data-testid="text-community-heading">Community & Feedback Loop</h2>
                    <p className="text-muted-foreground leading-relaxed" data-testid="text-community-description">
                      SimulChess isn't just a platform; it's a living organism. When you report a bug or suggest a feature, you're helping us calibrate the "Arbiter" for thousands of other players. Our contact channels are designed to be as efficient as the chess moves we teach. Whether you're dealing with a technical glitch or a tactical question, we have a specialized path to get you the right answer.
                    </p>
                  </div>
                </div>
              </section>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
