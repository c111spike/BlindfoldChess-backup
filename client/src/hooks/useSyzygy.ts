import { useState, useCallback } from "react";
import { apiRequest } from "@/lib/queryClient";

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
  isTablebasePosition: boolean;
  wdlDescription: string;
}

export function useSyzygy() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SyzygyResult | null>(null);

  const lookup = useCallback(async (fen: string): Promise<SyzygyResult | null> => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await apiRequest("POST", "/api/syzygy/lookup", { fen });
      const data = await response.json();
      
      if (!response.ok) {
        if (response.status === 404) {
          setResult(null);
          return null;
        }
        throw new Error(data.message || "Failed to lookup tablebase");
      }
      
      setResult(data);
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const isTablebasePosition = useCallback((fen: string): boolean => {
    const position = fen.split(" ")[0];
    let count = 0;
    for (const char of position) {
      if (/[pnbrqkPNBRQK]/.test(char)) {
        count++;
      }
    }
    return count <= 7;
  }, []);

  const wdlToDescription = useCallback((wdl: number): string => {
    switch (wdl) {
      case 2: return "Winning";
      case 1: return "Cursed win";
      case 0: return "Draw";
      case -1: return "Blessed loss";
      case -2: return "Losing";
      default: return "Unknown";
    }
  }, []);

  const wdlToColor = useCallback((wdl: number): string => {
    switch (wdl) {
      case 2: return "text-green-500";
      case 1: return "text-green-400";
      case 0: return "text-gray-500";
      case -1: return "text-red-400";
      case -2: return "text-red-500";
      default: return "text-gray-400";
    }
  }, []);

  return {
    lookup,
    isTablebasePosition,
    wdlToDescription,
    wdlToColor,
    loading,
    error,
    result,
  };
}

export function countPieces(fen: string): number {
  const position = fen.split(" ")[0];
  let count = 0;
  for (const char of position) {
    if (/[pnbrqkPNBRQK]/.test(char)) {
      count++;
    }
  }
  return count;
}
