const fs = require('fs');

// Load existing chess facts
const existingFacts = JSON.parse(fs.readFileSync('client/src/data/chess-facts.json', 'utf8'));

// User-provided facts - parsed from plain text
const userFacts = [
  // Pop Culture and Film
  "Humphrey Bogart was an avid chess player - his character in 'Casablanca' (1942) is seen analyzing a chess game.",
  "The first film to feature a chess theme was the British one-minute comedy 'A Chess Dispute' released in 1903.",
  "In 'Independence Day' (1996), the alien invasion is compared to a chess game by David Levinson.",
  "The 1993 film 'Searching for Bobby Fischer' is based on the life of chess prodigy Josh Waitzkin.",
  "In '2001: A Space Odyssey' (1968), HAL 9000 plays a famous chess game against astronaut Frank Poole.",
  "Professor X and Magneto are frequently shown playing chess in X-Men films, symbolizing their strategic rivalry.",
  "The chess sequence in 'Harry Potter and the Sorcerer's Stone' is based on a real game (Petrosian vs. Larsen, 1966).",
  "Netflix's 'The Queen's Gambit' is based on the 1983 novel of the same name by Walter Tevis.",
  "Vladimir Lenin was a known fan of chess and was often photographed playing while in exile.",
  
  // Blindfold and Simultaneous Chess
  "A Simultaneous Exhibition (Simul) is when a master plays against multiple opponents at the same time.",
  "The record for most simultaneous games (non-blindfold) is over 600, set by Alireza Firouzja in 2022.",
  "Blindfold chess originated in the Middle East, with records dating back to the 11th century.",
  "Alexander Alekhine (4th World Champion) set a blindfold record in 1937 by playing 32 games simultaneously."
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
