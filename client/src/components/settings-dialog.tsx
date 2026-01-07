import { useState, useEffect } from "react";
import { Settings, Mic, MicOff, Bell, BellOff, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Capacitor } from "@capacitor/core";
import { checkMicPermission, requestMicPermission, type MicPermissionStatus } from "@/lib/voice";
import { getToastsEnabled, setToastsEnabled } from "@/hooks/use-toast";

export function SettingsDialog() {
  const [open, setOpen] = useState(false);
  const [micStatus, setMicStatus] = useState<MicPermissionStatus>('unknown');
  const [isRequestingMic, setIsRequestingMic] = useState(false);
  const [toastsEnabled, setToastsEnabledState] = useState(getToastsEnabled());

  useEffect(() => {
    if (open) {
      checkMicPermission().then(setMicStatus);
    }
  }, [open]);

  const handleMicRequest = async () => {
    setIsRequestingMic(true);
    try {
      const result = await requestMicPermission();
      setMicStatus(result.status);
    } finally {
      setIsRequestingMic(false);
    }
  };

  const handleToastToggle = (enabled: boolean) => {
    setToastsEnabledState(enabled);
    setToastsEnabled(enabled);
  };

  const openSystemSettings = () => {
    if (Capacitor.isNativePlatform()) {
      alert("To enable microphone access, please go to your device Settings > Apps > Blindfold Chess > Permissions > Microphone and select 'Allow'.");
    }
  };

  const getMicStatusDisplay = () => {
    switch (micStatus) {
      case 'granted':
        return { icon: Mic, text: 'Enabled', color: 'text-green-500' };
      case 'denied':
      case 'prompt':
        return { icon: MicOff, text: 'Not enabled', color: 'text-muted-foreground' };
      case 'prompt-with-rationale':
        return { icon: MicOff, text: 'Blocked', color: 'text-destructive' };
      default:
        return { icon: MicOff, text: 'Unknown', color: 'text-muted-foreground' };
    }
  };

  const micDisplay = getMicStatusDisplay();
  const MicIcon = micDisplay.icon;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" data-testid="button-settings">
          <Settings className="h-5 w-5" />
          <span className="sr-only">Settings</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Configure app preferences
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 pt-4">
          <div className="space-y-3">
            <h3 className="font-semibold">Notifications</h3>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {toastsEnabled ? (
                  <Bell className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <BellOff className="h-4 w-4 text-muted-foreground" />
                )}
                <Label htmlFor="toast-toggle" className="text-sm">
                  Toast notifications
                </Label>
              </div>
              <Switch
                id="toast-toggle"
                checked={toastsEnabled}
                onCheckedChange={handleToastToggle}
                data-testid="switch-toast-notifications"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Show brief pop-up messages for game events
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold">Voice Control</h3>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MicIcon className={`h-4 w-4 ${micDisplay.color}`} />
                <span className="text-sm">Microphone: <span className={micDisplay.color}>{micDisplay.text}</span></span>
              </div>
            </div>
            
            {micStatus === 'granted' ? (
              <p className="text-xs text-muted-foreground">
                Voice commands are ready to use
              </p>
            ) : micStatus === 'prompt-with-rationale' ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Microphone access was blocked. Voice control requires microphone permission for blindfold training.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={openSystemSettings}
                  className="w-full"
                  data-testid="button-open-settings"
                >
                  <ExternalLink className="h-3 w-3 mr-2" />
                  Open Device Settings
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Enable microphone access for voice-controlled chess moves
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleMicRequest}
                  disabled={isRequestingMic}
                  className="w-full"
                  data-testid="button-request-mic"
                >
                  <Mic className="h-3 w-3 mr-2" />
                  {isRequestingMic ? 'Requesting...' : 'Enable Microphone'}
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
