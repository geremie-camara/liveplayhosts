#!/usr/bin/env node

/**
 * Test SMS sending via AWS SNS
 * Usage: node scripts/test-sms.mjs +1XXXXXXXXXX
 */

import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { readFileSync } from "fs";

// Load .env.local manually
try {
  const envFile = readFileSync(".env.local", "utf8");
  envFile.split("\n").forEach((line) => {
    const [key, ...valueParts] = line.split("=");
    if (key && valueParts.length > 0) {
      process.env[key.trim()] = valueParts.join("=").trim().replace(/^["']|["']$/g, "");
    }
  });
} catch (e) {
  console.error("Could not load .env.local");
}

const phoneNumber = process.argv[2];

if (!phoneNumber) {
  console.error("Usage: node scripts/test-sms.mjs +1XXXXXXXXXX");
  console.error("Example: node scripts/test-sms.mjs +14155551234");
  process.exit(1);
}

// Validate phone format
if (!phoneNumber.startsWith("+")) {
  console.error("Phone number must be in E.164 format (e.g., +14155551234)");
  process.exit(1);
}

console.log("Checking AWS credentials...");
console.log("Region:", process.env.S3_REGION || "us-west-2");
console.log("Access Key ID:", process.env.S3_ACCESS_KEY_ID ? `${process.env.S3_ACCESS_KEY_ID.slice(0, 8)}...` : "NOT SET");
console.log("Secret Key:", process.env.S3_SECRET_ACCESS_KEY ? "SET" : "NOT SET");

if (!process.env.S3_ACCESS_KEY_ID || !process.env.S3_SECRET_ACCESS_KEY) {
  console.error("\nError: AWS credentials not found in .env.local");
  process.exit(1);
}

const client = new SNSClient({
  region: process.env.S3_REGION || "us-west-2",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  },
});

const testMessage = "Test from LivePlay Hosts: SMS is configured correctly! https://liveplayhosts.com";

console.log(`\nSending test SMS to ${phoneNumber}...`);
console.log(`Message: "${testMessage}"`);

try {
  const result = await client.send(
    new PublishCommand({
      PhoneNumber: phoneNumber,
      Message: testMessage,
      MessageAttributes: {
        "AWS.SNS.SMS.SMSType": {
          DataType: "String",
          StringValue: "Transactional",
        },
      },
    })
  );

  console.log("\n✅ SMS sent successfully!");
  console.log("Message ID:", result.MessageId);
  console.log("\nCheck your phone for the test message.");
} catch (error) {
  console.error("\n❌ Failed to send SMS:");
  console.error("Error:", error.message);

  if (error.message.includes("not authorized")) {
    console.error("\nThe IAM user doesn't have SNS permissions. Add AmazonSNSFullAccess policy.");
  } else if (error.message.includes("sandbox")) {
    console.error("\nYour account is in SMS sandbox mode. Either:");
    console.error("1. Verify this phone number in SNS console, or");
    console.error("2. Request to exit the SMS sandbox");
  }

  process.exit(1);
}
