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
} from "@/components/ui/sidebar";
import { Switch } from "@/components/ui/switch";
import { 
  LayoutDashboard, 
  Clock, 
  Brain, 
  History, 
  BarChart3, 
  Settings,
  LogOut,
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
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getNotificationsEnabled, setNotificationsEnabled } from "@/hooks/useNotifications";
import logoImage from "@assets/SimulChess Logo2_1763871911272.png";

const menuItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: LayoutDashboard,
  },
  {
    title: "OTB Tournament",
    url: "/otb",
    icon: Clock,
  },
  {
    title: "Standard",
    url: "/standard",
    icon: Brain,
  },
  {
    title: "Simul vs Simul",
    url: "/simul-vs-simul",
    icon: Users,
  },
  {
    title: "Board Spin",
    url: "/boardspin",
    icon: RotateCw,
  },
  {
    title: "N-Piece Challenge",
    url: "/n-piece",
    icon: Crown,
  },
  {
    title: "Knight's Tour",
    url: "/knights-tour",
    icon: Navigation,
  },
  {
    title: "Puzzles",
    url: "/puzzles",
    icon: Puzzle,
  },
  {
    title: "Repertoire Trainer",
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
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
  },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user } = useAuth();
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

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <div className="px-4 py-3 flex items-center gap-3">
            <img src={logoImage} alt="SimulChess Logo" className="w-10 h-10 object-contain" />
            <div>
              <h2 className="text-xl font-bold">SimulChess</h2>
            </div>
          </div>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Training</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location === item.url}>
                    <Link href={item.url} data-testid={`nav-${item.url.slice(1) || "dashboard"}`}>
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
                  <SidebarMenuButton asChild isActive={location === "/admin"}>
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
        <div className="px-2 py-2 border-t border-sidebar-border">
          <div className="px-2 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {notificationsOn ? (
                <Bell className="h-4 w-4" />
              ) : (
                <BellOff className="h-4 w-4" />
              )}
              <span>Notifications</span>
            </div>
            <Switch
              checked={notificationsOn}
              onCheckedChange={handleToggleNotifications}
              data-testid="toggle-notifications"
            />
          </div>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <Link href="/privacy" data-testid="link-privacy">
                  <Shield className="h-4 w-4" />
                  <span>Privacy Policy</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <Link href="/terms" data-testid="link-terms">
                  <FileText className="h-4 w-4" />
                  <span>Terms of Service</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <Link href="/about" data-testid="link-about">
                  <Info className="h-4 w-4" />
                  <span>About Us</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <Link href="/contact" data-testid="link-contact">
                  <Mail className="h-4 w-4" />
                  <span>Contact Us</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <a href="/api/logout" data-testid="button-logout-sidebar">
                  <LogOut className="h-4 w-4" />
                  <span>Log Out</span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          <div className="px-3 py-2 text-xs text-muted-foreground/70" data-testid="text-stockfish-credit">
            Analysis powered by{" "}
            <a 
              href="https://stockfishchess.org/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="underline hover:text-muted-foreground"
              data-testid="link-stockfish"
            >
              Stockfish
            </a>
            {" "}(GPLv3)
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
