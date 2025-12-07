import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { User, Skull } from "lucide-react";
import chessFactsData from "@/data/chess-facts.json";

interface ChessFact {
  type: string;
  text: string;
  year: number;
  name: string;
  source: string;
}

type ChessFactsData = Record<string, ChessFact[]>;

const data = chessFactsData as ChessFactsData;

function getDateKey(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${month}-${day}`;
}

function getFormattedDate(): string {
  const now = new Date();
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${months[now.getMonth()]} ${now.getDate()}`;
}

function getStorageKey(dateKey: string): string {
  return `chess_facts_seen_${dateKey}_${new Date().getFullYear()}`;
}

function getSeenIndices(dateKey: string): number[] {
  try {
    const stored = localStorage.getItem(getStorageKey(dateKey));
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
  }
  return [];
}

function saveSeenIndex(dateKey: string, index: number): void {
  try {
    const seen = getSeenIndices(dateKey);
    if (!seen.includes(index)) {
      seen.push(index);
      localStorage.setItem(getStorageKey(dateKey), JSON.stringify(seen));
    }
  } catch {
  }
}

function clearSeenIndices(dateKey: string): void {
  try {
    localStorage.removeItem(getStorageKey(dateKey));
  } catch {
  }
}

function getIconForType(type: string) {
  switch (type) {
    case "birthday":
      return <User className="h-4 w-4 text-blue-500 flex-shrink-0" />;
    case "death":
      return <Skull className="h-4 w-4 text-muted-foreground flex-shrink-0" />;
    default:
      return <User className="h-4 w-4 text-primary flex-shrink-0" />;
  }
}

export function ThisDayInChessHistory() {
  const dateKey = getDateKey();
  const formattedDate = getFormattedDate();
  
  const factsForToday = useMemo(() => {
    return data[dateKey] || [];
  }, [dateKey]);
  
  const [currentFact, setCurrentFact] = useState<ChessFact | null>(null);
  const [initialized, setInitialized] = useState(false);
  
  useEffect(() => {
    if (factsForToday.length === 0) {
      setCurrentFact(null);
      setInitialized(true);
      return;
    }
    
    let seenIndices = getSeenIndices(dateKey);
    
    if (seenIndices.length >= factsForToday.length) {
      clearSeenIndices(dateKey);
      seenIndices = [];
    }
    
    const unseenIndices = factsForToday
      .map((_, idx) => idx)
      .filter(idx => !seenIndices.includes(idx));
    
    const randomIndex = unseenIndices[Math.floor(Math.random() * unseenIndices.length)];
    
    saveSeenIndex(dateKey, randomIndex);
    setCurrentFact(factsForToday[randomIndex]);
    setInitialized(true);
  }, [dateKey, factsForToday]);
  
  if (!initialized) {
    return null;
  }
  
  if (!currentFact) {
    return null;
  }
  
  return (
    <Card className="border-primary/20 bg-primary/5" data-testid="card-chess-history">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5">
            {getIconForType(currentFact.type)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-primary mb-1" data-testid="text-history-date">
              {formattedDate} in Chess History
            </p>
            <p className="text-sm text-foreground leading-relaxed" data-testid="text-history-fact">
              {currentFact.text}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
