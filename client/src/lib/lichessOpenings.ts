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
        // Favor fianchetto setups and Italian-style openings where bishops thrive
        // Fianchetto pawn moves: g3, b3, g6, b6 (with optional check/mate suffix)
        const isFianchettoPawn = /^[gb][36][+#]?$/.test(m.san);
        // Fianchetto bishop moves: Bg2, Bb2, Bg7, Bb7 (handles B1xg2+, Bxg2, etc.)
        // Pattern: B + 0-2 disambiguation chars + optional x + g/b + 2/7 + optional check
        const isFianchettoBishop = /^B[a-h1-8]{0,2}x?[gb][27][+#]?$/.test(m.san);
        // Active bishop development to specific strong squares (not retreats like Be2, Bd1)
        // Strong squares: c4, b5, c5, b4, f4, g5, a3, h4 (attacking/central diagonals)
        const activeBishopSquares = ['c4', 'b5', 'c5', 'b4', 'f4', 'g5', 'a3', 'h4', 'a6', 'h3', 'f5', 'c3', 'f6', 'c6'];
        const destinationSquare = m.san.match(/([a-h][1-8])[+#]?$/)?.[1];
        const isActiveBishopMove = m.san.startsWith('B') && destinationSquare && activeBishopSquares.includes(destinationSquare);
        const isBishopFriendly = isFianchettoPawn || isFianchettoBishop || isActiveBishopMove;
        
        if (isBishopFriendly) {
          score += 40; // Strong bonus for bishop-friendly moves
        }
        // Favor main lines (bishops do well in open positions from popular openings)
        score += Math.log(m.totalGames + 1) * 12;
        // Slight preference for lines with fewer draws (bishops like dynamic play)
        score += (1 - m.drawRate) * 15;
        break;
        
      case 'knight_lover':
        // Favor closed/semi-closed positions where knights outperform bishops
        // Knight moves: N + 0-2 disambiguation chars + optional x + destination + optional check
        // Matches: Nc3, Nf3, Nbd2, Nxe4, Nc3+, N1xe5, Nbdxe5, etc.
        const isKnightMove = /^N[a-h1-8]{0,2}x?[a-h][1-8][+#]?$/.test(m.san);
        // Penalize fianchetto (bishop-favoring) openings
        const isFianchettoPawnMove = /^[gb][36][+#]?$/.test(m.san);
        // Fianchetto bishop: B + 0-2 disambiguation + optional x + g/b + 2/7 + optional check
        const isFianchettoBishopMove = /^B[a-h1-8]{0,2}x?[gb][27][+#]?$/.test(m.san);
        const isFianchettoMove = isFianchettoPawnMove || isFianchettoBishopMove;
        // Prefer pawn moves that create closed positions: d3, e3, d6, e6 (French/Philidor style)
        const isClosedPawnMove = /^[de][36][+#]?$/.test(m.san);
        // c4/c5 can lead to closed games too
        const isSemiClosedPawn = /^c[45][+#]?$/.test(m.san);
        
        if (isKnightMove) {
          score += 25; // Bonus for developing knights
        }
        if (isClosedPawnMove) {
          score += 30; // Strong bonus for closed pawn structures
        }
        if (isSemiClosedPawn) {
          score += 15; // Moderate bonus for semi-closed options
        }
        if (isFianchettoMove) {
          score -= 20; // Penalize bishop-favoring fianchetto
        }
        // Prefer slightly less popular lines (knights thrive in complex positions)
        score += Math.log(m.totalGames + 1) * 6;
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
