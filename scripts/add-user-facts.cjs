const fs = require('fs');

// Load existing chess facts
const existingFacts = JSON.parse(fs.readFileSync('client/src/data/chess-facts.json', 'utf8'));

// User-provided facts - parsed from plain text
const userFacts = [
  // Pieces and Rules section
  "The Fifty-Move Rule allows a player to claim a draw if 50 moves pass without a pawn move or capture.",
  "A pawn is the only piece that changes identity - when it reaches the opposite end, it must be promoted to Queen, Rook, Bishop, or Knight.",
  "En passant is a special pawn capture rule invented in the 15th century, allowing capture of a pawn that moved two squares as if it moved one.",
  "Castling is the only move where two pieces (King and Rook) move simultaneously, and the only time a King moves two squares.",
  
  // Modern and Cultural Facts section
  "FIDE (Fédération Internationale des Échecs) was founded in Paris on July 20, 1924 - now celebrated as International Chess Day.",
  "The Grandmaster (GM) title is the highest title a chess player can achieve, awarded by FIDE.",
  "Abhimanyu Mishra (USA) became the youngest Grandmaster ever at 12 years, 4 months, and 25 days in 2021.",
  "Magnus Carlsen holds the highest classical Elo rating ever achieved: 2882.",
  "Emanuel Lasker held the World Championship title for 27 years (1894-1921) - the longest reign in history.",
  "Judit Polgár is the strongest female player ever - the only woman to break 2700 Elo and play for the World Championship.",
  "In 1997, IBM's Deep Blue became the first computer to defeat a reigning World Champion (Garry Kasparov) in a classical match."
];

// Get all dates sorted by number of facts (ascending)
const dates = Object.keys(existingFacts).sort((a, b) => existingFacts[a].length - existingFacts[b].length);

// Add facts to dates with fewest facts
let factIndex = 0;
for (const date of dates) {
  if (factIndex >= userFacts.length) break;
  
  existingFacts[date].push({
    type: 'fun_fact',
    text: userFacts[factIndex],
    year: null,
    name: null,
    source: 'Chess History'
  });
  factIndex++;
}

// Count stats
let totalFacts = 0;
let minFacts = Infinity;
let funFactCount = 0;

for (const key in existingFacts) {
  const count = existingFacts[key].length;
  totalFacts += count;
  if (count < minFacts) minFacts = count;
  for (const fact of existingFacts[key]) {
    if (fact.type === 'fun_fact') funFactCount++;
  }
}

console.log(`Total facts: ${totalFacts}`);
console.log(`Min facts/day: ${minFacts}`);
console.log(`Total fun facts: ${funFactCount}`);
console.log(`New facts added: ${userFacts.length}`);

fs.writeFileSync('client/src/data/chess-facts.json', JSON.stringify(existingFacts, null, 2));
console.log('Written to client/src/data/chess-facts.json');
