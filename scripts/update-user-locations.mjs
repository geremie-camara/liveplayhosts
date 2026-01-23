import { readFileSync, existsSync } from 'fs';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

// Try to read env file
let envContent = '';
const envFiles = ['.env.local', '.env', '.env.development.local', '.env.development'];
for (const file of envFiles) {
  if (existsSync(file)) {
    envContent = readFileSync(file, 'utf-8');
    console.log(`Using env file: ${file}\n`);
    break;
  }
}

const getEnv = (key) => {
  if (process.env[key]) return process.env[key];
  const match = envContent.match(new RegExp(`${key}=(.+)`));
  return match ? match[1].trim() : null;
};

const accessKeyId = getEnv('S3_ACCESS_KEY_ID');
const secretAccessKey = getEnv('S3_SECRET_ACCESS_KEY');

if (!accessKeyId || !secretAccessKey) {
  console.error('Error: AWS credentials not found.');
  process.exit(1);
}

const client = new DynamoDBClient({
  region: getEnv('S3_REGION') || 'us-west-2',
  credentials: { accessKeyId, secretAccessKey },
});
const docClient = DynamoDBDocumentClient.from(client);

// Location aliases for matching (be strict to avoid false positives)
const locationAliases = {
  'Los Angeles': ['los angeles', 'hollywood', 'beverly hills', 'santa monica', 'burbank', 'glendale', 'pasadena', 'long beach', 'culver city', 'west hollywood', 'malibu', 'woodland hills', 'sherman oaks', 'studio city', 'north hollywood', 'encino', 'van nuys', 'toluca lake', 'west los angeles', 'westwood', 'brentwood', 'pacific palisades', 'venice', 'mar vista', 'playa del rey', 'el segundo', 'redondo beach', 'manhattan beach', 'torrance', 'hawthorne', 'inglewood', 'compton', 'downey', 'norwalk', 'whittier', 'pomona', 'monrovia', 'arcadia', 'alhambra', 'monterey park', 'east los angeles', 'huntington park', 'south gate', 'bell gardens', 'montebello', 'pico rivera', 'la mirada', 'cerritos', 'lakewood', 'bellflower', 'paramount', 'lynwood', 'carson', 'gardena', 'lawndale', 'el monte', 'azusa', 'covina', 'west covina', 'glendora', 'claremont', 'upland', 'rancho cucamonga', 'fontana', 'rialto', 'san bernardino', 'riverside', 'corona', 'ontario', 'chino', 'chino hills', 'diamond bar', 'walnut', 'rowland heights', 'hacienda heights', 'la puente', 'baldwin park', 'irwindale', 'duarte', 'san dimas', 'la verne', 'northridge', 'chatsworth', 'granada hills', 'porter ranch', 'sylmar', 'san fernando', 'pacoima', 'sun valley', 'tujunga', 'la crescenta', 'la canada', 'altadena', 'south pasadena', 'san marino', 'temple city', 'rosemead', 'el monte', 'calabasas', 'agoura hills', 'westlake village', 'thousand oaks', 'simi valley', 'moorpark', 'camarillo', 'oxnard', 'ventura', 'santa clarita', 'valencia', 'newhall', 'canyon country', 'palmdale', 'lancaster', 'victorville', 'hesperia', 'apple valley', 'adelanto', 'barstow'],
  'New York': ['new york', 'nyc', 'manhattan', 'brooklyn', 'queens', 'bronx', 'staten island', 'harlem', 'long island', 'jersey city', 'hoboken', 'newark'],
  'San Francisco': ['san francisco', 'oakland', 'berkeley', 'san jose', 'palo alto', 'silicon valley', 'bay area', 'mountain view', 'sunnyvale', 'santa clara', 'fremont', 'hayward', 'richmond', 'daly city', 'san mateo', 'redwood city', 'menlo park', 'cupertino', 'milpitas', 'pleasanton', 'livermore', 'walnut creek', 'concord', 'antioch', 'vallejo', 'fairfield', 'napa', 'santa rosa', 'petaluma', 'novato', 'san rafael', 'sausalito', 'mill valley', 'tiburon', 'larkspur', 'corte madera'],
  'Las Vegas': ['las vegas', 'vegas', 'henderson', 'north las vegas', 'summerlin', 'paradise', 'spring valley', 'enterprise', 'sunrise manor', 'whitney', 'winchester'],
  'London': ['london', 'united kingdom', 'england', 'britain', 'uk'],
  'Poland': ['poland', 'warsaw', 'krakow', 'kraków', 'gdansk', 'wroclaw', 'poznan', 'łódź', 'lodz', 'katowice', 'lublin', 'bialystok', 'gdynia', 'szczecin', 'bydgoszcz', 'torun'],
  'Tokyo': ['tokyo', 'japan', 'shibuya', 'shinjuku', 'osaka', 'kyoto', 'yokohama', 'nagoya', 'sapporo', 'fukuoka', 'kobe', 'kawasaki', 'hiroshima'],
  'Manila': ['manila', 'philippines', 'quezon city', 'makati', 'cebu', 'davao', 'taguig', 'pasig', 'pasay', 'paranaque', 'las pinas', 'muntinlupa', 'caloocan', 'malabon', 'navotas', 'valenzuela', 'marikina', 'san juan', 'mandaluyong'],
  'Jakarta': ['jakarta', 'indonesia', 'bali', 'surabaya', 'bandung', 'medan', 'semarang', 'makassar', 'palembang', 'tangerang', 'depok', 'bekasi', 'bogor'],
};

function findMatchingLocation(host) {
  // Collect city field only (most reliable)
  const city = (host.address?.city || host.city || '').toLowerCase().trim();

  if (!city) return null;

  // Check each location's aliases - be strict, only exact matches
  for (const [locationName, aliases] of Object.entries(locationAliases)) {
    for (const alias of aliases) {
      // Exact match only (city must equal alias)
      if (city === alias) {
        return locationName;
      }
    }
  }

  return null;
}

async function main() {
  console.log('Fetching locations from database...');

  // Get all locations
  const locationsResult = await docClient.send(new ScanCommand({
    TableName: 'liveplayhosts-locations',
  }));
  const locations = locationsResult.Items || [];
  console.log(`Found ${locations.length} locations: ${locations.map(l => l.name).join(', ')}\n`);

  console.log('Fetching all users...');

  // Get all hosts
  const hostsResult = await docClient.send(new ScanCommand({
    TableName: 'liveplayhosts-hosts',
  }));
  const hosts = hostsResult.Items || [];
  console.log(`Found ${hosts.length} users\n`);

  let updated = 0;
  let skipped = 0;
  let alreadySet = 0;
  let noMatch = 0;

  console.log('Processing users...\n');
  console.log('-'.repeat(80));

  for (const host of hosts) {
    const name = `${host.firstName || ''} ${host.lastName || ''}`.trim();

    // Skip if location is already set to a valid location
    if (host.location && locations.some(l => l.name === host.location)) {
      alreadySet++;
      continue;
    }

    const matchedLocation = findMatchingLocation(host);

    if (matchedLocation) {
      // Verify it's a valid location in our table
      if (!locations.some(l => l.name === matchedLocation)) {
        console.log(`  [SKIP] ${name}: Matched "${matchedLocation}" but not in locations table`);
        skipped++;
        continue;
      }

      // Update the user
      try {
        await docClient.send(new UpdateCommand({
          TableName: 'liveplayhosts-hosts',
          Key: { id: host.id },
          UpdateExpression: 'SET #loc = :location, updatedAt = :now',
          ExpressionAttributeNames: { '#loc': 'location' },
          ExpressionAttributeValues: {
            ':location': matchedLocation,
            ':now': new Date().toISOString(),
          },
        }));

        const addressInfo = [host.address?.city, host.address?.state].filter(Boolean).join(', ') || host.location || 'no address';
        console.log(`  [UPDATED] ${name}: "${addressInfo}" -> ${matchedLocation}`);
        updated++;
      } catch (err) {
        console.error(`  [ERROR] ${name}: ${err.message}`);
      }
    } else {
      const addressInfo = [host.address?.city, host.address?.state].filter(Boolean).join(', ') || host.location || '';
      if (addressInfo) {
        console.log(`  [NO MATCH] ${name}: "${addressInfo}"`);
      }
      noMatch++;
    }
  }

  console.log('-'.repeat(80));
  console.log('\nSummary:');
  console.log(`  Updated:     ${updated}`);
  console.log(`  Already set: ${alreadySet}`);
  console.log(`  No match:    ${noMatch}`);
  console.log(`  Skipped:     ${skipped}`);
  console.log(`  Total:       ${hosts.length}`);
}

main().catch(console.error);
