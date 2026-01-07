import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";
import { SidebarMenuButton } from "@/components/ui/sidebar";

interface ThemeToggleProps {
  variant?: "button" | "sidebar";
}

export function ThemeToggle({ variant = "button" }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";

  if (variant === "sidebar") {
    return (
      <SidebarMenuButton 
        onClick={() => setTheme(isDark ? "light" : "dark")}
        tooltip={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
        data-testid="button-theme-toggle"
      >
        {isDark ? (
          <Sun className="h-4 w-4" />
        ) : (
          <Moon className="h-4 w-4" />
        )}
        <span>{isDark ? "Light Mode" : "Dark Mode"}</span>
      </SidebarMenuButton>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
      data-testid="button-theme-toggle"
    >
      <Sun className="h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <Moon className="absolute h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
