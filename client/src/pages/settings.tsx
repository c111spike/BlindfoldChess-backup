import { useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { User, Settings as SettingsIcon, LogOut, AlertTriangle } from "lucide-react";
import type { UserSettings } from "@shared/schema";

// Detect Safari/iOS browsers which don't support Web Speech API for voice input
// SSR-safe: only runs in browser environment
function isSafariOrIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return isSafari || isIOS;
}

export default function Settings() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const isVoiceInputUnsupported = useMemo(() => isSafariOrIOS(), []);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, authLoading, toast]);

  const { data: settings, isLoading: settingsLoading } = useQuery<UserSettings>({
    queryKey: ["/api/settings"],
    enabled: isAuthenticated,
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: Partial<UserSettings>) => {
      await apiRequest("PATCH", "/api/settings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "Settings updated",
        description: "Your preferences have been saved.",
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to update settings",
        variant: "destructive",
      });
    },
  });

  const handleSettingChange = (key: keyof UserSettings, value: any) => {
    updateSettingsMutation.mutate({ [key]: value });
  };

  if (settingsLoading || authLoading) {
    return (
      <div className="p-8 space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-4xl font-bold mb-2">Settings</h1>
        <p className="text-muted-foreground">Manage your account and preferences</p>
      </div>

      <Tabs defaultValue="account" className="space-y-6">
        <TabsList>
          <TabsTrigger value="account" data-testid="tab-account">
            <User className="mr-2 h-4 w-4" />
            Account
          </TabsTrigger>
          <TabsTrigger value="preferences" data-testid="tab-preferences">
            <SettingsIcon className="mr-2 h-4 w-4" />
            Preferences
          </TabsTrigger>
        </TabsList>

        <TabsContent value="account" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Account Information</CardTitle>
              <CardDescription>Your personal details and account status</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <p className="text-sm text-muted-foreground" data-testid="text-email">
                  {user?.email || "No email"}
                </p>
              </div>
              <div className="space-y-2">
                <Label>Name</Label>
                <p className="text-sm text-muted-foreground" data-testid="text-name">
                  {user?.firstName || user?.lastName 
                    ? `${user?.firstName || ""} ${user?.lastName || ""}`.trim()
                    : "Not set"}
                </p>
              </div>
              <div className="pt-4 border-t">
                <Button variant="outline" asChild data-testid="button-logout">
                  <a href="/api/logout">
                    <LogOut className="mr-2 h-4 w-4" />
                    Log Out
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preferences" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Game Preferences</CardTitle>
              <CardDescription>Customize your gameplay experience</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="piece-set">Piece Set</Label>
                <Select
                  value={settings?.pieceSet || "cburnett"}
                  onValueChange={(value) => handleSettingChange("pieceSet", value)}
                >
                  <SelectTrigger id="piece-set" data-testid="select-piece-set">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cburnett">CBurnett</SelectItem>
                    <SelectItem value="merida">Merida</SelectItem>
                    <SelectItem value="cardinal">Cardinal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="board-theme">Board Theme</Label>
                <Select
                  value={settings?.boardTheme || "blue"}
                  onValueChange={(value) => handleSettingChange("boardTheme", value)}
                >
                  <SelectTrigger id="board-theme" data-testid="select-board-theme">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="blue">Blue</SelectItem>
                    <SelectItem value="brown">Brown</SelectItem>
                    <SelectItem value="green">Green</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="sound">Sound Effects</Label>
                  <p className="text-sm text-muted-foreground">
                    Play sounds for moves and captures
                  </p>
                </div>
                <Switch
                  id="sound"
                  checked={settings?.soundEnabled ?? true}
                  onCheckedChange={(checked) => handleSettingChange("soundEnabled", checked)}
                  data-testid="switch-sound"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="highlight">Highlight Legal Moves</Label>
                  <p className="text-sm text-muted-foreground">
                    Show possible moves when a piece is selected
                  </p>
                </div>
                <Switch
                  id="highlight"
                  checked={settings?.highlightLegalMoves ?? true}
                  onCheckedChange={(checked) => handleSettingChange("highlightLegalMoves", checked)}
                  data-testid="switch-highlight"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="confirm">Confirm Moves</Label>
                  <p className="text-sm text-muted-foreground">
                    Require confirmation before making a move
                  </p>
                </div>
                <Switch
                  id="confirm"
                  checked={settings?.confirmMoves ?? false}
                  onCheckedChange={(checked) => handleSettingChange("confirmMoves", checked)}
                  data-testid="switch-confirm"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>OTB Tournament Settings</CardTitle>
              <CardDescription>Configure tournament mode behavior</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="arbiter">Arbiter Warnings</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive OTB-accurate arbiter notifications
                  </p>
                </div>
                <Switch
                  id="arbiter"
                  checked={settings?.arbiterWarnings ?? true}
                  onCheckedChange={(checked) => handleSettingChange("arbiterWarnings", checked)}
                  data-testid="switch-arbiter"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="auto-queen">Auto-Queen</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically promote pawns to queens
                  </p>
                </div>
                <Switch
                  id="auto-queen"
                  checked={settings?.autoQueen ?? false}
                  onCheckedChange={(checked) => handleSettingChange("autoQueen", checked)}
                  data-testid="switch-auto-queen"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Voice Control</CardTitle>
              <CardDescription>Voice features for Standard and Simul games (not available in OTB mode)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="voice-output">Voice Announcements</Label>
                  <p className="text-sm text-muted-foreground">
                    Hear moves spoken aloud during games
                  </p>
                </div>
                <Switch
                  id="voice-output"
                  checked={settings?.voiceOutputEnabled ?? false}
                  onCheckedChange={(checked) => handleSettingChange("voiceOutputEnabled", checked)}
                  data-testid="switch-voice-output"
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="voice-input">Voice Commands</Label>
                  <p className="text-sm text-muted-foreground">
                    Speak your moves instead of clicking (auto-listens on your turn)
                  </p>
                </div>
                <Switch
                  id="voice-input"
                  checked={settings?.voiceInputEnabled ?? false}
                  onCheckedChange={(checked) => handleSettingChange("voiceInputEnabled", checked)}
                  disabled={isVoiceInputUnsupported}
                  data-testid="switch-voice-input"
                />
              </div>
              {isVoiceInputUnsupported && (
                <Alert variant="default" className="bg-amber-500/10 border-amber-500/20" data-testid="alert-voice-unsupported">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <AlertDescription className="text-amber-600 dark:text-amber-400">
                    Voice input is not supported on Safari or iOS devices. Please use Chrome, Edge, or Firefox for voice commands.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
}
