import { readFileSync } from 'fs';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, DeleteCommand, PutCommand } from '@aws-sdk/lib-dynamodb';

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
const HOSTS_TABLE = 'liveplayhosts-hosts';
const AVAILABILITY_TABLE = 'liveplayhosts-availability';

async function main() {
  console.log('=== Fix Clerk UserIds in Availability Table ===\n');

  // Get all hosts
  const hostsResult = await dynamoDb.send(new ScanCommand({ TableName: HOSTS_TABLE }));
  const hosts = hostsResult.Items || [];

  // Build lookup maps
  const hostsByClerkId = new Map();
  const hostIds = new Set();

  for (const host of hosts) {
    if (host.clerkUserId) {
      hostsByClerkId.set(host.clerkUserId, host);
    }
    hostIds.add(host.id);
  }

  console.log(`Found ${hosts.length} hosts`);
  console.log(`  - ${hostsByClerkId.size} have clerkUserId\n`);

  // Get all availability records
  const availResult = await dynamoDb.send(new ScanCommand({ TableName: AVAILABILITY_TABLE }));
  const availRecords = availResult.Items || [];

  console.log(`Found ${availRecords.length} availability records\n`);

  // Find records with Clerk userIds (not host.ids)
  const recordsToFix = [];
  for (const avail of availRecords) {
    // If userId is NOT a host.id, it might be a Clerk userId
    if (!hostIds.has(avail.userId)) {
      // Check if it's a Clerk userId
      const host = hostsByClerkId.get(avail.userId);
      if (host) {
        recordsToFix.push({ avail, host });
      } else {
        console.log(`WARNING: Orphan record with unknown userId: ${avail.userId}`);
      }
    }
  }

  console.log(`Found ${recordsToFix.length} records to fix:\n`);

  if (recordsToFix.length === 0) {
    console.log('No records need fixing!');
    return;
  }

  for (const { avail, host } of recordsToFix) {
    console.log(`  ${host.firstName} ${host.lastName}`);
    console.log(`    Old userId (Clerk): ${avail.userId}`);
    console.log(`    New userId (host.id): ${host.id}\n`);
  }

  // Perform the migration
  console.log('=== Migrating Records ===\n');

  for (const { avail, host } of recordsToFix) {
    try {
      // Delete old record (with Clerk userId as key)
      await dynamoDb.send(new DeleteCommand({
        TableName: AVAILABILITY_TABLE,
        Key: { userId: avail.userId },
      }));

      // Create new record with host.id as userId
      const newRecord = {
        ...avail,
        userId: host.id,
        updatedAt: new Date().toISOString(),
      };

      await dynamoDb.send(new PutCommand({
        TableName: AVAILABILITY_TABLE,
        Item: newRecord,
      }));

      console.log(`  [OK] ${host.firstName} ${host.lastName}`);
    } catch (error) {
      console.error(`  [ERROR] ${host.firstName} ${host.lastName}: ${error.message}`);
    }
  }

  console.log('\n=== Done ===');
}

main().catch(console.error);
