import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { hasPermission } from "@/lib/roles";
import { getAllSchedulesForRange, isSchedulerDbConfigured } from "@/lib/scheduler-db";
import {
  syncSchedulesToCalendar,
  isGoogleCalendarConfigured,
  getCalendarMappings,
} from "@/lib/google-calendar";

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

  // Check configuration
  if (!isSchedulerDbConfigured()) {
    return NextResponse.json(
      { error: "Scheduler database not configured" },
      { status: 503 }
    );
  }

  if (!isGoogleCalendarConfigured()) {
    return NextResponse.json(
      { error: "Google Calendar not configured" },
      { status: 503 }
    );
  }

  const calendarMappings = getCalendarMappings();
  if (calendarMappings.size === 0) {
    return NextResponse.json(
      { error: "No calendar mappings configured" },
      { status: 503 }
    );
  }

  try {
    // Parse request body for date range
    const body = await request.json().catch(() => ({}));
    const {
      startDate = new Date().toISOString(),
      endDate,
    } = body as { startDate?: string; endDate?: string };

    // Default to syncing next 30 days
    const start = new Date(startDate);
    const end = endDate
      ? new Date(endDate)
      : new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Fetch all schedules from MySQL
    const schedules = await getAllSchedulesForRange(start, end);

    if (schedules.length === 0) {
      return NextResponse.json({
        message: "No schedules found for the specified date range",
        synced: 0,
        dateRange: { start: start.toISOString(), end: end.toISOString() },
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
    ready: schedulerConfigured && calendarConfigured && calendarMappings.size > 0,
  });
}
