const fs = require('fs');

// Load existing chess facts
const existingFacts = JSON.parse(fs.readFileSync('client/src/data/chess-facts.json', 'utf8'));

// User-provided facts - parsed from plain text
const userFacts = [
  // Blindfold Record
  "George Koltanowski set a record by playing 56 games blindfolded simultaneously in 1960.",
  
  // Piece Nicknames and Terms
  "Zugzwang (German for 'compulsion to move') is a position where any legal move worsens the player's position.",
  "Zwischenzug (German for 'intermediate move') is a tactic inserting an unexpected check or threat before a planned sequence.",
  "A Desperado is a doomed piece that captures other pieces or gives checks before its demise to gain advantage.",
  "The Bishop is called 'The Runner' (Läufer) in German.",
  "In Russian, the Rook is called 'Ladya', meaning a boat or ship.",
  "The King and Queen are sometimes called the 'Royalty' or 'Major Pieces'.",
  "The Knight and Bishop are sometimes called the 'Minor Pieces' or 'Minors'.",
  "A 'Swindler' is a player known for turning hopelessly lost positions into draws or wins using tricks and traps.",
  "'The Queen on her own color' is a mnemonic for the starting position (White Queen on d1 white, Black Queen on d8 black).",
  "The King and Rook are the only pieces that can participate in the special move Castling.",
  
  // Pop Culture
  "The 1957 film 'The Seventh Seal' features a famous scene where a knight plays chess against Death."
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
