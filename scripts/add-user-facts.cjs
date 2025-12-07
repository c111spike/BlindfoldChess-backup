const fs = require('fs');

// Load existing chess facts
const existingFacts = JSON.parse(fs.readFileSync('client/src/data/chess-facts.json', 'utf8'));

// User-provided facts - parsed from plain text
const userFacts = [
  // Famous Players and Anecdotes
  "During the 1972 Fischer-Spassky match, the Soviet team claimed Fischer used electronic devices in his chair - inspection found nothing.",
  "Akiba Rubinstein was a brilliant Russian Grandmaster known for endgame technique, despite never winning the World Championship.",
  "Paul Morphy (19th century American master) traveled the world playing without demanding money, seeking only intellectual challenge.",
  "WWII code breakers at Bletchley Park included British chess masters Harry Golombek, Stuart Milner-Barry, and C.H.O'D. Alexander.",
  "The 1973 Cleveland Chess Tournament was raided by police who confiscated chess sets, claiming they were 'gambling devices' due to cash prizes.",
  "Vladimir Nabokov, author of Lolita, wrote 'The Luzhin Defense' based on the tragic life of a chess grandmaster.",
  "Fidel Castro was a passionate chess player and hosted numerous international tournaments in Cuba.",
  "Miguel Najdorf, namesake of the Sicilian Najdorf, was one of the first to give successful blindfold chess exhibitions.",
  "Frank Marshall (U.S. Champion for 30 years) was the first American to defeat a Soviet player in an international tournament in 1924."
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
