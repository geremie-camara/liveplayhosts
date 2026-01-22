import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoDb, TABLES } from "@/lib/dynamodb";
import { UserAvailability, WeeklyAvailability, BlockedDateRange } from "@/lib/types";

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
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await dynamoDb.send(
      new GetCommand({
        TableName: TABLES.AVAILABILITY,
        Key: { userId },
      })
    );

    if (!result.Item) {
      // Return default availability if none exists
      return NextResponse.json({
        userId,
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

// PUT /api/availability - Update current user's availability
export async function PUT(request: NextRequest) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const now = new Date().toISOString();

  // Validate weekly availability
  const weekly: WeeklyAvailability = body.weekly || DEFAULT_WEEKLY;
  const blockedDates: BlockedDateRange[] = body.blockedDates || [];

  const availability: UserAvailability = {
    userId,
    weekly,
    blockedDates,
    updatedAt: now,
  };

  try {
    await dynamoDb.send(
      new PutCommand({
        TableName: TABLES.AVAILABILITY,
        Item: availability,
      })
    );

    return NextResponse.json(availability);
  } catch (error) {
    console.error("Error saving availability:", error);
    return NextResponse.json({ error: "Failed to save availability" }, { status: 500 });
  }
}
