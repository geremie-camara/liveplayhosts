import { readFileSync, existsSync } from 'fs';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";

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

async function debug() {
  const email = "geremie@liveplaymobile.com";

  console.log(`=== Debugging message center for ${email} ===\n`);

  // 1. Find host by email
  console.log("1. Finding host record by email...");
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
    console.log("   ERROR: No host found with email:", email);
    return;
  }

  const host = hostResult.Items[0];
  console.log("   Found host:");
  console.log("   - id:", host.id);
  console.log("   - clerkUserId:", host.clerkUserId);
  console.log("   - name:", host.firstName, host.lastName);
  console.log("   - role:", host.role);

  // 2. Check deliveries for this host
  console.log("\n2. Checking delivery records for host.id:", host.id);
  try {
    const deliveriesResult = await dynamoDb.send(
      new QueryCommand({
        TableName: "liveplayhosts-broadcast-deliveries",
        IndexName: "userId-createdAt-index",
        KeyConditionExpression: "userId = :userId",
        ExpressionAttributeValues: {
          ":userId": host.id,
        },
        ScanIndexForward: false,
      })
    );

    console.log("   Found", deliveriesResult.Items?.length || 0, "delivery records");

    if (deliveriesResult.Items && deliveriesResult.Items.length > 0) {
      console.log("\n   Recent deliveries:");
      for (const d of deliveriesResult.Items.slice(0, 5)) {
        console.log("   - broadcastId:", d.broadcastId);
        console.log("     created:", d.createdAt);
        console.log("     readAt:", d.readAt || "(unread)");
        console.log("     slack:", d.slack?.status);
        console.log("     email:", d.email?.status);
        console.log("");
      }
    }
  } catch (error) {
    console.log("   ERROR querying deliveries:", error.message);
  }

  // 3. Check recent broadcasts to see if user was targeted
  console.log("\n3. Checking recent broadcasts...");
  const broadcastsResult = await dynamoDb.send(
    new ScanCommand({
      TableName: "liveplayhosts-broadcasts",
      Limit: 10,
    })
  );

  console.log("   Found", broadcastsResult.Items?.length || 0, "broadcasts");

  if (broadcastsResult.Items && broadcastsResult.Items.length > 0) {
    console.log("\n   Recent broadcasts:");
    for (const b of broadcastsResult.Items.slice(0, 5)) {
      console.log("   - id:", b.id);
      console.log("     subject:", b.subject);
      console.log("     status:", b.status);
      console.log("     targetUserIds:", b.targetUserIds?.length || 0, "users");
      const isTargeted = b.targetUserIds?.includes(host.id);
      console.log("     includes this user:", isTargeted ? "YES" : "NO");
      console.log("");
    }
  }
}

debug().catch(console.error);
