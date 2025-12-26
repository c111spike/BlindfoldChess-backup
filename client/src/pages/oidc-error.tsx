import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Helmet } from "react-helmet-async";

export default function OidcError() {
  const handleRetry = () => {
    window.location.href = "/login";
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
      <Helmet>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertCircle className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle data-testid="text-auth-error-title">Authentication Error</CardTitle>
          <CardDescription data-testid="text-auth-error-description">
            There was a problem signing you in. This can happen if your session expired or there was a network issue.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={handleRetry} 
            className="w-full"
            data-testid="button-retry-login"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
          <p className="text-xs text-center text-muted-foreground">
            If this problem persists, try clearing your browser cookies or using a different browser.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
