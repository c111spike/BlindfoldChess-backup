import { Switch, Route, useLocation } from "wouter";
import { lazy, Suspense } from "react";
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
import { BackButton } from "@/components/back-button";
import { useAuth } from "@/hooks/useAuth";
import { isDevelopment, getTestUserId } from "@/lib/devMode";

// Eagerly loaded pages (lightweight, critical path)
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import PublicHomePage from "@/pages/public-home";
import Login from "@/pages/login";
import Signup from "@/pages/signup";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import OidcError from "@/pages/oidc-error";

// Lazy loaded pages (heavy, not needed on initial load)
const OTBMode = lazy(() => import("@/pages/otb-mode"));
const StandardMode = lazy(() => import("@/pages/standard-mode"));
const BoardSpin = lazy(() => import("@/pages/board-spin"));
const NPieceChallenge = lazy(() => import("@/pages/n-piece-challenge"));
const KnightsTour = lazy(() => import("@/pages/knights-tour"));
const History = lazy(() => import("@/pages/history"));
const StatisticsPage = lazy(() => import("@/pages/statistics"));
const Settings = lazy(() => import("@/pages/settings"));
const GameAnalysis = lazy(() => import("@/pages/game-analysis"));
const SimulVsSimulMode = lazy(() => import("@/pages/simul-vs-simul-mode"));
const SimulMatchReview = lazy(() => import("@/pages/simul-match-review"));
const PuzzleCreator = lazy(() => import("@/pages/puzzle-creator"));
const Puzzles = lazy(() => import("@/pages/puzzles"));
const PuzzleSolve = lazy(() => import("@/pages/puzzle-solve"));
const AdminPage = lazy(() => import("@/pages/admin"));
const RepertoireTrainer = lazy(() => import("@/pages/repertoire-trainer"));
const PrivacyPolicy = lazy(() => import("@/pages/privacy-policy"));
const TermsOfService = lazy(() => import("@/pages/terms-of-service"));
const Help = lazy(() => import("@/pages/help"));
const About = lazy(() => import("@/pages/about"));
const Contact = lazy(() => import("@/pages/contact"));
const BlindfoldChessTraining = lazy(() => import("@/pages/blindfold-chess-training"));
const OTBTournamentSimulator = lazy(() => import("@/pages/otb-tournament-simulator"));
const SimulChessTraining = lazy(() => import("@/pages/simul-chess-training"));
const KnightsTourPuzzle = lazy(() => import("@/pages/knights-tour-puzzle"));
const ChessPieceChallenge = lazy(() => import("@/pages/chess-piece-challenge"));
const ChessPuzzlesTrainer = lazy(() => import("@/pages/chess-puzzles-trainer"));
const ChessBoardSpin = lazy(() => import("@/pages/chess-board-spin"));
const OpeningRepertoireTrainer = lazy(() => import("@/pages/opening-repertoire-trainer"));
const ChessGameReview = lazy(() => import("@/pages/chess-game-review"));

// Loading fallback component
function PageLoader() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Loading...</div>
    </div>
  );
}

// Non-blocking home route - renders PublicHomePage immediately, swaps to Dashboard when auth confirms
function HomeRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  
  // Render public home immediately while auth loads (non-blocking LCP)
  if (isLoading || !isAuthenticated) {
    return <PublicHomePage />;
  }
  
  // Only show Dashboard after auth confirms user is logged in
  return <Dashboard />;
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  // Don't block initial render - let public routes render while auth loads
  // Only block for auth-required routes

  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/" component={HomeRoute} />
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
    </Suspense>
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
  // Public pages that anyone can access without authentication
  const isPublicLandingPage = [
    "/privacy", "/terms", "/about", "/contact", "/help",
    "/blindfold-chess-training", "/otb-tournament-simulator", "/simul-chess-training",
    "/knights-tour-puzzle", "/chess-piece-challenge", "/chess-puzzles-trainer", "/chess-board-spin",
    "/opening-repertoire-trainer", "/chess-game-review",
    "/login", "/signup", "/forgot-password", "/reset-password"
  ].includes(location);

  // No redirect to login for non-authenticated users - they see 404 page instead (stealth mode)
  // This prevents attackers from discovering which protected routes exist

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
        <div className="min-h-screen bg-background flex flex-col">
          <div className="flex items-center justify-between px-4 py-2">
            <BackButton />
            <ThemeToggle />
          </div>
          <div className="flex-1">
            <AuthPageComponent />
          </div>
        </div>
      );
    }
  }

  // Determine what content to show in the main area
  const renderMainContent = () => {
    // Non-blocking render for home page and public landing pages
    // These render immediately while auth loads in background (LCP optimization)
    if (isHomePage || isPublicLandingPage) {
      return (
        <div className="flex-1 px-4 pb-4">
          <Router />
        </div>
      );
    }

    // For protected routes, show spinner while auth loads
    if (isLoading) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      );
    }

    // For non-authenticated users on non-public pages, render NotFound (stealth mode)
    // This shows the fun 404 Board Spin page instead of revealing protected routes exist
    if (!isAuthenticated && !isUsingTestUser) {
      return (
        <div className="flex-1 px-4 pb-4">
          <NotFound />
        </div>
      );
    }

    if (!isAuthenticated && isUsingTestUser) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-foreground">Authenticating test user...</p>
        </div>
      );
    }

    return (
      <div className="flex-1 px-4 pb-4">
        <Router />
      </div>
    );
  };

  // Always render the sidebar layout shell to prevent CLS from footer appearing/disappearing
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
          {/* Header bar with back button and dev tools */}
          <div className="flex items-center justify-between px-4 py-2 pl-14 md:pl-4">
            <BackButton />
            {isAuthenticated && isDevelopment && (
              <TestUserSwitcher />
            )}
          </div>
          <main className="flex-1 overflow-auto">
            {renderMainContent()}
          </main>
          <MobileFooter />
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
