#!/usr/bin/env node

import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { readFileSync } from "fs";

try {
  const envFile = readFileSync(".env.local", "utf8");
  envFile.split("\n").forEach((line) => {
    const [key, ...valueParts] = line.split("=");
    if (key && valueParts.length > 0) {
      process.env[key.trim()] = valueParts.join("=").trim().replace(/^["']|["']$/g, "");
    }
  });
} catch (e) {}

const phoneNumber = process.argv[2] || "+14243450912";

// Try us-east-1 instead
const client = new SNSClient({
  region: "us-east-1",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  },
});

console.log("Testing SMS via us-east-1 region...");

try {
  const result = await client.send(
    new PublishCommand({
      PhoneNumber: phoneNumber,
      Message: "Test from LivePlay Hosts via us-east-1",
      MessageAttributes: {
        "AWS.SNS.SMS.SMSType": {
          DataType: "String",
          StringValue: "Transactional",
        },
      },
    })
  );
  console.log("✅ Success! Message ID:", result.MessageId);
} catch (error) {
  console.log("❌ Failed:", error.message);
}
