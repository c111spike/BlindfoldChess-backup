import { Switch, Route } from "wouter";
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
import BlindfoldMode from "@/pages/blindfold-mode";
import SimulMode from "@/pages/simul-mode";
import History from "@/pages/history";
import StatisticsPage from "@/pages/statistics";
import Puzzles from "@/pages/puzzles";
import Settings from "@/pages/settings";

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
      <Route path="/blindfold" component={BlindfoldMode} />
      <Route path="/simul" component={SimulMode} />
      <Route path="/history" component={History} />
      <Route path="/statistics" component={StatisticsPage} />
      <Route path="/puzzles" component={Puzzles} />
      <Route path="/settings" component={Settings} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();

  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  const isUsingTestUser = isDevelopment && !!getTestUserId();

  useEffect(() => {
    if (!isLoading && !isAuthenticated && !isUsingTestUser) {
      window.location.href = "/api/login";
    }
  }, [isLoading, isAuthenticated, isUsingTestUser]);

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
