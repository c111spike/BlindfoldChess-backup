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
  isAdmin: boolean("is_admin").default(false),
  puzzleReputation: integer("puzzle_reputation").default(0),
  puzzleSolveStreak: integer("puzzle_solve_streak").default(0),
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
  "simul_vs_simul",
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
  "aborted",
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
  whiteMoveCount: integer("white_move_count").default(0),
  blackMoveCount: integer("black_move_count").default(0),
  whiteTime: integer("white_time"),
  blackTime: integer("black_time"),
  manualClockPresses: integer("manual_clock_presses").default(0),
  peeksUsed: integer("peeks_used").default(0),
  peeksRemaining: integer("peeks_remaining"),
  peekDurations: jsonb("peek_durations").$type<number[]>().default([]),
  totalPeekTime: real("total_peek_time").default(0),
  blindfoldEnabled: boolean("blindfold_enabled").default(false),
  blindfoldDifficulty: varchar("blindfold_difficulty"),
  boardCount: integer("board_count"),
  ratingChange: integer("rating_change"),
  arbiterWarnings: jsonb("arbiter_warnings").$type<string[]>().default([]),
  statsProcessed: boolean("stats_processed").default(false),
  matchId: varchar("match_id"),
  moveTimestamps: jsonb("move_timestamps").$type<number[]>().default([]),
  thinkingTimes: jsonb("thinking_times").$type<number[]>().default([]),
  fenHistory: jsonb("fen_history").$type<string[]>().default([]),
  clockTimes: jsonb("clock_times").$type<number[]>().default([]),
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
  otbBullet: integer("otb_bullet").default(1200),
  otbBlitz: integer("otb_blitz").default(1200),
  otbRapid: integer("otb_rapid").default(1200),
  otbClassical: integer("otb_classical").default(1200),
  blindfold: integer("blindfold").default(1200),
  simul: integer("simul").default(1000),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const puzzleTypeEnum = pgEnum("puzzle_type", [
  "mate_in_1",
  "mate_in_2",
  "mate_in_3",
  "mate_in_4_plus",
  "win_piece",
  "positional_advantage",
  "endgame",
  "opening_trap",
  "defensive",
  "sacrifice",
  "other",
]);

export const puzzleDifficultyEnum = pgEnum("puzzle_difficulty", [
  "beginner",
  "intermediate",
  "advanced",
  "expert",
]);

export const puzzleSourceTypeEnum = pgEnum("puzzle_source_type", [
  "created",
  "book",
  "youtube",
  "other",
]);

export const puzzles = pgTable("puzzles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fen: text("fen").notNull(),
  moves: jsonb("moves").$type<string[]>().notNull(),
  rating: integer("rating").notNull(),
  themes: jsonb("themes").$type<string[]>().default([]),
  popularity: integer("popularity").default(0),
  creatorId: varchar("creator_id")
    .references(() => users.id, { onDelete: "set null" }),
  puzzleType: puzzleTypeEnum("puzzle_type"),
  difficulty: puzzleDifficultyEnum("difficulty"),
  solution: jsonb("solution").$type<string[]>().default([]),
  hints: jsonb("hints").$type<string[]>().default([]),
  sourceType: puzzleSourceTypeEnum("source_type"),
  sourceName: varchar("source_name"),
  whoToMove: varchar("who_to_move").default("white"),
  upvotes: integer("upvotes").default(0),
  downvotes: integer("downvotes").default(0),
  reportCount: integer("report_count").default(0),
  isVerified: boolean("is_verified").default(false),
  isFeatured: boolean("is_featured").default(false),
  isFlagged: boolean("is_flagged").default(false),
  isRemoved: boolean("is_removed").default(false),
  attemptCount: integer("attempt_count").default(0),
  solveCount: integer("solve_count").default(0),
  shareCode: varchar("share_code").unique(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  creatorIdx: index("puzzles_creator_idx").on(table.creatorId),
  typeIdx: index("puzzles_type_idx").on(table.puzzleType),
  verifiedIdx: index("puzzles_verified_idx").on(table.isVerified),
  featuredIdx: index("puzzles_featured_idx").on(table.isFeatured),
}));

export const puzzleVotes = pgTable("puzzle_votes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  puzzleId: varchar("puzzle_id")
    .references(() => puzzles.id, { onDelete: "cascade" })
    .notNull(),
  userId: varchar("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  voteType: varchar("vote_type").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  puzzleUserUnique: unique().on(table.puzzleId, table.userId),
  puzzleIdx: index("puzzle_votes_puzzle_idx").on(table.puzzleId),
}));

export const puzzleReports = pgTable("puzzle_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  puzzleId: varchar("puzzle_id")
    .references(() => puzzles.id, { onDelete: "cascade" })
    .notNull(),
  reporterId: varchar("reporter_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  reason: varchar("reason").notNull(),
  details: text("details"),
  isResolved: boolean("is_resolved").default(false),
  resolvedById: varchar("resolved_by_id")
    .references(() => users.id, { onDelete: "set null" }),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  puzzleIdx: index("puzzle_reports_puzzle_idx").on(table.puzzleId),
  unresolvedIdx: index("puzzle_reports_unresolved_idx").on(table.isResolved),
}));

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
  voiceOutputEnabled: boolean("voice_output_enabled").default(false),
  voiceInputEnabled: boolean("voice_input_enabled").default(false),
  autoQueen: boolean("auto_queen").default(false),
  highlightLegalMoves: boolean("highlight_legal_moves").default(true),
  confirmMoves: boolean("confirm_moves").default(false),
  arbiterWarnings: boolean("arbiter_warnings").default(true),
  blindfoldDifficulty: varchar("blindfold_difficulty").default("easy"),
  blindfoldShowCoordinates: boolean("blindfold_show_coordinates").default(false),
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

export const boardSpinDifficultyEnum = pgEnum("board_spin_difficulty", [
  "beginner",
  "easy",
  "intermediate",
  "advanced",
  "expert",
  "master",
]);

export const boardSpinScores = pgTable("board_spin_scores", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  difficulty: boardSpinDifficultyEnum("difficulty").notNull(),
  score: integer("score").notNull(),
  accuracy: integer("accuracy").notNull(),
  pieceCount: integer("piece_count").notNull(),
  rotation: integer("rotation").notNull(),
  bonusEarned: boolean("bonus_earned").default(false),
  timeSpent: integer("time_spent"), // seconds spent on recreation
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  scoreIdx: index("board_spin_score_idx").on(table.score),
  userIdx: index("board_spin_user_idx").on(table.userId),
}));

// N-Piece Challenge tables
export const nPieceTypeEnum = pgEnum("n_piece_type", [
  "rook",
  "knight", 
  "bishop",
  "queen",
  "king",
]);

export const nPieceChallengeProgress = pgTable("n_piece_challenge_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  pieceType: nPieceTypeEnum("piece_type").notNull(),
  boardSize: integer("board_size").notNull(), // 5-12
  solutionsFound: integer("solutions_found").default(0),
  bestTime: integer("best_time"), // fastest solve time in milliseconds
  lastPlayedAt: timestamp("last_played_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  userPieceBoardUnique: unique().on(table.userId, table.pieceType, table.boardSize),
  userIdx: index("n_piece_progress_user_idx").on(table.userId),
}));

export const nPieceChallengeSolutions = pgTable("n_piece_challenge_solutions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  progressId: varchar("progress_id")
    .references(() => nPieceChallengeProgress.id, { onDelete: "cascade" })
    .notNull(),
  userId: varchar("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  pieceType: nPieceTypeEnum("piece_type").notNull(),
  boardSize: integer("board_size").notNull(),
  solutionIndex: integer("solution_index").notNull(), // Which solution number (1-92 for 8-queens, etc.)
  positions: text("positions").notNull(), // Canonical position string (e.g., "0,4,7,5,2,6,1,3")
  solveTime: integer("solve_time").notNull(), // milliseconds to solve
  solvedAt: timestamp("solved_at").defaultNow(),
}, (table) => ({
  userSolutionUnique: unique().on(table.userId, table.pieceType, table.boardSize, table.solutionIndex),
  progressIdx: index("n_piece_solutions_progress_idx").on(table.progressId),
}));

// Knight's Tour table
export const knightsTourProgress = pgTable("knights_tour_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  boardSize: integer("board_size").notNull(), // 5-12
  completedCount: integer("completed_count").default(0),
  bestTime: integer("best_time"), // fastest completion time in milliseconds
  highestMoveCount: integer("highest_move_count"), // best incomplete attempt (squares visited before getting stuck)
  lastPlayedAt: timestamp("last_played_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  userBoardUnique: unique().on(table.userId, table.boardSize),
  userIdx: index("knights_tour_progress_user_idx").on(table.userId),
}));

// Move Classification enum
export const moveClassificationEnum = pgEnum("move_classification", [
  "genius",
  "fantastic",
  "best",
  "good",
  "imprecise",
  "mistake",
  "blunder",
  "book",
  "forced",
]);

// Analysis status enum
export const analysisStatusEnum = pgEnum("analysis_status", [
  "not_started",
  "pending",
  "processing",
  "completed",
  "failed",
]);

// Game Phase enum
export const gamePhaseEnum = pgEnum("game_phase", [
  "opening",
  "middlegame",
  "endgame",
]);

// Tactical pattern enum
export const tacticalPatternEnum = pgEnum("tactical_pattern", [
  "fork",
  "pin",
  "skewer",
  "discovery",
  "double_attack",
  "back_rank",
  "smothered_mate",
  "deflection",
  "decoy",
  "overloading",
  "x_ray",
  "zwischenzug",
]);

// Game Analysis table - stores complete analysis for a game
export const gameAnalysis = pgTable("game_analysis", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  gameId: varchar("game_id")
    .references(() => games.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
  userId: varchar("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  status: analysisStatusEnum("status").default("pending").notNull(),
  whiteAccuracy: real("white_accuracy"),
  blackAccuracy: real("black_accuracy"),
  openingName: varchar("opening_name"),
  openingEco: varchar("opening_eco"),
  openingDeviationMove: integer("opening_deviation_move"),
  openingAccuracy: real("opening_accuracy"),
  middlegameAccuracy: real("middlegame_accuracy"),
  endgameAccuracy: real("endgame_accuracy"),
  totalCentipawnLoss: integer("total_centipawn_loss"),
  averageCentipawnLoss: real("average_centipawn_loss"),
  criticalMoments: jsonb("critical_moments").$type<number[]>().default([]),
  biggestSwings: jsonb("biggest_swings").$type<{moveNumber: number, swing: number}[]>().default([]),
  timeTroubleStartMove: integer("time_trouble_start_move"),
  burnoutDetected: boolean("burnout_detected").default(false),
  focusCheckScore: real("focus_check_score"),
  efficiencyFactor: real("efficiency_factor"),
  vssMismatchAlerts: jsonb("vss_mismatch_alerts").$type<number[]>().default([]),
  improvementSuggestions: jsonb("improvement_suggestions").$type<string[]>().default([]),
  analyzedAt: timestamp("analyzed_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  gameIdx: index("game_analysis_game_idx").on(table.gameId),
  userIdx: index("game_analysis_user_idx").on(table.userId),
}));

// Move Analysis table - stores per-move analysis data
// 
// EVALUATION PERSPECTIVE CONVENTION:
// All evaluation fields (evalBefore, evalAfter, bestMoveEval) are stored from WHITE'S PERSPECTIVE.
// - Positive values = good for White
// - Negative values = good for Black
// This follows the standard chess engine convention (Stockfish returns values from side-to-move,
// which we normalize to White's perspective before storage).
// 
// CLIENT-SIDE DISPLAY:
// When displaying evaluations to the user, flip the sign if the player was Black.
// Use getPlayerEval(evaluation, playerColor) helper in game-analysis.tsx.
// This ensures "positive = good for you" from the player's perspective.
// 
// CENTIPAWN LOSS:
// Centipawn loss is always a positive value representing how much the move cost.
// It's calculated from the mover's perspective before normalization.
export const moveAnalysis = pgTable("move_analysis", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  gameAnalysisId: varchar("game_analysis_id")
    .references(() => gameAnalysis.id, { onDelete: "cascade" })
    .notNull(),
  moveNumber: integer("move_number").notNull(),
  color: varchar("color").notNull(),
  move: varchar("move").notNull(),
  fen: text("fen").notNull(),
  evalBefore: real("eval_before"),
  evalAfter: real("eval_after"),
  bestMove: varchar("best_move"),
  bestMoveEval: real("best_move_eval"),
  centipawnLoss: integer("centipawn_loss"),
  classification: moveClassificationEnum("classification"),
  phase: gamePhaseEnum("phase"),
  thinkingTime: real("thinking_time"),
  clockTime: integer("clock_time"),
  isCheck: boolean("is_check").default(false),
  isCapture: boolean("is_capture").default(false),
  isCastle: boolean("is_castle").default(false),
  missedTactics: jsonb("missed_tactics").$type<{pattern: string, line: string[]}[]>().default([]),
  isCriticalMoment: boolean("is_critical_moment").default(false),
  followedByBlunder: boolean("followed_by_blunder").default(false),
  principalVariation: jsonb("principal_variation").$type<string[]>().default([]),
}, (table) => ({
  analysisIdx: index("move_analysis_game_idx").on(table.gameAnalysisId),
  moveIdx: index("move_analysis_move_idx").on(table.moveNumber),
}));

// Shared Analysis Links table
export const sharedAnalysis = pgTable("shared_analysis", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  shareCode: varchar("share_code").notNull().unique(),
  gameAnalysisId: varchar("game_analysis_id")
    .references(() => gameAnalysis.id, { onDelete: "cascade" })
    .notNull(),
  createdById: varchar("created_by_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  viewCount: integer("view_count").default(0),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  codeIdx: index("shared_analysis_code_idx").on(table.shareCode),
}));

// Player Weakness Patterns table - tracks recurring mistake types
export const playerWeaknesses = pgTable("player_weaknesses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  weaknessType: varchar("weakness_type").notNull(),
  occurrences: integer("occurrences").default(1),
  lastOccurrence: timestamp("last_occurrence").defaultNow(),
  gamesAnalyzed: integer("games_analyzed").default(1),
  averageRatingWhenOccurred: integer("average_rating_when_occurred"),
  description: text("description"),
  suggestedFix: text("suggested_fix"),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  userWeaknessUnique: unique().on(table.userId, table.weaknessType),
  userIdx: index("player_weaknesses_user_idx").on(table.userId),
}));

// Accuracy History table - for comparing to past games
export const accuracyHistory = pgTable("accuracy_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  gameId: varchar("game_id")
    .references(() => games.id, { onDelete: "cascade" })
    .notNull(),
  accuracy: real("accuracy").notNull(),
  rating: integer("rating"),
  gameMode: varchar("game_mode"),
  phase: gamePhaseEnum("phase"),
  recordedAt: timestamp("recorded_at").defaultNow(),
}, (table) => ({
  userIdx: index("accuracy_history_user_idx").on(table.userId),
  dateIdx: index("accuracy_history_date_idx").on(table.recordedAt),
}));

// Rating Benchmarks table - average accuracy at different rating levels
export const ratingBenchmarks = pgTable("rating_benchmarks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ratingMin: integer("rating_min").notNull(),
  ratingMax: integer("rating_max").notNull(),
  gameMode: varchar("game_mode"),
  averageAccuracy: real("average_accuracy").notNull(),
  openingAccuracy: real("opening_accuracy"),
  middlegameAccuracy: real("middlegame_accuracy"),
  endgameAccuracy: real("endgame_accuracy"),
  sampleSize: integer("sample_size").default(0),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  ratingRangeUnique: unique().on(table.ratingMin, table.ratingMax, table.gameMode),
}));

// Position Cache table - caches Stockfish analysis results for positions
export const positionCache = pgTable("position_cache", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fenHash: varchar("fen_hash", { length: 64 }).notNull().unique(), // SHA-256 hash of FEN
  fen: text("fen").notNull(),
  nodes: integer("nodes").notNull(), // Node count used for this analysis
  evaluation: real("evaluation").notNull(),
  bestMove: varchar("best_move").notNull(),
  bestMoveEval: real("best_move_eval").notNull(),
  principalVariation: jsonb("principal_variation").$type<string[]>().default([]),
  depth: integer("depth").notNull(),
  isMate: boolean("is_mate").default(false),
  mateIn: integer("mate_in"),
  hitCount: integer("hit_count").default(0), // How many times this cache was used
  createdAt: timestamp("created_at").defaultNow(),
  lastHitAt: timestamp("last_hit_at").defaultNow(),
}, (table) => ({
  fenHashIdx: index("position_cache_fen_hash_idx").on(table.fenHash),
  hitCountIdx: index("position_cache_hit_count_idx").on(table.hitCount),
}));

// Analysis Metrics table - tracks performance metrics for scaling decisions
export const analysisMetrics = pgTable("analysis_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  metricType: varchar("metric_type").notNull(), // 'hourly_summary', 'daily_summary'
  
  // Cache metrics
  cacheHits: integer("cache_hits").default(0),
  cacheMisses: integer("cache_misses").default(0),
  cacheSize: integer("cache_size").default(0), // Total cached positions
  avgCacheLookupMs: real("avg_cache_lookup_ms"),
  
  // Queue metrics
  queueLength: integer("queue_length").default(0),
  peakQueueLength: integer("peak_queue_length").default(0),
  avgQueueWaitMs: real("avg_queue_wait_ms"),
  
  // Analysis performance
  analysesCompleted: integer("analyses_completed").default(0),
  avgAnalysisTimeMs: real("avg_analysis_time_ms"),
  avgNodesUsed: integer("avg_nodes_used"),
  adaptiveScaledowns: integer("adaptive_scaledowns").default(0), // Times we reduced nodes due to load
  
  // Game counts
  gamesAnalyzedToday: integer("games_analyzed_today").default(0),
  
  // Period tracking
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
}, (table) => ({
  timestampIdx: index("analysis_metrics_timestamp_idx").on(table.timestamp),
  metricTypeIdx: index("analysis_metrics_type_idx").on(table.metricType),
}));

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
export type InsertPuzzleVote = typeof puzzleVotes.$inferInsert;
export type PuzzleVote = typeof puzzleVotes.$inferSelect;
export type InsertPuzzleReport = typeof puzzleReports.$inferInsert;
export type PuzzleReport = typeof puzzleReports.$inferSelect;
export type PuzzleType = typeof puzzleTypeEnum.enumValues[number];
export type PuzzleDifficulty = typeof puzzleDifficultyEnum.enumValues[number];
export type PuzzleSourceType = typeof puzzleSourceTypeEnum.enumValues[number];
export type InsertUserSettings = typeof userSettings.$inferInsert;
export type UserSettings = typeof userSettings.$inferSelect;
export type InsertStatistics = typeof statistics.$inferInsert;
export type Statistics = typeof statistics.$inferSelect;
export type InsertMatchmakingQueue = typeof matchmakingQueues.$inferInsert;
export type MatchmakingQueue = typeof matchmakingQueues.$inferSelect;
export type InsertMatch = typeof matches.$inferInsert;
export type Match = typeof matches.$inferSelect;
export type InsertBoardSpinScore = typeof boardSpinScores.$inferInsert;
export type BoardSpinScore = typeof boardSpinScores.$inferSelect;
export type InsertNPieceChallengeProgress = typeof nPieceChallengeProgress.$inferInsert;
export type NPieceChallengeProgress = typeof nPieceChallengeProgress.$inferSelect;
export type InsertNPieceChallengeSolution = typeof nPieceChallengeSolutions.$inferInsert;
export type NPieceChallengeSolution = typeof nPieceChallengeSolutions.$inferSelect;
export type NPieceType = typeof nPieceTypeEnum.enumValues[number];
export type InsertKnightsTourProgress = typeof knightsTourProgress.$inferInsert;
export type KnightsTourProgress = typeof knightsTourProgress.$inferSelect;
export type MoveClassification = typeof moveClassificationEnum.enumValues[number];
export type AnalysisStatus = typeof analysisStatusEnum.enumValues[number];
export type GamePhase = typeof gamePhaseEnum.enumValues[number];
export type TacticalPattern = typeof tacticalPatternEnum.enumValues[number];
export type InsertGameAnalysis = typeof gameAnalysis.$inferInsert;
export type GameAnalysis = typeof gameAnalysis.$inferSelect;
export type InsertMoveAnalysis = typeof moveAnalysis.$inferInsert;
export type MoveAnalysis = typeof moveAnalysis.$inferSelect;
export type InsertSharedAnalysis = typeof sharedAnalysis.$inferInsert;
export type SharedAnalysis = typeof sharedAnalysis.$inferSelect;
export type InsertPlayerWeakness = typeof playerWeaknesses.$inferInsert;
export type PlayerWeakness = typeof playerWeaknesses.$inferSelect;
export type InsertAccuracyHistory = typeof accuracyHistory.$inferInsert;
export type AccuracyHistory = typeof accuracyHistory.$inferSelect;
export type InsertRatingBenchmark = typeof ratingBenchmarks.$inferInsert;
export type RatingBenchmark = typeof ratingBenchmarks.$inferSelect;
export type InsertPositionCache = typeof positionCache.$inferInsert;
export type PositionCache = typeof positionCache.$inferSelect;
export type InsertAnalysisMetrics = typeof analysisMetrics.$inferInsert;
export type AnalysisMetrics = typeof analysisMetrics.$inferSelect;

// Simul vs Simul Match Status
export const simulVsSimulStatusEnum = pgEnum("simul_vs_simul_status", [
  "waiting",      // Waiting for players to join
  "starting",     // Match found, initializing games
  "in_progress",  // Match is active
  "completed",    // All games finished
  "cancelled",    // Match was cancelled
]);

// Simul vs Simul Pairing Result
export const simulPairingResultEnum = pgEnum("simul_pairing_result", [
  "ongoing",
  "white_win",
  "black_win",
  "draw",
  "white_forfeit",
  "black_forfeit",
]);

// Simul vs Simul Matches - Container for a round-robin match
export const simulVsSimulMatches = pgTable("simul_vs_simul_matches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  boardCount: integer("board_count").notNull().default(5), // N boards = N+1 players (5 boards = 6 players)
  playerCount: integer("player_count").notNull().default(6),
  status: simulVsSimulStatusEnum("status").default("waiting").notNull(),
  queueTimeoutSeconds: integer("queue_timeout_seconds").default(60),
  moveTimeSeconds: integer("move_time_seconds").default(30),
  createdAt: timestamp("created_at").defaultNow(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
}, (table) => ({
  statusIdx: index("simul_vs_simul_matches_status_idx").on(table.status),
}));

// Simul vs Simul Players - Links players to matches with their seat
export const simulVsSimulPlayers = pgTable("simul_vs_simul_players", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  matchId: varchar("match_id")
    .references(() => simulVsSimulMatches.id, { onDelete: "cascade" })
    .notNull(),
  odId: varchar("user_id")
    .references(() => users.id, { onDelete: "cascade" }),
  odnt: integer("seat").notNull(), // 1-6 for 6-player matches
  isBot: boolean("is_bot").default(false),
  botId: varchar("bot_id"), // If isBot, the bot identifier
  botPersonality: varchar("bot_personality"), // Random personality type
  focusedBoardNumber: integer("focused_board_number").default(1), // Current board being viewed
  totalScore: real("total_score").default(0), // Win=1, Draw=0.5, Loss=0
  joinedAt: timestamp("joined_at").defaultNow(),
  isConnected: boolean("is_connected").default(true),
  lastActiveAt: timestamp("last_active_at").defaultNow(),
}, (table) => ({
  matchPlayerUnique: unique().on(table.matchId, table.odId),
  matchIdx: index("simul_vs_simul_players_match_idx").on(table.matchId),
}));

// Simul vs Simul Pairings - Individual games between pairs
export const simulVsSimulPairings = pgTable("simul_vs_simul_pairings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  matchId: varchar("match_id")
    .references(() => simulVsSimulMatches.id, { onDelete: "cascade" })
    .notNull(),
  gameId: varchar("game_id")
    .references(() => games.id, { onDelete: "cascade" }),
  whitePlayerId: varchar("white_player_id"), // Can be null for bots
  blackPlayerId: varchar("black_player_id"), // Can be null for bots
  whiteIsBot: boolean("white_is_bot").default(false),
  blackIsBot: boolean("black_is_bot").default(false),
  whiteBotId: varchar("white_bot_id"),
  blackBotId: varchar("black_bot_id"),
  boardNumberWhite: integer("board_number_white").notNull(), // Board number from white's perspective (1-5)
  boardNumberBlack: integer("board_number_black").notNull(), // Board number from black's perspective (1-5)
  fen: text("fen").default("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"),
  moves: jsonb("moves").$type<string[]>().default([]),
  moveCount: integer("move_count").default(0),
  activeColor: varchar("active_color").default("white"), // Whose turn it is
  result: simulPairingResultEnum("result").default("ongoing"),
  whiteTimeRemaining: integer("white_time_remaining").default(30), // Seconds
  blackTimeRemaining: integer("black_time_remaining").default(30), // Seconds
  lastMoveAt: timestamp("last_move_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  matchIdx: index("simul_vs_simul_pairings_match_idx").on(table.matchId),
  whitePlayerIdx: index("simul_vs_simul_pairings_white_idx").on(table.whitePlayerId),
  blackPlayerIdx: index("simul_vs_simul_pairings_black_idx").on(table.blackPlayerId),
}));

// Simul vs Simul Queue - Players waiting to join a match
export const simulVsSimulQueue = pgTable("simul_vs_simul_queue", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  odId: varchar("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
  boardCount: integer("board_count").default(5), // Which queue they're in (5, 10, 25 boards)
  rating: integer("rating"), // Player's simul rating for matchmaking
  joinedAt: timestamp("joined_at").defaultNow(),
}, (table) => ({
  boardCountIdx: index("simul_vs_simul_queue_board_idx").on(table.boardCount),
  joinedAtIdx: index("simul_vs_simul_queue_joined_idx").on(table.joinedAt),
}));

// Type exports for Simul vs Simul
export type SimulVsSimulStatus = typeof simulVsSimulStatusEnum.enumValues[number];
export type SimulPairingResult = typeof simulPairingResultEnum.enumValues[number];
export type InsertSimulVsSimulMatch = typeof simulVsSimulMatches.$inferInsert;
export type SimulVsSimulMatch = typeof simulVsSimulMatches.$inferSelect;
export type InsertSimulVsSimulPlayer = typeof simulVsSimulPlayers.$inferInsert;
export type SimulVsSimulPlayer = typeof simulVsSimulPlayers.$inferSelect;
export type InsertSimulVsSimulPairing = typeof simulVsSimulPairings.$inferInsert;
export type SimulVsSimulPairing = typeof simulVsSimulPairings.$inferSelect;
export type InsertSimulVsSimulQueue = typeof simulVsSimulQueue.$inferInsert;
export type SimulVsSimulQueue = typeof simulVsSimulQueue.$inferSelect;

export const insertSimulVsSimulQueueSchema = createInsertSchema(simulVsSimulQueue).omit({
  id: true,
  joinedAt: true,
});

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

export const insertPuzzleSchema = createInsertSchema(puzzles).omit({
  id: true,
  upvotes: true,
  downvotes: true,
  reportCount: true,
  isVerified: true,
  isFeatured: true,
  isFlagged: true,
  isRemoved: true,
  attemptCount: true,
  solveCount: true,
  shareCode: true,
  createdAt: true,
});

export const insertPuzzleVoteSchema = createInsertSchema(puzzleVotes).omit({
  id: true,
  createdAt: true,
});

export const insertPuzzleReportSchema = createInsertSchema(puzzleReports).omit({
  id: true,
  isResolved: true,
  resolvedById: true,
  resolvedAt: true,
  createdAt: true,
});

// Anti-Cheat System
export const cheatReportReasonEnum = pgEnum("cheat_report_reason", [
  "engine_use",
  "suspicious_accuracy",
  "impossible_time",
  "sandbagging",
  "boosting",
  "other",
]);

export const reviewStatusEnum = pgEnum("review_status", [
  "pending",
  "under_review",
  "dismissed",
  "warning_issued",
  "restricted",
  "banned",
]);

export const reviewPriorityEnum = pgEnum("review_priority", [
  "low",
  "medium",
  "high",
  "critical",
]);

export const cheatReports = pgTable("cheat_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reporterId: varchar("reporter_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  reportedUserId: varchar("reported_user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  gameId: varchar("game_id")
    .references(() => games.id, { onDelete: "set null" }),
  reason: cheatReportReasonEnum("reason").notNull(),
  details: text("details"),
  isResolved: boolean("is_resolved").default(false),
  resolvedById: varchar("resolved_by_id")
    .references(() => users.id, { onDelete: "set null" }),
  resolvedAt: timestamp("resolved_at"),
  resolution: text("resolution"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  reportedUserIdx: index("cheat_reports_reported_user_idx").on(table.reportedUserId),
  unresolvedIdx: index("cheat_reports_unresolved_idx").on(table.isResolved),
}));

export const userAntiCheat = pgTable("user_anti_cheat", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
  riskScore: real("risk_score").default(0),
  accuracyAnomaly: real("accuracy_anomaly").default(0),
  timeAnomaly: real("time_anomaly").default(0),
  simulAnomaly: real("simul_anomaly").default(0),
  reportCount: integer("report_count").default(0),
  reviewStatus: reviewStatusEnum("review_status").default("pending"),
  reviewPriority: reviewPriorityEnum("review_priority").default("low"),
  isFlagged: boolean("is_flagged").default(false),
  flaggedAt: timestamp("flagged_at"),
  flagReason: text("flag_reason"),
  lastReviewedAt: timestamp("last_reviewed_at"),
  lastReviewedById: varchar("last_reviewed_by_id")
    .references(() => users.id, { onDelete: "set null" }),
  adminNotes: text("admin_notes"),
  warningCount: integer("warning_count").default(0),
  lastWarningAt: timestamp("last_warning_at"),
  gamesAnalyzed: integer("games_analyzed").default(0),
  avgAccuracy: real("avg_accuracy"),
  avgMoveTime: real("avg_move_time"),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  flaggedIdx: index("user_anti_cheat_flagged_idx").on(table.isFlagged),
  riskScoreIdx: index("user_anti_cheat_risk_idx").on(table.riskScore),
  priorityIdx: index("user_anti_cheat_priority_idx").on(table.reviewPriority),
}));

// Anti-cheat type exports
export type CheatReportReason = typeof cheatReportReasonEnum.enumValues[number];
export type ReviewStatus = typeof reviewStatusEnum.enumValues[number];
export type ReviewPriority = typeof reviewPriorityEnum.enumValues[number];
export type InsertCheatReport = typeof cheatReports.$inferInsert;
export type CheatReport = typeof cheatReports.$inferSelect;
export type InsertUserAntiCheat = typeof userAntiCheat.$inferInsert;
export type UserAntiCheat = typeof userAntiCheat.$inferSelect;

export const insertCheatReportSchema = createInsertSchema(cheatReports).omit({
  id: true,
  isResolved: true,
  resolvedById: true,
  resolvedAt: true,
  resolution: true,
  createdAt: true,
});

// ========== OPENING REPERTOIRE TRAINER ==========

// Pre-loaded openings from Lichess database
export const openings = pgTable("openings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eco: varchar("eco").notNull(),
  name: varchar("name").notNull(),
  pgn: text("pgn").notNull(),
  moves: jsonb("moves").$type<string[]>().default([]),
  fen: text("fen"),
  color: varchar("color"), // 'white' or 'black' - which side this opening is for
}, (table) => ({
  ecoIdx: index("openings_eco_idx").on(table.eco),
  nameIdx: index("openings_name_idx").on(table.name),
  colorIdx: index("openings_color_idx").on(table.color),
}));

// User's saved repertoires
export const repertoires = pgTable("repertoires", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  name: varchar("name").notNull(),
  color: varchar("color").notNull(), // 'white' or 'black'
  openingId: varchar("opening_id")
    .references(() => openings.id, { onDelete: "set null" }),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  userIdx: index("repertoires_user_idx").on(table.userId),
}));

// Lines within a repertoire (includes main line + user-added variations)
export const repertoireLines = pgTable("repertoire_lines", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  repertoireId: varchar("repertoire_id")
    .references(() => repertoires.id, { onDelete: "cascade" })
    .notNull(),
  fen: text("fen").notNull(), // Position FEN
  correctMove: varchar("correct_move").notNull(), // The move user should play
  moveSan: varchar("move_san").notNull(), // SAN notation
  moveNumber: integer("move_number").notNull(),
  isUserAdded: boolean("is_user_added").default(false),
  frequency: integer("frequency").default(100), // Weight for training (1-100)
  parentFen: text("parent_fen"), // Previous position FEN for tree structure
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  repertoireIdx: index("repertoire_lines_repertoire_idx").on(table.repertoireId),
  fenIdx: index("repertoire_lines_fen_idx").on(table.fen),
}));

// Practice history for spaced repetition
export const practiceHistory = pgTable("practice_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  repertoireLineId: varchar("repertoire_line_id")
    .references(() => repertoireLines.id, { onDelete: "cascade" })
    .notNull(),
  correctCount: integer("correct_count").default(0),
  incorrectCount: integer("incorrect_count").default(0),
  lastPracticed: timestamp("last_practiced"),
  nextDue: timestamp("next_due").defaultNow(),
  easeFactor: real("ease_factor").default(2.5), // SM-2 algorithm factor
  interval: integer("interval").default(1), // Days until next review
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  userIdx: index("practice_history_user_idx").on(table.userId),
  dueIdx: index("practice_history_due_idx").on(table.nextDue),
}));

// Type exports for opening repertoire
export type Opening = typeof openings.$inferSelect;
export type InsertOpening = typeof openings.$inferInsert;
export type Repertoire = typeof repertoires.$inferSelect;
export type InsertRepertoire = typeof repertoires.$inferInsert;
export type RepertoireLine = typeof repertoireLines.$inferSelect;
export type InsertRepertoireLine = typeof repertoireLines.$inferInsert;
export type PracticeHistory = typeof practiceHistory.$inferSelect;
export type InsertPracticeHistory = typeof practiceHistory.$inferInsert;

export const insertOpeningSchema = createInsertSchema(openings).omit({
  id: true,
});

export const insertRepertoireSchema = createInsertSchema(repertoires).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRepertoireLineSchema = createInsertSchema(repertoireLines).omit({
  id: true,
  createdAt: true,
});

export const insertPracticeHistorySchema = createInsertSchema(practiceHistory).omit({
  id: true,
  createdAt: true,
});
