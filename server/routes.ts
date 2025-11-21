import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { insertGameSchema, insertPuzzleAttemptSchema, insertUserSettingsSchema } from "@shared/schema";

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
      let rating = await storage.getRating(userId);
      
      if (!rating) {
        rating = await storage.createRating({
          userId,
          otbBullet: 1200,
          otbBlitz: 1200,
          otbRapid: 1200,
          blindfold: 1200,
          simul: 1200,
        });
      }
      
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
      
      res.json(activeGame);
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
      
      const game = await storage.getGame(id);
      if (!game || game.userId !== userId) {
        return res.status(404).json({ message: "Game not found" });
      }
      
      const updatedGame = await storage.updateGame(id, req.body);
      
      if (req.body.result && req.body.result !== 'ongoing') {
        const stats = await storage.getStatistics(userId);
        const existingStat = stats.find(s => s.mode === game.mode);
        
        const isWin = 
          (req.body.result === 'white_win' && game.playerColor === 'white') ||
          (req.body.result === 'black_win' && game.playerColor === 'black');
        const isDraw = req.body.result === 'draw';
        
        await storage.upsertStatistics({
          userId,
          mode: game.mode,
          gamesPlayed: (existingStat?.gamesPlayed || 0) + 1,
          wins: (existingStat?.wins || 0) + (isWin ? 1 : 0),
          draws: (existingStat?.draws || 0) + (isDraw ? 1 : 0),
          losses: (existingStat?.losses || 0) + (!isWin && !isDraw ? 1 : 0),
          totalTime: (existingStat?.totalTime || 0) + (game.timeControl || 0),
          winStreak: isWin ? (existingStat?.winStreak || 0) + 1 : 0,
        });
        
        let rating = await storage.getRating(userId);
        if (!rating) {
          rating = await storage.createRating({
            userId,
            otbBullet: 1200,
            otbBlitz: 1200,
            otbRapid: 1200,
            blindfold: 1200,
            simul: 1200,
          });
        }
        
        const opponentRating = 1200;
        const kFactor = 32;
        
        const score = isWin ? 1 : isDraw ? 0.5 : 0;
        const expectedScore = 1 / (1 + Math.pow(10, (opponentRating - getCurrentRating(rating, game.mode)) / 400));
        const ratingChange = Math.round(kFactor * (score - expectedScore));
        
        const ratingUpdate: any = {};
        if (game.mode === 'otb_bullet') {
          ratingUpdate.otbBullet = rating.otbBullet + ratingChange;
        } else if (game.mode === 'otb_blitz') {
          ratingUpdate.otbBlitz = rating.otbBlitz + ratingChange;
        } else if (game.mode === 'otb_rapid') {
          ratingUpdate.otbRapid = rating.otbRapid + ratingChange;
        } else if (game.mode === 'blindfold') {
          ratingUpdate.blindfold = rating.blindfold + ratingChange;
        } else if (game.mode === 'simul') {
          ratingUpdate.simul = rating.simul + ratingChange;
        }
        
        await storage.updateRating(userId, ratingUpdate);
      }
      
      res.json(updatedGame);
    } catch (error) {
      console.error("Error updating game:", error);
      res.status(500).json({ message: "Failed to update game" });
    }
  });

  function getCurrentRating(rating: any, mode: string): number {
    if (mode === 'otb_bullet') return rating.otbBullet;
    if (mode === 'otb_blitz') return rating.otbBlitz;
    if (mode === 'otb_rapid') return rating.otbRapid;
    if (mode === 'blindfold') return rating.blindfold;
    if (mode === 'simul') return rating.simul;
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

  const httpServer = createServer(app);

  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws: WebSocket) => {
    console.log('WebSocket client connected');

    ws.on('message', (message: string) => {
      try {
        const data = JSON.parse(message.toString());
        console.log('Received:', data);
        
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              type: 'game_update',
              data: data,
            }));
          }
        });
      } catch (error) {
        console.error('WebSocket error:', error);
      }
    });

    ws.on('close', () => {
      console.log('WebSocket client disconnected');
    });

    ws.send(JSON.stringify({ type: 'connected', message: 'Welcome to SimulChess' }));
  });

  return httpServer;
}
