#!/usr/bin/env node

/**
 * Check SNS SMS sandbox status and settings
 */

import { SNSClient, GetSMSAttributesCommand, GetSMSSandboxAccountStatusCommand } from "@aws-sdk/client-sns";
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

const client = new SNSClient({
  region: process.env.S3_REGION || "us-west-2",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  },
});

console.log("Checking SNS SMS settings...\n");

try {
  // Check sandbox status
  const sandboxStatus = await client.send(new GetSMSSandboxAccountStatusCommand({}));
  console.log("📱 Sandbox Status:", sandboxStatus.IsInSandbox ? "IN SANDBOX" : "PRODUCTION");

  if (sandboxStatus.IsInSandbox) {
    console.log("\n⚠️  Your account is in SMS Sandbox mode!");
    console.log("   This means you can only send to VERIFIED phone numbers.");
    console.log("\n   To fix this, either:");
    console.log("   1. Add your phone number to the sandbox (for testing):");
    console.log("      AWS Console → SNS → Text messaging → Sandbox destination phone numbers");
    console.log("   2. Request to exit sandbox (for production):");
    console.log("      AWS Console → SNS → Text messaging → Exit SMS sandbox");
  }
} catch (error) {
  console.log("Could not check sandbox status:", error.message);
}

try {
  // Check SMS attributes
  const attributes = await client.send(new GetSMSAttributesCommand({ attributes: [] }));
  console.log("\n📊 SMS Account Settings:");
  console.log("   Monthly Spend Limit:", attributes.attributes?.MonthlySpendLimit || "$1.00 (default)");
  console.log("   Default SMS Type:", attributes.attributes?.DefaultSMSType || "Promotional");
  console.log("   Default Sender ID:", attributes.attributes?.DefaultSenderID || "None");
  console.log("   Delivery Status IAM Role:", attributes.attributes?.DeliveryStatusIAMRole || "Not configured");
} catch (error) {
  console.log("Could not get SMS attributes:", error.message);
}
