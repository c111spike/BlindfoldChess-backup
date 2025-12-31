import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { 
  LayoutDashboard, 
  Clock, 
  Brain, 
  History, 
  BarChart3, 
  Settings,
  LogOut,
  LogIn,
  Shield,
  FileText,
  HelpCircle,
  Info,
  Mail,
  RotateCw,
  Crown,
  Navigation,
  Users,
  Puzzle,
  ShieldCheck,
  Book,
  Bell,
  BellOff,
  Eye,
  Menu,
  Sun,
  Moon,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getNotificationsEnabled, setNotificationsEnabled } from "@/hooks/useNotifications";
import logoImage from "@assets/optimized/simulchess_logo_64.webp";

const menuItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Simul vs Simul",
    url: "/simul-vs-simul",
    icon: Users,
  },
  {
    title: "OTB Mode",
    url: "/otb",
    icon: Clock,
  },
  {
    title: "Standard (Blindfold)",
    url: "/standard",
    icon: Brain,
  },
  {
    title: "Board Spin",
    url: "/boardspin",
    icon: RotateCw,
  },
  {
    title: "Knight's Tour",
    url: "/knights-tour",
    icon: Navigation,
  },
  {
    title: "N-Piece Challenge",
    url: "/n-piece",
    icon: Crown,
  },
  {
    title: "Community Puzzles",
    url: "/puzzles",
    icon: Puzzle,
  },
  {
    title: "Opening Repertoire",
    url: "/repertoire",
    icon: Book,
  },
  {
    title: "Game History",
    url: "/history",
    icon: History,
  },
  {
    title: "Statistics",
    url: "/statistics",
    icon: BarChart3,
  },
];

const guestMenuItems = [
  {
    title: "Home",
    url: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Simul Training",
    url: "/simul-chess-training",
    icon: Users,
  },
  {
    title: "OTB Mode",
    url: "/otb-tournament-simulator",
    icon: Clock,
  },
  {
    title: "Blindfold Training",
    url: "/blindfold-chess-training",
    icon: Eye,
  },
  {
    title: "Board Spin",
    url: "/chess-board-spin",
    icon: RotateCw,
  },
  {
    title: "Knight's Tour",
    url: "/knights-tour-puzzle",
    icon: Navigation,
  },
  {
    title: "N-Piece Challenge",
    url: "/chess-piece-challenge",
    icon: Crown,
  },
  {
    title: "Chess Puzzles",
    url: "/chess-puzzles-trainer",
    icon: Puzzle,
  },
  {
    title: "Repertoire Trainer",
    url: "/opening-repertoire-trainer",
    icon: Book,
  },
  {
    title: "Game Review",
    url: "/chess-game-review",
    icon: BarChart3,
  },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const [notificationsOn, setNotificationsOn] = useState(() => getNotificationsEnabled());

  useEffect(() => {
    const handleChange = (e: CustomEvent<boolean>) => {
      setNotificationsOn(e.detail);
    };
    window.addEventListener("notifications-changed", handleChange as EventListener);
    return () => window.removeEventListener("notifications-changed", handleChange as EventListener);
  }, []);

  const handleToggleNotifications = () => {
    const newValue = !notificationsOn;
    setNotificationsOn(newValue);
    setNotificationsEnabled(newValue);
  };

  const currentMenuItems = isAuthenticated ? menuItems : guestMenuItems;
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-2">
          <SidebarTrigger data-testid="button-sidebar-toggle">
            <Menu className="h-5 w-5" />
          </SidebarTrigger>
          {!isCollapsed && (
            <Link href="/" className="flex items-center gap-2">
              <img src={logoImage} alt="SimulChess Logo" className="w-8 h-8 object-contain" />
              <h2 className="text-lg font-bold">SimulChess</h2>
            </Link>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>

        {!isAuthenticated && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Login / Join Free">
                    <a href="/login" data-testid="button-login-sidebar">
                      <LogIn className="h-4 w-4" />
                      <span>Login / Join Free</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarGroup>
          <SidebarGroupLabel>{isAuthenticated ? "Training" : "Explore"}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {currentMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location === item.url} tooltip={item.title}>
                    <Link href={item.url} data-testid={`nav-${item.url.slice(1) || "home"}`}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {user?.isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Administration</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location === "/admin"} tooltip="Admin Dashboard">
                    <Link href="/admin" data-testid="nav-admin">
                      <ShieldCheck className="h-4 w-4" />
                      <span>Admin Dashboard</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter>
        <div className={`py-2 border-t border-sidebar-border pr-2 max-h-[180px] overflow-y-auto md:max-h-none md:overflow-visible ${isCollapsed ? 'pl-0' : 'pl-2'}`}>
          <SidebarMenu>
            {isAuthenticated && (
              <>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location === "/settings"} tooltip="Settings">
                    <Link href="/settings" data-testid="nav-settings">
                      <Settings className="h-4 w-4" />
                      <span>Settings</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton 
                    onClick={handleToggleNotifications} 
                    tooltip={notificationsOn ? "Disable Notifications" : "Enable Notifications"}
                    data-testid="toggle-notifications"
                  >
                    {notificationsOn ? (
                      <Bell className="h-4 w-4" />
                    ) : (
                      <BellOff className="h-4 w-4" />
                    )}
                    <span>Notifications {notificationsOn ? "On" : "Off"}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </>
            )}
            <SidebarMenuItem>
              <ThemeToggle variant="sidebar" />
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Privacy Policy">
                <Link href="/privacy" data-testid="link-privacy">
                  <Shield className="h-4 w-4" />
                  <span>Privacy Policy</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Terms of Service">
                <Link href="/terms" data-testid="link-terms">
                  <FileText className="h-4 w-4" />
                  <span>Terms of Service</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="About Us">
                <Link href="/about" data-testid="link-about">
                  <Info className="h-4 w-4" />
                  <span>About Us</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Contact Us">
                <Link href="/contact" data-testid="link-contact">
                  <Mail className="h-4 w-4" />
                  <span>Contact Us</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            {isAuthenticated ? (
              <SidebarMenuItem>
                <SidebarMenuButton 
                  onClick={() => {
                    import("@/lib/auth-client").then(({ signOut }) => {
                      signOut().then(() => {
                        window.location.href = "/";
                      });
                    });
                  }} 
                  tooltip="Log Out"
                  data-testid="button-logout-sidebar"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Log Out</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ) : (
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Log In">
                  <a href="/login" data-testid="button-login-footer">
                    <LogIn className="h-4 w-4" />
                    <span>Log In</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
          </SidebarMenu>
          {!isCollapsed && (
            <div className="px-3 py-2 text-xs text-muted-foreground" data-testid="text-stockfish-credit">
              Analysis powered by{" "}
              <a 
                href="https://stockfishchess.org/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="underline hover:text-foreground"
                data-testid="link-stockfish"
              >
                Stockfish
              </a>
              {" "}(GPLv3)
              <div className="text-[10px] text-muted-foreground mt-0.5">v1.2.1</div>
            </div>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
