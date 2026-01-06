import { useState } from "react";
import { Info, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function AboutDialog() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" data-testid="button-about">
          <Info className="h-5 w-5" />
          <span className="sr-only">About</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>About Blindfold Chess</DialogTitle>
          <DialogDescription>
            A minimalist blindfold chess trainer for Android
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 pt-4">
          <div>
            <h3 className="font-semibold mb-1">Version</h3>
            <p className="text-sm text-muted-foreground">1.0.0</p>
          </div>
          
          <div>
            <h3 className="font-semibold mb-1">Age Rating</h3>
            <p className="text-sm text-muted-foreground">
              This app is intended for users ages 13 and older.
            </p>
          </div>
          
          <div>
            <h3 className="font-semibold mb-2">Chess Engine</h3>
            <p className="text-sm text-muted-foreground mb-2">
              Powered by the Stockfish Chess Engine, licensed under the GNU General Public License v3 (GPL v3).
            </p>
            <a
              href="https://github.com/official-stockfish/Stockfish"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              data-testid="link-stockfish"
            >
              View Stockfish Source Code
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          
          <div>
            <h3 className="font-semibold mb-2">Privacy Policy</h3>
            <p className="text-sm text-muted-foreground mb-2">
              This app operates entirely offline. It does not collect, store, or share any personal user data.
            </p>
            <a
              href="https://github.com/c111spike/Blindfold-Chess#privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              data-testid="link-privacy"
            >
              View Full Privacy Policy
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
