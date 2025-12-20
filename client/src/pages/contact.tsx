import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, MessageCircle, Bug, Shield, Lightbulb, DollarSign, Scale } from "lucide-react";
import { SiDiscord } from "react-icons/si";

export default function Contact() {
  return (
    <div className="min-h-full p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
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
                          To help us fix issues quickly, please include:
                        </p>
                        <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                          <li><strong>Browser & Device:</strong> (e.g., Chrome on Windows 11)</li>
                          <li><strong>Steps to Reproduce:</strong> What were you clicking when it happened?</li>
                          <li><strong>Screenshots:</strong> A picture of the error or the board state is incredibly helpful.</li>
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
                          Fair play is our priority. If you suspect an opponent used engine assistance:
                        </p>
                        <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                          <li>Click the <strong>Report</strong> button on their profile or in the post-game summary.</li>
                          <li>Our anti-cheat system will analyze the move accuracy against Stockfish evaluations.</li>
                          <li>For high-stakes events, you can email evidence to our support team.</li>
                        </ul>
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
                        <p className="text-muted-foreground leading-relaxed" data-testid="text-faq-arbiter-answer">
                          In OTB Tournament Mode, our virtual arbiter enforces official FIDE rules to simulate real tournament conditions. The arbiter monitors for touch-move violations, illegal moves, and proper clock management. First-time illegal moves result in a 2-minute time penalty; a second offense means immediate forfeit. This system helps you develop the discipline needed for serious over-the-board competition.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-lg border" data-testid="faq-feature-suggestion">
                    <div className="flex items-start gap-3">
                      <Lightbulb className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <div>
                        <h3 className="font-medium mb-2" data-testid="text-faq-feature-question">Can I suggest a new feature?</h3>
                        <p className="text-muted-foreground leading-relaxed" data-testid="text-faq-feature-answer">
                          Absolutely! Most of our training modes—like Board Spin and Simul vs Simul—evolved from community feedback. Post your ideas in the <strong>#suggestions</strong> channel on our Discord or send us an email.
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
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
