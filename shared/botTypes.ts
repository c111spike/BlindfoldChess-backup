// Depth + Random bot system
// Uses depth-limited Stockfish search with random move chance

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

export interface BotConfig {
  elo: number;
  depth: number;        // Search depth (1-6 for depth-limited, 0 = node-based unleashed)
  randomPercent: number; // Chance of playing a random legal move (0-50)
  description: string;
  nodes?: number;       // Optional override for node limit
}

export interface BotProfile {
  id: string;
  elo: number;
  difficulty: BotDifficulty;
  depth: number;
  randomPercent: number;
}

// Bot configuration by Elo
export const BOT_CONFIG: Record<number, BotConfig> = {
  400:  { elo: 400,  depth: 1, randomPercent: 50, description: "Blind coin-flipper. Hangs pieces constantly." },
  600:  { elo: 600,  depth: 1, randomPercent: 25, description: "Still blind to threats, but picks better squares." },
  800:  { elo: 800,  depth: 2, randomPercent: 25, description: "Sees captures, misses 2-move tactics." },
  1000: { elo: 1000, depth: 3, randomPercent: 15, description: "Sees forks and pins, occasionally forgets to defend." },
  1200: { elo: 1200, depth: 4, randomPercent: 10, description: "Club player. Solid but misses deep tactics." },
  1400: { elo: 1400, depth: 5, randomPercent: 5,  description: "Few unforced blunders. Needs real strategy to beat." },
  1600: { elo: 1600, depth: 6, randomPercent: 0,  description: "Pure tactical vision. Sharp human equivalent." },
  1800: { elo: 1800, depth: 0, randomPercent: 0,  description: "Unleashed: Full node-based search." },
  2000: { elo: 2000, depth: 0, randomPercent: 0,  description: "Unleashed: Full node-based search." },
  2200: { elo: 2200, depth: 0, randomPercent: 0,  description: "Unleashed: Full node-based search." },
  2400: { elo: 2400, depth: 0, randomPercent: 0,  description: "Unleashed: Full node-based search." },
  2600: { elo: 2600, depth: 0, randomPercent: 0,  description: "Unleashed: Full node-based search.", nodes: 1500000 },
};

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

// Generate bot profiles with depth and randomPercent
export const BOTS: BotProfile[] = ALL_DIFFICULTIES.map(difficulty => {
  const elo = BOT_DIFFICULTY_ELO[difficulty];
  const config = BOT_CONFIG[elo];
  return {
    id: difficulty,
    elo,
    difficulty,
    depth: config.depth,
    randomPercent: config.randomPercent,
  };
});

export function getBotById(id: string): BotProfile | undefined {
  return BOTS.find(bot => bot.id === id);
}

export function getBotByElo(elo: number): BotProfile | undefined {
  return BOTS.find(bot => bot.elo === elo);
}

export function getDifficultyFromElo(elo: number): BotDifficulty {
  return `elo_${elo}` as BotDifficulty;
}
