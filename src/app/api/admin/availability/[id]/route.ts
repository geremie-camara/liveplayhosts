import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { dynamoDb, TABLES } from "@/lib/dynamodb";
import { GetCommand, PutCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { hasPermission, getUserRole } from "@/lib/roles";
import { UserAvailability, WeeklyAvailability, BlockedDateRange } from "@/lib/types";

// GET - Fetch a specific host's availability
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const userRole = getUserRole(user.publicMetadata);

    if (!hasPermission(userRole, "manageAvailability")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: hostId } = await params;

    const result = await dynamoDb.send(
      new GetCommand({
        TableName: TABLES.AVAILABILITY,
        Key: { hostId },
      })
    );

    return NextResponse.json({ availability: result.Item || null });
  } catch (error) {
    console.error("Error fetching availability:", error);
    return NextResponse.json(
      { error: "Failed to fetch availability" },
      { status: 500 }
    );
  }
}

// PUT - Update a host's availability
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const userRole = getUserRole(user.publicMetadata);

    if (!hasPermission(userRole, "manageAvailability")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: hostId } = await params;
    const body = await request.json();
    const { weekly, blockedDates, notes } = body as {
      weekly: WeeklyAvailability;
      blockedDates: BlockedDateRange[];
      notes?: string;
    };

    if (!weekly) {
      return NextResponse.json(
        { error: "Weekly availability required" },
        { status: 400 }
      );
    }

    const availability: UserAvailability & { notes?: string } = {
      hostId,
      weekly,
      blockedDates: blockedDates || [],
      updatedAt: new Date().toISOString(),
      notes,
    };

    await dynamoDb.send(
      new PutCommand({
        TableName: TABLES.AVAILABILITY,
        Item: availability,
      })
    );

    return NextResponse.json({ success: true, availability });
  } catch (error) {
    console.error("Error updating availability:", error);
    return NextResponse.json(
      { error: "Failed to update availability" },
      { status: 500 }
    );
  }
}

// DELETE - Clear a host's availability
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const userRole = getUserRole(user.publicMetadata);

    if (!hasPermission(userRole, "manageAvailability")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: hostId } = await params;

    await dynamoDb.send(
      new DeleteCommand({
        TableName: TABLES.AVAILABILITY,
        Key: { hostId },
      })
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting availability:", error);
    return NextResponse.json(
      { error: "Failed to delete availability" },
      { status: 500 }
    );
  }
}
