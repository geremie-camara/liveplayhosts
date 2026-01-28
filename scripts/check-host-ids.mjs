#!/usr/bin/env node
/**
 * Check if availability userIds match any host.id
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
  // Get all hosts
  const hostsResult = await dynamoDb.send(new ScanCommand({
    TableName: 'liveplayhosts-hosts',
  }));
  const hosts = hostsResult.Items || [];

  const hostIds = new Set(hosts.map(h => h.id));
  console.log(`Total hosts: ${hosts.length}`);
  console.log(`Sample host.id: ${hosts[0]?.id}`);

  // Get all availability
  const availResult = await dynamoDb.send(new ScanCommand({
    TableName: 'liveplayhosts-availability',
  }));
  const avails = availResult.Items || [];

  console.log(`\nTotal availability records: ${avails.length}`);
  console.log(`Sample userId: ${avails[0]?.userId}`);

  // Check matches
  let matched = 0;
  let unmatched = 0;

  for (const avail of avails) {
    if (hostIds.has(avail.userId)) {
      matched++;
      const host = hosts.find(h => h.id === avail.userId);
      console.log(`\nMATCH: ${host?.firstName} ${host?.lastName}`);
      console.log(`  availability.userId = ${avail.userId}`);
      console.log(`  host.id = ${host?.id}`);
    } else {
      unmatched++;
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Matched (userId = host.id): ${matched}`);
  console.log(`Unmatched: ${unmatched}`);

  // Show a few unmatched
  if (unmatched > 0) {
    console.log(`\nFirst 5 unmatched userIds:`);
    let count = 0;
    for (const avail of avails) {
      if (!hostIds.has(avail.userId) && count < 5) {
        console.log(`  ${avail.userId}`);
        count++;
      }
    }
  }
}

main().catch(console.error);
