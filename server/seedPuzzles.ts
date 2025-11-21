import { db } from "./db";
import { puzzles } from "@shared/schema";

const samplePuzzles = [
  {
    fen: "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4",
    moves: ["Qxf7+"],
    rating: 1200,
    themes: ["checkmate", "sacrifice", "short"],
    popularity: 95,
  },
  {
    fen: "r1bqk2r/ppp2ppp/2np1n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 0 6",
    moves: ["Bxf7+", "Kxf7", "Ng5+"],
    rating: 1400,
    themes: ["fork", "knight", "opening"],
    popularity: 88,
  },
  {
    fen: "r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3",
    moves: ["Qa5+", "Nc3", "Qxb5"],
    rating: 1100,
    themes: ["pin", "opening", "advantage"],
    popularity: 92,
  },
  {
    fen: "rnbqk2r/pppp1ppp/5n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4",
    moves: ["Ng5", "d5", "exd5", "Nxd5", "Nxf7"],
    rating: 1600,
    themes: ["fork", "sacrifice", "advantage"],
    popularity: 85,
  },
  {
    fen: "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4",
    moves: ["Ng5", "d5", "exd5", "Nxd5", "Qf3"],
    rating: 1500,
    themes: ["discovered-attack", "advantage"],
    popularity: 80,
  },
  {
    fen: "r2qkb1r/ppp2ppp/2n2n2/3pp1B1/1b1PP3/2N2N2/PPP2PPP/R2QKB1R w KQkq - 0 6",
    moves: ["Bxf6", "gxf6", "Nxe5"],
    rating: 1300,
    themes: ["pin", "removal-of-defender"],
    popularity: 90,
  },
  {
    fen: "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 0 5",
    moves: ["Bxf7+", "Kxf7", "Ng5+", "Kg8", "Qb3+"],
    rating: 1700,
    themes: ["checkmate", "sacrifice", "long"],
    popularity: 78,
  },
  {
    fen: "rnbqkb1r/pppp1ppp/5n2/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3",
    moves: ["Nxe5", "Nxe5", "d4"],
    rating: 1000,
    themes: ["opening", "center"],
    popularity: 95,
  },
  {
    fen: "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQK2R b KQkq - 0 5",
    moves: ["Nxe4", "Nxe4", "d5"],
    rating: 1450,
    themes: ["fork", "center"],
    popularity: 82,
  },
  {
    fen: "rnbqkb1r/ppp2ppp/3p1n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 4",
    moves: ["Ng5", "d5", "exd5", "Nxd5", "Nxf7", "Kxf7", "Qf3+"],
    rating: 1800,
    themes: ["checkmate", "sacrifice", "long"],
    popularity: 75,
  },
];

export async function seedPuzzles() {
  try {
    console.log("Seeding puzzles...");
    
    for (const puzzle of samplePuzzles) {
      await db.insert(puzzles).values(puzzle);
    }
    
    console.log(`Successfully seeded ${samplePuzzles.length} puzzles!`);
  } catch (error) {
    console.error("Error seeding puzzles:", error);
    throw error;
  }
}

seedPuzzles()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
