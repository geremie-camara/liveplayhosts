#!/usr/bin/env node
/**
 * Check what's in the availability table
 */

import { readFileSync } from 'fs';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';

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

async function main() {
  // Check availability table
  console.log('=== Availability Table ===');
  const availResult = await dynamoDb.send(new ScanCommand({
    TableName: 'liveplayhosts-availability',
    Limit: 5,
  }));

  for (const item of availResult.Items || []) {
    console.log('Item keys:', Object.keys(item));
    console.log('userId:', item.userId);
    console.log('hostId:', item.hostId);
    console.log('---');
  }

  // Check hosts table
  console.log('\n=== Hosts with clerkUserId ===');
  const hostsResult = await dynamoDb.send(new ScanCommand({
    TableName: 'liveplayhosts-hosts',
    FilterExpression: 'attribute_exists(clerkUserId)',
  }));

  for (const host of hostsResult.Items || []) {
    console.log(`${host.firstName} ${host.lastName}:`);
    console.log(`  host.id: ${host.id}`);
    console.log(`  clerkUserId: ${host.clerkUserId}`);
  }
}

main().catch(console.error);
