import { readFileSync, existsSync } from 'fs';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';

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

const docClient = DynamoDBDocumentClient.from(client);

// First, let's scan to see all items and their odIndex values
console.log('=== SCAN all items ===');
const scanResult = await docClient.send(new ScanCommand({
  TableName: 'liveplayhosts-availability-changelog',
  Limit: 10,
}));

console.log('Scan found', scanResult.Count, 'items');
scanResult.Items?.forEach(item => {
  console.log('  - id:', item.id);
  console.log('    odIndex:', item.odIndex);
  console.log('    hostName:', item.hostName);
  console.log('    createdAt:', item.createdAt);
});

// Now try the query
console.log('\n=== QUERY with odIndex=ALL ===');
try {
  const queryResult = await docClient.send(new QueryCommand({
    TableName: 'liveplayhosts-availability-changelog',
    IndexName: 'odIndex-createdAt-index',
    KeyConditionExpression: 'odIndex = :odIndex',
    ExpressionAttributeValues: {
      ':odIndex': 'ALL',
    },
    ScanIndexForward: false,
    Limit: 50,
  }));

  console.log('Query found', queryResult.Count, 'items');
  queryResult.Items?.forEach(item => {
    console.log('  -', item.hostName, '-', item.changeType, '-', item.createdAt);
  });
} catch (error) {
  console.error('Query error:', error.message);
}
