import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { AboutDialog } from "@/components/about-dialog";
import GamePage from "@/pages/game";

export default function App() {
  return (
    <ThemeProvider defaultTheme="dark">
      <TooltipProvider>
        <div className="flex flex-col min-h-screen bg-background">
          <header className="flex items-center justify-between p-3 border-b border-border">
            <h1 className="text-lg font-bold text-foreground">Blindfold Chess</h1>
            <div className="flex items-center gap-1">
              <AboutDialog />
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            <GamePage />
          </main>
        </div>
        <Toaster />
      </TooltipProvider>
    </ThemeProvider>
  );
}
