import { readFileSync } from 'fs';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

// Read .env.local
const envContent = readFileSync('.env.local', 'utf-8');
const getEnv = (key) => {
  const match = envContent.match(new RegExp(`${key}=(.+)`));
  return match ? match[1].trim() : null;
};

// Setup DynamoDB
const client = new DynamoDBClient({
  region: 'us-west-2',
  credentials: {
    accessKeyId: getEnv('S3_ACCESS_KEY_ID'),
    secretAccessKey: getEnv('S3_SECRET_ACCESS_KEY'),
  },
});
const dynamoDb = DynamoDBDocumentClient.from(client);
const TABLE_NAME = 'liveplayhosts-hosts';

// Parse CSV
function parseCSV(content) {
  const lines = content.split('\n');
  const headers = parseCSVLine(lines[0]);
  const records = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = parseCSVLine(lines[i]);
    const record = {};
    headers.forEach((header, idx) => {
      record[header.trim()] = values[idx]?.trim().replace(/^"|"$/g, '') || '';
    });
    records.push(record);
  }
  return records;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

// Convert date from MM/DD/YYYY to YYYY-MM-DD
function convertDate(dateStr) {
  if (!dateStr) return null;
  const match = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (match) {
    return `${match[3]}-${match[1]}-${match[2]}`;
  }
  return null;
}

// Clean phone number - keep just digits
function cleanPhone(phone) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length >= 10) return digits;
  return null;
}

async function main() {
  // Read Justworks CSV
  const csvPath = process.argv[2] || '/Users/geremiecamara/Downloads/Justworks - Live Play Mobile Census Report 01_22_2026.csv';
  const csvContent = readFileSync(csvPath, 'utf-8');
  const justworksData = parseCSV(csvContent);

  console.log(`Loaded ${justworksData.length} records from Justworks\n`);

  // Create lookup by work email
  const justworksLookup = {};
  for (const record of justworksData) {
    const email = record['Work Email']?.toLowerCase();
    if (email) {
      justworksLookup[email] = record;
    }
  }

  // Fetch all hosts from DynamoDB
  const result = await dynamoDb.send(new ScanCommand({ TableName: TABLE_NAME }));
  const hosts = result.Items || [];
  console.log(`Found ${hosts.length} hosts in database\n`);

  let matchCount = 0;
  let updateCount = 0;

  for (const host of hosts) {
    const email = host.email?.toLowerCase();
    const justworks = justworksLookup[email];

    if (!justworks) {
      continue;
    }

    matchCount++;
    const updates = {};

    // Check first name
    const jwFirstName = justworks['First Name']?.trim() || justworks['Preferred Name']?.trim();
    if (jwFirstName && (!host.firstName || host.firstName.length < 2)) {
      updates.firstName = jwFirstName;
    }

    // Check last name
    const jwLastName = justworks['Last Name']?.trim().replace(/^\(.*?\)\s*/, ''); // Remove parenthetical prefixes
    if (jwLastName && (!host.lastName || host.lastName.length < 2)) {
      updates.lastName = jwLastName;
    }

    // Check phone
    const jwPhone = cleanPhone(justworks['Cell Phone']) || cleanPhone(justworks['Home Phone']);
    if (jwPhone && (!host.phone || host.phone.length < 10)) {
      updates.phone = jwPhone;
    }

    // Check birthday
    const jwBirthday = convertDate(justworks['Date of Birth']);
    if (jwBirthday && !host.birthday) {
      updates.birthday = jwBirthday;
    }

    // Check address
    const jwStreet = justworks['Street Address 1'];
    const jwCity = justworks['City'];
    const jwState = justworks['State'];
    const jwZip = justworks['Postal Code'];

    if (jwStreet && jwCity && (!host.address?.street || !host.address?.city)) {
      updates.address = {
        street: [jwStreet, justworks['Street Address 2']].filter(Boolean).join(' ').trim(),
        city: jwCity,
        state: jwState || '',
        zip: jwZip || '',
      };
    }

    // Check location
    if (jwCity && jwState && !host.location) {
      updates.location = `${jwCity}, ${jwState}`;
    }

    if (Object.keys(updates).length > 0) {
      console.log(`\n--- ${host.firstName} ${host.lastName} (${email}) ---`);
      console.log('Updates:', JSON.stringify(updates, null, 2));

      // Build update expression
      const updateFields = [];
      const exprNames = {};
      const exprValues = { ':updatedAt': new Date().toISOString() };

      for (const [key, value] of Object.entries(updates)) {
        updateFields.push(`#${key} = :${key}`);
        exprNames[`#${key}`] = key;
        exprValues[`:${key}`] = value;
      }

      updateFields.push('#updatedAt = :updatedAt');
      exprNames['#updatedAt'] = 'updatedAt';

      await dynamoDb.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { id: host.id },
        UpdateExpression: `SET ${updateFields.join(', ')}`,
        ExpressionAttributeNames: exprNames,
        ExpressionAttributeValues: exprValues,
      }));

      updateCount++;
      console.log('✓ Updated');
    }
  }

  console.log(`\n========================================`);
  console.log(`Matched: ${matchCount} users`);
  console.log(`Updated: ${updateCount} users`);
}

main().catch(console.error);
