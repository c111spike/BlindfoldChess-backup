import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText } from "lucide-react";

export default function TermsOfService() {
  return (
    <div className="min-h-full p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader className="flex flex-row items-center gap-3">
            <FileText className="h-8 w-8 text-primary" />
            <div>
              <CardTitle className="text-2xl md:text-3xl">Terms of Service</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Last updated: December 2024</p>
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
                    SimulChess is a chess training platform that provides various game modes including Standard, OTB Tournament, Blindfold, and Simul modes, along with training tools, puzzles, and game analysis. The platform is designed to help players improve their over-the-board chess skills.
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
                  <h2 className="text-xl font-semibold mb-3">Fair Play Policy</h2>
                  <div className="space-y-3 text-muted-foreground leading-relaxed">
                    <p>
                      SimulChess is committed to fair competition. Our anti-cheat system monitors gameplay for suspicious activity. Violations may result in:
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
                  <h2 className="text-xl font-semibold mb-3">Alt Accounts</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    SimulChess allows one alternate account per user for practice purposes. Alt accounts must not be used to circumvent bans, manipulate ratings, or deceive other players about your skill level.
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
                  <h2 className="text-xl font-semibold mb-3">Intellectual Property</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    SimulChess and its original content, features, and functionality are owned by us and are protected by international copyright, trademark, and other intellectual property laws. You may not copy, modify, or distribute our content without permission.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">Free Service and Advertising</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    SimulChess is provided free of charge. The platform is supported by advertising. By using our service, you agree to view advertisements as part of your experience. We strive to ensure ads are non-intrusive and do not interfere with gameplay.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">Disclaimer of Warranties</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    SimulChess is provided "as is" and "as available" without warranties of any kind, either express or implied. We do not guarantee that the service will be uninterrupted, secure, or error-free. Your use of the platform is at your own risk.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">Limitation of Liability</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    To the maximum extent permitted by law, SimulChess shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of or inability to use the service.
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
                  <h2 className="text-xl font-semibold mb-3">Contact</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    If you have questions about these Terms of Service, please contact us through the platform or visit our support channels.
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
