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
function getCalendarClient(): calendar_v3.Calendar {
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!serviceAccountEmail || !privateKey) {
    throw new Error("Google Calendar credentials not configured");
  }

  const auth = new google.auth.JWT({
    email: serviceAccountEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/calendar"],
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
  // Format: GOOGLE_CALENDAR_STUDIO_A=calendar-id@group.calendar.google.com
  const studioNames = ["A", "B", "C", "D", "E", "VIRTUAL"];

  for (const name of studioNames) {
    const envKey = `GOOGLE_CALENDAR_STUDIO_${name}`;
    const calendarId = process.env[envKey];
    if (calendarId) {
      const studioName = name === "VIRTUAL" ? "Virtual" : `Studio ${name}`;
      mappings.set(studioName, calendarId);
    }
  }

  return mappings;
}

// Generate a unique event ID for a schedule entry
function generateEventId(entry: ScheduleEntry): string {
  // Create a consistent ID based on the schedule entry
  return `lph_${entry.id}`;
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
    "Studio A": "1", // Lavender
    "Studio B": "2", // Sage
    "Studio C": "3", // Grape
    "Studio D": "4", // Flamingo
    "Studio E": "5", // Banana
    Virtual: "9", // Blueberry
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

// Sync all schedule entries for a date range to Google Calendar
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

  // Group entries by studio
  const entriesByStudio = new Map<string, ScheduleEntry[]>();
  for (const entry of entries) {
    const studioEntries = entriesByStudio.get(entry.studioName) || [];
    studioEntries.push(entry);
    entriesByStudio.set(entry.studioName, studioEntries);
  }

  // Sync each studio's entries to its calendar
  const studioEntries = Array.from(entriesByStudio.entries());
  for (const [studioName, studioSchedules] of studioEntries) {
    const calendarId = calendarMappings.get(studioName);

    if (!calendarId) {
      result.errors.push(`No calendar configured for ${studioName}`);
      continue;
    }

    for (const entry of studioSchedules) {
      const syncResult = await syncEventToCalendar(entry, calendarId);
      if (syncResult.success) {
        result.created++; // We count all successful syncs as created for simplicity
      } else if (syncResult.error) {
        result.errors.push(`${entry.talentName} at ${studioName}: ${syncResult.error}`);
      }
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
