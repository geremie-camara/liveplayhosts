import { readFileSync, existsSync } from 'fs';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';

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

async function main() {
  // Get recent broadcasts
  console.log('=== Recent Broadcasts ===\n');
  const broadcastResult = await docClient.send(new ScanCommand({
    TableName: 'liveplayhosts-broadcasts',
  }));

  const broadcasts = (broadcastResult.Items || [])
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5);

  for (const b of broadcasts) {
    console.log(`ID: ${b.id}`);
    console.log(`Title: ${b.title}`);
    console.log(`Status: ${b.status}`);
    console.log(`Channels: Slack=${b.channels?.slack}, Email=${b.channels?.email}, SMS=${b.channels?.sms}`);
    console.log(`Target User IDs: ${b.targetUserIds?.join(', ') || '(none)'}`);
    console.log(`Created: ${b.createdAt}`);
    if (b.stats) {
      console.log(`Stats: ${JSON.stringify(b.stats)}`);
    }
    console.log('---');
  }

  // Get recent deliveries
  console.log('\n=== Recent Deliveries ===\n');
  const deliveryResult = await docClient.send(new ScanCommand({
    TableName: 'liveplayhosts-broadcast-deliveries',
  }));

  const deliveries = (deliveryResult.Items || [])
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 10);

  for (const d of deliveries) {
    console.log(`Delivery ID: ${d.id}`);
    console.log(`User: ${d.userName} (${d.userId})`);
    console.log(`Slack: ${JSON.stringify(d.slack)}`);
    console.log(`Email: ${JSON.stringify(d.email)}`);
    console.log(`SMS: ${JSON.stringify(d.sms)}`);
    console.log(`Created: ${d.createdAt}`);
    console.log('---');
  }
}

main().catch(console.error);
