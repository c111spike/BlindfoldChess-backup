import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';
import { Capacitor } from '@capacitor/core';

const DB_NAME = 'blindfold_chess';

export interface SavedGame {
  id: number;
  date: string;
  result: 'win' | 'loss' | 'draw';
  playerColor: 'white' | 'black';
  botName: string;
  botElo: number;
  moveCount: number;
  pgn: string;
  clarityScore: number;
  isFavorite: boolean;
  timeControl: string;
}

let sqlite: SQLiteConnection | null = null;
let db: SQLiteDBConnection | null = null;
let isNative = false;
let dbInitialized = false;
let initPromise: Promise<boolean> | null = null;

export async function initGameHistoryDB(): Promise<boolean> {
  if (dbInitialized) return true;
  if (initPromise) return initPromise;
  
  initPromise = doInitGameHistoryDB();
  return initPromise;
}

async function doInitGameHistoryDB(): Promise<boolean> {
  try {
    isNative = Capacitor.isNativePlatform();
    
    if (!isNative) {
      console.log('[GameHistory] Web platform - using localStorage fallback');
      return true;
    }

    sqlite = new SQLiteConnection(CapacitorSQLite);
    
    const retCC = await sqlite.checkConnectionsConsistency();
    const isConnection = (await sqlite.isConnection(DB_NAME, false)).result;
    
    if (retCC.result && isConnection) {
      db = await sqlite.retrieveConnection(DB_NAME, false);
    } else {
      db = await sqlite.createConnection(DB_NAME, false, 'no-encryption', 1, false);
    }
    
    await db.open();
    
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS games (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        result TEXT NOT NULL,
        playerColor TEXT NOT NULL,
        botName TEXT NOT NULL,
        botElo INTEGER NOT NULL,
        moveCount INTEGER NOT NULL,
        pgn TEXT NOT NULL,
        clarityScore REAL NOT NULL,
        isFavorite INTEGER DEFAULT 0,
        timeControl TEXT NOT NULL
      );
    `;
    
    await db.execute(createTableQuery);
    
    console.log('[GameHistory] Database initialized successfully');
    dbInitialized = true;
    return true;
  } catch (error) {
    console.error('[GameHistory] Failed to initialize database:', error);
    dbInitialized = true; // Allow fallback to localStorage
    return false;
  }
}

function getLocalStorageGames(): SavedGame[] {
  try {
    const stored = localStorage.getItem('blindfold_game_history');
    if (!stored) return [];
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

function setLocalStorageGames(games: SavedGame[]): void {
  localStorage.setItem('blindfold_game_history', JSON.stringify(games));
}

export async function saveGame(game: Omit<SavedGame, 'id'>): Promise<number | null> {
  await initGameHistoryDB();
  
  try {
    if (!isNative) {
      const games = getLocalStorageGames();
      const newId = games.length > 0 ? Math.max(...games.map(g => g.id)) + 1 : 1;
      const newGame: SavedGame = { ...game, id: newId };
      games.unshift(newGame);
      setLocalStorageGames(games);
      console.log('[GameHistory] Game saved to localStorage:', newId);
      return newId;
    }

    if (!db) {
      console.error('[GameHistory] Database not initialized');
      return null;
    }

    const query = `
      INSERT INTO games (date, result, playerColor, botName, botElo, moveCount, pgn, clarityScore, isFavorite, timeControl)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `;
    
    const result = await db.run(query, [
      game.date,
      game.result,
      game.playerColor,
      game.botName,
      game.botElo,
      game.moveCount,
      game.pgn,
      game.clarityScore,
      game.isFavorite ? 1 : 0,
      game.timeControl
    ]);
    
    console.log('[GameHistory] Game saved:', result.changes?.lastId);
    return result.changes?.lastId ?? null;
  } catch (error) {
    console.error('[GameHistory] Failed to save game:', error);
    return null;
  }
}

export async function getAllGames(): Promise<SavedGame[]> {
  await initGameHistoryDB();
  
  try {
    if (!isNative) {
      return getLocalStorageGames();
    }

    if (!db) {
      console.error('[GameHistory] Database not initialized');
      return [];
    }

    const result = await db.query('SELECT * FROM games ORDER BY date DESC;');
    
    if (!result.values) return [];
    
    return result.values.map((row: any) => ({
      id: row.id,
      date: row.date,
      result: row.result as 'win' | 'loss' | 'draw',
      playerColor: row.playerColor as 'white' | 'black',
      botName: row.botName,
      botElo: row.botElo,
      moveCount: row.moveCount,
      pgn: row.pgn,
      clarityScore: row.clarityScore,
      isFavorite: row.isFavorite === 1,
      timeControl: row.timeControl
    }));
  } catch (error) {
    console.error('[GameHistory] Failed to get games:', error);
    return [];
  }
}

export async function getFavoriteGames(): Promise<SavedGame[]> {
  await initGameHistoryDB();
  
  try {
    if (!isNative) {
      return getLocalStorageGames().filter(g => g.isFavorite);
    }

    if (!db) {
      console.error('[GameHistory] Database not initialized');
      return [];
    }

    const result = await db.query('SELECT * FROM games WHERE isFavorite = 1 ORDER BY date DESC;');
    
    if (!result.values) return [];
    
    return result.values.map((row: any) => ({
      id: row.id,
      date: row.date,
      result: row.result as 'win' | 'loss' | 'draw',
      playerColor: row.playerColor as 'white' | 'black',
      botName: row.botName,
      botElo: row.botElo,
      moveCount: row.moveCount,
      pgn: row.pgn,
      clarityScore: row.clarityScore,
      isFavorite: row.isFavorite === 1,
      timeControl: row.timeControl
    }));
  } catch (error) {
    console.error('[GameHistory] Failed to get favorite games:', error);
    return [];
  }
}

export async function toggleFavorite(gameId: number): Promise<boolean> {
  await initGameHistoryDB();
  
  try {
    if (!isNative) {
      const games = getLocalStorageGames();
      const game = games.find(g => g.id === gameId);
      if (game) {
        game.isFavorite = !game.isFavorite;
        setLocalStorageGames(games);
        return game.isFavorite;
      }
      return false;
    }

    if (!db) {
      console.error('[GameHistory] Database not initialized');
      return false;
    }

    const current = await db.query('SELECT isFavorite FROM games WHERE id = ?;', [gameId]);
    if (!current.values || current.values.length === 0) return false;
    
    const newValue = current.values[0].isFavorite === 1 ? 0 : 1;
    await db.run('UPDATE games SET isFavorite = ? WHERE id = ?;', [newValue, gameId]);
    
    console.log('[GameHistory] Toggled favorite for game:', gameId);
    return newValue === 1;
  } catch (error) {
    console.error('[GameHistory] Failed to toggle favorite:', error);
    return false;
  }
}

export async function deleteGame(gameId: number): Promise<boolean> {
  await initGameHistoryDB();
  
  try {
    if (!isNative) {
      const games = getLocalStorageGames();
      const filtered = games.filter(g => g.id !== gameId);
      setLocalStorageGames(filtered);
      console.log('[GameHistory] Game deleted from localStorage:', gameId);
      return true;
    }

    if (!db) {
      console.error('[GameHistory] Database not initialized');
      return false;
    }

    await db.run('DELETE FROM games WHERE id = ?;', [gameId]);
    
    console.log('[GameHistory] Game deleted:', gameId);
    return true;
  } catch (error) {
    console.error('[GameHistory] Failed to delete game:', error);
    return false;
  }
}

export async function getGameById(gameId: number): Promise<SavedGame | null> {
  await initGameHistoryDB();
  
  try {
    if (!isNative) {
      const games = getLocalStorageGames();
      return games.find(g => g.id === gameId) ?? null;
    }

    if (!db) {
      console.error('[GameHistory] Database not initialized');
      return null;
    }

    const result = await db.query('SELECT * FROM games WHERE id = ?;', [gameId]);
    
    if (!result.values || result.values.length === 0) return null;
    
    const row = result.values[0];
    return {
      id: row.id,
      date: row.date,
      result: row.result as 'win' | 'loss' | 'draw',
      playerColor: row.playerColor as 'white' | 'black',
      botName: row.botName,
      botElo: row.botElo,
      moveCount: row.moveCount,
      pgn: row.pgn,
      clarityScore: row.clarityScore,
      isFavorite: row.isFavorite === 1,
      timeControl: row.timeControl
    };
  } catch (error) {
    console.error('[GameHistory] Failed to get game by id:', error);
    return null;
  }
}
