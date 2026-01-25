import { readFileSync, existsSync } from 'fs';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { Resend } from 'resend';

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
  console.log("=== Email Debug ===\n");

  // 1. Check RESEND_API_KEY
  const resendKey = getEnv("RESEND_API_KEY");
  console.log("1. RESEND_API_KEY:", resendKey ? `Set (${resendKey.substring(0, 10)}...)` : "NOT SET");

  // 2. Check recent delivery errors
  console.log("\n2. Checking recent email delivery errors...");
  const deliveriesResult = await dynamoDb.send(
    new ScanCommand({
      TableName: "liveplayhosts-broadcast-deliveries",
      FilterExpression: "email.#status = :failed",
      ExpressionAttributeNames: {
        "#status": "status",
      },
      ExpressionAttributeValues: {
        ":failed": "failed",
      },
      Limit: 10,
    })
  );

  if (deliveriesResult.Items && deliveriesResult.Items.length > 0) {
    console.log(`   Found ${deliveriesResult.Items.length} failed email deliveries:`);
    for (const d of deliveriesResult.Items.slice(0, 5)) {
      console.log(`   - ${d.userEmail}: ${d.email?.error || "(no error message)"}`);
    }
  } else {
    console.log("   No failed email deliveries found (or filter didn't match)");
  }

  // 3. Test sending an email
  if (resendKey) {
    console.log("\n3. Testing email send...");
    const testEmail = process.argv[2] || "geremie@liveplaymobile.com";
    console.log(`   Sending test email to: ${testEmail}`);

    try {
      const resend = new Resend(resendKey);
      const result = await resend.emails.send({
        from: "LivePlay <noreply@liveplayhosts.com>",
        to: [testEmail],
        subject: "Test Email from LivePlay",
        html: "<h1>Test</h1><p>This is a test email from the debug script.</p>",
      });

      if (result.error) {
        console.log("   ERROR:", result.error.message);
        console.log("   Full error:", JSON.stringify(result.error, null, 2));
      } else {
        console.log("   SUCCESS! Message ID:", result.data?.id);
      }
    } catch (error) {
      console.log("   EXCEPTION:", error.message);
    }
  } else {
    console.log("\n3. Cannot test - RESEND_API_KEY not set");
  }
}

debug().catch(console.error);
