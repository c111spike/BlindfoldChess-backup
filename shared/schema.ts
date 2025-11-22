import { sql } from "drizzle-orm";
import {
  pgTable,
  varchar,
  text,
  integer,
  timestamp,
  boolean,
  jsonb,
  index,
  pgEnum,
  real,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  isPremium: boolean("is_premium").default(false),
  premiumUntil: timestamp("premium_until"),
  pricingTier: varchar("pricing_tier"),
  dailyGamesPlayed: integer("daily_games_played").default(0),
  dailyBlindfoldGamesPlayed: integer("daily_blindfold_games_played").default(0),
  lastDailyReset: timestamp("last_daily_reset").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const gameModeEnum = pgEnum("game_mode", [
  "otb_bullet",
  "otb_blitz",
  "otb_rapid",
  "otb_classical",
  "standard_bullet",
  "standard_blitz",
  "standard_rapid",
  "standard_classical",
  "simul",
  "simul_2",
  "simul_3",
  "simul_4",
  "simul_5",
  "simul_6",
  "simul_7",
  "simul_8",
  "simul_9",
  "simul_10",
]);

export const gameStatusEnum = pgEnum("game_status", [
  "active",
  "completed",
  "abandoned",
]);

export const gameResultEnum = pgEnum("game_result", [
  "white_win",
  "black_win",
  "draw",
  "ongoing",
]);

export const games = pgTable("games", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  whitePlayerId: varchar("white_player_id")
    .references(() => users.id, { onDelete: "cascade" }),
  blackPlayerId: varchar("black_player_id")
    .references(() => users.id, { onDelete: "cascade" }),
  mode: gameModeEnum("mode").notNull(),
  status: gameStatusEnum("status").default("active").notNull(),
  result: gameResultEnum("result").default("ongoing"),
  opponentName: varchar("opponent_name"),
  playerColor: varchar("player_color").notNull(),
  timeControl: integer("time_control"),
  increment: integer("increment").default(0),
  fen: text("fen").notNull(),
  pgn: text("pgn"),
  moves: jsonb("moves").$type<string[]>().default([]),
  whiteTime: integer("white_time"),
  blackTime: integer("black_time"),
  manualClockPresses: integer("manual_clock_presses").default(0),
  peeksUsed: integer("peeks_used").default(0),
  peeksRemaining: integer("peeks_remaining"),
  blindfoldEnabled: boolean("blindfold_enabled").default(false),
  boardCount: integer("board_count"),
  ratingChange: integer("rating_change"),
  arbiterWarnings: jsonb("arbiter_warnings").$type<string[]>().default([]),
  statsProcessed: boolean("stats_processed").default(false),
  matchId: varchar("match_id"),
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const simulGames = pgTable("simul_games", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  simulId: varchar("simul_id").notNull(),
  userId: varchar("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  gameId: varchar("game_id")
    .references(() => games.id, { onDelete: "cascade" })
    .notNull(),
  boardOrder: integer("board_order").notNull(),
  materialBalance: integer("material_balance").default(0),
  isActive: boolean("is_active").default(true),
  lastMoveAt: timestamp("last_move_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const ratings = pgTable("ratings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  bullet: integer("bullet").default(1200),
  blitz: integer("blitz").default(1200),
  rapid: integer("rapid").default(1200),
  classical: integer("classical").default(1200),
  blindfold: integer("blindfold").default(1200),
  simul: integer("simul").default(1000),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const puzzles = pgTable("puzzles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fen: text("fen").notNull(),
  moves: jsonb("moves").$type<string[]>().notNull(),
  rating: integer("rating").notNull(),
  themes: jsonb("themes").$type<string[]>().default([]),
  popularity: integer("popularity").default(0),
});

export const puzzleAttempts = pgTable("puzzle_attempts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  puzzleId: varchar("puzzle_id")
    .references(() => puzzles.id, { onDelete: "cascade" })
    .notNull(),
  solved: boolean("solved").notNull(),
  timeSpent: integer("time_spent"),
  attemptedAt: timestamp("attempted_at").defaultNow(),
});

export const userSettings = pgTable("user_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
  pieceSet: varchar("piece_set").default("cburnett"),
  boardTheme: varchar("board_theme").default("blue"),
  soundEnabled: boolean("sound_enabled").default(true),
  voiceEnabled: boolean("voice_enabled").default(false),
  autoQueen: boolean("auto_queen").default(false),
  highlightLegalMoves: boolean("highlight_legal_moves").default(true),
  confirmMoves: boolean("confirm_moves").default(false),
  arbiterWarnings: boolean("arbiter_warnings").default(true),
  blindfoldDifficulty: varchar("blindfold_difficulty").default("medium"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const statistics = pgTable("statistics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  mode: gameModeEnum("mode").notNull(),
  gamesPlayed: integer("games_played").default(0),
  wins: integer("wins").default(0),
  losses: integer("losses").default(0),
  draws: integer("draws").default(0),
  totalTime: integer("total_time").default(0),
  averageRating: integer("average_rating"),
  peakRating: integer("peak_rating"),
  winStreak: integer("win_streak").default(0),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  userModeUnique: unique().on(table.userId, table.mode),
}));

export const matchmakingQueues = pgTable("matchmaking_queues", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  queueType: varchar("queue_type").notNull(), // "otb_bullet", "otb_blitz", "otb_rapid", "otb_classical", "simul", "blindfold"
  ratingRange: varchar("rating_range").notNull(), // "1200-1400", "1400-1600", "1600-1800", "1800+"
  isBlindFold: boolean("is_blindfold").default(false),
  joinedAt: timestamp("joined_at").defaultNow(),
});

export const matchStatusEnum = pgEnum("match_status", [
  "searching",
  "matched",
  "in_progress",
  "completed",
]);

export const matches = pgTable("matches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  player1Id: varchar("player1_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  player2Id: varchar("player2_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  matchType: varchar("match_type").notNull(), // "standard_bullet", "otb_blitz", "simul_4", etc.
  status: matchStatusEnum("status").default("matched").notNull(),
  result: gameResultEnum("result"),
  gameIds: jsonb("game_ids").$type<string[]>().notNull(), // Array of game IDs
  simulId: varchar("simul_id"), // For simul matches, shared simul session ID
  createdAt: timestamp("created_at").defaultNow(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type InsertGame = typeof games.$inferInsert;
export type Game = typeof games.$inferSelect;
export type InsertSimulGame = typeof simulGames.$inferInsert;
export type SimulGame = typeof simulGames.$inferSelect;
export type InsertRating = typeof ratings.$inferInsert;
export type Rating = typeof ratings.$inferSelect;
export type InsertPuzzle = typeof puzzles.$inferInsert;
export type Puzzle = typeof puzzles.$inferSelect;
export type InsertPuzzleAttempt = typeof puzzleAttempts.$inferInsert;
export type PuzzleAttempt = typeof puzzleAttempts.$inferSelect;
export type InsertUserSettings = typeof userSettings.$inferInsert;
export type UserSettings = typeof userSettings.$inferSelect;
export type InsertStatistics = typeof statistics.$inferInsert;
export type Statistics = typeof statistics.$inferSelect;
export type InsertMatchmakingQueue = typeof matchmakingQueues.$inferInsert;
export type MatchmakingQueue = typeof matchmakingQueues.$inferSelect;
export type InsertMatch = typeof matches.$inferInsert;
export type Match = typeof matches.$inferSelect;

export const insertGameSchema = createInsertSchema(games).omit({
  id: true,
  createdAt: true,
});

export const insertPuzzleAttemptSchema = createInsertSchema(puzzleAttempts).omit({
  id: true,
  attemptedAt: true,
});

export const insertUserSettingsSchema = createInsertSchema(userSettings).omit({
  id: true,
  updatedAt: true,
});
