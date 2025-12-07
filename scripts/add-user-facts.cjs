const fs = require('fs');

// Load existing chess facts
const existingFacts = JSON.parse(fs.readFileSync('client/src/data/chess-facts.json', 'utf8'));

// User-provided facts - parsed from plain text
const userFacts = [
  // Blindfold Detail
  "George Koltanowski's 1960 blindfold record of 56 games required memorizing the location and moves of 1,792 pieces.",
  
  // Miscellanea and Unusual Facts
  "The Elo rating system was invented by Hungarian-American physicist Arpad Elo and is now used in many sports.",
  "Chess professionals employ 'seconds' (assistant players/coaches) during major tournaments for opening preparation.",
  "Magnus Carlsen once played ten consecutive checkmates in a single tournament, showcasing tactical accuracy.",
  "The World Chess Olympiad, where nations compete in teams, first took place in 1927 and is organized by FIDE.",
  "The first mass-market Soviet chess computer, the Electronica IM-01, was produced in 1977.",
  "The Knight is the only piece that can 'jump' over other pieces and is not blocked by them.",
  "The Bishop is sometimes referred to as a 'Churchman' due to its mitre-like shape.",
  "The Grob Opening (1. g4) is an eccentric opening sometimes used to confuse unprepared opponents.",
  "The Légal Mate is one of the oldest chess traps, named after 18th-century French master Sire de Legal.",
  "Vladimir Putin officially designated chess as a required part of the school curriculum in Russia.",
  "In the 19th century, players sometimes used live animals (like cats) near the board to distract opponents."
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
