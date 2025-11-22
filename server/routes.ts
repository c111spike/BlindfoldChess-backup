import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { insertGameSchema, insertPuzzleAttemptSchema, insertUserSettingsSchema } from "@shared/schema";
import { queueManager } from "./queueManager";

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
      
      const game = await storage.getGame(id);
      if (!game) {
        return res.status(404).json({ message: "Game not found" });
      }
      
      const isAuthorized = game.userId === userId || 
                           game.whitePlayerId === userId || 
                           game.blackPlayerId === userId;
      
      if (!isAuthorized) {
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
      const { timeControl } = req.body;

      if (!['bullet', 'blitz', 'rapid', 'classical'].includes(timeControl)) {
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

      const currentRating = getRatingForTimeControl(timeControl);
      
      res.json({
        success: true,
        timeControl,
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

        return res.json({
          matchId: existingMatch.id,
          matched: true,
          games: isSimul ? userGames : undefined,
          game: !isSimul && userGames.length > 0 ? userGames[0] : undefined,
          boardCount: isSimul ? userGames.length : undefined,
          opponentId,
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

      if (isSimul) {
        res.json({ 
          matched: true, 
          matchId: match.id,
          games: userGames,
          boardCount,
          opponentId: match.player2Id 
        });
      } else {
        res.json({ 
          matched: true,
          matchId: match.id, 
          game: {
            ...userGames[0],
            playerColor: userGames[0].playerColor || "white"
          }, 
          opponentId: match.player2Id 
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
  
  const userConnections = new Map<string, WebSocket>();
  const matchRooms = new Map<string, Set<string>>();

  wss.on('connection', (ws: WebSocket & { userId?: string; matchId?: string }) => {
    console.log('WebSocket client connected');

    ws.on('message', async (message: string) => {
      try {
        const data = JSON.parse(message.toString());
        console.log('Received WebSocket message:', data);
        
        if (data.type === 'auth') {
          ws.userId = data.userId;
          userConnections.set(data.userId, ws);
          ws.send(JSON.stringify({ type: 'authenticated', userId: data.userId }));
        } else if (data.type === 'join_queue') {
          const userId = ws.userId;
          if (!userId) {
            ws.send(JSON.stringify({ type: 'error', message: 'Not authenticated' }));
            return;
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

            const sharedGame = await storage.createGame({
              userId: whitePlayerId,
              whitePlayerId: whitePlayerId,
              blackPlayerId: blackPlayerId,
              mode: `standard_${timeControl}`,
              playerColor: "white",
              timeControl: time,
              increment: 0,
              fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
              whiteTime: time * 60,
              blackTime: time * 60,
              opponentName: blackPlayerName,
            });

            const matchRecord = await storage.createMatch({
              player1Id: match.player1.userId,
              player2Id: match.player2.userId,
              matchType: `standard_${timeControl}`,
              gameIds: [sharedGame.id],
              status: 'in_progress',
            });

            const player1Ws = userConnections.get(match.player1.userId);
            const player2Ws = userConnections.get(match.player2.userId);

            if (player1Ws && player1Ws.readyState === WebSocket.OPEN) {
              player1Ws.send(JSON.stringify({
                type: 'match_found',
                matchId: matchRecord.id,
                game: sharedGame,
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
                game: sharedGame,
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
          
          ws.matchId = matchId;
          
          if (!matchRooms.has(matchId)) {
            matchRooms.set(matchId, new Set());
          }
          matchRooms.get(matchId)!.add(userId);
          
          ws.send(JSON.stringify({ type: 'joined_match', matchId }));
        } else if (data.type === 'move') {
          const matchId = ws.matchId;
          const userId = ws.userId;
          
          if (!matchId || !userId) {
            ws.send(JSON.stringify({ type: 'error', message: 'Not in a match' }));
            return;
          }
          
          // Server-side turn validation
          try {
            const match = await storage.getMatch(matchId);
            if (!match || !match.gameIds || match.gameIds.length === 0) {
              ws.send(JSON.stringify({ type: 'error', message: 'Match not found' }));
              return;
            }
            
            const gameId = match.gameIds[0];
            const game = await storage.getGame(gameId);
            
            if (!game) {
              ws.send(JSON.stringify({ type: 'error', message: 'Game not found' }));
              return;
            }
            
            // Determine whose turn it is from the FEN string
            const fenParts = game.fen.split(' ');
            const currentTurn = fenParts[1]; // 'w' or 'b'
            
            // Check if the user sending the move is the correct player
            const isWhitesTurn = currentTurn === 'w';
            const expectedPlayerId = isWhitesTurn ? game.whitePlayerId : game.blackPlayerId;
            
            if (userId !== expectedPlayerId) {
              console.log(`[WebSocket] Move rejected: userId ${userId} attempted to move on ${currentTurn}'s turn (expected ${expectedPlayerId})`);
              ws.send(JSON.stringify({ 
                type: 'error', 
                message: 'Not your turn' 
              }));
              return;
            }
            
            console.log(`[WebSocket] Move validated: userId ${userId} is ${isWhitesTurn ? 'white' : 'black'} and it's their turn`);
          } catch (error) {
            console.error('[WebSocket] Error validating move:', error);
            ws.send(JSON.stringify({ type: 'error', message: 'Failed to validate move' }));
            return;
          }
          
          const roomUsers = matchRooms.get(matchId);
          if (roomUsers) {
            roomUsers.forEach((roomUserId) => {
              if (roomUserId !== userId) {
                const opponentWs = userConnections.get(roomUserId);
                if (opponentWs && opponentWs.readyState === WebSocket.OPEN) {
                  opponentWs.send(JSON.stringify({
                    type: 'opponent_move',
                    matchId: matchId,
                    move: data.move,
                    fen: data.fen,
                    whiteTime: data.whiteTime,
                    blackTime: data.blackTime,
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
        }
      } catch (error) {
        console.error('WebSocket error:', error);
      }
    });

    ws.on('close', () => {
      console.log('WebSocket client disconnected');
      
      if (ws.userId) {
        userConnections.delete(ws.userId);
        
        const socketId = (ws as any).socketId;
        if (socketId) {
          queueManager.removeBySocketId(socketId);
        }
        
        if (ws.matchId) {
          const roomUsers = matchRooms.get(ws.matchId);
          if (roomUsers) {
            roomUsers.delete(ws.userId);
            if (roomUsers.size === 0) {
              matchRooms.delete(ws.matchId);
            }
          }
        }
      }
    });

    ws.send(JSON.stringify({ type: 'connected', message: 'Welcome to SimulChess' }));
  });

  return httpServer;
}
