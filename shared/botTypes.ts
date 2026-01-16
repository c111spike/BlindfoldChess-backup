// Continuous Elo slider system (400-2600)
// Uses Stockfish Skill Level + depth + random move chance

export interface BotConfig {
  elo: number;
  depth: number;        // Search depth (1-6 for depth-limited, 0 = unleashed)
  randomPercent: number; // Chance of playing a random legal move (0-50)
  skillLevel: number;   // Stockfish Skill Level (0-20)
  nodes?: number;       // Optional node limit for unleashed mode
}

// Non-linear curve for Elo to config mapping
// Zones: Beginner (400-800), Casual (800-1200), Club (1200-1800), Master (1800-2600)
export function getBotConfigFromElo(elo: number): BotConfig {
  const clampedElo = Math.max(400, Math.min(2600, elo));
  
  if (clampedElo <= 600) {
    // Beginner tier: depth 1, high random, very low skill
    const t = (clampedElo - 400) / 200; // 0 to 1
    return {
      elo: clampedElo,
      depth: 1,
      randomPercent: Math.round(50 - t * 20), // 50% → 30%
      skillLevel: Math.round(t * 2), // 0 → 2
    };
  }
  
  if (clampedElo <= 800) {
    // Late beginner: depth 1-2, medium-high random
    const t = (clampedElo - 600) / 200;
    return {
      elo: clampedElo,
      depth: 1 + Math.round(t), // 1 → 2
      randomPercent: Math.round(30 - t * 10), // 30% → 20%
      skillLevel: Math.round(2 + t * 3), // 2 → 5
    };
  }
  
  if (clampedElo <= 1000) {
    // Casual tier: depth 2-3
    const t = (clampedElo - 800) / 200;
    return {
      elo: clampedElo,
      depth: 2 + Math.round(t), // 2 → 3
      randomPercent: Math.round(20 - t * 8), // 20% → 12%
      skillLevel: Math.round(5 + t * 3), // 5 → 8
    };
  }
  
  if (clampedElo <= 1200) {
    // Late casual: depth 3-4
    const t = (clampedElo - 1000) / 200;
    return {
      elo: clampedElo,
      depth: 3 + Math.round(t), // 3 → 4
      randomPercent: Math.round(12 - t * 5), // 12% → 7%
      skillLevel: Math.round(8 + t * 2), // 8 → 10
    };
  }
  
  if (clampedElo <= 1400) {
    // Club player: depth 4-5
    const t = (clampedElo - 1200) / 200;
    return {
      elo: clampedElo,
      depth: 4 + Math.round(t), // 4 → 5
      randomPercent: Math.round(7 - t * 4), // 7% → 3%
      skillLevel: Math.round(10 + t * 2), // 10 → 12
    };
  }
  
  if (clampedElo <= 1600) {
    // Strong club: depth 5-6
    const t = (clampedElo - 1400) / 200;
    return {
      elo: clampedElo,
      depth: 5 + Math.round(t), // 5 → 6
      randomPercent: Math.round(3 - t * 3), // 3% → 0%
      skillLevel: Math.round(12 + t * 3), // 12 → 15
    };
  }
  
  if (clampedElo <= 1800) {
    // Expert: depth 6, no random
    const t = (clampedElo - 1600) / 200;
    return {
      elo: clampedElo,
      depth: 6,
      randomPercent: 0,
      skillLevel: Math.round(15 + t * 2), // 15 → 17
    };
  }
  
  // Master tier (1800-2600): Unleashed with skill 17-20 and increasing nodes
  const t = (clampedElo - 1800) / 800; // 0 to 1
  const baseNodes = 200000;
  const maxNodes = 2000000;
  return {
    elo: clampedElo,
    depth: 0, // Unleashed
    randomPercent: 0,
    skillLevel: Math.round(17 + t * 3), // 17 → 20
    nodes: Math.round(baseNodes + t * (maxNodes - baseNodes)),
  };
}

// Get display label for Elo ranges
export function getEloLabel(elo: number): string {
  if (elo <= 600) return "Beginner";
  if (elo <= 800) return "Novice";
  if (elo <= 1000) return "Casual";
  if (elo <= 1200) return "Intermediate";
  if (elo <= 1400) return "Club Player";
  if (elo <= 1600) return "Strong Club";
  if (elo <= 1800) return "Expert";
  if (elo <= 2000) return "Master";
  if (elo <= 2200) return "National Master";
  if (elo <= 2400) return "International Master";
  return "Grandmaster";
}

// Legacy exports for backward compatibility
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
  depth: number;
  randomPercent: number;
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

// All Elo values (legacy - use slider instead)
export const ALL_ELOS: number[] = [400, 600, 800, 1000, 1200, 1400, 1600, 1800, 2000, 2200, 2400, 2600];

// Generate legacy bot profiles from new system
export const BOTS: BotProfile[] = ALL_ELOS.map(elo => {
  const config = getBotConfigFromElo(elo);
  return {
    id: `elo_${elo}` as BotDifficulty,
    elo,
    difficulty: `elo_${elo}` as BotDifficulty,
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
