const fs = require('fs');

// Load existing chess facts
const existingFacts = JSON.parse(fs.readFileSync('client/src/data/chess-facts.json', 'utf8'));

// User-provided facts - parsed from plain text
const userFacts = [
  // Records and Landmarks
  "The St. Louis Chess Club holds the record for the world's largest chess piece - a 20-foot tall King.",
  "The 1972 Fischer-Spassky match was the first to be broadcast live to a global audience.",
  
  // Terminology
  "'The clock is running' means it is officially the player's turn to move.",
  "The Swiss System format allows maximum players to compete efficiently without excessive rounds.",
  "The Round-Robin format is where every competitor plays every other competitor once.",
  "The earliest reference to a chess rating or ranking system dates back to the 18th century.",
  
  // Strategy
  "The 'Alekhine Gun' is a formation where the Queen backs up two Rooks along an open file.",
  "Prophylaxis (preventing opponent's threats rather than pursuing your own plan) was championed by Nimzowitsch.",
  "The 'Kiss of Death' is a colloquial term for a King-side attack ending in Queen checkmate.",
  "In the endgame, the King becomes a powerful attacking and defensive piece."
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
