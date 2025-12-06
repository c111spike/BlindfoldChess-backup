import {
  users,
  games,
  ratings,
  puzzles,
  puzzleAttempts,
  userSettings,
  statistics,
  simulGames,
  matchmakingQueues,
  matches,
  boardSpinScores,
  nPieceChallengeProgress,
  nPieceChallengeSolutions,
  type User,
  type UpsertUser,
  type Game,
  type InsertGame,
  type Rating,
  type InsertRating,
  type Puzzle,
  type PuzzleAttempt,
  type InsertPuzzleAttempt,
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
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, ne, or, sql, inArray } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  createGame(game: InsertGame): Promise<Game>;
  getGame(id: string): Promise<Game | undefined>;
  getRecentGames(userId: string, limit?: number): Promise<Game[]>;
  getActiveGame(userId: string): Promise<Game | undefined>;
  getGamesByMode(userId: string, mode: string): Promise<Game[]>;
  updateGame(id: string, data: Partial<Game>): Promise<Game>;
  
  getRating(userId: string): Promise<Rating | undefined>;
  createRating(rating: InsertRating): Promise<Rating>;
  getOrCreateRating(userId: string): Promise<Rating>;
  updateRating(userId: string, data: Partial<Rating>): Promise<Rating>;
  
  getRandomPuzzle(): Promise<Puzzle | undefined>;
  createPuzzleAttempt(attempt: InsertPuzzleAttempt): Promise<PuzzleAttempt>;
  
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
  completeMatch(matchId: string, result: string): Promise<{ match: Match; games: Game[] }>;
  
  saveBoardSpinScore(score: InsertBoardSpinScore): Promise<BoardSpinScore>;
  getBoardSpinLeaderboard(difficulty?: string, limit?: number): Promise<(BoardSpinScore & { user: User })[]>;
  getUserBoardSpinScores(userId: string, limit?: number): Promise<BoardSpinScore[]>;
  getUserBoardSpinHighScore(userId: string, difficulty?: string): Promise<BoardSpinScore | undefined>;
  
  // N-Piece Challenge
  getNPieceProgress(userId: string, pieceType: NPieceType, boardSize: number): Promise<NPieceChallengeProgress | undefined>;
  getOrCreateNPieceProgress(userId: string, pieceType: NPieceType, boardSize: number): Promise<NPieceChallengeProgress>;
  getNPieceSolutions(progressId: string): Promise<NPieceChallengeSolution[]>;
  saveNPieceSolution(solution: InsertNPieceChallengeSolution): Promise<{ solution: NPieceChallengeSolution; isNew: boolean }>;
  getNPieceOverallProgress(userId: string): Promise<{ total: number; found: number }>;
  getUserNPieceSolutionByPositions(userId: string, pieceType: NPieceType, boardSize: number, positions: string): Promise<NPieceChallengeSolution | undefined>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
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
    const allPuzzles = await db.select().from(puzzles).limit(100);
    if (allPuzzles.length === 0) return undefined;
    const randomIndex = Math.floor(Math.random() * allPuzzles.length);
    return allPuzzles[randomIndex];
  }

  async createPuzzleAttempt(attemptData: InsertPuzzleAttempt): Promise<PuzzleAttempt> {
    const [attempt] = await db.insert(puzzleAttempts).values(attemptData).returning();
    return attempt;
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

  async completeMatch(matchId: string, result: string): Promise<{ match: Match; games: Game[] }> {
    return await db.transaction(async (tx) => {
      // Load match and validate
      const [match] = await tx.select().from(matches).where(eq(matches.id, matchId));
      if (!match) {
        throw new Error(`Match ${matchId} not found`);
      }
      if (match.status === 'completed') {
        throw new Error(`Match ${matchId} is already completed`);
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

        // Determine game result based on match result and player color
        let gameResult: string;
        if (result === 'draw') {
          gameResult = 'draw';
        } else if (result === 'white_win') {
          gameResult = game.playerColor === 'white' ? 'white_win' : 'black_win';
        } else if (result === 'black_win') {
          gameResult = game.playerColor === 'black' ? 'black_win' : 'white_win';
        } else {
          throw new Error(`Invalid result: ${result}`);
        }

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

        // Determine rating field based on time control
        let ratingField: 'bullet' | 'blitz' | 'rapid' | 'classical';
        const tc = game.timeControl || 0;
        if (tc <= 180) ratingField = 'bullet';
        else if (tc <= 600) ratingField = 'blitz';
        else if (tc <= 1200) ratingField = 'rapid';
        else ratingField = 'classical';

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
}

export const storage = new DatabaseStorage();
