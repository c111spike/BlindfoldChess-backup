import { Switch, Route, useLocation } from "wouter";
import { useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { TestUserSwitcher } from "@/components/TestUserSwitcher";
import { MobileFooter } from "@/components/mobile-footer";
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
import Login from "@/pages/login";
import Signup from "@/pages/signup";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import BlindfoldChessTraining from "@/pages/blindfold-chess-training";
import OTBTournamentSimulator from "@/pages/otb-tournament-simulator";
import SimulChessTraining from "@/pages/simul-chess-training";
import KnightsTourPuzzle from "@/pages/knights-tour-puzzle";
import ChessPieceChallenge from "@/pages/chess-piece-challenge";
import ChessPuzzlesTrainer from "@/pages/chess-puzzles-trainer";
import ChessBoardSpin from "@/pages/chess-board-spin";
import OpeningRepertoireTrainer from "@/pages/opening-repertoire-trainer";
import ChessGameReview from "@/pages/chess-game-review";
import PublicHomePage from "@/pages/public-home";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  return (
    <Switch>
      <Route path="/" component={isAuthenticated ? Dashboard : PublicHomePage} />
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
      <Route path="/simul-match/:matchId/review" component={SimulMatchReview} />
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
      <Route path="/blindfold-chess-training" component={BlindfoldChessTraining} />
      <Route path="/otb-tournament-simulator" component={OTBTournamentSimulator} />
      <Route path="/simul-chess-training" component={SimulChessTraining} />
      <Route path="/knights-tour-puzzle" component={KnightsTourPuzzle} />
      <Route path="/chess-piece-challenge" component={ChessPieceChallenge} />
      <Route path="/chess-puzzles-trainer" component={ChessPuzzlesTrainer} />
      <Route path="/chess-board-spin" component={ChessBoardSpin} />
      <Route path="/opening-repertoire-trainer" component={OpeningRepertoireTrainer} />
      <Route path="/chess-game-review" component={ChessGameReview} />
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
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
  const isHomePage = location === "/";
  const isPublicLandingPage = [
    "/privacy", "/terms", "/about", "/contact",
    "/blindfold-chess-training", "/otb-tournament-simulator", "/simul-chess-training",
    "/knights-tour-puzzle", "/chess-piece-challenge", "/chess-puzzles-trainer", "/chess-board-spin",
    "/opening-repertoire-trainer", "/chess-game-review",
    "/login", "/signup", "/forgot-password", "/reset-password",
    "/admin" // Allow render to show 404, not redirect to login (stealth mode)
  ].includes(location);

  useEffect(() => {
    // Don't redirect if we're on public pages, homepage, or OIDC error page
    if (!isLoading && !isAuthenticated && !isUsingTestUser && !isOidcErrorPage && !isPublicLandingPage && !isHomePage) {
      window.location.href = "/login";
    }
  }, [isLoading, isAuthenticated, isUsingTestUser, isOidcErrorPage, isPublicLandingPage, isHomePage]);

  // Handle OIDC error page - accessible without auth
  if (isOidcErrorPage) {
    return <OidcError />;
  }

  // Handle auth pages (login/signup/forgot-password/reset-password) - render without sidebar wrapper
  const authPages = ["/login", "/signup", "/forgot-password", "/reset-password"];
  if (authPages.includes(location) && !isAuthenticated) {
    const AuthPageComponent = {
      "/login": Login,
      "/signup": Signup,
      "/forgot-password": ForgotPassword,
      "/reset-password": ResetPassword,
    }[location];
    if (AuthPageComponent) {
      return (
        <div className="min-h-screen bg-background">
          <AuthPageComponent />
        </div>
      );
    }
  }

  // Handle public pages (privacy, terms, about, contact, SEO landing pages) - accessible without auth
  if (isPublicLandingPage && !isAuthenticated && !isUsingTestUser) {
    const PublicPageComponent = {
      "/privacy": PrivacyPolicy,
      "/terms": TermsOfService,
      "/about": About,
      "/contact": Contact,
      "/blindfold-chess-training": BlindfoldChessTraining,
      "/otb-tournament-simulator": OTBTournamentSimulator,
      "/simul-chess-training": SimulChessTraining,
      "/knights-tour-puzzle": KnightsTourPuzzle,
      "/chess-piece-challenge": ChessPieceChallenge,
      "/chess-puzzles-trainer": ChessPuzzlesTrainer,
      "/chess-board-spin": ChessBoardSpin,
      "/opening-repertoire-trainer": OpeningRepertoireTrainer,
      "/chess-game-review": ChessGameReview,
      "/admin": NotFound, // Stealth mode: show 404 instead of revealing admin exists
    }[location];
    
    if (PublicPageComponent) {
      return (
        <div className="min-h-screen bg-background flex flex-col">
          <div className="flex justify-between items-center px-4 py-2">
            <a href="/login" className="text-primary hover:underline text-sm" data-testid="link-login">
              Sign in
            </a>
            <ThemeToggle />
          </div>
          <div className="flex-1">
            <PublicPageComponent />
          </div>
          <MobileFooter />
        </div>
      );
    }
  }

  if (isLoading) {
    return <div className="h-screen bg-background" />;
  }

  // Allow homepage to render with sidebar for guest users
  if (!isAuthenticated && !isUsingTestUser && !isHomePage) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-foreground mb-4">Redirecting to login...</p>
          <a href="/login" className="text-primary underline">Click here if not redirected</a>
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
        <div className="flex flex-col flex-1 overflow-hidden relative">
          {/* Mobile-only floating hamburger button */}
          <SidebarTrigger 
            className="md:hidden fixed top-3 left-3 z-50 bg-sidebar text-sidebar-foreground border border-sidebar-border rounded-md" 
            data-testid="button-mobile-sidebar-toggle" 
          />
          {isAuthenticated && isDevelopment && (
            <div className="flex items-center justify-end px-4 py-1">
              <TestUserSwitcher />
            </div>
          )}
          <main className="flex-1 overflow-auto">
            <div className="p-4">
              <Router />
            </div>
            <MobileFooter />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

export default function App() {
  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider defaultTheme="dark">
          <TooltipProvider>
            <AppContent />
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </HelmetProvider>
  );
}
