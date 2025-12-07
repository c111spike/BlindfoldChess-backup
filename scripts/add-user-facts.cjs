const fs = require('fs');

// Load existing chess facts
const existingFacts = JSON.parse(fs.readFileSync('client/src/data/chess-facts.json', 'utf8'));

// User-provided facts - parsed from plain text
const userFacts = [
  // Etymology and History
  "The term 'Rookie' (for a beginner) is sometimes traced back to the Rook piece, which is often the last to enter the game.",
  "The Sicilian Defense (1. e4 c5) is named after the island of Sicily, though its association with the region is tenuous.",
  "The 'Immortal Game' (Anderssen vs. Kieseritzky, 1851) was played during a break at the world's first international tournament in London.",
  "The Black Death (1347-1351) is thought to have briefly reduced the popularity of chess in Europe due to social upheaval.",
  "In some ancient versions, players could win by simply capturing all opponent's pieces (leaving a 'bare king') without checkmate.",
  
  // Rules, Records, and Numbers
  "The longest theoretical chess game possible under FIDE rules is estimated to be around 5,949 moves.",
  "There are over 318 billion possible ways of playing the first four moves for both sides.",
  "There are 400 possible board positions after one move by White and one move by Black.",
  "There are over 122 million unique ways to complete a Knight's Tour (visiting every square exactly once).",
  "Through pawn promotion, it's theoretically possible to have nine Queens or up to ten Rooks, Knights, or Bishops of the same color.",
  "Under-promotion (to a piece other than Queen) is most often a Knight to deliver immediate checkmate or fork.",
  "The earliest known example of castling late in a game was in 1966, on move 46.",
  "In the 18th century, pawns could only be promoted to pieces already captured by the opponent.",
  "Chess clocks were first used at the 1862 London tournament, initially using hourglasses."
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
