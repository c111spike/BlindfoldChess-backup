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
import { 
  LayoutDashboard, 
  Clock, 
  Brain, 
  Grid3x3, 
  History, 
  BarChart3, 
  Settings,
  LogOut,
  Shield,
  FileText,
  HelpCircle,
  RotateCw,
} from "lucide-react";
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
    title: "Simul",
    url: "/simul",
    icon: Grid3x3,
  },
  {
    title: "Board Spin",
    url: "/boardspin",
    icon: RotateCw,
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
      </SidebarContent>

      <SidebarFooter>
        <div className="px-2 py-2 border-t border-sidebar-border">
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
                <Link href="/help" data-testid="link-help">
                  <HelpCircle className="h-4 w-4" />
                  <span>Help & Support</span>
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
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
