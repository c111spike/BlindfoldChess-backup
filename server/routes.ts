import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { Chess } from "chess.js";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { insertGameSchema, insertPuzzleAttemptSchema, insertUserSettingsSchema, insertPuzzleSchema, insertPuzzleVoteSchema, insertPuzzleReportSchema } from "@shared/schema";
import { createQueueManager } from "./queueManager";
import { generatePosition, calculateScore, getAllDifficulties } from "./positionGenerator";
import { generateBotMove, calculateBotThinkTime } from "./botEngine";
import { BOTS, getBotById } from "../shared/botTypes";
import type { BotPersonality, BotDifficulty } from "../shared/botTypes";
import { analysisQueueManager } from "./analysisQueueManager";
import { memoryCache, CACHE_KEYS, CACHE_TTL, invalidateCaches } from "./memoryCache";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";

const { queueManager } = createQueueManager();

export async function registerRoutes(app: Express): Promise<Server> {
  await setupAuth(app);
  
  await analysisQueueManager.init();
  
  // Register object storage routes for file uploads
  registerObjectStorageRoutes(app);
  
  // Prevent Cloudflare from caching API responses
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
  });

  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const now = new Date();
      if (!user.lastDailyReset || 
          new Date(user.lastDailyReset).toDateString() !== now.toDateString()) {
        await storage.upsertUser({
          ...user,
          dailyGamesPlayed: 0,
          dailyBlindfoldGamesPlayed: 0,
          lastDailyReset: now,
        });
        user.dailyGamesPlayed = 0;
        user.dailyBlindfoldGamesPlayed = 0;
      }
      
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.delete('/api/users/me', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Verify user exists
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Delete user and all associated data
      await storage.deleteUser(userId);
      
      // Clear session
      req.logout((err: any) => {
        if (err) {
          console.error("Error logging out after account deletion:", err);
        }
      });
      
      res.json({ message: "Account deleted successfully" });
    } catch (error) {
      console.error("Error deleting user account:", error);
      res.status(500).json({ message: "Failed to delete account" });
    }
  });

  app.get('/api/ratings', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const rating = await storage.getOrCreateRating(userId);
      res.json(rating);
    } catch (error) {
      console.error("Error fetching ratings:", error);
      res.status(500).json({ message: "Failed to fetch ratings" });
    }
  });

  app.get('/api/games/ongoing', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const activeGame = await storage.getActiveGame(userId);
      
      if (!activeGame) {
        return res.status(404).json({ message: "No ongoing game" });
      }
      
      let playerColor = activeGame.playerColor;
      if (activeGame.whitePlayerId && activeGame.blackPlayerId) {
        playerColor = activeGame.whitePlayerId === userId ? "white" : "black";
      }
      
      res.json({
        ...activeGame,
        playerColor
      });
    } catch (error) {
      console.error("Error fetching ongoing game:", error);
      res.status(500).json({ message: "Failed to fetch ongoing game" });
    }
  });

  app.get('/api/games/recent', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      const limit = user?.isPremium ? 50 : 10;
      const games = await storage.getRecentGames(userId, limit);
      
      res.json(games);
    } catch (error) {
      console.error("Error fetching recent games:", error);
      res.status(500).json({ message: "Failed to fetch games" });
    }
  });

  app.get('/api/games/history', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const mode = req.query.mode as string;
      
      const games = mode && mode !== 'all'
        ? await storage.getGamesByMode(userId, mode)
        : await storage.getRecentGames(userId, 50);
      
      res.json(games);
    } catch (error) {
      console.error("Error fetching game history:", error);
      res.status(500).json({ message: "Failed to fetch game history" });
    }
  });

  app.get('/api/games/blindfold-history', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const games = await storage.getBlindfoldGames(userId, 20);
      res.json({ games });
    } catch (error) {
      console.error("Error fetching blindfold history:", error);
      res.status(500).json({ message: "Failed to fetch blindfold history" });
    }
  });

  // Track authenticated online players
  const authenticatedUsers = new Set<string>();
  
  app.get('/api/stats/platform', async (req, res) => {
    try {
      // Use in-memory cache for expensive aggregate queries (30 second TTL)
      const cachedStats = await memoryCache.getOrFetch(
        CACHE_KEYS.GAME_STATISTICS,
        async () => {
          const [gameStats, blindfoldCount, trainingCounts, simulVsSimulCount] = await Promise.all([
            storage.getGameStatistics(),
            storage.getBlindfoldGameCount(),
            storage.getTrainingChallengesCounts(),
            storage.getCompletedSimulVsSimulPairingCount()
          ]);
          
          // Convert array to object with mode as key
          const statsByMode: Record<string, number> = {};
          for (const stat of gameStats) {
            statsByMode[stat.mode] = stat.count;
          }
          
          return {
            totalGames: {
              simulVsSimul: simulVsSimulCount,
              otb: statsByMode['otb'] || 0,
              standard: statsByMode['standard'] || 0,
              blindfold: blindfoldCount,
            },
            trainingChallenges: {
              boardSpin: trainingCounts.boardSpin,
              nPiece: trainingCounts.nPiece,
              knightsTour: trainingCounts.knightsTour,
            }
          };
        },
        CACHE_TTL.STATISTICS
      );
      
      res.json({
        onlinePlayers: authenticatedUsers.size,
        ...cachedStats,
      });
    } catch (error) {
      console.error("Error fetching platform stats:", error);
      res.status(500).json({ message: "Failed to fetch platform stats" });
    }
  });

  app.post('/api/games', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const gameData = insertGameSchema.parse({
        ...req.body,
        userId,
      });
      
      const game = await storage.createGame(gameData);
      
      res.json(game);
    } catch (error) {
      console.error("Error creating game:", error);
      res.status(500).json({ message: "Failed to create game" });
    }
  });

  app.patch('/api/games/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      
      console.log('[PATCH /api/games/:id] START - gameId:', id, 'userId:', userId, 'body:', JSON.stringify(req.body));
      
      const game = await storage.getGame(id);
      if (!game) {
        return res.status(404).json({ message: "Game not found" });
      }
      
      console.log('[PATCH /api/games/:id] Found game - matchId:', game.matchId, 'result:', game.result);
      
      const isAuthorized = game.userId === userId || 
                           game.whitePlayerId === userId || 
                           game.blackPlayerId === userId;
      
      if (!isAuthorized) {
        return res.status(404).json({ message: "Game not found" });
      }
      
      const updatedGame = await storage.updateGame(id, req.body);
      
      console.log('[PATCH /api/games/:id] Game updated successfully');
      
      // Auto-start analysis when a game completes (has a final result)
      const finalResults = ['white_win', 'black_win', 'draw', 'stalemate', 'timeout', 'resignation'];
      const isGameComplete = req.body.status === 'completed' || 
                             (req.body.result && finalResults.includes(req.body.result));
      
      if (isGameComplete && updatedGame.moves && Array.isArray(updatedGame.moves) && updatedGame.moves.length > 0) {
        // Start analysis in background (don't await - fire and forget)
        const { analyzeGame } = await import('./analysisService');
        console.log('[PATCH /api/games/:id] Auto-starting analysis for completed game');
        analyzeGame(id, userId).catch(err => {
          console.error('[PATCH /api/games/:id] Auto-analysis failed:', err);
        });
      }
      
      // If the game is being marked as completed and has a matchId, also update the match
      if (req.body.status === 'completed' && game.matchId) {
        console.log('[PATCH /api/games/:id] Game completed, updating match status');
        
        const match = await storage.getMatch(game.matchId);
        if (match && match.status !== 'completed') {
          // Update match to completed
          await storage.updateMatch(game.matchId, { status: 'completed' });
          console.log('[PATCH /api/games/:id] Match updated to completed');
          
          // Clean up queue entries for both players
          if (match.player1Id) {
            await storage.leaveAllQueues(match.player1Id);
          }
          if (match.player2Id) {
            await storage.leaveAllQueues(match.player2Id);
          }
          console.log('[PATCH /api/games/:id] Queue entries cleaned up');
        }
      }
      
      // Invalidate caches when a game is completed (ratings change)
      if (isGameComplete) {
        invalidateCaches.gameComplete();
      }
      
      res.json(updatedGame);
    } catch (error) {
      console.error("Error updating game:", error);
      res.status(500).json({ message: "Failed to update game" });
    }
  });

  app.post('/api/queue/join', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { timeControl, queueType } = req.body;
      
      // Check if user is banned or suspended (suspended users can still play bots and training modes)
      const userRecord = await storage.getUser(userId);
      if (userRecord?.isBanned) {
        return res.status(403).json({ message: "Your account has been banned. You cannot join games." });
      }
      if (userRecord?.suspendedUntil && new Date(userRecord.suspendedUntil) > new Date()) {
        const suspendedUntil = new Date(userRecord.suspendedUntil).toLocaleDateString();
        return res.status(403).json({ 
          message: `Your account is suspended until ${suspendedUntil}. You cannot play against other players, but you can still play against bots and use all training modes.`,
          suspendedUntil: userRecord.suspendedUntil,
          isSoftSuspension: true
        });
      }

      // Extract time control from queueType if provided (e.g., 'otb_blitz' -> 'blitz')
      let effectiveTimeControl = timeControl;
      if (!effectiveTimeControl && queueType) {
        const parts = queueType.split('_');
        effectiveTimeControl = parts[parts.length - 1]; // Get last part (blitz, rapid, etc.)
      }

      if (!['bullet', 'blitz', 'rapid', 'classical'].includes(effectiveTimeControl)) {
        return res.status(400).json({ message: "Invalid time control" });
      }

      const rating = await storage.getOrCreateRating(userId);
      const effectiveQueueType = queueType || `standard_${effectiveTimeControl}`;
      const isOtbQueue = effectiveQueueType.startsWith('otb_');
      
      // Use OTB rating pools for OTB queues, standard pools otherwise
      const getRatingForTimeControl = (tc: string): number => {
        if (isOtbQueue) {
          // OTB uses otbBullet, otbBlitz, otbRapid, otbClassical
          if (tc === 'bullet') return rating.otbBullet;
          if (tc === 'blitz') return rating.otbBlitz;
          if (tc === 'rapid') return rating.otbRapid;
          if (tc === 'classical') return rating.otbClassical;
        } else {
          // Standard uses bullet, blitz, rapid, classical
          if (tc === 'bullet') return rating.bullet;
          if (tc === 'blitz') return rating.blitz;
          if (tc === 'rapid') return rating.rapid;
          if (tc === 'classical') return rating.classical;
        }
        return 1200;
      };

      const currentRating = getRatingForTimeControl(effectiveTimeControl);
      
      // Calculate rating range for matchmaking (±300 Elo)
      const getRatingRange = (rating: number): string => {
        const lower = Math.max(0, rating - 300);
        const upper = rating + 300;
        return `${lower}-${upper}`;
      };
      
      // Actually add user to the matchmaking queue in the database
      await storage.joinQueue({
        userId,
        queueType: effectiveQueueType,
        ratingRange: getRatingRange(currentRating),
      });
      
      res.json({
        success: true,
        timeControl: effectiveTimeControl,
        queueType: effectiveQueueType,
        position: 1,
        message: "Joined queue successfully"
      });
    } catch (error) {
      console.error("Error joining queue:", error);
      res.status(500).json({ message: "Failed to join queue" });
    }
  });

  app.post('/api/queue/leave', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { queueType } = req.body;
      
      if (queueType) {
        await storage.leaveQueue(userId, queueType);
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error leaving queue:", error);
      res.status(500).json({ message: "Failed to leave queue" });
    }
  });

  app.get('/api/queue/status', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const status = queueManager.getStatus(userId);
      const counts = queueManager.getQueueCounts();

      res.json({
        ...status,
        counts
      });
    } catch (error) {
      console.error("Error fetching queue status:", error);
      res.status(500).json({ message: "Failed to fetch queue status" });
    }
  });

  // ============ SIMUL VS SIMUL ROUTES ============
  
  // Matchmaking mutex using a queue pattern to prevent race conditions
  class Mutex {
    private locked = false;
    private waiting: (() => void)[] = [];
    
    async acquire(): Promise<void> {
      if (!this.locked) {
        this.locked = true;
        return;
      }
      
      return new Promise<void>((resolve) => {
        this.waiting.push(resolve);
      });
    }
    
    release(): void {
      if (this.waiting.length > 0) {
        const next = this.waiting.shift()!;
        next();
      } else {
        this.locked = false;
      }
    }
  }
  
  // One mutex per board count to serialize matchmaking
  const simulMatchmakingMutexes = new Map<number, Mutex>();
  
  function getMutex(boardCount: number): Mutex {
    if (!simulMatchmakingMutexes.has(boardCount)) {
      simulMatchmakingMutexes.set(boardCount, new Mutex());
    }
    return simulMatchmakingMutexes.get(boardCount)!;
  }
  
  async function withMatchmakingLock<T>(boardCount: number, fn: () => Promise<T>): Promise<T> {
    const mutex = getMutex(boardCount);
    await mutex.acquire();
    
    try {
      return await fn();
    } finally {
      mutex.release();
    }
  }
  
  // Queue timeout manager - auto-fills with bots after 60 seconds
  const QUEUE_TIMEOUT_MS = 60000; // 60 seconds
  const queueTimeoutTimers = new Map<number, NodeJS.Timeout>();
  
  async function checkQueueTimeout(boardCount: number) {
    try {
      await withMatchmakingLock(boardCount, async () => {
        const oldest = await storage.getOldestSimulVsSimulQueueEntry(boardCount);
        if (!oldest || !oldest.joinedAt) {
          // No players in queue, clear timer
          const existingTimer = queueTimeoutTimers.get(boardCount);
          if (existingTimer) {
            clearTimeout(existingTimer);
            queueTimeoutTimers.delete(boardCount);
          }
          return;
        }
        
        const waitTime = Date.now() - new Date(oldest.joinedAt).getTime();
        if (waitTime < QUEUE_TIMEOUT_MS) {
          // Not timed out yet, reschedule
          const remainingTime = QUEUE_TIMEOUT_MS - waitTime;
          scheduleQueueTimeout(boardCount, remainingTime);
          return;
        }
        
        // Timeout reached - auto-fill with bots
        console.log(`[SimulVsSimul] Queue timeout for ${boardCount} boards - auto-filling with bots`);
        
        // Clear timer first to prevent re-firing
        queueTimeoutTimers.delete(boardCount);
        
        const queuePlayers = await storage.getSimulVsSimulQueuePlayers(boardCount);
        if (queuePlayers.length === 0) {
          console.log(`[SimulVsSimul] Queue empty, skipping bot fill`);
          return;
        }
        
        const requiredPlayers = boardCount + 1;
        const botsNeeded = requiredPlayers - queuePlayers.length;
        
        if (botsNeeded > 0) {
          // Get average rating for bot selection
          const avgRating = await storage.getSimulVsSimulQueueAverageRating(boardCount);
          
          // Bot difficulty levels with their Elo ratings (sorted ascending)
          const botLevels = [
            { difficulty: 'beginner', elo: 400 },
            { difficulty: 'novice', elo: 600 },
            { difficulty: 'intermediate', elo: 900 },
            { difficulty: 'club', elo: 1200 },
            { difficulty: 'advanced', elo: 1500 },
            { difficulty: 'expert', elo: 1800 },
            { difficulty: 'master', elo: 2000 },
            { difficulty: 'grandmaster', elo: 2500 },
          ];
          
          // Find bot difficulty using weighted random selection based on distance
          // Closer bot level has higher probability of being selected
          const selectBotDifficulty = (avg: number): { difficulty: string; elo: number } => {
            // Find the two adjacent bot levels (lower and upper)
            let lowerLevel = botLevels[0];
            let upperLevel = botLevels[botLevels.length - 1];
            
            // Find the highest bot level that is <= average
            let lowerIndex = 0;
            for (let i = 0; i < botLevels.length; i++) {
              if (botLevels[i].elo <= avg) {
                lowerLevel = botLevels[i];
                lowerIndex = i;
              } else {
                break;
              }
            }
            
            // If average is below lowest bot level, just return lowest
            if (avg <= botLevels[0].elo) {
              return botLevels[0];
            }
            
            // If average is at or above highest bot level, return highest
            if (avg >= botLevels[botLevels.length - 1].elo) {
              return botLevels[botLevels.length - 1];
            }
            
            // Get the next level up
            upperLevel = botLevels[lowerIndex + 1];
            
            // Calculate distances
            const distanceToLower = avg - lowerLevel.elo;
            const distanceToUpper = upperLevel.elo - avg;
            const totalDistance = distanceToLower + distanceToUpper;
            
            // Weighted probability: closer bot gets higher chance
            // Weight for lower = distance to upper (inverse relationship)
            // Weight for upper = distance to lower (inverse relationship)
            const chanceForLower = distanceToUpper / totalDistance;
            const chanceForUpper = distanceToLower / totalDistance;
            
            // Random selection based on weighted probability
            const roll = Math.random();
            const selectedLevel = roll < chanceForLower ? lowerLevel : upperLevel;
            
            console.log(`[SimulVsSimul] Weighted selection: avg=${avg}, lower=${lowerLevel.difficulty}(${lowerLevel.elo}), upper=${upperLevel.difficulty}(${upperLevel.elo}), chanceForLower=${(chanceForLower * 100).toFixed(1)}%, roll=${roll.toFixed(3)}, selected=${selectedLevel.difficulty}`);
            
            return selectedLevel;
          };
          
          const selectedBot = selectBotDifficulty(avgRating);
          const difficulty = selectedBot.difficulty;
          const botElo = selectedBot.elo;
          
          console.log(`[SimulVsSimul] Average rating: ${avgRating}, Selected bot: ${difficulty} (${botElo} Elo)`);
          
          // All 7 bot personalities for shuffle-without-replacement
          const allPersonalities = ['balanced', 'tactical', 'positional', 'aggressive', 'defensive', 'bishop_lover', 'knight_lover'];
          
          // Fisher-Yates shuffle function
          const shuffleArray = <T>(array: T[]): T[] => {
            const shuffled = [...array];
            for (let i = shuffled.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
            return shuffled;
          };
          
          // Generate shuffled personalities for the number of bots needed
          // Uses shuffle-without-replacement, reshuffling after all 7 are used
          const getShuffledPersonalities = (count: number): string[] => {
            const result: string[] = [];
            let shuffledPool: string[] = [];
            
            for (let i = 0; i < count; i++) {
              if (shuffledPool.length === 0) {
                shuffledPool = shuffleArray(allPersonalities);
              }
              result.push(shuffledPool.pop()!);
            }
            
            return result;
          };
          
          const botPersonalities = getShuffledPersonalities(botsNeeded);
          
          const playersForMatch: Array<{ odId: string; isBot: boolean; rating: number; botId?: string; botPersonality?: string }> = [];
          
          // Add human players
          for (const player of queuePlayers) {
            playersForMatch.push({
              odId: player.odId,
              isBot: false,
              rating: player.rating || 1000,
            });
          }
          
          // Add bots with shuffled personalities
          for (let i = 0; i < botsNeeded; i++) {
            const personality = botPersonalities[i];
            const botId = `bot_${personality}_${difficulty}`;
            playersForMatch.push({
              odId: `${botId}_${i}`, // Unique odId for each bot
              isBot: true,
              rating: botElo,
              botId,
              botPersonality: personality,
            });
          }
          
          console.log(`[SimulVsSimul] Bot personalities selected: ${botPersonalities.join(', ')}`);
          
          // Create the match
          await createSimulVsSimulMatch(playersForMatch, boardCount);
        }
      });
    } catch (error) {
      console.error('[SimulVsSimul] Queue timeout check error:', error);
    }
  }
  
  function scheduleQueueTimeout(boardCount: number, delayMs: number = QUEUE_TIMEOUT_MS) {
    const existingTimer = queueTimeoutTimers.get(boardCount);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }
    
    const timer = setTimeout(() => {
      checkQueueTimeout(boardCount);
    }, delayMs);
    
    queueTimeoutTimers.set(boardCount, timer);
    console.log(`[SimulVsSimul] Queue timeout scheduled for ${boardCount} boards in ${delayMs}ms`);
  }

  // Join Simul vs Simul queue
  app.post('/api/simul-vs-simul/queue/join', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { boardCount = 5 } = req.body;

      // Check if user is banned or suspended (suspended users cannot play human vs human)
      const userRecord = await storage.getUser(userId);
      if (userRecord?.isBanned) {
        return res.status(403).json({ message: "Your account has been banned. You cannot join games." });
      }
      if (userRecord?.suspendedUntil && new Date(userRecord.suspendedUntil) > new Date()) {
        const suspendedUntil = new Date(userRecord.suspendedUntil).toLocaleDateString();
        return res.status(403).json({ 
          message: `Your account is suspended until ${suspendedUntil}. You cannot play against other players, but you can still play against bots and use all training modes.`,
          suspendedUntil: userRecord.suspendedUntil,
          isSoftSuspension: true
        });
      }

      // Check if already in an active match
      const existingMatch = await storage.getActiveSimulVsSimulMatchForUser(userId);
      if (existingMatch) {
        return res.json({
          success: true,
          inMatch: true,
          matchId: existingMatch.id,
          message: "Already in an active match"
        });
      }

      // Use atomic lock for matchmaking to prevent race conditions
      const result = await withMatchmakingLock(boardCount, async () => {
        // Get user's simul rating
        const rating = await storage.getOrCreateRating(userId);
        const simulRating = rating.simul || 1000;

        // Re-check queue status under lock (another request may have already created a match)
        const currentQueueStatus = await storage.getSimulVsSimulQueueStatus(userId);
        if (!currentQueueStatus) {
          // Join the queue
          await storage.joinSimulVsSimulQueue(userId, boardCount, simulRating);
        }

        // Check if we have enough players to start a match
        const queuePlayers = await storage.getSimulVsSimulQueuePlayers(boardCount);
        const requiredPlayers = boardCount + 1; // N boards = N+1 players

        if (queuePlayers.length >= requiredPlayers) {
          // We have enough players! Create the match atomically
          const playersForMatch = queuePlayers.slice(0, requiredPlayers);
          const match = await createSimulVsSimulMatch(playersForMatch, boardCount);
          
          return {
            success: true,
            matchFound: true,
            matchId: match.id,
            message: "Match found!"
          };
        }

        // Not enough players yet - schedule timeout for bot auto-fill
        if (!queueTimeoutTimers.has(boardCount)) {
          scheduleQueueTimeout(boardCount);
        }
        
        // Return queue status
        return {
          success: true,
          inQueue: true,
          position: queuePlayers.findIndex(p => p.odId === userId) + 1,
          playersInQueue: queuePlayers.length,
          playersNeeded: requiredPlayers,
          boardCount,
          message: `Waiting for ${requiredPlayers - queuePlayers.length} more player(s)`
        };
      });
      
      res.json(result);
    } catch (error) {
      console.error("Error joining simul vs simul queue:", error);
      res.status(500).json({ message: "Failed to join queue" });
    }
  });

  // Leave Simul vs Simul queue
  app.post('/api/simul-vs-simul/queue/leave', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await storage.leaveSimulVsSimulQueue(userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error leaving simul vs simul queue:", error);
      res.status(500).json({ message: "Failed to leave queue" });
    }
  });

  // Abandon active Simul vs Simul match (for stuck matches)
  app.post('/api/simul-vs-simul/match/abandon', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      const existingMatch = await storage.getActiveSimulVsSimulMatchForUser(userId);
      if (!existingMatch) {
        return res.json({ success: true, message: "No active match to abandon" });
      }
      
      // Mark the match as completed (abandoned)
      await storage.updateSimulVsSimulMatch(existingMatch.id, {
        status: 'completed',
        completedAt: new Date(),
      });
      
      // Clean up in-memory state
      const allPairings = await storage.getAllSimulVsSimulPairings(existingMatch.id);
      cleanupSimulMatch(existingMatch.id, allPairings.map(p => p.id));
      
      console.log(`[SimulMatch] User ${userId} abandoned match ${existingMatch.id}`);
      res.json({ success: true, message: "Match abandoned successfully" });
    } catch (error) {
      console.error("Error abandoning simul vs simul match:", error);
      res.status(500).json({ message: "Failed to abandon match" });
    }
  });

  // Get Simul vs Simul queue status
  app.get('/api/simul-vs-simul/queue/status', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const boardCount = parseInt(req.query.boardCount as string) || 5;

      // Check if in active match
      const existingMatch = await storage.getActiveSimulVsSimulMatchForUser(userId);
      if (existingMatch) {
        return res.json({
          inMatch: true,
          matchId: existingMatch.id,
          status: existingMatch.status
        });
      }

      // Check queue status
      const queueStatus = await storage.getSimulVsSimulQueueStatus(userId);
      if (queueStatus) {
        const queuePlayers = await storage.getSimulVsSimulQueuePlayers(queueStatus.boardCount || 5);
        const requiredPlayers = (queueStatus.boardCount || 5) + 1;
        return res.json({
          inQueue: true,
          position: queuePlayers.findIndex(p => p.odId === userId) + 1,
          playersInQueue: queuePlayers.length,
          playersNeeded: requiredPlayers,
          boardCount: queueStatus.boardCount
        });
      }

      res.json({ inQueue: false, inMatch: false });
    } catch (error) {
      console.error("Error fetching simul vs simul queue status:", error);
      res.status(500).json({ message: "Failed to fetch queue status" });
    }
  });

  // Get match data
  app.get('/api/simul-vs-simul/match/:matchId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { matchId } = req.params;

      const match = await storage.getSimulVsSimulMatch(matchId);
      if (!match) {
        return res.status(404).json({ message: "Match not found" });
      }

      const players = await storage.getSimulVsSimulMatchPlayers(matchId);
      const playerGames = await storage.getSimulVsSimulPlayerGames(matchId, userId);

      // Get player's board assignments
      const boards = playerGames.map(pairing => {
        const isWhite = pairing.whitePlayerId === userId || (pairing.whiteIsBot && !pairing.blackIsBot);
        const opponentPlayer = players.find(p => 
          isWhite ? (p.odId === pairing.blackPlayerId || (pairing.blackIsBot && p.isBot && p.botId === pairing.blackBotId)) 
                  : (p.odId === pairing.whitePlayerId || (pairing.whiteIsBot && p.isBot && p.botId === pairing.whiteBotId))
        );

        return {
          pairingId: pairing.id,
          boardNumber: isWhite ? pairing.boardNumberWhite : pairing.boardNumberBlack,
          color: isWhite ? 'white' : 'black',
          opponentName: opponentPlayer?.isBot 
            ? `Bot (${opponentPlayer.botPersonality})` 
            : 'Opponent',
          opponentId: isWhite ? pairing.blackPlayerId : pairing.whitePlayerId,
          isOpponentBot: isWhite ? pairing.blackIsBot : pairing.whiteIsBot,
          fen: pairing.fen,
          moves: pairing.moves,
          moveCount: pairing.moveCount,
          activeColor: pairing.activeColor,
          result: pairing.result,
          timeRemaining: isWhite ? pairing.whiteTimeRemaining : pairing.blackTimeRemaining,
        };
      }).sort((a, b) => a.boardNumber - b.boardNumber);

      res.json({
        matchId: match.id,
        status: match.status,
        boardCount: match.boardCount,
        playerCount: match.playerCount,
        boards,
        createdAt: match.createdAt,
        startedAt: match.startedAt,
      });
    } catch (error) {
      console.error("Error fetching simul vs simul match:", error);
      res.status(500).json({ message: "Failed to fetch match data" });
    }
  });

  // Make a move in a Simul vs Simul game
  app.post('/api/simul-vs-simul/move', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { pairingId, move, fen } = req.body;

      const pairing = await storage.getSimulVsSimulPairing(pairingId);
      if (!pairing) {
        return res.status(404).json({ message: "Game not found" });
      }

      // Verify it's the player's turn
      const isWhite = pairing.whitePlayerId === userId;
      const isBlack = pairing.blackPlayerId === userId;
      if (!isWhite && !isBlack) {
        return res.status(403).json({ message: "Not your game" });
      }

      const playerColor = isWhite ? 'white' : 'black';
      if (pairing.activeColor !== playerColor) {
        return res.status(400).json({ message: "Not your turn" });
      }

      // Update the pairing
      const newMoves = [...(pairing.moves || []), move];
      const newActiveColor = playerColor === 'white' ? 'black' : 'white';
      
      const updated = await storage.updateSimulVsSimulPairing(pairingId, {
        fen,
        moves: newMoves,
        moveCount: newMoves.length,
        activeColor: newActiveColor,
        lastMoveAt: new Date(),
        whiteTimeRemaining: 30, // Reset timer
        blackTimeRemaining: 30, // Reset timer
      });

      res.json({
        success: true,
        pairing: updated,
      });
    } catch (error) {
      console.error("Error making simul vs simul move:", error);
      res.status(500).json({ message: "Failed to make move" });
    }
  });

  // End a Simul vs Simul game
  app.post('/api/simul-vs-simul/game/end', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { pairingId, result } = req.body;

      const pairing = await storage.getSimulVsSimulPairing(pairingId);
      if (!pairing) {
        return res.status(404).json({ message: "Game not found" });
      }

      await storage.updateSimulVsSimulPairing(pairingId, {
        result,
        completedAt: new Date(),
      });

      // Check if all games in the match are complete
      const allPairings = await storage.getAllSimulVsSimulPairings(pairing.matchId);
      const allComplete = allPairings.every(p => p.result !== 'ongoing');

      if (allComplete) {
        await storage.updateSimulVsSimulMatch(pairing.matchId, {
          status: 'completed',
          completedAt: new Date(),
        });
        
        // Clean up match resources (timers, rooms, focus state)
        cleanupSimulMatch(pairing.matchId, allPairings.map(p => p.id));
      }

      res.json({ success: true, matchComplete: allComplete });
    } catch (error) {
      console.error("Error ending simul vs simul game:", error);
      res.status(500).json({ message: "Failed to end game" });
    }
  });

  // Get match review data (for post-match analysis navigation)
  app.get('/api/simul-vs-simul/match/:matchId/review', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { matchId } = req.params;

      const match = await storage.getSimulVsSimulMatch(matchId);
      if (!match) {
        return res.status(404).json({ message: "Match not found" });
      }

      const players = await storage.getSimulVsSimulMatchPlayers(matchId);
      const playerGames = await storage.getSimulVsSimulPlayerGames(matchId, userId);
      const user = await storage.getUser(userId);

      // Get player's board assignments with all data needed for review
      const boards = playerGames.map(pairing => {
        const isWhite = pairing.whitePlayerId === userId || (pairing.whiteIsBot && !pairing.blackIsBot);
        const opponentPlayer = players.find(p => 
          isWhite ? (p.odId === pairing.blackPlayerId || (pairing.blackIsBot && p.isBot && p.botId === pairing.blackBotId)) 
                  : (p.odId === pairing.whitePlayerId || (pairing.whiteIsBot && p.isBot && p.botId === pairing.whiteBotId))
        );

        return {
          pairingId: pairing.id,
          gameId: pairing.gameId,
          boardNumber: isWhite ? pairing.boardNumberWhite : pairing.boardNumberBlack,
          color: isWhite ? 'white' : 'black',
          opponentName: opponentPlayer?.isBot 
            ? `Bot (${opponentPlayer.botPersonality})` 
            : 'Opponent',
          opponentId: isWhite ? pairing.blackPlayerId : pairing.whitePlayerId,
          isOpponentBot: isWhite ? pairing.blackIsBot : pairing.whiteIsBot,
          fen: pairing.fen,
          moves: pairing.moves,
          moveCount: pairing.moveCount,
          result: pairing.result,
        };
      }).sort((a, b) => a.boardNumber - b.boardNumber);

      // Calculate score summary
      let wins = 0, losses = 0, draws = 0;
      for (const board of boards) {
        if (board.result === 'draw') {
          draws++;
        } else if (
          (board.result === 'white_win' && board.color === 'white') ||
          (board.result === 'black_win' && board.color === 'black')
        ) {
          wins++;
        } else if (board.result !== 'ongoing') {
          losses++;
        }
      }

      res.json({
        matchId: match.id,
        status: match.status,
        boardCount: match.boardCount,
        playerCount: match.playerCount,
        boards,
        score: { wins, losses, draws },
        playerName: user?.username || user?.firstName || 'You',
        createdAt: match.createdAt,
        completedAt: match.completedAt,
      });
    } catch (error) {
      console.error("Error fetching simul vs simul match review:", error);
      res.status(500).json({ message: "Failed to fetch match review data" });
    }
  });

  // Helper function to create a Simul vs Simul match
  async function createSimulVsSimulMatch(queuePlayers: any[], boardCount: number) {
    const playerCount = boardCount + 1;
    
    // Create the match
    const match = await storage.createSimulVsSimulMatch(boardCount);
    
    // Add players to the match (humans and bots)
    const players = [];
    for (let i = 0; i < queuePlayers.length; i++) {
      const qp = queuePlayers[i];
      const isBot = qp.isBot === true;
      const player = await storage.addPlayerToSimulVsSimulMatch(
        match.id,
        isBot ? null : qp.odId,
        i + 1, // seat 1-6+
        isBot,
        qp.botId,
        qp.botPersonality
      );
      players.push({ 
        ...player, 
        odId: qp.odId,
        isBot: isBot,
        botId: qp.botId,
        botPersonality: qp.botPersonality,
      });
    }

    // Create all pairings (each player plays every other player)
    // For N+1 players, each player plays N games
    const pairings = [];
    let boardNumberCounters: Record<string, number> = {};
    
    // Initialize board counters for each player
    players.forEach(p => {
      boardNumberCounters[p.odId] = 1;
    });

    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        // Skip bot-vs-bot matchups - bots are just fillers for humans
        if (players[i].isBot && players[j].isBot) {
          continue;
        }
        
        // Randomly assign colors
        const whiteIsFirst = Math.random() < 0.5;
        const whitePlayer = whiteIsFirst ? players[i] : players[j];
        const blackPlayer = whiteIsFirst ? players[j] : players[i];

        const pairing = await storage.createSimulVsSimulPairing({
          matchId: match.id,
          whitePlayerId: whitePlayer.isBot ? null : whitePlayer.odId,
          blackPlayerId: blackPlayer.isBot ? null : blackPlayer.odId,
          whiteIsBot: whitePlayer.isBot || false,
          blackIsBot: blackPlayer.isBot || false,
          whiteBotId: whitePlayer.botId,
          blackBotId: blackPlayer.botId,
          boardNumberWhite: boardNumberCounters[whitePlayer.odId]++,
          boardNumberBlack: boardNumberCounters[blackPlayer.odId]++,
        });
        pairings.push(pairing);
      }
    }

    // Log pairing creation summary
    const humanCount = players.filter(p => !p.isBot).length;
    const botCount = players.filter(p => p.isBot).length;
    console.log(`[SimulVsSimul] Created ${pairings.length} pairings for match ${match.id} (${humanCount} humans, ${botCount} bots)`);

    // Clear matched human players from queue (not bots)
    const humanUserIds = queuePlayers.filter(p => !p.isBot).map(p => p.odId);
    if (humanUserIds.length > 0) {
      await storage.clearSimulVsSimulQueue(boardCount, humanUserIds);
    }

    // Update match status to in_progress
    await storage.updateSimulVsSimulMatch(match.id, {
      status: 'in_progress',
      startedAt: new Date(),
    });

    return match;
  }

  // ============ END SIMUL VS SIMUL ROUTES ============

  app.post('/api/queue/findMatch', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { queueType } = req.body;

      const existingMatch = await storage.getActiveMatchForUser(userId);
      if (existingMatch) {
        const userGames = [];
        for (const gameId of existingMatch.gameIds) {
          const game = await storage.getGame(gameId);
          if (game && game.userId === userId) {
            userGames.push(game);
          }
        }

        const isSimul = existingMatch.matchType.startsWith('simul_');
        const opponentId = existingMatch.player1Id === userId ? existingMatch.player2Id : existingMatch.player1Id;
        
        const opponent = await storage.getUser(opponentId);
        const opponentName = `${opponent?.firstName || 'Opponent'} ${opponent?.lastName || ''}`.trim();
        
        // Determine rating category based on match type
        // For OTB matches use otbBlitz/otbRapid etc; for standard use blitz/rapid etc
        // For simul/blindfold, use their dedicated pools
        let ratingCategory: string;
        if (existingMatch.matchType.startsWith('simul_')) {
          ratingCategory = 'simul';
        } else if (existingMatch.matchType === 'blindfold') {
          ratingCategory = 'blindfold';
        } else {
          const isOtbMatch = existingMatch.matchType.startsWith('otb_');
          const baseTimeControl = existingMatch.matchType.includes('bullet') ? 'bullet' : 
                                existingMatch.matchType.includes('blitz') ? 'blitz' : 
                                existingMatch.matchType.includes('rapid') ? 'rapid' : 
                                existingMatch.matchType.includes('classical') ? 'classical' : 'blitz';
          ratingCategory = isOtbMatch 
            ? `otb${baseTimeControl.charAt(0).toUpperCase()}${baseTimeControl.slice(1)}` // e.g., 'otbBlitz'
            : baseTimeControl;
        }
        const playerRatingsData = await storage.getRating(userId);
        const opponentRatingsData = await storage.getRating(opponentId);
        const playerRating = (playerRatingsData as any)?.[ratingCategory] || 1200;
        const opponentRating = (opponentRatingsData as any)?.[ratingCategory] || 1200;

        return res.json({
          matchId: existingMatch.id,
          matched: true,
          games: isSimul ? userGames : undefined,
          game: !isSimul && userGames.length > 0 ? userGames[0] : undefined,
          boardCount: isSimul ? userGames.length : undefined,
          opponentId,
          opponent: { id: opponentId, name: opponentName, rating: opponentRating },
          playerRating,
        });
      }

      const timeMap: Record<string, number> = {
        'otb_bullet': 1,
        'otb_blitz': 5,
        'otb_rapid': 15,
        'otb_classical': 30,
        'standard_bullet': 1,
        'standard_blitz': 5,
        'standard_rapid': 15,
        'standard_classical': 30,
        'simul_2': 0.5,
        'simul_3': 0.5,
        'simul_4': 0.5,
        'simul_5': 0.5,
        'simul_6': 0.5,
        'simul_7': 0.5,
        'simul_8': 0.5,
        'simul_9': 0.5,
        'simul_10': 0.5,
        'blindfold': 5,
      };

      const timeControl = timeMap[queueType] || 5;
      const isSimul = queueType.startsWith('simul_');
      const boardCount = isSimul ? parseInt(queueType.split('_')[1]) : 1;

      const player1Color = Math.random() > 0.5 ? "white" : "black";
      const player2Color = player1Color === "white" ? "black" : "white";

      const player1GameTemplates: Partial<InsertGame>[] = [];
      const player2GameTemplates: Partial<InsertGame>[] = [];

      if (isSimul && boardCount >= 2 && boardCount <= 10) {
        for (let i = 0; i < boardCount; i++) {
          player1GameTemplates.push({
            mode: queueType,
            playerColor: player1Color,
            timeControl,
            increment: 0,
            fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
            moves: [],
            whiteTime: 30,
            blackTime: 30,
            boardCount,
          });

          player2GameTemplates.push({
            mode: queueType,
            playerColor: player2Color,
            timeControl,
            increment: 0,
            fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
            moves: [],
            whiteTime: 30,
            blackTime: 30,
            boardCount,
          });
        }
      } else {
        player1GameTemplates.push({
          mode: queueType,
          playerColor: player1Color,
          timeControl,
          increment: 0,
          fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
          moves: [],
          whiteTime: timeControl * 60,
          blackTime: timeControl * 60,
        });

        player2GameTemplates.push({
          mode: queueType,
          playerColor: player2Color,
          timeControl,
          increment: 0,
          fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
          moves: [],
          whiteTime: timeControl * 60,
          blackTime: timeControl * 60,
        });
      }

      const result = await storage.atomicMatchPairing(userId, queueType, {
        matchType: queueType,
        gameIds: [],
        status: 'in_progress',
      }, player1GameTemplates, player2GameTemplates);

      if (!result) {
        return res.json({ matched: false });
      }

      const { match, games } = result;
      const userGames = games.filter(g => g.userId === userId);
      
      const opponentId = match.player1Id === userId ? match.player2Id : match.player1Id;
      const opponent = await storage.getUser(opponentId);
      const opponentName = `${opponent?.firstName || 'Opponent'} ${opponent?.lastName || ''}`.trim();
      
      // Determine rating category based on queue type
      // For OTB matches use otbBlitz/otbRapid etc; for standard use blitz/rapid etc
      // For simul/blindfold, use their dedicated pools
      let ratingCategory: string;
      if (queueType.startsWith('simul_')) {
        ratingCategory = 'simul';
      } else if (queueType === 'blindfold') {
        ratingCategory = 'blindfold';
      } else {
        const isOtbMatch = queueType.startsWith('otb_');
        const baseTimeControl = queueType.includes('bullet') ? 'bullet' : 
                              queueType.includes('blitz') ? 'blitz' : 
                              queueType.includes('rapid') ? 'rapid' : 
                              queueType.includes('classical') ? 'classical' : 'blitz';
        ratingCategory = isOtbMatch 
          ? `otb${baseTimeControl.charAt(0).toUpperCase()}${baseTimeControl.slice(1)}` // e.g., 'otbBlitz'
          : baseTimeControl;
      }
      const playerRatingsData = await storage.getRating(userId);
      const opponentRatingsData = await storage.getRating(opponentId);
      const playerRating = (playerRatingsData as any)?.[ratingCategory] || 1200;
      const opponentRating = (opponentRatingsData as any)?.[ratingCategory] || 1200;

      if (isSimul) {
        res.json({ 
          matched: true, 
          matchId: match.id,
          games: userGames,
          boardCount,
          opponentId,
          opponent: { id: opponentId, name: opponentName, rating: opponentRating },
          playerRating,
        });
      } else {
        res.json({ 
          matched: true,
          matchId: match.id, 
          game: {
            ...userGames[0],
            playerColor: userGames[0].playerColor || "white"
          }, 
          opponentId,
          opponent: { id: opponentId, name: opponentName, rating: opponentRating },
          playerRating,
        });
      }
    } catch (error) {
      console.error("Error finding match:", error);
      res.status(500).json({ message: "Failed to find match" });
    }
  });

  app.get('/api/matches/active', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const match = await storage.getActiveMatchForUser(userId);

      if (!match) {
        return res.json(null);
      }

      const userGames = [];
      for (const gameId of match.gameIds) {
        const game = await storage.getGame(gameId);
        if (game && game.userId === userId) {
          userGames.push(game);
        }
      }

      const isSimul = match.matchType.startsWith('simul_');
      const opponentId = match.player1Id === userId ? match.player2Id : match.player1Id;

      res.json({
        matchId: match.id,
        matched: true,
        games: isSimul ? userGames : undefined,
        game: !isSimul && userGames.length > 0 ? userGames[0] : undefined,
        boardCount: isSimul ? userGames.length : undefined,
        opponentId,
      });
    } catch (error) {
      console.error("Error fetching active match:", error);
      res.status(500).json({ message: "Failed to fetch active match" });
    }
  });

  app.patch('/api/matches/:matchId', isAuthenticated, async (req: any, res) => {
    try {
      const { matchId } = req.params;
      const userId = req.user.claims.sub;
      const match = await storage.getMatch(matchId);
      
      if (!match) {
        return res.status(404).json({ message: "Match not found" });
      }
      
      if (match.player1Id !== userId && match.player2Id !== userId) {
        return res.status(403).json({ message: "Not authorized to update this match" });
      }
      
      const updatedMatch = await storage.updateMatch(matchId, req.body);
      res.json(updatedMatch);
    } catch (error) {
      console.error("Error updating match:", error);
      res.status(500).json({ message: "Failed to update match" });
    }
  });

  app.post('/api/matches/:matchId/complete', isAuthenticated, async (req: any, res) => {
    try {
      const { matchId } = req.params;
      const { result } = req.body;
      const userId = req.user.claims.sub;

      if (!result || !['white_win', 'black_win', 'draw'].includes(result)) {
        return res.status(400).json({ message: "Invalid result. Must be white_win, black_win, or draw" });
      }

      const match = await storage.getMatch(matchId);
      
      if (!match) {
        return res.status(404).json({ message: "Match not found" });
      }
      
      if (match.player1Id !== userId && match.player2Id !== userId) {
        return res.status(403).json({ message: "Not authorized to complete this match" });
      }

      console.log('[POST /api/matches/:id/complete] Completing match:', matchId, 'result:', result);

      // Complete match atomically (updates match, games, ratings, stats)
      // storage.completeMatch handles idempotency - returns existing data if already completed
      const { match: completedMatch, games: completedGames, alreadyCompleted } = await storage.completeMatch(matchId, result);
      
      if (alreadyCompleted) {
        console.log('[POST /api/matches/:id/complete] Match was already completed, returning existing data');
      }

      console.log('[POST /api/matches/:id/complete] Match completed successfully');

      // Broadcast game_end to both players via WebSocket
      const roomUsers = matchRooms.get(matchId);
      console.log('[POST /api/matches/:id/complete] Match room users:', roomUsers ? Array.from(roomUsers) : 'none');
      
      if (roomUsers) {
        roomUsers.forEach((roomUserId) => {
          const playerWs = userConnections.get(roomUserId);
          if (playerWs && playerWs.readyState === WebSocket.OPEN) {
            console.log('[POST /api/matches/:id/complete] Sending game_end to user:', roomUserId);
            playerWs.send(JSON.stringify({
              type: 'game_end',
              result: result,
              reason: 'game_completed'
            }));
          } else {
            console.log('[POST /api/matches/:id/complete] User WS not ready:', roomUserId);
          }
        });
      }

      // Clean up queue (players can rejoin if they want)
      // NOTE: Do NOT delete matchRooms here! Players need to stay in the room
      // to receive rematch offers. Room cleanup happens when:
      // 1. Rematch is declined (in respond_rematch handler)
      // 2. Players disconnect (in WebSocket close handler)
      queueManager.leave(match.player1Id);
      queueManager.leave(match.player2Id);

      res.json({ match: completedMatch, games: completedGames, alreadyCompleted: !!alreadyCompleted });
    } catch (error) {
      console.error("Error completing match:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to complete match" });
    }
  });

  app.post('/api/blindfold', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const gameData = insertGameSchema.parse({
        mode: 'blindfold',
        userId,
        playerColor: req.body.playerColor || 'white',
        timeControl: req.body.timeControl || 5,
        increment: req.body.increment || 0,
        fen: req.body.fen || "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        moves: req.body.moves || [],
        whiteTime: req.body.timeControl ? (req.body.timeControl * 60) : 300,
        blackTime: req.body.timeControl ? (req.body.timeControl * 60) : 300,
        peeksRemaining: 3,
      });
      
      const game = await storage.createGame(gameData);
      
      res.json(game);
    } catch (error) {
      console.error("Error creating blindfold game:", error);
      res.status(500).json({ message: "Failed to create blindfold game" });
    }
  });

  app.patch('/api/blindfold/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      
      const game = await storage.getGame(id);
      if (!game || game.userId !== userId) {
        return res.status(404).json({ message: "Game not found" });
      }
      
      const updateData: any = { ...req.body };
      
      if (req.body.peek) {
        updateData.peeksRemaining = Math.max(0, (game.peeksRemaining || 3) - 1);
        updateData.peeksUsed = (game.peeksUsed || 0) + 1;
      }
      
      const updatedGame = await storage.updateGame(id, updateData);
      res.json(updatedGame);
    } catch (error) {
      console.error("Error updating blindfold game:", error);
      res.status(500).json({ message: "Failed to update blindfold game" });
    }
  });

  const simulSessions = new Map<string, any>();

  app.post('/api/simul', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const simulId = `simul_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const simulSession = {
        id: simulId,
        hostId: userId,
        hostRating: 1800,
        opponents: [] as string[],
        games: [] as string[],
        status: 'waiting',
        createdAt: new Date(),
        maxOpponents: req.body.maxOpponents || 5,
      };
      
      simulSessions.set(simulId, simulSession);
      res.json(simulSession);
    } catch (error) {
      console.error("Error creating simul:", error);
      res.status(500).json({ message: "Failed to create simul" });
    }
  });

  app.post('/api/simul/:id/join', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      
      const simulSession = simulSessions.get(id);
      if (!simulSession) {
        return res.status(404).json({ message: "Simul not found" });
      }
      
      if (simulSession.opponents.length >= simulSession.maxOpponents) {
        return res.status(409).json({ message: "Simul is full" });
      }
      
      simulSession.opponents.push(userId);
      
      const gameData = insertGameSchema.parse({
        mode: 'simul',
        userId,
        playerColor: 'black',
        timeControl: req.body.timeControl || 3,
        increment: req.body.increment || 2,
        fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        moves: [],
        whiteTime: 180,
        blackTime: 180,
      });
      
      const game = await storage.createGame(gameData);
      simulSession.games.push(game.id);
      
      const simulGame = await storage.createSimulGame({
        simulId: id,
        userId,
        gameId: game.id,
        boardOrder: simulSession.games.length,
      });
      
      res.json({ game, simulGame });
    } catch (error) {
      console.error("Error joining simul:", error);
      res.status(500).json({ message: "Failed to join simul" });
    }
  });

  app.get('/api/simul/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      
      const simulSession = simulSessions.get(id);
      if (!simulSession) {
        return res.status(404).json({ message: "Simul not found" });
      }
      
      const simulGames = await storage.getSimulGames(id);
      res.json({ ...simulSession, simulGames });
    } catch (error) {
      console.error("Error fetching simul:", error);
      res.status(500).json({ message: "Failed to fetch simul" });
    }
  });

  function getCurrentRating(rating: any, mode: string): number {
    if (mode.includes('bullet')) return rating.bullet;
    if (mode.includes('blitz')) return rating.blitz;
    if (mode.includes('rapid')) return rating.rapid;
    if (mode.includes('classical')) return rating.classical;
    return 1200;
  }

  app.get('/api/statistics', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const stats = await storage.getStatistics(userId);
      // Filter out bullet and classical modes
      const filteredStats = stats.filter(s => 
        !s.mode.includes('bullet') && !s.mode.includes('classical')
      );
      res.json(filteredStats);
    } catch (error) {
      console.error("Error fetching statistics:", error);
      res.status(500).json({ message: "Failed to fetch statistics" });
    }
  });

  app.get('/api/training-stats', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Get repertoire training stats
      const practiceHistory = await storage.getPracticeHistory(userId);
      const totalCorrect = practiceHistory.reduce((sum: number, h) => sum + (h.correctCount || 0), 0);
      const totalIncorrect = practiceHistory.reduce((sum: number, h) => sum + (h.incorrectCount || 0), 0);
      const linesMastered = practiceHistory.filter(h => (h.interval || 0) >= 21).length;
      const dueForReview = practiceHistory.filter(h => h.nextDue && new Date(h.nextDue) <= new Date()).length;
      
      // Get repertoires count
      const repertoires = await storage.getRepertoires(userId);
      
      // Get Knight's Tour stats
      const knightsTourProgress = await storage.getKnightsTourOverallProgress(userId);
      
      // Get best time across all board sizes (check each common board size)
      let bestTime: number | null = null;
      for (const size of [5, 6, 7, 8]) {
        const progress = await storage.getKnightsTourProgress(userId, size);
        if (progress?.bestTime && (bestTime === null || progress.bestTime < bestTime)) {
          bestTime = progress.bestTime;
        }
      }
      
      // Get Board Spin stats (uses efficient SQL aggregation)
      const boardSpinStats = await storage.getUserBoardSpinStats(userId);
      
      // Get N-Piece Challenge stats
      const nPieceProgress = await storage.getNPieceOverallProgress(userId);
      
      // Get puzzle upload count
      const puzzlesUploaded = await storage.getUserPuzzleUploadCount(userId);
      
      res.json({
        repertoire: {
          totalRepertoires: repertoires.length,
          linesPracticed: practiceHistory.length,
          linesMastered,
          dueForReview,
          totalCorrect,
          totalIncorrect,
          accuracy: totalCorrect + totalIncorrect > 0 
            ? Math.round((totalCorrect / (totalCorrect + totalIncorrect)) * 100)
            : 0,
        },
        boardSpin: {
          gamesPlayed: boardSpinStats.gamesPlayed,
          bestScore: boardSpinStats.bestScore,
          avgAccuracy: boardSpinStats.avgAccuracy,
        },
        nPiece: {
          challengesAttempted: nPieceProgress.total,
          totalSolutions: nPieceProgress.found,
        },
        knightsTour: {
          totalCompleted: knightsTourProgress.totalCompleted,
          boardsCompleted: knightsTourProgress.boardsCompleted,
          bestTime,
        },
        puzzles: {
          uploaded: puzzlesUploaded,
        },
      });
    } catch (error) {
      console.error("Error fetching training stats:", error);
      res.status(500).json({ message: "Failed to fetch training stats" });
    }
  });

  app.get('/api/special-mode-stats', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Get blindfold stats
      const blindfoldStats = await storage.getUserBlindfoldStats(userId);
      
      // Get simul vs simul stats
      const simulVsSimulStats = await storage.getUserSimulVsSimulStats(userId);
      
      res.json({
        blindfold: blindfoldStats,
        simulVsSimul: simulVsSimulStats,
      });
    } catch (error) {
      console.error("Error fetching special mode stats:", error);
      res.status(500).json({ message: "Failed to fetch special mode stats" });
    }
  });

  app.get('/api/puzzles/random', isAuthenticated, async (req: any, res) => {
    try {
      const puzzle = await storage.getRandomPuzzle();
      
      if (!puzzle) {
        return res.status(404).json({ message: "No puzzles available" });
      }
      
      res.json(puzzle);
    } catch (error) {
      console.error("Error fetching puzzle:", error);
      res.status(500).json({ message: "Failed to fetch puzzle" });
    }
  });

  app.get('/api/puzzles/next', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Use rotation-aware puzzle fetching
      const puzzle = await storage.getNextPuzzleForUser(userId);
      
      if (!puzzle) {
        return res.status(404).json({ message: "No puzzles available" });
      }
      
      // Mark puzzle as seen immediately
      await storage.markPuzzleSeen(userId, puzzle.id);
      
      const userVote = await storage.getUserPuzzleVote(userId, puzzle.id);
      
      res.json({ ...puzzle, userVote: userVote?.voteType || null });
    } catch (error) {
      console.error("Error fetching next puzzle:", error);
      res.status(500).json({ message: "Failed to fetch puzzle" });
    }
  });

  app.post('/api/puzzles/reset-progress', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await storage.resetPuzzleProgress(userId);
      res.json({ success: true, message: "Puzzle progress reset" });
    } catch (error) {
      console.error("Error resetting puzzle progress:", error);
      res.status(500).json({ message: "Failed to reset progress" });
    }
  });

  app.post('/api/puzzles/attempt', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const attemptData = insertPuzzleAttemptSchema.parse({
        ...req.body,
        userId,
      });
      
      const attempt = await storage.createPuzzleAttempt(attemptData);
      
      if (attempt.solved) {
        await storage.updateUserPuzzleSolveStreak(userId, true);
      } else {
        await storage.updateUserPuzzleSolveStreak(userId, false);
      }
      
      // Track motif stats for this puzzle attempt
      const puzzle = await storage.getPuzzle(attemptData.puzzleId);
      if (puzzle && puzzle.tacticalMotifs && Array.isArray(puzzle.tacticalMotifs)) {
        for (const motif of puzzle.tacticalMotifs) {
          await storage.updateUserMotifStats(userId, motif, attempt.solved);
        }
      }
      
      // Invalidate training/puzzle caches when puzzle is attempted
      invalidateCaches.puzzles();
      
      res.json(attempt);
    } catch (error) {
      console.error("Error creating puzzle attempt:", error);
      res.status(500).json({ message: "Failed to record puzzle attempt" });
    }
  });

  app.get('/api/puzzles', isAuthenticated, async (req: any, res) => {
    try {
      const { type, difficulty, creatorId, creatorUsername, isAnonymous, sortBy, limit, offset, isVerified, motif } = req.query;
      const puzzles = await storage.getPuzzlesWithCreators({
        type,
        difficulty,
        creatorId,
        creatorUsername,
        isAnonymous: isAnonymous !== undefined ? isAnonymous === 'true' : undefined,
        sortBy: sortBy || 'newest',
        limit: limit ? parseInt(limit) : 20,
        offset: offset ? parseInt(offset) : 0,
        isVerified: isVerified !== undefined ? isVerified === 'true' : undefined,
        motif,
      });
      res.json(puzzles);
    } catch (error) {
      console.error("Error fetching puzzles:", error);
      res.status(500).json({ message: "Failed to fetch puzzles" });
    }
  });

  app.get('/api/puzzles/my-puzzles', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const puzzles = await storage.getUserCreatedPuzzles(userId);
      res.json(puzzles);
    } catch (error) {
      console.error("Error fetching user puzzles:", error);
      res.status(500).json({ message: "Failed to fetch your puzzles" });
    }
  });

  app.get('/api/puzzles/of-the-day', async (_req, res) => {
    try {
      const puzzle = await storage.getPuzzleOfTheDay();
      if (!puzzle) {
        return res.status(404).json({ message: "No puzzle of the day available" });
      }
      res.json(puzzle);
    } catch (error) {
      console.error("Error fetching puzzle of the day:", error);
      res.status(500).json({ message: "Failed to fetch puzzle of the day" });
    }
  });

  app.get('/api/puzzles/share/:shareCode', async (req, res) => {
    try {
      const puzzle = await storage.getPuzzleByShareCode(req.params.shareCode);
      if (!puzzle) {
        return res.status(404).json({ message: "Puzzle not found" });
      }
      res.json(puzzle);
    } catch (error) {
      console.error("Error fetching shared puzzle:", error);
      res.status(500).json({ message: "Failed to fetch puzzle" });
    }
  });

  app.get('/api/puzzles/:id', isAuthenticated, async (req: any, res) => {
    try {
      const puzzle = await storage.getPuzzle(req.params.id);
      if (!puzzle) {
        return res.status(404).json({ message: "Puzzle not found" });
      }
      
      const userId = req.user.claims.sub;
      const userVote = await storage.getUserPuzzleVote(userId, puzzle.id);
      
      // Get creator info if available
      let creatorUsername: string | null = null;
      if (puzzle.creatorId && !puzzle.isAnonymous) {
        const creator = await storage.getUser(puzzle.creatorId);
        creatorUsername = creator?.username || null;
      }
      
      res.json({ 
        ...puzzle, 
        userVote: userVote?.voteType || null,
        creatorUsername
      });
    } catch (error) {
      console.error("Error fetching puzzle:", error);
      res.status(500).json({ message: "Failed to fetch puzzle" });
    }
  });

  app.post('/api/puzzles', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Check if user is suspended (suspended users cannot create puzzles, but can still solve them)
      const userRecord = await storage.getUser(userId);
      if (userRecord?.suspendedUntil && new Date(userRecord.suspendedUntil) > new Date()) {
        const suspendedUntil = new Date(userRecord.suspendedUntil).toLocaleDateString();
        return res.status(403).json({ 
          message: `Your account is suspended until ${suspendedUntil}. You cannot create new puzzles, but you can still solve existing puzzles.`,
          suspendedUntil: userRecord.suspendedUntil,
          isSoftSuspension: true
        });
      }
      
      const existingPuzzle = await storage.checkDuplicatePuzzle(req.body.fen);
      if (existingPuzzle) {
        return res.status(400).json({ message: "A puzzle with this position already exists" });
      }
      
      // Validate and check for duplicate YouTube URL
      let youtubeVideoUrl = req.body.youtubeVideoUrl?.trim();
      if (youtubeVideoUrl) {
        // Extract video ID from various YouTube URL formats
        const extractYoutubeVideoId = (url: string): string | null => {
          const patterns = [
            /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
          ];
          for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) return match[1];
          }
          return null;
        };
        
        const videoId = extractYoutubeVideoId(youtubeVideoUrl);
        if (!videoId) {
          return res.status(400).json({ message: "Invalid YouTube URL. Please use a valid youtube.com or youtu.be link." });
        }
        
        // Normalize to canonical format for consistent storage and comparison
        youtubeVideoUrl = `https://www.youtube.com/watch?v=${videoId}`;
        
        const existingYoutubeUrlPuzzle = await storage.checkDuplicateYoutubeUrl(youtubeVideoUrl);
        if (existingYoutubeUrlPuzzle) {
          return res.status(400).json({ message: "This YouTube video is already linked to another puzzle" });
        }
        
        // Update the request body with normalized URL
        req.body.youtubeVideoUrl = youtubeVideoUrl;
      }
      
      const puzzleData = insertPuzzleSchema.parse({
        ...req.body,
        creatorId: userId,
      });
      
      const puzzle = await storage.createPuzzle(puzzleData);
      
      await storage.updateUserPuzzleReputation(userId, 5);
      
      // Invalidate puzzle caches when new puzzle is created
      invalidateCaches.puzzles();
      
      res.json(puzzle);
    } catch (error) {
      console.error("Error creating puzzle:", error);
      res.status(500).json({ message: "Failed to create puzzle" });
    }
  });

  app.patch('/api/puzzles/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const puzzle = await storage.getPuzzle(req.params.id);
      
      if (!puzzle) {
        return res.status(404).json({ message: "Puzzle not found" });
      }
      
      const user = await storage.getUser(userId);
      if (puzzle.creatorId !== userId && !user?.isAdmin) {
        return res.status(403).json({ message: "Not authorized to edit this puzzle" });
      }
      
      const updatedPuzzle = await storage.updatePuzzle(req.params.id, req.body);
      
      // Invalidate puzzle caches on any update (visibility may change)
      invalidateCaches.puzzles();
      
      res.json(updatedPuzzle);
    } catch (error) {
      console.error("Error updating puzzle:", error);
      res.status(500).json({ message: "Failed to update puzzle" });
    }
  });

  app.delete('/api/puzzles/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const puzzle = await storage.getPuzzle(req.params.id);
      
      if (!puzzle) {
        return res.status(404).json({ message: "Puzzle not found" });
      }
      
      const user = await storage.getUser(userId);
      if (puzzle.creatorId !== userId && !user?.isAdmin) {
        return res.status(403).json({ message: "Not authorized to delete this puzzle" });
      }
      
      await storage.deletePuzzle(req.params.id);
      
      // Invalidate puzzle caches
      invalidateCaches.puzzles();
      
      res.json({ message: "Puzzle deleted" });
    } catch (error) {
      console.error("Error deleting puzzle:", error);
      res.status(500).json({ message: "Failed to delete puzzle" });
    }
  });

  app.post('/api/puzzles/:id/vote', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const puzzleId = req.params.id;
      const { voteType } = req.body;
      
      if (!['up', 'down'].includes(voteType)) {
        return res.status(400).json({ message: "Invalid vote type" });
      }
      
      const puzzle = await storage.getPuzzle(puzzleId);
      if (!puzzle) {
        return res.status(404).json({ message: "Puzzle not found" });
      }
      
      if (puzzle.creatorId === userId) {
        return res.status(400).json({ message: "Cannot vote on your own puzzle" });
      }
      
      const existingVote = await storage.getUserPuzzleVote(userId, puzzleId);
      
      if (existingVote) {
        if (existingVote.voteType === voteType) {
          await storage.deletePuzzleVote(existingVote.id);
          // Invalidate puzzle caches (vote removal affects reputation metrics)
          invalidateCaches.puzzles();
          return res.json({ message: "Vote removed" });
        } else {
          const vote = await storage.updatePuzzleVote(existingVote.id, voteType);
          // Invalidate puzzle caches (vote change affects reputation metrics)
          invalidateCaches.puzzles();
          return res.json(vote);
        }
      }
      
      const vote = await storage.createPuzzleVote({
        userId,
        puzzleId,
        voteType,
      });
      
      // Invalidate puzzle caches (votes affect reputation metrics)
      invalidateCaches.puzzles();
      
      res.json(vote);
    } catch (error) {
      console.error("Error voting on puzzle:", error);
      res.status(500).json({ message: "Failed to vote" });
    }
  });

  app.post('/api/puzzles/:id/report', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const puzzleId = req.params.id;
      const { reason, description } = req.body;
      
      if (!reason) {
        return res.status(400).json({ message: "Report reason is required" });
      }
      
      const puzzle = await storage.getPuzzle(puzzleId);
      if (!puzzle) {
        return res.status(404).json({ message: "Puzzle not found" });
      }
      
      const report = await storage.createPuzzleReport({
        puzzleId,
        reporterId: userId,
        reason,
        description,
      });
      
      // Invalidate puzzle caches (reports affect visibility/counts)
      invalidateCaches.puzzles();
      
      res.json(report);
    } catch (error) {
      console.error("Error reporting puzzle:", error);
      res.status(500).json({ message: "Failed to report puzzle" });
    }
  });

  const isAdmin = async (req: any, res: any, next: any) => {
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    if (!user?.isAdmin) {
      return res.status(403).json({ message: "Admin access required" });
    }
    next();
  };

  app.get('/api/admin/puzzles/flagged', isAuthenticated, isAdmin, async (_req, res) => {
    try {
      const puzzles = await storage.getFlaggedPuzzlesWithReports();
      res.json(puzzles);
    } catch (error) {
      console.error("Error fetching flagged puzzles:", error);
      res.status(500).json({ message: "Failed to fetch flagged puzzles" });
    }
  });

  app.get('/api/admin/puzzles/reports', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { puzzleId, isResolved } = req.query;
      const reports = await storage.getPuzzleReports(
        puzzleId as string | undefined,
        isResolved !== undefined ? isResolved === 'true' : undefined
      );
      res.json(reports);
    } catch (error) {
      console.error("Error fetching reports:", error);
      res.status(500).json({ message: "Failed to fetch reports" });
    }
  });

  app.post('/api/admin/puzzles/:id/verify', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const puzzle = await storage.updatePuzzle(req.params.id, { isVerified: true, isFlagged: false });
      
      // Invalidate puzzle caches
      invalidateCaches.puzzles();
      
      res.json(puzzle);
    } catch (error) {
      console.error("Error verifying puzzle:", error);
      res.status(500).json({ message: "Failed to verify puzzle" });
    }
  });

  app.post('/api/admin/puzzles/:id/remove', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const puzzle = await storage.updatePuzzle(req.params.id, { isRemoved: true });
      
      // Invalidate puzzle caches
      invalidateCaches.puzzles();
      
      res.json(puzzle);
    } catch (error) {
      console.error("Error removing puzzle:", error);
      res.status(500).json({ message: "Failed to remove puzzle" });
    }
  });

  app.post('/api/admin/puzzles/:id/unflag', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const puzzle = await storage.updatePuzzle(req.params.id, { isFlagged: false, reportCount: 0 });
      
      // Invalidate puzzle caches
      invalidateCaches.puzzles();
      
      res.json(puzzle);
    } catch (error) {
      console.error("Error unflagging puzzle:", error);
      res.status(500).json({ message: "Failed to unflag puzzle" });
    }
  });

  // Remove YouTube link from puzzle (admin action for bad link reports)
  app.post('/api/admin/puzzles/:id/remove-youtube', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const puzzleId = req.params.id;
      const userId = req.user.claims.sub;
      
      // Remove the YouTube link
      const puzzle = await storage.updatePuzzle(puzzleId, { youtubeVideoUrl: null });
      
      // Resolve all bad_youtube_link reports for this puzzle
      await storage.resolveYoutubeLinkReports(puzzleId, userId);
      
      // Invalidate puzzle caches
      invalidateCaches.puzzles();
      
      res.json({ message: "YouTube link removed successfully", puzzle });
    } catch (error) {
      console.error("Error removing YouTube link:", error);
      res.status(500).json({ message: "Failed to remove YouTube link" });
    }
  });

  // Admin Stockfish analysis for puzzle verification - DEPRECATED: Use client-side Stockfish
  app.post('/api/admin/puzzles/:id/analyze', isAuthenticated, isAdmin, async (_req: any, res) => {
    res.status(410).json({ 
      message: "Server-side Stockfish analysis has been deprecated. Please use client-side analysis.",
      deprecated: true
    });
  });

  app.post('/api/admin/reports/:id/resolve', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const report = await storage.resolvePuzzleReport(req.params.id, userId);
      
      // Invalidate puzzle caches (report resolution may affect visibility)
      invalidateCaches.puzzles();
      
      res.json(report);
    } catch (error) {
      console.error("Error resolving report:", error);
      res.status(500).json({ message: "Failed to resolve report" });
    }
  });

  // Puzzle creator Stockfish verification - DEPRECATED: Use client-side Stockfish
  app.post('/api/puzzles/verify-move', isAuthenticated, async (_req: any, res) => {
    res.status(410).json({ 
      message: "Server-side Stockfish analysis has been deprecated. Please use client-side analysis.",
      deprecated: true
    });
  });

  // ========== ANTI-CHEAT SYSTEM ==========
  
  // Submit a cheat report (authenticated users)
  app.post('/api/cheat-reports', isAuthenticated, async (req: any, res) => {
    try {
      const reporterId = req.user.claims.sub;
      const { reportedUserId, gameId, reason, details, screenshotUrl } = req.body;
      
      if (!reportedUserId || !reason) {
        return res.status(400).json({ message: "Reported user ID and reason are required" });
      }
      
      // Prevent self-reports
      if (reporterId === reportedUserId) {
        return res.status(400).json({ message: "You cannot report yourself" });
      }
      
      const report = await storage.createCheatReport({
        reporterId,
        reportedUserId,
        gameId: gameId || null,
        reason,
        details: details || null,
        screenshotUrl: screenshotUrl || null,
      });
      
      // Check if reported user has any suspension history - if so, alert admins
      const hasSuspensionHistory = await storage.hasAnySuspensionHistory(reportedUserId);
      if (hasSuspensionHistory) {
        const reportedUser = await storage.getUser(reportedUserId);
        await storage.createAdminNotification({
          type: 'suspended_user_reported',
          title: 'Previously Suspended User Reported',
          message: `User "${reportedUser?.username || reportedUserId}" has been reported again. This user has a prior suspension history. Reason: ${reason}`,
          relatedUserId: reportedUserId,
          relatedReportId: report.id,
          metadata: { reason, gameId: gameId || null },
        });
      }
      
      res.json(report);
    } catch (error) {
      console.error("Error creating cheat report:", error);
      res.status(500).json({ message: "Failed to submit report" });
    }
  });
  
  // Get user's own submitted reports
  app.get('/api/cheat-reports/my-reports', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const reports = await storage.getCheatReportsByReporter(userId);
      res.json(reports);
    } catch (error) {
      console.error("Error fetching user's reports:", error);
      res.status(500).json({ message: "Failed to fetch reports" });
    }
  });
  
  // Admin: Get all cheat reports
  app.get('/api/admin/cheat-reports', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { userId, isResolved } = req.query;
      const reports = await storage.getCheatReports(
        userId as string | undefined,
        isResolved !== undefined ? isResolved === 'true' : undefined
      );
      res.json(reports);
    } catch (error) {
      console.error("Error fetching cheat reports:", error);
      res.status(500).json({ message: "Failed to fetch cheat reports" });
    }
  });
  
  // Admin: Resolve a cheat report
  app.post('/api/admin/cheat-reports/:id/resolve', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const adminId = req.user.claims.sub;
      const { resolution } = req.body;
      
      if (!resolution) {
        return res.status(400).json({ message: "Resolution is required" });
      }
      
      const report = await storage.resolveCheatReport(req.params.id, adminId, resolution);
      res.json(report);
    } catch (error) {
      console.error("Error resolving cheat report:", error);
      res.status(500).json({ message: "Failed to resolve report" });
    }
  });
  
  // Admin: Get all flagged users
  app.get('/api/admin/flagged-users', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { priority } = req.query;
      if (priority) {
        const users = await storage.getFlaggedUsers(priority as any);
        res.json(users);
      } else {
        const users = await storage.getAllFlaggedUsersWithDetails();
        res.json(users);
      }
    } catch (error) {
      console.error("Error fetching flagged users:", error);
      res.status(500).json({ message: "Failed to fetch flagged users" });
    }
  });
  
  // Admin: Get user's anti-cheat record
  app.get('/api/admin/users/:userId/anti-cheat', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const antiCheat = await storage.getUserAntiCheat(userId);
      const reports = await storage.getCheatReports(userId);
      const user = await storage.getUser(userId);
      
      res.json({
        user,
        antiCheat,
        reports,
      });
    } catch (error) {
      console.error("Error fetching user anti-cheat data:", error);
      res.status(500).json({ message: "Failed to fetch anti-cheat data" });
    }
  });
  
  // Admin: Update review status
  app.post('/api/admin/users/:userId/review', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const adminId = req.user.claims.sub;
      const { userId } = req.params;
      const { status, notes } = req.body;
      
      if (!status) {
        return res.status(400).json({ message: "Status is required" });
      }
      
      const antiCheat = await storage.updateReviewStatus(userId, status, adminId, notes);
      res.json(antiCheat);
    } catch (error) {
      console.error("Error updating review status:", error);
      res.status(500).json({ message: "Failed to update review status" });
    }
  });
  
  // Admin: Issue a warning
  app.post('/api/admin/users/:userId/warn', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const adminId = req.user.claims.sub;
      const { userId } = req.params;
      const { notes } = req.body;
      
      if (!notes) {
        return res.status(400).json({ message: "Warning notes are required" });
      }
      
      const antiCheat = await storage.issueWarning(userId, adminId, notes);
      res.json(antiCheat);
    } catch (error) {
      console.error("Error issuing warning:", error);
      res.status(500).json({ message: "Failed to issue warning" });
    }
  });
  
  // Admin: Flag user for review (manual flagging)
  app.post('/api/admin/users/:userId/flag', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const { reason, priority } = req.body;
      
      if (!reason) {
        return res.status(400).json({ message: "Reason is required" });
      }
      
      const antiCheat = await storage.flagUserForReview(userId, reason, priority || 'medium');
      res.json(antiCheat);
    } catch (error) {
      console.error("Error flagging user:", error);
      res.status(500).json({ message: "Failed to flag user" });
    }
  });
  
  // Admin: Get anti-cheat statistics
  app.get('/api/admin/anti-cheat/stats', isAuthenticated, isAdmin, async (_req, res) => {
    try {
      const flagged = await storage.getFlaggedUsers();
      const unresolvedReports = await storage.getCheatReports(undefined, false);
      
      const byPriority = {
        critical: flagged.filter(u => u.reviewPriority === 'critical').length,
        high: flagged.filter(u => u.reviewPriority === 'high').length,
        medium: flagged.filter(u => u.reviewPriority === 'medium').length,
        low: flagged.filter(u => u.reviewPriority === 'low').length,
      };
      
      res.json({
        totalFlagged: flagged.length,
        byPriority,
        unresolvedReports: unresolvedReports.length,
      });
    } catch (error) {
      console.error("Error fetching anti-cheat stats:", error);
      res.status(500).json({ message: "Failed to fetch statistics" });
    }
  });
  
  // Admin: Suspend user for specified duration
  app.post('/api/admin/users/:userId/suspend', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const { days } = req.body;
      
      if (!days || ![1, 5, 10, 30].includes(days)) {
        return res.status(400).json({ message: "Invalid suspension duration. Must be 1, 5, 10, or 30 days." });
      }
      
      const suspendedUntil = new Date();
      suspendedUntil.setDate(suspendedUntil.getDate() + days);
      
      const user = await storage.suspendUser(userId, suspendedUntil);
      res.json({ success: true, user, message: `User suspended until ${suspendedUntil.toLocaleDateString()}` });
    } catch (error) {
      console.error("Error suspending user:", error);
      res.status(500).json({ message: "Failed to suspend user" });
    }
  });
  
  // Admin: Ban user permanently
  app.post('/api/admin/users/:userId/ban', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { userId } = req.params;
      
      const user = await storage.banUser(userId);
      res.json({ success: true, user, message: "User has been permanently banned" });
    } catch (error) {
      console.error("Error banning user:", error);
      res.status(500).json({ message: "Failed to ban user" });
    }
  });
  
  // Admin: Unban/unsuspend user
  app.post('/api/admin/users/:userId/unban', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { userId } = req.params;
      
      const user = await storage.unbanUser(userId);
      res.json({ success: true, user, message: "User has been unbanned" });
    } catch (error) {
      console.error("Error unbanning user:", error);
      res.status(500).json({ message: "Failed to unban user" });
    }
  });
  
  // Admin: Refund ELO for a specific game (reverse rating changes)
  app.post('/api/admin/games/:gameId/refund-elo', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { gameId } = req.params;
      
      const result = await storage.refundGameElo(gameId);
      res.json({ success: true, ...result });
    } catch (error) {
      console.error("Error refunding game ELO:", error);
      res.status(500).json({ message: "Failed to refund ELO" });
    }
  });
  
  // Admin: Refund ELO for ALL wins by a cheater
  app.post('/api/admin/users/:userId/refund-all-wins', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { userId } = req.params;
      
      const result = await storage.refundAllWinsElo(userId);
      res.json({ success: true, ...result });
    } catch (error) {
      console.error("Error refunding all wins ELO:", error);
      res.status(500).json({ message: "Failed to refund ELO for all wins" });
    }
  });
  
  // Admin: Get game details with moves for cheat investigation
  app.get('/api/admin/games/:gameId/details', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { gameId } = req.params;
      
      const game = await storage.getGame(gameId);
      if (!game) {
        return res.status(404).json({ message: "Game not found" });
      }
      
      // Get player info
      const whitePlayer = game.whitePlayerId ? await storage.getUser(game.whitePlayerId) : null;
      const blackPlayer = game.blackPlayerId ? await storage.getUser(game.blackPlayerId) : null;
      
      res.json({
        game,
        whitePlayer,
        blackPlayer,
      });
    } catch (error) {
      console.error("Error fetching game details:", error);
      res.status(500).json({ message: "Failed to fetch game details" });
    }
  });
  
  // Admin: Get user info by ID
  app.get('/api/admin/users/:userId', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Admin: Get user's game history with pagination
  app.get('/api/admin/users/:userId/games', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      
      const [games, totalCount] = await Promise.all([
        storage.getUserGameHistory(userId, limit, offset),
        storage.getUserGameCount(userId)
      ]);
      
      res.json({ games, totalCount, limit, offset });
    } catch (error) {
      console.error("Error fetching user game history:", error);
      res.status(500).json({ message: "Failed to fetch game history" });
    }
  });

  // Admin: Get user's suspension history (last 30 days)
  app.get('/api/admin/users/:userId/suspensions', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const suspensions = await storage.getUserSuspensions(userId);
      const activeSuspension = await storage.getActiveSuspension(userId);
      res.json({ suspensions, activeSuspension });
    } catch (error) {
      console.error("Error fetching user suspensions:", error);
      res.status(500).json({ message: "Failed to fetch suspension history" });
    }
  });

  // Admin: Get all admin notifications
  app.get('/api/admin/notifications', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const unreadOnly = req.query.unread === 'true';
      const limit = parseInt(req.query.limit as string) || 50;
      
      const notifications = unreadOnly 
        ? await storage.getUnreadAdminNotifications()
        : await storage.getAllAdminNotifications(limit);
      
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching admin notifications:", error);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  // Admin: Mark notification as read
  app.post('/api/admin/notifications/:id/read', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const adminId = req.user.claims.sub;
      const notification = await storage.markAdminNotificationRead(req.params.id, adminId);
      res.json(notification);
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ message: "Failed to mark notification as read" });
    }
  });

  // Admin: Mark all notifications as read
  app.post('/api/admin/notifications/mark-all-read', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const adminId = req.user.claims.sub;
      await storage.markAllAdminNotificationsRead(adminId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      res.status(500).json({ message: "Failed to mark notifications as read" });
    }
  });

  // Admin: Create a suspension with detailed tracking
  app.post('/api/admin/users/:userId/suspend-detailed', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const adminId = req.user.claims.sub;
      const { userId } = req.params;
      const { reason, details, durationDays, relatedReportId } = req.body;
      
      if (!reason) {
        return res.status(400).json({ message: "Suspension reason is required" });
      }
      
      const endDate = durationDays ? new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000) : undefined;
      
      const suspension = await storage.createSuspension({
        userId,
        reason,
        details: details || null,
        durationDays: durationDays || null,
        endDate: endDate || null,
        issuedById: adminId,
        relatedReportId: relatedReportId || null,
      });
      
      res.json(suspension);
    } catch (error) {
      console.error("Error creating suspension:", error);
      res.status(500).json({ message: "Failed to create suspension" });
    }
  });

  // Admin: Lift a suspension early
  app.post('/api/admin/suspensions/:id/lift', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const adminId = req.user.claims.sub;
      const { reason } = req.body;
      
      const suspension = await storage.liftSuspension(req.params.id, adminId, reason);
      res.json(suspension);
    } catch (error) {
      console.error("Error lifting suspension:", error);
      res.status(500).json({ message: "Failed to lift suspension" });
    }
  });

  // Admin: Get analysis performance metrics for scaling decisions
  app.get('/api/admin/analysis/performance', isAuthenticated, isAdmin, async (_req, res) => {
    try {
      const stats = await analysisQueueManager.getPerformanceStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching analysis performance stats:", error);
      res.status(500).json({ message: "Failed to fetch performance statistics" });
    }
  });

  // Admin: Get historical analysis metrics
  app.get('/api/admin/analysis/history', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const hours = parseInt(req.query.hours as string) || 24;
      const metrics = await analysisQueueManager.getHistoricalMetrics(hours);
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching analysis history:", error);
      res.status(500).json({ message: "Failed to fetch historical metrics" });
    }
  });

  // Admin: Trigger metrics snapshot save
  app.post('/api/admin/analysis/save-metrics', isAuthenticated, isAdmin, async (_req, res) => {
    try {
      await analysisQueueManager.saveMetricsSnapshot();
      res.json({ success: true, message: "Metrics snapshot saved" });
    } catch (error) {
      console.error("Error saving metrics snapshot:", error);
      res.status(500).json({ message: "Failed to save metrics" });
    }
  });

  app.get('/api/settings', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      let settings = await storage.getUserSettings(userId);
      
      if (!settings) {
        settings = await storage.upsertUserSettings({
          userId,
          pieceSet: "cburnett",
          boardTheme: "blue",
          soundEnabled: true,
          voiceEnabled: false,
          autoQueen: false,
          highlightLegalMoves: true,
          confirmMoves: false,
          arbiterWarnings: true,
        });
      }
      
      res.json(settings);
    } catch (error) {
      console.error("Error fetching settings:", error);
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

  app.patch('/api/settings', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const settings = await storage.updateUserSettings(userId, req.body);
      res.json(settings);
    } catch (error) {
      console.error("Error updating settings:", error);
      res.status(500).json({ message: "Failed to update settings" });
    }
  });

  // User Motif Stats (Puzzle Pattern Tracking)
  app.get('/api/user/motif-stats', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const stats = await storage.getUserMotifStats(userId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching motif stats:", error);
      res.status(500).json({ message: "Failed to fetch motif stats" });
    }
  });

  app.get('/api/user/motif-stats/:motifName', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { motifName } = req.params;
      const stat = await storage.getUserMotifStatsByName(userId, motifName);
      res.json(stat || { motifName, solvedCount: 0, failedCount: 0 });
    } catch (error) {
      console.error("Error fetching motif stat:", error);
      res.status(500).json({ message: "Failed to fetch motif stat" });
    }
  });

  // Board Spin API Routes
  app.get('/api/boardspin/difficulties', async (_req, res) => {
    try {
      const difficulties = getAllDifficulties();
      res.json(difficulties);
    } catch (error) {
      console.error("Error fetching difficulties:", error);
      res.status(500).json({ message: "Failed to fetch difficulties" });
    }
  });

  app.post('/api/boardspin/generate', async (req, res) => {
    try {
      const { difficulty } = req.body;
      if (!difficulty) {
        return res.status(400).json({ message: "Difficulty is required" });
      }
      
      const position = generatePosition(difficulty);
      res.json(position);
    } catch (error) {
      console.error("Error generating position:", error);
      res.status(500).json({ message: "Failed to generate position" });
    }
  });

  app.post('/api/boardspin/check', async (req, res) => {
    try {
      const { originalBoard, playerBoard, rotation, multiplier } = req.body;
      
      if (!originalBoard || !playerBoard) {
        return res.status(400).json({ message: "Boards are required" });
      }
      
      const result = calculateScore(originalBoard, playerBoard, rotation, multiplier, false);
      res.json(result);
    } catch (error) {
      console.error("Error checking position:", error);
      res.status(500).json({ message: "Failed to check position" });
    }
  });

  // Board Spin best move - DEPRECATED: Use client-side Stockfish via boardSpinClient.ts
  app.post('/api/boardspin/bestmove', async (_req, res) => {
    res.status(410).json({ 
      message: "Server-side Stockfish analysis has been deprecated. Please use client-side analysis.",
      deprecated: true
    });
  });

  app.post('/api/boardspin/validate-move', async (req, res) => {
    try {
      const { fen, move, expectedBestMove } = req.body;
      
      if (!fen || !move) {
        return res.status(400).json({ message: "FEN and move are required" });
      }
      
      // Check if player's move matches the best move
      const isCorrect = move === expectedBestMove;
      res.json({ isCorrect, expectedBestMove });
    } catch (error) {
      console.error("Error validating move:", error);
      res.status(500).json({ message: "Failed to validate move" });
    }
  });

  app.post('/api/boardspin/scores', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;

      const { difficulty, score, accuracy, pieceCount, rotation, bonusEarned, timeSpent } = req.body;
      
      if (!difficulty || score === undefined || accuracy === undefined) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      
      const savedScore = await storage.saveBoardSpinScore({
        userId,
        difficulty,
        score,
        accuracy,
        pieceCount: pieceCount || 0,
        rotation: rotation || 0,
        bonusEarned: bonusEarned || false,
        timeSpent: timeSpent || null,
      });
      
      // Invalidate training caches when new score is saved
      invalidateCaches.training();
      
      res.json(savedScore);
    } catch (error) {
      console.error("Error saving Board Spin score:", error);
      res.status(500).json({ message: "Failed to save score" });
    }
  });

  app.get('/api/boardspin/leaderboard', async (req, res) => {
    try {
      const { difficulty, limit } = req.query;
      const cacheKey = CACHE_KEYS.BOARD_SPIN_LEADERBOARD(difficulty as string || 'all');
      
      const leaderboard = await memoryCache.getOrFetch(
        cacheKey,
        async () => storage.getBoardSpinLeaderboard(
          difficulty as string | undefined,
          limit ? parseInt(limit as string) : 10
        ),
        CACHE_TTL.LEADERBOARD
      );
      res.json(leaderboard);
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
      res.status(500).json({ message: "Failed to fetch leaderboard" });
    }
  });

  app.get('/api/boardspin/my-scores', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;

      const { limit } = req.query;
      const scores = await storage.getUserBoardSpinScores(
        userId,
        limit ? parseInt(limit as string) : 20
      );
      res.json(scores);
    } catch (error) {
      console.error("Error fetching user scores:", error);
      res.status(500).json({ message: "Failed to fetch scores" });
    }
  });

  app.get('/api/boardspin/my-highscore', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;

      const { difficulty } = req.query;
      const highScore = await storage.getUserBoardSpinHighScore(
        userId,
        difficulty as string | undefined
      );
      res.json(highScore || null);
    } catch (error) {
      console.error("Error fetching high score:", error);
      res.status(500).json({ message: "Failed to fetch high score" });
    }
  });

  // N-Piece Challenge Routes
  app.get('/api/n-piece-challenge/progress/:pieceType/:boardSize', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { pieceType, boardSize } = req.params;
      
      if (!pieceType || !boardSize) {
        return res.status(400).json({ message: "Missing pieceType or boardSize" });
      }
      
      const progress = await storage.getNPieceProgress(userId, pieceType as any, parseInt(boardSize as string));
      const solutions = progress ? await storage.getNPieceSolutions(progress.id) : [];
      const overallProgress = await storage.getNPieceOverallProgress(userId);
      
      res.json({ progress, solutions, overallProgress });
    } catch (error) {
      console.error("Error fetching N-Piece progress:", error);
      res.status(500).json({ message: "Failed to fetch progress" });
    }
  });

  app.post('/api/n-piece-challenge/solution', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { pieceType, boardSize, positions, solveTime } = req.body;
      
      if (!pieceType || !boardSize || !positions || solveTime === undefined) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      
      const result = await storage.saveNPieceSolution({
        userId,
        pieceType,
        boardSize: parseInt(boardSize),
        positions,
        solveTime,
        progressId: '', // Will be set by storage
        solutionIndex: 0, // Will be set by storage
      });
      
      // Invalidate training caches
      invalidateCaches.training();
      
      res.json({ 
        isNew: result.isNew, 
        solutionIndex: result.solution.solutionIndex 
      });
    } catch (error) {
      console.error("Error saving N-Piece solution:", error);
      res.status(500).json({ message: "Failed to save solution" });
    }
  });

  // Knight's Tour Routes
  app.get('/api/knights-tour/progress/:boardSize', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { boardSize } = req.params;
      
      const progress = await storage.getKnightsTourProgress(userId, parseInt(boardSize));
      const overallProgress = await storage.getKnightsTourOverallProgress(userId);
      
      res.json({ progress, overallProgress });
    } catch (error) {
      console.error("Error fetching Knight's Tour progress:", error);
      res.status(500).json({ message: "Failed to fetch progress" });
    }
  });

  app.post('/api/knights-tour/complete', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { boardSize, completionTime } = req.body;
      
      if (!boardSize || completionTime === undefined) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      
      const progress = await storage.saveKnightsTourCompletion(
        userId,
        parseInt(boardSize),
        completionTime
      );
      
      // Invalidate training caches
      invalidateCaches.training();
      
      res.json({ progress });
    } catch (error) {
      console.error("Error saving Knight's Tour completion:", error);
      res.status(500).json({ message: "Failed to save completion" });
    }
  });

  app.post('/api/knights-tour/incomplete', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { boardSize, moveCount } = req.body;
      
      if (!boardSize || moveCount === undefined) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      
      const progress = await storage.saveKnightsTourIncomplete(
        userId,
        parseInt(boardSize),
        moveCount
      );
      
      res.json({ progress });
    } catch (error) {
      console.error("Error saving Knight's Tour incomplete attempt:", error);
      res.status(500).json({ message: "Failed to save incomplete attempt" });
    }
  });

  app.get('/api/bots', async (_req, res) => {
    try {
      res.json(BOTS);
    } catch (error) {
      console.error("Error fetching bots:", error);
      res.status(500).json({ message: "Failed to fetch bots" });
    }
  });

  app.get('/api/bots/:id', async (req, res) => {
    try {
      const bot = getBotById(req.params.id);
      if (!bot) {
        return res.status(404).json({ message: "Bot not found" });
      }
      res.json(bot);
    } catch (error) {
      console.error("Error fetching bot:", error);
      res.status(500).json({ message: "Failed to fetch bot" });
    }
  });

  app.post('/api/bots/move', async (req, res) => {
    try {
      const { fen, botId, isOtbMode, moveHistory } = req.body;
      
      if (!fen || !botId) {
        return res.status(400).json({ message: "Missing fen or botId" });
      }

      const bot = getBotById(botId);
      if (!bot) {
        return res.status(404).json({ message: "Bot not found" });
      }

      const thinkTime = isOtbMode ? 500 : 0;
      
      if (thinkTime > 0) {
        await new Promise(resolve => setTimeout(resolve, thinkTime));
      }
      
      const move = await generateBotMove(fen, bot.personality, bot.difficulty, moveHistory);
      
      if (!move) {
        return res.status(400).json({ message: "No legal moves available" });
      }

      res.json({
        move: move.move,
        from: move.from,
        to: move.to,
        promotion: move.promotion,
        thinkTime,
      });
    } catch (error) {
      console.error("Error generating bot move:", error);
      res.status(500).json({ message: "Failed to generate bot move" });
    }
  });

  // Game Analysis Routes
  app.post('/api/analysis/start/:gameId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { gameId } = req.params;
      
      const game = await storage.getGame(gameId);
      if (!game) {
        return res.status(404).json({ message: "Game not found" });
      }
      
      if (game.userId !== userId && game.whitePlayerId !== userId && game.blackPlayerId !== userId) {
        return res.status(403).json({ message: "Not authorized to analyze this game" });
      }
      
      const existingAnalysis = await storage.getGameAnalysis(gameId);
      if (existingAnalysis?.status === 'completed') {
        return res.json({ analysis: existingAnalysis, status: 'already_completed' });
      }
      
      if (existingAnalysis?.status === 'processing') {
        const { getAnalysisProgress } = await import('./analysisService');
        const progress = getAnalysisProgress(gameId);
        return res.json({ status: 'processing', progress });
      }
      
      const { analyzeGame } = await import('./analysisService');
      analyzeGame(gameId, userId).catch(err => {
        console.error('Background analysis failed:', err);
      });
      
      res.json({ status: 'started', message: 'Analysis started' });
    } catch (error) {
      console.error("Error starting game analysis:", error);
      res.status(500).json({ message: "Failed to start analysis" });
    }
  });

  app.get('/api/analysis/:gameId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { gameId } = req.params;
      
      const game = await storage.getGame(gameId);
      if (!game) {
        return res.status(404).json({ message: "Game not found" });
      }
      
      if (game.userId !== userId && game.whitePlayerId !== userId && game.blackPlayerId !== userId) {
        return res.status(403).json({ message: "Not authorized to view this analysis" });
      }
      
      const analysis = await storage.getGameAnalysis(gameId);
      
      // If no analysis exists yet, return game with placeholder analysis for pre-analysis navigation
      if (!analysis) {
        return res.json({ 
          analysis: { 
            id: '', 
            gameId, 
            status: 'not_started' as const, 
            whiteAccuracy: null, 
            blackAccuracy: null,
            openingAccuracy: null,
            middlegameAccuracy: null,
            endgameAccuracy: null,
            shareCode: null,
          }, 
          moves: [], 
          game 
        });
      }
      
      const moves = await storage.getMoveAnalyses(analysis.id);
      
      res.json({ analysis, moves, game });
    } catch (error) {
      console.error("Error fetching game analysis:", error);
      res.status(500).json({ message: "Failed to fetch analysis" });
    }
  });

  app.get('/api/analysis/progress/:gameId', isAuthenticated, async (req: any, res) => {
    try {
      const { gameId } = req.params;
      const { getAnalysisProgress } = await import('./analysisService');
      const progress = getAnalysisProgress(gameId);
      
      if (!progress) {
        const analysis = await storage.getGameAnalysis(gameId);
        if (analysis?.status === 'completed') {
          return res.json({ status: 'completed' });
        }
        return res.json({ status: 'not_started' });
      }
      
      res.json(progress);
    } catch (error) {
      console.error("Error fetching analysis progress:", error);
      res.status(500).json({ message: "Failed to fetch progress" });
    }
  });

  app.post('/api/analysis/:gameId/share', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { gameId } = req.params;
      
      const analysis = await storage.getGameAnalysis(gameId);
      if (!analysis) {
        return res.status(404).json({ message: "Analysis not found" });
      }
      
      if (analysis.userId !== userId) {
        return res.status(403).json({ message: "Not authorized to share this analysis" });
      }
      
      const { generateShareLink } = await import('./analysisService');
      const shareCode = await generateShareLink(analysis.id, userId);
      
      res.json({ shareCode, shareUrl: `/analysis/shared/${shareCode}` });
    } catch (error) {
      console.error("Error creating share link:", error);
      res.status(500).json({ message: "Failed to create share link" });
    }
  });

  app.get('/api/analysis/shared/:shareCode', async (req, res) => {
    try {
      const { shareCode } = req.params;
      const { getAnalysisByShareCode } = await import('./analysisService');
      const result = await getAnalysisByShareCode(shareCode);
      
      if (!result) {
        return res.status(404).json({ message: "Shared analysis not found" });
      }
      
      res.json(result);
    } catch (error) {
      console.error("Error fetching shared analysis:", error);
      res.status(500).json({ message: "Failed to fetch shared analysis" });
    }
  });

  // Syzygy Tablebase lookup - for endgame positions with ≤7 pieces
  app.post('/api/syzygy/lookup', async (req, res) => {
    try {
      const { fen } = req.body;
      
      if (!fen || typeof fen !== 'string') {
        return res.status(400).json({ message: "FEN position is required" });
      }
      
      const { syzygyService } = await import('./syzygyService');
      const result = await syzygyService.lookup(fen);
      
      if (!result) {
        return res.status(404).json({ 
          message: "Position not in tablebase (requires ≤7 pieces)",
          isTablebasePosition: false 
        });
      }
      
      res.json({
        ...result,
        isTablebasePosition: true,
        wdlDescription: syzygyService.wdlToDescription(result.wdl),
      });
    } catch (error) {
      console.error("Error looking up Syzygy tablebase:", error);
      res.status(500).json({ message: "Failed to lookup tablebase" });
    }
  });

  // Check if a position is in tablebase territory (≤7 pieces)
  app.get('/api/syzygy/check', async (req, res) => {
    try {
      const fen = req.query.fen as string;
      
      if (!fen) {
        return res.status(400).json({ message: "FEN position is required" });
      }
      
      const { syzygyService } = await import('./syzygyService');
      const isTablebasePosition = syzygyService.isTablebasePosition(fen);
      
      res.json({ isTablebasePosition });
    } catch (error) {
      console.error("Error checking Syzygy eligibility:", error);
      res.status(500).json({ message: "Failed to check tablebase eligibility" });
    }
  });

  // Syzygy cache stats (for admin dashboard)
  app.get('/api/syzygy/stats', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user?.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      const { syzygyService } = await import('./syzygyService');
      const stats = await syzygyService.getCacheStats();
      
      res.json(stats);
    } catch (error) {
      console.error("Error fetching Syzygy stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // Get top 3 engine moves for a position - DEPRECATED: Use client-side Stockfish via gameAnalysis.ts
  app.post('/api/analysis/top-moves', isAuthenticated, async (_req: any, res) => {
    res.status(410).json({ 
      message: "Server-side Stockfish analysis has been deprecated. Please use client-side analysis.",
      deprecated: true
    });
  });

  // VSS Interactive Training - Validate user's move against best move
  app.post('/api/game-analyses/:gameId/vss-train', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { gameId } = req.params;
      const { plyIndex, userMove } = req.body;
      
      if (typeof plyIndex !== 'number' || typeof userMove !== 'string') {
        return res.status(400).json({ message: "Invalid request body" });
      }
      
      // Get game and verify ownership
      const game = await storage.getGame(gameId);
      if (!game) {
        return res.status(404).json({ message: "Game not found" });
      }
      
      if (game.whitePlayerId !== userId && game.blackPlayerId !== userId && game.userId !== userId) {
        return res.status(403).json({ message: "Not authorized to access this game" });
      }
      
      // Get the move analysis for this ply
      const analysis = await storage.getGameAnalysis(gameId);
      if (!analysis) {
        return res.status(404).json({ message: "Analysis not found" });
      }
      
      const moveAnalyses = await storage.getMoveAnalyses(analysis.id);
      // plyIndex maps to moveNumber for the player's moves
      const moveNumber = Math.floor(plyIndex / 2) + 1;
      const color = plyIndex % 2 === 0 ? 'white' : 'black';
      const moveAnalysis = moveAnalyses.find(m => m.moveNumber === moveNumber && m.color === color);
      
      if (!moveAnalysis || !moveAnalysis.bestMove) {
        return res.status(404).json({ message: "Move analysis not found" });
      }
      
      const bestMove = moveAnalysis.bestMove;
      
      // Normalize move formats for comparison
      // User move is in format "e2e4", best move may be in SAN like "e4" or UCI like "e2e4"
      const normalizeMove = (move: string) => move.toLowerCase().replace(/[+#=].*$/, '').trim();
      const normalizedUserMove = normalizeMove(userMove);
      const normalizedBestMove = normalizeMove(bestMove);
      
      // Check if user's move matches best move
      // Handle both UCI format (e2e4) and partial matches
      const isCorrect = normalizedUserMove === normalizedBestMove ||
                        normalizedBestMove.includes(normalizedUserMove) ||
                        normalizedUserMove.includes(normalizedBestMove);
      
      if (isCorrect) {
        return res.json({ correct: true, bestMove });
      }
      
      // Extract hint squares from best move (from and to squares)
      const hintSquares: string[] = [];
      if (bestMove.length >= 4) {
        // UCI format: e2e4
        hintSquares.push(bestMove.slice(0, 2));
        hintSquares.push(bestMove.slice(2, 4));
      }
      
      return res.json({ 
        correct: false, 
        bestMove,
        hintSquares 
      });
    } catch (error) {
      console.error("Error in VSS training validation:", error);
      res.status(500).json({ message: "Failed to validate move" });
    }
  });

  app.get('/api/accuracy-history', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const limit = parseInt(req.query.limit as string) || 50;
      
      const history = await storage.getAccuracyHistory(userId, limit);
      res.json(history);
    } catch (error) {
      console.error("Error fetching accuracy history:", error);
      res.status(500).json({ message: "Failed to fetch accuracy history" });
    }
  });

  app.get('/api/player-weaknesses', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const weaknesses = await storage.getPlayerWeaknesses(userId);
      res.json(weaknesses);
    } catch (error) {
      console.error("Error fetching player weaknesses:", error);
      res.status(500).json({ message: "Failed to fetch weaknesses" });
    }
  });

  // ============ OPENING REPERTOIRE TRAINER ============
  
  app.get('/api/openings', async (req, res) => {
    try {
      const { eco, search, color, limit, offset } = req.query;
      const openings = await storage.getOpenings({
        eco: eco as string,
        search: search as string,
        color: color as string,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
      });
      res.json(openings);
    } catch (error) {
      console.error("Error fetching openings:", error);
      res.status(500).json({ message: "Failed to fetch openings" });
    }
  });

  app.get('/api/openings/:id', async (req, res) => {
    try {
      const opening = await storage.getOpening(req.params.id);
      if (!opening) {
        return res.status(404).json({ message: "Opening not found" });
      }
      res.json(opening);
    } catch (error) {
      console.error("Error fetching opening:", error);
      res.status(500).json({ message: "Failed to fetch opening" });
    }
  });

  app.get('/api/repertoires', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const repertoires = await storage.getRepertoires(userId);
      res.json(repertoires);
    } catch (error) {
      console.error("Error fetching repertoires:", error);
      res.status(500).json({ message: "Failed to fetch repertoires" });
    }
  });

  app.get('/api/repertoires/:id', isAuthenticated, async (req: any, res) => {
    try {
      const repertoire = await storage.getRepertoire(req.params.id);
      if (!repertoire) {
        return res.status(404).json({ message: "Repertoire not found" });
      }
      if (repertoire.userId !== req.user.claims.sub) {
        return res.status(403).json({ message: "Not authorized" });
      }
      res.json(repertoire);
    } catch (error) {
      console.error("Error fetching repertoire:", error);
      res.status(500).json({ message: "Failed to fetch repertoire" });
    }
  });

  app.post('/api/repertoires', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { name, color, openingId, description } = req.body;
      
      const repertoire = await storage.createRepertoire({
        userId,
        name,
        color,
        openingId: openingId || null,
        description: description || null,
      });
      
      // If an opening was selected, automatically create repertoire lines from it
      if (openingId) {
        const opening = await storage.getOpening(openingId);
        if (opening && opening.moves) {
          const moves = opening.moves as string[];
          const { Chess } = await import('chess.js');
          const chess = new Chess();
          
          for (let i = 0; i < moves.length; i++) {
            const isUserMove = (color === 'white' && i % 2 === 0) || (color === 'black' && i % 2 === 1);
            if (isUserMove) {
              const fen = chess.fen();
              const move = moves[i];
              
              await storage.createRepertoireLine({
                repertoireId: repertoire.id,
                fen,
                correctMove: move,
                moveSan: move,
                moveNumber: Math.floor(i / 2) + 1,
                isUserAdded: false,
                frequency: 100,
                parentFen: i > 0 ? null : null,
              });
            }
            chess.move(moves[i]);
          }
        }
      }
      
      res.json(repertoire);
    } catch (error) {
      console.error("Error creating repertoire:", error);
      res.status(500).json({ message: "Failed to create repertoire" });
    }
  });

  app.patch('/api/repertoires/:id', isAuthenticated, async (req: any, res) => {
    try {
      const repertoire = await storage.getRepertoire(req.params.id);
      if (!repertoire) {
        return res.status(404).json({ message: "Repertoire not found" });
      }
      if (repertoire.userId !== req.user.claims.sub) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      const updated = await storage.updateRepertoire(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      console.error("Error updating repertoire:", error);
      res.status(500).json({ message: "Failed to update repertoire" });
    }
  });

  app.delete('/api/repertoires/:id', isAuthenticated, async (req: any, res) => {
    try {
      const repertoire = await storage.getRepertoire(req.params.id);
      if (!repertoire) {
        return res.status(404).json({ message: "Repertoire not found" });
      }
      if (repertoire.userId !== req.user.claims.sub) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      await storage.deleteRepertoire(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting repertoire:", error);
      res.status(500).json({ message: "Failed to delete repertoire" });
    }
  });

  app.get('/api/repertoires/:id/lines', isAuthenticated, async (req: any, res) => {
    try {
      const repertoire = await storage.getRepertoire(req.params.id);
      if (!repertoire) {
        return res.status(404).json({ message: "Repertoire not found" });
      }
      if (repertoire.userId !== req.user.claims.sub) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      const lines = await storage.getRepertoireLines(req.params.id);
      res.json(lines);
    } catch (error) {
      console.error("Error fetching repertoire lines:", error);
      res.status(500).json({ message: "Failed to fetch lines" });
    }
  });

  app.post('/api/repertoires/:id/lines', isAuthenticated, async (req: any, res) => {
    try {
      const repertoire = await storage.getRepertoire(req.params.id);
      if (!repertoire) {
        return res.status(404).json({ message: "Repertoire not found" });
      }
      if (repertoire.userId !== req.user.claims.sub) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      const { fen, correctMove, moveSan, moveNumber, frequency, parentFen } = req.body;
      
      // Check if this line already exists
      const existingLine = await storage.getRepertoireLineByFen(req.params.id, fen);
      if (existingLine) {
        return res.status(400).json({ message: "Line already exists for this position" });
      }
      
      const line = await storage.createRepertoireLine({
        repertoireId: req.params.id,
        fen,
        correctMove,
        moveSan,
        moveNumber,
        isUserAdded: true,
        frequency: frequency || 100,
        parentFen: parentFen || null,
      });
      
      res.json(line);
    } catch (error) {
      console.error("Error creating repertoire line:", error);
      res.status(500).json({ message: "Failed to create line" });
    }
  });

  app.delete('/api/repertoire-lines/:id', isAuthenticated, async (req: any, res) => {
    try {
      await storage.deleteRepertoireLine(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting repertoire line:", error);
      res.status(500).json({ message: "Failed to delete line" });
    }
  });

  app.get('/api/repertoires/:id/practice', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const repertoire = await storage.getRepertoire(req.params.id);
      if (!repertoire) {
        return res.status(404).json({ message: "Repertoire not found" });
      }
      if (repertoire.userId !== userId) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      const limit = parseInt(req.query.limit as string) || 10;
      const forceAll = req.query.forceAll === 'true';
      
      // If forceAll, return all lines regardless of due date
      if (forceAll) {
        const allLines = await storage.getRepertoireLines(req.params.id);
        res.json({
          dueLines: [],
          newLines: allLines.slice(0, limit),
        });
        return;
      }
      
      const dueLines = await storage.getDuePracticeLines(userId, req.params.id, limit);
      
      // If no due lines, get lines that haven't been practiced yet
      if (dueLines.length === 0) {
        const allLines = await storage.getRepertoireLines(req.params.id);
        const histories = await storage.getPracticeHistory(userId);
        const practicedIds = new Set(histories.map(h => h.repertoireLineId));
        
        const unpracticed = allLines.filter(l => !practicedIds.has(l.id));
        res.json({
          dueLines: [],
          newLines: unpracticed.slice(0, limit),
        });
        return;
      }
      
      res.json({ dueLines, newLines: [] });
    } catch (error) {
      console.error("Error fetching practice lines:", error);
      res.status(500).json({ message: "Failed to fetch practice" });
    }
  });

  app.post('/api/practice/:lineId/result', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { correct } = req.body;
      
      const history = await storage.getOrCreatePracticeHistory(userId, req.params.lineId);
      
      // SM-2 spaced repetition algorithm
      let { easeFactor, interval, correctCount, incorrectCount } = history;
      easeFactor = easeFactor || 2.5;
      interval = interval || 1;
      correctCount = correctCount || 0;
      incorrectCount = incorrectCount || 0;
      
      if (correct) {
        correctCount++;
        if (interval === 1) {
          interval = 1;
        } else if (interval === 2) {
          interval = 6;
        } else {
          interval = Math.round(interval * easeFactor);
        }
        easeFactor = easeFactor + (0.1 - (5 - 5) * (0.08 + (5 - 5) * 0.02));
      } else {
        incorrectCount++;
        interval = 1;
        easeFactor = Math.max(1.3, easeFactor - 0.2);
      }
      
      const nextDue = new Date();
      nextDue.setDate(nextDue.getDate() + interval);
      
      const updated = await storage.updatePracticeHistory(history.id, {
        correctCount,
        incorrectCount,
        easeFactor,
        interval,
        lastPracticed: new Date(),
        nextDue,
      });
      
      res.json(updated);
    } catch (error) {
      console.error("Error recording practice result:", error);
      res.status(500).json({ message: "Failed to record result" });
    }
  });

  // Check game moves against user's repertoires
  app.post('/api/repertoires/check-game', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { moves, playerColor } = req.body;
      
      if (!moves || !Array.isArray(moves) || !playerColor) {
        return res.status(400).json({ message: "moves array and playerColor required" });
      }
      
      // Get all user's repertoires for the color they played (only those included in review)
      const repertoires = await storage.getRepertoires(userId);
      const colorRepertoires = repertoires.filter(r => r.color === playerColor && r.includeInReview !== false);
      
      if (colorRepertoires.length === 0) {
        return res.json({ 
          hasRepertoire: false,
          deviations: [],
          message: `No ${playerColor} repertoires found`
        });
      }
      
      // Get all lines from these repertoires
      const allLines: any[] = [];
      for (const rep of colorRepertoires) {
        const lines = await storage.getRepertoireLines(rep.id);
        allLines.push(...lines.map(l => ({ ...l, repertoireName: rep.name })));
      }
      
      if (allLines.length === 0) {
        return res.json({
          hasRepertoire: true,
          deviations: [],
          noLines: true,
          message: "Repertoire has no lines yet"
        });
      }
      
      // Replay the game and check each position
      const { Chess } = await import('chess.js');
      const game = new Chess();
      
      // Helper to normalize FEN for transposition matching
      // Only keeps en passant square if a legal e.p. capture is actually possible
      const normalizeFenForComparison = (fen: string): string => {
        const parts = fen.split(' ');
        if (parts.length < 4) return fen;
        
        const [position, activeColor, castling, epSquare] = parts;
        
        // If no e.p. square, nothing to normalize
        if (epSquare === '-') {
          return [position, activeColor, castling, '-'].join(' ');
        }
        
        // Check if there's actually a pawn that can capture e.p.
        // E.p. square is on rank 3 (white just pushed) or rank 6 (black just pushed)
        // The capturing pawn must be on an adjacent file on the appropriate rank
        const epFile = epSquare.charCodeAt(0) - 97; // 0-7 (a-h)
        const epRank = parseInt(epSquare[1]); // 3 or 6
        
        // Determine which color can capture and on which rank the capturing pawn would be
        const capturingColor = epRank === 3 ? 'b' : 'w'; // If e.p. on rank 3, black captures; on 6, white
        const capturingRank = epRank === 3 ? 4 : 5; // Capturing pawn is on rank 4 or 5
        
        // Parse the position to check for pawns
        const ranks = position.split('/');
        const captureRankIndex = 8 - capturingRank; // FEN ranks are from 8 to 1
        const rankStr = ranks[captureRankIndex];
        
        // Expand the rank string to 8 characters
        let expandedRank = '';
        for (const char of rankStr) {
          if (char >= '1' && char <= '8') {
            expandedRank += '.'.repeat(parseInt(char));
          } else {
            expandedRank += char;
          }
        }
        
        // Check adjacent files for capturing pawn
        const pawnChar = capturingColor === 'w' ? 'P' : 'p';
        let canCapture = false;
        
        // Check left adjacent file
        if (epFile > 0 && expandedRank[epFile - 1] === pawnChar) {
          canCapture = true;
        }
        // Check right adjacent file
        if (epFile < 7 && expandedRank[epFile + 1] === pawnChar) {
          canCapture = true;
        }
        
        // If no pawn can capture, normalize e.p. to '-'
        const normalizedEp = canCapture ? epSquare : '-';
        return [position, activeColor, castling, normalizedEp].join(' ');
      };
      
      const deviations: Array<{
        moveNumber: number;
        ply: number;
        position: string;
        movePlayed: string;
        expectedMoves: string[];
        isPlayerMove: boolean;
        repertoireName: string;
        deviationType: 'player_deviation' | 'opponent_deviation';
      }> = [];
      
      let lastKnownRepertoirePosition = true;
      
      for (let i = 0; i < moves.length; i++) {
        const fen = game.fen();
        // Normalize FEN: position + active color + castling + normalized e.p. (no move counts)
        const fenPosition = normalizeFenForComparison(fen);
        const isPlayerMove = (playerColor === 'white') === (i % 2 === 0);
        const moveNumber = Math.floor(i / 2) + 1;
        
        // Find repertoire lines that match this position (with normalized e.p.)
        const matchingLines = allLines.filter(l => {
          const lineFen = normalizeFenForComparison(l.fen);
          return lineFen === fenPosition;
        });
        
        if (matchingLines.length > 0) {
          lastKnownRepertoirePosition = true;
          const expectedMoves = [...new Set(matchingLines.map(l => l.correctMove))];
          const movePlayed = moves[i];
          
          if (!expectedMoves.includes(movePlayed)) {
            // This is a deviation
            deviations.push({
              moveNumber,
              ply: i,
              position: fen,
              movePlayed,
              expectedMoves,
              isPlayerMove,
              repertoireName: matchingLines[0].repertoireName,
              deviationType: isPlayerMove ? 'player_deviation' : 'opponent_deviation'
            });
            
            // After a deviation, we're out of repertoire
            lastKnownRepertoirePosition = false;
          }
        } else if (lastKnownRepertoirePosition && i < 20) {
          // If we were in repertoire but now have no matching lines, 
          // the game has left the prepared lines (but don't flag as deviation)
          lastKnownRepertoirePosition = false;
        }
        
        // Advance the game state
        const moveResult = game.move(moves[i], { sloppy: true });
        if (!moveResult) {
          // Invalid move, stop processing
          console.log(`Invalid move at ply ${i}: ${moves[i]}`);
          break;
        }
      }
      
      res.json({
        hasRepertoire: true,
        deviations,
        repertoiresChecked: colorRepertoires.map(r => r.name),
      });
    } catch (error) {
      console.error("Error checking game against repertoire:", error);
      res.status(500).json({ message: "Failed to check game" });
    }
  });

  // Lichess Opening Explorer proxy (for realistic bot moves)
  app.get('/api/lichess/explorer', async (req, res) => {
    try {
      const { fen } = req.query;
      if (!fen) {
        return res.status(400).json({ message: "FEN required" });
      }
      
      const response = await fetch(
        `https://explorer.lichess.ovh/lichess?variant=standard&speeds=blitz,rapid,classical&ratings=1600,1800,2000,2200,2500&fen=${encodeURIComponent(fen as string)}`
      );
      
      if (!response.ok) {
        return res.status(response.status).json({ message: "Lichess API error" });
      }
      
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Error fetching Lichess explorer:", error);
      res.status(500).json({ message: "Failed to fetch from Lichess" });
    }
  });

  const httpServer = createServer(app);

  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  const userConnections = new Map<string, WebSocket>();
  const matchRooms = new Map<string, Set<string>>();
  const disconnectTimers = new Map<string, NodeJS.Timeout>();
  const DISCONNECT_GRACE_PERIOD = 30000; // 30 seconds
  
  // ============ WEBSOCKET HEALTH CHECKS ============
  // Ping/pong mechanism to detect dead connections
  const HEARTBEAT_INTERVAL = 30000; // 30 seconds
  const CONNECTION_TIMEOUT = 35000; // 35 seconds (must be > HEARTBEAT_INTERVAL)
  
  interface ExtendedWebSocket extends WebSocket {
    isAlive?: boolean;
    userId?: string;
    matchId?: string;
    lastPong?: number;
  }
  
  // Heartbeat interval - ping all clients every 30 seconds
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws: ExtendedWebSocket) => {
      if (ws.isAlive === false) {
        // Connection didn't respond to last ping, terminate it
        console.log(`[WS Health] Terminating unresponsive connection${ws.userId ? ` for user ${ws.userId}` : ''}`);
        return ws.terminate();
      }
      
      ws.isAlive = false;
      ws.ping();
    });
  }, HEARTBEAT_INTERVAL);
  
  // Cleanup on server close
  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });
  
  // Log WebSocket stats periodically (every 5 minutes)
  setInterval(() => {
    const stats = {
      totalConnections: wss.clients.size,
      authenticatedUsers: authenticatedUsers.size,
      activeMatchRooms: matchRooms.size,
      pendingDisconnects: disconnectTimers.size,
    };
    console.log('[WS Stats]', stats);
  }, 300000);
  // ============ END WEBSOCKET HEALTH CHECKS ============
  
  // Track processed rematch requests to prevent duplicate handling
  const processedRematches = new Set<string>();
  
  // Track handshake state per match for OTB mode
  // Key: matchId, Value: { whiteOfferedHandshake: boolean, blackOfferedHandshake: boolean, whiteMoved: boolean, blackMoved: boolean }
  interface HandshakeState {
    whiteOfferedHandshake: boolean;
    blackOfferedHandshake: boolean;
    whiteMoved: boolean;
    blackMoved: boolean;
    // Track whether each player offered handshake BEFORE their first move (clean hands)
    whiteOfferedBeforeFirstMove: boolean;
    blackOfferedBeforeFirstMove: boolean;
    player1Color: "white" | "black";
    player1Id: string;
    player2Id: string;
  }
  const matchHandshakeState = new Map<string, HandshakeState>();

  // Track post-game handshake state per match
  interface PostGameHandshakeState {
    player1Offered: boolean;
    player2Offered: boolean;
    player1Id: string;
    player2Id: string;
    createdAt: number; // Timestamp for cleanup
    finalized: boolean; // True after cleanup has run - prevents late offers
  }
  const postGameHandshakeState = new Map<string, PostGameHandshakeState>();
  
  // Track which players have been credited for handshakes in each match
  // This prevents cleanup from resetting streaks for players who already offered
  const creditedHandshakes = new Map<string, Set<string>>(); // matchId -> Set<userId>
  
  // Track finalized matches to reject late offers after cleanup
  // Uses timestamps for 5-minute expiry to prevent memory bloat
  const finalizedMatchHandshakes = new Map<string, number>(); // matchId -> timestamp
  const FINALIZED_REGISTRY_EXPIRY = 5 * 60 * 1000; // 5 minutes
  
  // Cleanup stale post-game handshake states after 2 minutes (covers rematch scenarios)
  const POST_GAME_HANDSHAKE_TIMEOUT = 120000;
  
  // Helper function to finalize handshake state - resets streaks for non-participants
  async function finalizePostGameHandshake(matchId: string) {
    // Check if already finalized (via persistent registry)
    if (finalizedMatchHandshakes.has(matchId)) {
      console.log(`[Post-Game Handshake] Match ${matchId} already finalized, skipping`);
      return;
    }
    
    // Mark as finalized in persistent registry (survives state cleanup)
    finalizedMatchHandshakes.set(matchId, Date.now());
    
    const pgState = postGameHandshakeState.get(matchId);
    
    // Get set of credited players for this match
    const credited = creditedHandshakes.get(matchId) || new Set<string>();
    
    if (pgState) {
      // State exists - reset streak for players who didn't participate
      if (pgState.player1Id && !credited.has(pgState.player1Id)) {
        console.log(`[Post-Game Handshake] Resetting streak for player ${pgState.player1Id} (didn't handshake)`);
        await storage.breakHandshakeStreak(pgState.player1Id);
      }
      if (pgState.player2Id && !credited.has(pgState.player2Id)) {
        console.log(`[Post-Game Handshake] Resetting streak for player ${pgState.player2Id} (didn't handshake)`);
        await storage.breakHandshakeStreak(pgState.player2Id);
      }
    } else {
      // No state exists - fetch match to get player IDs and reset both streaks
      // This handles the case where neither player offered a handshake
      try {
        const match = await storage.getMatch(matchId);
        if (match) {
          if (match.player1Id && !credited.has(match.player1Id)) {
            console.log(`[Post-Game Handshake] Resetting streak for player ${match.player1Id} (no handshake state)`);
            await storage.breakHandshakeStreak(match.player1Id);
          }
          if (match.player2Id && !credited.has(match.player2Id)) {
            console.log(`[Post-Game Handshake] Resetting streak for player ${match.player2Id} (no handshake state)`);
            await storage.breakHandshakeStreak(match.player2Id);
          }
        }
      } catch (err) {
        console.error(`[Post-Game Handshake] Error fetching match ${matchId}:`, err);
      }
    }
    
    // Clean up tracking data (but finalized registry persists for 5 minutes)
    postGameHandshakeState.delete(matchId);
    creditedHandshakes.delete(matchId);
  }
  
  setInterval(async () => {
    const now = Date.now();
    
    // Cleanup stale post-game handshake states
    const matchesToCleanup: string[] = [];
    postGameHandshakeState.forEach((state, matchId) => {
      if (now - state.createdAt > POST_GAME_HANDSHAKE_TIMEOUT) {
        matchesToCleanup.push(matchId);
      }
    });
    
    for (const matchId of matchesToCleanup) {
      console.log(`[Post-Game Handshake] Cleaning up stale state for match ${matchId}`);
      try {
        await finalizePostGameHandshake(matchId);
      } catch (err) {
        console.error(`[Post-Game Handshake] Error finalizing state for match ${matchId}:`, err);
      }
    }
    
    // Prune expired entries from finalized registry
    const expiredFinalized: string[] = [];
    finalizedMatchHandshakes.forEach((timestamp, matchId) => {
      if (now - timestamp > FINALIZED_REGISTRY_EXPIRY) {
        expiredFinalized.push(matchId);
      }
    });
    for (const matchId of expiredFinalized) {
      finalizedMatchHandshakes.delete(matchId);
    }
  }, 30000); // Check every 30 seconds

  // ============ SIMUL VS SIMUL DATA STRUCTURES ============
  
  // Pairing rooms: Map<pairingId, Set<userId>> for broadcasting moves to 2 players
  const simulPairingRooms = new Map<string, Set<string>>();
  
  // Match rooms for Simul vs Simul: Map<matchId, Set<userId>> for match-wide announcements
  const simulMatchRooms = new Map<string, Set<string>>();
  
  // Timer state: Map<pairingId, { turn: 'white'|'black', deadline: number|null, timeRemaining: number }>
  interface SimulTimerState {
    turn: 'white' | 'black';
    deadline: number | null; // timestamp when timer expires, null if paused
    whiteTimeRemaining: number;
    blackTimeRemaining: number;
    isPaused: boolean;
  }
  const simulTimers = new Map<string, SimulTimerState>();
  
  // Focus state: Map<matchId, Map<playerId, FocusState>>
  interface SimulFocusState {
    activePairingId: string;
    lastManualSwitch: number; // timestamp
    pendingAutoSwitch: boolean;
    pendingAck: boolean; // true when waiting for client to acknowledge focus change
    pendingAckTimestamp: number; // when we started waiting for ack
  }
  const simulPlayerFocus = new Map<string, Map<string, SimulFocusState>>();
  
  // Auto-switch cooldown (prevent thrashing)
  const AUTO_SWITCH_COOLDOWN_MS = 3000;
  const SIMUL_TURN_TIMER_SECONDS = 30;
  const FOCUS_ACK_TIMEOUT_MS = 5000; // 5 seconds to acknowledge focus change
  
  // Helper: Compute next focus board using priority algorithm
  // Priority: (1) your turn, (2) lowest move count, (3) lowest board number
  // Returns null if only 1 or fewer ongoing games (no need to auto-switch)
  function computeAutoSwitchTarget(
    playerId: string,
    pairings: Array<{
      id: string;
      boardNumber: number;
      moveCount: number;
      activeColor: 'white' | 'black';
      playerColor: 'white' | 'black';
      result: string;
    }>,
    currentPairingId: string | null
  ): string | null {
    // Filter to only ongoing games
    const activeGames = pairings.filter(p => p.result === 'ongoing');
    
    // If no active games remain, nothing to switch to
    if (activeGames.length === 0) {
      return null;
    }
    
    // If exactly 1 active game, switch to it if not already there
    if (activeGames.length === 1) {
      const lastGame = activeGames[0];
      if (lastGame.id === currentPairingId) {
        return null; // Already on the last active game
      }
      console.log(`[AutoSwitch] Switching to last remaining board ${lastGame.boardNumber}`);
      return lastGame.id;
    }
    
    // Sort by priority: your turn first, then lowest moves, then lowest board
    const sorted = [...activeGames].sort((a, b) => {
      const aIsYourTurn = a.activeColor === a.playerColor;
      const bIsYourTurn = b.activeColor === b.playerColor;
      
      // Priority 1: Your turn
      if (aIsYourTurn && !bIsYourTurn) return -1;
      if (!aIsYourTurn && bIsYourTurn) return 1;
      
      // Priority 2: Lowest move count
      if (a.moveCount !== b.moveCount) return a.moveCount - b.moveCount;
      
      // Priority 3: Lowest board number
      return a.boardNumber - b.boardNumber;
    });
    
    const targetId = sorted[0]?.id;
    
    // Don't switch to the same board we're already on
    if (targetId === currentPairingId) {
      return null;
    }
    
    return targetId || null;
  }
  
  // Helper: Send focus update to a player
  function sendSimulFocusUpdate(
    userId: string,
    matchId: string,
    focusedPairingId: string,
    reason: 'initial' | 'auto_switch' | 'manual_switch' | 'opponent_moved'
  ) {
    const ws = userConnections.get(userId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'simul_focus_update',
        matchId,
        pairingId: focusedPairingId,
        reason,
      }));
    }
  }
  
  // Helper: Send timer state to relevant players
  function sendSimulTimerState(pairingId: string, timerState: SimulTimerState) {
    const room = simulPairingRooms.get(pairingId);
    if (room) {
      room.forEach((userId) => {
        const ws = userConnections.get(userId);
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'simul_timer_state',
            pairingId,
            turn: timerState.turn,
            whiteTimeRemaining: timerState.whiteTimeRemaining,
            blackTimeRemaining: timerState.blackTimeRemaining,
            isPaused: timerState.isPaused,
            deadline: timerState.deadline,
          }));
        }
      });
    }
  }
  
  // Helper: Calculate Simul ELO changes for a player after match completion
  // Only games against human opponents count - bots don't give ELO
  // K-factor = 32 / number_of_boards (for 5 boards, K = 6.4)
  async function calculateSimulEloChanges(
    matchId: string,
    allPairings: Array<{
      id: string;
      whitePlayerId: string | null;
      blackPlayerId: string | null;
      whiteIsBot: boolean;
      blackIsBot: boolean;
      result: string;
    }>,
    matchPlayers: Array<{ odId: string | null; isBot: boolean }>
  ): Promise<Map<string, { ratingChange: number; humanGamesPlayed: number; wins: number; losses: number; draws: number }>> {
    const playerRatingChanges = new Map<string, { ratingChange: number; humanGamesPlayed: number; wins: number; losses: number; draws: number }>();
    
    // Get human players only
    const humanPlayers = matchPlayers.filter(p => !p.isBot && p.odId);
    const boardCount = 5; // Simul vs Simul uses 5 boards
    const kFactor = 32 / boardCount; // K = 6.4 for 5 boards
    
    console.log(`[SimulElo] Calculating ELO for ${humanPlayers.length} human players with K=${kFactor}`);
    
    for (const player of humanPlayers) {
      const playerId = player.odId!;
      let totalRatingChange = 0;
      let humanGamesPlayed = 0;
      let wins = 0;
      let losses = 0;
      let draws = 0;
      
      // Get player's current simul rating
      const playerRating = await storage.getOrCreateRating(playerId);
      const playerSimulRating = playerRating.simul || 1000;
      
      // Find all games this player participated in
      const playerGames = allPairings.filter(p => 
        p.whitePlayerId === playerId || p.blackPlayerId === playerId
      );
      
      for (const game of playerGames) {
        const isWhite = game.whitePlayerId === playerId;
        const opponentIsBot = isWhite ? game.blackIsBot : game.whiteIsBot;
        const opponentId = isWhite ? game.blackPlayerId : game.whitePlayerId;
        
        // Skip bot games - bots don't give ELO
        if (opponentIsBot) {
          console.log(`[SimulElo] Player ${playerId} game vs bot - skipping ELO`);
          continue;
        }
        
        if (!opponentId) continue;
        
        // Get opponent's rating
        const opponentRating = await storage.getOrCreateRating(opponentId);
        const opponentSimulRating = opponentRating.simul || 1000;
        
        // Determine score (1 = win, 0.5 = draw, 0 = loss)
        let score: number;
        if (game.result === 'draw' || game.result === 'stalemate') {
          score = 0.5;
          draws++;
        } else if (
          (game.result === 'white_win' && isWhite) ||
          (game.result === 'black_win' && !isWhite)
        ) {
          score = 1;
          wins++;
        } else if (
          (game.result === 'white_win' && !isWhite) ||
          (game.result === 'black_win' && isWhite)
        ) {
          score = 0;
          losses++;
        } else {
          // Game not finished or unknown result
          continue;
        }
        
        humanGamesPlayed++;
        
        // Calculate expected score using ELO formula
        const expectedScore = 1 / (1 + Math.pow(10, (opponentSimulRating - playerSimulRating) / 400));
        
        // Calculate rating change for this game
        const gameRatingChange = kFactor * (score - expectedScore);
        totalRatingChange += gameRatingChange;
        
        console.log(`[SimulElo] Player ${playerId} vs ${opponentId}: score=${score}, expected=${expectedScore.toFixed(3)}, change=${gameRatingChange.toFixed(1)}`);
      }
      
      const roundedChange = Math.round(totalRatingChange);
      playerRatingChanges.set(playerId, {
        ratingChange: roundedChange,
        humanGamesPlayed,
        wins,
        losses,
        draws,
      });
      
      console.log(`[SimulElo] Player ${playerId}: total change=${roundedChange} (${humanGamesPlayed} human games: ${wins}W/${draws}D/${losses}L)`);
    }
    
    return playerRatingChanges;
  }
  
  // Helper: Apply Simul ELO changes to player ratings
  async function applySimulEloChanges(
    ratingChanges: Map<string, { ratingChange: number; humanGamesPlayed: number; wins: number; losses: number; draws: number }>
  ): Promise<void> {
    for (const [playerId, changes] of ratingChanges.entries()) {
      if (changes.ratingChange === 0 && changes.humanGamesPlayed === 0) {
        console.log(`[SimulElo] Player ${playerId}: no human games, skipping rating update`);
        continue;
      }
      
      const playerRating = await storage.getOrCreateRating(playerId);
      const currentSimulRating = playerRating.simul || 1000;
      const newSimulRating = Math.max(100, currentSimulRating + changes.ratingChange); // Min rating 100
      
      await storage.updateRating(playerId, { simul: newSimulRating });
      console.log(`[SimulElo] Player ${playerId}: ${currentSimulRating} -> ${newSimulRating} (${changes.ratingChange >= 0 ? '+' : ''}${changes.ratingChange})`);
    }
  }

  // Helper: Clean up match resources (timers, rooms, focus) when match ends
  function cleanupSimulMatch(matchId: string, pairingIds: string[]) {
    console.log(`[SimulCleanup] Cleaning up match ${matchId} with ${pairingIds.length} pairings`);
    
    // Clean up timers for all pairings
    for (const pairingId of pairingIds) {
      const timer = simulTimers.get(pairingId);
      if (timer) {
        timer.isPaused = true;
        timer.deadline = null;
      }
      simulTimers.delete(pairingId);
      simulPairingRooms.delete(pairingId);
    }
    
    // Clean up focus state and match room
    simulPlayerFocus.delete(matchId);
    simulMatchRooms.delete(matchId);
    
    console.log(`[SimulCleanup] Match ${matchId} cleanup complete`);
  }
  
  // Helper: Clean up a single player from a match (disconnect)
  function cleanupSimulPlayer(userId: string, matchId: string) {
    console.log(`[SimulCleanup] Cleaning up player ${userId} from match ${matchId}`);
    
    // Remove from match room
    const matchRoom = simulMatchRooms.get(matchId);
    if (matchRoom) {
      matchRoom.delete(userId);
    }
    
    // Remove from all pairing rooms
    for (const [pairingId, room] of simulPairingRooms.entries()) {
      room.delete(userId);
    }
    
    // Remove focus state
    const matchFocus = simulPlayerFocus.get(matchId);
    if (matchFocus) {
      matchFocus.delete(userId);
    }
  }
  
  // Helper: Make a bot move in a Simul vs Simul pairing
  async function makeSimulBotMove(pairingId: string) {
    try {
      const pairing = await storage.getSimulVsSimulPairing(pairingId);
      if (!pairing || pairing.result !== 'ongoing') {
        return; // Game is over
      }
      
      // Determine which side is the bot
      const isWhiteTurn = pairing.activeColor === 'white';
      const isBotTurn = isWhiteTurn ? pairing.whiteIsBot : pairing.blackIsBot;
      
      if (!isBotTurn) {
        return; // Not a bot's turn
      }
      
      const botId = isWhiteTurn ? pairing.whiteBotId : pairing.blackBotId;
      if (!botId) {
        console.error(`[SimulBot] Bot ID missing for ${isWhiteTurn ? 'white' : 'black'} in pairing ${pairingId}`);
        return;
      }
      
      // Determine bot personality from botId (format: "bot_personality_difficulty")
      const botParts = botId.split('_');
      const personality = (botParts[1] || 'balanced') as any;
      const difficulty = (botParts[2] || 'intermediate') as any;
      
      console.log(`[SimulBot] Making move for bot ${botId} in pairing ${pairingId}`);
      
      // Generate bot move
      const botMove = await generateBotMove(pairing.fen, personality, difficulty, pairing.moves || []);
      if (!botMove) {
        console.log(`[SimulBot] No valid move for bot in pairing ${pairingId}`);
        return;
      }
      
      // Apply the move to get new FEN
      const { Chess } = await import('chess.js');
      const game = new Chess(pairing.fen);
      const result = game.move({ from: botMove.from, to: botMove.to, promotion: botMove.promotion });
      if (!result) {
        console.error(`[SimulBot] Invalid move ${botMove.move} in pairing ${pairingId}`);
        return;
      }
      
      const newFen = game.fen();
      const newMoves = [...(pairing.moves || []), botMove.move];
      const newActiveColor = isWhiteTurn ? 'black' : 'white';
      
      // Check for game end conditions
      let gameResult = 'ongoing';
      let winner = null;
      
      if (game.isCheckmate()) {
        gameResult = 'checkmate';
        winner = isWhiteTurn ? 'white' : 'black';
      } else if (game.isStalemate()) {
        gameResult = 'stalemate';
      } else if (game.isDraw()) {
        gameResult = 'draw';
      }
      
      // Update the pairing in database
      await storage.updateSimulVsSimulPairing(pairingId, {
        fen: newFen,
        moves: newMoves,
        moveCount: newMoves.length,
        activeColor: newActiveColor as 'white' | 'black',
        lastMoveAt: new Date(),
        result: gameResult,
        winner,
      });
      
      // Update timer
      const timer = simulTimers.get(pairingId);
      if (timer && gameResult === 'ongoing') {
        timer.turn = newActiveColor as 'white' | 'black';
        // Reset timer for human player's turn
        if (newActiveColor === 'white') {
          timer.whiteTimeRemaining = SIMUL_TURN_TIMER_SECONDS;
        } else {
          timer.blackTimeRemaining = SIMUL_TURN_TIMER_SECONDS;
        }
        
        // Check if human opponent is focused on this board with confirmed focus
        const humanPlayerId = isWhiteTurn ? pairing.blackPlayerId : pairing.whitePlayerId;
        if (humanPlayerId) {
          const matchFocus = simulPlayerFocus.get(pairing.matchId);
          const humanFocus = matchFocus?.get(humanPlayerId);
          
          // Only start timer if opponent has confirmed focus on this board (not pending ack)
          if (humanFocus?.activePairingId === pairingId && !humanFocus?.pendingAck) {
            timer.isPaused = false;
            timer.deadline = Date.now() + (SIMUL_TURN_TIMER_SECONDS * 1000);
            console.log(`[SimulTimer] Started timer for ${humanPlayerId} after bot move on pairing ${pairingId}`);
          } else {
            timer.isPaused = true;
            timer.deadline = null;
          }
        }
        
        sendSimulTimerState(pairingId, timer);
      }
      
      // Broadcast bot move to ALL match participants AND board viewers
      // This ensures players receive bot moves even when viewing different boards
      const sentTo = new Set<string>();
      
      // First, send to all match participants (players who might be on other boards)
      const matchRoom = simulMatchRooms.get(pairing.matchId);
      if (matchRoom) {
        matchRoom.forEach((userId) => {
          const ws = userConnections.get(userId);
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'simul_opponent_move',
              pairingId,
              move: botMove.move,
              fen: newFen,
              from: botMove.from,
              to: botMove.to,
              piece: result.piece,
              captured: result.captured || null,
              moveCount: newMoves.length,
              activeColor: newActiveColor,
              isBot: true,
            }));
            sentTo.add(userId);
          }
        });
      }
      
      // Also send to pairing room viewers (spectators not in match room)
      const pairingRoom = simulPairingRooms.get(pairingId);
      if (pairingRoom) {
        pairingRoom.forEach((userId) => {
          if (sentTo.has(userId)) return; // Already sent
          const ws = userConnections.get(userId);
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'simul_opponent_move',
              pairingId,
              move: botMove.move,
              fen: newFen,
              from: botMove.from,
              to: botMove.to,
              piece: result.piece,
              captured: result.captured || null,
              moveCount: newMoves.length,
              activeColor: newActiveColor,
              isBot: true,
            }));
          }
        });
      }
      
      // If game ended, notify ALL match participants AND board viewers
      if (gameResult !== 'ongoing') {
        console.log(`[SimulBot] Game ended: ${gameResult}, winner: ${winner || 'none'}`);
        const gameEndSentTo = new Set<string>();
        
        // Send to all match participants
        const gameEndMatchRoom = simulMatchRooms.get(pairing.matchId);
        if (gameEndMatchRoom) {
          gameEndMatchRoom.forEach((userId) => {
            const ws = userConnections.get(userId);
            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({
                type: 'simul_game_end',
                pairingId,
                result: gameResult,
                winner,
              }));
              gameEndSentTo.add(userId);
            }
          });
        }
        
        // Also send to pairing room viewers (spectators not in match room)
        const gameEndPairingRoom = simulPairingRooms.get(pairingId);
        if (gameEndPairingRoom) {
          gameEndPairingRoom.forEach((userId) => {
            if (gameEndSentTo.has(userId)) return; // Already sent
            const ws = userConnections.get(userId);
            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({
                type: 'simul_game_end',
                pairingId,
                result: gameResult,
                winner,
              }));
            }
          });
        }
        
        // Check if the entire match is complete
        const matchId = pairing.matchId;
        const allPairings = await storage.getAllSimulVsSimulPairings(matchId);
        const allComplete = allPairings.every(p => p.result !== 'ongoing');
        
        if (allComplete) {
          console.log(`[SimulBot] Match ${matchId} complete - all games finished`);
          await storage.updateSimulVsSimulMatch(matchId, {
            status: 'completed',
            completedAt: new Date(),
          });
          
          // Calculate and apply Simul ELO changes
          const matchPlayers = await storage.getSimulVsSimulMatchPlayers(matchId);
          const ratingChanges = await calculateSimulEloChanges(matchId, allPairings, matchPlayers);
          await applySimulEloChanges(ratingChanges);
          
          // Notify all players in match (include their rating change)
          const matchRoom = simulMatchRooms.get(matchId);
          if (matchRoom) {
            matchRoom.forEach((roomUserId) => {
              const playerWs = userConnections.get(roomUserId);
              if (playerWs && playerWs.readyState === WebSocket.OPEN) {
                const playerStats = ratingChanges.get(roomUserId);
                playerWs.send(JSON.stringify({
                  type: 'simul_match_complete',
                  matchId,
                  ratingChange: playerStats?.ratingChange || 0,
                  humanGamesPlayed: playerStats?.humanGamesPlayed || 0,
                  wins: playerStats?.wins || 0,
                  losses: playerStats?.losses || 0,
                  draws: playerStats?.draws || 0,
                }));
              }
            });
          }
          
          // Clean up match resources
          cleanupSimulMatch(matchId, allPairings.map(p => p.id));
        }
      }
      
      // If it's still a bot's turn (opponent is also a bot), schedule next bot move
      if (gameResult === 'ongoing') {
        const nextIsBotTurn = newActiveColor === 'white' ? pairing.whiteIsBot : pairing.blackIsBot;
        if (nextIsBotTurn) {
          const thinkTime = calculateBotThinkTime(difficulty);
          setTimeout(() => makeSimulBotMove(pairingId), thinkTime);
        }
      }
      
    } catch (error) {
      console.error(`[SimulBot] Error making bot move in pairing ${pairingId}:`, error);
    }
  }
  
  // Timer scheduler: runs every second to update timers
  setInterval(async () => {
    const now = Date.now();
    
    // Debug: Log active timers
    const activeTimers = Array.from(simulTimers.entries()).filter(([_, t]) => !t.isPaused && t.deadline);
    if (activeTimers.length > 0) {
      console.log(`[SimulTimer] Active timers: ${activeTimers.length}, checking...`);
      for (const [pid, t] of activeTimers) {
        const remaining = Math.ceil((t.deadline! - now) / 1000);
        console.log(`[SimulTimer] Pairing ${pid}: ${remaining}s remaining, turn: ${t.turn}`);
      }
    }
    
    for (const [pairingId, timer] of simulTimers.entries()) {
      if (timer.isPaused || !timer.deadline) continue;
      
      // Check if timer expired
      if (now >= timer.deadline) {
        // Timer expired - forfeit this board
        timer.isPaused = true;
        timer.deadline = null;
        
        // Determine who lost on time
        const loser = timer.turn;
        const winner = loser === 'white' ? 'black' : 'white';
        
        console.log(`[SimulTimer] Timer expired for pairing ${pairingId}, ${loser} lost on time`);
        
        try {
          const pairing = await storage.getSimulVsSimulPairing(pairingId);
          if (pairing && pairing.result === 'ongoing') {
            await storage.updateSimulVsSimulPairing(pairingId, {
              result: winner === 'white' ? 'white_win' : 'black_win',
              completedAt: new Date(),
            });
            
            // Notify players in this pairing
            const room = simulPairingRooms.get(pairingId);
            if (room) {
              room.forEach((userId) => {
                const ws = userConnections.get(userId);
                if (ws && ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({
                    type: 'simul_game_end',
                    pairingId,
                    result: winner === 'white' ? 'white_win' : 'black_win',
                    reason: 'timeout',
                  }));
                }
              });
            }
            
            // Check if match is complete
            const matchId = pairing.matchId;
            const allPairings = await storage.getAllSimulVsSimulPairings(matchId);
            const allComplete = allPairings.every(p => p.result !== 'ongoing');
            
            if (allComplete) {
              await storage.updateSimulVsSimulMatch(matchId, {
                status: 'completed',
                completedAt: new Date(),
              });
              
              // Calculate and apply Simul ELO changes
              const matchPlayers = await storage.getSimulVsSimulMatchPlayers(matchId);
              const ratingChanges = await calculateSimulEloChanges(matchId, allPairings, matchPlayers);
              await applySimulEloChanges(ratingChanges);
              
              // Notify all players in match before cleanup (include their rating change)
              const matchRoom = simulMatchRooms.get(matchId);
              if (matchRoom) {
                matchRoom.forEach((roomUserId) => {
                  const playerWs = userConnections.get(roomUserId);
                  if (playerWs && playerWs.readyState === WebSocket.OPEN) {
                    const playerStats = ratingChanges.get(roomUserId);
                    playerWs.send(JSON.stringify({
                      type: 'simul_match_complete',
                      matchId,
                      ratingChange: playerStats?.ratingChange || 0,
                      humanGamesPlayed: playerStats?.humanGamesPlayed || 0,
                      wins: playerStats?.wins || 0,
                      losses: playerStats?.losses || 0,
                      draws: playerStats?.draws || 0,
                    }));
                  }
                });
              }
              
              // Clean up match resources
              cleanupSimulMatch(matchId, allPairings.map(p => p.id));
            } else {
              // Trigger auto-switch for both players
              console.log(`[SimulTimer] Auto-switch needed, checking focus for match ${matchId}`);
              const matchFocus = simulPlayerFocus.get(matchId);
              console.log(`[SimulTimer] matchFocus exists: ${!!matchFocus}, players: ${matchFocus ? Array.from(matchFocus.keys()).join(', ') : 'none'}`);
              if (matchFocus) {
                for (const [playerId, focus] of matchFocus.entries()) {
                  console.log(`[SimulTimer] Player ${playerId} focus: activePairingId=${focus.activePairingId}, expired=${pairingId}, match=${focus.activePairingId === pairingId}`);
                  if (focus.activePairingId === pairingId) {
                    // This player was watching the expired game, trigger auto-switch
                    const playerGames = await storage.getSimulVsSimulPlayerGames(matchId, playerId);
                    const pairingsForSwitch = playerGames.map(p => ({
                      id: p.id,
                      boardNumber: p.whitePlayerId === playerId ? p.boardNumberWhite : p.boardNumberBlack,
                      moveCount: p.moveCount,
                      activeColor: p.activeColor as 'white' | 'black',
                      playerColor: (p.whitePlayerId === playerId ? 'white' : 'black') as 'white' | 'black',
                      result: p.result,
                    }));
                    
                    console.log(`[SimulTimer] Computing auto-switch target for player ${playerId}, ${pairingsForSwitch.length} games`);
                    const nextBoard = computeAutoSwitchTarget(playerId, pairingsForSwitch, pairingId);
                    console.log(`[SimulTimer] Next board: ${nextBoard}, current: ${pairingId}`);
                    if (nextBoard && nextBoard !== pairingId) {
                      focus.activePairingId = nextBoard;
                      focus.pendingAutoSwitch = false;
                      focus.pendingAck = true;
                      focus.pendingAckTimestamp = Date.now();
                      console.log(`[SimulTimer] Sending focus update to player ${playerId} for board ${nextBoard}`);
                      sendSimulFocusUpdate(playerId, matchId, nextBoard, 'auto_switch');
                    }
                  }
                }
              }
            }
          }
        } catch (error) {
          console.error('[SimulTimer] Error processing timeout:', error);
        }
      } else {
        // Update remaining time
        const remaining = Math.max(0, Math.ceil((timer.deadline - now) / 1000));
        if (timer.turn === 'white') {
          timer.whiteTimeRemaining = remaining;
        } else {
          timer.blackTimeRemaining = remaining;
        }
        
        // Send periodic updates every 5 seconds
        if (remaining % 5 === 0 || remaining <= 5) {
          sendSimulTimerState(pairingId, timer);
        }
      }
    }
  }, 1000);
  
  // ============ END SIMUL VS SIMUL DATA STRUCTURES ============

  wss.on('connection', (ws: ExtendedWebSocket) => {
    console.log('WebSocket client connected');
    
    // Mark connection as alive on connect
    ws.isAlive = true;
    ws.lastPong = Date.now();
    
    // Handle pong responses for health check
    ws.on('pong', () => {
      ws.isAlive = true;
      ws.lastPong = Date.now();
    });

    ws.on('message', async (message: string) => {
      try {
        const data = JSON.parse(message.toString());
        console.log('Received WebSocket message:', data);
        
        if (data.type === 'auth') {
          const userId = data.userId;
          if (!userId || typeof userId !== 'string') {
            ws.send(JSON.stringify({ type: 'error', message: 'Invalid user ID' }));
            return;
          }
          
          ws.userId = userId;
          userConnections.set(userId, ws);
          authenticatedUsers.add(userId);
          
          // Cancel any pending disconnect timer if user reconnects
          const existingTimer = disconnectTimers.get(userId);
          if (existingTimer) {
            clearTimeout(existingTimer);
            disconnectTimers.delete(userId);
            ws.send(JSON.stringify({ type: 'reconnected' }));
          }
          
          ws.send(JSON.stringify({ type: 'authenticated', userId }));
        } else if (data.type === 'join_queue') {
          const userId = ws.userId;
          if (!userId) {
            ws.send(JSON.stringify({ type: 'error', message: 'Not authenticated' }));
            return;
          }

          // Clean up: Remove player from any previous match room before joining new queue
          // This prevents memory leaks and duplicate events from old completed matches
          if (ws.matchId) {
            const oldRoom = matchRooms.get(ws.matchId);
            if (oldRoom) {
              oldRoom.delete(userId);
              if (oldRoom.size === 0) {
                matchRooms.delete(ws.matchId);
              }
            }
            ws.matchId = undefined;
          }

          const { timeControl } = data;
          if (!['bullet', 'blitz', 'rapid', 'classical'].includes(timeControl)) {
            ws.send(JSON.stringify({ type: 'error', message: 'Invalid time control' }));
            return;
          }

          const rating = await storage.getOrCreateRating(userId);
          const ratingMap = {
            bullet: rating.bullet,
            blitz: rating.blitz,
            rapid: rating.rapid,
            classical: rating.classical
          };
          const playerRating = ratingMap[timeControl as keyof typeof ratingMap];

          const socketId = Math.random().toString(36).substring(7);
          (ws as any).socketId = socketId;

          const match = queueManager.join(userId, socketId, timeControl, playerRating);

          if (!match) {
            ws.send(JSON.stringify({ type: 'queue_joined', timeControl }));
            return;
          }
          
          if (match) {
            const timeMap = { bullet: 1, blitz: 5, rapid: 15, classical: 30 };
            const time = timeMap[timeControl as keyof typeof timeMap];
            
            const player1Color = Math.random() > 0.5 ? "white" : "black";
            const player2Color = player1Color === "white" ? "black" : "white";

            const player1 = await storage.getUser(match.player1.userId);
            const player2 = await storage.getUser(match.player2.userId);

            const player1Name = `${player1?.firstName || 'Opponent'} ${player1?.lastName || ''}`.trim();
            const player2Name = `${player2?.firstName || 'Opponent'} ${player2?.lastName || ''}`.trim();

            const whitePlayerId = player1Color === "white" ? match.player1.userId : match.player2.userId;
            const blackPlayerId = player1Color === "black" ? match.player1.userId : match.player2.userId;
            const whitePlayerName = player1Color === "white" ? player1Name : player2Name;
            const blackPlayerName = player1Color === "black" ? player1Name : player2Name;

            // Create game for player 1
            // Note: blindfoldEnabled is NOT set automatically from settings
            // It should only be set when player explicitly enables blindfold mode for a game
            const player1GameData: any = {
              userId: match.player1.userId,
              whitePlayerId: whitePlayerId,
              blackPlayerId: blackPlayerId,
              mode: `standard_${timeControl}`,
              playerColor: player1Color,
              timeControl: time * 60,
              increment: 0,
              fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
              whiteTime: time * 60,
              blackTime: time * 60,
              opponentName: player2Name,
            };
            const player1Game = await storage.createGame(player1GameData);

            // Create game for player 2
            const player2GameData: any = {
              userId: match.player2.userId,
              whitePlayerId: whitePlayerId,
              blackPlayerId: blackPlayerId,
              mode: `standard_${timeControl}`,
              playerColor: player2Color,
              timeControl: time * 60,
              increment: 0,
              fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
              whiteTime: time * 60,
              blackTime: time * 60,
              opponentName: player1Name,
            };
            const player2Game = await storage.createGame(player2GameData);

            // Create match record with both game IDs
            const matchRecord = await storage.createMatch({
              player1Id: match.player1.userId,
              player2Id: match.player2.userId,
              matchType: `standard_${timeControl}`,
              gameIds: [player1Game.id, player2Game.id],
              status: 'in_progress',
            });

            // CRITICAL: Update BOTH games' matchId to link them to the match
            console.log('[DEBUG] [WebSocket queue match] Updating games with matchId:', matchRecord.id);
            const updatedPlayer1Game = await storage.updateGame(player1Game.id, { matchId: matchRecord.id });
            const updatedPlayer2Game = await storage.updateGame(player2Game.id, { matchId: matchRecord.id });
            console.log('[DEBUG] [WebSocket queue match] Both games updated - matchIds:', updatedPlayer1Game.matchId, updatedPlayer2Game.matchId);

            const player1Ws = userConnections.get(match.player1.userId);
            const player2Ws = userConnections.get(match.player2.userId);

            // Fetch fresh ratings from DB to ensure consistency between players
            // timeControl is already 'blitz' or 'rapid' - use it directly as the rating category
            const player1RatingsData = await storage.getRating(match.player1.userId);
            const player2RatingsData = await storage.getRating(match.player2.userId);
            const player1FreshRating = (player1RatingsData as any)?.[timeControl] || 1200;
            const player2FreshRating = (player2RatingsData as any)?.[timeControl] || 1200;
            console.log(`[DEBUG] [Ratings] timeControl=${timeControl}, player1=${match.player1.userId} rating=${player1FreshRating}, player2=${match.player2.userId} rating=${player2FreshRating}`);
            console.log(`[DEBUG] [Ratings] player1RatingsData:`, player1RatingsData);
            console.log(`[DEBUG] [Ratings] player2RatingsData:`, player2RatingsData);

            if (player1Ws && player1Ws.readyState === WebSocket.OPEN) {
              player1Ws.send(JSON.stringify({
                type: 'match_found',
                matchId: matchRecord.id,
                game: updatedPlayer1Game,
                timeControl,
                color: player1Color,
                opponent: {
                  name: player2Name,
                  rating: player2FreshRating,
                },
                playerRating: player1FreshRating,
              }));
            }

            if (player2Ws && player2Ws.readyState === WebSocket.OPEN) {
              player2Ws.send(JSON.stringify({
                type: 'match_found',
                matchId: matchRecord.id,
                game: updatedPlayer2Game,
                timeControl,
                color: player2Color,
                opponent: {
                  name: player1Name,
                  rating: player1FreshRating,
                },
                playerRating: player2FreshRating,
              }));
            }
          }
        } else if (data.type === 'leave_queue') {
          const userId = ws.userId;
          if (userId) {
            queueManager.leave(userId);
            ws.send(JSON.stringify({ type: 'queue_left' }));
          }
        } else if (data.type === 'join_match') {
          const matchId = data.matchId;
          const userId = ws.userId;
          
          if (!userId) {
            ws.send(JSON.stringify({ type: 'error', message: 'Not authenticated' }));
            return;
          }
          
          console.log(`[Reconnect] User ${userId} joining match ${matchId} at ${new Date().toISOString()}`);
          console.log(`[Reconnect] disconnectTimers has entry for ${userId}: ${disconnectTimers.has(userId)}`);
          ws.matchId = matchId;
          
          // Add to match room first
          if (!matchRooms.has(matchId)) {
            matchRooms.set(matchId, new Set());
          }
          matchRooms.get(matchId)!.add(userId);
          console.log(`[Reconnect] Added user ${userId} to match room ${matchId}`);
          
          // Cancel any pending disconnect timer (player reconnected)
          if (disconnectTimers.has(userId)) {
            clearTimeout(disconnectTimers.get(userId)!);
            disconnectTimers.delete(userId);
            console.log(`[Reconnect] Cancelled disconnect timer for user ${userId} in match ${matchId}`);
            
            // Notify opponent that player reconnected
            try {
              const games = await storage.getGamesByMatchId(matchId);
              const opponentUserId = games.find(g => g.userId !== userId)?.userId;
              
              if (opponentUserId) {
                const opponentWs = userConnections.get(opponentUserId);
                if (opponentWs && opponentWs.readyState === WebSocket.OPEN) {
                  opponentWs.send(JSON.stringify({
                    type: 'opponent_reconnected',
                    matchId: matchId,
                  }));
                  console.log(`[Reconnect] Notified opponent ${opponentUserId} of reconnection`);
                }
              }
            } catch (error) {
              console.error('[Reconnect] Error notifying opponent:', error);
            }
          } else {
            console.log(`[Reconnect] No disconnect timer found for user ${userId} (normal first join or rematch)`);
          }
          
          // Initialize handshake state for this match if it doesn't exist
          // This ensures we can track moves and handshakes from the start
          let handshakeState = matchHandshakeState.get(matchId);
          if (!handshakeState) {
            handshakeState = {
              whiteOfferedHandshake: false,
              blackOfferedHandshake: false,
              whiteMoved: false,
              blackMoved: false,
              whiteOfferedBeforeFirstMove: false,
              blackOfferedBeforeFirstMove: false,
              player1Color: "white",
              player1Id: "",
              player2Id: "",
            };
            matchHandshakeState.set(matchId, handshakeState);
          }
          
          // Send current handshake state to the joining player
          ws.send(JSON.stringify({ 
            type: 'joined_match', 
            matchId,
            handshakeState: {
              whiteOfferedHandshake: handshakeState.whiteOfferedHandshake,
              blackOfferedHandshake: handshakeState.blackOfferedHandshake,
              whiteMoved: handshakeState.whiteMoved,
              blackMoved: handshakeState.blackMoved,
              whiteOfferedBeforeFirstMove: handshakeState.whiteOfferedBeforeFirstMove,
              blackOfferedBeforeFirstMove: handshakeState.blackOfferedBeforeFirstMove,
            },
          }));
        } else if (data.type === 'move') {
          const matchId = ws.matchId;
          const userId = ws.userId;
          const playerColor = data.playerColor as "white" | "black" | undefined;
          
          console.log(`[WS Move] Received move from ${userId} (${playerColor}) in match ${matchId}: ${data.move}`);
          
          if (!matchId || !userId) {
            console.log(`[WS Move] ERROR: Not in a match - matchId: ${matchId}, userId: ${userId}`);
            ws.send(JSON.stringify({ type: 'error', message: 'Not in a match' }));
            return;
          }
          
          // Track first move for handshake violation detection
          // Initialize state if it doesn't exist (important: player may move before handshake)
          let state = matchHandshakeState.get(matchId);
          if (!state) {
            state = {
              whiteOfferedHandshake: false,
              blackOfferedHandshake: false,
              whiteMoved: false,
              blackMoved: false,
              whiteOfferedBeforeFirstMove: false,
              blackOfferedBeforeFirstMove: false,
              player1Color: "white",
              player1Id: "",
              player2Id: "",
            };
            matchHandshakeState.set(matchId, state);
          }
          
          if (playerColor) {
            if (playerColor === "white" && !state.whiteMoved) {
              state.whiteMoved = true;
              console.log(`[Handshake] White made first move. Offered handshake before: ${state.whiteOfferedBeforeFirstMove}`);
            } else if (playerColor === "black" && !state.blackMoved) {
              state.blackMoved = true;
              console.log(`[Handshake] Black made first move. Offered handshake before: ${state.blackOfferedBeforeFirstMove}`);
            }
          }
          
          try {
            const match = await storage.getMatch(matchId);
            if (match) {
              const games = await storage.getGamesByMatchId(matchId);
              const userGame = games.find(g => g.userId === userId);
              
              if (userGame) {
                const isWhite = userGame.playerColor === 'white';
                const updateField = isWhite ? 'whiteMoveCount' : 'blackMoveCount';
                const currentCount = isWhite ? (userGame.whiteMoveCount || 0) : (userGame.blackMoveCount || 0);
                
                await storage.updateGame(userGame.id, {
                  [updateField]: currentCount + 1
                });
              }
            }
          } catch (error) {
            console.error('Error updating move count:', error);
          }
          
          const roomUsers = matchRooms.get(matchId);
          console.log(`[WS Move] Match room ${matchId} has users:`, roomUsers ? Array.from(roomUsers) : 'NO ROOM');
          
          if (roomUsers) {
            roomUsers.forEach((roomUserId) => {
              if (roomUserId !== userId) {
                const opponentWs = userConnections.get(roomUserId);
                console.log(`[WS Move] Sending to opponent ${roomUserId}, connected: ${!!opponentWs}, readyState: ${opponentWs?.readyState}`);
                if (opponentWs && opponentWs.readyState === WebSocket.OPEN) {
                  opponentWs.send(JSON.stringify({
                    type: 'opponent_move',
                    matchId: matchId,
                    move: data.move,
                    fen: data.fen,
                    whiteTime: data.whiteTime,
                    blackTime: data.blackTime,
                    from: data.from,
                    to: data.to,
                    piece: data.piece,
                    captured: data.captured,
                  }));
                  console.log(`[WS Move] Sent opponent_move to ${roomUserId}`);
                }
              }
            });
          }
        } else if (data.type === 'arbiter_call') {
          const matchId = ws.matchId;
          const userId = ws.userId;
          
          if (!matchId || !userId) return;
          
          const roomUsers = matchRooms.get(matchId);
          if (roomUsers) {
            roomUsers.forEach((roomUserId) => {
              if (roomUserId !== userId) {
                const opponentWs = userConnections.get(roomUserId);
                if (opponentWs && opponentWs.readyState === WebSocket.OPEN) {
                  opponentWs.send(JSON.stringify({
                    type: 'arbiter_call',
                    matchId: matchId,
                    callerId: userId,
                    moveIndex: data.moveIndex,
                  }));
                }
              }
            });
          }
        } else if (data.type === 'arbiter_ruling') {
          const matchId = ws.matchId;
          const userId = ws.userId;
          
          console.log(`[WS Arbiter] Received arbiter_ruling from ${userId} in match ${matchId || 'NONE'}`);
          console.log(`[WS Arbiter] Data:`, JSON.stringify(data));
          
          if (!matchId || !userId) {
            console.log(`[WS Arbiter] EARLY RETURN - matchId: ${matchId}, userId: ${userId}`);
            return;
          }
          
          // Send arbiter ruling to ALL players in the match (including sender)
          // Both players need to see the ruling to update their boards, times, and violation counters
          // Include previousFen so both clients can restore to identical board state
          const roomUsers = matchRooms.get(matchId);
          console.log(`[WS Arbiter] Match room users: ${roomUsers ? Array.from(roomUsers).join(', ') : 'NONE'}`);
          
          if (roomUsers) {
            roomUsers.forEach((roomUserId) => {
              const playerWs = userConnections.get(roomUserId);
              console.log(`[WS Arbiter] Broadcasting to ${roomUserId}: ws=${playerWs ? 'exists' : 'null'}, readyState=${playerWs?.readyState}`);
              if (playerWs && playerWs.readyState === WebSocket.OPEN) {
                playerWs.send(JSON.stringify({
                  type: 'arbiter_ruling',
                  matchId: matchId,
                  ruling: data.ruling,
                  violatorId: data.violatorId,
                  timeAdjustment: data.timeAdjustment,
                  forfeit: data.forfeit,
                  forfeitReason: data.forfeitReason,
                  previousFen: data.previousFen,
                  claimType: data.claimType,
                }));
                console.log(`[WS Arbiter] Sent arbiter_ruling to ${roomUserId}`);
              }
            });
          } else {
            console.log(`[WS Arbiter] No room users found for match ${matchId}`);
          }
        } else if (data.type === 'clock_update') {
          const matchId = ws.matchId;
          const userId = ws.userId;
          
          if (!matchId || !userId) return;
          
          const roomUsers = matchRooms.get(matchId);
          if (roomUsers) {
            roomUsers.forEach((roomUserId) => {
              if (roomUserId !== userId) {
                const opponentWs = userConnections.get(roomUserId);
                if (opponentWs && opponentWs.readyState === WebSocket.OPEN) {
                  opponentWs.send(JSON.stringify({
                    type: 'clock_sync',
                    matchId: matchId,
                    whiteTime: data.whiteTime,
                    blackTime: data.blackTime,
                  }));
                }
              }
            });
          }
        } else if (data.type === 'piece_touch') {
          const matchId = ws.matchId;
          const userId = ws.userId;
          
          if (!matchId || !userId) return;
          
          const roomUsers = matchRooms.get(matchId);
          if (roomUsers) {
            roomUsers.forEach((roomUserId) => {
              if (roomUserId !== userId) {
                const opponentWs = userConnections.get(roomUserId);
                if (opponentWs && opponentWs.readyState === WebSocket.OPEN) {
                  opponentWs.send(JSON.stringify({
                    type: 'opponent_touch',
                    matchId: matchId,
                    square: data.square,
                  }));
                }
              }
            });
          }
        } else if (data.type === 'handshake_offer') {
          const matchId = data.matchId;
          const userId = ws.userId;
          const playerColor = data.playerColor as "white" | "black";
          
          if (!matchId || !userId) return;
          
          // Track handshake state for this match
          let state = matchHandshakeState.get(matchId);
          if (!state) {
            // Initialize state - we'll set player IDs when we have both
            state = {
              whiteOfferedHandshake: false,
              blackOfferedHandshake: false,
              whiteMoved: false,
              blackMoved: false,
              whiteOfferedBeforeFirstMove: false,
              blackOfferedBeforeFirstMove: false,
              player1Color: "white",
              player1Id: "",
              player2Id: "",
            };
            matchHandshakeState.set(matchId, state);
          }
          
          // Update handshake state based on player color
          // Track if handshake is offered BEFORE first move (clean hands)
          if (playerColor === "white") {
            state.whiteOfferedHandshake = true;
            // Mark as offered before first move if they haven't moved yet
            if (!state.whiteMoved) {
              state.whiteOfferedBeforeFirstMove = true;
            }
          } else if (playerColor === "black") {
            state.blackOfferedHandshake = true;
            // Mark as offered before first move if they haven't moved yet
            if (!state.blackMoved) {
              state.blackOfferedBeforeFirstMove = true;
            }
          }
          console.log(`[Handshake] Player ${userId} (${playerColor}) offered handshake in match ${matchId}. State:`, state);
          
          const roomUsers = matchRooms.get(matchId);
          if (roomUsers) {
            roomUsers.forEach((roomUserId) => {
              if (roomUserId !== userId) {
                const opponentWs = userConnections.get(roomUserId);
                if (opponentWs && opponentWs.readyState === WebSocket.OPEN) {
                  opponentWs.send(JSON.stringify({
                    type: 'handshake_offer',
                    matchId: matchId,
                  }));
                }
              }
            });
          }
        } else if (data.type === 'post_game_handshake_offer') {
          // Post-game courtesy handshake - each player is responsible for their own sportsmanship
          // Offering/accepting increments streak, not participating resets streak
          const matchId = data.matchId;
          const userId = ws.userId;
          
          if (!matchId || !userId) return;
          
          console.log(`[Post-Game Handshake] Player ${userId} offered post-game handshake in match ${matchId}`);
          
          // Check if match handshakes were already finalized (prevents late offers after cleanup)
          if (finalizedMatchHandshakes.has(matchId)) {
            console.log(`[Post-Game Handshake] Match ${matchId} already finalized, rejecting late offer from ${userId}`);
            return;
          }
          
          // Check if player was already credited for this match (prevents double-counting)
          const credited = creditedHandshakes.get(matchId);
          if (credited?.has(userId)) {
            console.log(`[Post-Game Handshake] Player ${userId} already credited for match ${matchId}`);
            return;
          }
          
          // Get or create post-game handshake state
          let pgState = postGameHandshakeState.get(matchId);
          const roomUsers = matchRooms.get(matchId);
          
          if (!pgState) {
            // Get match to know both player IDs
            const match = await storage.getMatch(matchId);
            if (!match) {
              console.log(`[Post-Game Handshake] Match ${matchId} not found`);
              return;
            }
            
            pgState = {
              player1Offered: false,
              player2Offered: false,
              player1Id: match.player1Id,
              player2Id: match.player2Id,
              createdAt: Date.now(),
              finalized: false,
            };
            postGameHandshakeState.set(matchId, pgState);
          }
          
          // Check if this player already offered (prevent double-counting)
          const isPlayer1 = userId === pgState.player1Id;
          const isPlayer2 = userId === pgState.player2Id;
          const alreadyOffered = (isPlayer1 && pgState.player1Offered) || (isPlayer2 && pgState.player2Offered);
          
          if (alreadyOffered) {
            console.log(`[Post-Game Handshake] Player ${userId} already offered in match ${matchId}`);
            return;
          }
          
          // Mark this player as having offered
          if (isPlayer1) {
            pgState.player1Offered = true;
          } else if (isPlayer2) {
            pgState.player2Offered = true;
          } else {
            console.log(`[Post-Game Handshake] Player ${userId} not in match ${matchId}`);
            return;
          }
          
          // Track that this player has been credited
          if (!creditedHandshakes.has(matchId)) {
            creditedHandshakes.set(matchId, new Set<string>());
          }
          creditedHandshakes.get(matchId)!.add(userId);
          
          // IMMEDIATELY record handshake for the player who offered (increment their streak)
          const result = await storage.recordHandshake(userId);
          console.log(`[Post-Game Handshake] Player ${userId} streak: ${result.streak}`);
          
          // Notify player of badge if earned (exactly at 10)
          if (result.badges.includes("sportsman") && result.streak === 10) {
            const playerWs = userConnections.get(userId);
            if (playerWs && playerWs.readyState === WebSocket.OPEN) {
              playerWs.send(JSON.stringify({
                type: 'badge_earned',
                badge: 'sportsman',
                message: 'Sportsman badge earned! 10 consecutive post-game handshakes.',
              }));
            }
          }
          
          // Notify opponent of the handshake offer
          if (roomUsers) {
            roomUsers.forEach((roomUserId) => {
              if (roomUserId !== userId) {
                const opponentWs = userConnections.get(roomUserId);
                if (opponentWs && opponentWs.readyState === WebSocket.OPEN) {
                  opponentWs.send(JSON.stringify({
                    type: 'post_game_handshake_offer',
                    matchId: matchId,
                  }));
                }
              }
            });
          }
        } else if (data.type === 'offer_draw') {
          const matchId = data.matchId;
          const userId = ws.userId;
          
          if (!matchId || !userId) return;
          
          const roomUsers = matchRooms.get(matchId);
          if (roomUsers) {
            roomUsers.forEach((roomUserId) => {
              if (roomUserId !== userId) {
                const opponentWs = userConnections.get(roomUserId);
                if (opponentWs && opponentWs.readyState === WebSocket.OPEN) {
                  opponentWs.send(JSON.stringify({
                    type: 'draw_offer',
                    matchId: matchId,
                    from: userId,
                  }));
                }
              }
            });
          }
        } else if (data.type === 'respond_draw') {
          const matchId = data.matchId;
          const userId = ws.userId;
          const accepted = data.accepted;
          
          if (!matchId || !userId) return;
          
          const roomUsers = matchRooms.get(matchId);
          if (roomUsers) {
            roomUsers.forEach((roomUserId) => {
              if (roomUserId !== userId) {
                const opponentWs = userConnections.get(roomUserId);
                if (opponentWs && opponentWs.readyState === WebSocket.OPEN) {
                  opponentWs.send(JSON.stringify({
                    type: 'draw_response',
                    matchId: matchId,
                    accepted: accepted,
                  }));
                }
              }
            });
          }
        // ============ SIMUL VS SIMUL WEBSOCKET HANDLERS ============
        } else if (data.type === 'simul_join') {
          const userId = ws.userId;
          const matchId = data.matchId;
          
          if (!userId) {
            ws.send(JSON.stringify({ type: 'error', message: 'Not authenticated' }));
            return;
          }
          
          console.log(`[SimulWS] User ${userId} (type: ${typeof userId}) joining simul match ${matchId}`);
          
          try {
            const match = await storage.getSimulVsSimulMatch(matchId);
            if (!match) {
              ws.send(JSON.stringify({ type: 'error', message: 'Match not found' }));
              return;
            }
            
            // Add to simul match room
            if (!simulMatchRooms.has(matchId)) {
              simulMatchRooms.set(matchId, new Set());
            }
            simulMatchRooms.get(matchId)!.add(userId);
            
            // Get player's games and add to pairing rooms
            const playerGames = await storage.getSimulVsSimulPlayerGames(matchId, userId);
            
            console.log(`[SimulWS] Found ${playerGames.length} games for user ${userId} in match ${matchId}`);
            console.log(`[SimulWS] Game details:`, playerGames.map(p => ({
              id: p.id,
              whitePlayerId: p.whitePlayerId,
              blackPlayerId: p.blackPlayerId,
              boardNumWhite: p.boardNumberWhite,
              boardNumBlack: p.boardNumberBlack
            })));
            
            for (const pairing of playerGames) {
              if (!simulPairingRooms.has(pairing.id)) {
                simulPairingRooms.set(pairing.id, new Set());
              }
              simulPairingRooms.get(pairing.id)!.add(userId);
              
              // Initialize timer if not exists
              if (!simulTimers.has(pairing.id)) {
                simulTimers.set(pairing.id, {
                  turn: pairing.activeColor as 'white' | 'black',
                  deadline: null,
                  whiteTimeRemaining: SIMUL_TURN_TIMER_SECONDS,
                  blackTimeRemaining: SIMUL_TURN_TIMER_SECONDS,
                  isPaused: true, // Start paused until both players focus
                });
              }
            }
            
            // Initialize focus state
            if (!simulPlayerFocus.has(matchId)) {
              simulPlayerFocus.set(matchId, new Map());
            }
            
            // Compute initial focus
            const pairingsForSwitch = playerGames.map(p => ({
              id: p.id,
              boardNumber: p.whitePlayerId === userId ? p.boardNumberWhite : p.boardNumberBlack,
              moveCount: p.moveCount,
              activeColor: p.activeColor as 'white' | 'black',
              playerColor: (p.whitePlayerId === userId ? 'white' : 'black') as 'white' | 'black',
              result: p.result,
            }));
            
            const initialFocus = computeAutoSwitchTarget(userId, pairingsForSwitch, null);
            
            if (initialFocus) {
              simulPlayerFocus.get(matchId)!.set(userId, {
                activePairingId: initialFocus,
                lastManualSwitch: 0,
                pendingAutoSwitch: false,
                pendingAck: false,
                pendingAckTimestamp: 0,
              });
            }
            
            // Get all players info for the match
            const allPlayers = await storage.getSimulVsSimulMatchPlayers(matchId);
            
            console.log(`[SimulWS] All players in match:`, allPlayers.map(p => ({
              odId: p.odId,
              isBot: p.isBot,
              botPersonality: p.botPersonality,
              seat: p.odnt
            })));
            
            // Send join confirmation with full match data
            ws.send(JSON.stringify({
              type: 'simul_joined',
              matchId,
              boards: playerGames.map(p => {
                const isWhite = p.whitePlayerId === userId;
                const opponentId = isWhite ? p.blackPlayerId : p.whitePlayerId;
                const opponentPlayer = allPlayers.find(pl => pl.odId === opponentId);
                
                return {
                  pairingId: p.id,
                  boardNumber: isWhite ? p.boardNumberWhite : p.boardNumberBlack,
                  color: isWhite ? 'white' : 'black',
                  opponentId,
                  opponentName: opponentPlayer?.isBot 
                    ? `Bot (${opponentPlayer.botPersonality})` 
                    : 'Opponent',
                  isOpponentBot: isWhite ? p.blackIsBot : p.whiteIsBot,
                  fen: p.fen,
                  moves: p.moves,
                  moveCount: p.moveCount,
                  activeColor: p.activeColor,
                  result: p.result,
                };
              }),
              initialFocus,
              players: allPlayers.map(p => ({
                odId: p.odId,
                isBot: p.isBot,
                botPersonality: p.botPersonality,
                seat: p.odnt,
              })),
            }));
            
            console.log(`[SimulWS] User ${userId} joined simul match ${matchId} with ${playerGames.length} boards`);
            console.log(`[SimulWS] Sending ${playerGames.length} boards and ${allPlayers.length} players to client`);
            
            // Trigger initial bot moves for games where white is a bot
            // Only do this once per pairing - use a Set to track which we've started
            for (const pairing of playerGames) {
              if (pairing.whiteIsBot && pairing.moveCount === 0 && pairing.result === 'ongoing') {
                // Check if we haven't already scheduled this bot move
                // Use the timer's deadline as a proxy - if it's already set, bot move was scheduled
                const timer = simulTimers.get(pairing.id);
                if (timer && timer.whiteTimeRemaining === SIMUL_TURN_TIMER_SECONDS && !timer.deadline) {
                  const botId = pairing.whiteBotId;
                  const botParts = (botId || '').split('_');
                  const difficulty = (botParts[2] || 'intermediate') as any;
                  const thinkTime = calculateBotThinkTime(difficulty);
                  console.log(`[SimulBot] Scheduling initial white bot move in ${thinkTime}ms for pairing ${pairing.id}`);
                  setTimeout(() => makeSimulBotMove(pairing.id), thinkTime);
                }
              }
            }
          } catch (error) {
            console.error('[SimulWS] Error joining simul match:', error);
            ws.send(JSON.stringify({ type: 'error', message: 'Failed to join match' }));
          }
          
        } else if (data.type === 'simul_move') {
          const userId = ws.userId;
          const { pairingId, move, fen, from, to, piece, captured } = data;
          
          if (!userId) {
            ws.send(JSON.stringify({ type: 'error', message: 'Not authenticated' }));
            return;
          }
          
          console.log(`[SimulWS] Move from ${userId} in pairing ${pairingId}: ${move}`);
          
          try {
            const pairing = await storage.getSimulVsSimulPairing(pairingId);
            if (!pairing) {
              ws.send(JSON.stringify({ type: 'error', message: 'Game not found' }));
              return;
            }
            
            // Verify it's the player's turn
            const isWhite = pairing.whitePlayerId === userId;
            const isBlack = pairing.blackPlayerId === userId;
            if (!isWhite && !isBlack) {
              ws.send(JSON.stringify({ type: 'error', message: 'Not your game' }));
              return;
            }
            
            const playerColor = isWhite ? 'white' : 'black';
            if (pairing.activeColor !== playerColor) {
              ws.send(JSON.stringify({ type: 'error', message: 'Not your turn' }));
              return;
            }
            
            // Update the pairing
            const newMoves = [...(pairing.moves || []), move];
            const newActiveColor = playerColor === 'white' ? 'black' : 'white';
            
            await storage.updateSimulVsSimulPairing(pairingId, {
              fen,
              moves: newMoves,
              moveCount: newMoves.length,
              activeColor: newActiveColor,
              lastMoveAt: new Date(),
            });
            
            // Update timer - pause current player's, reset opponent's
            const timer = simulTimers.get(pairingId);
            if (timer) {
              timer.turn = newActiveColor;
              // Reset timer for next player's turn
              if (newActiveColor === 'white') {
                timer.whiteTimeRemaining = SIMUL_TURN_TIMER_SECONDS;
              } else {
                timer.blackTimeRemaining = SIMUL_TURN_TIMER_SECONDS;
              }
              
              // Check if opponent is focused on this board with confirmed focus to start their timer
              const matchFocus = simulPlayerFocus.get(pairing.matchId);
              const opponentId = isWhite ? pairing.blackPlayerId : pairing.whitePlayerId;
              const opponentFocus = opponentId ? matchFocus?.get(opponentId) : null;
              
              // Only start timer if opponent has confirmed focus on this board (not pending ack)
              if (opponentFocus?.activePairingId === pairingId && !opponentFocus?.pendingAck) {
                // Opponent is watching with confirmed focus, start their timer
                timer.isPaused = false;
                timer.deadline = Date.now() + (SIMUL_TURN_TIMER_SECONDS * 1000);
                console.log(`[SimulTimer] Started timer for ${opponentId} after human move on pairing ${pairingId}`);
              } else {
                // Opponent not watching or focus not confirmed, pause timer
                timer.isPaused = true;
                timer.deadline = null;
              }
              
              sendSimulTimerState(pairingId, timer);
            }
            
            // Broadcast move to opponent
            const room = simulPairingRooms.get(pairingId);
            if (room) {
              room.forEach((roomUserId) => {
                if (roomUserId !== userId) {
                  const opponentWs = userConnections.get(roomUserId);
                  if (opponentWs && opponentWs.readyState === WebSocket.OPEN) {
                    opponentWs.send(JSON.stringify({
                      type: 'simul_opponent_move',
                      pairingId,
                      move,
                      fen,
                      from,
                      to,
                      piece,
                      captured,
                      moveCount: newMoves.length,
                      activeColor: newActiveColor,
                    }));
                  }
                }
              });
            }
            
            // After moving, trigger auto-switch for the player who just moved
            const matchId = pairing.matchId;
            const matchFocus = simulPlayerFocus.get(matchId);
            const playerFocus = matchFocus?.get(userId);
            
            if (playerFocus && playerFocus.activePairingId === pairingId) {
              // Player was on this board, check if they should auto-switch
              const playerGames = await storage.getSimulVsSimulPlayerGames(matchId, userId);
              const pairingsForSwitch = playerGames.map(p => ({
                id: p.id,
                boardNumber: p.whitePlayerId === userId ? p.boardNumberWhite : p.boardNumberBlack,
                moveCount: p.id === pairingId ? newMoves.length : p.moveCount,
                activeColor: (p.id === pairingId ? newActiveColor : p.activeColor) as 'white' | 'black',
                playerColor: (p.whitePlayerId === userId ? 'white' : 'black') as 'white' | 'black',
                result: p.result,
              }));
              
              const nextBoard = computeAutoSwitchTarget(userId, pairingsForSwitch, pairingId);
              if (nextBoard && nextBoard !== pairingId) {
                playerFocus.activePairingId = nextBoard;
                playerFocus.pendingAutoSwitch = false;
                playerFocus.pendingAck = true;
                playerFocus.pendingAckTimestamp = Date.now();
                sendSimulFocusUpdate(userId, matchId, nextBoard, 'auto_switch');
              }
            }
            
            // Confirm move to sender
            ws.send(JSON.stringify({
              type: 'simul_move_confirmed',
              pairingId,
              moveCount: newMoves.length,
            }));
            
            // Check if it's now a bot's turn - schedule bot move
            const nextPlayerIsBot = newActiveColor === 'white' ? pairing.whiteIsBot : pairing.blackIsBot;
            if (nextPlayerIsBot) {
              const botId = newActiveColor === 'white' ? pairing.whiteBotId : pairing.blackBotId;
              const botParts = (botId || '').split('_');
              const difficulty = (botParts[2] || 'intermediate') as any;
              const thinkTime = calculateBotThinkTime(difficulty);
              console.log(`[SimulBot] Scheduling bot move in ${thinkTime}ms for pairing ${pairingId}`);
              setTimeout(() => makeSimulBotMove(pairingId), thinkTime);
            }
            
          } catch (error) {
            console.error('[SimulWS] Error processing simul move:', error);
            ws.send(JSON.stringify({ type: 'error', message: 'Failed to process move' }));
          }
          
        } else if (data.type === 'simul_switch_board') {
          const userId = ws.userId;
          const { matchId, pairingId } = data;
          
          if (!userId) {
            ws.send(JSON.stringify({ type: 'error', message: 'Not authenticated' }));
            return;
          }
          
          console.log(`[SimulWS] User ${userId} switching to board ${pairingId}`);
          
          const matchFocus = simulPlayerFocus.get(matchId);
          if (!matchFocus) {
            ws.send(JSON.stringify({ type: 'error', message: 'Match not found' }));
            return;
          }
          
          const playerFocus = matchFocus.get(userId);
          const now = Date.now();
          
          // Check cooldown
          if (playerFocus && (now - playerFocus.lastManualSwitch) < AUTO_SWITCH_COOLDOWN_MS) {
            ws.send(JSON.stringify({ type: 'error', message: 'Switch cooldown active' }));
            return;
          }
          
          const previousPairingId = playerFocus?.activePairingId;
          
          // Update focus with pending ack - timer won't start until client confirms
          matchFocus.set(userId, {
            activePairingId: pairingId,
            lastManualSwitch: now,
            pendingAutoSwitch: false,
            pendingAck: true,
            pendingAckTimestamp: now,
          });
          
          // Handle timer state changes
          // Pause timer on old board if we were the one whose turn it was
          if (previousPairingId) {
            const oldTimer = simulTimers.get(previousPairingId);
            if (oldTimer && !oldTimer.isPaused) {
              const pairing = await storage.getSimulVsSimulPairing(previousPairingId);
              if (pairing) {
                const playerColor = pairing.whitePlayerId === userId ? 'white' : 'black';
                if (oldTimer.turn === playerColor) {
                  // We were the active player, pause our timer
                  oldTimer.isPaused = true;
                  oldTimer.deadline = null;
                  sendSimulTimerState(previousPairingId, oldTimer);
                }
              }
            }
          }
          
          // NOTE: Timer on new board is NOT started here - it starts in simul_focus_ack
          // This prevents timer running if client never received the switch confirmation
          
          // Send focus update with confirmation - client must ack to start timer
          ws.send(JSON.stringify({
            type: 'simul_switch_confirmed',
            matchId,
            pairingId,
            previousPairingId: previousPairingId || null,
            reason: 'manual_switch',
          }));
          
          sendSimulFocusUpdate(userId, matchId, pairingId, 'manual_switch');
          
        } else if (data.type === 'simul_focus_ack') {
          // Client acknowledges focus - clears pending state and starts timer
          const userId = ws.userId;
          const { matchId, pairingId } = data;
          
          if (!userId) return;
          
          const matchFocus = simulPlayerFocus.get(matchId);
          if (!matchFocus) return;
          
          const playerFocus = matchFocus.get(userId);
          if (!playerFocus) return;
          
          if (playerFocus.activePairingId !== pairingId) {
            // Client is out of sync - force resync
            ws.send(JSON.stringify({
              type: 'simul_focus_resync',
              matchId,
              correctPairingId: playerFocus.activePairingId,
            }));
            return;
          }
          
          // Clear pending ack state if set
          if (playerFocus.pendingAck) {
            playerFocus.pendingAck = false;
            playerFocus.pendingAckTimestamp = 0;
          }
          
          // Always try to start timer if it's this player's turn and timer is paused
          // This handles both initial focus (white's first move) and manual switches
          const timer = simulTimers.get(pairingId);
          if (timer && timer.isPaused) {
            try {
              const pairing = await storage.getSimulVsSimulPairing(pairingId);
              if (pairing && pairing.result === 'ongoing') {
                const playerColor = pairing.whitePlayerId === userId ? 'white' : 'black';
                if (timer.turn === playerColor) {
                  // It's our turn, start the timer now that focus is confirmed
                  const timeRemaining = playerColor === 'white' 
                    ? timer.whiteTimeRemaining 
                    : timer.blackTimeRemaining;
                  timer.isPaused = false;
                  timer.deadline = Date.now() + (timeRemaining * 1000);
                  console.log(`[SimulTimer] Started timer for ${userId} on pairing ${pairingId} (${timeRemaining}s remaining)`);
                  sendSimulTimerState(pairingId, timer);
                }
              }
            } catch (error) {
              console.error('[SimulWS] Error starting timer after ack:', error);
            }
          }
          
        } else if (data.type === 'simul_game_result') {
          const userId = ws.userId;
          const { pairingId, result, reason, thinkingTimes } = data;
          
          if (!userId) {
            ws.send(JSON.stringify({ type: 'error', message: 'Not authenticated' }));
            return;
          }
          
          console.log(`[SimulWS] Game result for pairing ${pairingId}: ${result} (${reason})`);
          
          try {
            const pairing = await storage.getSimulVsSimulPairing(pairingId);
            if (!pairing || pairing.result !== 'ongoing') return;
            
            // Determine game result for games table
            let gameResult: 'white_win' | 'black_win' | 'draw' | 'ongoing' = 'ongoing';
            if (result === 'white_win') gameResult = 'white_win';
            else if (result === 'black_win') gameResult = 'black_win';
            else if (result === 'draw') gameResult = 'draw';
            
            // Create games table entries for analysis if human players are involved
            let whiteGameId: string | null = null;
            let blackGameId: string | null = null;
            
            // Get player names for the game record
            const matchPlayers = await storage.getSimulVsSimulMatchPlayers(pairing.matchId);
            const whitePlayerInfo = !pairing.whiteIsBot && pairing.whitePlayerId 
              ? matchPlayers.find(mp => mp.odId === pairing.whitePlayerId) 
              : null;
            const blackPlayerInfo = !pairing.blackIsBot && pairing.blackPlayerId 
              ? matchPlayers.find(mp => mp.odId === pairing.blackPlayerId) 
              : null;
            
            // Create game for white player (if human)
            if (!pairing.whiteIsBot && pairing.whitePlayerId) {
              const opponentName = blackPlayerInfo?.username || (pairing.blackIsBot ? `Bot ${pairing.blackBotId}` : 'Unknown');
              const whiteGame = await storage.createGame({
                userId: pairing.whitePlayerId,
                whitePlayerId: pairing.whitePlayerId,
                blackPlayerId: pairing.blackPlayerId,
                mode: 'simul_vs_simul',
                status: 'completed',
                result: gameResult,
                opponentName,
                playerColor: 'white',
                timeControl: 30,
                fen: pairing.fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
                moves: pairing.moves || [],
                thinkingTimes: thinkingTimes || [],
              });
              whiteGameId = whiteGame.id;
            }
            
            // Create game for black player (if human)
            if (!pairing.blackIsBot && pairing.blackPlayerId) {
              const opponentName = whitePlayerInfo?.username || (pairing.whiteIsBot ? `Bot ${pairing.whiteBotId}` : 'Unknown');
              const blackGame = await storage.createGame({
                userId: pairing.blackPlayerId,
                whitePlayerId: pairing.whitePlayerId,
                blackPlayerId: pairing.blackPlayerId,
                mode: 'simul_vs_simul',
                status: 'completed',
                result: gameResult,
                opponentName,
                playerColor: 'black',
                timeControl: 30,
                fen: pairing.fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
                moves: pairing.moves || [],
                thinkingTimes: thinkingTimes || [],
              });
              blackGameId = blackGame.id;
            }
            
            await storage.updateSimulVsSimulPairing(pairingId, {
              result,
              completedAt: new Date(),
              gameId: whiteGameId || blackGameId,
            });
            
            // Stop timer
            const timer = simulTimers.get(pairingId);
            if (timer) {
              timer.isPaused = true;
              timer.deadline = null;
            }
            
            // Notify both players with their respective gameId for analysis
            const room = simulPairingRooms.get(pairingId);
            if (room) {
              room.forEach((roomUserId) => {
                const playerWs = userConnections.get(roomUserId);
                if (playerWs && playerWs.readyState === WebSocket.OPEN) {
                  let playerGameId: string | null = null;
                  if (pairing.whitePlayerId && roomUserId === pairing.whitePlayerId) {
                    playerGameId = whiteGameId;
                  } else if (pairing.blackPlayerId && roomUserId === pairing.blackPlayerId) {
                    playerGameId = blackGameId;
                  }
                  playerWs.send(JSON.stringify({
                    type: 'simul_game_end',
                    pairingId,
                    result,
                    reason,
                    gameId: playerGameId,
                  }));
                }
              });
            }
            
            // Check if match is complete
            const matchId = pairing.matchId;
            const allPairings = await storage.getAllSimulVsSimulPairings(matchId);
            const allComplete = allPairings.every(p => p.result !== 'ongoing');
            
            if (allComplete) {
              await storage.updateSimulVsSimulMatch(matchId, {
                status: 'completed',
                completedAt: new Date(),
              });
              
              // Calculate and apply Simul ELO changes
              const matchPlayers = await storage.getSimulVsSimulMatchPlayers(matchId);
              const ratingChanges = await calculateSimulEloChanges(matchId, allPairings, matchPlayers);
              await applySimulEloChanges(ratingChanges);
              
              // Notify all players in match before cleanup (include their rating change)
              const matchRoom = simulMatchRooms.get(matchId);
              if (matchRoom) {
                matchRoom.forEach((roomUserId) => {
                  const playerWs = userConnections.get(roomUserId);
                  if (playerWs && playerWs.readyState === WebSocket.OPEN) {
                    const playerStats = ratingChanges.get(roomUserId);
                    playerWs.send(JSON.stringify({
                      type: 'simul_match_complete',
                      matchId,
                      ratingChange: playerStats?.ratingChange || 0,
                      humanGamesPlayed: playerStats?.humanGamesPlayed || 0,
                      wins: playerStats?.wins || 0,
                      losses: playerStats?.losses || 0,
                      draws: playerStats?.draws || 0,
                    }));
                  }
                });
              }
              
              // Clean up match resources (timers, rooms, focus state)
              cleanupSimulMatch(matchId, allPairings.map(p => p.id));
            } else {
              // Trigger auto-switch for players who were watching this game
              const matchFocus = simulPlayerFocus.get(matchId);
              if (matchFocus) {
                for (const [playerId, focus] of matchFocus.entries()) {
                  if (focus.activePairingId === pairingId) {
                    const playerGames = await storage.getSimulVsSimulPlayerGames(matchId, playerId);
                    const pairingsForSwitch = playerGames.map(p => ({
                      id: p.id,
                      boardNumber: p.whitePlayerId === playerId ? p.boardNumberWhite : p.boardNumberBlack,
                      moveCount: p.moveCount,
                      activeColor: p.activeColor as 'white' | 'black',
                      playerColor: (p.whitePlayerId === playerId ? 'white' : 'black') as 'white' | 'black',
                      result: p.id === pairingId ? result : p.result,
                    }));
                    
                    const ongoingBoards = pairingsForSwitch.filter(p => p.result === 'ongoing');
                    console.log(`[AutoSwitch-GameEnd] Player ${playerId}: ended board=${pairingId}, ongoing boards=${JSON.stringify(ongoingBoards.map(b => ({ id: b.id, num: b.boardNumber })))}`);
                    
                    const nextBoard = computeAutoSwitchTarget(playerId, pairingsForSwitch, pairingId);
                    console.log(`[AutoSwitch-GameEnd] Next board computed: ${nextBoard}`);
                    
                    if (nextBoard && nextBoard !== pairingId) {
                      focus.activePairingId = nextBoard;
                      focus.pendingAck = true;
                      focus.pendingAckTimestamp = Date.now();
                      const nextBoardInfo = pairingsForSwitch.find(p => p.id === nextBoard);
                      console.log(`[AutoSwitch-GameEnd] Switching player ${playerId} to board #${nextBoardInfo?.boardNumber}`);
                      sendSimulFocusUpdate(playerId, matchId, nextBoard, 'auto_switch');
                    }
                  }
                }
              }
            }
            
          } catch (error) {
            console.error('[SimulWS] Error processing game result:', error);
          }
          
        } else if (data.type === 'simul_offer_draw') {
          const userId = ws.userId;
          const { pairingId } = data;
          
          if (!userId) {
            ws.send(JSON.stringify({ type: 'error', message: 'Not authenticated' }));
            return;
          }
          
          console.log(`[SimulWS] Draw offer from ${userId} for pairing ${pairingId}`);
          
          try {
            const pairing = await storage.getSimulVsSimulPairing(pairingId);
            if (!pairing || pairing.result !== 'ongoing') {
              ws.send(JSON.stringify({ type: 'error', message: 'Game not found or already complete' }));
              return;
            }
            
            // Determine opponent
            const isWhitePlayer = pairing.whitePlayerId === userId;
            const opponentId = isWhitePlayer ? pairing.blackPlayerId : pairing.whitePlayerId;
            const opponentIsBot = isWhitePlayer ? pairing.blackIsBot : pairing.whiteIsBot;
            
            // If opponent is a bot, auto-decline the draw
            if (opponentIsBot) {
              ws.send(JSON.stringify({
                type: 'simul_draw_response',
                pairingId,
                accepted: false,
              }));
              return;
            }
            
            // Send draw offer to opponent
            if (opponentId) {
              const opponentWs = userConnections.get(opponentId);
              if (opponentWs && opponentWs.readyState === WebSocket.OPEN) {
                opponentWs.send(JSON.stringify({
                  type: 'simul_draw_offer',
                  pairingId,
                  from: userId,
                }));
              }
            }
          } catch (error) {
            console.error('[SimulWS] Error processing draw offer:', error);
          }
          
        } else if (data.type === 'simul_respond_draw') {
          const userId = ws.userId;
          const { pairingId, accepted } = data;
          
          if (!userId) {
            ws.send(JSON.stringify({ type: 'error', message: 'Not authenticated' }));
            return;
          }
          
          console.log(`[SimulWS] Draw response from ${userId} for pairing ${pairingId}: ${accepted ? 'accepted' : 'declined'}`);
          
          try {
            const pairing = await storage.getSimulVsSimulPairing(pairingId);
            if (!pairing || pairing.result !== 'ongoing') {
              ws.send(JSON.stringify({ type: 'error', message: 'Game not found or already complete' }));
              return;
            }
            
            // Find the opponent who made the offer
            const isWhitePlayer = pairing.whitePlayerId === userId;
            const opponentId = isWhitePlayer ? pairing.blackPlayerId : pairing.whitePlayerId;
            
            // Notify opponent of the response
            if (opponentId) {
              const opponentWs = userConnections.get(opponentId);
              if (opponentWs && opponentWs.readyState === WebSocket.OPEN) {
                opponentWs.send(JSON.stringify({
                  type: 'simul_draw_response',
                  pairingId,
                  accepted,
                }));
              }
            }
            
            // Also send to the responder for confirmation
            ws.send(JSON.stringify({
              type: 'simul_draw_response',
              pairingId,
              accepted,
            }));
            
            // If accepted, end the game as a draw
            if (accepted) {
              // Get player names for the game record
              const matchPlayers = await storage.getSimulVsSimulMatchPlayers(pairing.matchId);
              const whitePlayerInfo = !pairing.whiteIsBot && pairing.whitePlayerId 
                ? matchPlayers.find(mp => mp.odId === pairing.whitePlayerId) 
                : null;
              const blackPlayerInfo = !pairing.blackIsBot && pairing.blackPlayerId 
                ? matchPlayers.find(mp => mp.odId === pairing.blackPlayerId) 
                : null;
              
              // Create game records for both players
              let whiteGameId: string | null = null;
              let blackGameId: string | null = null;
              
              if (!pairing.whiteIsBot && pairing.whitePlayerId) {
                const opponentName = blackPlayerInfo?.username || (pairing.blackIsBot ? `Bot ${pairing.blackBotId}` : 'Unknown');
                const whiteGame = await storage.createGame({
                  userId: pairing.whitePlayerId,
                  whitePlayerId: pairing.whitePlayerId,
                  blackPlayerId: pairing.blackPlayerId,
                  mode: 'simul_vs_simul',
                  status: 'completed',
                  result: 'draw',
                  opponentName,
                  playerColor: 'white',
                  timeControl: 30,
                  fen: pairing.fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
                  moves: pairing.moves || [],
                  thinkingTimes: [],
                });
                whiteGameId = whiteGame.id;
              }
              
              if (!pairing.blackIsBot && pairing.blackPlayerId) {
                const opponentName = whitePlayerInfo?.username || (pairing.whiteIsBot ? `Bot ${pairing.whiteBotId}` : 'Unknown');
                const blackGame = await storage.createGame({
                  userId: pairing.blackPlayerId,
                  whitePlayerId: pairing.whitePlayerId,
                  blackPlayerId: pairing.blackPlayerId,
                  mode: 'simul_vs_simul',
                  status: 'completed',
                  result: 'draw',
                  opponentName,
                  playerColor: 'black',
                  timeControl: 30,
                  fen: pairing.fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
                  moves: pairing.moves || [],
                  thinkingTimes: [],
                });
                blackGameId = blackGame.id;
              }
              
              await storage.updateSimulVsSimulPairing(pairingId, {
                result: 'draw',
                completedAt: new Date(),
                gameId: whiteGameId || blackGameId,
              });
              
              // Stop timer
              const timer = simulTimers.get(pairingId);
              if (timer) {
                timer.isPaused = true;
                timer.deadline = null;
              }
              
              // Notify both players of game end
              const room = simulPairingRooms.get(pairingId);
              if (room) {
                room.forEach((roomUserId) => {
                  const playerWs = userConnections.get(roomUserId);
                  if (playerWs && playerWs.readyState === WebSocket.OPEN) {
                    let playerGameId: string | null = null;
                    if (pairing.whitePlayerId && roomUserId === pairing.whitePlayerId) {
                      playerGameId = whiteGameId;
                    } else if (pairing.blackPlayerId && roomUserId === pairing.blackPlayerId) {
                      playerGameId = blackGameId;
                    }
                    playerWs.send(JSON.stringify({
                      type: 'simul_game_end',
                      pairingId,
                      result: 'draw',
                      reason: 'agreement',
                      gameId: playerGameId,
                    }));
                  }
                });
              }
              
              // Check if match is complete
              const matchId = pairing.matchId;
              const allPairings = await storage.getAllSimulVsSimulPairings(matchId);
              const allComplete = allPairings.every(p => p.result !== 'ongoing');
              
              if (allComplete) {
                await storage.updateSimulVsSimulMatch(matchId, {
                  status: 'completed',
                  completedAt: new Date(),
                });
                
                // Calculate and apply Simul ELO changes
                const ratingChanges = await calculateSimulEloChanges(matchId, allPairings, matchPlayers);
                await applySimulEloChanges(ratingChanges);
                
                // Notify all players
                const matchRoom = simulMatchRooms.get(matchId);
                if (matchRoom) {
                  matchRoom.forEach((roomUserId) => {
                    const playerWs = userConnections.get(roomUserId);
                    if (playerWs && playerWs.readyState === WebSocket.OPEN) {
                      const playerStats = ratingChanges.get(roomUserId);
                      playerWs.send(JSON.stringify({
                        type: 'simul_match_complete',
                        matchId,
                        ratingChange: playerStats?.ratingChange || 0,
                        humanGamesPlayed: playerStats?.humanGamesPlayed || 0,
                        wins: playerStats?.wins || 0,
                        losses: playerStats?.losses || 0,
                        draws: playerStats?.draws || 0,
                      }));
                    }
                  });
                }
                
                // Clean up match resources
                cleanupSimulMatch(matchId, allPairings.map(p => p.id));
              } else {
                // Trigger auto-switch for players who were watching this game
                const matchFocus = simulPlayerFocus.get(pairing.matchId);
                if (matchFocus) {
                  for (const [playerId, focus] of matchFocus.entries()) {
                    if (focus.activePairingId === pairingId) {
                      const playerGames = await storage.getSimulVsSimulPlayerGames(pairing.matchId, playerId);
                      const pairingsForSwitch = playerGames.map(p => ({
                        id: p.id,
                        boardNumber: p.whitePlayerId === playerId ? p.boardNumberWhite : p.boardNumberBlack,
                        moveCount: p.moveCount,
                        activeColor: p.activeColor as 'white' | 'black',
                        playerColor: (p.whitePlayerId === playerId ? 'white' : 'black') as 'white' | 'black',
                        result: p.id === pairingId ? 'draw' : p.result,
                      }));
                      
                      const nextBoard = computeAutoSwitchTarget(playerId, pairingsForSwitch, pairingId);
                      if (nextBoard && nextBoard !== pairingId) {
                        focus.activePairingId = nextBoard;
                        focus.pendingAck = true;
                        focus.pendingAckTimestamp = Date.now();
                        sendSimulFocusUpdate(playerId, pairing.matchId, nextBoard, 'auto_switch');
                      }
                    }
                  }
                }
              }
            }
          } catch (error) {
            console.error('[SimulWS] Error processing draw response:', error);
          }
          
        // ============ END SIMUL VS SIMUL WEBSOCKET HANDLERS ============
          
        } else if (data.type === 'request_rematch') {
          const matchId = data.matchId;
          const userId = ws.userId;
          
          console.log('[WS request_rematch] Received from:', userId, 'matchId:', matchId);
          
          if (!matchId || !userId) return;
          
          // Finalize post-game handshake when rematch is requested (resets streaks for non-participants)
          // Always call to ensure finalized registry is populated, blocking late offers
          console.log(`[Post-Game Handshake] Finalizing state on rematch request for match ${matchId}`);
          await finalizePostGameHandshake(matchId);
          
          const roomUsers = matchRooms.get(matchId);
          console.log('[WS request_rematch] Room users:', roomUsers ? Array.from(roomUsers) : 'NO ROOM FOUND');
          
          if (roomUsers) {
            roomUsers.forEach((roomUserId) => {
              if (roomUserId !== userId) {
                const opponentWs = userConnections.get(roomUserId);
                console.log('[WS request_rematch] Sending to opponent:', roomUserId, 'WS ready:', opponentWs?.readyState === WebSocket.OPEN);
                if (opponentWs && opponentWs.readyState === WebSocket.OPEN) {
                  opponentWs.send(JSON.stringify({
                    type: 'rematch_request',
                    matchId: matchId,
                    from: userId,
                  }));
                }
              }
            });
          }
        } else if (data.type === 'respond_rematch') {
          const matchId = data.matchId;
          const userId = ws.userId;
          const accepted = data.accepted;
          
          console.log('[WS respond_rematch] Received from:', userId, 'matchId:', matchId, 'accepted:', accepted);
          
          if (!matchId || !userId) return;
          
          // Idempotency check - prevent duplicate rematch processing
          if (accepted && processedRematches.has(matchId)) {
            console.log('[WS respond_rematch] Already processed rematch for matchId:', matchId, '- ignoring duplicate');
            return;
          }
          
          // Mark as processed IMMEDIATELY after check to prevent race conditions
          // The try/finally below handles cleanup on any failure
          if (accepted) {
            processedRematches.add(matchId);
            // Clean up old entries after 5 minutes to prevent memory leak
            setTimeout(() => processedRematches.delete(matchId), 5 * 60 * 1000);
          }
          
          // Wrap ALL async operations in try/finally for accepted path to ensure cleanup
          let rematchSucceeded = false;
          try {
            // Get match to find player IDs (before any room modifications)
            const currentMatch = await storage.getMatch(matchId);
          
            // Early exit if match not found - send error to all room members
            if (!currentMatch) {
              const roomUsers = matchRooms.get(matchId);
              if (roomUsers) {
                roomUsers.forEach((roomUserId) => {
                  const playerWs = userConnections.get(roomUserId);
                  if (playerWs && playerWs.readyState === WebSocket.OPEN) {
                    playerWs.send(JSON.stringify({
                      type: 'rematch_response',
                      matchId: matchId,
                      accepted: false,
                    }));
                  }
                });
              }
              return;
            }
          
            const player1Id = currentMatch.player1Id;
            const player2Id = currentMatch.player2Id;
          
            // Helper to notify BOTH players of response (using player IDs, not room membership)
            const notifyBothPlayers = (accepted: boolean) => {
              const player1Ws = userConnections.get(player1Id);
              const player2Ws = userConnections.get(player2Id);
            
              if (player1Ws && player1Ws.readyState === WebSocket.OPEN) {
                player1Ws.send(JSON.stringify({
                  type: 'rematch_response',
                  matchId: matchId,
                  accepted,
                }));
              }
            
              if (player2Ws && player2Ws.readyState === WebSocket.OPEN) {
                player2Ws.send(JSON.stringify({
                  type: 'rematch_response',
                  matchId: matchId,
                  accepted,
                }));
              }
            };
          
            // If declined, clean up match state and notify both players
            if (!accepted) {
              // Finalize post-game handshake (resets streaks for non-participants)
              // Always call to ensure finalized registry is populated, blocking late offers
              await finalizePostGameHandshake(matchId);
              // Finalize match in database if not already completed
              if (currentMatch.status !== 'completed') {
                await storage.updateMatch(matchId, {
                  status: 'completed',
                  completedAt: new Date()
                });
              
                // Fully finalize any games that might not be completely finalized
                // This ensures getActiveGame returns null so players can rejoin queue
                for (const gameId of currentMatch.gameIds) {
                  const game = await storage.getGame(gameId);
                  if (game && (!game.completedAt || game.result === 'ongoing')) {
                    // If no result set, mark as draw (shouldn't happen in normal flow)
                    const finalResult = game.result === 'ongoing' ? 'draw' : game.result;
                    await storage.updateGame(gameId, {
                      result: finalResult,
                      completedAt: new Date()
                    });
                  }
                }
              }
            
              // Get WebSocket connections
              const player1Ws = userConnections.get(player1Id);
              const player2Ws = userConnections.get(player2Id);
            
              // Remove both players from old match room
              const oldMatchRoom = matchRooms.get(matchId);
              if (oldMatchRoom) {
                oldMatchRoom.delete(player1Id);
                oldMatchRoom.delete(player2Id);
                if (oldMatchRoom.size === 0) {
                  matchRooms.delete(matchId);
                }
              }
            
              // Clear WebSocket matchId for both players so they can rejoin queue
              if (player1Ws) {
                (player1Ws as any).matchId = null;
              }
              if (player2Ws) {
                (player2Ws as any).matchId = null;
              }
            
              // Remove both players from queue manager to allow re-queueing
              queueManager.leave(player1Id);
              queueManager.leave(player2Id);
            
              // Notify both players of the decline
              // Note: Don't send game_end event - the game already ended from resignation
              // Note: For declined, we don't need to touch processedRematches since it wasn't added
              notifyBothPlayers(false);
              return;
            }
          
            // If accepted, create a new match between the same players
            // Get player data
            const player1 = await storage.getUser(player1Id);
            const player2 = await storage.getUser(player2Id);
            
            if (!player1 || !player2) {
              notifyBothPlayers(false);
              return;
            }
            
            const player1Name = `${player1.firstName || 'Opponent'} ${player1.lastName || ''}`.trim();
            const player2Name = `${player2.firstName || 'Opponent'} ${player2.lastName || ''}`.trim();
            
            // Get ratings for the match type
            const player1Rating = await storage.getRating(player1Id);
            const player2Rating = await storage.getRating(player2Id);
            
            // Extract time control from match type (e.g., "standard_bullet" -> "bullet", "otb_blitz" -> "blitz")
            // Support both standard and OTB mode rematches
            const matchType = currentMatch.matchType;
            if (!matchType.startsWith('standard_') && !matchType.startsWith('otb_')) {
              console.log('[WS respond_rematch] Unsupported matchType for rematch:', matchType);
              notifyBothPlayers(false);
              return;
            }
            
            const timeControl = matchType.split('_')[1] as 'bullet' | 'blitz' | 'rapid' | 'classical';
            const timeMap = { bullet: 1, blitz: 5, rapid: 15, classical: 30 };
            const time = timeMap[timeControl];
            if (!time) {
              notifyBothPlayers(false);
              return;
            }
            
            // Randomly assign colors
            const player1Color = Math.random() > 0.5 ? "white" : "black";
            const player2Color = player1Color === "white" ? "black" : "white";
            
            const whitePlayerId = player1Color === "white" ? player1Id : player2Id;
            const blackPlayerId = player1Color === "white" ? player2Id : player1Id;
            const whitePlayerName = player1Color === "white" ? player1Name : player2Name;
            const blackPlayerName = player1Color === "white" ? player2Name : player1Name;
            
            // Create TWO new games and match (one for each player, same pattern as queue matching)
            // Create game for player 1
            const player1Game = await storage.createGame({
              userId: player1Id,
              whitePlayerId: whitePlayerId,
              blackPlayerId: blackPlayerId,
              mode: matchType as any,
              playerColor: player1Color,
              timeControl: time * 60,
              increment: 0,
              fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
              whiteTime: time * 60,
              blackTime: time * 60,
              opponentName: player2Name,
            });
            
            // Create game for player 2
            const player2Game = await storage.createGame({
              userId: player2Id,
              whitePlayerId: whitePlayerId,
              blackPlayerId: blackPlayerId,
              mode: matchType as any,
              playerColor: player2Color,
              timeControl: time * 60,
              increment: 0,
              fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
              whiteTime: time * 60,
              blackTime: time * 60,
              opponentName: player1Name,
            });
            
            // Finalize post-game handshake from old match before creating new one
            // Always call to ensure finalized registry is populated, blocking late offers
            await finalizePostGameHandshake(matchId);
            
            // Create match with BOTH game IDs (required for completeMatch rating calculation)
            const newMatch = await storage.createMatch({
              player1Id: player1Id,
              player2Id: player2Id,
              matchType: matchType,
              gameIds: [player1Game.id, player2Game.id],
              status: 'in_progress',
            });
            
            // CRITICAL: Update BOTH games' matchId (same pattern as queue matching)
            console.log('[DEBUG] [WebSocket rematch] Updating games with matchId:', newMatch.id);
            const updatedPlayer1Game = await storage.updateGame(player1Game.id, { matchId: newMatch.id });
            const updatedPlayer2Game = await storage.updateGame(player2Game.id, { matchId: newMatch.id });
            console.log('[DEBUG] [WebSocket rematch] Both games updated - matchIds:', updatedPlayer1Game.matchId, updatedPlayer2Game.matchId);
            
            // Mark rematch as succeeded - this must be set before room setup to prevent finally block cleanup
            rematchSucceeded = true;
            
            // Room setup and match_found sending
            // Get WebSocket connections
            const player1Ws = userConnections.get(player1Id);
            const player2Ws = userConnections.get(player2Id);
            
            // Remove both players from old match room
            const oldMatchRoom = matchRooms.get(matchId);
            if (oldMatchRoom) {
              oldMatchRoom.delete(player1Id);
              oldMatchRoom.delete(player2Id);
              if (oldMatchRoom.size === 0) {
                matchRooms.delete(matchId);
              }
            }
            
            // Create NEW Set for the new match room (don't reuse old Set)
            const newMatchRoom = new Set<string>();
            newMatchRoom.add(player1Id);
            newMatchRoom.add(player2Id);
            matchRooms.set(newMatch.id, newMatchRoom);
            
            // Update WebSocket matchId for both players BEFORE sending match_found
            if (player1Ws) {
              (player1Ws as any).matchId = newMatch.id;
            }
            if (player2Ws) {
              (player2Ws as any).matchId = newMatch.id;
            }
            
            // Calculate ratings for rematch_response
            // For OTB matches, use otbBlitz/otbRapid rating keys; for standard use blitz/rapid
            const isOtbMatch = matchType.startsWith('otb_');
            const ratingKey = isOtbMatch 
              ? `otb${timeControl.charAt(0).toUpperCase()}${timeControl.slice(1)}` // e.g., 'otbBlitz', 'otbRapid'
              : timeControl; // e.g., 'blitz', 'rapid'
            
            console.log('[WS respond_rematch] Using rating key:', ratingKey, 'for matchType:', matchType);
            const player1RatingValue = player1Rating ? (player1Rating as any)[ratingKey] : 1200;
            const player2RatingValue = player2Rating ? (player2Rating as any)[ratingKey] : 1200;
            
            // Send rematch_response with newMatchId and game data to BOTH players
            // This is critical for OTB mode which checks for newMatchId to start the game
            if (player1Ws && player1Ws.readyState === WebSocket.OPEN) {
              player1Ws.send(JSON.stringify({
                type: 'rematch_response',
                matchId: matchId,
                accepted: true,
                newMatchId: newMatch.id,
                game: updatedPlayer1Game,
                timeControl,
                color: player1Color,
                opponent: {
                  name: player2Name,
                  rating: player2RatingValue,
                },
                playerRating: player1RatingValue,
              }));
            }
            
            if (player2Ws && player2Ws.readyState === WebSocket.OPEN) {
              player2Ws.send(JSON.stringify({
                type: 'rematch_response',
                matchId: matchId,
                accepted: true,
                newMatchId: newMatch.id,
                game: updatedPlayer2Game,
                timeControl,
                color: player2Color,
                opponent: {
                  name: player1Name,
                  rating: player1RatingValue,
                },
                playerRating: player2RatingValue,
              }));
            }
            
            // Also send match_found for Standard mode compatibility (it may use this for queue-based matching)
            if (player1Ws && player1Ws.readyState === WebSocket.OPEN) {
              player1Ws.send(JSON.stringify({
                type: 'match_found',
                matchId: newMatch.id,
                game: updatedPlayer1Game,
                timeControl,
                color: player1Color,
                opponent: {
                  name: player2Name,
                  rating: player2RatingValue,
                },
                playerRating: player1RatingValue,
              }));
            }
            
            if (player2Ws && player2Ws.readyState === WebSocket.OPEN) {
              player2Ws.send(JSON.stringify({
                type: 'match_found',
                matchId: newMatch.id,
                game: updatedPlayer2Game,
                timeControl,
                color: player2Color,
                opponent: {
                  name: player1Name,
                  rating: player1RatingValue,
                },
                playerRating: player2RatingValue,
              }));
            }
          } catch (error) {
            console.error('Error in rematch handler:', error);
            // Note: notifyBothPlayers may not be accessible here since it's defined inside try block
            // The finally block will clean up processedRematches; players will see rematch timeout
          } finally {
            // Only keep matchId in processedRematches if rematch succeeded
            // This allows retries on failure while preventing duplicates on success
            if (!rematchSucceeded) {
              processedRematches.delete(matchId);
            }
          }
        } else if (data.type === 'game_end') {
          // Player resigned or other game-ending action
          const matchId = data.matchId || ws.matchId;
          const userId = ws.userId;
          const result = data.result;
          const reason = data.reason;
          
          console.log(`[WS game_end] User ${userId} ended game in match ${matchId}: result=${result}, reason=${reason}`);
          
          if (!matchId || !userId) {
            console.log('[WS game_end] Missing matchId or userId');
            return;
          }
          
          // Get match to find opponent
          const match = await storage.getMatch(matchId);
          if (!match) {
            console.log('[WS game_end] Match not found:', matchId);
            return;
          }
          
          // Notify opponent of game end
          const opponentId = match.player1Id === userId ? match.player2Id : match.player1Id;
          const opponentWs = userConnections.get(opponentId);
          
          console.log(`[WS game_end] Notifying opponent ${opponentId}...`);
          
          if (opponentWs && opponentWs.readyState === WebSocket.OPEN) {
            opponentWs.send(JSON.stringify({
              type: 'game_end',
              matchId,
              result,
              reason,
            }));
            console.log(`[WS game_end] Sent game_end to opponent ${opponentId}`);
          } else {
            console.log(`[WS game_end] Opponent ${opponentId} not connected`);
          }
        } else if (data.type === 'player_away') {
          // Player switched tabs or minimized window - start grace period
          const matchId = data.matchId || ws.matchId;
          const userId = ws.userId;
          
          console.log(`[WS player_away] User ${userId} went away from match ${matchId}`);
          
          if (!matchId || !userId) {
            console.log('[WS player_away] Missing matchId or userId');
            return;
          }
          
          // Check if there's already a timer running
          if (disconnectTimers.has(userId)) {
            console.log(`[WS player_away] Timer already exists for ${userId}`);
            return;
          }
          
          // Get match to find opponent and verify game is active
          const match = await storage.getMatch(matchId);
          if (!match || match.status === 'completed') {
            console.log('[WS player_away] Match not found or already completed:', matchId);
            return;
          }
          
          const games = await storage.getGamesByMatchId(matchId);
          const userGame = games.find(g => g.userId === userId);
          
          if (!userGame || userGame.status !== 'active') {
            console.log('[WS player_away] No active game for user');
            return;
          }
          
          // Notify opponent that player went away
          const opponentId = match.player1Id === userId ? match.player2Id : match.player1Id;
          const opponentWs = userConnections.get(opponentId);
          
          if (opponentWs && opponentWs.readyState === WebSocket.OPEN) {
            opponentWs.send(JSON.stringify({
              type: 'opponent_disconnected',
              matchId,
              gracePeriod: DISCONNECT_GRACE_PERIOD,
            }));
          }
          
          // Start 30-second grace period timer
          const timer = setTimeout(async () => {
            console.log(`[WS player_away] Timer fired for user ${userId}`);
            try {
              // Check if player came back (timer was cancelled)
              if (!disconnectTimers.has(userId)) {
                console.log(`[WS player_away] Timer was cancelled for ${userId}`);
                return;
              }
              
              // Get current match and game status
              const currentMatch = await storage.getMatch(matchId);
              if (!currentMatch || currentMatch.status === 'completed') {
                console.log('[WS player_away] Match already completed');
                disconnectTimers.delete(userId);
                return;
              }
              
              const currentGames = await storage.getGamesByMatchId(matchId);
              const currentUserGame = currentGames.find(g => g.userId === userId);
              
              if (!currentUserGame || currentUserGame.status !== 'active') {
                console.log('[WS player_away] Game no longer active');
                disconnectTimers.delete(userId);
                return;
              }
              
              // Player didn't come back - auto-resign
              const whiteMoves = currentUserGame.whiteMoveCount || 0;
              const blackMoves = currentUserGame.blackMoveCount || 0;
              const noMovesYet = whiteMoves === 0 && blackMoves === 0;
              
              const opponentUserId = currentGames.find(g => g.userId !== userId)?.userId;
              
              if (noMovesYet) {
                // Auto-abort
                console.log(`[WS player_away] Auto-aborting game ${currentUserGame.id}`);
                for (const game of currentGames) {
                  await storage.updateGame(game.id, {
                    status: 'completed',
                    result: 'aborted',
                    completedAt: new Date(),
                  });
                }
                await storage.updateMatch(matchId, { status: 'completed', result: 'aborted' });
                
                if (opponentUserId) {
                  const oppWs = userConnections.get(opponentUserId);
                  if (oppWs && oppWs.readyState === WebSocket.OPEN) {
                    oppWs.send(JSON.stringify({
                      type: 'game_end',
                      result: 'aborted',
                      reason: 'opponent_abandoned',
                    }));
                  }
                }
              } else {
                // Auto-resign
                const isWhite = currentUserGame.playerColor === 'white';
                const result = isWhite ? 'black_win' : 'white_win';
                
                console.log(`[WS player_away] Auto-resigning game ${currentUserGame.id} - ${result}`);
                await storage.completeMatch(matchId, result);
                
                if (opponentUserId) {
                  const oppWs = userConnections.get(opponentUserId);
                  if (oppWs && oppWs.readyState === WebSocket.OPEN) {
                    oppWs.send(JSON.stringify({
                      type: 'game_end',
                      result: result,
                      reason: 'opponent_abandoned',
                    }));
                  }
                }
              }
              
              matchRooms.delete(matchId);
              disconnectTimers.delete(userId);
            } catch (error) {
              console.error('[WS player_away] Error handling timeout:', error);
              disconnectTimers.delete(userId);
            }
          }, DISCONNECT_GRACE_PERIOD);
          
          disconnectTimers.set(userId, timer);
          console.log(`[WS player_away] Started ${DISCONNECT_GRACE_PERIOD}ms timer for user ${userId}`);
          
        } else if (data.type === 'player_back') {
          // Player returned to tab - cancel grace period
          const matchId = data.matchId || ws.matchId;
          const userId = ws.userId;
          
          console.log(`[WS player_back] User ${userId} returned to match ${matchId}`);
          
          if (!userId) {
            console.log('[WS player_back] Missing userId');
            return;
          }
          
          // Cancel any existing timer
          if (disconnectTimers.has(userId)) {
            clearTimeout(disconnectTimers.get(userId)!);
            disconnectTimers.delete(userId);
            console.log(`[WS player_back] Cancelled timer for user ${userId}`);
          }
          
          // Notify opponent that player is back
          if (matchId) {
            const match = await storage.getMatch(matchId);
            if (match) {
              const opponentId = match.player1Id === userId ? match.player2Id : match.player1Id;
              const opponentWs = userConnections.get(opponentId);
              
              if (opponentWs && opponentWs.readyState === WebSocket.OPEN) {
                opponentWs.send(JSON.stringify({
                  type: 'opponent_reconnected',
                  matchId,
                }));
              }
            }
          }
        }
      } catch (error) {
        console.error('WebSocket error:', error);
      }
    });

    ws.on('close', async () => {
      console.log('[Disconnect] WebSocket client disconnected');
      
      if (ws.userId) {
        const userId = ws.userId;
        const matchId = ws.matchId;
        
        console.log(`[Disconnect] User ${userId} disconnected, matchId: ${matchId}`);
        
        userConnections.delete(userId);
        authenticatedUsers.delete(userId);
        
        const socketId = (ws as any).socketId;
        if (socketId) {
          queueManager.removeBySocketId(socketId);
        }
        
        // Check if user has an active game
        if (matchId) {
          console.log(`[Disconnect] User has matchId: ${matchId}, checking match status`);
          try {
            const match = await storage.getMatch(matchId);
            console.log(`[Disconnect] Match status: ${match?.status}, exists: ${!!match}`);
            
            if (match && match.status !== 'completed') {
              const games = await storage.getGamesByMatchId(matchId);
              const userGame = games.find(g => g.userId === userId);
              console.log(`[Disconnect] User game found: ${!!userGame}, status: ${userGame?.status}`);
              
              if (userGame && userGame.status === 'active') {
                console.log(`[Disconnect] Starting disconnect handler for user ${userId}`);
                // Find opponent's user ID (not from room, but from games list)
                const opponentUserId = games.find(g => g.userId !== userId)?.userId;
                
                // Notify opponent of disconnect
                if (opponentUserId) {
                  const opponentWs = userConnections.get(opponentUserId);
                  if (opponentWs && opponentWs.readyState === WebSocket.OPEN) {
                    opponentWs.send(JSON.stringify({
                      type: 'opponent_disconnected',
                      matchId: matchId,
                      gracePeriod: DISCONNECT_GRACE_PERIOD,
                    }));
                  }
                }
                
                // Start 30-second grace period timer
                const timer = setTimeout(async () => {
                  console.log(`[Disconnect] Timer fired for user ${userId}, checking if they reconnected`);
                  try {
                    // Double-check user hasn't reconnected (either in userConnections OR in match room)
                    const userReconnected = userConnections.has(userId) || 
                                          (matchRooms.has(matchId) && matchRooms.get(matchId)!.has(userId));
                    
                    if (!userReconnected) {
                      console.log(`[Disconnect] User ${userId} did not reconnect (not in connections or match room), processing disconnect`);
                      const whiteMoves = userGame.whiteMoveCount || 0;
                      const blackMoves = userGame.blackMoveCount || 0;
                      const noMovesYet = whiteMoves === 0 && blackMoves === 0;
                      
                      if (noMovesYet) {
                        // AUTO-ABORT: No moves made, cancel game without affecting stats/elo
                        console.log(`[Disconnect] Auto-aborting game ${userGame.id} - no moves made`);
                        
                        // Update both players' games to aborted
                        for (const game of games) {
                          await storage.updateGame(game.id, {
                            status: 'completed',
                            result: 'aborted',
                            completedAt: new Date(),
                          });
                        }
                        
                        // Update match status (no rating/stats processing)
                        await storage.updateMatch(matchId, {
                          status: 'completed',
                          result: 'aborted',
                        });
                        
                        // Notify opponent only (not all room members)
                        const opponentUserId = games.find(g => g.userId !== userId)?.userId;
                        if (opponentUserId) {
                          const opponentWs = userConnections.get(opponentUserId);
                          if (opponentWs && opponentWs.readyState === WebSocket.OPEN) {
                            opponentWs.send(JSON.stringify({
                              type: 'game_end',
                              result: 'aborted',
                              reason: 'opponent_abandoned',
                            }));
                          }
                        }
                      } else {
                        // AUTO-RESIGN: Moves were made, disconnected player loses
                        const isWhite = userGame.playerColor === 'white';
                        const result = isWhite ? 'black_win' : 'white_win';
                        
                        console.log(`[Disconnect] Auto-resigning game ${userGame.id} - ${result}`);
                        
                        // Complete match (will process ratings and stats)
                        await storage.completeMatch(matchId, result);
                        
                        // Notify opponent only (not all room members)
                        const opponentUserId = games.find(g => g.userId !== userId)?.userId;
                        if (opponentUserId) {
                          const opponentWs = userConnections.get(opponentUserId);
                          if (opponentWs && opponentWs.readyState === WebSocket.OPEN) {
                            opponentWs.send(JSON.stringify({
                              type: 'game_end',
                              result: result,
                              reason: 'opponent_disconnected',
                            }));
                          }
                        }
                      }
                      
                      // Clean up rooms
                      matchRooms.delete(matchId);
                    } else {
                      console.log(`[Disconnect] User ${userId} successfully reconnected - cancelling disconnect processing`);
                      console.log(`[Disconnect] User in connections: ${userConnections.has(userId)}, User in match room: ${matchRooms.has(matchId) && matchRooms.get(matchId)!.has(userId)}`);
                    }
                  } catch (error) {
                    console.error('[Disconnect] Error handling disconnect:', error);
                  }
                  
                  disconnectTimers.delete(userId);
                }, DISCONNECT_GRACE_PERIOD);
                
                disconnectTimers.set(userId, timer);
                console.log(`[Disconnect] Timer set for user ${userId}, will fire in ${DISCONNECT_GRACE_PERIOD}ms at approximately ${new Date(Date.now() + DISCONNECT_GRACE_PERIOD).toISOString()}`);
              }
            }
            
            // Clean up room
            const roomUsers = matchRooms.get(matchId);
            if (roomUsers) {
              roomUsers.delete(userId);
              if (roomUsers.size === 0) {
                matchRooms.delete(matchId);
              }
            }
          } catch (error) {
            console.error('[Disconnect] Error checking game status:', error);
          }
        }
        
        // Clean up Simul vs Simul resources for this player
        for (const [simulMatchId, matchRoom] of simulMatchRooms.entries()) {
          if (matchRoom.has(userId)) {
            console.log(`[SimulDisconnect] Cleaning up player ${userId} from simul match ${simulMatchId}`);
            
            // Auto-resign all ongoing games for the disconnected player
            try {
              const playerGames = await storage.getSimulVsSimulPlayerGames(simulMatchId, userId);
              const matchPlayers = await storage.getSimulVsSimulMatchPlayers(simulMatchId);
              
              for (const pairing of playerGames) {
                if (pairing.result !== 'ongoing') continue;
                
                console.log(`[SimulDisconnect] Auto-resigning pairing ${pairing.id} for disconnected player ${userId}`);
                
                // Determine result: disconnected player loses
                const playerColor = pairing.whitePlayerId === userId ? 'white' : 'black';
                const result = playerColor === 'white' ? 'black_win' : 'white_win';
                
                // Get opponent info for game record
                const opponentId = playerColor === 'white' ? pairing.blackPlayerId : pairing.whitePlayerId;
                const opponentIsBot = playerColor === 'white' ? pairing.blackIsBot : pairing.whiteIsBot;
                const opponentBotId = playerColor === 'white' ? pairing.blackBotId : pairing.whiteBotId;
                
                // Create game records for analysis
                let playerGameId: string | null = null;
                let opponentGameId: string | null = null;
                
                // Create game for the disconnected player (if human)
                const playerInfo = matchPlayers.find(mp => mp.odId === userId);
                const opponentInfo = opponentId ? matchPlayers.find(mp => mp.odId === opponentId) : null;
                
                const disconnectedPlayerGame = await storage.createGame({
                  userId: userId,
                  whitePlayerId: pairing.whitePlayerId,
                  blackPlayerId: pairing.blackPlayerId,
                  mode: 'simul_vs_simul',
                  status: 'completed',
                  result: result as 'white_win' | 'black_win' | 'draw' | 'ongoing',
                  opponentName: opponentIsBot ? `Bot ${opponentBotId}` : (opponentInfo?.username || 'Unknown'),
                  playerColor: playerColor,
                  timeControl: 30,
                  fen: pairing.fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
                  moves: pairing.moves || [],
                  thinkingTimes: [],
                });
                playerGameId = disconnectedPlayerGame.id;
                
                // Create game for opponent (if human)
                if (!opponentIsBot && opponentId) {
                  const opponentGame = await storage.createGame({
                    userId: opponentId,
                    whitePlayerId: pairing.whitePlayerId,
                    blackPlayerId: pairing.blackPlayerId,
                    mode: 'simul_vs_simul',
                    status: 'completed',
                    result: result as 'white_win' | 'black_win' | 'draw' | 'ongoing',
                    opponentName: playerInfo?.username || 'Unknown',
                    playerColor: playerColor === 'white' ? 'black' : 'white',
                    timeControl: 30,
                    fen: pairing.fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
                    moves: pairing.moves || [],
                    thinkingTimes: [],
                  });
                  opponentGameId = opponentGame.id;
                }
                
                // Update pairing result
                await storage.updateSimulVsSimulPairing(pairing.id, {
                  result,
                  completedAt: new Date(),
                  gameId: playerGameId || opponentGameId,
                });
                
                // Stop timer for this pairing
                const timer = simulTimers.get(pairing.id);
                if (timer) {
                  timer.isPaused = true;
                  timer.deadline = null;
                }
                
                // Notify opponent of game end
                if (!opponentIsBot && opponentId) {
                  const opponentWs = userConnections.get(opponentId);
                  if (opponentWs && opponentWs.readyState === WebSocket.OPEN) {
                    opponentWs.send(JSON.stringify({
                      type: 'simul_game_end',
                      pairingId: pairing.id,
                      result,
                      reason: 'opponent_disconnected',
                      gameId: opponentGameId,
                    }));
                  }
                }
              }
              
              // Now clean up player from rooms
              cleanupSimulPlayer(userId, simulMatchId);
              
              // Check if match is complete
              const allPairings = await storage.getAllSimulVsSimulPairings(simulMatchId);
              const allComplete = allPairings.every(p => p.result !== 'ongoing');
              
              if (allComplete) {
                console.log(`[SimulDisconnect] All games complete, finalizing match ${simulMatchId}`);
                
                // Mark match as completed
                await storage.updateSimulVsSimulMatch(simulMatchId, {
                  status: 'completed',
                  completedAt: new Date(),
                });
                
                // Calculate and apply Simul ELO changes
                const ratingChanges = await calculateSimulEloChanges(simulMatchId, allPairings, matchPlayers);
                await applySimulEloChanges(ratingChanges);
                
                // Notify remaining connected players
                const remainingRoom = simulMatchRooms.get(simulMatchId);
                if (remainingRoom) {
                  remainingRoom.forEach((roomUserId) => {
                    const playerWs = userConnections.get(roomUserId);
                    if (playerWs && playerWs.readyState === WebSocket.OPEN) {
                      const playerStats = ratingChanges.get(roomUserId);
                      playerWs.send(JSON.stringify({
                        type: 'simul_match_complete',
                        matchId: simulMatchId,
                        ratingChange: playerStats?.ratingChange || 0,
                        humanGamesPlayed: playerStats?.humanGamesPlayed || 0,
                        wins: playerStats?.wins || 0,
                        losses: playerStats?.losses || 0,
                        draws: playerStats?.draws || 0,
                      }));
                    }
                  });
                }
                
                // Clean up match resources
                cleanupSimulMatch(simulMatchId, allPairings.map(p => p.id));
              }
            } catch (error) {
              console.error('[SimulDisconnect] Error auto-resigning games:', error);
              // Still clean up player from rooms even if auto-resign fails
              cleanupSimulPlayer(userId, simulMatchId);
            }
            break; // A player should only be in one simul match at a time
          }
        }
      }
    });

    ws.send(JSON.stringify({ type: 'connected', message: 'Welcome to SimulChess' }));
  });

  return httpServer;
}
