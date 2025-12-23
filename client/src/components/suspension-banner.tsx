import { AlertTriangle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface SuspensionBannerProps {
  showForMultiplayer?: boolean;
}

export function SuspensionBanner({ showForMultiplayer = true }: SuspensionBannerProps) {
  const { isSuspended, suspendedUntil } = useAuth();

  if (!isSuspended || !showForMultiplayer) {
    return null;
  }

  const formattedDate = suspendedUntil?.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <Alert variant="destructive" className="mb-4" data-testid="suspension-banner">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Account Suspended</AlertTitle>
      <AlertDescription>
        Your account is suspended until {formattedDate}. You cannot play against other players, 
        but you can still play against bots and use all training modes (Board Spin, Knight's Tour, 
        N-Piece Challenge, Opening Repertoire Trainer, and Puzzles).
      </AlertDescription>
    </Alert>
  );
}
