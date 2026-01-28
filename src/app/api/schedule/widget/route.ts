import { NextRequest, NextResponse } from "next/server";
import {
  getTalentIdByEmail,
  getUpcomingSchedule,
  isSchedulerDbConfigured,
} from "@/lib/scheduler-db";
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
    // Check if we should use mock data or real database
    const useMockData = USING_MOCK_DATA || !isSchedulerDbConfigured();

    if (useMockData) {
      // Use mock data for development
      const entries = getUpcomingMockEntries(primaryEmail, limit);
      const widgetEntries = entries.map(toWidgetEntry);

      return NextResponse.json({
        entries: widgetEntries,
        usingMockData: true,
      });
    }

    // Look up talent by email in scheduler database
    const talentId = await getTalentIdByEmail(primaryEmail);

    if (!talentId) {
      // User not found in scheduler database
      return NextResponse.json({ error: "Not found in scheduling system" }, { status: 404 });
    }

    // Get upcoming schedule entries
    const entries = await getUpcomingSchedule(talentId, limit);
    const widgetEntries = entries.map(toWidgetEntry);

    return NextResponse.json({
      entries: widgetEntries,
    });
  } catch (error) {
    console.error("Error fetching schedule widget data:", error);
    return NextResponse.json({ error: "Failed to fetch schedule" }, { status: 500 });
  }
}
