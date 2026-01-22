import { readFileSync } from 'fs';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';

const envContent = readFileSync('.env.local', 'utf-8');
const getEnv = (key) => {
  const match = envContent.match(new RegExp(`${key}=(.+)`));
  return match ? match[1].trim() : null;
};

const client = new DynamoDBClient({
  region: 'us-west-2',
  credentials: {
    accessKeyId: getEnv('S3_ACCESS_KEY_ID'),
    secretAccessKey: getEnv('S3_SECRET_ACCESS_KEY'),
  },
});
const dynamoDb = DynamoDBDocumentClient.from(client);

async function main() {
  const result = await dynamoDb.send(new ScanCommand({ TableName: 'liveplayhosts-hosts' }));
  const hosts = result.Items || [];

  const withSlack = hosts.filter(h => h.slackId);
  const withoutSlack = hosts.filter(h => h.slackId === undefined || h.slackId === null || h.slackId === '');

  console.log('Users WITH slackId:', withSlack.length);
  console.log('Users WITHOUT slackId:', withoutSlack.length);
  console.log('\nUsers missing slackId:');
  withoutSlack.forEach(h => console.log('  -', h.firstName, h.lastName, '(' + h.email + ')'));
}
main();
