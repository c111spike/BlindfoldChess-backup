import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Shield, ArrowLeft } from "lucide-react";

export default function PrivacyPolicy() {
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
            <Shield className="h-8 w-8 text-primary" />
            <div>
              <CardTitle className="text-2xl md:text-3xl">Privacy Policy</CardTitle>
              <p className="text-sm text-muted-foreground mt-1" data-testid="text-privacy-updated">Last updated: December 2025</p>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[calc(100vh-16rem)]">
              <div className="space-y-6 pr-4">
                <section>
                  <h2 className="text-xl font-semibold mb-3" data-testid="text-privacy-intro-heading">Introduction</h2>
                  <p className="text-muted-foreground leading-relaxed" data-testid="text-privacy-intro">
                    SimulChess ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our chess training platform.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3" data-testid="text-privacy-collect-heading">Information We Collect</h2>
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
                  <h2 className="text-xl font-semibold mb-3" data-testid="text-privacy-use-heading">How We Use Your Information</h2>
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
                  <h2 className="text-xl font-semibold mb-3" data-testid="text-privacy-legal-heading">Legal Basis for Processing (GDPR)</h2>
                  <p className="text-muted-foreground leading-relaxed mb-3">
                    We process your personal data under the following legal bases:
                  </p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-2">
                    <li><strong>Contractual Necessity:</strong> Processing necessary to provide you with our chess training services when you create an account</li>
                    <li><strong>Legitimate Interest:</strong> Processing for platform improvement, security, fraud prevention, and analytics where our interests do not override your rights</li>
                    <li><strong>Consent:</strong> Processing for personalized advertising, which you can withdraw at any time through your browser settings or opt-out links provided below</li>
                    <li><strong>Legal Obligation:</strong> Processing required to comply with applicable laws and regulations</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3" data-testid="text-privacy-thirdparty-heading">Third-Party Services</h2>
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
                      <h3 className="font-medium mb-2" data-testid="text-privacy-advertising-heading">Third-Party Advertising</h3>
                      <p className="text-muted-foreground leading-relaxed mb-3">
                        We use Google AdSense to serve advertisements when you visit our website. Google and other third-party vendors use cookies to serve ads based on your prior visits to this website or other websites on the Internet.
                      </p>
                      <p className="text-muted-foreground leading-relaxed mb-3">
                        Google's use of the DART cookie enables it and its partners to serve ads to you based on your visit to our site and/or other sites on the Internet. The DoubleClick cookie is used by Google in the ads served on the websites of its partners, such as websites displaying AdSense ads or participating in Google certified ad networks.
                      </p>
                      <p className="text-muted-foreground leading-relaxed">
                        You may opt out of personalized advertising by visiting{" "}
                        <a 
                          href="https://www.google.com/settings/ads" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                          data-testid="link-google-ads-settings"
                        >
                          Google Ads Settings
                        </a>{" "}
                        or by visiting{" "}
                        <a 
                          href="https://www.aboutads.info" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                          data-testid="link-aboutads"
                        >
                          www.aboutads.info
                        </a>
                        .
                      </p>
                    </div>
                  </div>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3" data-testid="text-privacy-cookies-heading">Cookies and Tracking</h2>
                  <p className="text-muted-foreground leading-relaxed mb-3">
                    We use cookies and similar technologies to maintain your session, remember your preferences, and analyze platform usage. The types of cookies we use include:
                  </p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-2 mb-3">
                    <li><strong>Essential Cookies:</strong> Required for the platform to function, including authentication and session management</li>
                    <li><strong>Analytics Cookies:</strong> Help us understand how users interact with our platform</li>
                    <li><strong>Advertising Cookies:</strong> Used by Google AdSense and its partners (including the DART and DoubleClick cookies) to serve personalized advertisements based on your browsing history</li>
                  </ul>
                  <p className="text-muted-foreground leading-relaxed">
                    You can control non-essential cookies through your browser settings. To opt out of Google's advertising cookies specifically, visit{" "}
                    <a 
                      href="https://www.aboutads.info" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                      data-testid="link-aboutads-cookies"
                    >
                      www.aboutads.info
                    </a>
                    .
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3" data-testid="text-privacy-retention-heading">Data Retention</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    We retain your account information and game data for as long as your account is active. Game history is preserved to allow you to review past games and track long-term progress. You may request deletion of your account and associated data at any time.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3" data-testid="text-privacy-rights-heading">Your Rights</h2>
                  <p className="text-muted-foreground leading-relaxed mb-3">
                    Depending on your location, you may have the following rights regarding your personal data:
                  </p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-2">
                    <li>Access your personal data</li>
                    <li>Correct inaccurate data</li>
                    <li>Request deletion of your data</li>
                    <li>Object to certain processing activities</li>
                    <li>Export your data in a portable format</li>
                    <li>Withdraw consent for personalized advertising at any time</li>
                  </ul>
                  <p className="text-muted-foreground leading-relaxed mt-3">
                    To exercise these rights, please contact us at{" "}
                    <a 
                      href="mailto:simulchess.com@gmail.com" 
                      className="text-primary hover:underline"
                      data-testid="link-email-rights"
                    >
                      simulchess.com@gmail.com
                    </a>
                    .
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3" data-testid="text-privacy-california-heading">California Privacy Rights (CCPA/CPRA)</h2>
                  <p className="text-muted-foreground leading-relaxed mb-3">
                    If you are a California resident, you have specific rights under the California Consumer Privacy Act (CCPA) and California Privacy Rights Act (CPRA):
                  </p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-2 mb-3">
                    <li><strong>Right to Know:</strong> You can request information about the categories and specific pieces of personal information we have collected about you</li>
                    <li><strong>Right to Delete:</strong> You can request deletion of your personal information, subject to certain exceptions</li>
                    <li><strong>Right to Correct:</strong> You can request correction of inaccurate personal information</li>
                    <li><strong>Right to Opt-Out:</strong> You have the right to opt out of the "sale" or "sharing" of your personal information</li>
                    <li><strong>Right to Non-Discrimination:</strong> We will not discriminate against you for exercising your privacy rights</li>
                  </ul>
                  <p className="text-muted-foreground leading-relaxed mb-3">
                    <strong>Do Not Sell or Share My Personal Information:</strong> SimulChess does not "sell" your personal information as defined under California law. We may share certain information with advertising partners for targeted advertising purposes, which may constitute "sharing" under CPRA. You can opt out of this sharing by:
                  </p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-2 mb-3">
                    <li>Visiting{" "}
                      <a 
                        href="https://www.aboutads.info" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                        data-testid="link-aboutads-ccpa"
                      >
                        www.aboutads.info
                      </a>{" "}
                      to opt out of personalized advertising
                    </li>
                    <li>Contacting us at{" "}
                      <a 
                        href="mailto:simulchess.com@gmail.com" 
                        className="text-primary hover:underline"
                        data-testid="link-email-ccpa"
                      >
                        simulchess.com@gmail.com
                      </a>{" "}
                      with the subject line "Do Not Sell or Share My Personal Information"
                    </li>
                  </ul>
                  <p className="text-muted-foreground leading-relaxed">
                    We will respond to verifiable consumer requests within 45 days as required by California law.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3" data-testid="text-privacy-security-heading">Data Security</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    We implement appropriate technical and organizational measures to protect your personal data against unauthorized access, alteration, disclosure, or destruction. This includes encryption, secure hosting, and regular security assessments.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3" data-testid="text-privacy-children-heading">Children's Privacy</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    SimulChess is not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13. If you believe we have collected data from a child under 13, please contact us immediately at{" "}
                    <a 
                      href="mailto:simulchess.com@gmail.com" 
                      className="text-primary hover:underline"
                      data-testid="link-email-children"
                    >
                      simulchess.com@gmail.com
                    </a>
                    .
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3" data-testid="text-privacy-changes-heading">Changes to This Policy</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    We may update this Privacy Policy from time to time. We will notify you of any significant changes by posting the new policy on this page and updating the "Last updated" date.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3" data-testid="text-privacy-contact-heading">Contact Us</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    If you have questions about this Privacy Policy, our data practices, or wish to exercise your privacy rights, please contact us at:
                  </p>
                  <p className="text-muted-foreground leading-relaxed mt-2">
                    <strong>Email:</strong>{" "}
                    <a 
                      href="mailto:simulchess.com@gmail.com" 
                      className="text-primary hover:underline"
                      data-testid="link-email-contact"
                    >
                      simulchess.com@gmail.com
                    </a>
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
