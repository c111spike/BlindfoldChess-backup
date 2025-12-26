import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, ArrowLeft } from "lucide-react";

export default function TermsOfService() {
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
            <FileText className="h-8 w-8 text-primary" />
            <div>
              <CardTitle className="text-2xl md:text-3xl">Terms of Service</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Last updated: December 2025</p>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[calc(100vh-16rem)]">
              <div className="space-y-6 pr-4">
                <section>
                  <h2 className="text-xl font-semibold mb-3" data-testid="text-terms-intro-heading">Agreement to Terms</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    By accessing or using SimulChess, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our platform.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">Description of Service</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    SimulChess is a chess training platform that provides various game modes including Standard, <Link href="/otb-tournament-simulator" className="text-primary hover:underline">OTB Tournament</Link>, <Link href="/blindfold-chess-training" className="text-primary hover:underline">Blindfold</Link>, and <Link href="/simul-chess-training" className="text-primary hover:underline">Simul</Link> modes, along with training tools, <Link href="/chess-puzzles-trainer" className="text-primary hover:underline">puzzles</Link>, and <Link href="/chess-game-review" className="text-primary hover:underline">game analysis</Link>. The platform is designed to simulate over-the-board chess and help build memory.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">Account Registration</h2>
                  <div className="space-y-3 text-muted-foreground leading-relaxed">
                    <p>
                      To use SimulChess, you must authenticate through Replit. By creating an account, you agree to:
                    </p>
                    <ul className="list-disc list-inside space-y-2">
                      <li>Provide accurate and complete information</li>
                      <li>Maintain the security of your account credentials</li>
                      <li>Accept responsibility for all activities under your account</li>
                      <li>Notify us immediately of any unauthorized access</li>
                    </ul>
                  </div>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">Acceptable Use</h2>
                  <p className="text-muted-foreground leading-relaxed mb-3">
                    You agree to use SimulChess only for lawful purposes. You must not:
                  </p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-2">
                    <li>Use chess engines, bots, or external assistance during games</li>
                    <li>Manipulate ratings through intentional losing or collusion</li>
                    <li>Create multiple accounts to circumvent bans or manipulate matchmaking</li>
                    <li>Harass, abuse, or threaten other users</li>
                    <li>Exploit bugs or vulnerabilities in the platform</li>
                    <li>Interfere with the proper functioning of the service</li>
                    <li>Use automated systems to access the platform without permission</li>
                    <li>Attempt to reverse engineer or decompile any part of the platform</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">Sportsmanship and Social Conduct</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    SimulChess encourages professional chess etiquette. While the "Post-Game Handshake" is a voluntary gesture of sportsmanship, persistent refusal to engage in respectful conduct or the use of the feature to harass others may be considered a violation of our Acceptable Use policy. We expect all players to treat opponents with respect, whether in victory or defeat.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">Fair Play Policy</h2>
                  <div className="space-y-3 text-muted-foreground leading-relaxed">
                    <p>
                      SimulChess is committed to fair competition. Our anti-cheat system monitors gameplay for suspicious activity, including:
                    </p>
                    <ul className="list-disc list-inside space-y-2">
                      <li>Move timing and consistency analysis</li>
                      <li>Move correlation with engine top lines</li>
                      <li><strong>VSS Mismatch</strong> pattern detection</li>
                      <li>Behavioral pattern analysis</li>
                    </ul>
                    <p className="mt-3">
                      By using the service, you consent to the collection of this behavioral gameplay data for the purpose of maintaining tournament integrity. Violations may result in:
                    </p>
                    <ul className="list-disc list-inside space-y-2">
                      <li>Rating penalties or resets</li>
                      <li>Temporary or permanent account suspension</li>
                      <li>Marking of flagged games as losses</li>
                      <li>Public disclosure of cheating violations</li>
                    </ul>
                    <p>
                      Decisions regarding fair play violations are at our sole discretion and are final.
                    </p>
                  </div>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">Arbiter Rulings and Finality</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    In OTB and Tournament modes, the 30-second "Arbiter Call" window is the sole mechanism for reversing illegal moves. Once this window expires, or once an automated ruling is rendered, the result is final and may not be appealed except in cases of technical platform failure. This simulates real over-the-board tournament conditions where players must remain vigilant.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">Alt Accounts</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    In a future update, SimulChess will allow one alternate account per user for practice purposes. When available, alt accounts must not be used to circumvent bans, manipulate ratings, or deceive other players about your skill level.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">User Content</h2>
                  <div className="space-y-3 text-muted-foreground leading-relaxed">
                    <p>
                      You may create content on SimulChess, including puzzles and training notes. By submitting content, you:
                    </p>
                    <ul className="list-disc list-inside space-y-2">
                      <li>Grant us a non-exclusive license to use, display, and distribute your content</li>
                      <li>Represent that you own or have rights to the content</li>
                      <li>Agree not to submit inappropriate, offensive, or illegal content</li>
                    </ul>
                    <p>
                      We reserve the right to remove any content that violates these terms.
                    </p>
                  </div>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">Third-Party Content and Links</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    SimulChess allows users to include links to third-party content (e.g., YouTube videos for puzzle explanations). We do not control, endorse, or assume responsibility for the content, privacy policies, or practices of any third-party websites. Users access external links at their own risk. Interacting with linked YouTube content is subject to the YouTube Terms of Service and Google Privacy Policy.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">Intellectual Property</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    SimulChess and its original content, features, and functionality are owned by us. You may not copy, modify, or distribute our content without permission.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3" data-testid="text-terms-advertising-heading">Free Service and Advertising</h2>
                  <p className="text-muted-foreground leading-relaxed mb-3">
                    SimulChess is provided free of charge. The platform is supported by advertising. By using our service, you agree to view advertisements as part of your experience. We strive to ensure ads are non-intrusive and do not interfere with gameplay.
                  </p>
                  <p className="text-muted-foreground leading-relaxed">
                    Our advertising partners may use cookies to serve personalized ads. Please refer to our{" "}
                    <a href="/privacy" className="text-primary hover:underline" data-testid="link-privacy-from-terms">
                      Privacy Policy
                    </a>{" "}
                    for details on how your data is used and how you can manage your advertising preferences.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3" data-testid="text-terms-disclaimer-heading">Disclaimer of Warranties</h2>
                  <p className="text-muted-foreground leading-relaxed mb-3">
                    SimulChess is provided "as is" and "as available" without warranties of any kind, either express or implied. We do not guarantee that the service will be uninterrupted, secure, or error-free. Your use of the platform is at your own risk.
                  </p>
                  <p className="text-muted-foreground leading-relaxed">
                    We are not responsible for the content, products, or services of third-party advertisements displayed on the platform.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">Limitation of Liability</h2>
                  <p className="text-muted-foreground leading-relaxed mb-3">
                    You agree that your use of the service is at your sole risk and that the platform is provided on an "as is" and "as available" basis without warranties of any kind.
                  </p>
                  <p className="text-muted-foreground leading-relaxed">
                    To the maximum extent permitted by law, SimulChess shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of or inability to use the service, including but not limited to site downtime, data loss during maintenance or server migration, or service interruptions.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">Account Termination</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    We reserve the right to suspend or terminate your account at any time for violations of these terms or for any other reason at our discretion. You may also delete your account at any time through your account settings.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">Changes to Terms</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    We may modify these Terms of Service at any time. Continued use of SimulChess after changes are posted constitutes acceptance of the modified terms. We encourage you to review these terms periodically.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">Governing Law</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    These terms shall be governed by and construed in accordance with applicable laws, without regard to conflict of law principles.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3" data-testid="text-terms-contact-heading">Contact</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    If you have questions about these Terms of Service, please contact us at{" "}
                    <a href="mailto:simulchess.com@gmail.com" className="text-primary hover:underline" data-testid="link-email-terms">
                      simulchess.com@gmail.com
                    </a>
                    .
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
