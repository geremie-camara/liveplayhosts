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
  const searchName = process.argv[2] || 'geremie';

  console.log(`Searching for users matching: "${searchName}"\n`);

  const result = await docClient.send(new ScanCommand({
    TableName: 'liveplayhosts-hosts',
  }));

  const hosts = result.Items || [];

  const matches = hosts.filter(h => {
    const fullName = `${h.firstName || ''} ${h.lastName || ''}`.toLowerCase();
    return fullName.includes(searchName.toLowerCase());
  });

  if (matches.length === 0) {
    console.log('No users found matching that name.');
    return;
  }

  console.log(`Found ${matches.length} user(s):\n`);
  console.log('='.repeat(60));

  for (const host of matches) {
    console.log(`Name:            ${host.firstName} ${host.lastName}`);
    console.log(`ID:              ${host.id}`);
    console.log(`Email:           ${host.email}`);
    console.log(`Phone:           ${host.phone || '(not set)'}`);
    console.log(`Role:            ${host.role}`);
    console.log(`Slack ID:        ${host.slackId || '(not set)'}`);
    console.log(`Slack Channel:   ${host.slackChannelId || '(not set)'}`);
    console.log(`Location:        ${host.location || '(not set)'}`);
    console.log('='.repeat(60));
  }
}

main().catch(console.error);
