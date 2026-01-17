export const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
export const RANKS = ['1', '2', '3', '4', '5', '6', '7', '8'];

export function squareToIndex(square: string): number {
  const file = square.charCodeAt(0) - 'a'.charCodeAt(0);
  const rank = parseInt(square[1]) - 1;
  return rank * 8 + file;
}

export function indexToSquare(index: number): string {
  const file = FILES[index % 8];
  const rank = RANKS[Math.floor(index / 8)];
  return `${file}${rank}`;
}

const KNIGHT_OFFSETS = [
  [-2, -1], [-2, 1], [-1, -2], [-1, 2],
  [1, -2], [1, 2], [2, -1], [2, 1]
];

export function findKnightPath(start: string, end: string): string[] | null {
  const startIdx = squareToIndex(start);
  const endIdx = squareToIndex(end);
  
  const queue: { index: number; path: number[] }[] = [{ index: startIdx, path: [startIdx] }];
  const visited = new Set<number>([startIdx]);

  while (queue.length > 0) {
    const { index, path } = queue.shift()!;
    if (index === endIdx) return path.map(indexToSquare);

    const r = Math.floor(index / 8);
    const c = index % 8;

    for (const [dr, dc] of KNIGHT_OFFSETS) {
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
        const nextIdx = nr * 8 + nc;
        if (!visited.has(nextIdx)) {
          visited.add(nextIdx);
          queue.push({ index: nextIdx, path: [...path, nextIdx] });
        }
      }
    }
  }
  return null;
}

export function generateKnightChallenge(minMoves: number = 3, maxMoves: number = 4): { start: string; end: string; minPath: string[] } {
  let start = '';
  let end = '';
  let path: string[] | null = null;

  while (!path || path.length - 1 < minMoves || path.length - 1 > maxMoves) {
    const startIdx = Math.floor(Math.random() * 64);
    const endIdx = Math.floor(Math.random() * 64);
    start = indexToSquare(startIdx);
    end = indexToSquare(endIdx);
    if (start === end) continue;
    path = findKnightPath(start, end);
  }

  return { start, end, minPath: path };
}

export function isLegalKnightMove(from: string, to: string): boolean {
  if (!from || !to) return false;
  const fromIdx = squareToIndex(from);
  const toIdx = squareToIndex(to);
  
  const r1 = Math.floor(fromIdx / 8), c1 = fromIdx % 8;
  const r2 = Math.floor(toIdx / 8), c2 = toIdx % 8;
  
  const dr = Math.abs(r1 - r2);
  const dc = Math.abs(c1 - c2);
  
  return (dr === 2 && dc === 1) || (dr === 1 && dc === 2);
}

export function getAllKnightMoves(from: string): string[] {
  const fromIdx = squareToIndex(from);
  const r = Math.floor(fromIdx / 8);
  const c = fromIdx % 8;
  const moves: string[] = [];

  for (const [dr, dc] of KNIGHT_OFFSETS) {
    const nr = r + dr, nc = c + dc;
    if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
      moves.push(indexToSquare(nr * 8 + nc));
    }
  }
  return moves;
}
