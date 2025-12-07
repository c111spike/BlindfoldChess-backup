const fs = require('fs');

// Load existing chess facts
const existingFacts = JSON.parse(fs.readFileSync('client/src/data/chess-facts.json', 'utf8'));

// User-provided facts - parsed from plain text
const userFacts = [
  // Tournaments
  "The Aeroflot Open in Moscow used to be one of the largest and strongest open tournaments globally.",
  
  // Specific People and Anecdotes
  "Aron Nimzowitsch invented terms like 'Prophylaxis' and 'Overprotection' that are now standard chess vocabulary.",
  "Siegbert Tarrasch was called 'Praeceptor Germaniae' (Teacher of Germany) for his belief in classical principles.",
  "Alexander Alekhine was known for extensive analysis, sometimes inventing lines that favored his side.",
  "Garry Kasparov once played a simultaneous exhibition against the entire Iranian national team in Tehran.",
  "Mikhail Tal was known to sacrifice pieces for minimal material, relying on immense pressure created.",
  "Viktor Korchnoi played in the Candidates Tournament at age 75 (2007 event).",
  "The Polgár sisters were part of an experiment by their father László to prove genius is nurtured, not born.",
  "Magnus Carlsen dropped out of the 2023 World Championship cycle, stating he had 'nothing to gain'.",
  "Viswanathan Anand was nicknamed 'The Tiger of Madras' for his speed of calculation.",
  "Wesley So is known for his solid, strategic style, often drawing comparisons to Karpov."
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
