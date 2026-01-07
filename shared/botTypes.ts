// Simplified Elo-only bot system
// Uses Stockfish UCI_LimitStrength for calibrated play

export type BotDifficulty = 
  | "elo_400"
  | "elo_600"
  | "elo_800"
  | "elo_1000"
  | "elo_1200"
  | "elo_1400"
  | "elo_1600"
  | "elo_1800"
  | "elo_2000"
  | "elo_2200"
  | "elo_2400"
  | "elo_2600";

export interface BotProfile {
  id: string;
  elo: number;
  difficulty: BotDifficulty;
}

// Map difficulty to Elo rating
export const BOT_DIFFICULTY_ELO: Record<BotDifficulty, number> = {
  elo_400: 400,
  elo_600: 600,
  elo_800: 800,
  elo_1000: 1000,
  elo_1200: 1200,
  elo_1400: 1400,
  elo_1600: 1600,
  elo_1800: 1800,
  elo_2000: 2000,
  elo_2200: 2200,
  elo_2400: 2400,
  elo_2600: 2600,
};

// All difficulties in order
export const ALL_DIFFICULTIES: BotDifficulty[] = [
  "elo_400",
  "elo_600", 
  "elo_800",
  "elo_1000",
  "elo_1200",
  "elo_1400",
  "elo_1600",
  "elo_1800",
  "elo_2000",
  "elo_2200",
  "elo_2400",
  "elo_2600",
];

// All Elo values
export const ALL_ELOS: number[] = [400, 600, 800, 1000, 1200, 1400, 1600, 1800, 2000, 2200, 2400, 2600];

// Generate simple bot profiles (one per Elo level)
export const BOTS: BotProfile[] = ALL_DIFFICULTIES.map(difficulty => ({
  id: difficulty,
  elo: BOT_DIFFICULTY_ELO[difficulty],
  difficulty,
}));

export function getBotById(id: string): BotProfile | undefined {
  return BOTS.find(bot => bot.id === id);
}

export function getBotByElo(elo: number): BotProfile | undefined {
  return BOTS.find(bot => bot.elo === elo);
}

export function getDifficultyFromElo(elo: number): BotDifficulty {
  return `elo_${elo}` as BotDifficulty;
}
