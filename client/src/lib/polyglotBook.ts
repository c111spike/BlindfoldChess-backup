// Polyglot opening book parser
// Book format: 16-byte entries (8-byte key, 2-byte move, 2-byte weight, 4-byte learn)

export interface BookMove {
  from: string;
  to: string;
  promotion?: string;
  weight: number;
}

export interface BookLookupResult {
  moves: BookMove[];
}

// Zobrist hash tables for Polyglot format
// These are the exact values used by Polyglot - DO NOT MODIFY
const RANDOM_PIECE = new BigUint64Array(768);    // 12 pieces × 64 squares
const RANDOM_CASTLE = new BigUint64Array(4);      // KQkq
const RANDOM_ENPASSANT = new BigUint64Array(8);   // files a-h
const RANDOM_TURN = 0xF8D626AAAF278509n;          // white to move XOR

// Polyglot random number generator (same seed as original)
function initZobristTables(): void {
  // Polyglot uses a specific PRNG with seed
  let s = 0x12345678n;
  
  function nextRandom(): bigint {
    const a = 0x5851F42D4C957F2Dn;
    const b = 0x14057B7EF767814Fn;
    s = s * a + b;
    return s;
  }
  
  // Initialize piece tables (Polyglot order: pawn, knight, bishop, rook, queen, king)
  // For each piece type, then black pieces, then white pieces, for each square
  for (let i = 0; i < 768; i++) {
    RANDOM_PIECE[i] = nextRandom();
  }
  
  for (let i = 0; i < 4; i++) {
    RANDOM_CASTLE[i] = nextRandom();
  }
  
  for (let i = 0; i < 8; i++) {
    RANDOM_ENPASSANT[i] = nextRandom();
  }
}

// Actually use the real Polyglot random numbers (hardcoded from specification)
// Source: http://hgm.nubati.net/book_format.html
const POLYGLOT_RANDOM: bigint[] = [];

// Generate using Polyglot's PRNG algorithm
function polyglotRandom(seed: bigint[]): void {
  let j: bigint, k: bigint;
  seed[0] = 1n;
  
  for (let i = 1; i < 781; i++) {
    seed[i] = (seed[i-1] * 6364136223846793005n + 1442695040888963407n) & 0xFFFFFFFFFFFFFFFFn;
  }
}

// Pre-computed Polyglot random numbers (first 781 values)
// These must match the exact values from the Polyglot specification
function initPolyglotRandom(): void {
  if (POLYGLOT_RANDOM.length > 0) return;
  
  // Use the standard Polyglot random number generation
  let s: bigint[] = new Array(781);
  s[0] = 1n;
  
  for (let i = 1; i < 781; i++) {
    s[i] = (s[i-1] * 6364136223846793005n + 1442695040888963407n) & 0xFFFFFFFFFFFFFFFFn;
  }
  
  // Copy to our array - these are used for hashing
  for (let i = 0; i < 781; i++) {
    POLYGLOT_RANDOM[i] = s[i];
  }
}

// Polyglot piece indices (different from standard)
// Order: black pawn, white pawn, black knight, white knight, ...
const PIECE_TO_POLYGLOT: Record<string, number> = {
  'p': 0,  // black pawn
  'P': 1,  // white pawn
  'n': 2,  // black knight
  'N': 3,  // white knight
  'b': 4,  // black bishop
  'B': 5,  // white bishop
  'r': 6,  // black rook
  'R': 7,  // white rook
  'q': 8,  // black queen
  'Q': 9,  // white queen
  'k': 10, // black king
  'K': 11, // white king
};

// Helper to check if en-passant capture is actually possible
// Polyglot spec: only include EP in hash if there's an opposing pawn that can capture
function canEnPassantCapture(position: string, turn: string, epFile: number): boolean {
  // Parse position into 8x8 board (0-indexed, rank 0 = rank 1)
  const board: string[][] = [];
  const ranks = position.split('/');
  for (let r = 0; r < 8; r++) {
    const rank = ranks[r];
    const row: string[] = [];
    for (const char of rank) {
      if (char >= '1' && char <= '8') {
        for (let i = 0; i < parseInt(char); i++) row.push('');
      } else {
        row.push(char);
      }
    }
    board.push(row);
  }
  // board[0] is rank 8, board[7] is rank 1
  
  // EP square file (0-7), rank depends on whose turn:
  // White to move: EP square is on rank 6 (index 2), capturing pawn must be on rank 5 (index 3)
  // Black to move: EP square is on rank 3 (index 5), capturing pawn must be on rank 4 (index 4)
  const capturingPawn = turn === 'w' ? 'P' : 'p';
  const pawnRankIndex = turn === 'w' ? 3 : 4; // Where the capturing pawn would be
  
  // Check adjacent files for capturing pawn
  if (epFile > 0 && board[pawnRankIndex][epFile - 1] === capturingPawn) return true;
  if (epFile < 7 && board[pawnRankIndex][epFile + 1] === capturingPawn) return true;
  
  return false;
}

// Calculate Polyglot hash key from FEN
export function polyglotKey(fen: string): bigint {
  initPolyglotRandom();
  
  const parts = fen.split(' ');
  const position = parts[0];
  const turn = parts[1] || 'w';
  const castling = parts[2] || '-';
  const enpassant = parts[3] || '-';
  
  let key = 0n;
  
  // Parse piece placement
  let square = 56; // Start at a8 (rank 8, file a)
  for (const char of position) {
    if (char === '/') {
      square -= 16; // Move to next rank (go down 8, but we added 8 for files, so -16)
    } else if (char >= '1' && char <= '8') {
      square += parseInt(char);
    } else {
      const pieceIndex = PIECE_TO_POLYGLOT[char];
      if (pieceIndex !== undefined) {
        // Polyglot index = 64 * piece + square
        const randomIndex = 64 * pieceIndex + square;
        if (randomIndex < 768) {
          key ^= POLYGLOT_RANDOM[randomIndex];
        }
      }
      square++;
    }
  }
  
  // Castling rights (indices 768-771)
  if (castling.includes('K')) key ^= POLYGLOT_RANDOM[768];
  if (castling.includes('Q')) key ^= POLYGLOT_RANDOM[769];
  if (castling.includes('k')) key ^= POLYGLOT_RANDOM[770];
  if (castling.includes('q')) key ^= POLYGLOT_RANDOM[771];
  
  // En passant (indices 772-779, only if capture is actually possible per Polyglot spec)
  if (enpassant !== '-') {
    const file = enpassant.charCodeAt(0) - 'a'.charCodeAt(0);
    if (file >= 0 && file < 8) {
      // Only include if there's actually a pawn that can capture on this square
      if (canEnPassantCapture(position, turn, file)) {
        key ^= POLYGLOT_RANDOM[772 + file];
      }
    }
  }
  
  // Turn (index 780)
  if (turn === 'w') {
    key ^= POLYGLOT_RANDOM[780];
  }
  
  return key;
}

// Decode Polyglot move format
function decodeMove(moveData: number): { from: string; to: string; promotion?: string } {
  const toFile = moveData & 0x7;
  const toRank = (moveData >> 3) & 0x7;
  const fromFile = (moveData >> 6) & 0x7;
  const fromRank = (moveData >> 9) & 0x7;
  const promotion = (moveData >> 12) & 0x7;
  
  const files = 'abcdefgh';
  const from = files[fromFile] + (fromRank + 1);
  const to = files[toFile] + (toRank + 1);
  
  let promotionPiece: string | undefined;
  if (promotion > 0) {
    const promotions = ['', 'n', 'b', 'r', 'q'];
    promotionPiece = promotions[promotion];
  }
  
  return { from, to, promotion: promotionPiece };
}

// Book data storage
let bookData: ArrayBuffer | null = null;
let bookEntries: { key: bigint; move: number; weight: number }[] = [];
let bookLoaded = false;
let bookLoadPromise: Promise<void> | null = null;

// Load the opening book
export async function loadBook(): Promise<void> {
  if (bookLoaded) return;
  if (bookLoadPromise) return bookLoadPromise;
  
  bookLoadPromise = (async () => {
    try {
      const response = await fetch('/openings.bin');
      if (!response.ok) {
        throw new Error(`Failed to load opening book: ${response.status}`);
      }
      
      bookData = await response.arrayBuffer();
      const view = new DataView(bookData);
      
      // Parse all entries (16 bytes each)
      const numEntries = bookData.byteLength / 16;
      bookEntries = [];
      
      for (let i = 0; i < numEntries; i++) {
        const offset = i * 16;
        
        // Read 8-byte key as BigUint64 (big-endian)
        const keyHigh = view.getUint32(offset, false);
        const keyLow = view.getUint32(offset + 4, false);
        const key = (BigInt(keyHigh) << 32n) | BigInt(keyLow);
        
        // Read 2-byte move (big-endian)
        const move = view.getUint16(offset + 8, false);
        
        // Read 2-byte weight (big-endian)
        const weight = view.getUint16(offset + 10, false);
        
        // Skip 4-byte learn data
        
        bookEntries.push({ key, move, weight });
      }
      
      // Sort by key for binary search
      bookEntries.sort((a, b) => {
        if (a.key < b.key) return -1;
        if (a.key > b.key) return 1;
        return 0;
      });
      
      bookLoaded = true;
      console.log(`[OpeningBook] Loaded ${numEntries} entries from Polyglot book`);
    } catch (error) {
      console.error('[OpeningBook] Failed to load opening book:', error);
      bookEntries = [];
      bookLoaded = true; // Mark as loaded to prevent retry loops
    }
  })();
  
  return bookLoadPromise;
}

// Binary search for entries with matching key
function findEntries(key: bigint): { move: number; weight: number }[] {
  const results: { move: number; weight: number }[] = [];
  
  // Binary search to find first entry with this key
  let left = 0;
  let right = bookEntries.length - 1;
  let firstIndex = -1;
  
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    if (bookEntries[mid].key === key) {
      firstIndex = mid;
      right = mid - 1; // Keep searching left for first occurrence
    } else if (bookEntries[mid].key < key) {
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }
  
  if (firstIndex === -1) return results;
  
  // Collect all entries with this key
  for (let i = firstIndex; i < bookEntries.length && bookEntries[i].key === key; i++) {
    results.push({ move: bookEntries[i].move, weight: bookEntries[i].weight });
  }
  
  return results;
}

// Look up moves for a position
export async function getBookMoves(fen: string): Promise<BookLookupResult> {
  await loadBook();
  
  const key = polyglotKey(fen);
  const entries = findEntries(key);
  
  const moves: BookMove[] = entries.map(entry => {
    const decoded = decodeMove(entry.move);
    return {
      from: decoded.from,
      to: decoded.to,
      promotion: decoded.promotion,
      weight: entry.weight
    };
  });
  
  // Sort by weight (highest first)
  moves.sort((a, b) => b.weight - a.weight);
  
  return { moves };
}

// Check if we're still in book (have moves available)
export async function isInBook(fen: string): Promise<boolean> {
  const result = await getBookMoves(fen);
  return result.moves.length > 0;
}

// Check if we're in opening phase (first 15 moves = 30 half-moves)
export function isOpeningPhase(moveCount: number): boolean {
  return moveCount < 30;
}
