import { Chess } from 'chess.js';

export type EndgameType = 'KQ_vs_K' | 'KR_vs_K';

export interface EndgameScenario {
  fen: string;
  type: EndgameType;
  description: string;
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['1', '2', '3', '4', '5', '6', '7', '8'];

function getRandomSquare(): string {
  return FILES[Math.floor(Math.random() * 8)] + RANKS[Math.floor(Math.random() * 8)];
}

function kingsAreTouching(wKing: string, bKing: string): boolean {
  const wFile = wKing.charCodeAt(0), wRank = parseInt(wKing[1]);
  const bFile = bKing.charCodeAt(0), bRank = parseInt(bKing[1]);
  return Math.abs(wFile - bFile) <= 1 && Math.abs(wRank - bRank) <= 1;
}

export function generateEndgame(type: EndgameType): EndgameScenario {
  const chess = new Chess();
  let valid = false;
  let attempts = 0;
  
  while (!valid && attempts < 100) {
    chess.clear();
    attempts++;
    
    const wKing = getRandomSquare();
    let bKing = getRandomSquare();
    while (wKing === bKing) bKing = getRandomSquare();
    
    if (kingsAreTouching(wKing, bKing)) continue;
    
    chess.put({ type: 'k', color: 'w' }, wKing as any);
    chess.put({ type: 'k', color: 'b' }, bKing as any);
    
    const occupied = [wKing, bKing];
    
    const placePiece = (pieceType: string) => {
      let sq = getRandomSquare();
      while (occupied.includes(sq)) sq = getRandomSquare();
      chess.put({ type: pieceType as any, color: 'w' }, sq as any);
      occupied.push(sq);
    };
    
    if (type === 'KQ_vs_K') {
      placePiece('q');
    } else if (type === 'KR_vs_K') {
      placePiece('r');
    }
    
    const fen = chess.fen();
    const validator = new Chess(fen);
    
    // Skip if checkmate, stalemate, draw, or if black is in check
    // (starting with check means the "best move" would be capturing the king)
    if (validator.isCheckmate() || validator.isStalemate() || validator.isDraw() || validator.inCheck()) {
      continue;
    }
    
    valid = true;
  }
  
  const descriptions: Record<EndgameType, string> = {
    'KQ_vs_K': 'King & Queen vs King',
    'KR_vs_K': 'King & Rook vs King'
  };

  return {
    fen: chess.fen(),
    type,
    description: descriptions[type]
  };
}

export function getEndgameTypes(): { value: EndgameType; label: string }[] {
  return [
    { value: 'KQ_vs_K', label: 'King & Queen vs King' },
    { value: 'KR_vs_K', label: 'King & Rook vs King' }
  ];
}
