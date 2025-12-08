import { storage } from "./storage";
import type { Game, UserAntiCheat, ReviewPriority } from "@shared/schema";

interface RiskFactors {
  accuracyAnomaly: number;
  timeAnomaly: number;
  simulAnomaly: number;
  reportScore: number;
}

interface RiskAssessment {
  riskScore: number;
  factors: RiskFactors;
  shouldFlag: boolean;
  priority: ReviewPriority;
  reason: string | null;
}

const ACCURACY_THRESHOLD = 95;
const PERFECT_GAME_STREAK_THRESHOLD = 3;
const REPORT_WEIGHT = 10;
const FLAG_THRESHOLD = 50;

export async function calculateRiskScore(userId: string, recentGames?: Game[]): Promise<RiskAssessment> {
  const games = recentGames || await storage.getRecentGames(userId, 20);
  const antiCheat = await storage.getOrCreateUserAntiCheat(userId);
  
  const factors: RiskFactors = {
    accuracyAnomaly: 0,
    timeAnomaly: 0,
    simulAnomaly: 0,
    reportScore: 0,
  };
  
  factors.accuracyAnomaly = calculateAccuracyAnomaly(games, userId);
  
  factors.timeAnomaly = calculateTimeAnomaly(games, userId);
  
  factors.simulAnomaly = calculateSimulAnomaly(games, userId);
  
  factors.reportScore = (antiCheat.reportCount || 0) * REPORT_WEIGHT;
  
  const riskScore = Math.min(100, 
    factors.accuracyAnomaly * 0.4 +
    factors.timeAnomaly * 0.2 +
    factors.simulAnomaly * 0.2 +
    factors.reportScore * 0.2
  );
  
  const shouldFlag = riskScore >= FLAG_THRESHOLD;
  
  let priority: ReviewPriority = 'low';
  if (riskScore >= 90) {
    priority = 'critical';
  } else if (riskScore >= 75) {
    priority = 'high';
  } else if (riskScore >= FLAG_THRESHOLD) {
    priority = 'medium';
  }
  
  let reason: string | null = null;
  if (shouldFlag) {
    const reasons: string[] = [];
    if (factors.accuracyAnomaly > 30) reasons.push('Unusually high move accuracy');
    if (factors.timeAnomaly > 20) reasons.push('Suspicious think time patterns');
    if (factors.simulAnomaly > 25) reasons.push('Abnormal simul performance');
    if (factors.reportScore > 30) reasons.push('Multiple community reports');
    reason = reasons.join('; ');
  }
  
  return {
    riskScore,
    factors,
    shouldFlag,
    priority,
    reason,
  };
}

function calculateAccuracyAnomaly(games: Game[], userId: string): number {
  if (games.length === 0) return 0;
  
  const playerGames = games.filter(g => 
    (g.whitePlayerId === userId || g.blackPlayerId === userId) && 
    g.status === 'completed'
  );
  
  if (playerGames.length < 5) return 0;
  
  let highAccuracyCount = 0;
  let perfectGameStreak = 0;
  let maxPerfectStreak = 0;
  
  for (const game of playerGames) {
    const accuracy = game.whitePlayerId === userId 
      ? (game as any).whiteAccuracy 
      : (game as any).blackAccuracy;
    
    if (accuracy && accuracy >= ACCURACY_THRESHOLD) {
      highAccuracyCount++;
      perfectGameStreak++;
      maxPerfectStreak = Math.max(maxPerfectStreak, perfectGameStreak);
    } else {
      perfectGameStreak = 0;
    }
  }
  
  const highAccuracyRatio = highAccuracyCount / playerGames.length;
  
  let anomalyScore = 0;
  
  if (highAccuracyRatio > 0.7) anomalyScore += 40;
  else if (highAccuracyRatio > 0.5) anomalyScore += 25;
  else if (highAccuracyRatio > 0.3) anomalyScore += 10;
  
  if (maxPerfectStreak >= PERFECT_GAME_STREAK_THRESHOLD) {
    anomalyScore += Math.min(30, maxPerfectStreak * 10);
  }
  
  return Math.min(100, anomalyScore);
}

function calculateTimeAnomaly(games: Game[], userId: string): number {
  if (games.length === 0) return 0;
  
  let suspiciousTimePatterns = 0;
  let analyzedGames = 0;
  
  for (const game of games) {
    if (game.whitePlayerId !== userId && game.blackPlayerId !== userId) continue;
    if (!game.moveHistory) continue;
    
    analyzedGames++;
    const moves = game.moveHistory;
    
    let prevMoveTime = 0;
    let consistentTimeCount = 0;
    
    const moveTimes: number[] = [];
    for (const move of moves as any[]) {
      if (move.timestamp) {
        moveTimes.push(move.timestamp);
      }
    }
    
    if (moveTimes.length < 10) continue;
    
    for (let i = 1; i < moveTimes.length; i++) {
      const timeDiff = moveTimes[i] - moveTimes[i-1];
      if (Math.abs(timeDiff - prevMoveTime) < 500) {
        consistentTimeCount++;
      }
      prevMoveTime = timeDiff;
    }
    
    if (consistentTimeCount > moveTimes.length * 0.6) {
      suspiciousTimePatterns++;
    }
  }
  
  if (analyzedGames === 0) return 0;
  
  const suspiciousRatio = suspiciousTimePatterns / analyzedGames;
  
  return Math.min(100, suspiciousRatio * 100);
}

function calculateSimulAnomaly(games: Game[], userId: string): number {
  const simulGames = games.filter(g => 
    g.mode === 'simul' && 
    (g.whitePlayerId === userId || g.blackPlayerId === userId)
  );
  
  if (simulGames.length < 3) return 0;
  
  let anomalyScore = 0;
  let winsAgainstHigherRated = 0;
  
  for (const game of simulGames) {
    const isWhite = game.whitePlayerId === userId;
    const playerRating = isWhite ? (game as any).whiteRating : (game as any).blackRating;
    const opponentRating = isWhite ? (game as any).blackRating : (game as any).whiteRating;
    const won = (isWhite && game.result === 'white') || (!isWhite && game.result === 'black');
    
    if (opponentRating && playerRating && opponentRating > playerRating + 200 && won) {
      winsAgainstHigherRated++;
    }
  }
  
  const winRate = winsAgainstHigherRated / simulGames.length;
  
  if (winRate > 0.7) anomalyScore += 50;
  else if (winRate > 0.5) anomalyScore += 30;
  else if (winRate > 0.3) anomalyScore += 15;
  
  return Math.min(100, anomalyScore);
}

export async function updateUserRiskScore(userId: string): Promise<UserAntiCheat> {
  const assessment = await calculateRiskScore(userId);
  
  const updateData: Partial<UserAntiCheat> = {
    riskScore: assessment.riskScore,
    accuracyAnomaly: assessment.factors.accuracyAnomaly,
    timeAnomaly: assessment.factors.timeAnomaly,
    simulAnomaly: assessment.factors.simulAnomaly,
  };
  
  const antiCheat = await storage.updateUserAntiCheat(userId, updateData);
  
  if (assessment.shouldFlag && !antiCheat.isFlagged) {
    return await storage.flagUserForReview(userId, assessment.reason || 'Automated risk detection', assessment.priority);
  }
  
  return antiCheat;
}

export async function processGameForAntiCheat(game: Game): Promise<void> {
  const playersToCheck: string[] = [];
  
  if (game.whitePlayerId) playersToCheck.push(game.whitePlayerId);
  if (game.blackPlayerId) playersToCheck.push(game.blackPlayerId);
  
  for (const playerId of playersToCheck) {
    try {
      await updateUserRiskScore(playerId);
    } catch (error) {
      console.error(`Error processing anti-cheat for player ${playerId}:`, error);
    }
  }
}

export async function getAntiCheatDashboardData() {
  const flaggedUsers = await storage.getAllFlaggedUsersWithDetails();
  const unresolvedReports = await storage.getCheatReports(undefined, false);
  
  const byPriority = {
    critical: flaggedUsers.filter(u => u.reviewPriority === 'critical'),
    high: flaggedUsers.filter(u => u.reviewPriority === 'high'),
    medium: flaggedUsers.filter(u => u.reviewPriority === 'medium'),
    low: flaggedUsers.filter(u => u.reviewPriority === 'low'),
  };
  
  return {
    flaggedUsers,
    unresolvedReports,
    byPriority,
    stats: {
      totalFlagged: flaggedUsers.length,
      criticalCount: byPriority.critical.length,
      highCount: byPriority.high.length,
      mediumCount: byPriority.medium.length,
      lowCount: byPriority.low.length,
      pendingReports: unresolvedReports.length,
    },
  };
}
