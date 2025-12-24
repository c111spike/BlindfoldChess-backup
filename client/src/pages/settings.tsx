import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { Helmet } from "react-helmet-async";
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
import { Input } from "@/components/ui/input";
import { User, Settings as SettingsIcon, LogOut, AlertTriangle, Trash2, Info, ExternalLink, BookOpen, Award, HandshakeIcon } from "lucide-react";
import type { UserSettings } from "@shared/schema";
import { OTB_TUTORIAL_COMPLETED_KEY } from "@/components/otb-tutorial";
import { REPERTOIRE_TUTORIAL_COMPLETED_KEY } from "@/components/repertoire-tutorial";

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
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const DELETE_CONFIRMATION_PHRASE = "Delete my account";
  const [otbTutorialSeen, setOtbTutorialSeen] = useState(true);
  const [repertoireTutorialSeen, setRepertoireTutorialSeen] = useState(true);

  // Check if tutorials have been completed
  useEffect(() => {
    const otbCompleted = localStorage.getItem(OTB_TUTORIAL_COMPLETED_KEY);
    setOtbTutorialSeen(otbCompleted === "true");
    const repertoireCompleted = localStorage.getItem(REPERTOIRE_TUTORIAL_COMPLETED_KEY);
    setRepertoireTutorialSeen(repertoireCompleted === "true");
  }, []);

  const handleResetOTBTutorial = () => {
    localStorage.removeItem(OTB_TUTORIAL_COMPLETED_KEY);
    setOtbTutorialSeen(false);
    toast({
      title: "Tutorial Reset",
      description: "The OTB tutorial will show again when you next visit OTB mode.",
    });
  };

  const handleResetRepertoireTutorial = () => {
    localStorage.removeItem(REPERTOIRE_TUTORIAL_COMPLETED_KEY);
    setRepertoireTutorialSeen(false);
    toast({
      title: "Tutorial Reset",
      description: "The Repertoire tutorial will show again when you next visit the Repertoire Trainer.",
    });
  };
  
  // Local state for color pickers to avoid toast spam during drag
  const [localColors, setLocalColors] = useState<{
    selectedPieceColor?: string;
    availableMovesColor?: string;
    lastMoveColor?: string;
  }>({});
  const colorDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const pendingColorUpdateRef = useRef<Partial<UserSettings> | null>(null);

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

  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", "/api/users/me");
    },
    onSuccess: () => {
      toast({
        title: "Account deleted",
        description: "Your account has been permanently deleted.",
      });
      window.location.href = "/";
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
        description: "Failed to delete account. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleDeleteAccount = () => {
    if (deleteConfirmText === DELETE_CONFIRMATION_PHRASE) {
      deleteAccountMutation.mutate();
    }
  };

  const handleSettingChange = (key: keyof UserSettings, value: any) => {
    updateSettingsMutation.mutate({ [key]: value });
  };

  // Helper to flush pending color updates (used by debounce and unmount)
  const flushColorUpdate = useCallback(async () => {
    if (pendingColorUpdateRef.current) {
      const dataToSave = pendingColorUpdateRef.current;
      pendingColorUpdateRef.current = null;
      try {
        await apiRequest("PATCH", "/api/settings", dataToSave);
        queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
        toast({
          title: "Settings updated",
          description: "Your color preferences have been saved.",
        });
        setLocalColors({}); // Clear local overrides
      } catch (error) {
        // Handle unauthorized errors like the main mutation does
        if (isUnauthorizedError(error as Error)) {
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
          description: "Failed to update color settings",
          variant: "destructive",
        });
      }
    }
  }, [toast]);

  // Debounced handler for color pickers - shows single toast after drag ends
  const handleColorChange = useCallback((key: keyof typeof localColors, value: string) => {
    // Update local state immediately for responsive UI
    setLocalColors(prev => ({ ...prev, [key]: value }));
    
    // Clear any pending debounce
    if (colorDebounceRef.current) {
      clearTimeout(colorDebounceRef.current);
    }
    
    // Store the pending update
    pendingColorUpdateRef.current = { 
      ...pendingColorUpdateRef.current, 
      [key]: value 
    };
    
    // Debounce the actual save - only fires after 500ms of no changes
    colorDebounceRef.current = setTimeout(() => {
      flushColorUpdate();
    }, 500);
  }, [flushColorUpdate]);

  // Flush pending color changes on unmount to avoid silent data loss
  useEffect(() => {
    return () => {
      if (colorDebounceRef.current) {
        clearTimeout(colorDebounceRef.current);
      }
      // Flush any pending changes synchronously on unmount
      if (pendingColorUpdateRef.current) {
        const dataToSave = pendingColorUpdateRef.current;
        pendingColorUpdateRef.current = null;
        // Fire and forget - can't await in cleanup
        apiRequest("PATCH", "/api/settings", dataToSave).then(() => {
          queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
        }).catch(() => {
          // Silently fail on unmount - user is navigating away
        });
      }
    };
  }, []);

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
      <Helmet>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div>
        <h1 className="text-4xl font-bold mb-2">Settings</h1>
        <p className="text-muted-foreground">Manage your account and preferences</p>
      </div>

      <Tabs defaultValue="preferences" className="space-y-6">
        <TabsList>
          <TabsTrigger value="preferences" data-testid="tab-preferences">
            <SettingsIcon className="mr-2 h-4 w-4" />
            Preferences
          </TabsTrigger>
          <TabsTrigger value="account" data-testid="tab-account">
            <User className="mr-2 h-4 w-4" />
            Account
          </TabsTrigger>
          <TabsTrigger value="credits" data-testid="tab-credits">
            <Info className="mr-2 h-4 w-4" />
            Credits
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
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Award className="h-4 w-4" />
                  Badges & Achievements
                </Label>
                <div className="flex flex-wrap gap-2" data-testid="badges-container">
                  {user?.badges && user.badges.length > 0 ? (
                    user.badges.map((badge: string) => (
                      <Badge key={badge} variant="secondary" className="flex items-center gap-1.5">
                        {badge === "sportsman" && <HandshakeIcon className="h-3 w-3" />}
                        {badge === "sportsman" ? "Sportsman" : badge}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No badges earned yet</p>
                  )}
                </div>
                {typeof user?.handshakeStreak === 'number' && user.handshakeStreak > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Handshake streak: {user.handshakeStreak} consecutive games
                  </p>
                )}
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

          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Danger Zone
              </CardTitle>
              <CardDescription>
                Irreversible actions that affect your account
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Deleting your account will permanently remove all your data including games, ratings, puzzles, and statistics. This action cannot be undone.
                </AlertDescription>
              </Alert>
              <div className="space-y-2">
                <Label htmlFor="delete-confirm">
                  Type <span className="font-mono font-semibold">"{DELETE_CONFIRMATION_PHRASE}"</span> to confirm
                </Label>
                <Input
                  id="delete-confirm"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder={DELETE_CONFIRMATION_PHRASE}
                  data-testid="input-delete-confirm"
                />
              </div>
              <Button
                variant="destructive"
                disabled={deleteConfirmText !== DELETE_CONFIRMATION_PHRASE || deleteAccountMutation.isPending}
                onClick={handleDeleteAccount}
                data-testid="button-delete-account"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {deleteAccountMutation.isPending ? "Deleting..." : "Delete Account"}
              </Button>
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
              <CardTitle>Board Highlight Colors</CardTitle>
              <CardDescription>Customize how pieces and moves are highlighted on the board</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="selected-piece-color">Selected Piece</Label>
                <p className="text-sm text-muted-foreground">
                  Color used to highlight the piece you've selected
                </p>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    id="selected-piece-color"
                    value={localColors.selectedPieceColor ?? settings?.selectedPieceColor ?? "#facc15"}
                    onChange={(e) => handleColorChange("selectedPieceColor", e.target.value)}
                    className="w-12 h-9 rounded border cursor-pointer"
                    data-testid="input-selected-piece-color"
                  />
                  <span className="text-sm font-mono text-muted-foreground">
                    {localColors.selectedPieceColor ?? settings?.selectedPieceColor ?? "#facc15"}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="available-moves-color">Available Moves</Label>
                <p className="text-sm text-muted-foreground">
                  Color used to show squares where the selected piece can move
                </p>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    id="available-moves-color"
                    value={localColors.availableMovesColor ?? settings?.availableMovesColor ?? "#22c55e"}
                    onChange={(e) => handleColorChange("availableMovesColor", e.target.value)}
                    className="w-12 h-9 rounded border cursor-pointer"
                    data-testid="input-available-moves-color"
                  />
                  <span className="text-sm font-mono text-muted-foreground">
                    {localColors.availableMovesColor ?? settings?.availableMovesColor ?? "#22c55e"}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="last-move-color">Last Move</Label>
                <p className="text-sm text-muted-foreground">
                  Color used to highlight the previous move's squares
                </p>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    id="last-move-color"
                    value={localColors.lastMoveColor ?? settings?.lastMoveColor ?? "#facc15"}
                    onChange={(e) => handleColorChange("lastMoveColor", e.target.value)}
                    className="w-12 h-9 rounded border cursor-pointer"
                    data-testid="input-last-move-color"
                  />
                  <span className="text-sm font-mono text-muted-foreground">
                    {localColors.lastMoveColor ?? settings?.lastMoveColor ?? "#facc15"}
                  </span>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  handleSettingChange("selectedPieceColor", "#facc15");
                  handleSettingChange("availableMovesColor", "#22c55e");
                  handleSettingChange("lastMoveColor", "#facc15");
                }}
                data-testid="button-reset-colors"
              >
                Reset to Defaults
              </Button>
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

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>OTB Tutorial</Label>
                  <p className="text-sm text-muted-foreground">
                    Learn handshake, clock, touch-move, and arbiter features
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResetOTBTutorial}
                  disabled={!otbTutorialSeen}
                  data-testid="button-replay-otb-tutorial"
                >
                  <BookOpen className="h-4 w-4 mr-2" />
                  {otbTutorialSeen ? "Replay Tutorial" : "Not Yet Viewed"}
                </Button>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Repertoire Trainer Tutorial</Label>
                  <p className="text-sm text-muted-foreground">
                    Learn how to build and practice your opening repertoires
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResetRepertoireTutorial}
                  disabled={!repertoireTutorialSeen}
                  data-testid="button-replay-repertoire-tutorial"
                >
                  <BookOpen className="h-4 w-4 mr-2" />
                  {repertoireTutorialSeen ? "Replay Tutorial" : "Not Yet Viewed"}
                </Button>
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

        <TabsContent value="credits" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Attribution & Credits</CardTitle>
              <CardDescription>Third-party assets and licenses used in SimulChess</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <h3 className="font-semibold text-base">3D Chess Pieces</h3>
                <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                  <div className="flex-1">
                    <p className="font-medium">Wooden Chess Set</p>
                    <p className="text-sm text-muted-foreground">by cmzw on Sketchfab</p>
                    <a 
                      href="https://sketchfab.com/3d-models/wooden-chess-set-90151fb0fb294e56b45e52b001a884db" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-2"
                      data-testid="link-3d-model-credit"
                    >
                      View original model
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <Badge variant="secondary">CC BY 4.0</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Licensed under Creative Commons Attribution 4.0 International. Commercial use permitted with attribution.
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="font-semibold text-base">Chess Engine</h3>
                <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                  <div className="flex-1">
                    <p className="font-medium">Stockfish</p>
                    <p className="text-sm text-muted-foreground">World's strongest open-source chess engine</p>
                    <a 
                      href="https://stockfishchess.org/" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-2"
                      data-testid="link-stockfish-credit"
                    >
                      stockfishchess.org
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <Badge variant="secondary">GPL-3.0</Badge>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="font-semibold text-base">Chess Logic</h3>
                <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                  <div className="flex-1">
                    <p className="font-medium">chess.js</p>
                    <p className="text-sm text-muted-foreground">JavaScript chess library for move validation</p>
                    <a 
                      href="https://github.com/jhlywa/chess.js" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-2"
                      data-testid="link-chessjs-credit"
                    >
                      GitHub Repository
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <Badge variant="secondary">BSD-2-Clause</Badge>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="font-semibold text-base">Opening Database</h3>
                <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                  <div className="flex-1">
                    <p className="font-medium">Lichess Opening Explorer</p>
                    <p className="text-sm text-muted-foreground">Opening database powered by millions of master and player games</p>
                    <a 
                      href="https://lichess.org/api#tag/Opening-Explorer" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-2"
                      data-testid="link-lichess-credit"
                    >
                      lichess.org/api
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <Badge variant="secondary">AGPL-3.0</Badge>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="font-semibold text-base">Endgame Tablebases</h3>
                <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                  <div className="flex-1">
                    <p className="font-medium">Syzygy Tablebases</p>
                    <p className="text-sm text-muted-foreground">Perfect endgame analysis for positions with up to 7 pieces</p>
                    <a 
                      href="https://syzygy-tables.info/" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-2"
                      data-testid="link-syzygy-credit"
                    >
                      syzygy-tables.info
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <Badge variant="secondary">Public Domain</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
}
