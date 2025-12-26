import {
  users,
  games,
  ratings,
  puzzles,
  puzzleAttempts,
  puzzleVotes,
  puzzleReports,
  userMotifStats,
  userSettings,
  statistics,
  simulGames,
  matchmakingQueues,
  matches,
  boardSpinScores,
  nPieceChallengeProgress,
  nPieceChallengeSolutions,
  knightsTourProgress,
  gameAnalysis,
  moveAnalysis,
  sharedAnalysis,
  playerWeaknesses,
  accuracyHistory,
  ratingBenchmarks,
  simulVsSimulMatches,
  simulVsSimulPlayers,
  simulVsSimulPairings,
  simulVsSimulQueue,
  cheatReports,
  userAntiCheat,
  type User,
  type UpsertUser,
  type Game,
  type InsertGame,
  type Rating,
  type InsertRating,
  type Puzzle,
  type InsertPuzzle,
  type PuzzleAttempt,
  type InsertPuzzleAttempt,
  type PuzzleVote,
  type InsertPuzzleVote,
  type PuzzleReport,
  type InsertPuzzleReport,
  type UserMotifStats,
  type InsertUserMotifStats,
  type UserSettings,
  type InsertUserSettings,
  type Statistics,
  type InsertStatistics,
  type SimulGame,
  type InsertSimulGame,
  type MatchmakingQueue,
  type InsertMatchmakingQueue,
  type Match,
  type InsertMatch,
  type BoardSpinScore,
  type InsertBoardSpinScore,
  type NPieceChallengeProgress,
  type InsertNPieceChallengeProgress,
  type NPieceChallengeSolution,
  type InsertNPieceChallengeSolution,
  type NPieceType,
  type KnightsTourProgress,
  type GameAnalysis,
  type InsertGameAnalysis,
  type MoveAnalysis,
  type InsertMoveAnalysis,
  type SharedAnalysis,
  type InsertSharedAnalysis,
  type PlayerWeakness,
  type InsertPlayerWeakness,
  type AccuracyHistory,
  type InsertAccuracyHistory,
  type SimulVsSimulMatch,
  type InsertSimulVsSimulMatch,
  type SimulVsSimulPlayer,
  type InsertSimulVsSimulPlayer,
  type SimulVsSimulPairing,
  type InsertSimulVsSimulPairing,
  type SimulVsSimulQueue,
  type InsertSimulVsSimulQueue,
  type CheatReport,
  type InsertCheatReport,
  type UserAntiCheat,
  type InsertUserAntiCheat,
  type ReviewStatus,
  type ReviewPriority,
  openings,
  repertoires,
  repertoireLines,
  practiceHistory,
  puzzleSessionProgress,
  type Opening,
  type Repertoire,
  type InsertRepertoire,
  type RepertoireLine,
  type InsertRepertoireLine,
  type PracticeHistory,
  type InsertPracticeHistory,
  type PuzzleSessionProgress,
  suspensionHistory,
  adminNotifications,
  type SuspensionHistory,
  type InsertSuspensionHistory,
  type AdminNotification,
  type InsertAdminNotification,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, ne, or, sql, inArray, ilike } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  deleteUser(userId: string): Promise<void>;
  
  createGame(game: InsertGame): Promise<Game>;
  getGame(id: string): Promise<Game | undefined>;
  getRecentGames(userId: string, limit?: number): Promise<Game[]>;
  getActiveGame(userId: string): Promise<Game | undefined>;
  getGamesByMode(userId: string, mode: string): Promise<Game[]>;
  getBlindfoldGames(userId: string, limit?: number): Promise<Game[]>;
  updateGame(id: string, data: Partial<Game>): Promise<Game>;
  getGameStatistics(): Promise<{ mode: string; count: number }[]>;
  getBlindfoldGameCount(): Promise<number>;
  getTrainingChallengesCounts(): Promise<{ boardSpin: number; nPiece: number; knightsTour: number }>;
  
  getRating(userId: string): Promise<Rating | undefined>;
  createRating(rating: InsertRating): Promise<Rating>;
  getOrCreateRating(userId: string): Promise<Rating>;
  updateRating(userId: string, data: Partial<Rating>): Promise<Rating>;
  
  getRandomPuzzle(): Promise<Puzzle | undefined>;
  getNextPuzzle(afterId?: string): Promise<Puzzle | undefined>;
  getNextPuzzleForUser(userId: string): Promise<Puzzle | undefined>;
  getFirstPuzzle(): Promise<Puzzle | undefined>;
  createPuzzleAttempt(attempt: InsertPuzzleAttempt): Promise<PuzzleAttempt>;
  
  getPuzzleSessionProgress(userId: string): Promise<PuzzleSessionProgress | undefined>;
  markPuzzleSeen(userId: string, puzzleId: string): Promise<PuzzleSessionProgress>;
  resetPuzzleProgress(userId: string): Promise<void>;
  
  createPuzzle(puzzle: InsertPuzzle): Promise<Puzzle>;
  getPuzzle(id: string): Promise<Puzzle | undefined>;
  getPuzzleByShareCode(shareCode: string): Promise<Puzzle | undefined>;
  getPuzzles(options: { type?: string; difficulty?: string; creatorId?: string; sortBy?: string; limit?: number; offset?: number; isVerified?: boolean }): Promise<Puzzle[]>;
  getPuzzlesWithCreators(options: { type?: string; difficulty?: string; creatorId?: string; creatorUsername?: string; sortBy?: string; limit?: number; offset?: number; isVerified?: boolean; motif?: string }): Promise<(Puzzle & { creatorUsername?: string | null })[]>;
  getUserCreatedPuzzles(userId: string): Promise<Puzzle[]>;
  getUserPuzzleUploadCount(userId: string): Promise<number>;
  updatePuzzle(id: string, data: Partial<Puzzle>): Promise<Puzzle>;
  deletePuzzle(id: string): Promise<void>;
  checkDuplicatePuzzle(fen: string): Promise<Puzzle | undefined>;
  checkDuplicateYoutubeUrl(youtubeVideoUrl: string): Promise<Puzzle | undefined>;
  
  createPuzzleVote(vote: InsertPuzzleVote): Promise<PuzzleVote>;
  getUserPuzzleVote(userId: string, puzzleId: string): Promise<PuzzleVote | undefined>;
  updatePuzzleVote(id: string, voteType: string): Promise<PuzzleVote>;
  deletePuzzleVote(id: string): Promise<void>;
  
  createPuzzleReport(report: InsertPuzzleReport): Promise<PuzzleReport>;
  getPuzzleReports(puzzleId?: string, isResolved?: boolean): Promise<PuzzleReport[]>;
  resolvePuzzleReport(id: string, resolvedById: string): Promise<PuzzleReport>;
  resolveYoutubeLinkReports(puzzleId: string, resolvedById: string): Promise<void>;
  
  getFlaggedPuzzles(): Promise<Puzzle[]>;
  getFlaggedPuzzlesWithReports(): Promise<(Puzzle & { reports: PuzzleReport[] })[]>;
  getPuzzleOfTheDay(): Promise<Puzzle | undefined>;
  updateUserPuzzleReputation(userId: string, change: number): Promise<void>;
  updateUserPuzzleSolveStreak(userId: string, solved: boolean): Promise<number>;
  recordHandshake(userId: string): Promise<{ streak: number; badges: string[] }>;
  breakHandshakeStreak(userId: string): Promise<void>;
  
  getUserSettings(userId: string): Promise<UserSettings | undefined>;
  upsertUserSettings(settings: InsertUserSettings): Promise<UserSettings>;
  updateUserSettings(userId: string, data: Partial<UserSettings>): Promise<UserSettings>;
  
  getStatistics(userId: string): Promise<Statistics[]>;
  upsertStatistics(stats: InsertStatistics): Promise<Statistics>;
  
  createSimulGame(simulGame: InsertSimulGame): Promise<SimulGame>;
  getSimulGames(simulId: string): Promise<SimulGame[]>;
  completeSimul(userId: string, simulId: string): Promise<{ gamesCompleted: number; ratingChange: number }>;
  
  joinQueue(queueEntry: InsertMatchmakingQueue): Promise<MatchmakingQueue>;
  leaveQueue(userId: string, queueType: string): Promise<void>;
  leaveAllQueues(userId: string): Promise<void>;
  findMatch(userId: string, queueType: string): Promise<MatchmakingQueue | undefined>;
  atomicMatchPairing(userId: string, queueType: string, matchData: InsertMatch, player1GameTemplates: Partial<InsertGame>[], player2GameTemplates: Partial<InsertGame>[]): Promise<{ match: Match; games: Game[] } | null>;
  getUserQueueStatus(userId: string): Promise<MatchmakingQueue | undefined>;
  
  createMatch(match: InsertMatch): Promise<Match>;
  getMatch(id: string): Promise<Match | undefined>;
  getActiveMatchForUser(userId: string): Promise<Match | undefined>;
  updateMatchStatus(id: string, status: string): Promise<Match>;
  updateMatch(id: string, data: Partial<Match>): Promise<Match>;
  getGamesByMatchId(matchId: string): Promise<Game[]>;
  completeMatch(matchId: string, result: string): Promise<{ match: Match; games: Game[]; alreadyCompleted?: boolean }>;
  
  saveBoardSpinScore(score: InsertBoardSpinScore): Promise<BoardSpinScore>;
  getBoardSpinLeaderboard(difficulty?: string, limit?: number): Promise<(BoardSpinScore & { user: User })[]>;
  getUserBoardSpinScores(userId: string, limit?: number): Promise<BoardSpinScore[]>;
  getUserBoardSpinHighScore(userId: string, difficulty?: string): Promise<BoardSpinScore | undefined>;
  getUserBoardSpinStats(userId: string): Promise<{ gamesPlayed: number; bestScore: number; avgAccuracy: number }>;
  
  // N-Piece Challenge
  getNPieceProgress(userId: string, pieceType: NPieceType, boardSize: number): Promise<NPieceChallengeProgress | undefined>;
  getOrCreateNPieceProgress(userId: string, pieceType: NPieceType, boardSize: number): Promise<NPieceChallengeProgress>;
  getNPieceSolutions(progressId: string): Promise<NPieceChallengeSolution[]>;
  saveNPieceSolution(solution: InsertNPieceChallengeSolution): Promise<{ solution: NPieceChallengeSolution; isNew: boolean }>;
  getNPieceOverallProgress(userId: string): Promise<{ total: number; found: number }>;
  getUserNPieceSolutionByPositions(userId: string, pieceType: NPieceType, boardSize: number, positions: string): Promise<NPieceChallengeSolution | undefined>;
  
  // Knight's Tour
  getKnightsTourProgress(userId: string, boardSize: number): Promise<KnightsTourProgress | undefined>;
  saveKnightsTourCompletion(userId: string, boardSize: number, completionTime: number): Promise<KnightsTourProgress>;
  saveKnightsTourIncomplete(userId: string, boardSize: number, moveCount: number): Promise<KnightsTourProgress>;
  getKnightsTourOverallProgress(userId: string): Promise<{ totalCompleted: number; boardsCompleted: number }>;
  
  // Game Analysis
  getGameAnalysis(gameId: string): Promise<GameAnalysis | undefined>;
  getGameAnalysisById(analysisId: string): Promise<GameAnalysis | undefined>;
  createGameAnalysis(analysis: InsertGameAnalysis): Promise<GameAnalysis>;
  updateGameAnalysis(id: string, data: Partial<GameAnalysis>): Promise<GameAnalysis>;
  createMoveAnalysis(analysis: InsertMoveAnalysis): Promise<MoveAnalysis>;
  getMoveAnalyses(gameAnalysisId: string): Promise<MoveAnalysis[]>;
  
  // Shared Analysis
  createSharedAnalysis(shared: InsertSharedAnalysis): Promise<SharedAnalysis>;
  getSharedAnalysisByCode(shareCode: string): Promise<SharedAnalysis | undefined>;
  incrementShareViewCount(id: string): Promise<void>;
  
  // Player Progress Tracking
  recordAccuracyHistory(userId: string, gameId: string, accuracy: number, rating?: number, gameMode?: string): Promise<AccuracyHistory>;
  getAccuracyHistory(userId: string, limit?: number): Promise<AccuracyHistory[]>;
  getPlayerWeaknesses(userId: string): Promise<PlayerWeakness[]>;
  upsertPlayerWeakness(weakness: InsertPlayerWeakness): Promise<PlayerWeakness>;
  
  // Simul vs Simul
  joinSimulVsSimulQueue(userId: string, boardCount: number, rating?: number): Promise<SimulVsSimulQueue>;
  leaveSimulVsSimulQueue(userId: string): Promise<void>;
  getSimulVsSimulQueueStatus(userId: string): Promise<SimulVsSimulQueue | undefined>;
  getSimulVsSimulQueuePlayers(boardCount: number): Promise<SimulVsSimulQueue[]>;
  getOldestSimulVsSimulQueueEntry(boardCount: number): Promise<SimulVsSimulQueue | undefined>;
  getSimulVsSimulQueueAverageRating(boardCount: number): Promise<number>;
  createSimulVsSimulMatch(boardCount: number): Promise<SimulVsSimulMatch>;
  addPlayerToSimulVsSimulMatch(matchId: string, userId: string | null, seat: number, isBot?: boolean, botId?: string, botPersonality?: string): Promise<SimulVsSimulPlayer>;
  createSimulVsSimulPairing(pairing: InsertSimulVsSimulPairing): Promise<SimulVsSimulPairing>;
  getSimulVsSimulMatch(matchId: string): Promise<SimulVsSimulMatch | undefined>;
  getSimulVsSimulMatchPlayers(matchId: string): Promise<SimulVsSimulPlayer[]>;
  getSimulVsSimulPlayerGames(matchId: string, odId: string): Promise<SimulVsSimulPairing[]>;
  getSimulVsSimulPairing(pairingId: string): Promise<SimulVsSimulPairing | undefined>;
  updateSimulVsSimulPairing(pairingId: string, data: Partial<SimulVsSimulPairing>): Promise<SimulVsSimulPairing>;
  updateSimulVsSimulMatch(matchId: string, data: Partial<SimulVsSimulMatch>): Promise<SimulVsSimulMatch>;
  updateSimulVsSimulPlayer(playerId: string, data: Partial<SimulVsSimulPlayer>): Promise<SimulVsSimulPlayer>;
  getActiveSimulVsSimulMatchForUser(userId: string): Promise<SimulVsSimulMatch | undefined>;
  getAllSimulVsSimulPairings(matchId: string): Promise<SimulVsSimulPairing[]>;
  clearSimulVsSimulQueue(boardCount: number, userIds: string[]): Promise<void>;
  getCompletedSimulVsSimulPairingCount(): Promise<number>;
  
  // Anti-Cheat System
  createCheatReport(report: InsertCheatReport): Promise<CheatReport>;
  getCheatReports(reportedUserId?: string, isResolved?: boolean): Promise<CheatReport[]>;
  getCheatReportsByReporter(reporterId: string): Promise<CheatReport[]>;
  resolveCheatReport(id: string, resolvedById: string, resolution: string): Promise<CheatReport>;
  getUserAntiCheat(userId: string): Promise<UserAntiCheat | undefined>;
  getOrCreateUserAntiCheat(userId: string): Promise<UserAntiCheat>;
  updateUserAntiCheat(userId: string, data: Partial<UserAntiCheat>): Promise<UserAntiCheat>;
  getFlaggedUsers(priority?: ReviewPriority): Promise<UserAntiCheat[]>;
  getAllFlaggedUsersWithDetails(): Promise<Array<UserAntiCheat & { user: User; reportCount: number }>>;
  flagUserForReview(userId: string, reason: string, priority: ReviewPriority): Promise<UserAntiCheat>;
  updateReviewStatus(userId: string, status: ReviewStatus, adminId: string, notes?: string): Promise<UserAntiCheat>;
  issueWarning(userId: string, adminId: string, notes: string): Promise<UserAntiCheat>;
  
  // Admin Moderation
  suspendUser(userId: string, suspendedUntil: Date): Promise<User>;
  banUser(userId: string): Promise<User>;
  unbanUser(userId: string): Promise<User>;
  refundGameElo(gameId: string): Promise<{ message: string; gamesRefunded: number }>;
  refundAllWinsElo(userId: string): Promise<{ message: string; gamesRefunded: number }>;
  
  // Opening Repertoire Trainer
  getOpenings(options?: { eco?: string; search?: string; color?: string; limit?: number; offset?: number }): Promise<Opening[]>;
  getOpening(id: string): Promise<Opening | undefined>;
  getRepertoires(userId: string): Promise<Repertoire[]>;
  getRepertoire(id: string): Promise<Repertoire | undefined>;
  createRepertoire(repertoire: InsertRepertoire): Promise<Repertoire>;
  updateRepertoire(id: string, data: Partial<Repertoire>): Promise<Repertoire>;
  deleteRepertoire(id: string): Promise<void>;
  getRepertoireLines(repertoireId: string): Promise<RepertoireLine[]>;
  getRepertoireLineByFen(repertoireId: string, fen: string): Promise<RepertoireLine | undefined>;
  createRepertoireLine(line: InsertRepertoireLine): Promise<RepertoireLine>;
  updateRepertoireLine(id: string, data: Partial<RepertoireLine>): Promise<RepertoireLine>;
  deleteRepertoireLine(id: string): Promise<void>;
  getPracticeHistory(userId: string, repertoireLineId?: string): Promise<PracticeHistory[]>;
  getOrCreatePracticeHistory(userId: string, repertoireLineId: string): Promise<PracticeHistory>;
  updatePracticeHistory(id: string, data: Partial<PracticeHistory>): Promise<PracticeHistory>;
  getDuePracticeLines(userId: string, repertoireId?: string, limit?: number): Promise<(PracticeHistory & { line: RepertoireLine })[]>;
  
  // Suspension System
  createSuspension(suspension: InsertSuspensionHistory): Promise<SuspensionHistory>;
  getUserSuspensions(userId: string): Promise<SuspensionHistory[]>;
  getActiveSuspension(userId: string): Promise<SuspensionHistory | undefined>;
  hasAnySuspensionHistory(userId: string): Promise<boolean>;
  liftSuspension(suspensionId: string, liftedById: string, reason?: string): Promise<SuspensionHistory>;
  
  // Admin Notifications
  createAdminNotification(notification: InsertAdminNotification): Promise<AdminNotification>;
  getUnreadAdminNotifications(): Promise<AdminNotification[]>;
  getAllAdminNotifications(limit?: number): Promise<AdminNotification[]>;
  markAdminNotificationRead(id: string, readById: string): Promise<AdminNotification>;
  markAllAdminNotificationsRead(readById: string): Promise<void>;
  
  // Admin Game History
  getUserGameHistory(userId: string, limit?: number, offset?: number): Promise<Game[]>;
  getUserGameCount(userId: string): Promise<number>;
  
  // User Motif Stats (Puzzle Pattern Tracking)
  updateUserMotifStats(userId: string, motifName: string, solved: boolean): Promise<UserMotifStats>;
  getUserMotifStats(userId: string): Promise<UserMotifStats[]>;
  getUserMotifStatsByName(userId: string, motifName: string): Promise<UserMotifStats | undefined>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    // First check if user exists by email (to handle auth system migration)
    // Keep the existing user ID to preserve foreign key relationships
    if (userData.email) {
      const [existingByEmail] = await db
        .select()
        .from(users)
        .where(eq(users.email, userData.email));
      
      if (existingByEmail) {
        // User exists, update their profile data but preserve their ID
        const [updatedUser] = await db
          .update(users)
          .set({
            // Don't update the ID - keep original to preserve FK relationships
            firstName: userData.firstName ?? existingByEmail.firstName,
            lastName: userData.lastName ?? existingByEmail.lastName,
            profileImageUrl: userData.profileImageUrl ?? existingByEmail.profileImageUrl,
            updatedAt: new Date(),
          })
          .where(eq(users.email, userData.email))
          .returning();
        return updatedUser;
      }
    }
    
    // User doesn't exist by email, try upsert by ID
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async deleteUser(userId: string): Promise<void> {
    // Delete all user data. Most tables have onDelete: "cascade" foreign key constraints,
    // but we explicitly delete to ensure completeness and handle any complex relationships.
    
    // Delete move analysis linked to user's game analyses first
    const userAnalyses = await db.select({ id: gameAnalysis.id }).from(gameAnalysis).where(eq(gameAnalysis.userId, userId));
    if (userAnalyses.length > 0) {
      const analysisIds = userAnalyses.map(a => a.id);
      await db.delete(moveAnalysis).where(inArray(moveAnalysis.gameAnalysisId, analysisIds));
    }
    
    // Delete game analysis records
    await db.delete(gameAnalysis).where(eq(gameAnalysis.userId, userId));
    
    // Delete simul vs simul data (odId column maps to user_id)
    await db.delete(simulVsSimulQueue).where(eq(simulVsSimulQueue.odId, userId));
    await db.delete(simulVsSimulPlayers).where(eq(simulVsSimulPlayers.odId, userId));
    
    // Delete user-specific data
    await db.delete(puzzleSessionProgress).where(eq(puzzleSessionProgress.userId, userId));
    await db.delete(practiceHistory).where(eq(practiceHistory.userId, userId));
    await db.delete(repertoires).where(eq(repertoires.userId, userId));
    await db.delete(userAntiCheat).where(eq(userAntiCheat.userId, userId));
    await db.delete(accuracyHistory).where(eq(accuracyHistory.userId, userId));
    await db.delete(playerWeaknesses).where(eq(playerWeaknesses.userId, userId));
    await db.delete(knightsTourProgress).where(eq(knightsTourProgress.userId, userId));
    await db.delete(nPieceChallengeSolutions).where(eq(nPieceChallengeSolutions.userId, userId));
    await db.delete(nPieceChallengeProgress).where(eq(nPieceChallengeProgress.userId, userId));
    await db.delete(boardSpinScores).where(eq(boardSpinScores.userId, userId));
    await db.delete(matchmakingQueues).where(eq(matchmakingQueues.userId, userId));
    await db.delete(statistics).where(eq(statistics.userId, userId));
    await db.delete(userSettings).where(eq(userSettings.userId, userId));
    
    // Finally delete the user record (cascades will handle remaining FK relationships like games, ratings, puzzles)
    await db.delete(users).where(eq(users.id, userId));
  }

  async createGame(gameData: InsertGame): Promise<Game> {
    const [game] = await db.insert(games).values(gameData).returning();
    return game;
  }

  async getGame(id: string): Promise<Game | undefined> {
    const [game] = await db.select().from(games).where(eq(games.id, id));
    return game;
  }

  async getRecentGames(userId: string, limit: number = 10): Promise<Game[]> {
    return await db
      .select()
      .from(games)
      .where(or(
        eq(games.userId, userId),
        eq(games.whitePlayerId, userId),
        eq(games.blackPlayerId, userId)
      ))
      .orderBy(desc(games.createdAt))
      .limit(limit);
  }

  async getActiveGame(userId: string): Promise<Game | undefined> {
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
    const [game] = await db
      .select()
      .from(games)
      .where(and(
        or(
          eq(games.userId, userId),
          eq(games.whitePlayerId, userId),
          eq(games.blackPlayerId, userId)
        ),
        eq(games.status, 'active'),
        sql`${games.createdAt} > ${sixHoursAgo}`
      ))
      .orderBy(desc(games.createdAt))
      .limit(1);
    return game;
  }

  async getGamesByMode(userId: string, mode: string): Promise<Game[]> {
    return await db
      .select()
      .from(games)
      .where(and(
        or(
          eq(games.userId, userId),
          eq(games.whitePlayerId, userId),
          eq(games.blackPlayerId, userId)
        ),
        eq(games.mode, mode as any)
      ))
      .orderBy(desc(games.createdAt));
  }

  async getGameStatistics(): Promise<{ mode: string; count: number }[]> {
    // Count completed games, grouping by mode category (otb_*, standard_*, etc.)
    // Include both completed games and legacy games with null status but final result
    // Cast enum to text for LIKE comparisons
    const modeCategory = sql`CASE 
      WHEN ${games.mode}::text LIKE 'otb_%' THEN 'otb'
      WHEN ${games.mode}::text LIKE 'standard_%' THEN 'standard'
      ELSE ${games.mode}::text
    END`;
    
    const result = await db
      .select({
        mode: modeCategory,
        count: sql<number>`count(*)::int`,
      })
      .from(games)
      .where(or(
        // Current games with completed status
        eq(games.status, 'completed'),
        // Legacy games with null status but a final result
        and(
          sql`${games.status} IS NULL`,
          sql`${games.result} IN ('white_win', 'black_win', 'draw')`
        )
      ))
      .groupBy(modeCategory);
    return result;
  }

  async getBlindfoldGameCount(): Promise<number> {
    // Count games where blindfold was enabled (subset of standard games)
    const [result] = await db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(games)
      .where(and(
        eq(games.blindfoldEnabled, true),
        or(
          eq(games.status, 'completed'),
          and(
            sql`${games.status} IS NULL`,
            sql`${games.result} IN ('white_win', 'black_win', 'draw')`
          )
        )
      ));
    return result?.count || 0;
  }

  async getTrainingChallengesCounts(): Promise<{ boardSpin: number; nPiece: number; knightsTour: number }> {
    const [[boardSpinResult], [nPieceResult], [knightsTourResult]] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(boardSpinScores),
      db.select({ count: sql<number>`count(*)::int` }).from(nPieceChallengeProgress),
      db.select({ count: sql<number>`count(*)::int` }).from(knightsTourProgress),
    ]);
    return {
      boardSpin: boardSpinResult?.count || 0,
      nPiece: nPieceResult?.count || 0,
      knightsTour: knightsTourResult?.count || 0,
    };
  }

  async getBlindfoldGames(userId: string, limit: number = 20): Promise<Game[]> {
    return await db
      .select()
      .from(games)
      .where(and(
        or(
          eq(games.userId, userId),
          eq(games.whitePlayerId, userId),
          eq(games.blackPlayerId, userId)
        ),
        or(
          eq(games.blindfoldEnabled, true),
          sql`${games.peeksUsed} > 0`
        ),
        eq(games.status, 'completed')
      ))
      .orderBy(desc(games.createdAt))
      .limit(limit);
  }

  async getUserBlindfoldStats(userId: string): Promise<{
    gamesPlayed: number;
    lastPeekTime: number | null;
    avgPeekTime: number;
    wins: number;
    losses: number;
    draws: number;
  }> {
    const blindfoldGames = await db
      .select()
      .from(games)
      .where(and(
        or(
          eq(games.userId, userId),
          eq(games.whitePlayerId, userId),
          eq(games.blackPlayerId, userId)
        ),
        or(
          eq(games.blindfoldEnabled, true),
          sql`${games.peeksUsed} > 0`
        ),
        eq(games.status, 'completed')
      ))
      .orderBy(desc(games.createdAt));

    const gamesPlayed = blindfoldGames.length;
    
    // Calculate wins/losses/draws
    let wins = 0, losses = 0, draws = 0;
    for (const game of blindfoldGames) {
      const isWhite = game.whitePlayerId === userId;
      const isBlack = game.blackPlayerId === userId;
      if (game.result === 'draw') {
        draws++;
      } else if ((game.result === 'white_win' && isWhite) || (game.result === 'black_win' && isBlack)) {
        wins++;
      } else if ((game.result === 'white_win' && isBlack) || (game.result === 'black_win' && isWhite)) {
        losses++;
      }
    }

    // Get last game's peek time (convert from milliseconds to seconds)
    const lastPeekTimeMs = blindfoldGames.length > 0 ? (blindfoldGames[0].totalPeekTime || 0) : null;
    const lastPeekTime = lastPeekTimeMs !== null ? lastPeekTimeMs / 1000 : null;

    // Calculate average peek time (convert from milliseconds to seconds)
    const totalPeekTimeSum = blindfoldGames.reduce((sum, g) => sum + (g.totalPeekTime || 0), 0);
    const avgPeekTime = gamesPlayed > 0 ? (totalPeekTimeSum / gamesPlayed) / 1000 : 0;

    return {
      gamesPlayed,
      lastPeekTime,
      avgPeekTime,
      wins,
      losses,
      draws,
    };
  }

  async getUserSimulVsSimulStats(userId: string): Promise<{
    gamesPlayed: number;
    wins: number;
    losses: number;
    draws: number;
    winRate: number;
  }> {
    // Get all simul vs simul pairings where user participated
    const userPairings = await db
      .select()
      .from(simulVsSimulPairings)
      .where(or(
        eq(simulVsSimulPairings.whitePlayerId, userId),
        eq(simulVsSimulPairings.blackPlayerId, userId)
      ));

    let wins = 0, losses = 0, draws = 0;
    for (const pairing of userPairings) {
      const isWhite = pairing.whitePlayerId === userId;
      if (pairing.result === 'draw') {
        draws++;
      } else if ((pairing.result === 'white_win' && isWhite) || (pairing.result === 'black_win' && !isWhite)) {
        wins++;
      } else if (pairing.result === 'white_win' || pairing.result === 'black_win') {
        losses++;
      }
    }

    const gamesPlayed = wins + losses + draws;
    const winRate = gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : 0;

    return {
      gamesPlayed,
      wins,
      losses,
      draws,
      winRate,
    };
  }

  async updateGame(id: string, data: Partial<Game>): Promise<Game> {
    const updateData = { ...data };
    if (updateData.completedAt && typeof updateData.completedAt === 'string') {
      updateData.completedAt = new Date(updateData.completedAt);
    }
    if (updateData.startedAt && typeof updateData.startedAt === 'string') {
      updateData.startedAt = new Date(updateData.startedAt);
    }
    
    const [game] = await db
      .update(games)
      .set(updateData as any)
      .where(eq(games.id, id))
      .returning();
    return game;
  }

  async getRating(userId: string): Promise<Rating | undefined> {
    const [rating] = await db
      .select()
      .from(ratings)
      .where(eq(ratings.userId, userId));
    return rating;
  }

  async createRating(ratingData: InsertRating): Promise<Rating> {
    const [rating] = await db.insert(ratings).values(ratingData).returning();
    return rating;
  }

  async getOrCreateRating(userId: string): Promise<Rating> {
    let rating = await this.getRating(userId);
    if (!rating) {
      rating = await this.createRating({
        userId,
        bullet: 1200,
        blitz: 1200,
        rapid: 1200,
        classical: 1200,
      });
    }
    return rating;
  }

  async updateRating(userId: string, data: Partial<Rating>): Promise<Rating> {
    const [rating] = await db
      .update(ratings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(ratings.userId, userId))
      .returning();
    return rating;
  }

  async getRandomPuzzle(): Promise<Puzzle | undefined> {
    const allPuzzles = await db.select().from(puzzles).where(eq(puzzles.isRemoved, false)).limit(100);
    if (allPuzzles.length === 0) return undefined;
    const randomIndex = Math.floor(Math.random() * allPuzzles.length);
    return allPuzzles[randomIndex];
  }

  async getFirstPuzzle(): Promise<Puzzle | undefined> {
    const [puzzle] = await db.select().from(puzzles)
      .where(eq(puzzles.isRemoved, false))
      .orderBy(puzzles.createdAt, puzzles.id)
      .limit(1);
    return puzzle;
  }

  async getNextPuzzle(afterId?: string): Promise<Puzzle | undefined> {
    if (!afterId) {
      console.log('[getNextPuzzle] No afterId, returning first puzzle');
      return this.getFirstPuzzle();
    }
    
    const currentPuzzle = await this.getPuzzle(afterId);
    if (!currentPuzzle) {
      console.log('[getNextPuzzle] Current puzzle not found, returning first puzzle');
      return this.getFirstPuzzle();
    }
    
    console.log('[getNextPuzzle] Looking for puzzle after:', afterId, 'createdAt:', currentPuzzle.createdAt);
    
    // Find next puzzle by ID order (simpler and more reliable)
    // First try puzzles with same timestamp but higher ID
    const [nextPuzzle] = await db.select().from(puzzles)
      .where(and(
        eq(puzzles.isRemoved, false),
        sql`${puzzles.id} > ${afterId}`
      ))
      .orderBy(puzzles.id)
      .limit(1);
    
    if (nextPuzzle) {
      console.log('[getNextPuzzle] Found next puzzle:', nextPuzzle.id);
      return nextPuzzle;
    }
    
    console.log('[getNextPuzzle] No next puzzle found, wrapping to first');
    // Wrap to first puzzle when we reach the end
    return this.getFirstPuzzle();
  }

  async createPuzzleAttempt(attemptData: InsertPuzzleAttempt): Promise<PuzzleAttempt> {
    const [attempt] = await db.insert(puzzleAttempts).values(attemptData).returning();
    return attempt;
  }

  async getPuzzleSessionProgress(userId: string): Promise<PuzzleSessionProgress | undefined> {
    const [progress] = await db.select().from(puzzleSessionProgress)
      .where(eq(puzzleSessionProgress.userId, userId));
    return progress;
  }

  async getNextPuzzleForUser(userId: string): Promise<Puzzle | undefined> {
    // Get or create session progress for this user
    let progress = await this.getPuzzleSessionProgress(userId);
    
    // Get all available puzzle IDs
    const allPuzzles = await db.select({ id: puzzles.id }).from(puzzles)
      .where(eq(puzzles.isRemoved, false))
      .orderBy(puzzles.id);
    
    if (allPuzzles.length === 0) {
      return undefined;
    }
    
    const allPuzzleIds = allPuzzles.map(p => p.id);
    const seenIds = progress?.seenPuzzleIds || [];
    
    // Find puzzles not yet seen
    const unseenIds = allPuzzleIds.filter(id => !seenIds.includes(id));
    
    // If all puzzles have been seen, reset the cycle
    if (unseenIds.length === 0) {
      console.log('[getNextPuzzleForUser] All puzzles seen, starting new cycle');
      const newCycleCount = (progress?.cycleCount || 0) + 1;
      
      // Reset progress and start fresh
      if (progress) {
        await db.update(puzzleSessionProgress)
          .set({ 
            seenPuzzleIds: [], 
            cycleCount: newCycleCount,
            lastPuzzleId: null,
            updatedAt: new Date() 
          })
          .where(eq(puzzleSessionProgress.userId, userId));
      }
      
      // Return first puzzle
      return this.getFirstPuzzle();
    }
    
    // Get the first unseen puzzle
    const nextPuzzleId = unseenIds[0];
    const [puzzle] = await db.select().from(puzzles).where(eq(puzzles.id, nextPuzzleId));
    
    console.log('[getNextPuzzleForUser] Returning unseen puzzle:', nextPuzzleId, 
      'seen:', seenIds.length, 'remaining:', unseenIds.length);
    
    return puzzle;
  }

  async markPuzzleSeen(userId: string, puzzleId: string): Promise<PuzzleSessionProgress> {
    let progress = await this.getPuzzleSessionProgress(userId);
    
    if (!progress) {
      // Create new progress record
      const [newProgress] = await db.insert(puzzleSessionProgress)
        .values({
          userId,
          seenPuzzleIds: [puzzleId],
          lastPuzzleId: puzzleId,
          cycleCount: 0,
        })
        .returning();
      return newProgress;
    }
    
    // Update existing progress - add puzzle to seen list if not already there
    const currentSeen = progress.seenPuzzleIds || [];
    if (!currentSeen.includes(puzzleId)) {
      const [updated] = await db.update(puzzleSessionProgress)
        .set({
          seenPuzzleIds: [...currentSeen, puzzleId],
          lastPuzzleId: puzzleId,
          updatedAt: new Date(),
        })
        .where(eq(puzzleSessionProgress.userId, userId))
        .returning();
      return updated;
    }
    
    return progress;
  }

  async resetPuzzleProgress(userId: string): Promise<void> {
    await db.delete(puzzleSessionProgress)
      .where(eq(puzzleSessionProgress.userId, userId));
  }

  async createPuzzle(puzzleData: InsertPuzzle): Promise<Puzzle> {
    const shareCode = Math.random().toString(36).substring(2, 10);
    const [puzzle] = await db.insert(puzzles).values({
      ...puzzleData,
      shareCode,
      isVerified: true, // Auto-verify all puzzles on creation
    }).returning();
    return puzzle;
  }

  async getPuzzle(id: string): Promise<Puzzle | undefined> {
    const [puzzle] = await db.select().from(puzzles).where(eq(puzzles.id, id));
    return puzzle;
  }

  async getPuzzleByShareCode(shareCode: string): Promise<Puzzle | undefined> {
    const [puzzle] = await db.select().from(puzzles).where(eq(puzzles.shareCode, shareCode));
    return puzzle;
  }

  async getPuzzles(options: { type?: string; difficulty?: string; creatorId?: string; sortBy?: string; limit?: number; offset?: number; isVerified?: boolean }): Promise<Puzzle[]> {
    let query = db.select().from(puzzles).where(
      and(
        eq(puzzles.isRemoved, false),
        options.type ? eq(puzzles.puzzleType, options.type as any) : undefined,
        options.difficulty ? eq(puzzles.difficulty, options.difficulty as any) : undefined,
        options.creatorId ? eq(puzzles.creatorId, options.creatorId) : undefined,
        options.isVerified !== undefined ? eq(puzzles.isVerified, options.isVerified) : undefined
      )
    );

    if (options.sortBy === 'newest') {
      query = query.orderBy(desc(puzzles.createdAt)) as any;
    } else if (options.sortBy === 'popular') {
      query = query.orderBy(desc(puzzles.upvotes)) as any;
    } else if (options.sortBy === 'rating') {
      query = query.orderBy(desc(puzzles.rating)) as any;
    }

    if (options.limit) {
      query = query.limit(options.limit) as any;
    }
    if (options.offset) {
      query = query.offset(options.offset) as any;
    }

    return await query;
  }

  async getUserCreatedPuzzles(userId: string): Promise<Puzzle[]> {
    return await db.select().from(puzzles)
      .where(eq(puzzles.creatorId, userId))
      .orderBy(desc(puzzles.createdAt));
  }

  async getUserPuzzleUploadCount(userId: string): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(puzzles)
      .where(and(
        eq(puzzles.creatorId, userId),
        eq(puzzles.isRemoved, false)
      ));
    return Number(result[0]?.count || 0);
  }

  async getPuzzlesWithCreators(options: { 
    type?: string; 
    difficulty?: string; 
    creatorId?: string; 
    creatorUsername?: string;
    isAnonymous?: boolean;
    sortBy?: string; 
    limit?: number; 
    offset?: number; 
    isVerified?: boolean;
    motif?: string;
  }): Promise<(Puzzle & { creatorUsername?: string | null })[]> {
    let conditions: any[] = [eq(puzzles.isRemoved, false)];
    
    if (options.type) conditions.push(eq(puzzles.puzzleType, options.type as any));
    if (options.difficulty) conditions.push(eq(puzzles.difficulty, options.difficulty as any));
    if (options.creatorId) conditions.push(eq(puzzles.creatorId, options.creatorId));
    if (options.isVerified !== undefined) conditions.push(eq(puzzles.isVerified, options.isVerified));
    if (options.isAnonymous !== undefined) conditions.push(eq(puzzles.isAnonymous, options.isAnonymous));
    if (options.motif) {
      const allowedMotifs = [
        'knight_fork', 'bishop_fork', 'queen_fork', 'rook_fork', 'pawn_fork', 'king_fork',
        'absolute_pin', 'relative_pin', 'skewer', 'discovered_attack', 'discovered_check',
        'double_check', 'back_rank_mate', 'smothered_mate', 'arabian_mate', 'anastasia_mate',
        'mate_in_1', 'mate_in_2', 'mate_in_3', 'mate_in_4_plus', 'queen_sacrifice',
        'rook_sacrifice', 'minor_piece_sacrifice', 'deflection', 'decoy', 'overloaded_defender',
        'trapped_piece', 'removing_defender', 'zwischenzug', 'promotion', 'underpromotion',
        'en_passant', 'material_win', 'checkmate', 'stalemate_trick'
      ];
      if (allowedMotifs.includes(options.motif)) {
        conditions.push(sql`${puzzles.tacticalMotifs} @> ARRAY[${sql.param(options.motif)}]::text[]`);
      }
    }

    // Build the query with left join
    let baseQuery = db
      .select()
      .from(puzzles)
      .leftJoin(users, eq(puzzles.creatorId, users.id))
      .where(and(...conditions));

    // If filtering by creator name, search in firstName and lastName
    if (options.creatorUsername) {
      baseQuery = db
        .select()
        .from(puzzles)
        .leftJoin(users, eq(puzzles.creatorId, users.id))
        .where(and(
          ...conditions,
          or(
            ilike(users.firstName, `%${options.creatorUsername}%`),
            ilike(users.lastName, `%${options.creatorUsername}%`)
          )
        ));
    }

    let query = baseQuery as any;

    if (options.sortBy === 'newest') {
      query = query.orderBy(desc(puzzles.createdAt));
    } else if (options.sortBy === 'popular') {
      query = query.orderBy(desc(puzzles.upvotes));
    } else if (options.sortBy === 'rating') {
      query = query.orderBy(desc(puzzles.rating));
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }
    if (options.offset) {
      query = query.offset(options.offset);
    }

    const results = await query;
    
    // Map results to include creatorUsername from the joined users table
    // Combine firstName and lastName for display
    return results.map((row: any) => {
      const firstName = row.users?.firstName || '';
      const lastName = row.users?.lastName || '';
      const displayName = [firstName, lastName].filter(Boolean).join(' ').trim() || null;
      return {
        ...row.puzzles,
        creatorUsername: row.puzzles.isAnonymous ? null : displayName,
      };
    });
  }

  async updatePuzzle(id: string, data: Partial<Puzzle>): Promise<Puzzle> {
    const [puzzle] = await db.update(puzzles).set(data).where(eq(puzzles.id, id)).returning();
    return puzzle;
  }

  async deletePuzzle(id: string): Promise<void> {
    await db.delete(puzzles).where(eq(puzzles.id, id));
  }

  async checkDuplicatePuzzle(fen: string): Promise<Puzzle | undefined> {
    const fenPosition = fen.split(' ')[0];
    const allPuzzles = await db.select().from(puzzles).where(eq(puzzles.isRemoved, false));
    return allPuzzles.find(p => p.fen.split(' ')[0] === fenPosition);
  }

  async checkDuplicateYoutubeUrl(youtubeVideoUrl: string): Promise<Puzzle | undefined> {
    if (!youtubeVideoUrl) return undefined;
    const [puzzle] = await db.select().from(puzzles)
      .where(and(
        eq(puzzles.youtubeVideoUrl, youtubeVideoUrl),
        eq(puzzles.isRemoved, false)
      ))
      .limit(1);
    return puzzle;
  }

  async createPuzzleVote(voteData: InsertPuzzleVote): Promise<PuzzleVote> {
    const [vote] = await db.insert(puzzleVotes).values(voteData).returning();
    
    const puzzle = await this.getPuzzle(voteData.puzzleId);
    if (puzzle) {
      const update = voteData.voteType === 'up' 
        ? { upvotes: (puzzle.upvotes || 0) + 1 }
        : { downvotes: (puzzle.downvotes || 0) + 1 };
      
      const newUpvotes = voteData.voteType === 'up' ? (puzzle.upvotes || 0) + 1 : puzzle.upvotes || 0;
      const newDownvotes = voteData.voteType === 'down' ? (puzzle.downvotes || 0) + 1 : puzzle.downvotes || 0;
      
      const isVerified = newUpvotes >= 5 && newUpvotes > newDownvotes * 2;
      const isFlagged = newDownvotes >= 5 && newDownvotes > newUpvotes;
      
      await this.updatePuzzle(voteData.puzzleId, { ...update, isVerified, isFlagged });
      
      if (puzzle.creatorId && voteData.voteType === 'up') {
        await this.updateUserPuzzleReputation(puzzle.creatorId, 1);
      } else if (puzzle.creatorId && voteData.voteType === 'down') {
        await this.updateUserPuzzleReputation(puzzle.creatorId, -1);
      }
    }
    
    return vote;
  }

  async getUserPuzzleVote(userId: string, puzzleId: string): Promise<PuzzleVote | undefined> {
    const [vote] = await db.select().from(puzzleVotes)
      .where(and(eq(puzzleVotes.userId, userId), eq(puzzleVotes.puzzleId, puzzleId)));
    return vote;
  }

  async updatePuzzleVote(id: string, voteType: string): Promise<PuzzleVote> {
    const [existingVote] = await db.select().from(puzzleVotes).where(eq(puzzleVotes.id, id));
    
    if (existingVote) {
      const puzzle = await this.getPuzzle(existingVote.puzzleId);
      if (puzzle) {
        const oldVoteType = existingVote.voteType;
        if (oldVoteType !== voteType) {
          let newUpvotes = puzzle.upvotes || 0;
          let newDownvotes = puzzle.downvotes || 0;
          
          if (oldVoteType === 'up') {
            newUpvotes = Math.max(0, newUpvotes - 1);
          } else {
            newDownvotes = Math.max(0, newDownvotes - 1);
          }
          if (voteType === 'up') {
            newUpvotes = newUpvotes + 1;
          } else {
            newDownvotes = newDownvotes + 1;
          }
          
          const isVerified = newUpvotes >= 5 && newUpvotes > newDownvotes * 2;
          const isFlagged = newDownvotes >= 5 && newDownvotes > newUpvotes;
          
          await this.updatePuzzle(existingVote.puzzleId, { 
            upvotes: newUpvotes, 
            downvotes: newDownvotes,
            isVerified,
            isFlagged 
          });
        }
      }
    }
    
    const [vote] = await db.update(puzzleVotes).set({ voteType }).where(eq(puzzleVotes.id, id)).returning();
    return vote;
  }

  async deletePuzzleVote(id: string): Promise<void> {
    const [existingVote] = await db.select().from(puzzleVotes).where(eq(puzzleVotes.id, id));
    
    if (existingVote) {
      const puzzle = await this.getPuzzle(existingVote.puzzleId);
      if (puzzle) {
        const newUpvotes = existingVote.voteType === 'up' 
          ? Math.max(0, (puzzle.upvotes || 0) - 1) 
          : puzzle.upvotes || 0;
        const newDownvotes = existingVote.voteType === 'down' 
          ? Math.max(0, (puzzle.downvotes || 0) - 1) 
          : puzzle.downvotes || 0;
        
        const isVerified = newUpvotes >= 5 && newUpvotes > newDownvotes * 2;
        const isFlagged = newDownvotes >= 5 && newDownvotes > newUpvotes;
        
        await this.updatePuzzle(existingVote.puzzleId, { 
          upvotes: newUpvotes, 
          downvotes: newDownvotes,
          isVerified,
          isFlagged 
        });
      }
    }
    
    await db.delete(puzzleVotes).where(eq(puzzleVotes.id, id));
  }

  async createPuzzleReport(reportData: InsertPuzzleReport): Promise<PuzzleReport> {
    const [report] = await db.insert(puzzleReports).values(reportData).returning();
    
    const puzzle = await this.getPuzzle(reportData.puzzleId);
    if (puzzle) {
      await this.updatePuzzle(reportData.puzzleId, {
        reportCount: (puzzle.reportCount || 0) + 1,
        isFlagged: true,
      });
    }
    
    return report;
  }

  async getPuzzleReports(puzzleId?: string, isResolved?: boolean): Promise<PuzzleReport[]> {
    let conditions = [];
    if (puzzleId) conditions.push(eq(puzzleReports.puzzleId, puzzleId));
    if (isResolved !== undefined) conditions.push(eq(puzzleReports.isResolved, isResolved));
    
    return await db.select().from(puzzleReports)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(puzzleReports.createdAt));
  }

  async resolvePuzzleReport(id: string, resolvedById: string): Promise<PuzzleReport> {
    const [report] = await db.update(puzzleReports)
      .set({ isResolved: true, resolvedById, resolvedAt: new Date() })
      .where(eq(puzzleReports.id, id))
      .returning();
    return report;
  }

  async resolveYoutubeLinkReports(puzzleId: string, resolvedById: string): Promise<void> {
    await db.update(puzzleReports)
      .set({ isResolved: true, resolvedById, resolvedAt: new Date() })
      .where(and(
        eq(puzzleReports.puzzleId, puzzleId),
        eq(puzzleReports.reason, 'bad_youtube_link'),
        eq(puzzleReports.isResolved, false)
      ));
  }

  async getFlaggedPuzzles(): Promise<Puzzle[]> {
    return await db.select().from(puzzles)
      .where(and(eq(puzzles.isFlagged, true), eq(puzzles.isRemoved, false)))
      .orderBy(desc(puzzles.reportCount));
  }

  async getFlaggedPuzzlesWithReports(): Promise<(Puzzle & { reports: PuzzleReport[] })[]> {
    const flaggedPuzzlesList = await db.select().from(puzzles)
      .where(and(eq(puzzles.isFlagged, true), eq(puzzles.isRemoved, false)))
      .orderBy(desc(puzzles.reportCount));
    
    if (flaggedPuzzlesList.length === 0) return [];
    
    const puzzleIds = flaggedPuzzlesList.map(p => p.id);
    const allReports = await db.select().from(puzzleReports)
      .where(and(
        inArray(puzzleReports.puzzleId, puzzleIds),
        eq(puzzleReports.isResolved, false)
      ))
      .orderBy(desc(puzzleReports.createdAt));
    
    const reportsByPuzzle = new Map<string, PuzzleReport[]>();
    for (const report of allReports) {
      if (!reportsByPuzzle.has(report.puzzleId)) {
        reportsByPuzzle.set(report.puzzleId, []);
      }
      reportsByPuzzle.get(report.puzzleId)!.push(report);
    }
    
    return flaggedPuzzlesList.map(puzzle => ({
      ...puzzle,
      reports: reportsByPuzzle.get(puzzle.id) || [],
    }));
  }

  async getPuzzleOfTheDay(): Promise<Puzzle | undefined> {
    const today = new Date();
    const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
    
    const verifiedPuzzles = await db.select().from(puzzles)
      .where(and(eq(puzzles.isVerified, true), eq(puzzles.isRemoved, false)));
    
    if (verifiedPuzzles.length === 0) {
      const allPuzzles = await db.select().from(puzzles).where(eq(puzzles.isRemoved, false));
      if (allPuzzles.length === 0) return undefined;
      return allPuzzles[dayOfYear % allPuzzles.length];
    }
    
    return verifiedPuzzles[dayOfYear % verifiedPuzzles.length];
  }

  async updateUserPuzzleReputation(userId: string, change: number): Promise<void> {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (user) {
      await db.update(users)
        .set({ puzzleReputation: Math.max(0, (user.puzzleReputation || 0) + change) })
        .where(eq(users.id, userId));
    }
  }

  async updateUserPuzzleSolveStreak(userId: string, solved: boolean): Promise<number> {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) return 0;
    
    const newStreak = solved ? (user.puzzleSolveStreak || 0) + 1 : 0;
    await db.update(users)
      .set({ puzzleSolveStreak: newStreak })
      .where(eq(users.id, userId));
    return newStreak;
  }

  async recordHandshake(userId: string): Promise<{ streak: number; badges: string[] }> {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) return { streak: 0, badges: [] };
    
    const currentStreak = (user.handshakeStreak || 0) + 1;
    const currentMax = user.handshakeStreakMax || 0;
    const newMax = Math.max(currentStreak, currentMax);
    // Ensure badges is always an array, even if null in database
    const currentBadges: string[] = Array.isArray(user.badges) ? user.badges : [];
    const newBadges = [...currentBadges];
    
    // Award Sportsman badge at 10 consecutive handshakes
    if (currentStreak >= 10 && !currentBadges.includes("sportsman")) {
      newBadges.push("sportsman");
    }
    
    await db.update(users)
      .set({ 
        handshakeStreak: currentStreak,
        handshakeStreakMax: newMax,
        badges: newBadges,
      })
      .where(eq(users.id, userId));
    
    return { streak: currentStreak, badges: newBadges };
  }

  async breakHandshakeStreak(userId: string): Promise<void> {
    await db.update(users)
      .set({ handshakeStreak: 0 })
      .where(eq(users.id, userId));
  }

  async getUserSettings(userId: string): Promise<UserSettings | undefined> {
    const [settings] = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId));
    return settings;
  }

  async upsertUserSettings(settingsData: InsertUserSettings): Promise<UserSettings> {
    const [settings] = await db
      .insert(userSettings)
      .values(settingsData)
      .onConflictDoUpdate({
        target: userSettings.userId,
        set: {
          ...settingsData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return settings;
  }

  async updateUserSettings(userId: string, data: Partial<UserSettings>): Promise<UserSettings> {
    const [settings] = await db
      .update(userSettings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(userSettings.userId, userId))
      .returning();
    return settings;
  }

  async getStatistics(userId: string): Promise<Statistics[]> {
    return await db
      .select()
      .from(statistics)
      .where(eq(statistics.userId, userId));
  }

  async upsertStatistics(statsData: InsertStatistics): Promise<Statistics> {
    const existing = await db
      .select()
      .from(statistics)
      .where(and(
        eq(statistics.userId, statsData.userId),
        eq(statistics.mode, statsData.mode)
      ))
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await db
        .update(statistics)
        .set({
          ...statsData,
          updatedAt: new Date(),
        })
        .where(and(
          eq(statistics.userId, statsData.userId),
          eq(statistics.mode, statsData.mode)
        ))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(statistics)
        .values(statsData)
        .returning();
      return created;
    }
  }

  async createSimulGame(simulGameData: InsertSimulGame): Promise<SimulGame> {
    const [simulGame] = await db.insert(simulGames).values(simulGameData).returning();
    return simulGame;
  }

  async getSimulGames(simulId: string): Promise<SimulGame[]> {
    return await db
      .select()
      .from(simulGames)
      .where(eq(simulGames.simulId, simulId))
      .orderBy(simulGames.boardOrder);
  }

  async completeSimul(userId: string, simulId: string): Promise<{ gamesCompleted: number; ratingChange: number }> {
    return await db.transaction(async (tx) => {
      // Get all simul games for this simul session
      const simulGamesForSession = await tx
        .select()
        .from(simulGames)
        .where(eq(simulGames.simulId, simulId));
      
      if (simulGamesForSession.length === 0) {
        throw new Error('No games found for this simul session');
      }
      
      // Preflight check: if any simulGames entry is already marked inactive, the session was completed
      const inactiveGames = simulGamesForSession.filter(sg => !sg.isActive);
      if (inactiveGames.length > 0) {
        throw new Error('Simul session has already been completed');
      }
      
      // Get all actual game records using proper drizzle inArray query
      const gameIds = simulGamesForSession.map(sg => sg.gameId);
      const gameResults = await tx
        .select()
        .from(games)
        .where(inArray(games.id, gameIds));
      
      if (gameResults.length === 0) {
        throw new Error('No completed games found for this simul session');
      }
      
      // Verify ownership: all games must belong to the requesting user
      const invalidGames = gameResults.filter(g => g.userId !== userId);
      if (invalidGames.length > 0) {
        throw new Error('Cannot complete simul: some games do not belong to this user');
      }
      
      // Verify all games are completed
      const incompleteGames = gameResults.filter(g => g.status !== 'completed');
      if (incompleteGames.length > 0) {
        throw new Error('Cannot complete simul: some games are still in progress');
      }
      
      // Check if already processed (prevent double-processing)
      // If ANY game in this simul has been processed, the entire simul was already completed
      const processedGames = gameResults.filter(g => g.statsProcessed);
      if (processedGames.length > 0) {
        throw new Error('Simul session has already been completed and rated');
      }
      
      // Ensure player has a ratings record (create if missing)
      let playerRating = await tx
        .select()
        .from(ratings)
        .where(eq(ratings.userId, userId))
        .limit(1);
      
      if (playerRating.length === 0) {
        // Create initial ratings record with default simul rating of 1000
        const [newRating] = await tx
          .insert(ratings)
          .values({
            userId,
            bullet: 1200,
            blitz: 1200,
            rapid: 1200,
            classical: 1200,
            blindfold: 1200,
            simul: 1000,
          })
          .returning();
        playerRating = [newRating];
      }
      
      const currentRating = playerRating[0]?.simul || 1000;
      
      // Calculate wins, draws, losses
      let wins = 0;
      let draws = 0;
      let losses = 0;
      const totalBoards = gameResults.length;
      
      // Calculate expected score for each board
      let totalExpectedScore = 0;
      let boardsWithRatings = 0;
      
      for (const game of gameResults) {
        // Determine result from player's perspective
        const isWin = (game.result === 'white_win' && game.playerColor === 'white') ||
                     (game.result === 'black_win' && game.playerColor === 'black');
        const isDraw = game.result === 'draw';
        
        if (isWin) wins++;
        else if (isDraw) draws++;
        else losses++;
        
        // Get opponent's rating for this board
        const opponentId = game.whitePlayerId === userId ? game.blackPlayerId : game.whitePlayerId;
        if (opponentId) {
          const [opponentRating] = await tx
            .select()
            .from(ratings)
            .where(eq(ratings.userId, opponentId))
            .limit(1);
          
          // Default to 1000 if opponent has no simul rating
          const opponentCurrentRating = opponentRating?.simul || 1000;
          
          // Calculate expected score for this board
          const expectedScore = 1 / (1 + Math.pow(10, (opponentCurrentRating - currentRating) / 400));
          totalExpectedScore += expectedScore;
          boardsWithRatings++;
        }
      }
      
      // Calculate actual score (wins + 0.5 * draws) / totalBoards
      const actualScore = (wins + 0.5 * draws) / totalBoards;
      
      // Calculate average expected score (only divide by boards that had ratings)
      const avgExpectedScore = boardsWithRatings > 0 
        ? totalExpectedScore / boardsWithRatings 
        : 0.5; // Default to 0.5 if no opponent ratings found
      
      // Determine K-factor based on current rating
      const kFactor = currentRating < 1400 ? 40 : currentRating < 2100 ? 20 : 10;
      
      // Calculate rating change: K × (actualScore - expectedScore)
      const ratingChange = Math.round(kFactor * (actualScore - avgExpectedScore));
      
      // Update simul rating
      await tx
        .update(ratings)
        .set({ 
          simul: currentRating + ratingChange,
          updatedAt: new Date()
        })
        .where(eq(ratings.userId, userId));
      
      // Mark all games in this simul as processed to prevent reprocessing
      await tx
        .update(games)
        .set({ statsProcessed: true })
        .where(inArray(games.id, gameIds));
      
      // Mark all simulGames entries for this session as inactive/completed
      const simulGameIds = simulGamesForSession.map(sg => sg.id);
      await tx
        .update(simulGames)
        .set({ 
          isActive: false,
          lastMoveAt: new Date()
        })
        .where(inArray(simulGames.id, simulGameIds));
      
      // Update statistics for simul mode - load existing stats and increment them
      const existingStats = await tx
        .select()
        .from(statistics)
        .where(and(
          eq(statistics.userId, userId),
          eq(statistics.mode, 'simul' as any)
        ))
        .limit(1);
      
      if (existingStats.length > 0) {
        // Increment existing stats
        await tx
          .update(statistics)
          .set({
            gamesPlayed: existingStats[0].gamesPlayed + totalBoards,
            wins: existingStats[0].wins + wins,
            draws: existingStats[0].draws + draws,
            losses: existingStats[0].losses + losses,
            updatedAt: new Date(),
          })
          .where(and(
            eq(statistics.userId, userId),
            eq(statistics.mode, 'simul' as any)
          ));
      } else {
        // Create new stats record
        await tx
          .insert(statistics)
          .values({
            userId,
            mode: 'simul' as any,
            gamesPlayed: totalBoards,
            wins,
            draws,
            losses,
          });
      }
      
      return {
        gamesCompleted: totalBoards,
        ratingChange
      };
    });
  }

  async joinQueue(queueEntry: InsertMatchmakingQueue): Promise<MatchmakingQueue> {
    await this.leaveQueue(queueEntry.userId, queueEntry.queueType);
    const [entry] = await db.insert(matchmakingQueues).values(queueEntry).returning();
    return entry;
  }

  async leaveQueue(userId: string, queueType: string): Promise<void> {
    await db
      .delete(matchmakingQueues)
      .where(and(eq(matchmakingQueues.userId, userId), eq(matchmakingQueues.queueType, queueType)));
  }

  async leaveAllQueues(userId: string): Promise<void> {
    await db
      .delete(matchmakingQueues)
      .where(eq(matchmakingQueues.userId, userId));
  }

  async findMatch(userId: string, queueType: string): Promise<MatchmakingQueue | undefined> {
    const [opponent] = await db
      .select()
      .from(matchmakingQueues)
      .where(and(
        eq(matchmakingQueues.queueType, queueType),
        ne(matchmakingQueues.userId, userId)
      ))
      .orderBy(matchmakingQueues.joinedAt)
      .limit(1);
    
    return opponent;
  }

  async atomicMatchPairing(
    userId: string, 
    queueType: string, 
    matchData: InsertMatch,
    player1GameTemplates: Partial<InsertGame>[],
    player2GameTemplates: Partial<InsertGame>[]
  ): Promise<{ match: Match; games: Game[] } | null> {
    console.log('[DEBUG] atomicMatchPairing called for user:', userId, 'queue:', queueType);
    if (player1GameTemplates.length !== player2GameTemplates.length) {
      throw new Error('Player game template counts must match');
    }

    return await db.transaction(async (tx) => {
      const [myEntry] = await tx
        .select()
        .from(matchmakingQueues)
        .where(and(
          eq(matchmakingQueues.queueType, queueType),
          eq(matchmakingQueues.userId, userId)
        ))
        .limit(1)
        .for('update');

      if (!myEntry) {
        return null;
      }

      const [opponent] = await tx
        .select()
        .from(matchmakingQueues)
        .where(and(
          eq(matchmakingQueues.queueType, queueType),
          ne(matchmakingQueues.userId, userId)
        ))
        .orderBy(matchmakingQueues.joinedAt)
        .limit(1)
        .for('update', { skipLocked: true });

      if (!opponent) {
        return null;
      }

      const queueCount = await tx
        .select()
        .from(matchmakingQueues)
        .where(and(
          eq(matchmakingQueues.queueType, queueType),
          or(
            eq(matchmakingQueues.userId, userId),
            eq(matchmakingQueues.userId, opponent.userId)
          )
        ));

      if (queueCount.length !== 2) {
        throw new Error('Queue entry mismatch - expected 2 entries before pairing');
      }

      await tx
        .delete(matchmakingQueues)
        .where(and(
          eq(matchmakingQueues.queueType, queueType),
          or(
            eq(matchmakingQueues.userId, userId),
            eq(matchmakingQueues.userId, opponent.userId)
          )
        ));

      const remainingEntries = await tx
        .select()
        .from(matchmakingQueues)
        .where(and(
          eq(matchmakingQueues.queueType, queueType),
          or(
            eq(matchmakingQueues.userId, userId),
            eq(matchmakingQueues.userId, opponent.userId)
          )
        ));

      if (remainingEntries.length !== 0) {
        throw new Error('Failed to remove both queue entries atomically');
      }

      if (player1GameTemplates.length === 0) {
        throw new Error('At least one game template required for each player');
      }

      const createdGames: Game[] = [];
      
      for (let i = 0; i < player1GameTemplates.length; i++) {
        const [p1Game] = await tx
          .insert(games)
          .values({
            ...player1GameTemplates[i],
            userId,
            opponentName: opponent.userId,
          } as InsertGame)
          .returning();
        createdGames.push(p1Game);

        const [p2Game] = await tx
          .insert(games)
          .values({
            ...player2GameTemplates[i],
            userId: opponent.userId,
            opponentName: userId,
          } as InsertGame)
          .returning();
        createdGames.push(p2Game);
      }

      const [match] = await tx
        .insert(matches)
        .values({
          ...matchData,
          player1Id: userId,
          player2Id: opponent.userId,
          gameIds: createdGames.map(g => g.id),
        })
        .returning();

      // Update all games with matchId now that match is created
      console.log('[DEBUG] Updating games with matchId:', match.id, 'for', createdGames.length, 'games');
      const updatedGames: Game[] = [];
      for (const game of createdGames) {
        const [updatedGame] = await tx
          .update(games)
          .set({ matchId: match.id })
          .where(eq(games.id, game.id))
          .returning();
        console.log('[DEBUG] Updated game', updatedGame.id, 'with matchId:', updatedGame.matchId);
        updatedGames.push(updatedGame);
      }

      return { match, games: updatedGames };
    });
  }

  async getUserQueueStatus(userId: string): Promise<MatchmakingQueue | undefined> {
    const [queueEntry] = await db
      .select()
      .from(matchmakingQueues)
      .where(eq(matchmakingQueues.userId, userId))
      .limit(1);
    
    return queueEntry;
  }

  async createMatch(matchData: InsertMatch): Promise<Match> {
    const [match] = await db.insert(matches).values(matchData).returning();
    return match;
  }

  async getMatch(id: string): Promise<Match | undefined> {
    const [match] = await db.select().from(matches).where(eq(matches.id, id));
    return match;
  }

  async getActiveMatchForUser(userId: string): Promise<Match | undefined> {
    const [match] = await db
      .select()
      .from(matches)
      .where(
        and(
          or(
            eq(matches.player1Id, userId),
            eq(matches.player2Id, userId)
          ),
          ne(matches.status, 'completed'),
          ne(matches.status, 'searching')
        )
      )
      .orderBy(desc(matches.createdAt))
      .limit(1);
    
    return match;
  }

  async updateMatchStatus(id: string, status: string): Promise<Match> {
    const [match] = await db
      .update(matches)
      .set({ status: status as any })
      .where(eq(matches.id, id))
      .returning();
    
    return match;
  }

  async updateMatch(id: string, data: Partial<Match>): Promise<Match> {
    const [match] = await db
      .update(matches)
      .set(data)
      .where(eq(matches.id, id))
      .returning();
    
    return match;
  }

  async getGamesByMatchId(matchId: string): Promise<Game[]> {
    return await db
      .select()
      .from(games)
      .where(eq(games.matchId, matchId))
      .orderBy(games.createdAt);
  }

  async completeMatch(matchId: string, result: string): Promise<{ match: Match; games: Game[]; alreadyCompleted?: boolean }> {
    return await db.transaction(async (tx) => {
      // Load match with row-level lock to prevent race conditions
      // FOR UPDATE ensures only one transaction can process completion at a time
      // Neon serverless driver returns QueryResult with rows array
      const lockResult = await tx.execute(
        sql`SELECT * FROM matches WHERE id = ${matchId} FOR UPDATE`
      );
      const match = (lockResult as { rows: Match[] }).rows[0];
      
      if (!match) {
        throw new Error(`Match ${matchId} not found`);
      }
      
      // If match is already completed, return existing data (idempotent handling)
      // The FOR UPDATE lock ensures we see the authoritative state
      if (match.status === 'completed') {
        console.log(`[storage.completeMatch] Match ${matchId} already completed, returning existing data`);
        const existingGames = await tx.select().from(games).where(eq(games.matchId, matchId)).orderBy(games.createdAt);
        return { match, games: existingGames, alreadyCompleted: true };
      }

      // Load both games
      const matchGames = await tx
        .select()
        .from(games)
        .where(eq(games.matchId, matchId))
        .orderBy(games.createdAt);

      if (matchGames.length !== 2) {
        throw new Error(`Expected 2 games for match ${matchId}, found ${matchGames.length}`);
      }

      // Validate games belong to this match
      if (matchGames.some(g => g.matchId !== matchId)) {
        throw new Error(`Game matchId mismatch for match ${matchId}`);
      }

      // Update match
      const [updatedMatch] = await tx
        .update(matches)
        .set({
          status: 'completed' as any,
          result: result as any,
          completedAt: new Date(),
        })
        .where(eq(matches.id, matchId))
        .returning();

      // Update both games and calculate ratings/stats
      const updatedGames: Game[] = [];
      
      // Skip rating/stats processing for aborted games
      const isAborted = result === 'aborted';
      
      for (const game of matchGames) {
        // Skip if already processed
        if (game.statsProcessed) {
          updatedGames.push(game);
          continue;
        }

        // For aborted games, just update status without processing stats/ratings
        if (isAborted) {
          const [updatedGame] = await tx
            .update(games)
            .set({
              status: 'completed' as any,
              result: 'aborted' as any,
              completedAt: new Date(),
              statsProcessed: true,
            })
            .where(eq(games.id, game.id))
            .returning();
          
          updatedGames.push(updatedGame);
          continue;
        }

        // Game result is the same as match result - represents who won the game
        // The isWin calculation below determines if this player won based on their color
        const gameResult = result;

        // Update game record
        const [updatedGame] = await tx
          .update(games)
          .set({
            status: 'completed' as any,
            result: gameResult as any,
            completedAt: new Date(),
            statsProcessed: true,
          })
          .where(eq(games.id, game.id))
          .returning();

        updatedGames.push(updatedGame);

        // Calculate stats
        const stats = await tx.select().from(statistics).where(eq(statistics.userId, game.userId));
        const existingStat = stats.find(s => s.mode === game.mode);

        const isWin =
          (gameResult === 'white_win' && game.playerColor === 'white') ||
          (gameResult === 'black_win' && game.playerColor === 'black');
        const isDraw = gameResult === 'draw';

        const newStats = {
          userId: game.userId,
          mode: game.mode,
          gamesPlayed: (existingStat?.gamesPlayed || 0) + 1,
          wins: (existingStat?.wins || 0) + (isWin ? 1 : 0),
          losses: (existingStat?.losses || 0) + (!isWin && !isDraw ? 1 : 0),
          draws: (existingStat?.draws || 0) + (isDraw ? 1 : 0),
          totalTime: (existingStat?.totalTime || 0) + (game.timeControl || 0),
          winStreak: isWin ? (existingStat?.winStreak || 0) + 1 : 0,
        };

        await tx
          .insert(statistics)
          .values(newStats)
          .onConflictDoUpdate({
            target: [statistics.userId, statistics.mode],
            set: {
              ...newStats,
              updatedAt: new Date(),
            },
          });

        // Calculate rating
        const [userRating] = await tx.select().from(ratings).where(eq(ratings.userId, game.userId));
        if (!userRating) {
          throw new Error(`No rating found for user ${game.userId}`);
        }

        // Determine rating field based on game mode and time control
        // OTB games use otb* pools, standard games use regular pools
        const isOtbGame = game.mode?.startsWith('otb_');
        const tc = game.timeControl || 0;
        
        let baseTimeControl: 'Bullet' | 'Blitz' | 'Rapid' | 'Classical';
        if (tc <= 180) baseTimeControl = 'Bullet';
        else if (tc <= 600) baseTimeControl = 'Blitz';
        else if (tc <= 1200) baseTimeControl = 'Rapid';
        else baseTimeControl = 'Classical';
        
        type RatingField = 'bullet' | 'blitz' | 'rapid' | 'classical' | 'otbBullet' | 'otbBlitz' | 'otbRapid' | 'otbClassical';
        const ratingField: RatingField = isOtbGame 
          ? `otb${baseTimeControl}` as RatingField
          : baseTimeControl.toLowerCase() as RatingField;

        const currentRating = userRating[ratingField] || 1200;

        // Get opponent rating
        const opponentGame = matchGames.find(g => g.id !== game.id);
        if (!opponentGame) {
          throw new Error(`Could not find opponent game for ${game.id}`);
        }

        const [opponentRating] = await tx
          .select()
          .from(ratings)
          .where(eq(ratings.userId, opponentGame.userId));
        
        const opponentCurrentRating = opponentRating?.[ratingField] || 1200;

        // Calculate Elo rating change
        const kFactor = currentRating < 1400 ? 40 : currentRating < 2100 ? 20 : 10;
        const score = isWin ? 1 : isDraw ? 0.5 : 0;
        const expectedScore = 1 / (1 + Math.pow(10, (opponentCurrentRating - currentRating) / 400));
        const ratingChange = Math.round(kFactor * (score - expectedScore));

        const ratingUpdate: any = {};
        ratingUpdate[ratingField] = currentRating + ratingChange;

        await tx
          .update(ratings)
          .set(ratingUpdate)
          .where(eq(ratings.userId, game.userId));
      }

      return { match: updatedMatch, games: updatedGames };
    });
  }

  async saveBoardSpinScore(scoreData: InsertBoardSpinScore): Promise<BoardSpinScore> {
    const [score] = await db.insert(boardSpinScores).values(scoreData).returning();
    return score;
  }

  async getBoardSpinLeaderboard(difficulty?: string, limit: number = 10): Promise<(BoardSpinScore & { user: User })[]> {
    const whereClause = difficulty 
      ? eq(boardSpinScores.difficulty, difficulty as any)
      : undefined;

    const results = await db
      .select()
      .from(boardSpinScores)
      .innerJoin(users, eq(boardSpinScores.userId, users.id))
      .where(whereClause)
      .orderBy(desc(boardSpinScores.score))
      .limit(limit);

    return results.map(r => ({
      ...r.board_spin_scores,
      user: r.users,
    }));
  }

  async getUserBoardSpinScores(userId: string, limit: number = 20): Promise<BoardSpinScore[]> {
    return await db
      .select()
      .from(boardSpinScores)
      .where(eq(boardSpinScores.userId, userId))
      .orderBy(desc(boardSpinScores.createdAt))
      .limit(limit);
  }

  async getUserBoardSpinHighScore(userId: string, difficulty?: string): Promise<BoardSpinScore | undefined> {
    const whereClause = difficulty 
      ? and(eq(boardSpinScores.userId, userId), eq(boardSpinScores.difficulty, difficulty as any))
      : eq(boardSpinScores.userId, userId);

    const [highScore] = await db
      .select()
      .from(boardSpinScores)
      .where(whereClause)
      .orderBy(desc(boardSpinScores.score))
      .limit(1);

    return highScore;
  }

  async getUserBoardSpinStats(userId: string): Promise<{ gamesPlayed: number; bestScore: number; avgAccuracy: number }> {
    const [result] = await db
      .select({
        gamesPlayed: sql<number>`count(*)::int`,
        bestScore: sql<number>`coalesce(max(${boardSpinScores.score}), 0)::int`,
        avgAccuracy: sql<number>`coalesce(round(avg(${boardSpinScores.accuracy})), 0)::int`,
      })
      .from(boardSpinScores)
      .where(eq(boardSpinScores.userId, userId));

    return {
      gamesPlayed: result?.gamesPlayed || 0,
      bestScore: result?.bestScore || 0,
      avgAccuracy: result?.avgAccuracy || 0,
    };
  }

  // N-Piece Challenge Methods
  async getNPieceProgress(userId: string, pieceType: NPieceType, boardSize: number): Promise<NPieceChallengeProgress | undefined> {
    const [progress] = await db
      .select()
      .from(nPieceChallengeProgress)
      .where(and(
        eq(nPieceChallengeProgress.userId, userId),
        eq(nPieceChallengeProgress.pieceType, pieceType),
        eq(nPieceChallengeProgress.boardSize, boardSize)
      ));
    return progress;
  }

  async getOrCreateNPieceProgress(userId: string, pieceType: NPieceType, boardSize: number): Promise<NPieceChallengeProgress> {
    const existing = await this.getNPieceProgress(userId, pieceType, boardSize);
    if (existing) return existing;

    const [progress] = await db
      .insert(nPieceChallengeProgress)
      .values({
        userId,
        pieceType,
        boardSize,
        solutionsFound: 0,
      })
      .returning();
    return progress;
  }

  async getNPieceSolutions(progressId: string): Promise<NPieceChallengeSolution[]> {
    return await db
      .select()
      .from(nPieceChallengeSolutions)
      .where(eq(nPieceChallengeSolutions.progressId, progressId))
      .orderBy(nPieceChallengeSolutions.solutionIndex);
  }

  async getUserNPieceSolutionByPositions(userId: string, pieceType: NPieceType, boardSize: number, positions: string): Promise<NPieceChallengeSolution | undefined> {
    const [solution] = await db
      .select()
      .from(nPieceChallengeSolutions)
      .where(and(
        eq(nPieceChallengeSolutions.userId, userId),
        eq(nPieceChallengeSolutions.pieceType, pieceType),
        eq(nPieceChallengeSolutions.boardSize, boardSize),
        eq(nPieceChallengeSolutions.positions, positions)
      ));
    return solution;
  }

  async saveNPieceSolution(solutionData: InsertNPieceChallengeSolution): Promise<{ solution: NPieceChallengeSolution; isNew: boolean }> {
    // Check if this exact solution already exists
    const existing = await this.getUserNPieceSolutionByPositions(
      solutionData.userId,
      solutionData.pieceType,
      solutionData.boardSize,
      solutionData.positions
    );

    if (existing) {
      return { solution: existing, isNew: false };
    }

    // Get current solution count to determine solutionIndex
    const progress = await this.getOrCreateNPieceProgress(
      solutionData.userId,
      solutionData.pieceType,
      solutionData.boardSize
    );

    const existingSolutions = await this.getNPieceSolutions(progress.id);
    const solutionIndex = existingSolutions.length;

    // Insert new solution
    const [solution] = await db
      .insert(nPieceChallengeSolutions)
      .values({
        ...solutionData,
        progressId: progress.id,
        solutionIndex,
      })
      .returning();

    // Update progress
    const newSolutionsFound = (progress.solutionsFound || 0) + 1;
    const newBestTime = !progress.bestTime || solutionData.solveTime < progress.bestTime
      ? solutionData.solveTime
      : progress.bestTime;

    await db
      .update(nPieceChallengeProgress)
      .set({
        solutionsFound: newSolutionsFound,
        bestTime: newBestTime,
        lastPlayedAt: new Date(),
      })
      .where(eq(nPieceChallengeProgress.id, progress.id));

    return { solution, isNew: true };
  }

  async getNPieceOverallProgress(userId: string): Promise<{ total: number; found: number }> {
    const allProgress = await db
      .select()
      .from(nPieceChallengeProgress)
      .where(eq(nPieceChallengeProgress.userId, userId));

    const found = allProgress.reduce((sum, p) => sum + (p.solutionsFound || 0), 0);
    
    // Total trackable solutions across all piece/board combos (capped at 1000 each)
    // 5 pieces * 8 board sizes * ~estimated solutions
    const total = allProgress.length > 0 ? found : 0; // Will be updated as user plays

    return { total: Math.max(total, 100), found };
  }

  // Knight's Tour methods
  async getKnightsTourProgress(userId: string, boardSize: number): Promise<KnightsTourProgress | undefined> {
    const [progress] = await db
      .select()
      .from(knightsTourProgress)
      .where(and(
        eq(knightsTourProgress.userId, userId),
        eq(knightsTourProgress.boardSize, boardSize)
      ));
    return progress;
  }

  async saveKnightsTourCompletion(userId: string, boardSize: number, completionTime: number): Promise<KnightsTourProgress> {
    const existing = await this.getKnightsTourProgress(userId, boardSize);

    if (existing) {
      const newCount = (existing.completedCount || 0) + 1;
      const newBestTime = !existing.bestTime || completionTime < existing.bestTime
        ? completionTime
        : existing.bestTime;

      const [updated] = await db
        .update(knightsTourProgress)
        .set({
          completedCount: newCount,
          bestTime: newBestTime,
          lastPlayedAt: new Date(),
        })
        .where(eq(knightsTourProgress.id, existing.id))
        .returning();
      return updated;
    }

    const [progress] = await db
      .insert(knightsTourProgress)
      .values({
        userId,
        boardSize,
        completedCount: 1,
        bestTime: completionTime,
        lastPlayedAt: new Date(),
      })
      .returning();
    return progress;
  }

  async saveKnightsTourIncomplete(userId: string, boardSize: number, moveCount: number): Promise<KnightsTourProgress> {
    const existing = await this.getKnightsTourProgress(userId, boardSize);

    if (existing) {
      // Only update if this is a new high score for incomplete attempts
      const newHighest = !existing.highestMoveCount || moveCount > existing.highestMoveCount
        ? moveCount
        : existing.highestMoveCount;

      const [updated] = await db
        .update(knightsTourProgress)
        .set({
          highestMoveCount: newHighest,
          lastPlayedAt: new Date(),
        })
        .where(eq(knightsTourProgress.id, existing.id))
        .returning();
      return updated;
    }

    const [progress] = await db
      .insert(knightsTourProgress)
      .values({
        userId,
        boardSize,
        completedCount: 0,
        highestMoveCount: moveCount,
        lastPlayedAt: new Date(),
      })
      .returning();
    return progress;
  }

  async getKnightsTourOverallProgress(userId: string): Promise<{ totalCompleted: number; boardsCompleted: number }> {
    const allProgress = await db
      .select()
      .from(knightsTourProgress)
      .where(eq(knightsTourProgress.userId, userId));

    const totalCompleted = allProgress.reduce((sum, p) => sum + (p.completedCount || 0), 0);
    const boardsCompleted = allProgress.filter(p => (p.completedCount || 0) > 0).length;

    return { totalCompleted, boardsCompleted };
  }

  // Game Analysis methods
  async getGameAnalysis(gameId: string): Promise<GameAnalysis | undefined> {
    const [analysis] = await db
      .select()
      .from(gameAnalysis)
      .where(eq(gameAnalysis.gameId, gameId));
    return analysis;
  }

  async getGameAnalysisById(analysisId: string): Promise<GameAnalysis | undefined> {
    const [analysis] = await db
      .select()
      .from(gameAnalysis)
      .where(eq(gameAnalysis.id, analysisId));
    return analysis;
  }

  async createGameAnalysis(analysis: InsertGameAnalysis): Promise<GameAnalysis> {
    const [created] = await db
      .insert(gameAnalysis)
      .values(analysis)
      .returning();
    return created;
  }

  async updateGameAnalysis(id: string, data: Partial<GameAnalysis>): Promise<GameAnalysis> {
    const [updated] = await db
      .update(gameAnalysis)
      .set(data)
      .where(eq(gameAnalysis.id, id))
      .returning();
    return updated;
  }

  async createMoveAnalysis(analysis: InsertMoveAnalysis): Promise<MoveAnalysis> {
    const [created] = await db
      .insert(moveAnalysis)
      .values(analysis)
      .returning();
    return created;
  }

  async getMoveAnalyses(gameAnalysisId: string): Promise<MoveAnalysis[]> {
    return db
      .select()
      .from(moveAnalysis)
      .where(eq(moveAnalysis.gameAnalysisId, gameAnalysisId))
      .orderBy(
        moveAnalysis.moveNumber,
        sql`CASE WHEN ${moveAnalysis.color} = 'white' THEN 0 ELSE 1 END`
      );
  }

  // Shared Analysis methods
  async createSharedAnalysis(shared: InsertSharedAnalysis): Promise<SharedAnalysis> {
    const [created] = await db
      .insert(sharedAnalysis)
      .values(shared)
      .returning();
    return created;
  }

  async getSharedAnalysisByCode(shareCode: string): Promise<SharedAnalysis | undefined> {
    const [shared] = await db
      .select()
      .from(sharedAnalysis)
      .where(eq(sharedAnalysis.shareCode, shareCode));
    return shared;
  }

  async incrementShareViewCount(id: string): Promise<void> {
    await db
      .update(sharedAnalysis)
      .set({ viewCount: sql`${sharedAnalysis.viewCount} + 1` })
      .where(eq(sharedAnalysis.id, id));
  }

  // Player Progress Tracking methods
  async recordAccuracyHistory(
    userId: string,
    gameId: string,
    accuracy: number,
    rating?: number,
    gameMode?: string
  ): Promise<AccuracyHistory> {
    const [record] = await db
      .insert(accuracyHistory)
      .values({
        userId,
        gameId,
        accuracy,
        rating,
        gameMode,
      })
      .returning();
    return record;
  }

  async getAccuracyHistory(userId: string, limit: number = 50): Promise<AccuracyHistory[]> {
    return db
      .select()
      .from(accuracyHistory)
      .where(eq(accuracyHistory.userId, userId))
      .orderBy(desc(accuracyHistory.recordedAt))
      .limit(limit);
  }

  async getPlayerWeaknesses(userId: string): Promise<PlayerWeakness[]> {
    return db
      .select()
      .from(playerWeaknesses)
      .where(eq(playerWeaknesses.userId, userId))
      .orderBy(desc(playerWeaknesses.occurrences));
  }

  async upsertPlayerWeakness(weakness: InsertPlayerWeakness): Promise<PlayerWeakness> {
    const [upserted] = await db
      .insert(playerWeaknesses)
      .values(weakness)
      .onConflictDoUpdate({
        target: [playerWeaknesses.userId, playerWeaknesses.weaknessType],
        set: {
          occurrences: sql`${playerWeaknesses.occurrences} + 1`,
          lastOccurrence: new Date(),
          gamesAnalyzed: sql`${playerWeaknesses.gamesAnalyzed} + 1`,
          updatedAt: new Date(),
        },
      })
      .returning();
    return upserted;
  }

  // Simul vs Simul methods
  async joinSimulVsSimulQueue(userId: string, boardCount: number, rating?: number): Promise<SimulVsSimulQueue> {
    const [entry] = await db
      .insert(simulVsSimulQueue)
      .values({
        odId: userId,
        boardCount,
        rating,
      })
      .onConflictDoUpdate({
        target: simulVsSimulQueue.odId,
        set: {
          boardCount,
          rating,
          joinedAt: new Date(),
        },
      })
      .returning();
    return entry;
  }

  async leaveSimulVsSimulQueue(userId: string): Promise<void> {
    await db
      .delete(simulVsSimulQueue)
      .where(eq(simulVsSimulQueue.odId, userId));
  }

  async getSimulVsSimulQueueStatus(userId: string): Promise<SimulVsSimulQueue | undefined> {
    const [entry] = await db
      .select()
      .from(simulVsSimulQueue)
      .where(eq(simulVsSimulQueue.odId, userId));
    return entry;
  }

  async getSimulVsSimulQueuePlayers(boardCount: number): Promise<SimulVsSimulQueue[]> {
    return db
      .select()
      .from(simulVsSimulQueue)
      .where(eq(simulVsSimulQueue.boardCount, boardCount))
      .orderBy(simulVsSimulQueue.joinedAt);
  }

  async getOldestSimulVsSimulQueueEntry(boardCount: number): Promise<SimulVsSimulQueue | undefined> {
    const [oldest] = await db
      .select()
      .from(simulVsSimulQueue)
      .where(eq(simulVsSimulQueue.boardCount, boardCount))
      .orderBy(simulVsSimulQueue.joinedAt)
      .limit(1);
    return oldest;
  }

  async getSimulVsSimulQueueAverageRating(boardCount: number): Promise<number> {
    const players = await this.getSimulVsSimulQueuePlayers(boardCount);
    if (players.length === 0) return 1000;
    const total = players.reduce((sum, p) => sum + (p.rating || 1000), 0);
    return Math.round(total / players.length);
  }

  async createSimulVsSimulMatch(boardCount: number): Promise<SimulVsSimulMatch> {
    const playerCount = boardCount + 1;
    const [match] = await db
      .insert(simulVsSimulMatches)
      .values({
        boardCount,
        playerCount,
        status: "starting",
      })
      .returning();
    return match;
  }

  async addPlayerToSimulVsSimulMatch(
    matchId: string,
    odId: string | null,
    seat: number,
    isBot: boolean = false,
    botId?: string,
    botPersonality?: string
  ): Promise<SimulVsSimulPlayer> {
    const [player] = await db
      .insert(simulVsSimulPlayers)
      .values({
        matchId,
        odId: odId,
        odnt: seat,
        isBot,
        botId,
        botPersonality,
      })
      .returning();
    return player;
  }

  async createSimulVsSimulPairing(pairing: InsertSimulVsSimulPairing): Promise<SimulVsSimulPairing> {
    const [created] = await db
      .insert(simulVsSimulPairings)
      .values(pairing)
      .returning();
    return created;
  }

  async getSimulVsSimulMatch(matchId: string): Promise<SimulVsSimulMatch | undefined> {
    const [match] = await db
      .select()
      .from(simulVsSimulMatches)
      .where(eq(simulVsSimulMatches.id, matchId));
    return match;
  }

  async getSimulVsSimulMatchPlayers(matchId: string): Promise<SimulVsSimulPlayer[]> {
    return db
      .select()
      .from(simulVsSimulPlayers)
      .where(eq(simulVsSimulPlayers.matchId, matchId))
      .orderBy(simulVsSimulPlayers.odnt);
  }

  async getSimulVsSimulPlayerGames(matchId: string, odId: string): Promise<SimulVsSimulPairing[]> {
    console.log(`[Storage] getSimulVsSimulPlayerGames called with matchId=${matchId}, odId=${odId}`);
    const results = await db
      .select()
      .from(simulVsSimulPairings)
      .where(
        and(
          eq(simulVsSimulPairings.matchId, matchId),
          or(
            eq(simulVsSimulPairings.whitePlayerId, odId),
            eq(simulVsSimulPairings.blackPlayerId, odId)
          )
        )
      )
      .orderBy(simulVsSimulPairings.createdAt);
    console.log(`[Storage] getSimulVsSimulPlayerGames returned ${results.length} pairings for odId=${odId}`);
    return results;
  }

  async getSimulVsSimulPairing(pairingId: string): Promise<SimulVsSimulPairing | undefined> {
    const [pairing] = await db
      .select()
      .from(simulVsSimulPairings)
      .where(eq(simulVsSimulPairings.id, pairingId));
    return pairing;
  }

  async updateSimulVsSimulPairing(pairingId: string, data: Partial<SimulVsSimulPairing>): Promise<SimulVsSimulPairing> {
    const [updated] = await db
      .update(simulVsSimulPairings)
      .set(data as any)
      .where(eq(simulVsSimulPairings.id, pairingId))
      .returning();
    return updated;
  }

  async updateSimulVsSimulMatch(matchId: string, data: Partial<SimulVsSimulMatch>): Promise<SimulVsSimulMatch> {
    const [updated] = await db
      .update(simulVsSimulMatches)
      .set(data as any)
      .where(eq(simulVsSimulMatches.id, matchId))
      .returning();
    return updated;
  }

  async updateSimulVsSimulPlayer(playerId: string, data: Partial<SimulVsSimulPlayer>): Promise<SimulVsSimulPlayer> {
    const [updated] = await db
      .update(simulVsSimulPlayers)
      .set(data as any)
      .where(eq(simulVsSimulPlayers.id, playerId))
      .returning();
    return updated;
  }

  async getActiveSimulVsSimulMatchForUser(userId: string): Promise<SimulVsSimulMatch | undefined> {
    const [player] = await db
      .select()
      .from(simulVsSimulPlayers)
      .innerJoin(simulVsSimulMatches, eq(simulVsSimulPlayers.matchId, simulVsSimulMatches.id))
      .where(
        and(
          eq(simulVsSimulPlayers.odId, userId),
          eq(simulVsSimulMatches.status, "in_progress")
        )
      );
    return player?.simul_vs_simul_matches;
  }

  async getAllSimulVsSimulPairings(matchId: string): Promise<SimulVsSimulPairing[]> {
    return db
      .select()
      .from(simulVsSimulPairings)
      .where(eq(simulVsSimulPairings.matchId, matchId));
  }

  async clearSimulVsSimulQueue(boardCount: number, userIds: string[]): Promise<void> {
    if (userIds.length === 0) return;
    await db
      .delete(simulVsSimulQueue)
      .where(
        and(
          eq(simulVsSimulQueue.boardCount, boardCount),
          inArray(simulVsSimulQueue.odId, userIds)
        )
      );
  }

  async getCompletedSimulVsSimulPairingCount(): Promise<number> {
    const [result] = await db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(simulVsSimulPairings)
      .where(sql`${simulVsSimulPairings.result} != 'ongoing'`);
    return result?.count || 0;
  }

  // Anti-Cheat System
  async createCheatReport(report: InsertCheatReport): Promise<CheatReport> {
    const [newReport] = await db.insert(cheatReports).values(report).returning();
    
    // Increment report count for the reported user
    const antiCheat = await this.getOrCreateUserAntiCheat(report.reportedUserId);
    await this.updateUserAntiCheat(report.reportedUserId, {
      reportCount: (antiCheat.reportCount || 0) + 1,
    });
    
    return newReport;
  }

  async getCheatReports(reportedUserId?: string, isResolved?: boolean): Promise<CheatReport[]> {
    const conditions = [];
    if (reportedUserId) {
      conditions.push(eq(cheatReports.reportedUserId, reportedUserId));
    }
    if (isResolved !== undefined) {
      conditions.push(eq(cheatReports.isResolved, isResolved));
    }
    
    if (conditions.length === 0) {
      return db.select().from(cheatReports).orderBy(desc(cheatReports.createdAt));
    }
    
    return db
      .select()
      .from(cheatReports)
      .where(and(...conditions))
      .orderBy(desc(cheatReports.createdAt));
  }

  async getCheatReportsByReporter(reporterId: string): Promise<CheatReport[]> {
    return db
      .select()
      .from(cheatReports)
      .where(eq(cheatReports.reporterId, reporterId))
      .orderBy(desc(cheatReports.createdAt));
  }

  async resolveCheatReport(id: string, resolvedById: string, resolution: string): Promise<CheatReport> {
    const [updated] = await db
      .update(cheatReports)
      .set({
        isResolved: true,
        resolvedById,
        resolvedAt: new Date(),
        resolution,
      })
      .where(eq(cheatReports.id, id))
      .returning();
    return updated;
  }

  async getUserAntiCheat(userId: string): Promise<UserAntiCheat | undefined> {
    const [record] = await db
      .select()
      .from(userAntiCheat)
      .where(eq(userAntiCheat.userId, userId));
    return record;
  }

  async getOrCreateUserAntiCheat(userId: string): Promise<UserAntiCheat> {
    const existing = await this.getUserAntiCheat(userId);
    if (existing) return existing;
    
    const [created] = await db
      .insert(userAntiCheat)
      .values({ userId })
      .returning();
    return created;
  }

  async updateUserAntiCheat(userId: string, data: Partial<UserAntiCheat>): Promise<UserAntiCheat> {
    const existing = await this.getOrCreateUserAntiCheat(userId);
    
    const [updated] = await db
      .update(userAntiCheat)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(userAntiCheat.userId, userId))
      .returning();
    return updated;
  }

  async getFlaggedUsers(priority?: ReviewPriority): Promise<UserAntiCheat[]> {
    if (priority) {
      return db
        .select()
        .from(userAntiCheat)
        .where(and(
          eq(userAntiCheat.isFlagged, true),
          eq(userAntiCheat.reviewPriority, priority)
        ))
        .orderBy(desc(userAntiCheat.flaggedAt));
    }
    return db
      .select()
      .from(userAntiCheat)
      .where(eq(userAntiCheat.isFlagged, true))
      .orderBy(desc(userAntiCheat.flaggedAt));
  }

  async getAllFlaggedUsersWithDetails(): Promise<Array<UserAntiCheat & { user: User; reportCount: number }>> {
    const flaggedRecords = await db
      .select({
        antiCheat: userAntiCheat,
        user: users,
      })
      .from(userAntiCheat)
      .innerJoin(users, eq(userAntiCheat.userId, users.id))
      .where(eq(userAntiCheat.isFlagged, true))
      .orderBy(desc(userAntiCheat.riskScore));
    
    return flaggedRecords.map(r => ({
      ...r.antiCheat,
      user: r.user,
      reportCount: r.antiCheat.reportCount || 0,
    }));
  }

  async flagUserForReview(userId: string, reason: string, priority: ReviewPriority): Promise<UserAntiCheat> {
    const antiCheat = await this.getOrCreateUserAntiCheat(userId);
    
    const [updated] = await db
      .update(userAntiCheat)
      .set({
        isFlagged: true,
        flaggedAt: new Date(),
        flagReason: reason,
        reviewPriority: priority,
        reviewStatus: 'pending',
        updatedAt: new Date(),
      })
      .where(eq(userAntiCheat.userId, userId))
      .returning();
    return updated;
  }

  async updateReviewStatus(userId: string, status: ReviewStatus, adminId: string, notes?: string): Promise<UserAntiCheat> {
    const updateData: Partial<UserAntiCheat> = {
      reviewStatus: status,
      lastReviewedAt: new Date(),
      lastReviewedById: adminId,
      updatedAt: new Date(),
    };
    
    if (notes) {
      const existing = await this.getUserAntiCheat(userId);
      updateData.adminNotes = existing?.adminNotes 
        ? `${existing.adminNotes}\n\n[${new Date().toISOString()}] ${notes}`
        : `[${new Date().toISOString()}] ${notes}`;
    }
    
    // If dismissed, unflag the user
    if (status === 'dismissed') {
      updateData.isFlagged = false;
    }
    
    const [updated] = await db
      .update(userAntiCheat)
      .set(updateData)
      .where(eq(userAntiCheat.userId, userId))
      .returning();
    return updated;
  }

  async issueWarning(userId: string, adminId: string, notes: string): Promise<UserAntiCheat> {
    const existing = await this.getOrCreateUserAntiCheat(userId);
    
    const [updated] = await db
      .update(userAntiCheat)
      .set({
        warningCount: (existing.warningCount || 0) + 1,
        lastWarningAt: new Date(),
        reviewStatus: 'warning_issued',
        lastReviewedAt: new Date(),
        lastReviewedById: adminId,
        adminNotes: existing.adminNotes 
          ? `${existing.adminNotes}\n\n[${new Date().toISOString()}] WARNING: ${notes}`
          : `[${new Date().toISOString()}] WARNING: ${notes}`,
        isFlagged: false,
        updatedAt: new Date(),
      })
      .where(eq(userAntiCheat.userId, userId))
      .returning();
    return updated;
  }
  
  // Admin Moderation
  async suspendUser(userId: string, suspendedUntil: Date): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ 
        suspendedUntil,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }
  
  async banUser(userId: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ 
        isBanned: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }
  
  async unbanUser(userId: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ 
        isBanned: false,
        suspendedUntil: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }
  
  async refundGameElo(gameId: string): Promise<{ message: string; gamesRefunded: number }> {
    const game = await this.getGame(gameId);
    if (!game) {
      throw new Error("Game not found");
    }
    
    if (!game.ratingChange) {
      return { message: "No rating change to refund for this game", gamesRefunded: 0 };
    }
    
    // Find the match to get both games
    if (!game.matchId) {
      return { message: "Cannot refund single-player game", gamesRefunded: 0 };
    }
    
    // Get both games in this match
    const matchGames = await db
      .select()
      .from(games)
      .where(eq(games.matchId, game.matchId));
    
    if (matchGames.length !== 2) {
      return { message: "Match does not have exactly 2 games", gamesRefunded: 0 };
    }
    
    // Determine time control category for rating update
    const timeControl = game.timeControl || 10;
    let ratingKey: string;
    if (game.mode?.toString().includes('otb')) {
      if (timeControl <= 3) ratingKey = 'otbBullet';
      else if (timeControl <= 10) ratingKey = 'otbBlitz';
      else ratingKey = 'otbRapid';
    } else if (game.mode?.toString().includes('standard')) {
      if (timeControl <= 3) ratingKey = 'bullet';
      else if (timeControl <= 10) ratingKey = 'blitz';
      else ratingKey = 'rapid';
    } else {
      ratingKey = 'blitz';
    }
    
    // Refund rating changes for both players
    for (const g of matchGames) {
      if (g.userId && g.ratingChange) {
        const existingRating = await this.getRating(g.userId);
        if (existingRating) {
          const currentRating = (existingRating as any)[ratingKey] || 1000;
          // Reverse the rating change
          await db
            .update(ratings)
            .set({ 
              [ratingKey]: currentRating - g.ratingChange,
              updatedAt: new Date()
            })
            .where(eq(ratings.userId, g.userId));
        }
      }
      
      // Mark game as refunded by setting ratingChange to 0
      await db
        .update(games)
        .set({ ratingChange: 0 })
        .where(eq(games.id, g.id));
    }
    
    return { message: `Refunded rating changes for match`, gamesRefunded: matchGames.length };
  }
  
  async refundAllWinsElo(userId: string): Promise<{ message: string; gamesRefunded: number }> {
    // Find all completed games where this user won
    const winConditions = or(
      and(eq(games.whitePlayerId, userId), eq(games.result, 'white_win')),
      and(eq(games.blackPlayerId, userId), eq(games.result, 'black_win'))
    );
    
    const wonGames = await db
      .select()
      .from(games)
      .where(and(
        or(eq(games.whitePlayerId, userId), eq(games.blackPlayerId, userId)),
        winConditions,
        eq(games.status, 'completed'),
        sql`${games.ratingChange} IS NOT NULL AND ${games.ratingChange} != 0`
      ));
    
    let refundedCount = 0;
    const processedMatches = new Set<string>();
    
    for (const game of wonGames) {
      if (game.matchId && !processedMatches.has(game.matchId)) {
        try {
          await this.refundGameElo(game.id);
          processedMatches.add(game.matchId);
          refundedCount++;
        } catch (e) {
          console.error(`Failed to refund game ${game.id}:`, e);
        }
      }
    }
    
    return { message: `Refunded ${refundedCount} games won by this user`, gamesRefunded: refundedCount };
  }

  // Opening Repertoire Trainer
  async getOpenings(options?: { eco?: string; search?: string; color?: string; limit?: number; offset?: number }): Promise<Opening[]> {
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;
    
    const conditions = [];
    
    if (options?.eco) {
      conditions.push(sql`${openings.eco} ILIKE ${options.eco + '%'}`);
    }
    
    if (options?.search) {
      conditions.push(sql`${openings.name} ILIKE ${'%' + options.search + '%'}`);
    }
    
    if (options?.color) {
      conditions.push(eq(openings.color, options.color));
    }
    
    let query = db.select().from(openings);
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    return query.orderBy(openings.eco, openings.name).limit(limit).offset(offset);
  }

  async getOpening(id: string): Promise<Opening | undefined> {
    const [opening] = await db.select().from(openings).where(eq(openings.id, id));
    return opening;
  }

  async getRepertoires(userId: string): Promise<Repertoire[]> {
    return db.select().from(repertoires).where(eq(repertoires.userId, userId)).orderBy(desc(repertoires.createdAt));
  }

  async getRepertoire(id: string): Promise<Repertoire | undefined> {
    const [repertoire] = await db.select().from(repertoires).where(eq(repertoires.id, id));
    return repertoire;
  }

  async createRepertoire(repertoire: InsertRepertoire): Promise<Repertoire> {
    const [created] = await db.insert(repertoires).values(repertoire).returning();
    return created;
  }

  async updateRepertoire(id: string, data: Partial<Repertoire>): Promise<Repertoire> {
    const [updated] = await db.update(repertoires).set({ ...data, updatedAt: new Date() }).where(eq(repertoires.id, id)).returning();
    return updated;
  }

  async deleteRepertoire(id: string): Promise<void> {
    await db.delete(repertoires).where(eq(repertoires.id, id));
  }

  async getRepertoireLines(repertoireId: string): Promise<RepertoireLine[]> {
    return db.select().from(repertoireLines).where(eq(repertoireLines.repertoireId, repertoireId)).orderBy(repertoireLines.moveNumber);
  }

  async getRepertoireLineByFen(repertoireId: string, fen: string): Promise<RepertoireLine | undefined> {
    const [line] = await db.select().from(repertoireLines).where(and(eq(repertoireLines.repertoireId, repertoireId), eq(repertoireLines.fen, fen)));
    return line;
  }

  async createRepertoireLine(line: InsertRepertoireLine): Promise<RepertoireLine> {
    const [created] = await db.insert(repertoireLines).values(line).returning();
    return created;
  }

  async updateRepertoireLine(id: string, data: Partial<RepertoireLine>): Promise<RepertoireLine> {
    const [updated] = await db.update(repertoireLines).set(data).where(eq(repertoireLines.id, id)).returning();
    return updated;
  }

  async deleteRepertoireLine(id: string): Promise<void> {
    await db.delete(repertoireLines).where(eq(repertoireLines.id, id));
  }

  async getPracticeHistory(userId: string, repertoireLineId?: string): Promise<PracticeHistory[]> {
    if (repertoireLineId) {
      return db.select().from(practiceHistory).where(and(eq(practiceHistory.userId, userId), eq(practiceHistory.repertoireLineId, repertoireLineId)));
    }
    return db.select().from(practiceHistory).where(eq(practiceHistory.userId, userId));
  }

  async getOrCreatePracticeHistory(userId: string, repertoireLineId: string): Promise<PracticeHistory> {
    const [existing] = await db.select().from(practiceHistory).where(and(eq(practiceHistory.userId, userId), eq(practiceHistory.repertoireLineId, repertoireLineId)));
    if (existing) return existing;
    
    const [created] = await db.insert(practiceHistory).values({ userId, repertoireLineId }).returning();
    return created;
  }

  async updatePracticeHistory(id: string, data: Partial<PracticeHistory>): Promise<PracticeHistory> {
    const [updated] = await db.update(practiceHistory).set(data).where(eq(practiceHistory.id, id)).returning();
    return updated;
  }

  async getDuePracticeLines(userId: string, repertoireId?: string, limit?: number): Promise<(PracticeHistory & { line: RepertoireLine })[]> {
    const now = new Date();
    
    const conditions = [
      eq(practiceHistory.userId, userId),
      sql`${practiceHistory.nextDue} <= ${now}`
    ];
    
    if (repertoireId) {
      conditions.push(eq(repertoireLines.repertoireId, repertoireId));
    }
    
    const results = await db
      .select({
        practiceHistory: practiceHistory,
        line: repertoireLines,
      })
      .from(practiceHistory)
      .innerJoin(repertoireLines, eq(practiceHistory.repertoireLineId, repertoireLines.id))
      .where(and(...conditions))
      .orderBy(practiceHistory.nextDue)
      .limit(limit || 20);
    
    return results.map(r => ({
      ...r.practiceHistory,
      line: r.line,
    }));
  }

  // ========== SUSPENSION SYSTEM ==========
  
  async createSuspension(suspension: InsertSuspensionHistory): Promise<SuspensionHistory> {
    const [created] = await db.insert(suspensionHistory).values(suspension).returning();
    
    // Update the user's suspendedUntil field for quick checks
    // For permanent suspensions (no endDate), use a far-future sentinel date
    const suspendedUntil = suspension.endDate || new Date('2099-12-31T23:59:59Z');
    await db.update(users).set({ suspendedUntil }).where(eq(users.id, suspension.userId));
    
    return created;
  }

  async getUserSuspensions(userId: string): Promise<SuspensionHistory[]> {
    return db.select().from(suspensionHistory)
      .where(eq(suspensionHistory.userId, userId))
      .orderBy(desc(suspensionHistory.startDate))
      .limit(50);
  }

  async getActiveSuspension(userId: string): Promise<SuspensionHistory | undefined> {
    const now = new Date();
    const [active] = await db.select().from(suspensionHistory)
      .where(and(
        eq(suspensionHistory.userId, userId),
        sql`${suspensionHistory.liftedAt} IS NULL`,
        or(
          sql`${suspensionHistory.endDate} IS NULL`, // permanent
          sql`${suspensionHistory.endDate} > ${now}` // not yet expired
        )
      ))
      .orderBy(desc(suspensionHistory.startDate))
      .limit(1);
    return active;
  }

  async hasAnySuspensionHistory(userId: string): Promise<boolean> {
    const [result] = await db.select({ count: sql<number>`count(*)::int` })
      .from(suspensionHistory)
      .where(eq(suspensionHistory.userId, userId));
    return (result?.count || 0) > 0;
  }

  async liftSuspension(suspensionId: string, liftedById: string, reason?: string): Promise<SuspensionHistory> {
    const [updated] = await db.update(suspensionHistory)
      .set({ 
        liftedById, 
        liftedAt: new Date(), 
        liftReason: reason 
      })
      .where(eq(suspensionHistory.id, suspensionId))
      .returning();
    
    if (!updated) {
      throw new Error(`Suspension with id ${suspensionId} not found`);
    }
    
    // Clear the user's suspendedUntil field
    await db.update(users).set({ suspendedUntil: null }).where(eq(users.id, updated.userId));
    
    return updated;
  }

  // ========== ADMIN NOTIFICATIONS ==========
  
  async createAdminNotification(notification: InsertAdminNotification): Promise<AdminNotification> {
    const [created] = await db.insert(adminNotifications).values(notification).returning();
    return created;
  }

  async getUnreadAdminNotifications(): Promise<AdminNotification[]> {
    return db.select().from(adminNotifications)
      .where(eq(adminNotifications.isRead, false))
      .orderBy(desc(adminNotifications.createdAt));
  }

  async getAllAdminNotifications(limit?: number): Promise<AdminNotification[]> {
    return db.select().from(adminNotifications)
      .orderBy(desc(adminNotifications.createdAt))
      .limit(limit || 50);
  }

  async markAdminNotificationRead(id: string, readById: string): Promise<AdminNotification> {
    const [updated] = await db.update(adminNotifications)
      .set({ isRead: true, readById, readAt: new Date() })
      .where(eq(adminNotifications.id, id))
      .returning();
    return updated;
  }

  async markAllAdminNotificationsRead(readById: string): Promise<void> {
    await db.update(adminNotifications)
      .set({ isRead: true, readById, readAt: new Date() })
      .where(eq(adminNotifications.isRead, false));
  }

  // ========== ADMIN GAME HISTORY ==========
  
  async getUserGameHistory(userId: string, limit?: number, offset?: number): Promise<Game[]> {
    return db.select().from(games)
      .where(or(
        eq(games.userId, userId),
        eq(games.whitePlayerId, userId),
        eq(games.blackPlayerId, userId)
      ))
      .orderBy(desc(games.createdAt))
      .limit(Math.min(limit || 50, 50))
      .offset(offset || 0);
  }

  async getUserGameCount(userId: string): Promise<number> {
    const [result] = await db.select({ count: sql<number>`count(*)::int` })
      .from(games)
      .where(or(
        eq(games.userId, userId),
        eq(games.whitePlayerId, userId),
        eq(games.blackPlayerId, userId)
      ));
    return result?.count || 0;
  }

  // ========== USER MOTIF STATS (Puzzle Pattern Tracking) ==========
  
  async updateUserMotifStats(userId: string, motifName: string, solved: boolean): Promise<UserMotifStats> {
    const existing = await this.getUserMotifStatsByName(userId, motifName);
    
    if (existing) {
      const [updated] = await db.update(userMotifStats)
        .set({
          solvedCount: solved ? (existing.solvedCount || 0) + 1 : existing.solvedCount,
          failedCount: solved ? existing.failedCount : (existing.failedCount || 0) + 1,
          updatedAt: new Date(),
        })
        .where(eq(userMotifStats.id, existing.id))
        .returning();
      return updated;
    }
    
    const [created] = await db.insert(userMotifStats)
      .values({
        userId,
        motifName,
        solvedCount: solved ? 1 : 0,
        failedCount: solved ? 0 : 1,
      })
      .returning();
    return created;
  }

  async getUserMotifStats(userId: string): Promise<UserMotifStats[]> {
    return db.select().from(userMotifStats)
      .where(eq(userMotifStats.userId, userId))
      .orderBy(desc(userMotifStats.solvedCount));
  }

  async getUserMotifStatsByName(userId: string, motifName: string): Promise<UserMotifStats | undefined> {
    const [stat] = await db.select().from(userMotifStats)
      .where(and(
        eq(userMotifStats.userId, userId),
        eq(userMotifStats.motifName, motifName)
      ));
    return stat;
  }
}

export const storage = new DatabaseStorage();
