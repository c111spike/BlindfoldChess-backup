export type BotPersonality = 
  | "balanced"
  | "tactician"
  | "positional"
  | "aggressive"
  | "defensive"
  | "bishop_lover"
  | "knight_lover";

export type BotDifficulty = 
  | "beginner"    // ~400 Elo
  | "novice"      // ~600 Elo
  | "intermediate" // ~900 Elo
  | "club"        // ~1200 Elo
  | "advanced"    // ~1500 Elo
  | "expert"      // ~1800 Elo
  | "master";     // ~2000 Elo

export interface BotProfile {
  id: string;
  name: string;
  personality: BotPersonality;
  difficulty: BotDifficulty;
  elo: number;
  description: string;
  avatar: string;
}

export const BOT_DIFFICULTY_ELO: Record<BotDifficulty, number> = {
  beginner: 400,
  novice: 600,
  intermediate: 900,
  club: 1200,
  advanced: 1500,
  expert: 1800,
  master: 2000,
};

export const BOT_PERSONALITY_DESCRIPTIONS: Record<BotPersonality, string> = {
  balanced: "Plays solid, well-rounded chess without extreme tendencies",
  tactician: "Loves combinations and sacrifices, always looking for tricks",
  positional: "Focuses on piece placement, pawn structure, and long-term plans",
  aggressive: "Attacks relentlessly, often sacrificing material for initiative",
  defensive: "Prioritizes solid defense and waits for opponent mistakes",
  bishop_lover: "Prefers bishops over knights and loves open positions",
  knight_lover: "Prefers knights, especially in closed positions with outposts",
};

export const BOTS: BotProfile[] = [
  {
    id: "bot_beginner_balanced",
    name: "Rookie Rex",
    personality: "balanced",
    difficulty: "beginner",
    elo: 400,
    description: "A friendly beginner who's just learning the rules. Makes many mistakes but tries their best!",
    avatar: "R",
  },
  {
    id: "bot_novice_tactician",
    name: "Tricky Tina",
    personality: "tactician",
    difficulty: "novice",
    elo: 600,
    description: "Loves setting up simple tactics. Sometimes they work, sometimes they backfire!",
    avatar: "T",
  },
  {
    id: "bot_intermediate_positional",
    name: "Patient Pete",
    personality: "positional",
    difficulty: "intermediate",
    elo: 900,
    description: "Plays slowly and methodically, building up advantages piece by piece.",
    avatar: "P",
  },
  {
    id: "bot_club_aggressive",
    name: "Aggressive Alex",
    personality: "aggressive",
    difficulty: "club",
    elo: 1200,
    description: "Always looking to attack your king. Defense is for losers!",
    avatar: "A",
  },
  {
    id: "bot_advanced_defensive",
    name: "Fortress Frank",
    personality: "defensive",
    difficulty: "advanced",
    elo: 1500,
    description: "Builds an impenetrable fortress and waits for you to overextend.",
    avatar: "F",
  },
  {
    id: "bot_expert_bishop",
    name: "Bishop Boris",
    personality: "bishop_lover",
    difficulty: "expert",
    elo: 1800,
    description: "Worships the bishop pair and creates open diagonals for destruction.",
    avatar: "B",
  },
  {
    id: "bot_master_knight",
    name: "Knight Master Nadia",
    personality: "knight_lover",
    difficulty: "master",
    elo: 2000,
    description: "A master of knight maneuvers who creates outposts and closed positions.",
    avatar: "N",
  },
];

export function getBotById(id: string): BotProfile | undefined {
  return BOTS.find(bot => bot.id === id);
}

export function getBotsByDifficulty(difficulty: BotDifficulty): BotProfile[] {
  return BOTS.filter(bot => bot.difficulty === difficulty);
}

export function getBotsByPersonality(personality: BotPersonality): BotProfile[] {
  return BOTS.filter(bot => bot.personality === personality);
}
