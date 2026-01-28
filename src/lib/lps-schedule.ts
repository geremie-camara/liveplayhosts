// LPS Dungeon Data Service — schedule data access layer
// Same function signatures as scheduler-db.ts so API routes can swap between them.

import { isLpsConfigured, lpsRead } from "./lps-client";
import { ScheduleEntry, getStudioColor } from "./schedule-types";
import { dynamoDb, TABLES } from "./dynamodb";
import { ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { Host } from "./types";

// --- Field Mapping (PLACEHOLDER — confirm with probe-lps-schema.mjs) ---

const FIELDS = {
  host: { id: "idHost", email: "email", firstName: "firstName", lastName: "lastName" },
  schedule: { id: "idHostSchedule", hostId: "idHost", roomId: "idRoom", startingOn: "startingOn", endingOn: "endingOn" },
  room: { id: "idRoom", name: "name" },
};

// --- Room (Studio) Cache ---
// The room table has < 10 records and rarely changes. Cache in memory.

interface LpsRoom {
  [key: string]: unknown;
  idRoom: number;
  name: string;
}

let roomCache: LpsRoom[] | null = null;
let roomCacheTime = 0;
const ROOM_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

async function getRooms(): Promise<LpsRoom[]> {
  const now = Date.now();
  if (roomCache && now - roomCacheTime < ROOM_CACHE_TTL) {
    return roomCache;
  }

  const rows = await lpsRead<LpsRoom>("room");
  roomCache = rows;
  roomCacheTime = now;
  return rows;
}

function getRoomName(rooms: LpsRoom[], roomId: number): string {
  const room = rooms.find((r) => r[FIELDS.room.id] === roomId);
  return room ? String(room[FIELDS.room.name]) : "Unknown";
}

// --- LPS Host Record ---

interface LpsHost {
  [key: string]: unknown;
  idHost: number;
  email: string;
  firstName: string;
  lastName: string;
}

// --- LPS Schedule Row ---

interface LpsScheduleRow {
  [key: string]: unknown;
  idHostSchedule: number;
  idHost: number;
  idRoom: number;
  startingOn: string | number; // ISO string or epoch — confirmed by schema probe
  endingOn: string | number;
}

// --- Date Helpers ---

/** Parse an LPS date value into a JS Date. Handles epoch (seconds), epoch (ms), and ISO string. */
function parseLpsDate(value: string | number): Date {
  if (typeof value === "number") {
    // Epoch — if < 1e12 assume seconds, otherwise ms
    return value < 1e12 ? new Date(value * 1000) : new Date(value);
  }
  return new Date(value);
}

/** Convert a JS Date to an ISO string for LPS WHERE clauses */
function toLpsDateValue(d: Date): string {
  return d.toISOString();
}

// --- Row → ScheduleEntry ---

function toScheduleEntry(
  row: LpsScheduleRow,
  host: { id: number; name: string; email: string },
  rooms: LpsRoom[]
): ScheduleEntry {
  const roomName = getRoomName(rooms, row[FIELDS.schedule.roomId] as number);

  return {
    id: row[FIELDS.schedule.id] as number,
    talentId: host.id,
    talentName: host.name,
    talentEmail: host.email,
    studioId: row[FIELDS.schedule.roomId] as number,
    studioName: roomName,
    studioColor: getStudioColor(roomName),
    startingOn: parseLpsDate(row[FIELDS.schedule.startingOn] as string | number),
    endingOn: parseLpsDate(row[FIELDS.schedule.endingOn] as string | number),
    notes: undefined,
  };
}

// --- Host ID Linking (mirrors clerkUserId auto-fix in host-utils.ts) ---

/**
 * Look up the LPS host ID for a given email.
 * First checks the DynamoDB host record for a cached lpsHostId.
 * If not found, queries the LPS host table by email and auto-saves the ID.
 */
async function resolveLpsHostId(email: string): Promise<{ lpsHostId: number; lpsHost: LpsHost } | null> {
  // Step 1: Check DynamoDB for a stored lpsHostId
  const dynamoHost = await findDynamoHostByEmail(email);
  if (dynamoHost?.lpsHostId) {
    // We have a cached LPS host ID — still need the LPS host record for name/email
    const lpsHosts = await lpsRead<LpsHost>("host", {
      where: [{ field: FIELDS.host.id, condition: "=", value: Number(dynamoHost.lpsHostId), isNumber: true }],
    });
    if (lpsHosts.length > 0) {
      return { lpsHostId: lpsHosts[0][FIELDS.host.id] as number, lpsHost: lpsHosts[0] };
    }
    // Cached ID is stale — fall through to email lookup
  }

  // Step 2: Look up by email in LPS
  const lpsHosts = await lpsRead<LpsHost>("host", {
    where: [{ field: FIELDS.host.email, condition: "=", value: email.toLowerCase() }],
  });

  if (lpsHosts.length === 0) {
    return null;
  }

  const lpsHost = lpsHosts[0];
  const lpsHostId = lpsHost[FIELDS.host.id] as number;

  // Step 3: Auto-save lpsHostId back to DynamoDB (fire-and-forget)
  if (dynamoHost && !dynamoHost.lpsHostId) {
    try {
      await dynamoDb.send(
        new UpdateCommand({
          TableName: TABLES.HOSTS,
          Key: { id: dynamoHost.id },
          UpdateExpression: "SET lpsHostId = :lpsHostId",
          ExpressionAttributeValues: {
            ":lpsHostId": String(lpsHostId),
          },
        })
      );
      console.log(`Auto-fixed lpsHostId for host ${dynamoHost.id} (${email}) → ${lpsHostId}`);
    } catch (err) {
      console.error("Failed to auto-fix lpsHostId:", err);
    }
  }

  return { lpsHostId, lpsHost };
}

/** Find a DynamoDB host record by email (for lpsHostId lookup) */
async function findDynamoHostByEmail(email: string): Promise<Host | null> {
  try {
    const result = await dynamoDb.send(
      new ScanCommand({
        TableName: TABLES.HOSTS,
        FilterExpression: "email = :email",
        ExpressionAttributeValues: {
          ":email": email.toLowerCase(),
        },
      })
    );
    return (result.Items?.[0] as Host) || null;
  } catch {
    return null;
  }
}

// --- Exported Functions (matching scheduler-db.ts signatures) ---

/** Check if LPS schedule integration is configured */
export function isLpsScheduleConfigured(): boolean {
  return isLpsConfigured();
}

/** Get LPS host ID by email. Returns the numeric LPS idHost, or null. */
export async function getTalentIdByEmail(email: string): Promise<number | null> {
  try {
    const result = await resolveLpsHostId(email);
    return result ? result.lpsHostId : null;
  } catch (error) {
    console.error("LPS: Error fetching host by email:", error);
    throw error;
  }
}

/** Get schedule entries for a talent with optional date range and limit */
export async function getScheduleForTalent(
  talentId: number,
  options?: {
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }
): Promise<ScheduleEntry[]> {
  try {
    const rooms = await getRooms();

    // Build WHERE clauses
    const where: Array<{ field: string; condition: "=" | ">=" | "<="; value: string | number; isNumber?: boolean }> = [
      { field: FIELDS.schedule.hostId, condition: "=", value: talentId, isNumber: true },
    ];

    if (options?.startDate) {
      where.push({
        field: FIELDS.schedule.startingOn,
        condition: ">=",
        value: toLpsDateValue(options.startDate),
      });
    }

    if (options?.endDate) {
      where.push({
        field: FIELDS.schedule.startingOn,
        condition: "<=",
        value: toLpsDateValue(options.endDate),
      });
    }

    const rows = await lpsRead<LpsScheduleRow>("host_schedule", {
      where,
      sort: { field: FIELDS.schedule.startingOn, direction: "ASC" },
    });

    // We need the host info for the name/email fields.
    // Fetch the LPS host record.
    let hostName = "Unknown";
    let hostEmail = "";
    if (rows.length > 0) {
      const lpsHosts = await lpsRead<LpsHost>("host", {
        where: [{ field: FIELDS.host.id, condition: "=", value: talentId, isNumber: true }],
      });
      if (lpsHosts.length > 0) {
        const h = lpsHosts[0];
        hostName = `${h[FIELDS.host.firstName] || ""} ${h[FIELDS.host.lastName] || ""}`.trim();
        hostEmail = String(h[FIELDS.host.email] || "");
      }
    }

    let entries = rows.map((row) =>
      toScheduleEntry(row, { id: talentId, name: hostName, email: hostEmail }, rooms)
    );

    if (options?.limit) {
      entries = entries.slice(0, options.limit);
    }

    return entries;
  } catch (error) {
    console.error("LPS: Error fetching schedule for talent:", error);
    throw error;
  }
}

/** Get upcoming schedule entries (from now, limited) */
export async function getUpcomingSchedule(
  talentId: number,
  limit: number = 5
): Promise<ScheduleEntry[]> {
  return getScheduleForTalent(talentId, {
    startDate: new Date(),
    limit,
  });
}

/** Get schedule entries for a specific month */
export async function getScheduleForMonth(
  talentId: number,
  year: number,
  month: number
): Promise<ScheduleEntry[]> {
  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0, 23, 59, 59);

  return getScheduleForTalent(talentId, { startDate, endDate });
}

/** Get all schedule entries for a date range (all hosts) */
export async function getAllSchedulesForRange(
  startDate: Date,
  endDate: Date
): Promise<ScheduleEntry[]> {
  try {
    const rooms = await getRooms();

    const rows = await lpsRead<LpsScheduleRow>("host_schedule", {
      where: [
        { field: FIELDS.schedule.startingOn, condition: ">=", value: toLpsDateValue(startDate) },
        { field: FIELDS.schedule.startingOn, condition: "<=", value: toLpsDateValue(endDate) },
      ],
      sort: { field: FIELDS.schedule.startingOn, direction: "ASC" },
    });

    if (rows.length === 0) return [];

    // Collect unique host IDs and batch-fetch host records
    const uniqueHostIds = Array.from(new Set(rows.map((r) => r[FIELDS.schedule.hostId] as number)));
    const hostMap = new Map<number, { name: string; email: string }>();

    // Fetch hosts in parallel (each is a separate API call since no batch read)
    await Promise.all(
      uniqueHostIds.map(async (hostId) => {
        try {
          const hosts = await lpsRead<LpsHost>("host", {
            where: [{ field: FIELDS.host.id, condition: "=", value: hostId, isNumber: true }],
          });
          if (hosts.length > 0) {
            const h = hosts[0];
            hostMap.set(hostId, {
              name: `${h[FIELDS.host.firstName] || ""} ${h[FIELDS.host.lastName] || ""}`.trim(),
              email: String(h[FIELDS.host.email] || ""),
            });
          }
        } catch {
          // Skip hosts that fail to load
        }
      })
    );

    return rows.map((row) => {
      const hostId = row[FIELDS.schedule.hostId] as number;
      const host = hostMap.get(hostId) || { name: "Unknown", email: "" };
      return toScheduleEntry(row, { id: hostId, ...host }, rooms);
    });
  } catch (error) {
    console.error("LPS: Error fetching all schedules:", error);
    throw error;
  }
}
