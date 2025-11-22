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
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, ne, or } from "drizzle-orm";

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
  
  joinQueue(queueEntry: InsertMatchmakingQueue): Promise<MatchmakingQueue>;
  leaveQueue(userId: string, queueType: string): Promise<void>;
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
    const [game] = await db
      .select()
      .from(games)
      .where(and(
        or(
          eq(games.userId, userId),
          eq(games.whitePlayerId, userId),
          eq(games.blackPlayerId, userId)
        ),
        eq(games.status, 'active')
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
      const updatedGames: Game[] = [];
      for (const game of createdGames) {
        const [updatedGame] = await tx
          .update(games)
          .set({ matchId: match.id })
          .where(eq(games.id, game.id))
          .returning();
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
      
      for (const game of matchGames) {
        // Skip if already processed
        if (game.statsProcessed) {
          updatedGames.push(game);
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
}

export const storage = new DatabaseStorage();
