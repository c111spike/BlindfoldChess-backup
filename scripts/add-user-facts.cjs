const fs = require('fs');

// Load existing chess facts
const existingFacts = JSON.parse(fs.readFileSync('client/src/data/chess-facts.json', 'utf8'));

// User-provided facts - parsed from plain text
const userFacts = [
  // Strategy Terms
  "'Doctrinaire' describes dogmatic players who strictly adhere to rigid opening principles.",
  "Hanging Pawns are two adjacent pawns with no friendly pawns on adjacent files to defend them.",
  "A Backward Pawn cannot be defended by other pawns and can be easily blockaded or attacked.",
  "An Outpost is a square protected by a pawn on the opponent's side, often occupied by a Knight.",
  "Pawn Structure is the arrangement of pawns - the skeleton that determines middlegame plans.",
  
  // Tournament and Regional Facts
  "The Sunway Sitges Chess Festival in Spain is one of the world's most popular open tournaments.",
  "The Tata Steel Tournament (formerly Wijk aan Zee) in Netherlands is nicknamed the 'Wimbledon of Chess'.",
  "The 2016 Baku Chess Olympiad was the first USA men's team gold medal since 1976.",
  "The first official FIDE World Cup was held in 2000.",
  "The US Chess Championship is typically held at the Saint Louis Chess Club.",
  "The Sinquefield Cup is named after Rex and Jeanne Sinquefield, major American chess patrons.",
  "The London Chess Classic is the UK's premier international chess tournament.",
  "The Candidates Tournament has varied in format: round-robin, knockout, and double round-robin."
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
