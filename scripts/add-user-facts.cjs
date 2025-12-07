const fs = require('fs');

// Load existing chess facts
const existingFacts = JSON.parse(fs.readFileSync('client/src/data/chess-facts.json', 'utf8'));

// User-provided facts - parsed from plain text
const userFacts = [
  // World Championship History
  "Garry Kasparov split from FIDE in 1993 to create the Professional Chess Association (PCA).",
  "The 2024 World Championship was the first in 100+ years with two Challengers due to Carlsen's withdrawal.",
  "The official FIDE World Championship trophy is named the 'Kasparov-Karpov' trophy.",
  
  // Pieces, Notation, and Equipment
  "Algebraic Notation (e.g., e4, Nf3) was standardized in the 19th century; Descriptive Notation was used before.",
  "In Descriptive Notation, the square c1 would be known as QR1 (Queen's Rook 1).",
  "A Bishop Pair is often considered a long-term advantage, especially in open positions.",
  "The King uses 'K' in notation while the Knight uses 'N' to avoid confusion.",
  "The Knight is often nicknamed 'The Horse' in common chess parlance.",
  "A 'Battery' refers to lining up two pieces (often Queen and Bishop/Rook) to attack along the same line.",
  "The earliest chess clocks were sandglasses, used at the London Tournament in 1862.",
  "Modern tournaments use digital clocks with increment or delay time controls (e.g., Fischer Delay).",
  "Fischer Delay, invented by Bobby Fischer, gives a fixed time delay before the clock counts down each move.",
  "Increment time control adds a fixed amount of time (e.g., 30 seconds) to a player's clock after every move."
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
