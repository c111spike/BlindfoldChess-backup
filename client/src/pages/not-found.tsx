import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Home, AlertCircle } from "lucide-react";
import { useLocation } from "wouter";
import { Helmet } from "react-helmet-async";

export default function NotFound() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background">
      <Helmet>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="p-4 rounded-full bg-muted">
              <AlertCircle className="h-12 w-12 text-muted-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-bold mb-2" data-testid="text-404-title">404</h1>
              <h2 className="text-xl font-semibold text-muted-foreground mb-2" data-testid="text-404-subtitle">
                Page Not Found
              </h2>
              <p className="text-sm text-muted-foreground mb-6" data-testid="text-404-description">
                The page you're looking for doesn't exist or has been moved. 
                Let's get you back to training.
              </p>
            </div>
            <Button 
              onClick={() => setLocation("/")} 
              className="gap-2"
              data-testid="button-return-home"
            >
              <Home className="h-4 w-4" />
              Return to SimulChess
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
