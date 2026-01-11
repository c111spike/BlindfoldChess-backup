const fs = require('fs');
const path = require('path');

let file1 = fs.readFileSync(path.join(__dirname, '../attached_assets/this_day_in_history_and_fun_facts_1765102988655.txt'), 'utf-8');
let file2 = fs.readFileSync(path.join(__dirname, '../attached_assets/this_day_in_history_chess_1765102990980.txt'), 'utf-8');

file1 = file1.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
file2 = file2.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

const dateToFacts = {};
const funFactsSet = new Set();

function parseFile1(content) {
  const lines = content.split('\n');
  let currentDate = null;
  
  for (const line of lines) {
    if (!line.trim() || line.startsWith('Date,#')) continue;
    
    const dateMatch = line.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d+),(\d+),([^,]+),(.+)$/);
    if (dateMatch) {
      currentDate = `${dateMatch[1]} ${dateMatch[2]}`;
      const eventType = dateMatch[4];
      let description = dateMatch[5];
      if (description.startsWith('"')) description = description.slice(1);
      if (description.endsWith('"')) description = description.slice(0, -1);
      
      if (description.startsWith('Fun Fact:')) {
        funFactsSet.add(description.replace('Fun Fact: ', ''));
      } else if (description.length > 10) {
        if (!dateToFacts[currentDate]) dateToFacts[currentDate] = [];
        dateToFacts[currentDate].push({
          type: eventType.toLowerCase().replace(/ /g, '_'),
          description: description
        });
      }
      continue;
    }
    
    const contMatch = line.match(/^,(\d+),([^,]+),(.+)$/);
    if (contMatch && currentDate) {
      const eventType = contMatch[2];
      let description = contMatch[3];
      if (description.startsWith('"')) description = description.slice(1);
      if (description.endsWith('"')) description = description.slice(0, -1);
      
      if (description.startsWith('Fun Fact:')) {
        funFactsSet.add(description.replace('Fun Fact: ', ''));
      } else if (description.length > 10) {
        if (!dateToFacts[currentDate]) dateToFacts[currentDate] = [];
        dateToFacts[currentDate].push({
          type: eventType.toLowerCase().replace(/ /g, '_'),
          description: description
        });
      }
    }
  }
}

function parseFile2(content) {
  const lines = content.split('\n');
  let currentDate = null;
  
  for (const line of lines) {
    if (!line.trim() || line.startsWith('Date,#')) continue;
    
    const dateMatch = line.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d+)$/);
    if (dateMatch) {
      currentDate = `${dateMatch[1]} ${dateMatch[2]}`;
      continue;
    }
    
    const factMatch = line.match(/^(\d+),([^,]+),(.+)$/);
    if (factMatch && currentDate) {
      const eventType = factMatch[2];
      let description = factMatch[3];
      if (description.startsWith('"')) description = description.slice(1);
      if (description.endsWith('"')) description = description.slice(0, -1);
      
      if (description.startsWith('Fun Fact:')) {
        funFactsSet.add(description.replace('Fun Fact: ', ''));
      } else if (description.length > 10) {
        if (!dateToFacts[currentDate]) dateToFacts[currentDate] = [];
        const exists = dateToFacts[currentDate].some(f => f.description === description);
        if (!exists) {
          dateToFacts[currentDate].push({
            type: eventType.toLowerCase().replace(/ /g, '_'),
            description: description
          });
        }
      }
    }
  }
}

parseFile1(file1);
parseFile2(file2);

const funFactsArray = Array.from(funFactsSet).map(desc => ({ type: 'fun_fact', description: desc }));

console.log(`Total dates with events: ${Object.keys(dateToFacts).length}`);
console.log(`Total date-specific facts: ${Object.values(dateToFacts).reduce((a, b) => a + b.length, 0)}`);
console.log(`Total unique fun facts: ${funFactsArray.length}`);

const output = {
  dateEvents: dateToFacts,
  funFacts: funFactsArray
};

fs.writeFileSync(path.join(__dirname, '../client/src/data/chess-facts.json'), JSON.stringify(output, null, 2));
console.log('Written to client/src/data/chess-facts.json');
