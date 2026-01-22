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
  const headers = lines[0].split(',').map(h => h.trim());
  const records = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = parseCSVLine(lines[i]);
    const record = {};
    headers.forEach((header, idx) => {
      record[header] = values[idx]?.trim() || '';
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

// Clean phone number
function cleanPhone(phone) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length >= 10) return digits;
  return null;
}

async function main() {
  // Read Hosts Master CSV
  const csvPath = process.argv[2] || '/Users/geremiecamara/Downloads/Hosts - MASTER.csv';
  const csvContent = readFileSync(csvPath, 'utf-8');
  const masterData = parseCSV(csvContent);

  console.log(`Loaded ${masterData.length} records from Hosts Master\n`);

  // Create lookup by email (lowercase)
  const masterLookup = {};
  for (const record of masterData) {
    const email = record['Email']?.toLowerCase();
    if (email) {
      masterLookup[email] = record;
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
    const master = masterLookup[email];

    if (!master) {
      continue;
    }

    matchCount++;
    const updates = {};

    // Check Slack User ID
    const slackId = master['Slack User ID']?.trim();
    if (slackId && !host.slackId) {
      updates.slackId = slackId;
    }

    // Check Host Channel ID
    const slackChannelId = master['Host Channel ID']?.trim();
    if (slackChannelId && !host.slackChannelId) {
      updates.slackChannelId = slackChannelId;
    }

    // Check phone
    const masterPhone = cleanPhone(master['Phone']);
    if (masterPhone && (!host.phone || host.phone.length < 10)) {
      updates.phone = masterPhone;
    }

    // Check name - parse from master
    const nameParts = master['ame']?.trim().split(' ') || []; // Note: header is 'ame' not 'Name'
    if (nameParts.length >= 2) {
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ');

      if (firstName && (!host.firstName || host.firstName.length < 2)) {
        updates.firstName = firstName;
      }
      if (lastName && (!host.lastName || host.lastName.length < 2)) {
        updates.lastName = lastName;
      }
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
    } else {
      console.log(`--- ${host.firstName} ${host.lastName} (${email}) --- No updates needed`);
    }
  }

  console.log(`\n========================================`);
  console.log(`Matched: ${matchCount} users`);
  console.log(`Updated: ${updateCount} users`);
}

main().catch(console.error);
