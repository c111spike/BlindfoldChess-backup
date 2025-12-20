import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, MessageCircle } from "lucide-react";
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
                </div>
              </section>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
