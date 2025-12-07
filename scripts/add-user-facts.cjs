const fs = require('fs');

// Load existing chess facts
const existingFacts = JSON.parse(fs.readFileSync('client/src/data/chess-facts.json', 'utf8'));

// User-provided facts - parsed from plain text
const userFacts = [
  // Openings
  "The Sicilian Defense is the most popular response by Black to 1. e4 at the master level.",
  "The Queen's Gambit is the oldest opening still considered fully sound and popular at Grandmaster level.",
  "The King's Gambit (1. e4 e5 2. f4) was the opening of choice during the 'Romantic Era' of chess (18th-19th centuries).",
  
  // Strategy and Tactics
  "Queen sacrifices are so rare and brilliant that they are often highlighted as moments of genius.",
  "Zwischenzug (intermediate move) is often a check or forcing move that changes the anticipated order of a combination.",
  
  // Competitive Chess
  "The World Computer Chess Championship is a separate tournament where computer programs compete against each other.",
  "The Russian School of Chess emphasized state support, scientific analysis, and systematic training.",
  "Correspondence Chess involves players taking days or weeks for a single move, using tools and databases for deep analysis.",
  "The FIDE Master (FM) title is ranked below International Master (IM) and Grandmaster (GM) titles.",
  "Chess pieces have symbolic point values: Pawn (1), Knight/Bishop (3), Rook (5), Queen (9), King (Infinite)."
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
