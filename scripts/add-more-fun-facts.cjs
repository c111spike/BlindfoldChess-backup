const fs = require('fs');

// Load existing chess facts
const existingFacts = JSON.parse(fs.readFileSync('client/src/data/chess-facts.json', 'utf8'));

// Comprehensive fun facts from verified sources
const funFacts = [
  // Origins & History
  "Chess originated in India around the 6th century CE as 'chaturanga', meaning 'four divisions of the military'.",
  "The earliest recorded chess game in history is from the 900s, between a historian from Baghdad and his student.",
  "Archaeologists discovered ivory chess pieces in Uzbekistan dating back to 760 AD.",
  "The word 'checkmate' comes from the Persian phrase 'Shah Mat', meaning 'the King is dead'.",
  "Chess reached Western Europe around the year 1000.",
  "The oldest surviving complete chess sets are the Lewis Chessmen, found on the Isle of Lewis in Scotland, dating to the 12th century.",
  
  // Evolution of pieces
  "The Queen originally could only move one square diagonally - she was the weakest piece!",
  "The Queen was initially called the 'counselor' or 'minister' (fers).",
  "Around 1475, the Queen gained vastly increased power to become the most powerful piece.",
  "This transformation possibly occurred due to powerful female monarchs like Queen Isabella of Spain.",
  "The Bishop (originally called 'elephant') could only jump two squares diagonally before gaining extended range.",
  "Pawns advancing two squares from their starting position was introduced in 1280 in Spain.",
  "Castling was two separate moves as late as 1561.",
  "The convention that white moves first was established during the Romantic Era (18th century - 1880s).",
  
  // Medieval facts
  "Traditional chess pieces look abstract because the game passed through the Islamic world, which forbids making statues of animals.",
  "The first black and white chessboard appeared in Europe around 1020 CE.",
  "Folding chessboards were invented to hide chess games after the Pope banned chess in 1061.",
  "In 1474, William Caxton printed 'Game and Playe of the Chesse' - the second book ever printed in English.",
  "Chess was called 'the royal game' in the 15th century due to its popularity among nobility.",
  "Before the late 15th century, checkmate was relatively rare - more games were decided by 'baring the king'.",
  
  // Mathematical facts
  "There are more possible chess games than atoms in the observable universe: 10^120 possible games.",
  "This number is called 'Shannon's number', calculated by mathematician Claude Shannon in 1950.",
  "The longest chess game theoretically possible is 5,949 moves.",
  "After each player's first move, there are 400 possible positions.",
  "The number of possibilities for a Knight's tour (visiting every square once) is over 122 million.",
  "It is possible to checkmate in just two moves (Fool's Mate).",
  "The world record for moves without capture is 100 moves, set in 1992.",
  "The longest official chess game took place in 1989 and lasted 20 hours with 269 moves.",
  
  // Publishing
  "Chess has been called the second-oldest subject of book publishing.",
  "The first book on chess openings was published in 1843.",
  "Ruy Lopez's 1561 chess book advocated playing with the sun in your opponent's eyes!",
  "The 'Immortal Game' between Adolf Anderssen and Lionel Kieseritzky (1851) defined the Romantic era of chess.",
  "Reliable timing mechanisms were first introduced to chess in 1861.",
  
  // World Championships
  "The first official World Chess Championship was held in 1886 in the United States.",
  "Wilhelm Steinitz defeated Johannes Zuckertort to become the first official World Champion in 1886.",
  "Paul Morphy holds the unofficial title of 'World's First Chess Champion' before official championships.",
  "FIDE, the international chess federation, was founded in 1924 in Paris.",
  "July 20th is celebrated as World Chess Day, proclaimed by the UN General Assembly in 2019.",
  "All World Champions and challengers from 1951 to 1969 were Soviet citizens.",
  "US Chess Federation membership jumped from 2,100 in 1957 to over 70,000 in 1973.",
  
  // Records
  "Abhimanyu Mishra became the youngest grandmaster ever at 12 years, 4 months, 25 days in June 2021.",
  "To become a grandmaster, players need three GM norms and an Elo rating of at least 2500.",
  "Bobby Fischer was the 11th World Champion and ended Soviet dominance during the Cold War.",
  "Fischer refused to defend his title in 1975 and disappeared, resurfacing in 1992 to play Spassky.",
  "Garry Kasparov was defeated by IBM's Deep Blue in 1997 - a major shock to the chess world.",
  "Magnus Carlsen holds the record for highest rating in history at 2882, attained in 2014.",
  
  // Computers
  "The first Soviet mass-market chess computer 'Electronica IM-01' was produced in 1977.",
  "DeepThought became the first computer to beat an international grandmaster in November 1988.",
  "Deep Blue's victory over Kasparov in 1997 ushered chess into an era of computer domination.",
  "Top players now rely on computer analysis and databases of millions of games.",
  
  // Cultural facts
  "About 600-605 million people worldwide know how to play chess.",
  "About 70% of adults have played chess at some point in their lives.",
  "Chess is a required school subject in Armenia.",
  "Playing chess can enhance cognitive ability, especially in children.",
  "Chess is recommended in the fight against Alzheimer's disease.",
  "There are now more than 2,000 International Grandmasters worldwide.",
  "Blindfold chess is real - players make moves without looking at the board.",
  "Chess boxing is a real hybrid sport popular in Europe - players alternate between boxing and chess rounds.",
  "Caïssa is the mythological goddess of chess from the Romantic Era.",
  
  // Unusual facts
  "Police raided a chess tournament in Cleveland in 1973, arresting the director for 'illegal gaming' (cash prizes).",
  "During WWII, top chess players helped break the Nazi Enigma code at Bletchley Park.",
  "Bobby Fischer and GM Larry Evans famously played chess in a swimming pool.",
  "The Staunton pattern chess set designed in 1849 is still the standard used today.",
  "There are over 1,000 documented chess variants throughout history.",
  "The longest time for castling to occur in a game was move 46 (Bobotsor vs. Irkov, 1966).",
  "In German and Spanish, the pawn is called 'peasant' or 'farmer' instead of foot soldier.",
  "The chess village of Ströbeck in Germany has played chess since the early 11th century.",
  
  // More player facts
  "José Raúl Capablanca was undefeated for eight years (1916-1924) in serious classical play.",
  "Mikhail Botvinnik pioneered scientific, systematic training methods in the 1930s.",
  "Emanuel Lasker held the World Championship title for 27 years (1894-1921) - the longest reign ever.",
  "Anatoly Karpov became World Champion in 1975 by default when Fischer refused to defend his title.",
  "Garry Kasparov became the youngest World Champion in history at age 22 in 1985.",
  "Judit Polgár is considered the strongest female chess player of all time.",
  "Vera Menchik was the first Women's World Chess Champion, holding the title from 1927-1944.",
  "Mikhail Tal was known as 'The Magician from Riga' for his spectacular attacking style.",
  "Bobby Fischer's IQ was estimated at 180 - genius level.",
  "Viswanathan Anand was the first Asian player to become World Chess Champion.",
  
  // Opening facts (from user's data - already have these but adding more detail)
  "The Sicilian Defense is the most popular response to 1.e4 at the grandmaster level.",
  "The Italian Game (Giuoco Piano) dates back to the 16th century and means 'quiet game'.",
  "The London System has become extremely popular in the 21st century for its solid structure.",
  "The King's Indian Defense was considered dubious until Soviet players proved its worth in the 1950s.",
  "The Najdorf Sicilian is named after Miguel Najdorf, who used it as a memorial to his family lost in the Holocaust.",
  "The Dragon Sicilian is named after the constellation Draco, which the pawn structure resembles.",
  "The Berlin Defense gained fame when Kramnik used it to defeat Kasparov for the World Championship in 2000.",
  "The Marshall Attack in the Ruy Lopez was kept as a secret weapon for 8 years before being played.",
  
  // Tournament facts
  "The longest tournament game ever was Nikolić vs. Arsović in 1989, lasting 269 moves over 20 hours.",
  "Hastings International Chess Congress has been held annually since 1895 (except during wars).",
  "The Chess Olympiad is the world's biggest chess event, with over 180 countries participating.",
  "The Candidates Tournament determines who challenges the World Champion.",
  "Tata Steel Chess (formerly Wijk aan Zee) is known as the 'Wimbledon of Chess'.",
  "The Sinquefield Cup in Saint Louis offers one of the largest prize funds in chess.",
  "The World Rapid and Blitz Championships have been held annually since 2012.",
  "Online chess became mainstream during the COVID-19 pandemic, with millions of new players.",
  
  // More historical facts
  "The first chess club was established in London in 1747 at Slaughter's Coffee House.",
  "The first international chess tournament was held in London in 1851.",
  "The en passant rule was added to chess around the 15th century.",
  "The 50-move draw rule has been a part of chess since the 19th century.",
  "Stalemate being a draw (not a loss) is a European innovation from around 1800.",
  "The first chess magazine was 'Le Palamède', founded in Paris in 1836.",
  "The first chess problem was published in a book in 1497.",
  "Chess clocks with two faces connected by a mechanism were invented in 1883 by Thomas Wilson."
];

// Get all dates sorted by number of facts (ascending)
const dates = Object.keys(existingFacts).sort((a, b) => existingFacts[a].length - existingFacts[b].length);

// Distribute fun facts to ensure every date has at least 5-7 facts
let factIndex = 0;

// First pass: fill dates with fewer than 5 facts
for (const date of dates) {
  while (existingFacts[date].length < 5 && factIndex < funFacts.length) {
    existingFacts[date].push({
      type: 'fun_fact',
      text: funFacts[factIndex],
      year: null,
      name: null,
      source: 'Chess History'
    });
    factIndex++;
  }
}

// Second pass: add remaining facts to dates with fewer than 7 facts
for (const date of dates) {
  while (existingFacts[date].length < 7 && factIndex < funFacts.length) {
    existingFacts[date].push({
      type: 'fun_fact',
      text: funFacts[factIndex],
      year: null,
      name: null,
      source: 'Chess History'
    });
    factIndex++;
  }
}

// Third pass: distribute any remaining facts
let dateIndex = 0;
while (factIndex < funFacts.length) {
  existingFacts[dates[dateIndex % dates.length]].push({
    type: 'fun_fact',
    text: funFacts[factIndex],
    year: null,
    name: null,
    source: 'Chess History'
  });
  factIndex++;
  dateIndex++;
}

// Count stats
let totalFacts = 0;
let datesWithFacts = 0;
let minFacts = Infinity;
let maxFacts = 0;
let funFactCount = 0;

for (const key in existingFacts) {
  const count = existingFacts[key].length;
  totalFacts += count;
  if (count > 0) datesWithFacts++;
  if (count < minFacts) minFacts = count;
  if (count > maxFacts) maxFacts = count;
  for (const fact of existingFacts[key]) {
    if (fact.type === 'fun_fact') funFactCount++;
  }
}

console.log(`Total facts: ${totalFacts}`);
console.log(`Dates with facts: ${datesWithFacts}/366`);
console.log(`Min facts/day: ${minFacts}`);
console.log(`Max facts/day: ${maxFacts}`);
console.log(`Avg facts/day: ${(totalFacts/366).toFixed(1)}`);
console.log(`Total fun facts: ${funFactCount}`);
console.log(`New fun facts added: ${funFacts.length}`);

// Write updated facts
fs.writeFileSync('client/src/data/chess-facts.json', JSON.stringify(existingFacts, null, 2));
console.log('Written to client/src/data/chess-facts.json');
