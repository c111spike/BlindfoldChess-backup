const fs = require('fs');

// Load existing chess facts
const existingFacts = JSON.parse(fs.readFileSync('client/src/data/chess-facts.json', 'utf8'));

// User-provided facts - parsed from plain text
const userFacts = [
  // Rules and History
  "The 'touch-move' rule (if you touch a piece, you must move it) has been standard in chess for centuries.",
  "The Threefold Repetition rule was sometimes required to be six repetitions in earlier rule sets.",
  "The first book printed in English by William Caxton in 1474, 'The Game and Playe of the Chesse,' was the second book ever printed in English.",
  "The 'Immortal Draw' (Hamppe vs. Meitner, 1872) is famous for wild sacrifices leading to a forced draw by repetition.",
  "The fastest checkmate possible (Fool's Mate) is in just two moves: 1. f3 e5 2. g4 Qh4#.",
  "The highest-rated player ever with initials 'A.K.' is Anatoly Karpov.",
  
  // Famous Players and Anecdotes
  "Emanuel Lasker retained the World Championship for 26 years and 337 days - the longest reign ever.",
  "Emanuel Lasker was also a distinguished mathematician and philosopher, known for his psychological approach to chess.",
  "Garry Kasparov became the youngest undisputed World Champion in 1985 at age 22 years and 210 days.",
  "The chess scene in James Bond's 'From Russia With Love' features a game based on an actual 1930 match.",
  "The 'Game of the Century' was played by 13-year-old Bobby Fischer against Donald Byrne in 1956, featuring a famous Queen sacrifice."
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
