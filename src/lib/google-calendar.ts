// Google Calendar API integration for syncing schedules

import { google, calendar_v3 } from "googleapis";
import { ScheduleEntry } from "./schedule-types";

// Google Calendar configuration
interface CalendarConfig {
  calendarId: string;
  studioName: string;
}

// Event sync result
interface SyncResult {
  created: number;
  updated: number;
  deleted: number;
  errors: string[];
}

// Get authenticated Google Calendar client
// Uses domain-wide delegation to impersonate a user with calendar write access
function getCalendarClient(): calendar_v3.Calendar {
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const impersonateUser = process.env.GOOGLE_IMPERSONATE_USER;

  if (!serviceAccountEmail || !privateKey) {
    throw new Error("Google Calendar credentials not configured");
  }

  const auth = new google.auth.JWT({
    email: serviceAccountEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/calendar"],
    subject: impersonateUser,
  });

  return google.calendar({ version: "v3", auth });
}

// Check if Google Calendar is configured
export function isGoogleCalendarConfigured(): boolean {
  return !!(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
    process.env.GOOGLE_PRIVATE_KEY
  );
}

// Get calendar ID mappings from environment
export function getCalendarMappings(): Map<string, string> {
  const mappings = new Map<string, string>();

  // Read calendar IDs from environment variables
  // Room name -> env var key mapping
  const roomMappings: Record<string, string> = {
    "Main Room": "GOOGLE_CALENDAR_MAIN_ROOM",
    "Speed Bingo": "GOOGLE_CALENDAR_SPEED_BINGO",
    "Break": "GOOGLE_CALENDAR_BREAK",
  };

  for (const [roomName, envKey] of Object.entries(roomMappings)) {
    const calendarId = process.env[envKey];
    if (calendarId) {
      mappings.set(roomName, calendarId);
    }
  }

  return mappings;
}

// Generate a unique event ID for a schedule entry
// Google Calendar event IDs must only contain lowercase letters a-v and digits 0-9
function generateEventId(entry: ScheduleEntry): string {
  // Create a consistent ID based on the schedule entry
  // Use "lph" prefix + entry id, all lowercase alphanumeric
  return `lph${entry.id}`.toLowerCase().replace(/[^a-v0-9]/g, "");
}

// Create a Google Calendar event from a schedule entry
function createCalendarEvent(entry: ScheduleEntry): calendar_v3.Schema$Event {
  return {
    id: generateEventId(entry),
    summary: entry.talentName,
    description: entry.notes || `LivePlay session with ${entry.talentName}`,
    start: {
      dateTime: entry.startingOn.toISOString(),
      timeZone: "America/Los_Angeles", // PST - adjust as needed
    },
    end: {
      dateTime: entry.endingOn.toISOString(),
      timeZone: "America/Los_Angeles",
    },
    attendees: [
      {
        email: entry.talentEmail,
        displayName: entry.talentName,
      },
    ],
    // Color based on studio (1-11 are available colors)
    colorId: getColorIdForStudio(entry.studioName),
  };
}

// Map studio names to Google Calendar color IDs
function getColorIdForStudio(studioName: string): string {
  const colorMap: Record<string, string> = {
    "Main Room": "9", // Blueberry (blue)
    "Speed Bingo": "10", // Basil (green)
    "Break": "8", // Graphite (gray)
  };
  return colorMap[studioName] || "8"; // Graphite as default
}

// Sync a single schedule entry to Google Calendar
export async function syncEventToCalendar(
  entry: ScheduleEntry,
  calendarId: string
): Promise<{ success: boolean; error?: string }> {
  if (!isGoogleCalendarConfigured()) {
    return { success: false, error: "Google Calendar not configured" };
  }

  try {
    const calendar = getCalendarClient();
    const event = createCalendarEvent(entry);
    const eventId = generateEventId(entry);

    // Try to update existing event, or create new one
    try {
      await calendar.events.update({
        calendarId,
        eventId,
        requestBody: event,
        sendUpdates: "all",
      });
      return { success: true };
    } catch (updateError: unknown) {
      // Event doesn't exist, create it
      const err = updateError as { code?: number };
      if (err.code === 404) {
        await calendar.events.insert({
          calendarId,
          requestBody: event,
          sendUpdates: "all",
        });
        return { success: true };
      }
      throw updateError;
    }
  } catch (error) {
    console.error("Error syncing event to calendar:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Delete an event from Google Calendar
export async function deleteEventFromCalendar(
  entryId: number,
  calendarId: string
): Promise<{ success: boolean; error?: string }> {
  if (!isGoogleCalendarConfigured()) {
    return { success: false, error: "Google Calendar not configured" };
  }

  try {
    const calendar = getCalendarClient();
    const eventId = `lph_${entryId}`;

    await calendar.events.delete({
      calendarId,
      eventId,
      sendUpdates: "all",
    });

    return { success: true };
  } catch (error: unknown) {
    const err = error as { code?: number };
    if (err.code === 404) {
      // Event already deleted
      return { success: true };
    }
    console.error("Error deleting event from calendar:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Helper to process items in parallel with concurrency limit
async function processInBatches<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency: number = 10
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(processor));
    results.push(...batchResults);
  }

  return results;
}

// Sync all schedule entries for a date range to Google Calendar
// Uses parallel processing for speed (10 concurrent requests)
export async function syncSchedulesToCalendar(
  entries: ScheduleEntry[]
): Promise<SyncResult> {
  const result: SyncResult = {
    created: 0,
    updated: 0,
    deleted: 0,
    errors: [],
  };

  if (!isGoogleCalendarConfigured()) {
    result.errors.push("Google Calendar not configured");
    return result;
  }

  const calendarMappings = getCalendarMappings();

  if (calendarMappings.size === 0) {
    result.errors.push("No calendar mappings configured");
    return result;
  }

  // Prepare all sync tasks with their calendar IDs
  const syncTasks: Array<{ entry: ScheduleEntry; calendarId: string }> = [];

  for (const entry of entries) {
    const calendarId = calendarMappings.get(entry.studioName);
    if (calendarId) {
      syncTasks.push({ entry, calendarId });
    } else {
      result.errors.push(`No calendar configured for ${entry.studioName}`);
    }
  }

  // Process all tasks in parallel batches (10 concurrent)
  const syncResults = await processInBatches(
    syncTasks,
    async ({ entry, calendarId }) => {
      const syncResult = await syncEventToCalendar(entry, calendarId);
      return { entry, syncResult };
    },
    10 // 10 concurrent requests - respects Google rate limits
  );

  // Tally results
  for (const { entry, syncResult } of syncResults) {
    if (syncResult.success) {
      result.created++;
    } else if (syncResult.error) {
      result.errors.push(`${entry.talentName} at ${entry.studioName}: ${syncResult.error}`);
    }
  }

  return result;
}

// Get all events from a calendar for a date range
export async function getCalendarEvents(
  calendarId: string,
  startDate: Date,
  endDate: Date
): Promise<calendar_v3.Schema$Event[]> {
  if (!isGoogleCalendarConfigured()) {
    return [];
  }

  try {
    const calendar = getCalendarClient();

    const response = await calendar.events.list({
      calendarId,
      timeMin: startDate.toISOString(),
      timeMax: endDate.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
    });

    return response.data.items || [];
  } catch (error) {
    console.error("Error fetching calendar events:", error);
    return [];
  }
}
