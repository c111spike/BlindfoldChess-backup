import { useQuery } from "@tanstack/react-query";
import type { UserSettings } from "@shared/schema";

export interface HighlightColors {
  selectedPiece: string;
  availableMoves: string;
  lastMove: string;
}

const DEFAULT_COLORS: HighlightColors = {
  selectedPiece: "#facc15", // Yellow for selected piece
  availableMoves: "#22c55e", // Green for available moves
  lastMove: "#f97316", // Orange for last move (distinct from selected)
};

export function useHighlightColors(): HighlightColors {
  const { data: settings } = useQuery<UserSettings>({
    queryKey: ["/api/settings"],
  });

  return {
    selectedPiece: settings?.selectedPieceColor || DEFAULT_COLORS.selectedPiece,
    availableMoves: settings?.availableMovesColor || DEFAULT_COLORS.availableMoves,
    lastMove: settings?.lastMoveColor || DEFAULT_COLORS.lastMove,
  };
}

export function getDefaultHighlightColors(): HighlightColors {
  return DEFAULT_COLORS;
}
