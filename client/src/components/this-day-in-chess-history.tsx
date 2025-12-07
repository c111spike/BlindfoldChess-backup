import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, Trophy, User, Flag, Lightbulb } from "lucide-react";
import chessFactsData from "@/data/chess-facts.json";

interface ChessFact {
  type: string;
  description: string;
}

interface ChessFactsData {
  dateEvents: Record<string, ChessFact[]>;
  funFacts: ChessFact[];
}

const data = chessFactsData as ChessFactsData;

const FACTS_PER_DAY = 5;

function getDateKey(): string {
  const now = new Date();
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[now.getMonth()]} ${now.getDate()}`;
}

function getDayOfYear(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const diff = now.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor(diff / oneDay);
}

function seededRandom(seed: number): () => number {
  return function() {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}

function shuffleArray<T>(array: T[], random: () => number): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function getYearlyFunFactOrder(): number[] {
  const year = new Date().getFullYear();
  const random = seededRandom(year);
  const indices = Array.from({ length: data.funFacts.length }, (_, i) => i);
  return shuffleArray(indices, random);
}

let cachedFunFactOrder: number[] | null = null;
let cachedYear: number | null = null;

function getFunFactOrder(): number[] {
  const year = new Date().getFullYear();
  if (cachedYear !== year || !cachedFunFactOrder) {
    cachedFunFactOrder = getYearlyFunFactOrder();
    cachedYear = year;
  }
  return cachedFunFactOrder;
}

function getFactsForDay(dateKey: string, dayOfYear: number): ChessFact[] {
  const dateSpecificFacts = data.dateEvents[dateKey] || [];
  const funFacts = data.funFacts;
  const neededFunFacts = Math.max(0, FACTS_PER_DAY - dateSpecificFacts.length);
  
  if (neededFunFacts === 0) {
    return dateSpecificFacts.slice(0, FACTS_PER_DAY);
  }
  
  const funFactOrder = getFunFactOrder();
  const startOffset = (dayOfYear * FACTS_PER_DAY) % funFactOrder.length;
  
  const selectedFunFacts: ChessFact[] = [];
  for (let i = 0; i < neededFunFacts; i++) {
    const shuffledIdx = (startOffset + i) % funFactOrder.length;
    const originalIdx = funFactOrder[shuffledIdx];
    selectedFunFacts.push(funFacts[originalIdx]);
  }
  
  const allFacts = [...dateSpecificFacts, ...selectedFunFacts];
  return allFacts.slice(0, FACTS_PER_DAY);
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
    case "birth":
      return <User className="h-4 w-4 text-blue-500 flex-shrink-0" />;
    case "death":
      return <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />;
    case "tournament_start":
    case "tournament_end":
      return <Trophy className="h-4 w-4 text-yellow-500 flex-shrink-0" />;
    case "match_start":
    case "match_end":
      return <Flag className="h-4 w-4 text-green-500 flex-shrink-0" />;
    case "fun_fact":
      return <Lightbulb className="h-4 w-4 text-orange-500 flex-shrink-0" />;
    default:
      return <Calendar className="h-4 w-4 text-primary flex-shrink-0" />;
  }
}

export function ThisDayInChessHistory() {
  const dateKey = getDateKey();
  const dayOfYear = getDayOfYear();
  
  const factsForToday = useMemo(() => {
    return getFactsForDay(dateKey, dayOfYear);
  }, [dateKey, dayOfYear]);
  
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
              This Day in Chess History
            </p>
            <p className="text-sm text-foreground leading-relaxed" data-testid="text-history-fact">
              {currentFact.description}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
