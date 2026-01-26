#!/usr/bin/env node

/**
 * Test SMS sending via Twilio
 * Usage: node scripts/test-twilio-sms.mjs +1XXXXXXXXXX
 */

import Twilio from "twilio";
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
  console.error("Usage: node scripts/test-twilio-sms.mjs +1XXXXXXXXXX");
  console.error("Example: node scripts/test-twilio-sms.mjs +14155551234");
  process.exit(1);
}

// Validate phone format
if (!phoneNumber.startsWith("+")) {
  console.error("Phone number must be in E.164 format (e.g., +14155551234)");
  process.exit(1);
}

console.log("Checking Twilio credentials...");
console.log("Account SID:", process.env.TWILIO_ACCOUNT_SID ? `${process.env.TWILIO_ACCOUNT_SID.slice(0, 8)}...` : "NOT SET");
console.log("Auth Token:", process.env.TWILIO_AUTH_TOKEN ? "SET" : "NOT SET");
console.log("Phone Number:", process.env.TWILIO_PHONE_NUMBER || "NOT SET");

if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_PHONE_NUMBER) {
  console.error("\nError: Twilio credentials not found in .env.local");
  console.error("Required variables:");
  console.error("  TWILIO_ACCOUNT_SID=your_account_sid");
  console.error("  TWILIO_AUTH_TOKEN=your_auth_token");
  console.error("  TWILIO_PHONE_NUMBER=+1XXXXXXXXXX");
  process.exit(1);
}

const client = Twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

const testMessage = "Test from LivePlay Hosts: SMS is configured correctly! https://liveplayhosts.com";

console.log(`\nSending test SMS to ${phoneNumber}...`);
console.log(`From: ${process.env.TWILIO_PHONE_NUMBER}`);
console.log(`Message: "${testMessage}"`);

try {
  const result = await client.messages.create({
    body: testMessage,
    from: process.env.TWILIO_PHONE_NUMBER,
    to: phoneNumber,
  });

  console.log("\n✅ SMS sent successfully!");
  console.log("Message SID:", result.sid);
  console.log("Status:", result.status);
  console.log("\nCheck your phone for the test message.");
} catch (error) {
  console.error("\n❌ Failed to send SMS:");
  console.error("Error:", error.message);

  if (error.code === 20003) {
    console.error("\nAuthentication failed. Check your Account SID and Auth Token.");
  } else if (error.code === 21211) {
    console.error("\nInvalid 'To' phone number. Make sure it's in E.164 format.");
  } else if (error.code === 21608) {
    console.error("\nThe phone number is unverified. In trial mode, you can only send to verified numbers.");
    console.error("Verify this number at: https://console.twilio.com/us1/develop/phone-numbers/manage/verified");
  }

  process.exit(1);
}
