import type { BotPersonality } from '@shared/botTypes';

export interface LichessOpeningMove {
  uci: string;
  san: string;
  white: number;
  draws: number;
  black: number;
  averageRating: number;
}

export interface LichessOpeningResponse {
  opening?: {
    eco: string;
    name: string;
  };
  moves: LichessOpeningMove[];
}

// Cache opening lookups to avoid redundant API calls
const openingCache = new Map<string, LichessOpeningResponse>();

// Lichess API rate limiting
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 100; // ms between requests

async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest));
  }
  
  lastRequestTime = Date.now();
  return fetch(url);
}

export async function getLichessOpeningMoves(fen: string): Promise<LichessOpeningResponse | null> {
  // Check cache first
  const cached = openingCache.get(fen);
  if (cached) {
    return cached;
  }
  
  try {
    // Use Lichess Masters database for high-quality moves
    const mastersUrl = `https://explorer.lichess.ovh/masters?fen=${encodeURIComponent(fen)}`;
    const mastersResponse = await rateLimitedFetch(mastersUrl);
    
    if (mastersResponse.ok) {
      const data = await mastersResponse.json() as LichessOpeningResponse;
      
      if (data.moves && data.moves.length > 0) {
        openingCache.set(fen, data);
        return data;
      }
    }
    
    // Fallback to Lichess player database for more variety
    const lichessUrl = `https://explorer.lichess.ovh/lichess?variant=standard&speeds=blitz,rapid,classical&ratings=1600,1800,2000,2200,2500&fen=${encodeURIComponent(fen)}`;
    const lichessResponse = await rateLimitedFetch(lichessUrl);
    
    if (lichessResponse.ok) {
      const data = await lichessResponse.json() as LichessOpeningResponse;
      openingCache.set(fen, data);
      return data;
    }
    
    return null;
  } catch (error) {
    console.error('[LichessOpenings] Failed to fetch opening moves:', error);
    return null;
  }
}

// Personality-based opening line selection
export function selectOpeningMoveByPersonality(
  moves: LichessOpeningMove[],
  personality: BotPersonality
): LichessOpeningMove | null {
  if (moves.length === 0) return null;
  if (moves.length === 1) return moves[0];
  
  // Calculate total games for each move
  const movesWithStats = moves.map(m => ({
    ...m,
    totalGames: m.white + m.draws + m.black,
    whiteWinRate: m.white / (m.white + m.draws + m.black + 0.001),
    blackWinRate: m.black / (m.white + m.draws + m.black + 0.001),
    drawRate: m.draws / (m.white + m.draws + m.black + 0.001),
  }));
  
  // Score each move based on personality
  const scoredMoves = movesWithStats.map(m => {
    let score = Math.log(m.totalGames + 1) * 10; // Popularity baseline
    
    switch (personality) {
      case 'aggressive':
        // Prefer sharp lines with decisive results
        const decisiveRate = 1 - m.drawRate;
        score += decisiveRate * 50;
        // Slight bonus for lines where the active side wins more
        score += (m.whiteWinRate - m.blackWinRate) * 20;
        break;
        
      case 'tactician':
        // Prefer varied, tactical openings (lower draw rate)
        score += (1 - m.drawRate) * 60;
        // Prefer less popular lines (more surprise value)
        score -= Math.log(m.totalGames + 1) * 5;
        break;
        
      case 'defensive':
        // Prefer solid lines with high draw rates or good survival
        score += m.drawRate * 40;
        // Prefer popular, well-tested lines
        score += Math.log(m.totalGames + 1) * 5;
        break;
        
      case 'positional':
        // Prefer main lines (high popularity)
        score += Math.log(m.totalGames + 1) * 15;
        // Slight preference for balanced positions
        const balance = 1 - Math.abs(m.whiteWinRate - m.blackWinRate);
        score += balance * 20;
        break;
        
      case 'bishop_lover':
        // No specific opening preference, but favor moves that keep bishops active
        // (This would require deeper analysis, so just use popularity)
        score += Math.log(m.totalGames + 1) * 10;
        break;
        
      case 'knight_lover':
        // Prefer closed positions (harder to detect from opening stats alone)
        // Slightly favor less popular lines
        score += Math.log(m.totalGames + 1) * 5;
        break;
        
      case 'balanced':
      default:
        // Weighted toward most popular/successful moves
        score += Math.log(m.totalGames + 1) * 12;
        break;
    }
    
    return { move: m, score };
  });
  
  // Sort by score
  scoredMoves.sort((a, b) => b.score - a.score);
  
  // Weighted random selection from top 3
  const topMoves = scoredMoves.slice(0, Math.min(3, scoredMoves.length));
  const totalScore = topMoves.reduce((sum, m) => sum + m.score, 0);
  
  let random = Math.random() * totalScore;
  for (const { move, score } of topMoves) {
    random -= score;
    if (random <= 0) {
      return move;
    }
  }
  
  return topMoves[0]?.move || moves[0];
}

// Check if we're still in the opening phase (first ~15 moves)
export function isOpeningPhase(moveCount: number): boolean {
  return moveCount < 30; // 15 moves = 30 half-moves
}

// Clear the cache (useful for testing or memory management)
export function clearOpeningCache(): void {
  openingCache.clear();
}
