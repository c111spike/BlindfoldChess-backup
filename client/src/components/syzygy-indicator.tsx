import { useState, useEffect } from "react";
import { useSyzygy, SyzygyResult, countPieces } from "@/hooks/useSyzygy";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Database, ChevronDown, ChevronUp } from "lucide-react";

interface SyzygyIndicatorProps {
  fen: string;
  compact?: boolean;
}

export function SyzygyIndicator({ fen, compact = false }: SyzygyIndicatorProps) {
  const { lookup, isTablebasePosition, wdlToColor, loading } = useSyzygy();
  const [result, setResult] = useState<SyzygyResult | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [lookupAttempted, setLookupAttempted] = useState(false);

  const isInTablebase = isTablebasePosition(fen);
  const pieceCount = countPieces(fen);

  useEffect(() => {
    if (isInTablebase && !lookupAttempted) {
      setLookupAttempted(true);
      lookup(fen).then(setResult);
    } else if (!isInTablebase) {
      setResult(null);
      setLookupAttempted(false);
    }
  }, [fen, isInTablebase, lookup, lookupAttempted]);

  useEffect(() => {
    setLookupAttempted(false);
  }, [fen]);

  if (!isInTablebase) {
    return null;
  }

  if (loading && !result) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="syzygy-loading">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Checking tablebase...</span>
      </div>
    );
  }

  if (!result) {
    return (
      <Badge variant="outline" className="text-xs gap-1" data-testid="syzygy-badge-pending">
        <Database className="w-3 h-3" />
        {pieceCount} pieces
      </Badge>
    );
  }

  if (compact) {
    return (
      <Badge 
        variant="outline" 
        className={`text-xs gap-1 ${wdlToColor(result.wdl)}`}
        data-testid="syzygy-badge-compact"
      >
        <Database className="w-3 h-3" />
        {result.wdlDescription}
        {result.dtz !== null && ` (DTZ: ${Math.abs(result.dtz)})`}
      </Badge>
    );
  }

  return (
    <Card className="bg-muted/50" data-testid="syzygy-indicator">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">Tablebase</span>
            <Badge variant="outline" className="text-xs">
              {pieceCount} pieces
            </Badge>
            {result.cached && (
              <Badge variant="secondary" className="text-xs">
                Cached
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="h-6 w-6 p-0"
            data-testid="button-syzygy-expand"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>

        <div className="flex items-center gap-4">
          <div>
            <span className="text-sm text-muted-foreground">Result: </span>
            <span className={`font-semibold ${wdlToColor(result.wdl)}`}>
              {result.wdlDescription}
            </span>
          </div>
          {result.dtz !== null && (
            <div>
              <span className="text-sm text-muted-foreground">DTZ: </span>
              <span className="font-mono">{Math.abs(result.dtz)}</span>
            </div>
          )}
        </div>

        {expanded && result.bestMoves.length > 0 && (
          <div className="pt-2 border-t border-border">
            <div className="text-xs text-muted-foreground mb-1">Best moves:</div>
            <div className="flex flex-wrap gap-2">
              {result.bestMoves.slice(0, 5).map((move, i) => (
                <Badge
                  key={i}
                  variant="outline"
                  className={`font-mono text-xs ${wdlToColor(move.wdl)}`}
                  data-testid={`syzygy-move-${i}`}
                >
                  {move.san}
                  {move.dtz !== null && ` (${Math.abs(move.dtz)})`}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {result.isCheckmate && (
          <Badge variant="destructive" className="text-xs">Checkmate</Badge>
        )}
        {result.isStalemate && (
          <Badge variant="secondary" className="text-xs">Stalemate</Badge>
        )}
      </CardContent>
    </Card>
  );
}

export function SyzygyBadge({ fen }: { fen: string }) {
  const { isTablebasePosition, wdlToColor, lookup } = useSyzygy();
  const [result, setResult] = useState<SyzygyResult | null>(null);

  const isInTablebase = isTablebasePosition(fen);

  useEffect(() => {
    if (isInTablebase) {
      lookup(fen).then(setResult);
    } else {
      setResult(null);
    }
  }, [fen, isInTablebase, lookup]);

  if (!isInTablebase || !result) {
    return null;
  }

  return (
    <Badge 
      variant="outline" 
      className={`text-xs gap-1 ${wdlToColor(result.wdl)}`}
      data-testid="syzygy-badge"
    >
      <Database className="w-3 h-3" />
      TB: {result.wdlDescription}
    </Badge>
  );
}
