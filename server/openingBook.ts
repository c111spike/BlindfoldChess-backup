import type { BotPersonality } from "../shared/botTypes";

export interface BookMove {
  move: string;
  weight: number;
  style?: "aggressive" | "solid" | "tactical" | "positional";
}

export interface OpeningLine {
  moves: BookMove[];
}

const OPENING_BOOK: Record<string, BookMove[]> = {
  "": [
    { move: "e4", weight: 35, style: "aggressive" },
    { move: "d4", weight: 35, style: "positional" },
    { move: "Nf3", weight: 15, style: "solid" },
    { move: "c4", weight: 10, style: "positional" },
    { move: "g3", weight: 5, style: "solid" },
  ],
  
  "e4": [
    { move: "e5", weight: 30, style: "solid" },
    { move: "c5", weight: 30, style: "aggressive" },
    { move: "e6", weight: 15, style: "solid" },
    { move: "c6", weight: 10, style: "solid" },
    { move: "d5", weight: 10, style: "aggressive" },
    { move: "Nf6", weight: 5, style: "tactical" },
  ],
  
  "e4 e5": [
    { move: "Nf3", weight: 50, style: "solid" },
    { move: "Bc4", weight: 20, style: "tactical" },
    { move: "Nc3", weight: 15, style: "positional" },
    { move: "f4", weight: 10, style: "aggressive" },
    { move: "d4", weight: 5, style: "aggressive" },
  ],
  
  "e4 e5 Nf3": [
    { move: "Nc6", weight: 60, style: "solid" },
    { move: "Nf6", weight: 25, style: "tactical" },
    { move: "d6", weight: 15, style: "solid" },
  ],
  
  "e4 e5 Nf3 Nc6": [
    { move: "Bb5", weight: 35, style: "positional" },
    { move: "Bc4", weight: 35, style: "tactical" },
    { move: "d4", weight: 20, style: "aggressive" },
    { move: "Nc3", weight: 10, style: "solid" },
  ],
  
  "e4 e5 Nf3 Nc6 Bb5": [
    { move: "a6", weight: 40, style: "solid" },
    { move: "Nf6", weight: 30, style: "tactical" },
    { move: "d6", weight: 15, style: "solid" },
    { move: "Bc5", weight: 15, style: "aggressive" },
  ],
  
  "e4 e5 Nf3 Nc6 Bb5 a6": [
    { move: "Ba4", weight: 50, style: "solid" },
    { move: "Bxc6", weight: 30, style: "tactical" },
    { move: "Bc4", weight: 20, style: "aggressive" },
  ],
  
  "e4 e5 Nf3 Nc6 Bb5 a6 Ba4": [
    { move: "Nf6", weight: 50, style: "tactical" },
    { move: "d6", weight: 25, style: "solid" },
    { move: "b5", weight: 25, style: "aggressive" },
  ],
  
  "e4 e5 Nf3 Nc6 Bc4": [
    { move: "Bc5", weight: 40, style: "tactical" },
    { move: "Nf6", weight: 35, style: "aggressive" },
    { move: "Be7", weight: 15, style: "solid" },
    { move: "d6", weight: 10, style: "solid" },
  ],
  
  "e4 e5 Nf3 Nc6 Bc4 Bc5": [
    { move: "c3", weight: 40, style: "positional" },
    { move: "b4", weight: 25, style: "aggressive" },
    { move: "d3", weight: 20, style: "solid" },
    { move: "O-O", weight: 15, style: "solid" },
  ],
  
  "e4 e5 Nf3 Nc6 Bc4 Nf6": [
    { move: "Ng5", weight: 40, style: "aggressive" },
    { move: "d3", weight: 30, style: "solid" },
    { move: "Nc3", weight: 20, style: "positional" },
    { move: "d4", weight: 10, style: "aggressive" },
  ],
  
  "e4 c5": [
    { move: "Nf3", weight: 45, style: "solid" },
    { move: "Nc3", weight: 25, style: "positional" },
    { move: "c3", weight: 15, style: "solid" },
    { move: "d4", weight: 10, style: "aggressive" },
    { move: "f4", weight: 5, style: "aggressive" },
  ],
  
  "e4 c5 Nf3": [
    { move: "d6", weight: 35, style: "solid" },
    { move: "Nc6", weight: 30, style: "tactical" },
    { move: "e6", weight: 25, style: "solid" },
    { move: "g6", weight: 10, style: "positional" },
  ],
  
  "e4 c5 Nf3 d6": [
    { move: "d4", weight: 60, style: "aggressive" },
    { move: "Bb5+", weight: 25, style: "tactical" },
    { move: "c3", weight: 15, style: "solid" },
  ],
  
  "e4 c5 Nf3 d6 d4": [
    { move: "cxd4", weight: 70, style: "solid" },
    { move: "Nf6", weight: 30, style: "tactical" },
  ],
  
  "e4 c5 Nf3 d6 d4 cxd4": [
    { move: "Nxd4", weight: 90, style: "solid" },
    { move: "Qxd4", weight: 10, style: "aggressive" },
  ],
  
  "e4 c5 Nf3 d6 d4 cxd4 Nxd4": [
    { move: "Nf6", weight: 50, style: "tactical" },
    { move: "Nc6", weight: 30, style: "solid" },
    { move: "g6", weight: 20, style: "positional" },
  ],
  
  "e4 c5 Nf3 Nc6": [
    { move: "d4", weight: 50, style: "aggressive" },
    { move: "Bb5", weight: 30, style: "positional" },
    { move: "Nc3", weight: 20, style: "solid" },
  ],
  
  "e4 e6": [
    { move: "d4", weight: 70, style: "positional" },
    { move: "Nf3", weight: 20, style: "solid" },
    { move: "d3", weight: 10, style: "solid" },
  ],
  
  "e4 e6 d4": [
    { move: "d5", weight: 80, style: "solid" },
    { move: "c5", weight: 20, style: "aggressive" },
  ],
  
  "e4 e6 d4 d5": [
    { move: "Nc3", weight: 35, style: "positional" },
    { move: "Nd2", weight: 30, style: "solid" },
    { move: "e5", weight: 25, style: "aggressive" },
    { move: "exd5", weight: 10, style: "tactical" },
  ],
  
  "e4 c6": [
    { move: "d4", weight: 60, style: "positional" },
    { move: "Nc3", weight: 25, style: "tactical" },
    { move: "Nf3", weight: 15, style: "solid" },
  ],
  
  "e4 c6 d4": [
    { move: "d5", weight: 90, style: "solid" },
    { move: "Nf6", weight: 10, style: "aggressive" },
  ],
  
  "e4 c6 d4 d5": [
    { move: "Nc3", weight: 40, style: "tactical" },
    { move: "Nd2", weight: 30, style: "solid" },
    { move: "e5", weight: 20, style: "aggressive" },
    { move: "exd5", weight: 10, style: "tactical" },
  ],
  
  "e4 d5": [
    { move: "exd5", weight: 70, style: "tactical" },
    { move: "e5", weight: 20, style: "aggressive" },
    { move: "Nc3", weight: 10, style: "positional" },
  ],
  
  "e4 d5 exd5": [
    { move: "Qxd5", weight: 50, style: "aggressive" },
    { move: "Nf6", weight: 40, style: "tactical" },
    { move: "c6", weight: 10, style: "solid" },
  ],
  
  "d4": [
    { move: "d5", weight: 35, style: "solid" },
    { move: "Nf6", weight: 35, style: "tactical" },
    { move: "e6", weight: 15, style: "solid" },
    { move: "f5", weight: 10, style: "aggressive" },
    { move: "c5", weight: 5, style: "aggressive" },
  ],
  
  "d4 d5": [
    { move: "c4", weight: 50, style: "positional" },
    { move: "Nf3", weight: 25, style: "solid" },
    { move: "Bf4", weight: 15, style: "positional" },
    { move: "e3", weight: 10, style: "solid" },
  ],
  
  "d4 d5 c4": [
    { move: "e6", weight: 40, style: "solid" },
    { move: "c6", weight: 30, style: "solid" },
    { move: "dxc4", weight: 20, style: "tactical" },
    { move: "Nf6", weight: 10, style: "aggressive" },
  ],
  
  "d4 d5 c4 e6": [
    { move: "Nc3", weight: 40, style: "positional" },
    { move: "Nf3", weight: 35, style: "solid" },
    { move: "cxd5", weight: 15, style: "tactical" },
    { move: "Bg5", weight: 10, style: "aggressive" },
  ],
  
  "d4 d5 c4 e6 Nc3": [
    { move: "Nf6", weight: 50, style: "tactical" },
    { move: "c6", weight: 25, style: "solid" },
    { move: "Be7", weight: 15, style: "solid" },
    { move: "c5", weight: 10, style: "aggressive" },
  ],
  
  "d4 d5 c4 c6": [
    { move: "Nc3", weight: 35, style: "positional" },
    { move: "Nf3", weight: 35, style: "solid" },
    { move: "e3", weight: 20, style: "solid" },
    { move: "cxd5", weight: 10, style: "tactical" },
  ],
  
  "d4 Nf6": [
    { move: "c4", weight: 50, style: "positional" },
    { move: "Nf3", weight: 25, style: "solid" },
    { move: "Bg5", weight: 15, style: "aggressive" },
    { move: "Nc3", weight: 10, style: "positional" },
  ],
  
  "d4 Nf6 c4": [
    { move: "e6", weight: 30, style: "solid" },
    { move: "g6", weight: 30, style: "tactical" },
    { move: "c5", weight: 20, style: "aggressive" },
    { move: "e5", weight: 15, style: "aggressive" },
    { move: "d6", weight: 5, style: "solid" },
  ],
  
  "d4 Nf6 c4 e6": [
    { move: "Nc3", weight: 40, style: "positional" },
    { move: "Nf3", weight: 35, style: "solid" },
    { move: "g3", weight: 15, style: "positional" },
    { move: "Bg5", weight: 10, style: "aggressive" },
  ],
  
  "d4 Nf6 c4 e6 Nc3": [
    { move: "Bb4", weight: 40, style: "tactical" },
    { move: "d5", weight: 35, style: "solid" },
    { move: "Be7", weight: 15, style: "solid" },
    { move: "c5", weight: 10, style: "aggressive" },
  ],
  
  "d4 Nf6 c4 g6": [
    { move: "Nc3", weight: 45, style: "positional" },
    { move: "Nf3", weight: 35, style: "solid" },
    { move: "g3", weight: 15, style: "positional" },
    { move: "f3", weight: 5, style: "aggressive" },
  ],
  
  "d4 Nf6 c4 g6 Nc3": [
    { move: "Bg7", weight: 70, style: "solid" },
    { move: "d5", weight: 20, style: "aggressive" },
    { move: "d6", weight: 10, style: "solid" },
  ],
  
  "d4 Nf6 c4 g6 Nc3 Bg7": [
    { move: "e4", weight: 50, style: "aggressive" },
    { move: "Nf3", weight: 30, style: "solid" },
    { move: "g3", weight: 15, style: "positional" },
    { move: "Bg5", weight: 5, style: "aggressive" },
  ],
  
  "d4 Nf6 c4 g6 Nc3 Bg7 e4": [
    { move: "d6", weight: 60, style: "solid" },
    { move: "O-O", weight: 30, style: "solid" },
    { move: "d5", weight: 10, style: "aggressive" },
  ],
  
  "Nf3": [
    { move: "d5", weight: 35, style: "solid" },
    { move: "Nf6", weight: 30, style: "tactical" },
    { move: "c5", weight: 20, style: "aggressive" },
    { move: "g6", weight: 15, style: "positional" },
  ],
  
  "Nf3 d5": [
    { move: "d4", weight: 40, style: "positional" },
    { move: "g3", weight: 30, style: "solid" },
    { move: "c4", weight: 20, style: "tactical" },
    { move: "e3", weight: 10, style: "solid" },
  ],
  
  "Nf3 Nf6": [
    { move: "c4", weight: 35, style: "positional" },
    { move: "g3", weight: 30, style: "solid" },
    { move: "d4", weight: 25, style: "positional" },
    { move: "e3", weight: 10, style: "solid" },
  ],
  
  "c4": [
    { move: "e5", weight: 30, style: "aggressive" },
    { move: "Nf6", weight: 30, style: "tactical" },
    { move: "c5", weight: 20, style: "solid" },
    { move: "e6", weight: 15, style: "solid" },
    { move: "g6", weight: 5, style: "positional" },
  ],
  
  "c4 e5": [
    { move: "Nc3", weight: 45, style: "positional" },
    { move: "g3", weight: 35, style: "solid" },
    { move: "Nf3", weight: 20, style: "tactical" },
  ],
  
  "c4 Nf6": [
    { move: "Nc3", weight: 40, style: "positional" },
    { move: "d4", weight: 35, style: "positional" },
    { move: "g3", weight: 20, style: "solid" },
    { move: "Nf3", weight: 5, style: "solid" },
  ],
  
  "g3": [
    { move: "d5", weight: 40, style: "solid" },
    { move: "e5", weight: 25, style: "aggressive" },
    { move: "Nf6", weight: 20, style: "tactical" },
    { move: "c5", weight: 15, style: "aggressive" },
  ],
};

const PERSONALITY_STYLE_PREFERENCE: Record<BotPersonality, string[]> = {
  balanced: ["solid", "positional", "tactical", "aggressive"],
  tactician: ["tactical", "aggressive", "positional", "solid"],
  positional: ["positional", "solid", "tactical", "aggressive"],
  bishop_lover: ["tactical", "positional", "solid", "aggressive"],
  knight_lover: ["tactical", "aggressive", "positional", "solid"],
  aggressive: ["aggressive", "tactical", "positional", "solid"],
  defensive: ["solid", "positional", "tactical", "aggressive"],
};

function getMoveSequenceKey(moveHistory: string[]): string {
  return moveHistory.join(" ");
}

function selectWeightedMove(moves: BookMove[], personality: BotPersonality): BookMove {
  const stylePreference = PERSONALITY_STYLE_PREFERENCE[personality];
  
  const adjustedMoves = moves.map(m => {
    let weight = m.weight;
    if (m.style) {
      const styleIndex = stylePreference.indexOf(m.style);
      if (styleIndex !== -1) {
        const multiplier = [2.0, 1.5, 1.0, 0.6][styleIndex];
        weight *= multiplier;
      }
    }
    return { ...m, adjustedWeight: weight };
  });
  
  console.log(`[OpeningBook] Personality: ${personality}, Adjusted moves:`, 
    adjustedMoves.map(m => `${m.move}(${m.style}): ${m.weight} -> ${m.adjustedWeight.toFixed(1)}`));
  
  const totalWeight = adjustedMoves.reduce((sum, m) => sum + m.adjustedWeight, 0);
  let random = Math.random() * totalWeight;
  
  for (const move of adjustedMoves) {
    random -= move.adjustedWeight;
    if (random <= 0) {
      return move;
    }
  }
  
  return moves[0];
}

export function lookupOpeningMove(
  moveHistory: string[],
  personality: BotPersonality
): string | null {
  const key = getMoveSequenceKey(moveHistory);
  const bookMoves = OPENING_BOOK[key];
  
  if (!bookMoves || bookMoves.length === 0) {
    return null;
  }
  
  const selectedMove = selectWeightedMove(bookMoves, personality);
  return selectedMove.move;
}

export function isInOpeningPhase(moveCount: number): boolean {
  return moveCount <= 20;
}

export function getOpeningBookSize(): number {
  return Object.keys(OPENING_BOOK).length;
}
