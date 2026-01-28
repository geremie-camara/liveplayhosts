import { NextRequest, NextResponse } from "next/server";
import {
  getTalentIdByEmail,
  getScheduleForMonth,
  isSchedulerDbConfigured,
} from "@/lib/scheduler-db";
import {
  getTalentIdByEmail as lpsGetTalentIdByEmail,
  getScheduleForMonth as lpsGetScheduleForMonth,
  isLpsScheduleConfigured,
} from "@/lib/lps-schedule";
import { getMockEntriesForMonth, USING_MOCK_DATA } from "@/lib/mock-schedule-data";
import { getEffectiveHost } from "@/lib/host-utils";

// GET /api/schedule - Get user's schedule for a month
export async function GET(request: NextRequest) {
  const effectiveResult = await getEffectiveHost();
  if (!effectiveResult) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const primaryEmail = effectiveResult.host.email;

  if (!primaryEmail) {
    return NextResponse.json({ error: "No email found" }, { status: 400 });
  }

  // Get query parameters
  const searchParams = request.nextUrl.searchParams;
  const year = parseInt(searchParams.get("year") || new Date().getFullYear().toString());
  const month = parseInt(searchParams.get("month") || new Date().getMonth().toString());

  try {
    // Three-tier fallback: mock → LPS API → MySQL
    if (USING_MOCK_DATA) {
      // Use mock data for development
      const entries = getMockEntriesForMonth(primaryEmail, year, month);

      return NextResponse.json({
        entries: entries.map((e) => ({
          ...e,
          startingOn: e.startingOn.toISOString(),
          endingOn: e.endingOn.toISOString(),
        })),
        usingMockData: true,
      });
    }

    if (isLpsScheduleConfigured()) {
      // Use LPS Dungeon Data Service API
      const talentId = await lpsGetTalentIdByEmail(primaryEmail);

      if (!talentId) {
        return NextResponse.json({ error: "Not found in scheduling system" }, { status: 404 });
      }

      const entries = await lpsGetScheduleForMonth(talentId, year, month);

      return NextResponse.json({
        entries: entries.map((e) => ({
          ...e,
          startingOn: e.startingOn.toISOString(),
          endingOn: e.endingOn.toISOString(),
        })),
      });
    }

    if (isSchedulerDbConfigured()) {
      // Legacy MySQL fallback
      const talentId = await getTalentIdByEmail(primaryEmail);

      if (!talentId) {
        return NextResponse.json({ error: "Not found in scheduling system" }, { status: 404 });
      }

      const entries = await getScheduleForMonth(talentId, year, month);

      return NextResponse.json({
        entries: entries.map((e) => ({
          ...e,
          startingOn: e.startingOn.toISOString(),
          endingOn: e.endingOn.toISOString(),
        })),
      });
    }

    // No data source available — fall back to mock
    const entries = getMockEntriesForMonth(primaryEmail, year, month);

    return NextResponse.json({
      entries: entries.map((e) => ({
        ...e,
        startingOn: e.startingOn.toISOString(),
        endingOn: e.endingOn.toISOString(),
      })),
      usingMockData: true,
    });
  } catch (error) {
    console.error("Error fetching schedule:", error);
    return NextResponse.json({ error: "Failed to fetch schedule" }, { status: 500 });
  }
}
