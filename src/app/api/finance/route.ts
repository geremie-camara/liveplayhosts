import { NextRequest, NextResponse } from "next/server";
import {
  getTalentIdByEmail,
  getScheduleForTalent,
  isSchedulerDbConfigured,
} from "@/lib/scheduler-db";
import { getMockEntriesForMonth, USING_MOCK_DATA } from "@/lib/mock-schedule-data";
import { getEffectiveHost } from "@/lib/host-utils";
import { dynamoDb, TABLES } from "@/lib/dynamodb";
import { QueryCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import {
  HOURLY_RATE,
  FinanceReview,
  PayCycleHalf,
  getPayCycleKey,
  getPayCycleDateRange,
} from "@/lib/finance-types";
import { ScheduleEntry } from "@/lib/schedule-types";

// GET /api/finance - Get schedule entries and reviews for a pay period
export async function GET(request: NextRequest) {
  const effectiveResult = await getEffectiveHost();
  if (!effectiveResult) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const host = effectiveResult.host;
  const primaryEmail = host.email;

  if (!primaryEmail) {
    return NextResponse.json({ error: "No email found" }, { status: 400 });
  }

  // Get query parameters
  const searchParams = request.nextUrl.searchParams;
  const year = parseInt(searchParams.get("year") || new Date().getFullYear().toString());
  const month = parseInt(searchParams.get("month") || new Date().getMonth().toString());
  const half = parseInt(searchParams.get("half") || "1") as PayCycleHalf;

  if (half !== 1 && half !== 2) {
    return NextResponse.json({ error: "Invalid half parameter" }, { status: 400 });
  }

  try {
    // Get date range for this pay period
    const { startDate, endDate } = getPayCycleDateRange(year, month, half);
    const payCycleKey = getPayCycleKey(year, month, half);

    // Fetch schedule entries
    let entries: ScheduleEntry[] = [];
    const useMockData = USING_MOCK_DATA || !isSchedulerDbConfigured();

    if (useMockData) {
      // Use mock data — filter to pay period date range
      const monthEntries = getMockEntriesForMonth(primaryEmail, year, month);
      entries = monthEntries.filter((e) => {
        const dateStr = e.startingOn.toISOString().split("T")[0];
        return dateStr >= startDate && dateStr <= endDate;
      });
    } else {
      const talentId = await getTalentIdByEmail(primaryEmail);
      if (!talentId) {
        return NextResponse.json({ error: "Not found in scheduling system" }, { status: 404 });
      }

      // Parse date strings into Date objects for the query
      const start = new Date(startDate + "T00:00:00");
      const end = new Date(endDate + "T23:59:59");
      entries = await getScheduleForTalent(talentId, { startDate: start, endDate: end });
    }

    // Fetch reviews from DynamoDB for this host + date range
    let reviews: FinanceReview[] = [];
    try {
      const result = await dynamoDb.send(
        new QueryCommand({
          TableName: TABLES.FINANCE_REVIEWS,
          KeyConditionExpression: "hostId = :hostId AND #d BETWEEN :start AND :end",
          ExpressionAttributeNames: { "#d": "date" },
          ExpressionAttributeValues: {
            ":hostId": host.id,
            ":start": startDate,
            ":end": endDate,
          },
        })
      );
      reviews = (result.Items || []) as FinanceReview[];
    } catch (err) {
      console.error("Error fetching finance reviews:", err);
      // Continue without reviews — they may not exist yet
    }

    // Build review map by date
    const reviewMap: Record<string, FinanceReview> = {};
    for (const review of reviews) {
      reviewMap[review.date] = review;
    }

    // Group entries by date and compute summary
    const entriesByDate: Record<string, ScheduleEntry[]> = {};
    for (const entry of entries) {
      const dateStr = entry.startingOn.toISOString().split("T")[0];
      if (!entriesByDate[dateStr]) {
        entriesByDate[dateStr] = [];
      }
      entriesByDate[dateStr].push(entry);
    }

    // Compute totals
    let totalHours = 0;
    let daysWorked = 0;
    let daysAccepted = 0;
    let daysDisputed = 0;
    let daysPending = 0;

    for (const dateStr of Object.keys(entriesByDate)) {
      const dayEntries = entriesByDate[dateStr];
      const dayHours = dayEntries.reduce((sum, e) => {
        const hours = (e.endingOn.getTime() - e.startingOn.getTime()) / (1000 * 60 * 60);
        return sum + hours;
      }, 0);

      totalHours += dayHours;
      daysWorked++;

      const review = reviewMap[dateStr];
      if (review?.status === "accepted") {
        daysAccepted++;
      } else if (review?.status === "disputed") {
        daysDisputed++;
      } else {
        daysPending++;
      }
    }

    return NextResponse.json({
      entries: entries.map((e) => ({
        ...e,
        startingOn: e.startingOn.toISOString(),
        endingOn: e.endingOn.toISOString(),
      })),
      reviews: reviewMap,
      payCycleKey,
      summary: {
        totalHours,
        totalPay: totalHours * HOURLY_RATE,
        daysWorked,
        daysAccepted,
        daysDisputed,
        daysPending,
      },
    });
  } catch (error) {
    console.error("Error fetching finance data:", error);
    return NextResponse.json({ error: "Failed to fetch finance data" }, { status: 500 });
  }
}

// POST /api/finance - Accept or dispute a day's pay
export async function POST(request: NextRequest) {
  const effectiveResult = await getEffectiveHost();
  if (!effectiveResult) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const host = effectiveResult.host;

  try {
    const body = await request.json();
    const { date, action, disputeText, year, month, half } = body;

    if (!date || !action) {
      return NextResponse.json({ error: "Missing date or action" }, { status: 400 });
    }

    if (action !== "accept" && action !== "dispute") {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    if (action === "dispute" && !disputeText?.trim()) {
      return NextResponse.json({ error: "Dispute text is required" }, { status: 400 });
    }

    // Compute pay cycle key
    const cycleHalf = (half || (parseInt(date.split("-")[2]) <= 15 ? 1 : 2)) as PayCycleHalf;
    const cycleYear = year || parseInt(date.split("-")[0]);
    const cycleMonth = month !== undefined ? month : parseInt(date.split("-")[1]) - 1;
    const payCycleKey = getPayCycleKey(cycleYear, cycleMonth, cycleHalf);

    // Get schedule entries for this specific day to compute hours
    let dayHours = 0;
    const primaryEmail = host.email;
    const useMockData = USING_MOCK_DATA || !isSchedulerDbConfigured();

    if (useMockData) {
      const monthEntries = getMockEntriesForMonth(primaryEmail, cycleYear, cycleMonth);
      const dayEntries = monthEntries.filter(
        (e) => e.startingOn.toISOString().split("T")[0] === date
      );
      dayHours = dayEntries.reduce((sum, e) => {
        return sum + (e.endingOn.getTime() - e.startingOn.getTime()) / (1000 * 60 * 60);
      }, 0);
    } else {
      const talentId = await getTalentIdByEmail(primaryEmail);
      if (talentId) {
        const dayStart = new Date(date + "T00:00:00");
        const dayEnd = new Date(date + "T23:59:59");
        const dayEntries = await getScheduleForTalent(talentId, {
          startDate: dayStart,
          endDate: dayEnd,
        });
        dayHours = dayEntries.reduce((sum, e) => {
          return sum + (e.endingOn.getTime() - e.startingOn.getTime()) / (1000 * 60 * 60);
        }, 0);
      }
    }

    const now = new Date().toISOString();
    const review: FinanceReview = {
      hostId: host.id,
      date,
      payCycleKey,
      status: action === "accept" ? "accepted" : "disputed",
      disputeText: action === "dispute" ? disputeText.trim() : undefined,
      hoursWorked: dayHours,
      totalPay: dayHours * HOURLY_RATE,
      reviewedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    await dynamoDb.send(
      new PutCommand({
        TableName: TABLES.FINANCE_REVIEWS,
        Item: review,
      })
    );

    return NextResponse.json({ success: true, review });
  } catch (error) {
    console.error("Error saving finance review:", error);
    return NextResponse.json({ error: "Failed to save review" }, { status: 500 });
  }
}
