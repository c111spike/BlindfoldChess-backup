import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { insertGameSchema, insertPuzzleAttemptSchema, insertUserSettingsSchema } from "@shared/schema";
import { createQueueManager } from "./queueManager";
import { generatePosition, calculateScore, getAllDifficulties } from "./positionGenerator";
import { stockfishService } from "./stockfish";
import { generateBotMove, calculateBotThinkTime } from "./botEngine";
import { BOTS, getBotById } from "../shared/botTypes";
import type { BotPersonality, BotDifficulty } from "../shared/botTypes";

const { queueManager } = createQueueManager();

export async function registerRoutes(app: Express): Promise<Server> {
  await setupAuth(app);

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
      
      if (!user.isPremium) {
        const isOTB = gameData.mode.startsWith('otb_');
        const isBlindfold = gameData.mode === 'blindfold';
        
        if (isOTB && (user.dailyGamesPlayed || 0) >= 5) {
          return res.status(403).json({ 
            message: "Daily OTB game limit reached. Upgrade to Premium for unlimited games.",
            upgradeRequired: true,
          });
        }
        
        if (isBlindfold && (user.dailyBlindfoldGamesPlayed || 0) >= 5) {
          return res.status(403).json({ 
            message: "Daily Blindfold game limit reached. Upgrade to Premium for unlimited games.",
            upgradeRequired: true,
          });
        }
      }
      
      const game = await storage.createGame(gameData);
      
      if (!user.isPremium) {
        const isOTB = gameData.mode.startsWith('otb_');
        const isBlindfold = gameData.mode === 'blindfold';
        
        if (isOTB) {
          await storage.upsertUser({
            ...user,
            dailyGamesPlayed: (user.dailyGamesPlayed || 0) + 1,
          });
        }
        
        if (isBlindfold) {
          await storage.upsertUser({
            ...user,
            dailyBlindfoldGamesPlayed: (user.dailyBlindfoldGamesPlayed || 0) + 1,
          });
        }
      }
      
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
      
      const getRatingForTimeControl = (tc: string): number => {
        if (tc === 'bullet') return rating.bullet;
        if (tc === 'blitz') return rating.blitz;
        if (tc === 'rapid') return rating.rapid;
        if (tc === 'classical') return rating.classical;
        return 1200;
      };

      const currentRating = getRatingForTimeControl(effectiveTimeControl);
      const effectiveQueueType = queueType || `standard_${effectiveTimeControl}`;
      
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
        
        const ratingCategory = existingMatch.matchType.includes('bullet') ? 'bullet' : 
                              existingMatch.matchType.includes('blitz') ? 'blitz' : 
                              existingMatch.matchType.includes('rapid') ? 'rapid' : 
                              existingMatch.matchType.includes('classical') ? 'classical' : 'otb';
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
          opponent: { name: opponentName, rating: opponentRating },
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
      
      const ratingCategory = queueType.includes('bullet') ? 'bullet' : 
                            queueType.includes('blitz') ? 'blitz' : 
                            queueType.includes('rapid') ? 'rapid' : 
                            queueType.includes('classical') ? 'classical' : 'otb';
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
          opponent: { name: opponentName, rating: opponentRating },
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
          opponent: { name: opponentName, rating: opponentRating },
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
      const { match: completedMatch, games: completedGames } = await storage.completeMatch(matchId, result);

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

      res.json({ match: completedMatch, games: completedGames });
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
      
      if (!user.isPremium && (user.dailyBlindfoldGamesPlayed || 0) >= 5) {
        return res.status(403).json({ 
          message: "Daily Blindfold game limit reached. Upgrade to Premium for unlimited games.",
          upgradeRequired: true,
        });
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
      
      if (!user.isPremium) {
        await storage.upsertUser({
          ...user,
          dailyBlindfoldGamesPlayed: (user.dailyBlindfoldGamesPlayed || 0) + 1,
        });
      }
      
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
      res.json(stats);
    } catch (error) {
      console.error("Error fetching statistics:", error);
      res.status(500).json({ message: "Failed to fetch statistics" });
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

  app.post('/api/puzzles/attempt', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const attemptData = insertPuzzleAttemptSchema.parse({
        ...req.body,
        userId,
      });
      
      const attempt = await storage.createPuzzleAttempt(attemptData);
      res.json(attempt);
    } catch (error) {
      console.error("Error creating puzzle attempt:", error);
      res.status(500).json({ message: "Failed to record puzzle attempt" });
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

  app.post('/api/boardspin/bestmove', async (req, res) => {
    try {
      const { fen } = req.body;
      
      if (!fen) {
        return res.status(400).json({ message: "FEN is required" });
      }
      
      // Parse FEN to get turn and board
      const fenParts = fen.split(' ');
      const boardPart = fenParts[0];
      const turn = fenParts[1]; // 'w' or 'b'
      
      console.log(`[BoardSpin] Getting best move for FEN: ${fen}`);
      console.log(`[BoardSpin] Turn: ${turn === 'w' ? 'White' : 'Black'}`);
      
      const result = await stockfishService.getBestMove(fen, 15);
      
      // Validate that the best move is for the correct color
      const fromSquare = result.bestMove.substring(0, 2);
      const fromFile = fromSquare.charCodeAt(0) - 'a'.charCodeAt(0);
      const fromRank = 8 - parseInt(fromSquare[1]);
      
      // Parse board to find piece on from square
      const rows = boardPart.split('/');
      let pieceOnFromSquare = '';
      let fileIdx = 0;
      for (const char of rows[fromRank]) {
        if (/\d/.test(char)) {
          fileIdx += parseInt(char);
        } else {
          if (fileIdx === fromFile) {
            pieceOnFromSquare = char;
            break;
          }
          fileIdx++;
        }
      }
      
      const pieceIsWhite = pieceOnFromSquare === pieceOnFromSquare.toUpperCase();
      const turnIsWhite = turn === 'w';
      
      console.log(`[BoardSpin] Best move: ${result.bestMove}, Piece: ${pieceOnFromSquare}, PieceIsWhite: ${pieceIsWhite}, TurnIsWhite: ${turnIsWhite}`);
      
      if (pieceIsWhite !== turnIsWhite) {
        console.error(`[BoardSpin] MISMATCH: Turn is ${turn} but piece ${pieceOnFromSquare} is ${pieceIsWhite ? 'white' : 'black'}`);
      }
      
      res.json({ ...result, turn });
    } catch (error) {
      console.error("Error getting best move:", error);
      res.status(500).json({ message: "Failed to get best move" });
    }
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
      
      res.json(savedScore);
    } catch (error) {
      console.error("Error saving Board Spin score:", error);
      res.status(500).json({ message: "Failed to save score" });
    }
  });

  app.get('/api/boardspin/leaderboard', async (req, res) => {
    try {
      const { difficulty, limit } = req.query;
      const leaderboard = await storage.getBoardSpinLeaderboard(
        difficulty as string | undefined,
        limit ? parseInt(limit as string) : 10
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
      
      res.json({ 
        isNew: result.isNew, 
        solutionIndex: result.solution.solutionIndex 
      });
    } catch (error) {
      console.error("Error saving N-Piece solution:", error);
      res.status(500).json({ message: "Failed to save solution" });
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
      const { fen, botId } = req.body;
      
      if (!fen || !botId) {
        return res.status(400).json({ message: "Missing fen or botId" });
      }

      const bot = getBotById(botId);
      if (!bot) {
        return res.status(404).json({ message: "Bot not found" });
      }

      const thinkTime = calculateBotThinkTime(bot.difficulty);
      
      await new Promise(resolve => setTimeout(resolve, thinkTime));
      
      const move = generateBotMove(fen, bot.personality, bot.difficulty);
      
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

  const httpServer = createServer(app);

  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  const userConnections = new Map<string, WebSocket>();
  const matchRooms = new Map<string, Set<string>>();
  const disconnectTimers = new Map<string, NodeJS.Timeout>();
  const DISCONNECT_GRACE_PERIOD = 30000; // 30 seconds

  wss.on('connection', (ws: WebSocket & { userId?: string; matchId?: string }) => {
    console.log('WebSocket client connected');

    ws.on('message', async (message: string) => {
      try {
        const data = JSON.parse(message.toString());
        console.log('Received WebSocket message:', data);
        
        if (data.type === 'auth') {
          ws.userId = data.userId;
          userConnections.set(data.userId, ws);
          
          // Cancel any pending disconnect timer if user reconnects
          const existingTimer = disconnectTimers.get(data.userId);
          if (existingTimer) {
            clearTimeout(existingTimer);
            disconnectTimers.delete(data.userId);
            ws.send(JSON.stringify({ type: 'reconnected' }));
          }
          
          ws.send(JSON.stringify({ type: 'authenticated', userId: data.userId }));
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
            
            // Get user settings to check blindfold configuration
            const player1Settings = await storage.getUserSettings(match.player1.userId);
            const player2Settings = await storage.getUserSettings(match.player2.userId);

            const player1Name = `${player1?.firstName || 'Opponent'} ${player1?.lastName || ''}`.trim();
            const player2Name = `${player2?.firstName || 'Opponent'} ${player2?.lastName || ''}`.trim();

            const whitePlayerId = player1Color === "white" ? match.player1.userId : match.player2.userId;
            const blackPlayerId = player1Color === "black" ? match.player1.userId : match.player2.userId;
            const whitePlayerName = player1Color === "white" ? player1Name : player2Name;
            const blackPlayerName = player1Color === "black" ? player1Name : player2Name;

            // Create game for player 1
            const player1GameData: any = {
              userId: match.player1.userId,
              whitePlayerId: whitePlayerId,
              blackPlayerId: blackPlayerId,
              mode: `standard_${timeControl}`,
              playerColor: player1Color,
              timeControl: time,
              increment: 0,
              fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
              whiteTime: time * 60,
              blackTime: time * 60,
              opponentName: player2Name,
            };
            if (player1Settings?.blindfoldDifficulty) {
              player1GameData.blindfoldDifficulty = player1Settings.blindfoldDifficulty;
            }
            const player1Game = await storage.createGame(player1GameData);

            // Create game for player 2
            const player2GameData: any = {
              userId: match.player2.userId,
              whitePlayerId: whitePlayerId,
              blackPlayerId: blackPlayerId,
              mode: `standard_${timeControl}`,
              playerColor: player2Color,
              timeControl: time,
              increment: 0,
              fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
              whiteTime: time * 60,
              blackTime: time * 60,
              opponentName: player1Name,
            };
            if (player2Settings?.blindfoldDifficulty) {
              player2GameData.blindfoldDifficulty = player2Settings.blindfoldDifficulty;
            }
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

            if (player1Ws && player1Ws.readyState === WebSocket.OPEN) {
              player1Ws.send(JSON.stringify({
                type: 'match_found',
                matchId: matchRecord.id,
                game: updatedPlayer1Game,
                timeControl,
                color: player1Color,
                opponent: {
                  name: player2Name,
                  rating: match.player2.rating,
                },
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
                  rating: match.player1.rating,
                },
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
          
          ws.send(JSON.stringify({ type: 'joined_match', matchId }));
        } else if (data.type === 'move') {
          const matchId = ws.matchId;
          const userId = ws.userId;
          
          console.log(`[WS Move] Received move from ${userId} in match ${matchId}: ${data.move}`);
          
          if (!matchId || !userId) {
            console.log(`[WS Move] ERROR: Not in a match - matchId: ${matchId}, userId: ${userId}`);
            ws.send(JSON.stringify({ type: 'error', message: 'Not in a match' }));
            return;
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
          
          if (!matchId || !userId) return;
          
          const roomUsers = matchRooms.get(matchId);
          if (roomUsers) {
            roomUsers.forEach((roomUserId) => {
              if (roomUserId !== userId) {
                const opponentWs = userConnections.get(roomUserId);
                if (opponentWs && opponentWs.readyState === WebSocket.OPEN) {
                  opponentWs.send(JSON.stringify({
                    type: 'arbiter_ruling',
                    matchId: matchId,
                    ruling: data.ruling,
                    violatorId: data.violatorId,
                    timeAdjustment: data.timeAdjustment,
                    forfeit: data.forfeit,
                    forfeitReason: data.forfeitReason,
                  }));
                }
              }
            });
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
        } else if (data.type === 'request_rematch') {
          const matchId = data.matchId;
          const userId = ws.userId;
          
          console.log('[WS request_rematch] Received from:', userId, 'matchId:', matchId);
          
          if (!matchId || !userId) return;
          
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
          
          if (!matchId || !userId) return;
          
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
            notifyBothPlayers(false);
            return;
          }
          
          // If accepted, create a new match between the same players
          // First validate and create the new match, THEN notify players
          // (We already have player IDs from currentMatch above)
          
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
          
          // Extract time control from match type (e.g., "standard_bullet" -> "bullet")
          // Only support standard mode rematches for now
          const matchType = currentMatch.matchType;
          if (!matchType.startsWith('standard_')) {
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
          
          // Create new game and match (with error handling)
          let newGame, newMatch;
          try {
            newGame = await storage.createGame({
              userId: whitePlayerId,
              whitePlayerId: whitePlayerId,
              blackPlayerId: blackPlayerId,
              mode: matchType as any,
              playerColor: "white",
              timeControl: time,
              increment: 0,
              fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
              whiteTime: time * 60,
              blackTime: time * 60,
              opponentName: blackPlayerName,
            });
            
            newMatch = await storage.createMatch({
              player1Id: player1Id,
              player2Id: player2Id,
              matchType: matchType,
              gameIds: [newGame.id],
              status: 'in_progress',
            });
            
            // CRITICAL: Update game's matchId (same pattern as atomicMatchPairing)
            console.log('[DEBUG] [WebSocket rematch] Updating game matchId:', newGame.id, 'with matchId:', newMatch.id);
            newGame = await storage.updateGame(newGame.id, { matchId: newMatch.id });
            console.log('[DEBUG] [WebSocket rematch] Game updated - matchId:', newGame.matchId);
          } catch (error) {
            console.error('Error creating rematch:', error);
            notifyBothPlayers(false);
            return;
          }
          
          // Room setup and match_found sending (wrapped in try-catch)
          try {
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
            
            // NOW send acceptance response to BOTH players (after everything succeeded)
            notifyBothPlayers(true);
            
            // Send match_found to both players
            if (player1Ws && player1Ws.readyState === WebSocket.OPEN) {
              player1Ws.send(JSON.stringify({
                type: 'match_found',
                matchId: newMatch.id,
                game: newGame,
                timeControl,
                color: player1Color,
                opponent: {
                  name: player2Name,
                  rating: player2Rating ? player2Rating[timeControl] : 1200,
                },
              }));
            }
            
            if (player2Ws && player2Ws.readyState === WebSocket.OPEN) {
              player2Ws.send(JSON.stringify({
                type: 'match_found',
                matchId: newMatch.id,
                game: newGame,
                timeControl,
                color: player2Color,
                opponent: {
                  name: player1Name,
                  rating: player1Rating ? player1Rating[timeControl] : 1200,
                },
              }));
            }
          } catch (roomError) {
            console.error('Error setting up rematch rooms/notifications:', roomError);
            // If room setup or match_found sending fails, notify both players of failure
            notifyBothPlayers(false);
            return;
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
      }
    });

    ws.send(JSON.stringify({ type: 'connected', message: 'Welcome to SimulChess' }));
  });

  return httpServer;
}
