const fs = require('fs');

// Load existing chess facts
const existingFacts = JSON.parse(fs.readFileSync('client/src/data/chess-facts.json', 'utf8'));

// User-provided facts - parsed from plain text
const userFacts = [
  // World Championship History
  "The first unofficial World Chess Champion is often considered to be Pedro Damiano (16th century).",
  "The 1886 Steinitz match was played across three American cities: New York, St. Louis, and New Orleans.",
  "José Raúl Capablanca was undefeated for eight years (1916-1924) in serious classical play.",
  "In the 1930s, Mikhail Botvinnik began applying scientific training methods that became standard for modern preparation.",
  "The 1948 World Championship establishing the cycle after Alekhine's death was held in The Hague and Moscow.",
  "The 1984-85 Karpov vs Kasparov match was controversially ended after 48 games by FIDE President Campomanes.",
  "Viswanathan Anand was the first to win the World Championship in three formats (Knockout, Tournament, Match).",
  "The Candidates Tournament is the final event to select the challenger to the reigning World Champion.",
  "Ding Liren became the first Chinese male World Champion after winning the 2023 match against Nepomniachtchi.",
  "Mikhail Botvinnik was the first player to successfully defend the title in the FIDE era (since 1948).",
  "Anatoly Karpov won the 1975 World Championship by forfeit when Bobby Fischer refused to defend his title."
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
