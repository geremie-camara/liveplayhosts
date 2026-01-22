import { readFileSync } from 'fs';
import { DynamoDBClient, CreateTableCommand, DescribeTableCommand } from '@aws-sdk/client-dynamodb';

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

// Table definitions
const tables = [
  {
    TableName: 'liveplayhosts-courses',
    KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
    AttributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }],
  },
  {
    TableName: 'liveplayhosts-sections',
    KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
    AttributeDefinitions: [
      { AttributeName: 'id', AttributeType: 'S' },
      { AttributeName: 'courseId', AttributeType: 'S' },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'courseId-index',
        KeySchema: [{ AttributeName: 'courseId', KeyType: 'HASH' }],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
  },
  {
    TableName: 'liveplayhosts-lessons',
    KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
    AttributeDefinitions: [
      { AttributeName: 'id', AttributeType: 'S' },
      { AttributeName: 'courseId', AttributeType: 'S' },
      { AttributeName: 'sectionId', AttributeType: 'S' },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'courseId-index',
        KeySchema: [{ AttributeName: 'courseId', KeyType: 'HASH' }],
        Projection: { ProjectionType: 'ALL' },
      },
      {
        IndexName: 'sectionId-index',
        KeySchema: [{ AttributeName: 'sectionId', KeyType: 'HASH' }],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
  },
  {
    TableName: 'liveplayhosts-quizzes',
    KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
    AttributeDefinitions: [
      { AttributeName: 'id', AttributeType: 'S' },
      { AttributeName: 'lessonId', AttributeType: 'S' },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'lessonId-index',
        KeySchema: [{ AttributeName: 'lessonId', KeyType: 'HASH' }],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
  },
  {
    TableName: 'liveplayhosts-faqs',
    KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
    AttributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }],
  },
  {
    TableName: 'liveplayhosts-training-progress',
    KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
    AttributeDefinitions: [
      { AttributeName: 'id', AttributeType: 'S' },
      { AttributeName: 'oduserId', AttributeType: 'S' },
      { AttributeName: 'courseId', AttributeType: 'S' },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'oduserId-index',
        KeySchema: [{ AttributeName: 'oduserId', KeyType: 'HASH' }],
        Projection: { ProjectionType: 'ALL' },
      },
      {
        IndexName: 'courseId-index',
        KeySchema: [{ AttributeName: 'courseId', KeyType: 'HASH' }],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
  },
  {
    TableName: 'liveplayhosts-quiz-attempts',
    KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
    AttributeDefinitions: [
      { AttributeName: 'id', AttributeType: 'S' },
      { AttributeName: 'oduserId', AttributeType: 'S' },
      { AttributeName: 'quizId', AttributeType: 'S' },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'oduserId-index',
        KeySchema: [{ AttributeName: 'oduserId', KeyType: 'HASH' }],
        Projection: { ProjectionType: 'ALL' },
      },
      {
        IndexName: 'quizId-index',
        KeySchema: [{ AttributeName: 'quizId', KeyType: 'HASH' }],
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
  console.log('Creating DynamoDB tables for Training/LMS...\n');

  for (const table of tables) {
    await createTable(table);
  }

  console.log('\nDone!');
}

main().catch(console.error);
