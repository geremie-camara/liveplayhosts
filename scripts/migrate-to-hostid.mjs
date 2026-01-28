#!/usr/bin/env node
/**
 * Migration script: Convert userId (clerkUserId) to hostId (DynamoDB host.id)
 *
 * This script migrates data in the following tables:
 * - liveplayhosts-availability: userId -> hostId
 * - liveplayhosts-availability-changelog: userId -> hostId
 * - liveplayhosts-callouts: userId -> hostId
 * - liveplayhosts-training-progress: oduserId -> hostId
 *
 * IMPORTANT: Run this script AFTER deploying the code changes.
 * The DynamoDB tables need to have their primary keys updated first.
 */

import { readFileSync } from 'fs';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, PutCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';

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
const dynamoDb = DynamoDBDocumentClient.from(client);

const TABLES = {
  HOSTS: 'liveplayhosts-hosts',
  AVAILABILITY: 'liveplayhosts-availability',
  AVAILABILITY_CHANGELOG: 'liveplayhosts-availability-changelog',
  CALLOUTS: 'liveplayhosts-callouts',
  TRAINING_PROGRESS: 'liveplayhosts-training-progress',
};

// Fetch all hosts and create mapping
async function getHostMappings() {
  console.log('Fetching hosts...');
  const result = await dynamoDb.send(new ScanCommand({
    TableName: TABLES.HOSTS,
  }));

  const hosts = result.Items || [];
  console.log(`Found ${hosts.length} hosts`);

  // Create clerkUserId -> host.id mapping
  const clerkToHostId = new Map();
  for (const host of hosts) {
    if (host.clerkUserId) {
      clerkToHostId.set(host.clerkUserId, host.id);
    }
  }

  console.log(`Created mapping for ${clerkToHostId.size} hosts with clerkUserId\n`);
  return clerkToHostId;
}

// Migrate availability table
async function migrateAvailability(clerkToHostId) {
  console.log('=== Migrating Availability ===');

  const result = await dynamoDb.send(new ScanCommand({
    TableName: TABLES.AVAILABILITY,
  }));

  const items = result.Items || [];
  console.log(`Found ${items.length} availability records`);

  let migrated = 0;
  let skipped = 0;
  let alreadyMigrated = 0;

  for (const item of items) {
    // Check if already migrated (has hostId instead of userId)
    if (item.hostId && !item.userId) {
      alreadyMigrated++;
      continue;
    }

    // Get the userId (which was clerkUserId)
    const clerkUserId = item.userId;
    if (!clerkUserId) {
      console.log(`  Skipping item with no userId`);
      skipped++;
      continue;
    }

    // Look up host.id
    const hostId = clerkToHostId.get(clerkUserId);
    if (!hostId) {
      console.log(`  No host found for clerkUserId: ${clerkUserId}`);
      skipped++;
      continue;
    }

    // Create new record with hostId
    const newItem = {
      ...item,
      hostId,
    };
    delete newItem.userId;

    // Save new record
    await dynamoDb.send(new PutCommand({
      TableName: TABLES.AVAILABILITY,
      Item: newItem,
    }));

    // Delete old record (if different key)
    // Note: If the table's primary key is still userId, this will fail
    // In that case, we need to recreate the table with hostId as the key
    try {
      await dynamoDb.send(new DeleteCommand({
        TableName: TABLES.AVAILABILITY,
        Key: { userId: clerkUserId },
      }));
    } catch (err) {
      // If delete fails, the table might already use hostId as key
      console.log(`  Note: Could not delete old record (table may use hostId as key)`);
    }

    migrated++;
  }

  console.log(`  Migrated: ${migrated}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Already migrated: ${alreadyMigrated}\n`);
}

// Migrate availability changelog table
async function migrateAvailabilityChangelog(clerkToHostId) {
  console.log('=== Migrating Availability Changelog ===');

  const result = await dynamoDb.send(new ScanCommand({
    TableName: TABLES.AVAILABILITY_CHANGELOG,
  }));

  const items = result.Items || [];
  console.log(`Found ${items.length} changelog records`);

  let migrated = 0;
  let skipped = 0;
  let alreadyMigrated = 0;

  for (const item of items) {
    // Check if already has hostId and no userId
    if (item.hostId && !item.userId) {
      alreadyMigrated++;
      continue;
    }

    const clerkUserId = item.userId;
    if (!clerkUserId) {
      skipped++;
      continue;
    }

    const hostId = clerkToHostId.get(clerkUserId) || item.hostId;
    if (!hostId) {
      console.log(`  No host found for clerkUserId: ${clerkUserId}`);
      skipped++;
      continue;
    }

    // Update record to use hostId
    const newItem = {
      ...item,
      hostId,
    };
    delete newItem.userId;

    await dynamoDb.send(new PutCommand({
      TableName: TABLES.AVAILABILITY_CHANGELOG,
      Item: newItem,
    }));

    migrated++;
  }

  console.log(`  Migrated: ${migrated}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Already migrated: ${alreadyMigrated}\n`);
}

// Migrate callouts table
async function migrateCallouts(clerkToHostId) {
  console.log('=== Migrating Callouts ===');

  const result = await dynamoDb.send(new ScanCommand({
    TableName: TABLES.CALLOUTS,
  }));

  const items = result.Items || [];
  console.log(`Found ${items.length} callout records`);

  let migrated = 0;
  let skipped = 0;
  let alreadyMigrated = 0;

  for (const item of items) {
    // Check if already has hostId
    if (item.hostId && !item.userId) {
      alreadyMigrated++;
      continue;
    }

    const clerkUserId = item.userId;
    if (!clerkUserId) {
      skipped++;
      continue;
    }

    const hostId = clerkToHostId.get(clerkUserId);
    if (!hostId) {
      console.log(`  No host found for clerkUserId: ${clerkUserId}`);
      skipped++;
      continue;
    }

    // Update record to use hostId
    const newItem = {
      ...item,
      hostId,
    };
    delete newItem.userId;

    await dynamoDb.send(new PutCommand({
      TableName: TABLES.CALLOUTS,
      Item: newItem,
    }));

    migrated++;
  }

  console.log(`  Migrated: ${migrated}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Already migrated: ${alreadyMigrated}\n`);
}

// Migrate training progress table
async function migrateTrainingProgress(clerkToHostId) {
  console.log('=== Migrating Training Progress ===');

  const result = await dynamoDb.send(new ScanCommand({
    TableName: TABLES.TRAINING_PROGRESS,
  }));

  const items = result.Items || [];
  console.log(`Found ${items.length} training progress records`);

  let migrated = 0;
  let skipped = 0;
  let alreadyMigrated = 0;

  for (const item of items) {
    // Check if already has hostId
    if (item.hostId && !item.oduserId) {
      alreadyMigrated++;
      continue;
    }

    const clerkUserId = item.oduserId;
    if (!clerkUserId) {
      skipped++;
      continue;
    }

    const hostId = clerkToHostId.get(clerkUserId);
    if (!hostId) {
      console.log(`  No host found for clerkUserId: ${clerkUserId}`);
      skipped++;
      continue;
    }

    // Update the id to use hostId instead of clerkUserId
    const lessonId = item.lessonId;
    const newId = `${hostId}#${lessonId}`;

    // Create new record with hostId
    const newItem = {
      ...item,
      id: newId,
      hostId,
    };
    delete newItem.oduserId;

    // Save new record
    await dynamoDb.send(new PutCommand({
      TableName: TABLES.TRAINING_PROGRESS,
      Item: newItem,
    }));

    // Delete old record if id changed
    if (item.id !== newId) {
      try {
        await dynamoDb.send(new DeleteCommand({
          TableName: TABLES.TRAINING_PROGRESS,
          Key: { id: item.id },
        }));
      } catch (err) {
        console.log(`  Note: Could not delete old record ${item.id}`);
      }
    }

    migrated++;
  }

  console.log(`  Migrated: ${migrated}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Already migrated: ${alreadyMigrated}\n`);
}

// Main function
async function main() {
  console.log('===========================================');
  console.log('  Migration: userId -> hostId');
  console.log('===========================================\n');

  try {
    // Get host mappings
    const clerkToHostId = await getHostMappings();

    if (clerkToHostId.size === 0) {
      console.log('ERROR: No hosts with clerkUserId found. Cannot proceed with migration.');
      process.exit(1);
    }

    // Run migrations
    await migrateAvailability(clerkToHostId);
    await migrateAvailabilityChangelog(clerkToHostId);
    await migrateCallouts(clerkToHostId);
    await migrateTrainingProgress(clerkToHostId);

    console.log('===========================================');
    console.log('  Migration Complete!');
    console.log('===========================================');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

main();
