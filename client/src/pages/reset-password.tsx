import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { resetPassword } from "@/lib/auth-client";
import { Loader2, KeyRound, CheckCircle2, XCircle } from "lucide-react";
import logoImage from "@assets/SimulChess_Logo_1766758716992.png";

export default function ResetPassword() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [tokenError, setTokenError] = useState(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenParam = urlParams.get("token");
    if (tokenParam) {
      setToken(tokenParam);
    } else {
      setTokenError(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure your passwords match.",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 8) {
      toast({
        title: "Password too short",
        description: "Password must be at least 8 characters long.",
        variant: "destructive",
      });
      return;
    }

    if (!token) {
      toast({
        title: "Invalid token",
        description: "The password reset link is invalid or has expired.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await resetPassword({
        newPassword: password,
        token,
      });

      if (error) {
        toast({
          title: "Reset failed",
          description: error.message || "Could not reset password. The link may have expired.",
          variant: "destructive",
        });
      } else {
        setResetSuccess(true);
        toast({
          title: "Password reset successful",
          description: "You can now log in with your new password.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Reset failed",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (tokenError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl flex items-center justify-center gap-2">
              <Link href="/" data-testid="link-logo-home">
                <img src={logoImage} alt="SimulChess Logo" className="h-8 w-auto" />
              </Link>
              Invalid Link
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <XCircle className="h-16 w-16 text-destructive mx-auto" />
            <p className="text-muted-foreground">
              This password reset link is invalid or has expired.
            </p>
            <Button asChild className="w-full" data-testid="button-request-new">
              <Link href="/forgot-password">Request a new reset link</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (resetSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl flex items-center justify-center gap-2">
              <Link href="/" data-testid="link-logo-home">
                <img src={logoImage} alt="SimulChess Logo" className="h-8 w-auto" />
              </Link>
              Password Reset
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
            <p className="text-muted-foreground">
              Your password has been reset successfully!
            </p>
            <Button asChild className="w-full" data-testid="button-go-login">
              <Link href="/login">Go to Login</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl flex items-center justify-center gap-2">
            <Link href="/" data-testid="link-logo-home">
              <img src={logoImage} alt="SimulChess Logo" className="h-8 w-auto" />
            </Link>
            Reset Password
          </CardTitle>
          <CardDescription>
            Enter your new password below
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                disabled={isLoading}
                data-testid="input-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                disabled={isLoading}
                data-testid="input-confirm-password"
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
              data-testid="button-reset-password"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Resetting...
                </>
              ) : (
                <>
                  <KeyRound className="mr-2 h-4 w-4" />
                  Reset Password
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
