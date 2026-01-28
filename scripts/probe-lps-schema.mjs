#!/usr/bin/env node

/**
 * One-time schema discovery script for LPS Dungeon Data Service.
 *
 * Usage:
 *   LPS_API_URL=https://5vc0hpsw48.execute-api.us-west-2.amazonaws.com/develop/ \
 *   LPS_API_KEY=<your-key> \
 *   node scripts/probe-lps-schema.mjs
 *
 * Confirms field names, date formats, and API key header behavior.
 */

const API_URL = process.env.LPS_API_URL;
const API_KEY = process.env.LPS_API_KEY;

if (!API_URL || !API_KEY) {
  console.error("Error: Set LPS_API_URL and LPS_API_KEY environment variables.");
  process.exit(1);
}

async function lpsPost(body) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${text}`);
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return text;
  }

  // API Gateway proxy may wrap in a body field
  if (data.body && typeof data.body === "string") {
    try {
      return JSON.parse(data.body);
    } catch {
      return data;
    }
  }
  return data;
}

async function probe(label, body) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  ${label}`);
  console.log(`${"=".repeat(60)}`);
  try {
    const result = await lpsPost(body);
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error(`  ERROR: ${err.message}`);
  }
}

async function main() {
  console.log("LPS Dungeon Data Service — Schema Probe");
  console.log(`API URL: ${API_URL}`);

  // 1. Show all tables
  await probe("show_tables", { action: "show_tables", params: {} });

  // 2. Describe tables
  await probe("describe host", { action: "describe", params: { table: "host" } });
  await probe("describe host_schedule", { action: "describe", params: { table: "host_schedule" } });
  await probe("describe room", { action: "describe", params: { table: "room" } });

  // 3. Sample reads
  await probe("read room (all)", { action: "read", params: { table: "room" } });

  await probe("read host (sample — first 5)", {
    action: "read",
    params: { table: "host" },
  });

  await probe("read host_schedule (sample — first 5)", {
    action: "read",
    params: { table: "host_schedule" },
  });

  console.log("\n\nDone. Review the output above to confirm field names and data formats.");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
