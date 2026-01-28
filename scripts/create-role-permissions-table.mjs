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

// Table definition for Role Permissions
// Simple PK: role (String) — one record per role
const table = {
  TableName: 'liveplayhosts-role-permissions',
  KeySchema: [
    { AttributeName: 'role', KeyType: 'HASH' },
  ],
  AttributeDefinitions: [
    { AttributeName: 'role', AttributeType: 'S' },
  ],
  ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
};

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

async function createTable() {
  console.log('Creating Role Permissions DynamoDB table...\n');

  if (await tableExists(table.TableName)) {
    console.log(`  Table ${table.TableName} already exists, skipping.`);
  } else {
    try {
      await client.send(new CreateTableCommand(table));
      console.log(`  Created table: ${table.TableName}`);
    } catch (error) {
      console.error(`  Failed to create ${table.TableName}:`, error.message);
    }
  }

  console.log('\nDone!');
}

createTable();
