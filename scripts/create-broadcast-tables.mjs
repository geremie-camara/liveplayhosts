import { readFileSync, existsSync } from 'fs';
import { DynamoDBClient, CreateTableCommand, DescribeTableCommand } from '@aws-sdk/client-dynamodb';

// Try to read env file (check multiple locations)
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
  // First check environment variables
  if (process.env[key]) {
    return process.env[key];
  }
  // Then check env file content
  const match = envContent.match(new RegExp(`${key}=(.+)`));
  return match ? match[1].trim() : null;
};

// Validate required credentials
const accessKeyId = getEnv('S3_ACCESS_KEY_ID');
const secretAccessKey = getEnv('S3_SECRET_ACCESS_KEY');

if (!accessKeyId || !secretAccessKey) {
  console.error('Error: AWS credentials not found.');
  console.error('Please create a .env.local file with S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY');
  console.error('Or set them as environment variables.');
  process.exit(1);
}

// Setup DynamoDB
const client = new DynamoDBClient({
  region: getEnv('S3_REGION') || 'us-west-2',
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

// Table definitions for Broadcast Messaging System
const tables = [
  {
    TableName: 'liveplayhosts-broadcasts',
    KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
    AttributeDefinitions: [
      { AttributeName: 'id', AttributeType: 'S' },
      { AttributeName: 'status', AttributeType: 'S' },
      { AttributeName: 'createdAt', AttributeType: 'S' },
      { AttributeName: 'scheduledAt', AttributeType: 'S' },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'status-createdAt-index',
        KeySchema: [
          { AttributeName: 'status', KeyType: 'HASH' },
          { AttributeName: 'createdAt', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
      {
        IndexName: 'status-scheduledAt-index',
        KeySchema: [
          { AttributeName: 'status', KeyType: 'HASH' },
          { AttributeName: 'scheduledAt', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
  },
  {
    TableName: 'liveplayhosts-broadcast-templates',
    KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
    AttributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }],
  },
  {
    TableName: 'liveplayhosts-broadcast-deliveries',
    KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
    AttributeDefinitions: [
      { AttributeName: 'id', AttributeType: 'S' },
      { AttributeName: 'broadcastId', AttributeType: 'S' },
      { AttributeName: 'userId', AttributeType: 'S' },
      { AttributeName: 'createdAt', AttributeType: 'S' },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'broadcastId-index',
        KeySchema: [{ AttributeName: 'broadcastId', KeyType: 'HASH' }],
        Projection: { ProjectionType: 'ALL' },
      },
      {
        IndexName: 'userId-createdAt-index',
        KeySchema: [
          { AttributeName: 'userId', KeyType: 'HASH' },
          { AttributeName: 'createdAt', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
  },
];

async function tableExists(tableName) {
  try {
    await client.send(new DescribeTableCommand({ TableName: tableName }));
    return true;
  } catch (error) {
    if (error.name === 'ResourceNotFoundException') {
      return false;
    }
    throw error;
  }
}

async function createTable(tableConfig) {
  const { TableName, KeySchema, AttributeDefinitions, GlobalSecondaryIndexes } = tableConfig;

  const exists = await tableExists(TableName);
  if (exists) {
    console.log(`✓ Table ${TableName} already exists`);
    return;
  }

  const params = {
    TableName,
    KeySchema,
    AttributeDefinitions,
    BillingMode: 'PAY_PER_REQUEST', // On-demand billing
  };

  if (GlobalSecondaryIndexes) {
    params.GlobalSecondaryIndexes = GlobalSecondaryIndexes.map((gsi) => ({
      ...gsi,
      Projection: gsi.Projection || { ProjectionType: 'ALL' },
    }));
  }

  try {
    await client.send(new CreateTableCommand(params));
    console.log(`✓ Created table ${TableName}`);
  } catch (error) {
    console.error(`✗ Failed to create table ${TableName}:`, error.message);
  }
}

async function main() {
  console.log('Creating DynamoDB tables for Broadcast Messaging System...\n');

  for (const table of tables) {
    await createTable(table);
  }

  console.log('\nDone!');
  console.log('\nTables created:');
  console.log('  - liveplayhosts-broadcasts (main broadcast messages)');
  console.log('  - liveplayhosts-broadcast-templates (reusable templates)');
  console.log('  - liveplayhosts-broadcast-deliveries (per-user delivery tracking)');
}

main().catch(console.error);
