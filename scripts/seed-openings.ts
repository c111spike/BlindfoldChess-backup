import { readFileSync } from 'fs';
import { join } from 'path';
import { db } from '../server/db';
import { openings } from '../shared/schema';
import { Chess } from 'chess.js';

async function seedOpenings() {
  console.log('Seeding openings database...');
  
  const existingCount = await db.select().from(openings).limit(1);
  if (existingCount.length > 0) {
    console.log('Openings already seeded, skipping...');
    return;
  }

  const files = ['a.tsv', 'b.tsv', 'c.tsv', 'd.tsv', 'e.tsv'];
  const allOpenings: { eco: string; name: string; pgn: string; moves: string[]; fen: string }[] = [];

  for (const file of files) {
    const filePath = join(process.cwd(), 'data', file);
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const parts = line.split('\t');
      if (parts.length < 3) continue;

      const [eco, name, pgn] = parts;
      
      const chess = new Chess();
      const moves: string[] = [];
      
      const pgnMoves = pgn.replace(/\d+\.\s*/g, '').trim().split(/\s+/);
      for (const move of pgnMoves) {
        if (move && chess.move(move)) {
          moves.push(move);
        }
      }

      const fen = chess.fen();

      allOpenings.push({
        eco,
        name,
        pgn,
        moves,
        fen,
      });
    }
  }

  console.log(`Found ${allOpenings.length} openings, inserting...`);

  const batchSize = 100;
  for (let i = 0; i < allOpenings.length; i += batchSize) {
    const batch = allOpenings.slice(i, i + batchSize);
    await db.insert(openings).values(batch);
    console.log(`Inserted ${Math.min(i + batchSize, allOpenings.length)} / ${allOpenings.length}`);
  }

  console.log('Seeding complete!');
}

seedOpenings()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error seeding openings:', err);
    process.exit(1);
  });
