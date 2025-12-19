import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Shield } from "lucide-react";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-full p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader className="flex flex-row items-center gap-3">
            <Shield className="h-8 w-8 text-primary" />
            <div>
              <CardTitle className="text-2xl md:text-3xl">Privacy Policy</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Last updated: December 2024</p>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[calc(100vh-16rem)]">
              <div className="space-y-6 pr-4">
                <section>
                  <h2 className="text-xl font-semibold mb-3" data-testid="text-privacy-intro-heading">Introduction</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    SimulChess ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our chess training platform.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">Information We Collect</h2>
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-medium mb-2">Account Information</h3>
                      <p className="text-muted-foreground leading-relaxed">
                        When you create an account through Replit authentication, we receive your username, profile picture, and unique user identifier. We do not store your password as authentication is handled by Replit.
                      </p>
                    </div>
                    <div>
                      <h3 className="font-medium mb-2">Game Data</h3>
                      <p className="text-muted-foreground leading-relaxed">
                        We collect and store your chess games, including move history, timestamps, game results, and performance statistics. This data is used to provide game analysis, track your progress, and calculate your ratings.
                      </p>
                    </div>
                    <div>
                      <h3 className="font-medium mb-2">Usage Data</h3>
                      <p className="text-muted-foreground leading-relaxed">
                        We automatically collect information about how you interact with our platform, including pages visited, features used, and time spent on various training modes.
                      </p>
                    </div>
                  </div>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">How We Use Your Information</h2>
                  <ul className="list-disc list-inside text-muted-foreground space-y-2">
                    <li>Provide and maintain our chess training services</li>
                    <li>Calculate and update your chess ratings across different game modes</li>
                    <li>Generate game analysis and personalized training recommendations</li>
                    <li>Enable multiplayer features and matchmaking</li>
                    <li>Improve our platform and develop new features</li>
                    <li>Detect and prevent cheating or abuse</li>
                    <li>Display relevant advertisements</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">Third-Party Services</h2>
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-medium mb-2">Replit Authentication</h3>
                      <p className="text-muted-foreground leading-relaxed">
                        We use Replit's OpenID Connect service for user authentication. Please review Replit's privacy policy for information about how they handle your data.
                      </p>
                    </div>
                    <div>
                      <h3 className="font-medium mb-2">Cloudflare</h3>
                      <p className="text-muted-foreground leading-relaxed">
                        We use Cloudflare for content delivery and security. Cloudflare may collect technical data such as IP addresses for security purposes.
                      </p>
                    </div>
                    <div>
                      <h3 className="font-medium mb-2">Advertising</h3>
                      <p className="text-muted-foreground leading-relaxed">
                        We display advertisements to support our free platform. Advertising partners may use cookies and similar technologies to serve relevant ads. You can manage your ad preferences through your browser settings.
                      </p>
                    </div>
                  </div>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">Cookies and Tracking</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    We use cookies and similar technologies to maintain your session, remember your preferences, and analyze platform usage. Essential cookies are required for the platform to function. You can control non-essential cookies through your browser settings.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">Data Retention</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    We retain your account information and game data for as long as your account is active. Game history is preserved to allow you to review past games and track long-term progress. You may request deletion of your account and associated data at any time.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">Your Rights</h2>
                  <p className="text-muted-foreground leading-relaxed mb-3">
                    Depending on your location, you may have the following rights regarding your personal data:
                  </p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-2">
                    <li>Access your personal data</li>
                    <li>Correct inaccurate data</li>
                    <li>Request deletion of your data</li>
                    <li>Object to certain processing activities</li>
                    <li>Export your data in a portable format</li>
                  </ul>
                  <p className="text-muted-foreground leading-relaxed mt-3">
                    To exercise these rights, please contact us through the platform settings or email.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">Data Security</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    We implement appropriate technical and organizational measures to protect your personal data against unauthorized access, alteration, disclosure, or destruction. This includes encryption, secure hosting, and regular security assessments.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">Children's Privacy</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    SimulChess is not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13. If you believe we have collected data from a child under 13, please contact us immediately.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">Changes to This Policy</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    We may update this Privacy Policy from time to time. We will notify you of any significant changes by posting the new policy on this page and updating the "Last updated" date.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">Contact Us</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    If you have questions about this Privacy Policy or our data practices, please contact us through the platform or visit our support channels.
                  </p>
                </section>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
