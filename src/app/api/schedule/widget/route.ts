import { NextRequest, NextResponse } from "next/server";
import {
  getTalentIdByEmail,
  getUpcomingSchedule,
  isSchedulerDbConfigured,
} from "@/lib/scheduler-db";
import {
  getTalentIdByEmail as lpsGetTalentIdByEmail,
  getUpcomingSchedule as lpsGetUpcomingSchedule,
  isLpsScheduleConfigured,
} from "@/lib/lps-schedule";
import { toWidgetEntry } from "@/lib/schedule-types";
import { getUpcomingMockEntries, USING_MOCK_DATA } from "@/lib/mock-schedule-data";
import { getEffectiveHost } from "@/lib/host-utils";

// GET /api/schedule/widget - Get upcoming schedule for dashboard widget
export async function GET(request: NextRequest) {
  const effectiveResult = await getEffectiveHost();
  if (!effectiveResult) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const primaryEmail = effectiveResult.host.email;

  if (!primaryEmail) {
    return NextResponse.json({ error: "No email found" }, { status: 400 });
  }

  // Get limit from query params (default 5, max 100)
  const searchParams = request.nextUrl.searchParams;
  const limitParam = searchParams.get("limit");
  const limit = Math.min(Math.max(parseInt(limitParam || "5") || 5, 1), 100);

  try {
    // Three-tier fallback: mock → LPS API → MySQL
    if (USING_MOCK_DATA) {
      // Use mock data for development
      const entries = getUpcomingMockEntries(primaryEmail, limit);
      const widgetEntries = entries.map(toWidgetEntry);

      return NextResponse.json({
        entries: widgetEntries,
        usingMockData: true,
      });
    }

    if (isLpsScheduleConfigured()) {
      // Use LPS Dungeon Data Service API
      const talentId = await lpsGetTalentIdByEmail(primaryEmail);

      if (!talentId) {
        return NextResponse.json({ error: "Not found in scheduling system" }, { status: 404 });
      }

      const entries = await lpsGetUpcomingSchedule(talentId, limit);
      const widgetEntries = entries.map(toWidgetEntry);

      return NextResponse.json({
        entries: widgetEntries,
      });
    }

    if (isSchedulerDbConfigured()) {
      // Legacy MySQL fallback
      const talentId = await getTalentIdByEmail(primaryEmail);

      if (!talentId) {
        return NextResponse.json({ error: "Not found in scheduling system" }, { status: 404 });
      }

      const entries = await getUpcomingSchedule(talentId, limit);
      const widgetEntries = entries.map(toWidgetEntry);

      return NextResponse.json({
        entries: widgetEntries,
      });
    }

    // No data source available — fall back to mock
    const entries = getUpcomingMockEntries(primaryEmail, limit);
    const widgetEntries = entries.map(toWidgetEntry);

    return NextResponse.json({
      entries: widgetEntries,
      usingMockData: true,
    });
  } catch (error) {
    console.error("Error fetching schedule widget data:", error);
    return NextResponse.json({ error: "Failed to fetch schedule" }, { status: 500 });
  }
}
