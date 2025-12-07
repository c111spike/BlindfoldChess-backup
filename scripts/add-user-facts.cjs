const fs = require('fs');

// Load existing chess facts
const existingFacts = JSON.parse(fs.readFileSync('client/src/data/chess-facts.json', 'utf8'));

// User-provided facts - parsed from plain text
const userFacts = [
  // Obscure Rules and History
  "Early 19th-century rules sometimes allowed the King to make a Knight move on its first turn.",
  "Until mid-19th century, opponents were required to announce 'Check!' or the move would be invalid.",
  "Castling was not fully standardized until the 17th century - different European regions had different rules.",
  "Fischer Random Chess (Chess960) has 960 possible starting positions to negate memorized opening theory.",
  "The Old Indian Defense (1. d4 Nf6 2. c4 d6) predates the more popular King's Indian Defense.",
  "The first 'Master-level' chess book was written by François-André Danican Philidor in the 18th century.",
  "The 'Immortal Zugzwang Game' (Nimzowitsch vs Sämisch, 1923) ended in a pure zugzwang position."
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
