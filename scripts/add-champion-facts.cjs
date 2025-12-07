const fs = require('fs');

// Load existing chess facts
const existingFacts = JSON.parse(fs.readFileSync('client/src/data/chess-facts.json', 'utf8'));

// World Chess Champions coronation dates (from user's screenshot)
const championCoronations = [
  { name: "Wilhelm Steinitz", date: "03-29", year: 1886, ordinal: "1st" },
  { name: "Emanuel Lasker", date: "05-26", year: 1894, ordinal: "2nd" },
  { name: "José Raúl Capablanca", date: "04-21", year: 1921, ordinal: "3rd" },
  { name: "Alexander Alekhine", date: "11-29", year: 1927, ordinal: "4th" },
  { name: "Max Euwe", date: "12-15", year: 1935, ordinal: "5th" },
  { name: "Alexander Alekhine", date: "12-15", year: 1937, ordinal: "4th", note: "regained title" },
  { name: "Mikhail Botvinnik", date: "05-17", year: 1948, ordinal: "6th" },
  { name: "Vasily Smyslov", date: "04-27", year: 1957, ordinal: "7th" },
  { name: "Mikhail Botvinnik", date: "05-08", year: 1958, ordinal: "6th", note: "regained title" },
  { name: "Mikhail Tal", date: "05-07", year: 1960, ordinal: "8th" },
  { name: "Mikhail Botvinnik", date: "05-12", year: 1961, ordinal: "6th", note: "regained title" },
  { name: "Tigran Petrosian", date: "05-20", year: 1963, ordinal: "9th" },
  { name: "Boris Spassky", date: "06-14", year: 1969, ordinal: "10th" },
  { name: "Bobby Fischer", date: "09-01", year: 1972, ordinal: "11th" },
  { name: "Anatoly Karpov", date: "04-03", year: 1975, ordinal: "12th", note: "awarded by default" },
  { name: "Garry Kasparov", date: "11-09", year: 1985, ordinal: "13th" },
  { name: "Vladimir Kramnik", date: "11-04", year: 2000, ordinal: "14th" },
  { name: "Viswanathan Anand", date: "09-30", year: 2007, ordinal: "15th" },
  { name: "Magnus Carlsen", date: "11-22", year: 2013, ordinal: "16th" },
  { name: "Ding Liren", date: "04-30", year: 2023, ordinal: "17th" },
  { name: "Gukesh D", date: "12-12", year: 2024, ordinal: "18th" }
];

// Add championship coronation facts
for (const champ of championCoronations) {
  if (!existingFacts[champ.date]) {
    existingFacts[champ.date] = [];
  }
  
  let text = `${champ.name} became the ${champ.ordinal} World Chess Champion on this day in ${champ.year}`;
  if (champ.note) {
    text += ` (${champ.note})`;
  }
  text += '.';
  
  existingFacts[champ.date].push({
    type: 'championship',
    text: text,
    year: champ.year,
    name: champ.name,
    source: 'World Chess Championship History'
  });
}

// Chess openings named after players (fun facts - not date-specific, but we can add them as general facts)
const openingFacts = [
  "The Ruy Lopez (Spanish Game) was first systematically analyzed by Spanish priest Ruy López de Segura in 1561.",
  "The King's Gambit was refined by Italian master Gioachino Greco in the 17th century.",
  "The Scotch Game was named after an 1824 correspondence match between London and Edinburgh.",
  "The Evans Gambit was invented by Welsh sea captain William Davies Evans in 1827.",
  "Petrov's Defense was analyzed and popularized by Russian master Alexander Petrov in the 1840s.",
  "The Philidor Defense was championed by François-André Danican Philidor in his famous 1749 chess book.",
  "The French Defense was named after an 1834 correspondence match between Paris and London.",
  "The Caro-Kann Defense was independently analyzed by Horatio Caro and Marcus Kann in the 1880s.",
  "Alekhine's Defense was introduced by the 4th World Champion Alexander Alekhine in 1921.",
  "The Pirc Defense was developed by Slovenian GM Vasja Pirc in the mid-20th century.",
  "The Nimzo-Indian Defense was pioneered by Aron Nimzowitsch in the 1920s as a hypermodern opening.",
  "The Grünfeld Defense was introduced by Austrian GM Ernst Grünfeld in 1922.",
  "The Bogo-Indian Defense was a cornerstone of Efim Bogoljubov's repertoire in the 1920s-30s.",
  "The Catalan Opening was introduced by Savielly Tartakower at a 1929 tournament in Catalonia, Spain.",
  "The English Opening (1.c4) was popularized by Howard Staunton in the mid-19th century.",
  "The Réti Opening was championed by Richard Réti as part of the hypermodern revolution in the 1920s.",
  "Bird's Opening (1.f4) was frequently played by English master Henry Edward Bird in the mid-19th century.",
  "Larsen's Opening (1.b3) was pioneered by Danish GM Bent Larsen in the 1960s-70s."
];

// General chess history fun facts
const historyFacts = [
  "Chess originated in India around the 6th century AD as 'Chaturanga' meaning 'four divisions' of the military.",
  "The word 'Chess' comes from the Persian word 'shāh' meaning 'king'.",
  "The word 'checkmate' comes from the Persian phrase 'shāh māt' meaning 'the king is helpless'.",
  "The first mention of chess in Western writing was in a Spanish manuscript in the 13th century.",
  "The modern two-square pawn move on the first turn was introduced in Spain in 1280 to speed up the game.",
  "The alternating light and dark squares on the chessboard first appeared in Europe around 1090.",
  "Before the modern Queen (c. 15th century), the piece was called the Vizier and could only move one square diagonally.",
  "The first unofficial World Chess Champion is often considered to be Pedro Damiano in the 16th century.",
  "The 1886 match that crowned Steinitz was played across three American cities: New York, St. Louis, and New Orleans.",
  "José Raúl Capablanca was undefeated for eight years (1916-1924) in serious classical play.",
  "Mikhail Botvinnik pioneered scientific, systematic training methods in the 1930s that became the modern standard.",
  "The 1948 World Championship was held as a tournament after Alekhine's death, won by Botvinnik.",
  "Bobby Fischer learned chess at age 6 and became a Grandmaster at age 15.",
  "Garry Kasparov became the youngest World Champion in history at age 22 in 1985.",
  "Magnus Carlsen achieved the highest rating ever recorded (2882) in 2014.",
  "The longest chess game theoretically possible would require 5,949 moves.",
  "There are more possible chess games than atoms in the observable universe.",
  "The number of possible unique chess games is estimated at 10^120 (the Shannon number).",
  "The shortest possible checkmate (Fool's Mate) takes only 2 moves.",
  "The longest tournament game ever played lasted 269 moves (Nikolić vs. Arsović, 1989)."
];

// Distribute fun facts across dates that have fewer facts
// Get all dates sorted by number of facts (ascending)
const datesByFactCount = Object.keys(existingFacts)
  .map(date => ({ date, count: existingFacts[date].length }))
  .sort((a, b) => a.count - b.count);

// Combine all fun facts
const allFunFacts = [...openingFacts, ...historyFacts];

// Add fun facts to dates with fewest facts (distribute evenly)
let factIndex = 0;
for (const { date } of datesByFactCount) {
  if (factIndex >= allFunFacts.length) break;
  
  // Only add to dates with fewer than 3 facts
  if (existingFacts[date].length < 3) {
    existingFacts[date].push({
      type: 'fun_fact',
      text: allFunFacts[factIndex],
      year: null,
      name: null,
      source: 'Chess History'
    });
    factIndex++;
  }
}

// Also add remaining fun facts to random dates
while (factIndex < allFunFacts.length) {
  const randomDate = datesByFactCount[Math.floor(Math.random() * datesByFactCount.length)].date;
  existingFacts[randomDate].push({
    type: 'fun_fact',
    text: allFunFacts[factIndex],
    year: null,
    name: null,
    source: 'Chess History'
  });
  factIndex++;
}

// Count stats
let totalFacts = 0;
let datesWithFacts = 0;
let championshipFacts = 0;
let funFactCount = 0;

for (const key in existingFacts) {
  totalFacts += existingFacts[key].length;
  if (existingFacts[key].length > 0) datesWithFacts++;
  for (const fact of existingFacts[key]) {
    if (fact.type === 'championship') championshipFacts++;
    if (fact.type === 'fun_fact') funFactCount++;
  }
}

console.log(`Total facts: ${totalFacts}`);
console.log(`Dates with facts: ${datesWithFacts}/366`);
console.log(`Championship facts added: ${championshipFacts}`);
console.log(`Fun facts added: ${funFactCount}`);

// Write updated facts
fs.writeFileSync('client/src/data/chess-facts.json', JSON.stringify(existingFacts, null, 2));
console.log('Written to client/src/data/chess-facts.json');

// Show sample championship facts
console.log('\nSample - November 22 (Carlsen crowned):');
console.log(JSON.stringify(existingFacts['11-22'], null, 2));

console.log('\nSample - September 1 (Fischer crowned):');
console.log(JSON.stringify(existingFacts['09-01'], null, 2));
