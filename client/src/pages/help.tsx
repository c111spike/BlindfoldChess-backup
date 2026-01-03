import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HelpCircle, Mail, MessageCircle } from "lucide-react";
import { SiDiscord } from "react-icons/si";
import { Helmet } from "react-helmet-async";

export default function Help() {
  return (
    <div className="min-h-full p-4 md:p-8">
      <Helmet>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader className="flex flex-row items-center gap-3">
            <HelpCircle className="h-8 w-8 text-primary" />
            <div>
              <CardTitle className="text-2xl md:text-3xl">Help & Support</CardTitle>
              <p className="text-sm text-muted-foreground mt-1" data-testid="text-help-subtitle">Get help with SimulChess</p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              <section>
                <h2 className="text-xl font-semibold mb-3" data-testid="text-help-contact-heading">Contact Us</h2>
                <p className="text-muted-foreground leading-relaxed mb-6" data-testid="text-help-contact-description">
                  Have questions, feedback, or need assistance? Reach out to us through any of the channels below.
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
                          Join our Discord server for real-time support, discussions, and community updates.
                        </p>
                        <Button asChild variant="outline" size="sm" data-testid="link-discord">
                          <a 
                            href="https://discord.gg/avUEdKWYXs" 
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
                          Send us an email for detailed inquiries or issues that need investigation.
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
                <h2 className="text-xl font-semibold mb-3" data-testid="text-faq-heading">Frequently Asked Questions</h2>
                <div className="space-y-4">
                  <div data-testid="faq-report-bug">
                    <h3 className="font-medium mb-2" data-testid="text-faq-bug-question">How do I report a bug?</h3>
                    <p className="text-muted-foreground leading-relaxed" data-testid="text-faq-bug-answer">
                      You can report bugs through our Discord server or by sending an email. Please include as much detail as possible, such as what you were doing when the issue occurred and any error messages you saw.
                    </p>
                  </div>
                  <div data-testid="faq-report-cheating">
                    <h3 className="font-medium mb-2" data-testid="text-faq-cheating-question">How do I report a player for cheating?</h3>
                    <p className="text-muted-foreground leading-relaxed" data-testid="text-faq-cheating-answer">
                      Use the report button available during or after a game. Our anti-cheat system will review the report. You can also contact us directly with evidence.
                    </p>
                  </div>
                  <div data-testid="faq-training-modes">
                    <h3 className="font-medium mb-2" data-testid="text-faq-modes-question">How do the different training modes work?</h3>
                    <p className="text-muted-foreground leading-relaxed" data-testid="text-faq-modes-answer">
                      SimulChess offers multiple training modes designed to simulate over-the-board chess and build memory. OTB Tournament mode simulates real tournament conditions, Blindfold mode trains visualization, and Simul mode helps you manage multiple games simultaneously.
                    </p>
                  </div>
                  <div data-testid="faq-free">
                    <h3 className="font-medium mb-2" data-testid="text-faq-free-question">Is SimulChess free?</h3>
                    <p className="text-muted-foreground leading-relaxed" data-testid="text-faq-free-answer">
                      Yes! SimulChess is completely free to use. The platform is supported by non-intrusive advertising.
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
