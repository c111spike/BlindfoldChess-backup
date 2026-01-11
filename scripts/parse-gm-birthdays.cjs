const fs = require('fs');

// Read the raw wiki data
const rawData = fs.readFileSync('/tmp/grandmasters_raw.txt', 'utf8');

// Parse the wiki markup format
// Format: {{sortname|FirstName|LastName}}||BirthDate||DeathDate||TitleYear||{{Country}}
// or: {{sortname|FirstName|LastName||SortKey}}||...

const lines = rawData.split('\n');
const grandmasters = [];

// Country code mapping for display
const countryNames = {
  'USA': 'United States',
  'RUS': 'Russia',
  'UKR': 'Ukraine',
  'ARM': 'Armenia',
  'USSR': 'Soviet Union',
  'SWE': 'Sweden',
  'HUN': 'Hungary',
  'CUB': 'Cuba',
  'QAT': 'Qatar',
  'ISR': 'Israel',
  'EGY': 'Egypt',
  'TJK': 'Tajikistan',
  'GRE': 'Greece',
  'IND': 'India',
  'FRA': 'France',
  'TKM': 'Turkmenistan',
  'SRB': 'Serbia',
  'PHI': 'Philippines',
  'POR': 'Portugal',
  'DEU': 'Germany',
  'GER': 'Germany',
  'ISL': 'Iceland',
  'GEO': 'Georgia',
  'KAZ': 'Kazakhstan',
  'AZE': 'Azerbaijan',
  'CZE': 'Czech Republic',
  'IRL': 'Ireland',
  'PAR': 'Paraguay',
  'ROU': 'Romania',
  'ROM': 'Romania',
  'AUT': 'Austria',
  'IRI': 'Iran',
  'MDA': 'Moldova',
  'BLR': 'Belarus',
  'POL': 'Poland',
  'TUN': 'Tunisia',
  'ESP': 'Spain',
  'SLO': 'Slovenia',
  'ENG': 'England',
  'CAN': 'Canada',
  'BUL': 'Bulgaria',
  'FIN': 'Finland',
  'ARG': 'Argentina',
  'NOR': 'Norway',
  'ITA': 'Italy',
  'CRO': 'Croatia',
  'NZL': 'New Zealand',
  'BEL': 'Belgium',
  'VIE': 'Vietnam',
  'LUX': 'Luxembourg',
  'ALB': 'Albania',
  'NED': 'Netherlands',
  'MKD': 'North Macedonia',
  'PER': 'Peru',
  'CHN': 'China',
  'COL': 'Colombia',
  'CHL': 'Chile',
  'AND': 'Andorra',
  'BIH': 'Bosnia and Herzegovina',
  'MNE': 'Montenegro',
  'INA': 'Indonesia',
  'UZB': 'Uzbekistan',
  'LTU': 'Lithuania',
  'SUI': 'Switzerland',
  'TUR': 'Turkey',
  'SCO': 'Scotland',
  'WAL': 'Wales',
  'IRE': 'Ireland',
  'RSA': 'South Africa',
  'JPN': 'Japan',
  'MAS': 'Malaysia',
  'SGP': 'Singapore',
  'PHI': 'Philippines',
  'KOR': 'South Korea',
  'AUS': 'Australia',
  'BRA': 'Brazil',
  'VEN': 'Venezuela',
  'MEX': 'Mexico',
  'URU': 'Uruguay',
  'ECU': 'Ecuador',
  'BOL': 'Bolivia',
  'DOM': 'Dominican Republic',
  'PUR': 'Puerto Rico',
  'TRI': 'Trinidad and Tobago',
  'JAM': 'Jamaica',
  'CRC': 'Costa Rica',
  'PAN': 'Panama',
  'ESA': 'El Salvador',
  'GUA': 'Guatemala',
  'HON': 'Honduras',
  'NCA': 'Nicaragua',
  'CYP': 'Cyprus',
  'MAR': 'Morocco',
  'LAT': 'Latvia',
  'EST': 'Estonia',
  'LIE': 'Liechtenstein',
  'MON': 'Monaco',
  'MLT': 'Malta',
  'SMR': 'San Marino',
  'FAI': 'Faroe Islands',
  'DEN': 'Denmark',
  'BAN': 'Bangladesh',
  'PAK': 'Pakistan',
  'SRI': 'Sri Lanka',
  'NEP': 'Nepal',
  'AFG': 'Afghanistan',
  'MYA': 'Myanmar',
  'THA': 'Thailand',
  'CAM': 'Cambodia',
  'LAO': 'Laos',
  'MGL': 'Mongolia',
  'NGR': 'Nigeria',
  'KEN': 'Kenya',
  'UGA': 'Uganda',
  'ZIM': 'Zimbabwe',
  'ZAM': 'Zambia',
  'BOT': 'Botswana'
};

// Month names for formatting
const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                    'July', 'August', 'September', 'October', 'November', 'December'];

function parseDate(dateStr) {
  if (!dateStr || dateStr === '' || dateStr.includes('00.00')) return null;
  const parts = dateStr.split('.');
  if (parts.length !== 3) return null;
  const year = parseInt(parts[0]);
  const month = parseInt(parts[1]);
  const day = parseInt(parts[2]);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
  if (month === 0 || day === 0) return null;
  return { year, month, day };
}

function formatDateForFact(date) {
  return `${monthNames[date.month - 1]} ${date.day}, ${date.year}`;
}

function getMonthDayKey(date) {
  return `${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
}

for (const line of lines) {
  // Skip lines that don't have sortname
  if (!line.includes('{{sortname|')) continue;
  
  // Extract the sortname template
  const sortnameMatch = line.match(/\{\{sortname\|([^}]+)\}\}/);
  if (!sortnameMatch) continue;
  
  // Parse name from sortname|FirstName|LastName or sortname|FirstName|LastName||SortKey
  const nameParts = sortnameMatch[1].split('|');
  const firstName = nameParts[0] || '';
  const lastName = nameParts[1] || '';
  const fullName = `${firstName} ${lastName}`.trim();
  
  // Extract the data after sortname - split by ||
  let afterName = line.split('}}')[1] || '';
  // Remove leading || that comes from the wiki table format
  afterName = afterName.replace(/^\|\|/, '');
  const dataParts = afterName.split('||').map(p => p.replace(/^\|/, '').trim());
  
  // dataParts[0] = birth date, [1] = death date, [2] = title year, [3] = country
  const birthDateStr = dataParts[0] || '';
  const deathDateStr = dataParts[1] || '';
  const titleYear = dataParts[2] || '';
  const countryRaw = dataParts[3] || '';
  
  // Extract country code from {{XXX}} or {{flagicon|XXX}}
  let countryCode = '';
  const flagiconMatch = countryRaw.match(/\{\{flagicon\|(\w+)\}\}/);
  const simpleMatch = countryRaw.match(/\{\{(\w+)\}\}/);
  if (flagiconMatch) {
    countryCode = flagiconMatch[1];
  } else if (simpleMatch) {
    countryCode = simpleMatch[1];
  }
  
  const country = countryNames[countryCode] || countryCode;
  
  // Parse dates
  const birthDate = parseDate(birthDateStr);
  const deathDate = parseDate(deathDateStr);
  const gmYear = parseInt(titleYear) || null;
  
  if (fullName && (birthDate || deathDate)) {
    grandmasters.push({
      name: fullName,
      birthDate,
      deathDate,
      gmYear,
      country,
      countryCode
    });
  }
}

console.log(`Found ${grandmasters.length} grandmasters with dates`);

// Now organize facts by month-day
const factsByDate = {};

// Initialize all dates
for (let month = 1; month <= 12; month++) {
  const daysInMonth = new Date(2024, month, 0).getDate(); // 2024 is leap year
  for (let day = 1; day <= daysInMonth; day++) {
    const key = getMonthDayKey({ month, day });
    factsByDate[key] = [];
  }
}

// Add birth facts
for (const gm of grandmasters) {
  if (gm.birthDate && gm.birthDate.month >= 1 && gm.birthDate.month <= 12 && gm.birthDate.day >= 1 && gm.birthDate.day <= 31) {
    const key = getMonthDayKey(gm.birthDate);
    if (!factsByDate[key]) {
      console.log(`Warning: Invalid birth date key ${key} for ${gm.name}`);
      continue;
    }
    const yearStr = gm.birthDate.year;
    let fact = `${gm.name}`;
    if (gm.country) {
      fact += ` (${gm.country})`;
    }
    fact += ` was born on this day in ${yearStr}`;
    if (gm.gmYear) {
      fact += `. Became Grandmaster in ${gm.gmYear}.`;
    } else {
      fact += '.';
    }
    
    factsByDate[key].push({
      type: 'birthday',
      text: fact,
      year: yearStr,
      name: gm.name,
      source: 'Chess Fandom Wiki - List of Grandmasters'
    });
  }
}

// Add death facts
for (const gm of grandmasters) {
  if (gm.deathDate && gm.deathDate.month >= 1 && gm.deathDate.month <= 12 && gm.deathDate.day >= 1 && gm.deathDate.day <= 31) {
    const key = getMonthDayKey(gm.deathDate);
    if (!factsByDate[key]) {
      console.log(`Warning: Invalid death date key ${key} for ${gm.name}`);
      continue;
    }
    const yearStr = gm.deathDate.year;
    let fact = `Grandmaster ${gm.name}`;
    if (gm.country) {
      fact += ` (${gm.country})`;
    }
    fact += ` passed away on this day in ${yearStr}`;
    if (gm.birthDate) {
      fact += `, at age ${gm.deathDate.year - gm.birthDate.year}`;
    }
    fact += '.';
    
    factsByDate[key].push({
      type: 'death',
      text: fact,
      year: yearStr,
      name: gm.name,
      source: 'Chess Fandom Wiki - List of Grandmasters'
    });
  }
}

// Count stats
let totalFacts = 0;
let datesWithFacts = 0;
for (const key in factsByDate) {
  totalFacts += factsByDate[key].length;
  if (factsByDate[key].length > 0) datesWithFacts++;
}

console.log(`Total facts: ${totalFacts}`);
console.log(`Dates with facts: ${datesWithFacts}/366`);

// Output in the format expected by the component
const output = factsByDate;

fs.writeFileSync('client/src/data/chess-facts.json', JSON.stringify(output, null, 2));
console.log('Written to client/src/data/chess-facts.json');

// Show sample output
console.log('\nSample - January 8:');
console.log(JSON.stringify(factsByDate['01-08'], null, 2));
console.log('\nSample - December 11 (Anand birthday):');
console.log(JSON.stringify(factsByDate['12-11'], null, 2));
