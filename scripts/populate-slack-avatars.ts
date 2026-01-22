import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const SLACK_TOKEN = process.env.SLACK_TOKEN;
const AWS_REGION = process.env.S3_REGION || "us-west-2";
const AWS_ACCESS_KEY = process.env.S3_ACCESS_KEY_ID;
const AWS_SECRET_KEY = process.env.S3_SECRET_ACCESS_KEY;
const TABLE_NAME = "liveplayhosts-hosts";

if (!SLACK_TOKEN) {
  console.error("Missing SLACK_TOKEN environment variable");
  process.exit(1);
}

// Initialize DynamoDB client
const client = new DynamoDBClient({
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY || "",
    secretAccessKey: AWS_SECRET_KEY || "",
  },
});
const dynamoDb = DynamoDBDocumentClient.from(client);

interface Host {
  id: string;
  firstName: string;
  lastName: string;
  slackId?: string;
  headshotUrl?: string;
  headshotExternalUrl?: string;
}

async function getSlackUserAvatar(slackId: string): Promise<string | null> {
  try {
    const response = await fetch(`https://slack.com/api/users.info?user=${slackId}`, {
      headers: {
        Authorization: `Bearer ${SLACK_TOKEN}`,
      },
    });

    const data = await response.json();

    if (!data.ok) {
      console.error(`  Slack API error for ${slackId}: ${data.error}`);
      return null;
    }

    // Get the largest available image (512px preferred)
    const profile = data.user?.profile;
    const imageUrl = profile?.image_512 || profile?.image_192 || profile?.image_72 || profile?.image_48;

    return imageUrl || null;
  } catch (error) {
    console.error(`  Error fetching Slack user ${slackId}:`, error);
    return null;
  }
}

async function updateHostAvatar(hostId: string, avatarUrl: string): Promise<boolean> {
  try {
    await dynamoDb.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { id: hostId },
        UpdateExpression: "SET headshotExternalUrl = :url, updatedAt = :now",
        ExpressionAttributeValues: {
          ":url": avatarUrl,
          ":now": new Date().toISOString(),
        },
      })
    );
    return true;
  } catch (error) {
    console.error(`  Error updating host ${hostId}:`, error);
    return false;
  }
}

async function main() {
  console.log("Fetching all hosts from DynamoDB...\n");

  // Scan for all hosts
  const result = await dynamoDb.send(
    new ScanCommand({
      TableName: TABLE_NAME,
    })
  );

  const hosts = (result.Items || []) as Host[];
  const hostsWithSlackId = hosts.filter(h => h.slackId && !h.headshotUrl);

  console.log(`Found ${hosts.length} total hosts`);
  console.log(`Found ${hostsWithSlackId.length} hosts with Slack ID (and no uploaded headshot)\n`);

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const host of hostsWithSlackId) {
    console.log(`Processing: ${host.firstName} ${host.lastName} (${host.slackId})`);

    // Skip if already has an external URL
    if (host.headshotExternalUrl) {
      console.log(`  Skipping - already has external URL`);
      skipped++;
      continue;
    }

    const avatarUrl = await getSlackUserAvatar(host.slackId!);

    if (avatarUrl) {
      const success = await updateHostAvatar(host.id, avatarUrl);
      if (success) {
        console.log(`  Updated with: ${avatarUrl}`);
        updated++;
      } else {
        failed++;
      }
    } else {
      console.log(`  No avatar found`);
      failed++;
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log(`\n--- Summary ---`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped (already had URL): ${skipped}`);
  console.log(`Failed: ${failed}`);
}

main().catch(console.error);
