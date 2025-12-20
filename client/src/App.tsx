import { Switch, Route, useLocation } from "wouter";
import { useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { TestUserSwitcher } from "@/components/TestUserSwitcher";
import { useAuth } from "@/hooks/useAuth";
import { isDevelopment, getTestUserId } from "@/lib/devMode";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import OTBMode from "@/pages/otb-mode";
import StandardMode from "@/pages/standard-mode";
import BoardSpin from "@/pages/board-spin";
import NPieceChallenge from "@/pages/n-piece-challenge";
import KnightsTour from "@/pages/knights-tour";
import History from "@/pages/history";
import StatisticsPage from "@/pages/statistics";
import Settings from "@/pages/settings";
import GameAnalysis from "@/pages/game-analysis";
import SimulVsSimulMode from "@/pages/simul-vs-simul-mode";
import SimulMatchReview from "@/pages/simul-match-review";
import PuzzleCreator from "@/pages/puzzle-creator";
import Puzzles from "@/pages/puzzles";
import PuzzleSolve from "@/pages/puzzle-solve";
import AdminPage from "@/pages/admin";
import RepertoireTrainer from "@/pages/repertoire-trainer";
import PrivacyPolicy from "@/pages/privacy-policy";
import TermsOfService from "@/pages/terms-of-service";
import Help from "@/pages/help";
import About from "@/pages/about";
import Contact from "@/pages/contact";
import OidcError from "@/pages/oidc-error";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/otb" component={OTBMode} />
      <Route path="/standard" component={StandardMode} />
      <Route path="/simul-vs-simul" component={SimulVsSimulMode} />
      <Route path="/boardspin" component={BoardSpin} />
      <Route path="/n-piece" component={NPieceChallenge} />
      <Route path="/knights-tour" component={KnightsTour} />
      <Route path="/history" component={History} />
      <Route path="/statistics" component={StatisticsPage} />
      <Route path="/settings" component={Settings} />
      <Route path="/analysis/:gameId" component={GameAnalysis} />
      <Route path="/analysis/shared/:shareCode" component={GameAnalysis} />
      <Route path="/simul-match/:matchId" component={SimulMatchReview} />
      <Route path="/puzzles" component={Puzzles} />
      <Route path="/puzzles/create" component={PuzzleCreator} />
      <Route path="/puzzle/:id" component={PuzzleSolve} />
      <Route path="/admin" component={AdminPage} />
      <Route path="/repertoire" component={RepertoireTrainer} />
      <Route path="/privacy" component={PrivacyPolicy} />
      <Route path="/terms" component={TermsOfService} />
      <Route path="/help" component={Help} />
      <Route path="/about" component={About} />
      <Route path="/contact" component={Contact} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const [location] = useLocation();

  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  const isUsingTestUser = isDevelopment && !!getTestUserId();
  const isOidcErrorPage = location === "/oidc-error";

  useEffect(() => {
    // Don't redirect if we're on the OIDC error page
    if (!isLoading && !isAuthenticated && !isUsingTestUser && !isOidcErrorPage) {
      window.location.href = "/api/login";
    }
  }, [isLoading, isAuthenticated, isUsingTestUser, isOidcErrorPage]);

  // Handle OIDC error page - accessible without auth
  if (isOidcErrorPage) {
    return <OidcError />;
  }

  if (isLoading) {
    return <div className="h-screen bg-background" />;
  }

  if (!isAuthenticated && !isUsingTestUser) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-foreground mb-4">Redirecting to login...</p>
          <a href="/api/login" className="text-primary underline">Click here if not redirected</a>
        </div>
      </div>
    );
  }

  if (!isAuthenticated && isUsingTestUser) {
    return <div className="h-screen bg-background flex items-center justify-center">
      <p className="text-foreground">Authenticating test user...</p>
    </div>;
  }

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between p-2 border-b gap-2">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <div className="flex items-center gap-2">
              <TestUserSwitcher />
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            <Router />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <AppContent />
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
