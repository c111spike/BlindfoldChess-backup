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
import { Browser } from "@capacitor/browser";

const openExternalLink = async (url: string) => {
  try {
    await Browser.open({ url });
  } catch {
    window.open(url, "_blank");
  }
};

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
            <button
              onClick={() => openExternalLink("https://github.com/official-stockfish/Stockfish")}
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              data-testid="link-stockfish"
            >
              View Stockfish Source Code
              <ExternalLink className="h-3 w-3" />
            </button>
          </div>
          
          <div>
            <h3 className="font-semibold mb-2">Opening Book</h3>
            <p className="text-sm text-muted-foreground mb-2">
              Uses the gm2001 opening book (games 2001-2013, ELO 2530+) by Oliver Deville, freely distributed for chess engine use.
            </p>
            <button
              onClick={() => openExternalLink("https://github.com/michaeldv/donna_opening_books")}
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              data-testid="link-opening-book"
            >
              View Opening Book Source
              <ExternalLink className="h-3 w-3" />
            </button>
          </div>
          
          <div>
            <h3 className="font-semibold mb-2">Chess Pieces</h3>
            <p className="text-sm text-muted-foreground mb-2">
              Uses the Cburnett chess piece set by Colin M.L. Burnett, licensed under CC BY-SA 3.0.
            </p>
            <button
              onClick={() => openExternalLink("https://commons.wikimedia.org/wiki/Category:SVG_chess_pieces")}
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              data-testid="link-chess-pieces"
            >
              View Chess Pieces Source
              <ExternalLink className="h-3 w-3" />
            </button>
          </div>
          
          <div>
            <h3 className="font-semibold mb-2">Privacy Policy</h3>
            <p className="text-sm text-muted-foreground mb-2">
              This app operates entirely offline. It does not collect, store, or share any personal user data.
            </p>
            <button
              onClick={() => openExternalLink("https://github.com/c111spike/Blindfold-Chess#privacy-policy")}
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              data-testid="link-privacy"
            >
              View Full Privacy Policy
              <ExternalLink className="h-3 w-3" />
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
