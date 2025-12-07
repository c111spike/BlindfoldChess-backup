const fs = require('fs');

// Load existing chess facts
const existingFacts = JSON.parse(fs.readFileSync('client/src/data/chess-facts.json', 'utf8'));

// User-provided facts - parsed from plain text
const userFacts = [
  // Openings and History
  "Damiano's Defense (1. e4 e5 2. Nf3 f6) is a weak but named defense dating back to the 16th century.",
  "Gambits are opening sacrifices typically aimed at gaining time advantage or control of the center.",
  "The first known chess problem composer was likely al-Adli (9th century Arab master).",
  
  // Miscellaneous & Records
  "The World Junior Championship has been a proving ground for future champions: Kasparov, Anand, and Carlsen.",
  "The game Go is computationally more complex than chess, with a larger board and longer games.",
  "Judit Polgár's peak rating of 2735 remains the highest female rating ever achieved.",
  "Chess sets featuring unusual themes (historical figures, movie characters) are popular collectibles.",
  "The Centipawn is the standard engine evaluation unit - 100 centipawns equals one pawn's worth of material."
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
