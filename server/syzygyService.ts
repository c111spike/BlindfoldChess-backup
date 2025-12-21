import { db } from "./db";
import { syzygyCache } from "@shared/schema";
import { eq } from "drizzle-orm";
import { createHash } from "crypto";

const LICHESS_TABLEBASE_API = "https://tablebase.lichess.ovh/standard";

export interface SyzygyMove {
  uci: string;
  san: string;
  wdl: number;
  dtz: number | null;
}

export interface SyzygyResult {
  fen: string;
  pieceCount: number;
  wdl: number;
  dtz: number | null;
  bestMoves: SyzygyMove[];
  isCheckmate: boolean;
  isStalemate: boolean;
  cached: boolean;
}

function countPieces(fen: string): number {
  const position = fen.split(" ")[0];
  let count = 0;
  for (const char of position) {
    if (/[pnbrqkPNBRQK]/.test(char)) {
      count++;
    }
  }
  return count;
}

function hashFen(fen: string): string {
  const normalizedFen = fen.split(" ").slice(0, 4).join(" ");
  return createHash("sha256").update(normalizedFen).digest("hex");
}

function wdlToDescription(wdl: number): string {
  switch (wdl) {
    case 2: return "Winning";
    case 1: return "Cursed win (50-move rule may apply)";
    case 0: return "Draw";
    case -1: return "Blessed loss (50-move rule may save)";
    case -2: return "Losing";
    default: return "Unknown";
  }
}

export const syzygyService = {
  async lookup(fen: string): Promise<SyzygyResult | null> {
    const pieceCount = countPieces(fen);
    
    if (pieceCount > 7) {
      return null;
    }

    const fenHash = hashFen(fen);

    try {
      const cached = await db
        .select()
        .from(syzygyCache)
        .where(eq(syzygyCache.fenHash, fenHash))
        .limit(1);

      if (cached.length > 0) {
        await db
          .update(syzygyCache)
          .set({
            hitCount: (cached[0].hitCount ?? 0) + 1,
            lastHitAt: new Date(),
          })
          .where(eq(syzygyCache.id, cached[0].id));

        return {
          fen: cached[0].fen,
          pieceCount: cached[0].pieceCount,
          wdl: cached[0].wdl,
          dtz: cached[0].dtz,
          bestMoves: (cached[0].bestMoves as SyzygyMove[]) || [],
          isCheckmate: cached[0].isCheckmate ?? false,
          isStalemate: cached[0].isStalemate ?? false,
          cached: true,
        };
      }
    } catch (error) {
      console.error("[Syzygy] Cache lookup error:", error);
    }

    try {
      const encodedFen = encodeURIComponent(fen);
      const response = await fetch(`${LICHESS_TABLEBASE_API}?fen=${encodedFen}`, {
        headers: {
          "Accept": "application/json",
          "User-Agent": "SimulChess/1.0 (chess training platform)",
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        console.error("[Syzygy] API error:", response.status, response.statusText);
        return null;
      }

      const data = await response.json();
      
      const isCheckmate = data.checkmate === true;
      const isStalemate = data.stalemate === true;
      
      let wdl = 0;
      if (isCheckmate) {
        wdl = -2;
      } else if (isStalemate) {
        wdl = 0;
      } else if (data.wdl !== undefined) {
        wdl = data.wdl;
      } else if (data.category) {
        switch (data.category) {
          case "win": wdl = 2; break;
          case "cursed-win": wdl = 1; break;
          case "draw": wdl = 0; break;
          case "blessed-loss": wdl = -1; break;
          case "loss": wdl = -2; break;
          case "maybe-win": wdl = 2; break;
          case "maybe-loss": wdl = -2; break;
        }
      }

      const bestMoves: SyzygyMove[] = [];
      if (data.moves && Array.isArray(data.moves)) {
        for (const move of data.moves.slice(0, 5)) {
          let moveWdl = 0;
          if (move.wdl !== undefined) {
            moveWdl = -move.wdl;
          } else if (move.category) {
            switch (move.category) {
              case "win": moveWdl = 2; break;
              case "cursed-win": moveWdl = 1; break;
              case "draw": moveWdl = 0; break;
              case "blessed-loss": moveWdl = -1; break;
              case "loss": moveWdl = -2; break;
            }
            moveWdl = -moveWdl;
          }

          bestMoves.push({
            uci: move.uci || "",
            san: move.san || "",
            wdl: moveWdl,
            dtz: move.dtz !== undefined ? -move.dtz : null,
          });
        }
      }

      const result: SyzygyResult = {
        fen,
        pieceCount,
        wdl,
        dtz: data.dtz !== undefined ? data.dtz : null,
        bestMoves,
        isCheckmate,
        isStalemate,
        cached: false,
      };

      try {
        await db.insert(syzygyCache).values({
          fenHash,
          fen,
          pieceCount,
          wdl,
          dtz: result.dtz,
          bestMoves: result.bestMoves,
          isCheckmate,
          isStalemate,
        }).onConflictDoNothing();
      } catch (cacheError) {
        console.error("[Syzygy] Cache insert error:", cacheError);
      }

      return result;
    } catch (error) {
      console.error("[Syzygy] API request error:", error);
      return null;
    }
  },

  isTablebasePosition(fen: string): boolean {
    return countPieces(fen) <= 7;
  },

  wdlToDescription,

  async getCacheStats(): Promise<{ total: number; hitRate: number }> {
    try {
      const stats = await db
        .select()
        .from(syzygyCache);
      
      const total = stats.length;
      const totalHits = stats.reduce((sum, entry) => sum + (entry.hitCount ?? 0), 0);
      const hitRate = total > 0 ? totalHits / total : 0;

      return { total, hitRate };
    } catch (error) {
      console.error("[Syzygy] Cache stats error:", error);
      return { total: 0, hitRate: 0 };
    }
  },
};
