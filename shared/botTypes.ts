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
  | "novice"      // ~450 Elo
  | "intermediate" // ~500 Elo
  | "club"        // ~550 Elo
  | "advanced"    // ~600 Elo
  | "expert"      // ~650 Elo
  | "master";     // ~700 Elo

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
  novice: 450,
  intermediate: 500,
  club: 550,
  advanced: 600,
  expert: 650,
  master: 700,
};

export const BOT_DIFFICULTY_NAMES: Record<BotDifficulty, string> = {
  beginner: "Beginner",
  novice: "Novice",
  intermediate: "Intermediate",
  club: "Club Player",
  advanced: "Advanced",
  expert: "Expert",
  master: "Master",
};

export const BOT_PERSONALITY_NAMES: Record<BotPersonality, string> = {
  balanced: "Balanced",
  tactician: "Tactician",
  positional: "Positional",
  aggressive: "Aggressor",
  defensive: "Defender",
  bishop_lover: "Bishop Specialist",
  knight_lover: "Knight Specialist",
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

export const BOT_PERSONALITY_ICONS: Record<BotPersonality, string> = {
  balanced: "⚖",
  tactician: "⚔",
  positional: "♟",
  aggressive: "🔥",
  defensive: "🛡",
  bishop_lover: "♗",
  knight_lover: "♘",
};

export const ALL_DIFFICULTIES: BotDifficulty[] = [
  "beginner",
  "novice", 
  "intermediate",
  "club",
  "advanced",
  "expert",
  "master",
];

export const ALL_PERSONALITIES: BotPersonality[] = [
  "balanced",
  "tactician",
  "positional",
  "aggressive",
  "defensive",
  "bishop_lover",
  "knight_lover",
];

// Generate all bot combinations dynamically
function generateBotId(difficulty: BotDifficulty, personality: BotPersonality): string {
  return `bot_${difficulty}_${personality}`;
}

function generateBotName(difficulty: BotDifficulty, personality: BotPersonality): string {
  const difficultyName = BOT_DIFFICULTY_NAMES[difficulty];
  const personalityName = BOT_PERSONALITY_NAMES[personality];
  return `${difficultyName} ${personalityName}`;
}

function generateBotDescription(difficulty: BotDifficulty, personality: BotPersonality): string {
  const elo = BOT_DIFFICULTY_ELO[difficulty];
  const personalityDesc = BOT_PERSONALITY_DESCRIPTIONS[personality];
  return `${elo} rated bot. ${personalityDesc}.`;
}

// Generate all 49 bot combinations
export const BOTS: BotProfile[] = ALL_DIFFICULTIES.flatMap(difficulty =>
  ALL_PERSONALITIES.map(personality => ({
    id: generateBotId(difficulty, personality),
    name: generateBotName(difficulty, personality),
    personality,
    difficulty,
    elo: BOT_DIFFICULTY_ELO[difficulty],
    description: generateBotDescription(difficulty, personality),
    avatar: BOT_PERSONALITY_ICONS[personality],
  }))
);

export function getBotById(id: string): BotProfile | undefined {
  return BOTS.find(bot => bot.id === id);
}

export function getBotByConfig(difficulty: BotDifficulty, personality: BotPersonality): BotProfile | undefined {
  return BOTS.find(bot => bot.difficulty === difficulty && bot.personality === personality);
}

export function getBotsByDifficulty(difficulty: BotDifficulty): BotProfile[] {
  return BOTS.filter(bot => bot.difficulty === difficulty);
}

export function getBotsByPersonality(personality: BotPersonality): BotProfile[] {
  return BOTS.filter(bot => bot.personality === personality);
}
