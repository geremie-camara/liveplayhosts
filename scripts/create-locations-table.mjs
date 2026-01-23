import { readFileSync, existsSync } from 'fs';
import { DynamoDBClient, CreateTableCommand, DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

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
  if (process.env[key]) {
    return process.env[key];
  }
  const match = envContent.match(new RegExp(`${key}=(.+)`));
  return match ? match[1].trim() : null;
};

// Validate required credentials
const accessKeyId = getEnv('S3_ACCESS_KEY_ID');
const secretAccessKey = getEnv('S3_SECRET_ACCESS_KEY');

if (!accessKeyId || !secretAccessKey) {
  console.error('Error: AWS credentials not found.');
  console.error('Please create a .env.local file with S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY');
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

const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = 'liveplayhosts-locations';

// Initial locations to seed
const initialLocations = [
  { name: 'Los Angeles', country: 'United States' },
  { name: 'London', country: 'United Kingdom' },
  { name: 'Las Vegas', country: 'United States' },
  { name: 'Poland', country: 'Poland' },
  { name: 'San Francisco', country: 'United States' },
];

async function tableExists() {
  try {
    await client.send(new DescribeTableCommand({ TableName: TABLE_NAME }));
    return true;
  } catch (error) {
    if (error.name === 'ResourceNotFoundException') {
      return false;
    }
    throw error;
  }
}

async function waitForTable() {
  console.log('Waiting for table to be active...');
  let attempts = 0;
  while (attempts < 30) {
    try {
      const response = await client.send(new DescribeTableCommand({ TableName: TABLE_NAME }));
      if (response.Table?.TableStatus === 'ACTIVE') {
        console.log('Table is active!\n');
        return;
      }
    } catch (error) {
      // Table might not exist yet
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
    attempts++;
  }
  throw new Error('Timeout waiting for table to become active');
}

async function createTable() {
  const exists = await tableExists();
  if (exists) {
    console.log(`Table ${TABLE_NAME} already exists`);
    return;
  }

  console.log(`Creating table ${TABLE_NAME}...`);

  const params = {
    TableName: TABLE_NAME,
    KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
    AttributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }],
    BillingMode: 'PAY_PER_REQUEST',
  };

  await client.send(new CreateTableCommand(params));
  console.log(`Table ${TABLE_NAME} created`);

  await waitForTable();
}

async function seedLocations() {
  console.log('Seeding initial locations...\n');

  const now = new Date().toISOString();

  for (const location of initialLocations) {
    const id = `loc-${location.name.toLowerCase().replace(/\s+/g, '-')}`;

    const item = {
      id,
      name: location.name,
      country: location.country,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: item,
        ConditionExpression: 'attribute_not_exists(id)',
      }));
      console.log(`  Added: ${location.name}, ${location.country}`);
    } catch (error) {
      if (error.name === 'ConditionalCheckFailedException') {
        console.log(`  Skipped (exists): ${location.name}, ${location.country}`);
      } else {
        throw error;
      }
    }
  }
}

async function main() {
  console.log('Setting up Locations table...\n');

  await createTable();
  await seedLocations();

  console.log('\nDone!');
  console.log('\nLocations table created with initial data:');
  initialLocations.forEach(loc => {
    console.log(`  - ${loc.name} (${loc.country})`);
  });
}

main().catch(console.error);
