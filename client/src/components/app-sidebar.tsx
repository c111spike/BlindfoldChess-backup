import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import type { Rating } from "@shared/schema";
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
import { Badge } from "@/components/ui/badge";
import { 
  LayoutDashboard, 
  Clock, 
  Brain, 
  Grid3x3, 
  History, 
  BarChart3, 
  Puzzle, 
  Settings,
  Crown,
  LogOut,
} from "lucide-react";

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
    title: "Simul",
    url: "/simul",
    icon: Grid3x3,
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
    title: "Puzzles",
    url: "/puzzles",
    icon: Puzzle,
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
  const { data: ratings } = useQuery<Rating>({
    queryKey: ["/api/ratings"],
  });

  const getHighestRating = () => {
    if (!ratings) return 1200;
    return Math.max(
      ratings.bullet || 0,
      ratings.blitz || 0,
      ratings.rapid || 0,
      ratings.classical || 0
    );
  };

  const getRatingTitle = (rating: number) => {
    if (rating < 1200) return "Beginner";
    if (rating < 1400) return "Novice";
    if (rating < 1600) return "Tactician";
    if (rating < 1800) return "Expert";
    if (rating < 2000) return "Master";
    if (rating < 2200) return "International Master";
    return "Grandmaster";
  };

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <div className="px-4 py-3 flex items-center gap-2">
            <div className="w-10 h-10 bg-primary rounded flex items-center justify-center text-primary-foreground font-bold text-xl">
              S
            </div>
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
      </SidebarContent>

      <SidebarFooter>
        <div className="px-4 py-4 border-t border-sidebar-border">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
            Current ELO
          </div>
          <div className="text-3xl font-bold font-mono" data-testid="text-sidebar-elo">
            {getHighestRating()}
          </div>
          <div className="text-sm text-primary mt-1">
            {getRatingTitle(getHighestRating())}
          </div>
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <a href="/api/logout" data-testid="button-logout-sidebar">
                <LogOut className="h-4 w-4" />
                <span>Log Out</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
