import { useState } from "react";
import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UserPlus, X } from "lucide-react";

interface GuestSignupPromptProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gamesPlayed?: number;
  peekTimesRecorded?: number;
}

export function GuestSignupPrompt({ 
  open, 
  onOpenChange, 
  gamesPlayed = 0,
  peekTimesRecorded = 0
}: GuestSignupPromptProps) {
  const [, setLocation] = useLocation();

  const handleSignUp = () => {
    onOpenChange(false);
    setLocation('/signup');
  };

  const handleContinueAsGuest = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-guest-signup">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" data-testid="text-guest-prompt-title">
            <UserPlus className="h-5 w-5 text-primary" />
            Save Your Progress
          </DialogTitle>
          <DialogDescription data-testid="text-guest-prompt-description">
            You're playing as a guest. Create a free account to:
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-3 py-4">
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 rounded-full bg-primary mt-2" />
            <p className="text-sm text-muted-foreground">
              Save your game history and track your improvement
            </p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 rounded-full bg-primary mt-2" />
            <p className="text-sm text-muted-foreground">
              Keep your ratings across all training modes
            </p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 rounded-full bg-primary mt-2" />
            <p className="text-sm text-muted-foreground">
              Play multiplayer matches with other members
            </p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 rounded-full bg-primary mt-2" />
            <p className="text-sm text-muted-foreground">
              Access your progress from any device
            </p>
          </div>
          
          {(gamesPlayed > 0 || peekTimesRecorded > 0) && (
            <div className="mt-4 p-3 rounded-md bg-muted/50 border">
              <p className="text-sm font-medium mb-1">Your session so far:</p>
              {gamesPlayed > 0 && (
                <p className="text-sm text-muted-foreground">
                  {gamesPlayed} game{gamesPlayed !== 1 ? 's' : ''} played
                </p>
              )}
              {peekTimesRecorded > 0 && (
                <p className="text-sm text-muted-foreground">
                  {peekTimesRecorded} peek time{peekTimesRecorded !== 1 ? 's' : ''} recorded
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Sign up now to keep this data!
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleContinueAsGuest}
            className="w-full sm:w-auto"
            data-testid="button-continue-guest"
          >
            <X className="mr-2 h-4 w-4" />
            Continue as Guest
          </Button>
          <Button
            onClick={handleSignUp}
            className="w-full sm:w-auto"
            data-testid="button-create-account"
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Create Free Account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
