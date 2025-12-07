const fs = require('fs');

// Load existing chess facts
const existingFacts = JSON.parse(fs.readFileSync('client/src/data/chess-facts.json', 'utf8'));

// User-provided facts - parsed from plain text
const userFacts = [
  // Player Facts
  "Hou Yifan became the youngest female Grandmaster ever at age 14 years and 6 months in 2018.",
  
  // Openings and Tactics
  "The Reti Opening (1. Nf3) is named after Hypermodern master Richard Réti, who championed indirect central control.",
  "Chess boxing is a hybrid sport where competitors alternate between rounds of chess and boxing.",
  "The original Indian word Chaturanga means 'four divisions,' referring to military components represented by pieces.",
  "Pawn storms are aggressive pawn advances, usually on the wing, aimed at weakening opponent's King safety.",
  
  // Quotes and Strategy
  "Emanuel Lasker famously said: 'When you see a good move, look for a better one.'",
  "The 'desperate check' is a tactic giving a seemingly useless check to repeat position for a draw or win material.",
  "The King is the weakest piece in terms of movement power, moving only one square at a time.",
  "Promotion isn't limited to captured pieces - you can have two or more Queens if you promote with all pieces still on board."
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
