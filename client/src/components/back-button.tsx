import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export function BackButton() {
  const [location] = useLocation();
  const { isAuthenticated } = useAuth();
  
  // Don't show on home/dashboard
  if (location === "/") {
    return null;
  }
  
  // Determine where to go back to
  const backPath = "/"; // Both logged in (dashboard) and logged out (home) go to "/"
  const backLabel = isAuthenticated ? "Dashboard" : "Home";
  
  return (
    <Button
      variant="ghost"
      size="sm"
      asChild
      className="gap-1"
      data-testid="button-back"
    >
      <Link href={backPath}>
        <ArrowLeft className="h-4 w-4" />
        <span className="hidden sm:inline">{backLabel}</span>
      </Link>
    </Button>
  );
}
