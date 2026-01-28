import { readFileSync, existsSync } from 'fs';
import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';

let envContent = '';
const envFiles = ['.env.local', '.env'];
for (const file of envFiles) {
  if (existsSync(file)) {
    envContent = readFileSync(file, 'utf-8');
    break;
  }
}

const getEnv = (key) => {
  if (process.env[key]) return process.env[key];
  const match = envContent.match(new RegExp(`${key}=(.+)`));
  return match ? match[1].trim() : null;
};

const client = new DynamoDBClient({
  region: getEnv('S3_REGION') || 'us-west-2',
  credentials: {
    accessKeyId: getEnv('S3_ACCESS_KEY_ID'),
    secretAccessKey: getEnv('S3_SECRET_ACCESS_KEY'),
  },
});

const result = await client.send(new ScanCommand({
  TableName: 'liveplayhosts-availability-changelog',
  Limit: 10,
}));

console.log('Items in changelog table:', result.Count);
if (result.Items && result.Items.length > 0) {
  result.Items.forEach(item => {
    const unmarshalled = unmarshall(item);
    console.log('\n---');
    console.log('Host:', unmarshalled.hostName, '(' + unmarshalled.hostEmail + ')');
    console.log('Type:', unmarshalled.changeType);
    console.log('Created:', unmarshalled.createdAt);
  });
} else {
  console.log('No items found - the table is empty');
}
