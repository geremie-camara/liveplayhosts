#!/usr/bin/env node

/**
 * Creates the DynamoDB table for tracking host availability changes.
 *
 * Table: liveplayhosts-availability-changelog
 * - Primary Key: id (UUID)
 * - GSI: userId-createdAt-index (for querying by host)
 * - GSI: odIndex-createdAt-index (for querying all changes chronologically)
 *
 * Run: node scripts/create-availability-changelog-table.mjs
 */

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
  console.error('Please set S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY in .env.local');
  process.exit(1);
}

const client = new DynamoDBClient({
  region: getEnv('S3_REGION') || 'us-west-2',
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

const TABLE_NAME = 'liveplayhosts-availability-changelog';

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
  console.log(`Creating table: ${TABLE_NAME}`);

  const exists = await tableExists(TABLE_NAME);
  if (exists) {
    console.log(`Table ${TABLE_NAME} already exists, skipping...`);
    return;
  }

  const params = {
    TableName: TABLE_NAME,
    KeySchema: [
      { AttributeName: 'id', KeyType: 'HASH' },
    ],
    AttributeDefinitions: [
      { AttributeName: 'id', AttributeType: 'S' },
      { AttributeName: 'userId', AttributeType: 'S' },
      { AttributeName: 'createdAt', AttributeType: 'S' },
      { AttributeName: 'odIndex', AttributeType: 'S' },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'userId-createdAt-index',
        KeySchema: [
          { AttributeName: 'userId', KeyType: 'HASH' },
          { AttributeName: 'createdAt', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5,
        },
      },
      {
        IndexName: 'odIndex-createdAt-index',
        KeySchema: [
          { AttributeName: 'odIndex', KeyType: 'HASH' },
          { AttributeName: 'createdAt', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5,
        },
      },
    ],
    ProvisionedThroughput: {
      ReadCapacityUnits: 5,
      WriteCapacityUnits: 5,
    },
  };

  try {
    await client.send(new CreateTableCommand(params));
    console.log(`Table ${TABLE_NAME} created successfully!`);
  } catch (error) {
    console.error(`Error creating table ${TABLE_NAME}:`, error.message);
    throw error;
  }
}

async function main() {
  console.log('Creating availability changelog table...\n');

  try {
    await createTable();
    console.log('\nDone! Table created successfully.');
  } catch (error) {
    console.error('\nFailed to create table:', error.message);
    process.exit(1);
  }
}

main();
