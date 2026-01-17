import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';
import { Capacitor } from '@capacitor/core';

const DB_NAME = 'blindfold_chess';

export type TrainingMode = 'color_blitz' | 'coordinate_sniper' | 'voice_move_master' | 'knights_path' | 'endgame_drills' | 'blindfold_marathon';

export interface TrainingSession {
  id: number;
  mode: TrainingMode;
  score: number;
  streak: number;
  achievedAt: string;
}

export interface TrainingStats {
  colorBlitzBest: number | null;
  colorBlitzBestDate: string | null;
  colorBlitzBestStreak: number | null;
  coordinateSniperBest: number | null;
  coordinateSniperBestDate: string | null;
  coordinateSniperBestStreak: number | null;
  voiceMoveMasterBest: number | null;
  voiceMoveMasterBestDate: string | null;
  voiceMoveMasterBestStreak: number | null;
  knightsPathBest: number | null;
  knightsPathBestDate: string | null;
  endgameDrillsBest: number | null;
  endgameDrillsBestDate: string | null;
  blindfoldMarathonBest: number | null;
  blindfoldMarathonBestDate: string | null;
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
        streak INTEGER NOT NULL DEFAULT 0,
        achieved_at TEXT NOT NULL
      );
    `;
    
    await db.execute(createTableQuery);
    
    // Migration: Add streak column if it doesn't exist (for existing installs)
    try {
      const tableInfo = await db.query("PRAGMA table_info(training_stats);");
      const hasStreakColumn = tableInfo.values?.some((col: { name?: string }) => col.name === 'streak');
      if (!hasStreakColumn) {
        await db.execute('ALTER TABLE training_stats ADD COLUMN streak INTEGER NOT NULL DEFAULT 0;');
        console.log('[TrainingStats] Migrated: Added streak column');
      }
    } catch (migrationError) {
      console.warn('[TrainingStats] Migration check failed:', migrationError);
    }
    
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

export async function saveTrainingSession(mode: TrainingMode, score: number, streak: number = 0): Promise<number | null> {
  await initTrainingDB();
  
  const achievedAt = new Date().toISOString();
  
  try {
    if (!isNative) {
      const sessions = getLocalStorageSessions();
      const newId = sessions.length > 0 ? Math.max(...sessions.map(s => s.id)) + 1 : 1;
      const newSession: TrainingSession = { id: newId, mode, score, streak, achievedAt };
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
      INSERT INTO training_stats (mode, score, streak, achieved_at)
      VALUES (?, ?, ?, ?);
    `;
    
    const result = await db.run(query, [mode, score, streak, achievedAt]);
    console.log('[TrainingStats] Session saved:', result.changes?.lastId);
    return result.changes?.lastId || null;
  } catch (error) {
    console.error('[TrainingStats] Failed to save session:', error instanceof Error ? error.message : String(error));
    return null;
  }
}

export async function getTrainingStats(): Promise<TrainingStats> {
  await initTrainingDB();
  
  const defaultStats: TrainingStats = {
    colorBlitzBest: null,
    colorBlitzBestDate: null,
    colorBlitzBestStreak: null,
    coordinateSniperBest: null,
    coordinateSniperBestDate: null,
    coordinateSniperBestStreak: null,
    voiceMoveMasterBest: null,
    voiceMoveMasterBestDate: null,
    voiceMoveMasterBestStreak: null,
    knightsPathBest: null,
    knightsPathBestDate: null,
    endgameDrillsBest: null,
    endgameDrillsBestDate: null,
    blindfoldMarathonBest: null,
    blindfoldMarathonBestDate: null,
    totalSessions: 0,
    recentSessions: [],
  };
  
  try {
    if (!isNative) {
      const sessions = getLocalStorageSessions();
      
      const colorBlitzSessions = sessions.filter(s => s.mode === 'color_blitz');
      const sniperSessions = sessions.filter(s => s.mode === 'coordinate_sniper');
      const voiceMasterSessions = sessions.filter(s => s.mode === 'voice_move_master');
      const knightsPathSessions = sessions.filter(s => s.mode === 'knights_path');
      const endgameDrillsSessions = sessions.filter(s => s.mode === 'endgame_drills');
      const blindfoldMarathonSessions = sessions.filter(s => s.mode === 'blindfold_marathon');
      
      let colorBlitzBest: number | null = null;
      let colorBlitzBestDate: string | null = null;
      let colorBlitzBestStreak: number | null = null;
      if (colorBlitzSessions.length > 0) {
        const best = colorBlitzSessions.reduce((max, s) => s.score > max.score ? s : max);
        colorBlitzBest = best.score;
        colorBlitzBestDate = best.achievedAt;
        const bestStreak = colorBlitzSessions.reduce((max, s) => (s.streak || 0) > (max.streak || 0) ? s : max);
        colorBlitzBestStreak = bestStreak.streak || null;
      }
      
      let coordinateSniperBest: number | null = null;
      let coordinateSniperBestDate: string | null = null;
      let coordinateSniperBestStreak: number | null = null;
      if (sniperSessions.length > 0) {
        const best = sniperSessions.reduce((min, s) => s.score < min.score ? s : min);
        coordinateSniperBest = best.score;
        coordinateSniperBestDate = best.achievedAt;
        const bestStreak = sniperSessions.reduce((max, s) => (s.streak || 0) > (max.streak || 0) ? s : max);
        coordinateSniperBestStreak = bestStreak.streak || null;
      }
      
      let voiceMoveMasterBest: number | null = null;
      let voiceMoveMasterBestDate: string | null = null;
      let voiceMoveMasterBestStreak: number | null = null;
      if (voiceMasterSessions.length > 0) {
        const best = voiceMasterSessions.reduce((max, s) => s.score > max.score ? s : max);
        voiceMoveMasterBest = best.score;
        voiceMoveMasterBestDate = best.achievedAt;
        const bestStreak = voiceMasterSessions.reduce((max, s) => (s.streak || 0) > (max.streak || 0) ? s : max);
        voiceMoveMasterBestStreak = bestStreak.streak || null;
      }
      
      let knightsPathBest: number | null = null;
      let knightsPathBestDate: string | null = null;
      if (knightsPathSessions.length > 0) {
        const best = knightsPathSessions.reduce((min, s) => s.score < min.score ? s : min);
        knightsPathBest = best.score;
        knightsPathBestDate = best.achievedAt;
      }
      
      let endgameDrillsBest: number | null = null;
      let endgameDrillsBestDate: string | null = null;
      if (endgameDrillsSessions.length > 0) {
        const best = endgameDrillsSessions.reduce((min, s) => s.score < min.score ? s : min);
        endgameDrillsBest = best.score;
        endgameDrillsBestDate = best.achievedAt;
      }
      
      let blindfoldMarathonBest: number | null = null;
      let blindfoldMarathonBestDate: string | null = null;
      if (blindfoldMarathonSessions.length > 0) {
        const best = blindfoldMarathonSessions.reduce((min, s) => s.score < min.score ? s : min);
        blindfoldMarathonBest = best.score;
        blindfoldMarathonBestDate = best.achievedAt;
      }
      
      return {
        colorBlitzBest,
        colorBlitzBestDate,
        colorBlitzBestStreak,
        coordinateSniperBest,
        coordinateSniperBestDate,
        coordinateSniperBestStreak,
        voiceMoveMasterBest,
        voiceMoveMasterBestDate,
        voiceMoveMasterBestStreak,
        knightsPathBest,
        knightsPathBestDate,
        endgameDrillsBest,
        endgameDrillsBestDate,
        blindfoldMarathonBest,
        blindfoldMarathonBestDate,
        totalSessions: sessions.length,
        recentSessions: sessions.slice(0, 10),
      };
    }

    if (!db) {
      return defaultStats;
    }

    const colorBlitzBestQuery = `
      SELECT score as best_score, achieved_at
      FROM training_stats
      WHERE mode = 'color_blitz'
      ORDER BY score DESC
      LIMIT 1;
    `;
    
    const colorBlitzStreakQuery = `
      SELECT MAX(streak) as best_streak
      FROM training_stats
      WHERE mode = 'color_blitz';
    `;
    
    const sniperBestQuery = `
      SELECT score as best_time, achieved_at
      FROM training_stats
      WHERE mode = 'coordinate_sniper'
      ORDER BY score ASC
      LIMIT 1;
    `;
    
    const sniperStreakQuery = `
      SELECT MAX(streak) as best_streak
      FROM training_stats
      WHERE mode = 'coordinate_sniper';
    `;
    
    const voiceMasterBestQuery = `
      SELECT score as best_score, achieved_at
      FROM training_stats
      WHERE mode = 'voice_move_master'
      ORDER BY score DESC
      LIMIT 1;
    `;
    
    const voiceMasterStreakQuery = `
      SELECT MAX(streak) as best_streak
      FROM training_stats
      WHERE mode = 'voice_move_master';
    `;
    
    const knightsPathBestQuery = `
      SELECT score as best_time, achieved_at
      FROM training_stats
      WHERE mode = 'knights_path'
      ORDER BY score ASC
      LIMIT 1;
    `;
    
    const endgameDrillsBestQuery = `
      SELECT score as best_time, achieved_at
      FROM training_stats
      WHERE mode = 'endgame_drills'
      ORDER BY score ASC
      LIMIT 1;
    `;
    
    const blindfoldMarathonBestQuery = `
      SELECT score as best_time, achieved_at
      FROM training_stats
      WHERE mode = 'blindfold_marathon'
      ORDER BY score ASC
      LIMIT 1;
    `;
    
    const countQuery = `SELECT COUNT(*) as total FROM training_stats;`;
    
    const recentQuery = `
      SELECT id, mode, score, streak, achieved_at as achievedAt
      FROM training_stats
      ORDER BY achieved_at DESC
      LIMIT 10;
    `;
    
    const colorResult = await db.query(colorBlitzBestQuery);
    const colorStreakResult = await db.query(colorBlitzStreakQuery);
    const sniperResult = await db.query(sniperBestQuery);
    const sniperStreakResult = await db.query(sniperStreakQuery);
    const voiceMasterResult = await db.query(voiceMasterBestQuery);
    const voiceMasterStreakResult = await db.query(voiceMasterStreakQuery);
    const knightsPathResult = await db.query(knightsPathBestQuery);
    const endgameDrillsResult = await db.query(endgameDrillsBestQuery);
    const blindfoldMarathonResult = await db.query(blindfoldMarathonBestQuery);
    const countResult = await db.query(countQuery);
    const recentResult = await db.query(recentQuery);
    
    return {
      colorBlitzBest: colorResult.values?.[0]?.best_score || null,
      colorBlitzBestDate: colorResult.values?.[0]?.achieved_at || null,
      colorBlitzBestStreak: colorStreakResult.values?.[0]?.best_streak || null,
      coordinateSniperBest: sniperResult.values?.[0]?.best_time || null,
      coordinateSniperBestDate: sniperResult.values?.[0]?.achieved_at || null,
      coordinateSniperBestStreak: sniperStreakResult.values?.[0]?.best_streak || null,
      voiceMoveMasterBest: voiceMasterResult.values?.[0]?.best_score || null,
      voiceMoveMasterBestDate: voiceMasterResult.values?.[0]?.achieved_at || null,
      voiceMoveMasterBestStreak: voiceMasterStreakResult.values?.[0]?.best_streak || null,
      knightsPathBest: knightsPathResult.values?.[0]?.best_time || null,
      knightsPathBestDate: knightsPathResult.values?.[0]?.achieved_at || null,
      endgameDrillsBest: endgameDrillsResult.values?.[0]?.best_time || null,
      endgameDrillsBestDate: endgameDrillsResult.values?.[0]?.achieved_at || null,
      blindfoldMarathonBest: blindfoldMarathonResult.values?.[0]?.best_time || null,
      blindfoldMarathonBestDate: blindfoldMarathonResult.values?.[0]?.achieved_at || null,
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

export async function resetTrainingStats(): Promise<void> {
  await initTrainingDB();
  
  try {
    if (!isNative) {
      localStorage.removeItem('blindfold_training_stats');
      console.log('[TrainingStats] LocalStorage training stats cleared');
      return;
    }
    
    if (db) {
      await db.execute('DELETE FROM training_stats;');
      console.log('[TrainingStats] Database training stats cleared');
    }
  } catch (error) {
    console.error('[TrainingStats] Failed to reset stats:', error);
  }
}
