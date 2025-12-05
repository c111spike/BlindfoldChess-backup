import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface PromotionDialogProps {
  open: boolean;
  color: "white" | "black";
  onSelect: (piece: "q" | "r" | "b" | "n") => void;
}

const PROMOTION_PIECES = [
  { key: "q" as const, name: "Queen", white: "♕", black: "♛" },
  { key: "r" as const, name: "Rook", white: "♖", black: "♜" },
  { key: "b" as const, name: "Bishop", white: "♗", black: "♝" },
  { key: "n" as const, name: "Knight", white: "♘", black: "♞" },
];

export function PromotionDialog({ open, color, onSelect }: PromotionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-center">Promote Pawn</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-4 gap-2">
          {PROMOTION_PIECES.map((piece) => (
            <Button
              key={piece.key}
              variant="outline"
              className="h-20 text-5xl hover-elevate"
              onClick={() => onSelect(piece.key)}
              data-testid={`button-promote-${piece.key}`}
            >
              {color === "white" ? piece.white : piece.black}
            </Button>
          ))}
        </div>
        <p className="text-center text-sm text-muted-foreground">
          Select a piece to promote your pawn
        </p>
      </DialogContent>
    </Dialog>
  );
}
