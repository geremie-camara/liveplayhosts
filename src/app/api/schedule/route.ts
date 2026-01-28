import { NextRequest, NextResponse } from "next/server";
import {
  getTalentIdByEmail,
  getScheduleForMonth,
  isSchedulerDbConfigured,
} from "@/lib/scheduler-db";
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
    // Check if we should use mock data or real database
    const useMockData = USING_MOCK_DATA || !isSchedulerDbConfigured();

    if (useMockData) {
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

    // Look up talent by email in scheduler database
    const talentId = await getTalentIdByEmail(primaryEmail);

    if (!talentId) {
      // User not found in scheduler database
      return NextResponse.json({ error: "Not found in scheduling system" }, { status: 404 });
    }

    // Get schedule for the specified month
    const entries = await getScheduleForMonth(talentId, year, month);

    return NextResponse.json({
      entries: entries.map((e) => ({
        ...e,
        startingOn: e.startingOn.toISOString(),
        endingOn: e.endingOn.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Error fetching schedule:", error);
    return NextResponse.json({ error: "Failed to fetch schedule" }, { status: 500 });
  }
}
