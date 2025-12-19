import { useState, useCallback } from 'react';
import { analyzeGameClientSide, type GameAnalysisResult, type MoveAnalysisResult } from '@/lib/gameAnalysis';

interface UseClientAnalysisReturn {
  analyzing: boolean;
  progress: number;
  totalMoves: number;
  result: GameAnalysisResult | null;
  error: string | null;
  startAnalysis: (moves: string[]) => Promise<void>;
  reset: () => void;
}

export function useClientAnalysis(): UseClientAnalysisReturn {
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [totalMoves, setTotalMoves] = useState(0);
  const [result, setResult] = useState<GameAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startAnalysis = useCallback(async (moves: string[]) => {
    setAnalyzing(true);
    setProgress(0);
    setTotalMoves(moves.length);
    setResult(null);
    setError(null);

    try {
      const analysisResult = await analyzeGameClientSide(moves, (current, total) => {
        setProgress(current);
        setTotalMoves(total);
      });

      setResult(analysisResult);
    } catch (err) {
      console.error('[ClientAnalysis] Analysis failed:', err);
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  }, []);

  const reset = useCallback(() => {
    setAnalyzing(false);
    setProgress(0);
    setTotalMoves(0);
    setResult(null);
    setError(null);
  }, []);

  return {
    analyzing,
    progress,
    totalMoves,
    result,
    error,
    startAnalysis,
    reset,
  };
}

export type { GameAnalysisResult, MoveAnalysisResult };
