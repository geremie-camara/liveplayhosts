import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { GetCommand, PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoDb, TABLES } from "@/lib/dynamodb";
import { UserAvailability, WeeklyAvailability, BlockedDateRange, AvailabilityChangeLog, Host } from "@/lib/types";
import { v4 as uuidv4 } from "uuid";

const DEFAULT_WEEKLY: WeeklyAvailability = {
  monday: { enabled: false, startTime: "09:00", endTime: "17:00" },
  tuesday: { enabled: false, startTime: "09:00", endTime: "17:00" },
  wednesday: { enabled: false, startTime: "09:00", endTime: "17:00" },
  thursday: { enabled: false, startTime: "09:00", endTime: "17:00" },
  friday: { enabled: false, startTime: "09:00", endTime: "17:00" },
  saturday: { enabled: false, startTime: "09:00", endTime: "17:00" },
  sunday: { enabled: false, startTime: "09:00", endTime: "17:00" },
};

// GET /api/availability - Get current user's availability
export async function GET() {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Look up host by clerkUserId to get host.id
    const host = await getHostByClerkId(clerkUserId);
    if (!host) {
      // Return default availability if host not found
      return NextResponse.json({
        userId: "",
        weekly: DEFAULT_WEEKLY,
        blockedDates: [],
      });
    }

    const result = await dynamoDb.send(
      new GetCommand({
        TableName: TABLES.AVAILABILITY,
        Key: { userId: host.id },
      })
    );

    if (!result.Item) {
      // Return default availability if none exists
      return NextResponse.json({
        userId: host.id,
        weekly: DEFAULT_WEEKLY,
        blockedDates: [],
      });
    }

    return NextResponse.json(result.Item as UserAvailability);
  } catch (error) {
    console.error("Error fetching availability:", error);
    return NextResponse.json({ error: "Failed to fetch availability" }, { status: 500 });
  }
}

// Helper to compare weekly availability and generate summary
function compareWeeklyAvailability(
  before: WeeklyAvailability,
  after: WeeklyAvailability
): { changed: boolean; summary: string } {
  const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
  const changes: string[] = [];

  for (const day of days) {
    const b = before[day];
    const a = after[day];
    const dayName = day.charAt(0).toUpperCase() + day.slice(1);

    if (b.enabled !== a.enabled) {
      if (a.enabled) {
        changes.push(`${dayName}: enabled (${a.startTime}-${a.endTime})`);
      } else {
        changes.push(`${dayName}: disabled`);
      }
    } else if (b.enabled && a.enabled) {
      if (b.startTime !== a.startTime || b.endTime !== a.endTime) {
        changes.push(`${dayName}: ${b.startTime}-${b.endTime} → ${a.startTime}-${a.endTime}`);
      }
    }
  }

  return {
    changed: changes.length > 0,
    summary: changes.length > 0 ? changes.join("; ") : "No changes",
  };
}

// Helper to compare blocked dates and generate summary
function compareBlockedDates(
  before: BlockedDateRange[],
  after: BlockedDateRange[]
): { changed: boolean; added: BlockedDateRange[]; removed: BlockedDateRange[]; summary: string } {
  const beforeIds = new Set(before.map(b => b.id));
  const afterIds = new Set(after.map(a => a.id));

  const added = after.filter(a => !beforeIds.has(a.id));
  const removed = before.filter(b => !afterIds.has(b.id));

  const changes: string[] = [];

  for (const r of removed) {
    changes.push(`Removed: ${r.startDate} to ${r.endDate}${r.reason ? ` (${r.reason})` : ""}`);
  }

  for (const a of added) {
    changes.push(`Added: ${a.startDate} to ${a.endDate}${a.reason ? ` (${a.reason})` : ""}`);
  }

  return {
    changed: changes.length > 0,
    added,
    removed,
    summary: changes.length > 0 ? changes.join("; ") : "No changes",
  };
}

// Helper to get host info by clerkUserId
async function getHostByClerkId(clerkUserId: string): Promise<Host | null> {
  try {
    const result = await dynamoDb.send(
      new ScanCommand({
        TableName: TABLES.HOSTS,
        FilterExpression: "clerkUserId = :clerkUserId",
        ExpressionAttributeValues: {
          ":clerkUserId": clerkUserId,
        },
      })
    );
    return (result.Items?.[0] as Host) || null;
  } catch {
    return null;
  }
}

// PUT /api/availability - Update current user's availability
export async function PUT(request: NextRequest) {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Look up host by clerkUserId to get host.id
  const host = await getHostByClerkId(clerkUserId);
  if (!host) {
    return NextResponse.json({ error: "Host record not found" }, { status: 404 });
  }

  const body = await request.json();
  const now = new Date().toISOString();

  // Validate weekly availability
  const weekly: WeeklyAvailability = body.weekly || DEFAULT_WEEKLY;
  const blockedDates: BlockedDateRange[] = body.blockedDates || [];

  try {
    // Fetch current availability for comparison
    const currentResult = await dynamoDb.send(
      new GetCommand({
        TableName: TABLES.AVAILABILITY,
        Key: { userId: host.id },
      })
    );

    const currentAvailability = currentResult.Item as UserAvailability | undefined;
    const previousWeekly = currentAvailability?.weekly || DEFAULT_WEEKLY;
    const previousBlockedDates = currentAvailability?.blockedDates || [];

    // Compare changes
    const weeklyComparison = compareWeeklyAvailability(previousWeekly, weekly);
    const blockedComparison = compareBlockedDates(previousBlockedDates, blockedDates);

    // Save the new availability (userId stores host.id, not Clerk userId)
    const availability: UserAvailability = {
      userId: host.id,
      weekly,
      blockedDates,
      updatedAt: now,
    };

    await dynamoDb.send(
      new PutCommand({
        TableName: TABLES.AVAILABILITY,
        Item: availability,
      })
    );

    // Log the change if anything changed
    if (weeklyComparison.changed || blockedComparison.changed) {
      // Get user info for additional context
      const user = await currentUser();

      const hostName = `${host.firstName} ${host.lastName}`;
      const hostEmail = host.email || user?.emailAddresses?.[0]?.emailAddress || "unknown";

      let changeType: "weekly" | "blocked_dates" | "both";
      if (weeklyComparison.changed && blockedComparison.changed) {
        changeType = "both";
      } else if (weeklyComparison.changed) {
        changeType = "weekly";
      } else {
        changeType = "blocked_dates";
      }

      const changeLog: AvailabilityChangeLog = {
        id: uuidv4(),
        odIndex: "ALL", // Used for global queries ordered by date
        userId: host.id, // userId stores host.id, not Clerk userId
        hostName,
        hostEmail,
        changeType,
        changes: {
          ...(weeklyComparison.changed && {
            weekly: {
              before: previousWeekly,
              after: weekly,
              summary: weeklyComparison.summary,
            },
          }),
          ...(blockedComparison.changed && {
            blockedDates: {
              added: blockedComparison.added,
              removed: blockedComparison.removed,
              summary: blockedComparison.summary,
            },
          }),
        },
        createdAt: now,
      };

      // Save the change log (don't fail the request if this fails)
      try {
        await dynamoDb.send(
          new PutCommand({
            TableName: TABLES.AVAILABILITY_CHANGELOG,
            Item: changeLog,
          })
        );
      } catch (logError) {
        console.error("Error saving availability change log:", logError);
        // Don't fail the request, just log the error
      }
    }

    return NextResponse.json(availability);
  } catch (error) {
    console.error("Error saving availability:", error);
    return NextResponse.json({ error: "Failed to save availability" }, { status: 500 });
  }
}
