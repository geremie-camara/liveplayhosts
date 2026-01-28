import { readFileSync } from 'fs';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'crypto';

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
const HOSTS_TABLE = 'liveplayhosts-hosts';
const AVAILABILITY_TABLE = 'liveplayhosts-availability';

// Helper to create day availability
const day = (enabled, startTime = "17:00", endTime = "21:00") => ({
  enabled,
  startTime,
  endTime,
});

// Helper to create blocked date
const blocked = (startDate, endDate, reason) => ({
  id: randomUUID(),
  startDate,
  endDate,
  reason,
});

// Availability data mapped by name matching pattern
// Names should match firstName or "firstName lastName"
const availabilityData = [
  {
    match: ["Madison"],
    notes: "Mon-Fri 5-9PM preference, can do 7-11PM if needed. (Tasty)",
    weekly: {
      monday: day(true, "17:00", "21:00"),
      tuesday: day(true, "17:00", "21:00"),
      wednesday: day(true, "17:00", "21:00"),
      thursday: day(true, "17:00", "21:00"),
      friday: day(true, "17:00", "21:00"),
      saturday: day(false),
      sunday: day(false),
    },
    blockedDates: [
      blocked("2025-02-08", "2025-02-14", "Out of town - Super Bowl week"),
    ],
  },
  {
    match: ["Sarah Schnare", "Sarah S"],
    notes: "5-9PM preferred, 4 days/week. Can do 7-11PM once/week (Mon). Needs Tue to be 5-9PM.",
    weekly: {
      monday: day(true, "17:00", "23:00"), // Can do late shift on Mon
      tuesday: day(true, "17:00", "21:00"), // Must be 5-9
      wednesday: day(true, "17:00", "21:00"),
      thursday: day(true, "17:00", "21:00"),
      friday: day(true, "17:00", "21:00"),
      saturday: day(false),
      sunday: day(false),
    },
    blockedDates: [
      blocked("2025-02-09", "2025-02-09", "Unavailable"),
      blocked("2025-02-11", "2025-02-12", "Unavailable"),
    ],
  },
  {
    match: ["Josh Randall", "Josh R"],
    notes: "Weekdays and weekends after 5PM. Sat/Sun 5-9PM. Thursdays work best.",
    weekly: {
      monday: day(true, "17:00", "23:00"),
      tuesday: day(true, "17:00", "23:00"),
      wednesday: day(true, "17:00", "23:00"),
      thursday: day(true, "17:00", "23:00"), // Preferred
      friday: day(true, "17:00", "23:00"),
      saturday: day(true, "17:00", "21:00"),
      sunday: day(true, "17:00", "21:00"),
    },
    blockedDates: [],
  },
  {
    match: ["John Mason Reynolds"],
    notes: "Sun + Monday 5-9PM or 7-11PM",
    weekly: {
      monday: day(true, "17:00", "23:00"),
      tuesday: day(false),
      wednesday: day(false),
      thursday: day(false),
      friday: day(false),
      saturday: day(false),
      sunday: day(true, "17:00", "23:00"),
    },
    blockedDates: [],
  },
  {
    match: ["Curtis Kingsley", "Curtis K"],
    notes: "Tues, Wed, Fri 7-11PM. Bingo Mon and Thu from 10. (Tasty)",
    weekly: {
      monday: day(true, "10:00", "12:00"), // Bingo only
      tuesday: day(true, "19:00", "23:00"),
      wednesday: day(true, "19:00", "23:00"),
      thursday: day(true, "10:00", "12:00"), // Bingo only
      friday: day(true, "19:00", "23:00"),
      saturday: day(false),
      sunday: day(false),
    },
    blockedDates: [],
  },
  {
    match: ["Victoria"],
    notes: "5 days/5 hours min. Tues-Sat: 3 shifts 5-9PM, 1 shift 7-11PM. Bingo 4-4:50PM or 6-6:50PM.",
    weekly: {
      monday: day(false),
      tuesday: day(true, "16:00", "23:00"),
      wednesday: day(true, "16:00", "23:00"),
      thursday: day(true, "16:00", "23:00"),
      friday: day(true, "16:00", "23:00"),
      saturday: day(true, "16:00", "23:00"),
      sunday: day(false),
    },
    blockedDates: [],
  },
  {
    match: ["Ricardo"],
    notes: "Prefer Mon-Fri for Casino. 5-11PM availability.",
    weekly: {
      monday: day(true, "17:00", "23:00"),
      tuesday: day(true, "17:00", "23:00"),
      wednesday: day(true, "17:00", "23:00"),
      thursday: day(true, "17:00", "23:00"),
      friday: day(true, "17:00", "23:00"),
      saturday: day(false),
      sunday: day(false),
    },
    blockedDates: [],
  },
  {
    match: ["Vihan"],
    notes: "Sat/Sun/Thu 7-11PM. (Gifts, Tasty, Buffalo). 3 days/week. Bingo 5pm Sat/Sun.",
    weekly: {
      monday: day(false),
      tuesday: day(false),
      wednesday: day(false),
      thursday: day(true, "19:00", "23:00"),
      friday: day(false),
      saturday: day(true, "17:00", "23:00"), // Includes bingo at 5
      sunday: day(true, "17:00", "23:00"), // Includes bingo at 5
    },
    blockedDates: [],
  },
  {
    match: ["Haley"],
    notes: "1st & last Sat 5-9PM. M/W/Th/F 1st & last week. 2nd-3rd week: Mon 5-9, Tue 7-11, Wed-Fri 5-9.",
    weekly: {
      monday: day(true, "17:00", "21:00"),
      tuesday: day(true, "19:00", "23:00"),
      wednesday: day(true, "17:00", "21:00"),
      thursday: day(true, "17:00", "21:00"),
      friday: day(true, "17:00", "21:00"),
      saturday: day(true, "17:00", "21:00"), // 1st & last of month
      sunday: day(false),
    },
    blockedDates: [
      blocked("2025-03-06", "2025-03-06", "Unavailable"),
      blocked("2025-03-20", "2025-03-22", "Unavailable"),
    ],
  },
  {
    match: ["Andrea"],
    notes: "Asked to be temporarily removed from schedule",
    weekly: {
      monday: day(false),
      tuesday: day(false),
      wednesday: day(false),
      thursday: day(false),
      friday: day(false),
      saturday: day(false),
      sunday: day(false),
    },
    blockedDates: [],
  },
  {
    match: ["Michael V"],
    notes: "Flexible 5-11PM PT. 2 days/week: Mon/Thu or Thu/Sat. (Buffalo/Tasty)",
    weekly: {
      monday: day(true, "17:00", "23:00"),
      tuesday: day(false),
      wednesday: day(false),
      thursday: day(true, "17:00", "23:00"),
      friday: day(false),
      saturday: day(true, "17:00", "23:00"),
      sunday: day(false),
    },
    blockedDates: [],
  },
  {
    match: ["Goldie"],
    notes: "Tues/Wed/Fri casino 5-9PM, weekends 5-9PM. Asked to be temporarily removed.",
    weekly: {
      monday: day(false),
      tuesday: day(false), // Removed from schedule
      wednesday: day(false),
      thursday: day(false),
      friday: day(false),
      saturday: day(false),
      sunday: day(false),
    },
    blockedDates: [],
  },
  {
    match: ["Mia"],
    notes: "Prefers 2-3 shifts/week. Sat 7-11PM Tasty. Thu 7-11PM Buffalo.",
    weekly: {
      monday: day(false),
      tuesday: day(false),
      wednesday: day(false),
      thursday: day(true, "19:00", "23:00"),
      friday: day(false),
      saturday: day(true, "19:00", "23:00"),
      sunday: day(false),
    },
    blockedDates: [],
  },
  {
    match: ["Chapman"],
    notes: "Sun/Mon 7-11PM, open availability. (Tasty/Buffalo). Unavailable Tue evenings.",
    weekly: {
      monday: day(true, "19:00", "23:00"),
      tuesday: day(false), // Unavailable
      wednesday: day(true, "17:00", "23:00"),
      thursday: day(true, "17:00", "23:00"),
      friday: day(true, "17:00", "23:00"),
      saturday: day(true, "17:00", "23:00"),
      sunday: day(true, "19:00", "23:00"),
    },
    blockedDates: [],
  },
  {
    match: ["Emily Wilson", "Emily W"],
    notes: "Sun/Tue/Wed 7-11PM Casino. Daytime avail for Bingo Mon-Thu (prefers evenings).",
    weekly: {
      monday: day(true, "09:00", "17:00"), // Daytime bingo only
      tuesday: day(true, "09:00", "23:00"), // Daytime + evening
      wednesday: day(true, "09:00", "23:00"), // Daytime + evening
      thursday: day(true, "09:00", "17:00"), // Daytime bingo only
      friday: day(false),
      saturday: day(false),
      sunday: day(true, "19:00", "23:00"),
    },
    blockedDates: [],
  },
  {
    match: ["Jessica Rogers", "Jessica R"],
    notes: "Sun-Wed 5-11PM, 2-3 days/week.",
    weekly: {
      monday: day(true, "17:00", "23:00"),
      tuesday: day(true, "17:00", "23:00"),
      wednesday: day(true, "17:00", "23:00"),
      thursday: day(false),
      friday: day(false),
      saturday: day(false),
      sunday: day(true, "17:00", "23:00"),
    },
    blockedDates: [
      blocked("2025-02-01", "2025-02-01", "Unavailable"),
      blocked("2025-03-01", "2025-03-05", "Unavailable"),
      blocked("2025-04-15", "2025-04-20", "Unavailable"),
      blocked("2025-05-01", "2025-05-04", "Unavailable"),
    ],
  },
];

// Fetch all hosts
async function fetchHosts() {
  const result = await dynamoDb.send(new ScanCommand({
    TableName: HOSTS_TABLE,
  }));
  return result.Items || [];
}

// Match host to availability data - stricter matching
function findAvailabilityData(host) {
  const fullName = `${host.firstName} ${host.lastName}`.toLowerCase().trim();
  const firstName = host.firstName?.toLowerCase().trim();
  const lastName = host.lastName?.toLowerCase().trim();
  // Handle names like "Michael V." -> "michael v"
  const fullNameNoPunct = fullName.replace(/[.]/g, '').trim();

  for (const data of availabilityData) {
    for (const pattern of data.match) {
      const patternLower = pattern.toLowerCase().trim();
      const patternParts = patternLower.split(' ');

      // Exact full name match
      if (fullName === patternLower || fullNameNoPunct === patternLower) {
        return data;
      }

      // Pattern is just first name - must match exactly AND be unique enough
      if (patternParts.length === 1) {
        // Only match if first name matches exactly
        if (firstName === patternLower) {
          return data;
        }
      }

      // Pattern has first + last initial (e.g., "Michael V", "Sarah S")
      if (patternParts.length === 2 && patternParts[1].length === 1) {
        const patternFirst = patternParts[0];
        const patternLastInitial = patternParts[1];
        if (firstName === patternFirst && lastName?.startsWith(patternLastInitial)) {
          return data;
        }
      }

      // Pattern has full first + last name
      if (patternParts.length >= 2) {
        const patternFirst = patternParts[0];
        const patternLast = patternParts.slice(1).join(' ');
        if (firstName === patternFirst && lastName === patternLast) {
          return data;
        }
      }
    }
  }
  return null;
}

// Update availability for a host
async function updateAvailability(host, data) {
  // Availability is keyed by userId, which stores host.id (not Clerk userId)
  const availability = {
    userId: host.id, // userId stores host.id (DynamoDB id)
    weekly: data.weekly,
    blockedDates: data.blockedDates,
    updatedAt: new Date().toISOString(),
    notes: data.notes, // Store notes for reference
  };

  await dynamoDb.send(new PutCommand({
    TableName: AVAILABILITY_TABLE,
    Item: availability,
  }));

  return availability;
}

// Main function
async function main() {
  console.log('Fetching hosts...');
  const hosts = await fetchHosts();
  console.log(`Found ${hosts.length} hosts\n`);

  const matched = [];
  const unmatched = [];

  for (const host of hosts) {
    if (host.role !== 'host') continue; // Only process hosts

    const data = findAvailabilityData(host);
    if (data) {
      matched.push({ host, data });
    } else {
      unmatched.push(host);
    }
  }

  console.log(`Matched ${matched.length} hosts with availability data\n`);

  // Show matches and ask for confirmation
  console.log('=== MATCHES ===');
  for (const { host, data } of matched) {
    console.log(`  ${host.firstName} ${host.lastName} -> ${data.match[0]}`);
    console.log(`    Notes: ${data.notes}`);
  }

  console.log('\n=== UNMATCHED HOSTS (will not be updated) ===');
  for (const host of unmatched) {
    console.log(`  ${host.firstName} ${host.lastName}`);
  }

  // Process updates
  console.log('\n=== UPDATING AVAILABILITY ===');
  let updated = 0;
  let errors = 0;

  for (const { host, data } of matched) {
    try {
      await updateAvailability(host, data);
      console.log(`  [OK] ${host.firstName} ${host.lastName}`);
      updated++;
    } catch (error) {
      console.error(`  [ERROR] ${host.firstName} ${host.lastName}: ${error.message}`);
      errors++;
    }
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Errors: ${errors}`);
  console.log(`  Unmatched: ${unmatched.length}`);
}

main().catch(console.error);
