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
  getUserQueueStatus(userId: string): Promise<MatchmakingQueue | undefined>;
  
  createMatch(match: InsertMatch): Promise<Match>;
  getMatch(id: string): Promise<Match | undefined>;
  getActiveMatchForUser(userId: string): Promise<Match | undefined>;
  updateMatchStatus(id: string, status: string): Promise<Match>;
  updateMatch(id: string, data: Partial<Match>): Promise<Match>;
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
      .where(eq(games.userId, userId))
      .orderBy(desc(games.createdAt))
      .limit(limit);
  }

  async getActiveGame(userId: string): Promise<Game | undefined> {
    const [game] = await db
      .select()
      .from(games)
      .where(and(eq(games.userId, userId), eq(games.status, 'active')))
      .orderBy(desc(games.createdAt))
      .limit(1);
    return game;
  }

  async getGamesByMode(userId: string, mode: string): Promise<Game[]> {
    return await db
      .select()
      .from(games)
      .where(and(eq(games.userId, userId), eq(games.mode, mode as any)))
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
}

export const storage = new DatabaseStorage();
