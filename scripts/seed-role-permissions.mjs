import { readFileSync, existsSync } from 'fs';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
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

const client = new DynamoDBClient({
  region: getEnv('S3_REGION') || 'us-west-2',
  credentials: { accessKeyId, secretAccessKey },
});
const dynamoDb = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

const TABLE_NAME = 'liveplayhosts-role-permissions';

// Hardcoded permission definitions (mirrors src/lib/roles.ts PERMISSIONS)
const PERMISSIONS = {
  viewDashboard: ['host', 'producer', 'talent', 'finance', 'hr', 'admin', 'owner'],
  viewBasicTraining: ['host', 'producer', 'talent', 'finance', 'hr', 'admin', 'owner'],
  viewAdvancedTraining: ['host', 'producer', 'talent', 'finance', 'hr', 'admin', 'owner'],
  viewAllTraining: ['talent', 'admin', 'owner'],
  manageTraining: ['talent', 'admin', 'owner'],
  viewTrainingAnalytics: ['producer', 'talent', 'finance', 'hr', 'admin', 'owner'],
  viewSchedule: ['host', 'producer', 'talent', 'finance', 'hr', 'admin', 'owner'],
  manageSchedule: ['producer', 'talent', 'admin', 'owner'],
  manageUsers: ['talent', 'hr', 'admin', 'owner'],
  viewAnalytics: ['producer', 'talent', 'finance', 'hr', 'admin', 'owner'],
  manageContent: ['talent', 'admin', 'owner'],
  manageBroadcasts: ['talent', 'admin', 'owner'],
  viewMessages: ['host', 'producer', 'talent', 'finance', 'hr', 'admin', 'owner'],
  manageLocations: ['talent', 'admin', 'owner'],
  manageCallOuts: ['producer', 'talent', 'admin', 'owner'],
  manageHostPriority: ['talent', 'admin', 'owner'],
  manageAvailability: ['producer', 'talent', 'admin', 'owner'],
  viewFinance: ['host', 'producer', 'talent', 'finance', 'hr', 'admin', 'owner'],
};

// Permission features (mirrors src/lib/security-types.ts)
const FEATURES = [
  { key: 'dashboard', section: 'user', readOnly: true },
  { key: 'messages', section: 'user', readOnly: true },
  { key: 'availability', section: 'user', readOnly: false },
  { key: 'training', section: 'user', readOnly: true },
  { key: 'schedule', section: 'user', readOnly: true },
  { key: 'finance', section: 'user', readOnly: false },
  { key: 'profile', section: 'user', readOnly: false },
  { key: 'directory', section: 'user', readOnly: true },
  { key: 'manageUsers', section: 'admin', readOnly: false },
  { key: 'callOuts', section: 'admin', readOnly: false },
  { key: 'hostPriority', section: 'admin', readOnly: false },
  { key: 'hostAvailability', section: 'admin', readOnly: false },
  { key: 'availabilityChangelog', section: 'admin', readOnly: true },
  { key: 'calendarSync', section: 'admin', readOnly: false },
  { key: 'broadcasts', section: 'admin', readOnly: false },
  { key: 'trainingContent', section: 'admin', readOnly: false },
  { key: 'locations', section: 'admin', readOnly: false },
  { key: 'analytics', section: 'admin', readOnly: true },
];

const DEFAULT_DISPLAY_GROUPS = {
  host: 'Hosts',
  producer: 'Producers',
  talent: 'Management',
  admin: 'Management',
  finance: 'Support',
  hr: 'Support',
};

// Build permissions for a role by converting hardcoded PERMISSIONS
function buildPermissions(role) {
  const perms = {};

  for (const feature of FEATURES) {
    let hasRead = false;
    let hasWrite = false;

    switch (feature.key) {
      case 'dashboard':
        hasRead = PERMISSIONS.viewDashboard.includes(role);
        break;
      case 'messages':
        hasRead = PERMISSIONS.viewMessages.includes(role);
        break;
      case 'availability':
        hasRead = PERMISSIONS.viewDashboard.includes(role);
        hasWrite = PERMISSIONS.viewDashboard.includes(role);
        break;
      case 'training':
        hasRead = PERMISSIONS.viewBasicTraining.includes(role);
        break;
      case 'schedule':
        hasRead = PERMISSIONS.viewSchedule.includes(role);
        break;
      case 'finance':
        hasRead = PERMISSIONS.viewFinance.includes(role);
        hasWrite = PERMISSIONS.viewFinance.includes(role);
        break;
      case 'profile':
        hasRead = PERMISSIONS.viewDashboard.includes(role);
        hasWrite = PERMISSIONS.viewDashboard.includes(role);
        break;
      case 'directory':
        hasRead = PERMISSIONS.viewDashboard.includes(role);
        break;
      case 'manageUsers':
        hasRead = PERMISSIONS.manageUsers.includes(role);
        hasWrite = PERMISSIONS.manageUsers.includes(role);
        break;
      case 'callOuts':
        hasRead = PERMISSIONS.manageCallOuts.includes(role);
        hasWrite = PERMISSIONS.manageCallOuts.includes(role);
        break;
      case 'hostPriority':
        hasRead = PERMISSIONS.manageHostPriority.includes(role);
        hasWrite = PERMISSIONS.manageHostPriority.includes(role);
        break;
      case 'hostAvailability':
        hasRead = PERMISSIONS.manageAvailability.includes(role);
        hasWrite = PERMISSIONS.manageAvailability.includes(role);
        break;
      case 'availabilityChangelog':
        hasRead = PERMISSIONS.manageAvailability.includes(role);
        break;
      case 'calendarSync':
        hasRead = PERMISSIONS.manageSchedule.includes(role);
        hasWrite = PERMISSIONS.manageSchedule.includes(role);
        break;
      case 'broadcasts':
        hasRead = PERMISSIONS.manageBroadcasts.includes(role);
        hasWrite = PERMISSIONS.manageBroadcasts.includes(role);
        break;
      case 'trainingContent':
        hasRead = PERMISSIONS.viewAllTraining.includes(role);
        hasWrite = PERMISSIONS.manageTraining.includes(role);
        break;
      case 'locations':
        hasRead = PERMISSIONS.manageLocations.includes(role);
        hasWrite = PERMISSIONS.manageLocations.includes(role);
        break;
      case 'analytics':
        hasRead = PERMISSIONS.viewAnalytics.includes(role);
        break;
    }

    perms[feature.key] = { read: hasRead, write: hasWrite };
  }

  return perms;
}

async function seed() {
  const roles = ['host', 'producer', 'talent', 'finance', 'hr', 'admin'];
  const now = new Date().toISOString();

  console.log('Seeding role permissions...\n');

  for (const role of roles) {
    const item = {
      role,
      permissions: buildPermissions(role),
      displayGroup: DEFAULT_DISPLAY_GROUPS[role] || 'Hosts',
      updatedAt: now,
      updatedBy: 'seed-script',
      updatedByName: 'Seed Script',
    };

    try {
      await dynamoDb.send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: item,
        })
      );
      console.log(`  Seeded: ${role} (${DEFAULT_DISPLAY_GROUPS[role]})`);
    } catch (error) {
      console.error(`  Failed to seed ${role}:`, error.message);
    }
  }

  console.log('\nDone! Seeded permissions for', roles.length, 'roles.');
}

seed();
