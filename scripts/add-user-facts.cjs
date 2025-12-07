const fs = require('fs');

// Load existing chess facts
const existingFacts = JSON.parse(fs.readFileSync('client/src/data/chess-facts.json', 'utf8'));

// User-provided facts - parsed from plain text
const userFacts = [
  // Player Records
  "Fabiano Caruana holds the highest performance rating ever in a closed tournament (3098 at 2014 Sinquefield Cup).",
  "Vishy Anand won both World Rapid Championship (2017) and World Blitz Championship (2003).",
  
  // Modern Chess and Technology
  "Stockfish, an open-source engine, is widely considered the strongest modern chess engine.",
  "AlphaZero achieved superhuman strength by learning solely through self-play, without human opening books.",
  "Chess engine analysis uses 'depth' to measure how many moves ahead the engine is calculating.",
  "Top players use engines extensively for both analysis and opening preparation.",
  "Chess streaming has massively boosted the game's popularity, led by Hikaru Nakamura and Levy Rozman (GothamChess).",
  "Modern chess apps use neural networks (like Stockfish NNUE) for better positional evaluation.",
  "In online chess, 'Blunder' is tracked statistically as a move that drastically lowers winning probability."
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
