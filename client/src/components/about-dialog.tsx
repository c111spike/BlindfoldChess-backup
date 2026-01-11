import { useState, useEffect } from "react";
import { Info, ExternalLink, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function AboutDialog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleCloseAll = () => setOpen(false);
    window.addEventListener('closeAllDialogs', handleCloseAll);
    return () => window.removeEventListener('closeAllDialogs', handleCloseAll);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" data-testid="button-about">
          <Info className="h-5 w-5" />
          <span className="sr-only">About</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>About Blindfold Chess</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 text-sm">
          <div>
            <h3 className="font-semibold mb-2">Privacy Policy</h3>
            <p className="text-muted-foreground">
              <strong>100% Offline & Private</strong> — This app is designed to be completely offline. 
              We do not collect, store, or transmit any personal data, chess games, or voice recordings 
              to external servers. All game history and settings are stored locally on your device.
            </p>
          </div>
          
          <div>
            <h3 className="font-semibold mb-2">Open Source & Licenses</h3>
            <ul className="space-y-2 text-muted-foreground">
              <li>
                <strong>Stockfish Chess Engine:</strong> Licensed under the GNU GPL v3. 
                <a href="https://stockfishchess.org" target="_blank" rel="noopener noreferrer" className="text-amber-600 hover:underline ml-1 inline-flex items-center gap-1">
                  stockfishchess.org <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li>
                <strong>2D Chess Imagery:</strong> "Cburnett" piece set by Colin M.L. Burnett (CC BY-SA 3.0).
              </li>
              <li>
                <strong>Capacitor Runtime:</strong> Licensed under the MIT License.
              </li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-semibold mb-2">Project Links</h3>
            <div className="flex flex-col gap-2">
              <a 
                href="https://github.com/official-stockfish/Stockfish" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-amber-600 hover:underline inline-flex items-center gap-1"
              >
                <ExternalLink className="h-3 w-3" /> Stockfish Source Code
              </a>
            </div>
          </div>
          
          <div>
            <h3 className="font-semibold mb-2">Technical Info</h3>
            <ul className="space-y-1 text-muted-foreground">
              <li><strong>Engine:</strong> Stockfish 17.1 (WASM)</li>
              <li><strong>Version:</strong> 1.0.0</li>
              <li className="flex items-center gap-1">
                <Moon className="h-3 w-3" />
                <strong>Auto-Sleep:</strong> Disabled during active games
              </li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
