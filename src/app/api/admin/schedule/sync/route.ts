import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { hasPermission } from "@/lib/roles";
import { getAllSchedulesForRange, isSchedulerDbConfigured } from "@/lib/scheduler-db";
import {
  syncSchedulesToCalendar,
  isGoogleCalendarConfigured,
  getCalendarMappings,
} from "@/lib/google-calendar";
import { getMockScheduleEntriesForRange, TEST_HOSTS } from "@/lib/mock-schedule-data";

// POST /api/admin/schedule/sync - Trigger Google Calendar sync
export async function POST(request: NextRequest) {
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check admin permission
  const userRole = (sessionClaims?.metadata as { role?: string })?.role;
  if (!hasPermission(userRole as Parameters<typeof hasPermission>[0], "manageSchedule")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Check Google Calendar configuration
  if (!isGoogleCalendarConfigured()) {
    return NextResponse.json(
      { error: "Google Calendar not configured. Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY." },
      { status: 503 }
    );
  }

  const calendarMappings = getCalendarMappings();
  if (calendarMappings.size === 0) {
    return NextResponse.json(
      { error: "No calendar mappings configured. Set GOOGLE_CALENDAR_MAIN_ROOM, GOOGLE_CALENDAR_SPEED_BINGO, GOOGLE_CALENDAR_BREAK." },
      { status: 503 }
    );
  }

  try {
    // Parse request body for date range and options
    const body = await request.json().catch(() => ({}));
    const {
      startDate = new Date().toISOString(),
      endDate,
      useMockData = false, // Option to force mock data
    } = body as { startDate?: string; endDate?: string; useMockData?: boolean };

    // Default to syncing next 14 days
    const start = new Date(startDate);
    const end = endDate
      ? new Date(endDate)
      : new Date(start.getTime() + 14 * 24 * 60 * 60 * 1000);

    let schedules;
    let usingMock = false;

    // Try to use real DB, fall back to mock data
    if (isSchedulerDbConfigured() && !useMockData) {
      // Fetch all schedules from MySQL
      schedules = await getAllSchedulesForRange(start, end);
    } else {
      // Use mock data with test hosts
      usingMock = true;
      schedules = getMockScheduleEntriesForRange(TEST_HOSTS, start, end);
    }

    if (schedules.length === 0) {
      return NextResponse.json({
        message: "No schedules found for the specified date range",
        synced: 0,
        dateRange: { start: start.toISOString(), end: end.toISOString() },
        usingMockData: usingMock,
      });
    }

    // Sync to Google Calendar
    const result = await syncSchedulesToCalendar(schedules);

    return NextResponse.json({
      message: `Synced ${result.created} events to Google Calendar`,
      synced: result.created,
      errors: result.errors.length > 0 ? result.errors : undefined,
      dateRange: { start: start.toISOString(), end: end.toISOString() },
      calendars: Array.from(calendarMappings.keys()),
      usingMockData: usingMock,
      hostsIncluded: Array.from(new Set(schedules.map(s => s.talentName))).length,
    });
  } catch (error) {
    console.error("Error syncing to Google Calendar:", error);
    return NextResponse.json(
      { error: "Failed to sync schedules" },
      { status: 500 }
    );
  }
}

// GET /api/admin/schedule/sync - Get sync status/configuration
export async function GET() {
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userRole = (sessionClaims?.metadata as { role?: string })?.role;
  if (!hasPermission(userRole as Parameters<typeof hasPermission>[0], "manageSchedule")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const schedulerConfigured = isSchedulerDbConfigured();
  const calendarConfigured = isGoogleCalendarConfigured();
  const calendarMappings = getCalendarMappings();

  return NextResponse.json({
    configured: {
      schedulerDb: schedulerConfigured,
      googleCalendar: calendarConfigured,
      calendarMappings: calendarMappings.size > 0,
    },
    calendars: Array.from(calendarMappings.entries()).map(([studio, id]) => ({
      studio,
      calendarId: id.substring(0, 20) + "...", // Partial ID for security
    })),
    // Ready if Google Calendar is set up - can use mock data if scheduler DB not available
    ready: calendarConfigured && calendarMappings.size > 0,
    willUseMockData: !schedulerConfigured,
    envVarsNeeded: {
      googleCalendar: ["GOOGLE_SERVICE_ACCOUNT_EMAIL", "GOOGLE_PRIVATE_KEY"],
      calendarMappings: ["GOOGLE_CALENDAR_MAIN_ROOM", "GOOGLE_CALENDAR_SPEED_BINGO", "GOOGLE_CALENDAR_BREAK"],
    },
  });
}
