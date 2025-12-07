const fs = require('fs');

// Load existing chess facts
const existingFacts = JSON.parse(fs.readFileSync('client/src/data/chess-facts.json', 'utf8'));

// User-provided facts - parsed from plain text
const userFacts = [
  // History and Origin section
  "Chess originated in India around the 6th century AD as Chaturanga, meaning 'four divisions' (infantry, cavalry, elephants, and chariots).",
  "The word 'Chess' comes from the Persian word 'shāh', meaning 'king'.",
  "The word 'checkmate' comes from the Persian phrase 'shāh māt', meaning 'the king is helpless' or 'the king is dead'.",
  "Chess spread through Persia and the Islamic world, arriving in Europe (Spain and Italy) around the 10th century.",
  "The pieces gained their modern movement rules (especially the powerful Queen and Bishop) in the late 15th century during the Renaissance.",
  "The powerful Queen's movement was added in the late 15th century - this version was called 'Queen's Chess' or 'Mad Queen Chess'.",
  "Wilhelm Steinitz was the first official World Chess Champion, claiming the title in 1886.",
  
  // Mathematics and Possibility section
  "The Shannon Number ($10^{120}$) represents the estimated number of possible unique chess games.",
  "The longest tournament game ever played was between Ivan Nikolić and Goran Arsović in 1989, lasting 20 hours and 15 minutes over 269 moves.",
  "A rule once existed that prohibited draws before move 50. The longest game under this rule lasted 193 moves (Karpov vs Kaidanov, 1993).",
  "From the initial position, White has 20 possible first moves. After the first pair of moves, there are 400 possible positions.",
  "The average chess game lasts about 40 moves.",
  "The longest known forced mate in a composed problem is over 500 moves, though the 50-move rule usually forces a draw first."
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
