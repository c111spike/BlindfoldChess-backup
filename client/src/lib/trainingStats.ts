import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';
import { Capacitor } from '@capacitor/core';

const DB_NAME = 'blindfold_chess';

export interface TrainingSession {
  id: number;
  mode: 'color_blitz' | 'coordinate_sniper';
  score: number;
  achievedAt: string;
}

export interface TrainingStats {
  colorBlitzBest: number | null;
  colorBlitzBestDate: string | null;
  coordinateSniperBest: number | null;
  coordinateSniperBestDate: string | null;
  totalSessions: number;
  recentSessions: TrainingSession[];
}

let sqlite: SQLiteConnection | null = null;
let db: SQLiteDBConnection | null = null;
let isNative = false;
let dbInitialized = false;
let initPromise: Promise<boolean> | null = null;

export async function initTrainingDB(): Promise<boolean> {
  if (dbInitialized) return true;
  if (initPromise) return initPromise;
  
  initPromise = doInitTrainingDB();
  return initPromise;
}

async function doInitTrainingDB(): Promise<boolean> {
  try {
    isNative = Capacitor.isNativePlatform();
    
    if (!isNative) {
      console.log('[TrainingStats] Web platform - using localStorage fallback');
      dbInitialized = true;
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
      CREATE TABLE IF NOT EXISTS training_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mode TEXT NOT NULL,
        score REAL NOT NULL,
        achieved_at TEXT NOT NULL
      );
    `;
    
    await db.execute(createTableQuery);
    
    console.log('[TrainingStats] Database initialized successfully');
    dbInitialized = true;
    return true;
  } catch (error) {
    console.error('[TrainingStats] Failed to initialize database:', error);
    dbInitialized = true;
    return false;
  }
}

function getLocalStorageSessions(): TrainingSession[] {
  try {
    const stored = localStorage.getItem('blindfold_training_stats');
    if (!stored) return [];
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

function setLocalStorageSessions(sessions: TrainingSession[]): void {
  localStorage.setItem('blindfold_training_stats', JSON.stringify(sessions));
}

export async function saveTrainingSession(mode: 'color_blitz' | 'coordinate_sniper', score: number): Promise<number | null> {
  await initTrainingDB();
  
  const achievedAt = new Date().toISOString();
  
  try {
    if (!isNative) {
      const sessions = getLocalStorageSessions();
      const newId = sessions.length > 0 ? Math.max(...sessions.map(s => s.id)) + 1 : 1;
      const newSession: TrainingSession = { id: newId, mode, score, achievedAt };
      sessions.unshift(newSession);
      setLocalStorageSessions(sessions);
      console.log('[TrainingStats] Session saved to localStorage:', newId);
      return newId;
    }

    if (!db) {
      console.error('[TrainingStats] Database not initialized');
      return null;
    }

    const query = `
      INSERT INTO training_stats (mode, score, achieved_at)
      VALUES (?, ?, ?);
    `;
    
    const result = await db.run(query, [mode, score, achievedAt]);
    console.log('[TrainingStats] Session saved:', result.changes?.lastId);
    return result.changes?.lastId || null;
  } catch (error) {
    console.error('[TrainingStats] Failed to save session:', error);
    return null;
  }
}

export async function getTrainingStats(): Promise<TrainingStats> {
  await initTrainingDB();
  
  const defaultStats: TrainingStats = {
    colorBlitzBest: null,
    colorBlitzBestDate: null,
    coordinateSniperBest: null,
    coordinateSniperBestDate: null,
    totalSessions: 0,
    recentSessions: [],
  };
  
  try {
    if (!isNative) {
      const sessions = getLocalStorageSessions();
      
      const colorBlitzSessions = sessions.filter(s => s.mode === 'color_blitz');
      const sniperSessions = sessions.filter(s => s.mode === 'coordinate_sniper');
      
      let colorBlitzBest: number | null = null;
      let colorBlitzBestDate: string | null = null;
      if (colorBlitzSessions.length > 0) {
        const best = colorBlitzSessions.reduce((max, s) => s.score > max.score ? s : max);
        colorBlitzBest = best.score;
        colorBlitzBestDate = best.achievedAt;
      }
      
      let coordinateSniperBest: number | null = null;
      let coordinateSniperBestDate: string | null = null;
      if (sniperSessions.length > 0) {
        const best = sniperSessions.reduce((min, s) => s.score < min.score ? s : min);
        coordinateSniperBest = best.score;
        coordinateSniperBestDate = best.achievedAt;
      }
      
      return {
        colorBlitzBest,
        colorBlitzBestDate,
        coordinateSniperBest,
        coordinateSniperBestDate,
        totalSessions: sessions.length,
        recentSessions: sessions.slice(0, 10),
      };
    }

    if (!db) {
      return defaultStats;
    }

    const colorBlitzQuery = `
      SELECT MAX(score) as best_score, achieved_at
      FROM training_stats
      WHERE mode = 'color_blitz'
      GROUP BY mode
      ORDER BY score DESC
      LIMIT 1;
    `;
    
    const sniperQuery = `
      SELECT MIN(score) as best_time, achieved_at
      FROM training_stats
      WHERE mode = 'coordinate_sniper'
      GROUP BY mode
      ORDER BY score ASC
      LIMIT 1;
    `;
    
    const countQuery = `SELECT COUNT(*) as total FROM training_stats;`;
    
    const recentQuery = `
      SELECT id, mode, score, achieved_at as achievedAt
      FROM training_stats
      ORDER BY achieved_at DESC
      LIMIT 10;
    `;
    
    const colorResult = await db.query(colorBlitzQuery);
    const sniperResult = await db.query(sniperQuery);
    const countResult = await db.query(countQuery);
    const recentResult = await db.query(recentQuery);
    
    return {
      colorBlitzBest: colorResult.values?.[0]?.best_score || null,
      colorBlitzBestDate: colorResult.values?.[0]?.achieved_at || null,
      coordinateSniperBest: sniperResult.values?.[0]?.best_time || null,
      coordinateSniperBestDate: sniperResult.values?.[0]?.achieved_at || null,
      totalSessions: countResult.values?.[0]?.total || 0,
      recentSessions: (recentResult.values || []) as TrainingSession[],
    };
  } catch (error) {
    console.error('[TrainingStats] Failed to get stats:', error);
    return defaultStats;
  }
}

export function getDailyGoalsEnabled(): boolean {
  return localStorage.getItem('blindfold_daily_goals') !== 'false';
}

export function setDailyGoalsEnabled(enabled: boolean): void {
  localStorage.setItem('blindfold_daily_goals', enabled ? 'true' : 'false');
}

export function getTodaySessionCount(): number {
  const sessions = getLocalStorageSessions();
  const today = new Date().toDateString();
  return sessions.filter(s => new Date(s.achievedAt).toDateString() === today).length;
}

export function isDailyGoalMet(): boolean {
  return getTodaySessionCount() >= 2;
}
