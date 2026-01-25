import { readFileSync, existsSync } from 'fs';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

// Try to read env file
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
  if (process.env[key]) return process.env[key];
  const match = envContent.match(new RegExp(`${key}=(.+)`));
  return match ? match[1].trim() : null;
};

const client = new DynamoDBClient({
  region: getEnv("S3_REGION") || "us-west-2",
  credentials: {
    accessKeyId: getEnv("S3_ACCESS_KEY_ID"),
    secretAccessKey: getEnv("S3_SECRET_ACCESS_KEY"),
  },
});

const dynamoDb = DynamoDBDocumentClient.from(client);

async function findAndFix() {
  const email = process.argv[2];
  const clerkUserId = process.argv[3];

  if (!email || !clerkUserId) {
    console.log("Usage: node scripts/fix-clerk-id.mjs <email> <clerkUserId>");
    console.log("Example: node scripts/fix-clerk-id.mjs geremie@liveplaymobile.com user_abc123");

    // List hosts without clerkUserId
    console.log("\n--- Hosts without clerkUserId ---");
    const result = await dynamoDb.send(
      new ScanCommand({
        TableName: "liveplayhosts-hosts",
      })
    );

    const missingClerk = result.Items?.filter(h => !h.clerkUserId) || [];
    console.log(`Found ${missingClerk.length} hosts without clerkUserId:`);
    for (const h of missingClerk) {
      console.log(`  - ${h.email} (id: ${h.id})`);
    }
    return;
  }

  // Find host by email
  console.log(`Finding host with email: ${email}`);
  const hostResult = await dynamoDb.send(
    new ScanCommand({
      TableName: "liveplayhosts-hosts",
      FilterExpression: "email = :email",
      ExpressionAttributeValues: {
        ":email": email,
      },
    })
  );

  if (!hostResult.Items || hostResult.Items.length === 0) {
    console.log("ERROR: No host found with email:", email);
    return;
  }

  const host = hostResult.Items[0];
  console.log("Found host:", host.firstName, host.lastName);
  console.log("Current clerkUserId:", host.clerkUserId || "(not set)");
  console.log("Updating to:", clerkUserId);

  // Update the host record
  await dynamoDb.send(
    new UpdateCommand({
      TableName: "liveplayhosts-hosts",
      Key: { id: host.id },
      UpdateExpression: "SET clerkUserId = :clerkUserId",
      ExpressionAttributeValues: {
        ":clerkUserId": clerkUserId,
      },
    })
  );

  console.log("\nDone! ClerkUserId updated successfully.");
}

findAndFix().catch(console.error);
