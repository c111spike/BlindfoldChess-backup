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
      
      res.json({
        ...activeGame,
        playerColor: activeGame.playerColor || "white"
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
        
        const rating = await storage.getOrCreateRating(userId);
        
        const opponentRating = 1200;
        const kFactor = 32;
        
        const getRatingField = (game: any): keyof typeof rating => {
          const timeControl = game.timeControl || 5;
          if (timeControl <= 1) return 'bullet';
          if (timeControl <= 5) return 'blitz';
          if (timeControl <= 15) return 'rapid';
          return 'classical';
        };
        
        const ratingField = getRatingField(game);
        const currentRating = rating[ratingField];
        
        const score = isWin ? 1 : isDraw ? 0.5 : 0;
        const expectedScore = 1 / (1 + Math.pow(10, (opponentRating - currentRating) / 400));
        const ratingChange = Math.round(kFactor * (score - expectedScore));
        
        const ratingUpdate: any = {};
        ratingUpdate[ratingField] = currentRating + ratingChange;
        
        await storage.updateRating(userId, ratingUpdate);
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
      const { queueType, isBlindfold } = req.body;

      const rating = await storage.getOrCreateRating(userId);

      const getRatingRange = (r: number) => {
        if (r < 1400) return "1200-1400";
        if (r < 1600) return "1400-1600";
        if (r < 1800) return "1600-1800";
        return "1800+";
      };

      const getRatingForQueueType = (queueType: string): number => {
        if (queueType.includes('bullet')) return rating.bullet;
        if (queueType.includes('blitz')) return rating.blitz;
        if (queueType.includes('rapid')) return rating.rapid;
        if (queueType.includes('classical')) return rating.classical;
        return 1200;
      };

      const currentRating = getRatingForQueueType(queueType);
      const ratingRange = getRatingRange(currentRating);

      const queueEntry = await storage.joinQueue({
        userId,
        queueType,
        ratingRange,
        isBlindfold,
      });

      res.json(queueEntry);
    } catch (error) {
      console.error("Error joining queue:", error);
      res.status(500).json({ message: "Failed to join queue" });
    }
  });

  app.post('/api/queue/leave', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { queueType } = req.body;

      await storage.leaveQueue(userId, queueType);
      res.json({ success: true });
    } catch (error) {
      console.error("Error leaving queue:", error);
      res.status(500).json({ message: "Failed to leave queue" });
    }
  });

  app.get('/api/queue/status', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const queueStatus = await storage.getUserQueueStatus(userId);

      res.json(queueStatus || null);
    } catch (error) {
      console.error("Error fetching queue status:", error);
      res.status(500).json({ message: "Failed to fetch queue status" });
    }
  });

  app.post('/api/queue/findMatch', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { queueType } = req.body;

      const opponent = await storage.findMatch(userId, queueType);

      if (opponent) {
        await storage.leaveQueue(userId, queueType);
        await storage.leaveQueue(opponent.userId, queueType);

        const userColor = Math.random() > 0.5 ? "white" : "black";
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

        if (isSimul && boardCount >= 2 && boardCount <= 10) {
          const games = [];
          const opponentGames = [];
          
          for (let i = 0; i < boardCount; i++) {
            const game = await storage.createGame({
              userId,
              mode: queueType,
              playerColor: userColor,
              timeControl,
              increment: 0,
              fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
              moves: [],
              whiteTime: 30,
              blackTime: 30,
              opponentName: opponent.userId,
              boardCount,
            });
            games.push(game);

            const opponentGame = await storage.createGame({
              userId: opponent.userId,
              mode: queueType,
              playerColor: userColor === "white" ? "black" : "white",
              timeControl,
              increment: 0,
              fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
              moves: [],
              whiteTime: 30,
              blackTime: 30,
              opponentName: userId,
              boardCount,
            });
            opponentGames.push(opponentGame);
          }

          res.json({ 
            matched: true, 
            games: games,
            boardCount,
            opponentId: opponent.userId 
          });
        } else {
          const game = await storage.createGame({
            userId,
            mode: queueType,
            playerColor: userColor,
            timeControl,
            increment: 0,
            fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
            moves: [],
            whiteTime: timeControl * 60,
            blackTime: timeControl * 60,
            opponentName: opponent.userId,
          });

          const opponentGame = await storage.createGame({
            userId: opponent.userId,
            mode: queueType,
            playerColor: userColor === "white" ? "black" : "white",
            timeControl,
            increment: 0,
            fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
            moves: [],
            whiteTime: timeControl * 60,
            blackTime: timeControl * 60,
            opponentName: userId,
          });

          res.json({ 
            matched: true, 
            game: {
              ...game,
              playerColor: game.playerColor || "white"
            }, 
            opponentId: opponent.userId 
          });
        }
      } else {
        res.json({ matched: false });
      }
    } catch (error) {
      console.error("Error finding match:", error);
      res.status(500).json({ message: "Failed to find match" });
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
