const fs = require('fs');

// Load existing chess facts
const existingFacts = JSON.parse(fs.readFileSync('client/src/data/chess-facts.json', 'utf8'));

// User-provided facts - parsed from plain text
const userFacts = [
  // Historical and Cultural Facts
  "The first chess game played in space was in 1970 between the Soyuz 9 crew and a team on Earth - it ended in a draw.",
  "The first mention of chess in Western writing was in a Spanish manuscript in the 13th century.",
  "The modern two-square pawn move on the first turn was introduced in Spain in 1280 to speed up the game.",
  "The alternating light and dark squares on the chessboard first appeared in Europe around 1090.",
  "Before the modern Queen (c. 15th century), the piece was called the Vizier and only moved one square diagonally.",
  "In early chess (Shatranj), stalemate was considered a win for the stalemated player.",
  "White moving first was not standardized in international competition until 1889 - before that, choice was decided by chance.",
  "The folding chessboard was allegedly invented by a chess-playing priest in 1125 to hide it from the Church.",
  "The Rook was originally a chariot (Ratha in Sanskrit), later becoming Rukh (Persian for chariot/tower).",
  "In French, the Bishop is called 'Le Fou' (The Fool) - derived from a misinterpretation of the Arabic word for elephant.",
  "The English Opening (1. c4) was named for Howard Staunton, who used it frequently in the 19th century."
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
