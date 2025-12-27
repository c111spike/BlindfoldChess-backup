import { Chess } from "chess.js";
import { db } from "../server/db";
import { puzzles } from "../shared/schema";
import * as fs from "fs";
import * as readline from "readline";

const LICHESS_CSV_PATH = "/tmp/lichess_db_puzzle.csv";

type DifficultyKey = "patzer" | "beginner" | "intermediate" | "advanced" | "expert" | "master" | "grandmaster";

const DIFFICULTY_TIERS: Record<DifficultyKey, { min: number; max: number; count: number; target: number }> = {
  patzer: { min: 400, max: 700, count: 0, target: 100 },
  beginner: { min: 700, max: 1000, count: 0, target: 100 },
  intermediate: { min: 1000, max: 1400, count: 0, target: 100 },
  advanced: { min: 1400, max: 1800, count: 0, target: 100 },
  expert: { min: 1800, max: 2200, count: 0, target: 100 },
  master: { min: 2200, max: 2500, count: 0, target: 100 },
  grandmaster: { min: 2500, max: 4000, count: 0, target: 100 },
};

const LICHESS_THEME_TO_MOTIF: Record<string, string> = {
  fork: "fork",
  pin: "pin",
  skewer: "skewer",
  discoveredAttack: "discoveredAttack",
  discoveredCheck: "discoveredCheck",
  backRankMate: "backRankMate",
  smotheredMate: "smotheredMate",
  sacrifice: "sacrifice",
  hangingPiece: "hangingPiece",
  attraction: "attraction",
  deflection: "deflection",
  interference: "interference",
  clearance: "clearance",
  xRayAttack: "xRayAttack",
  doubleCheck: "doubleCheck",
  zugzwang: "zugzwang",
  quietMove: "quietMove",
  underPromotion: "underPromotion",
  promotion: "promotion",
  enPassant: "enPassant",
  castling: "castling",
  kingsideAttack: "kingsideAttack",
  queensideAttack: "queensideAttack",
};

const LICHESS_THEME_TO_PUZZLE_TYPE: Record<string, string> = {
  mateIn1: "mate_in_1",
  mateIn2: "mate_in_2",
  mateIn3: "mate_in_3",
  mateIn4: "mate_in_4_plus",
  mateIn5: "mate_in_4_plus",
  mate: "mate_in_4_plus",
  endgame: "endgame",
  opening: "opening_trap",
  crushing: "win_piece",
  advantage: "positional_advantage",
  defensiveMove: "defensive",
  sacrifice: "sacrifice",
};

function getDifficultyFromRating(rating: number): DifficultyKey | null {
  for (const [key, tier] of Object.entries(DIFFICULTY_TIERS)) {
    if (rating >= tier.min && rating < tier.max && tier.count < tier.target) {
      return key as DifficultyKey;
    }
  }
  return null;
}

function convertUCIToSAN(fen: string, uciMoves: string[]): { startingFen: string; solution: string[]; whoToMove: "white" | "black" } | null {
  try {
    const game = new Chess(fen);
    const processedMoves: string[] = [];

    const opponentMove = uciMoves[0];
    const opponentResult = game.move({
      from: opponentMove.substring(0, 2),
      to: opponentMove.substring(2, 4),
      promotion: opponentMove.length === 5 ? opponentMove[4] as "q" | "r" | "b" | "n" : undefined,
    });

    if (!opponentResult) {
      return null;
    }

    const startingFen = game.fen();
    const whoToMove = game.turn() === "w" ? "white" : "black";

    for (let i = 1; i < uciMoves.length; i++) {
      const m = uciMoves[i];
      const move = game.move({
        from: m.substring(0, 2),
        to: m.substring(2, 4),
        promotion: m.length === 5 ? m[4] as "q" | "r" | "b" | "n" : undefined,
      });
      if (!move) {
        return null;
      }
      processedMoves.push(move.san);
    }

    return { startingFen, solution: processedMoves, whoToMove };
  } catch (e) {
    return null;
  }
}

function mapThemesToMotifs(themes: string[]): string[] {
  const motifs: string[] = [];
  for (const theme of themes) {
    if (LICHESS_THEME_TO_MOTIF[theme]) {
      motifs.push(LICHESS_THEME_TO_MOTIF[theme]);
    }
  }
  return motifs;
}

function mapThemesToPuzzleType(themes: string[]): string | null {
  for (const theme of themes) {
    if (LICHESS_THEME_TO_PUZZLE_TYPE[theme]) {
      return LICHESS_THEME_TO_PUZZLE_TYPE[theme];
    }
  }
  return "other";
}

async function importPuzzles() {
  console.log("Starting Lichess puzzle import...");
  console.log("Reading from:", LICHESS_CSV_PATH);

  const fileStream = fs.createReadStream(LICHESS_CSV_PATH);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  let lineCount = 0;
  let importedCount = 0;
  let skippedCount = 0;
  let isHeader = true;
  const puzzlesToInsert: any[] = [];

  const allTiersFull = () => {
    return Object.values(DIFFICULTY_TIERS).every(tier => tier.count >= tier.target);
  };

  for await (const line of rl) {
    if (isHeader) {
      isHeader = false;
      continue;
    }

    if (allTiersFull()) {
      console.log("All tiers full, stopping...");
      break;
    }

    lineCount++;

    if (lineCount % 100000 === 0) {
      console.log(`Processed ${lineCount} lines...`);
      console.log("Current counts:", Object.fromEntries(
        Object.entries(DIFFICULTY_TIERS).map(([k, v]) => [k, v.count])
      ));
    }

    const parts = line.split(",");
    if (parts.length < 10) continue;

    const [puzzleId, fen, movesStr, ratingStr, , popularityStr, , themesStr, gameUrl] = parts;

    const rating = parseInt(ratingStr, 10);
    const popularity = parseInt(popularityStr, 10);

    if (popularity < 90) {
      skippedCount++;
      continue;
    }

    const difficulty = getDifficultyFromRating(rating);
    if (!difficulty) {
      continue;
    }

    const uciMoves = movesStr.split(" ");
    const themes = themesStr.split(" ").filter(t => t.trim());

    const result = convertUCIToSAN(fen, uciMoves);
    if (!result) {
      skippedCount++;
      continue;
    }

    const puzzleType = mapThemesToPuzzleType(themes);
    const tacticalMotifs = mapThemesToMotifs(themes);

    puzzlesToInsert.push({
      fen: result.startingFen,
      moves: result.solution,
      rating,
      themes,
      popularity,
      puzzleType,
      difficulty,
      solution: result.solution,
      hints: [],
      sourceType: "lichess",
      sourceName: puzzleId,
      youtubeVideoUrl: null,
      isAnonymous: false,
      whoToMove: result.whoToMove,
      upvotes: 0,
      downvotes: 0,
      reportCount: 0,
      isVerified: true,
      isFeatured: false,
      isFlagged: false,
      isRemoved: false,
      attemptCount: 0,
      solveCount: 0,
      tacticalMotifs,
    });

    DIFFICULTY_TIERS[difficulty].count++;
    importedCount++;
  }

  rl.close();

  console.log("\nFinal counts by difficulty:");
  for (const [key, tier] of Object.entries(DIFFICULTY_TIERS)) {
    console.log(`  ${key}: ${tier.count}`);
  }

  console.log(`\nTotal puzzles to insert: ${puzzlesToInsert.length}`);
  console.log(`Skipped (low popularity or invalid): ${skippedCount}`);

  if (puzzlesToInsert.length > 0) {
    console.log("\nInserting puzzles into database...");
    
    const batchSize = 50;
    for (let i = 0; i < puzzlesToInsert.length; i += batchSize) {
      const batch = puzzlesToInsert.slice(i, i + batchSize);
      await db.insert(puzzles).values(batch);
      console.log(`Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(puzzlesToInsert.length / batchSize)}`);
    }

    console.log("\nImport complete!");
  }
}

importPuzzles().catch(console.error);
