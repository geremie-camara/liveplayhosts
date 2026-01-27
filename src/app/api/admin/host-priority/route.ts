import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { dynamoDb, TABLES } from "@/lib/dynamodb";
import { ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { hasPermission, getUserRole } from "@/lib/roles";
import { Host, SchedulingPriority } from "@/lib/types";

// GET - Fetch all hosts with their priority
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check permission
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const userRole = getUserRole(user.publicMetadata);

    if (!hasPermission(userRole, "manageHostPriority")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch all hosts (role = "host")
    const result = await dynamoDb.send(
      new ScanCommand({
        TableName: TABLES.HOSTS,
        FilterExpression: "#role = :role",
        ExpressionAttributeNames: { "#role": "role" },
        ExpressionAttributeValues: { ":role": "host" },
      })
    );

    const hosts = (result.Items || []) as Host[];

    // Sort alphabetically by last name, then first name
    hosts.sort((a, b) => {
      const lastNameCompare = (a.lastName || "").localeCompare(b.lastName || "");
      if (lastNameCompare !== 0) return lastNameCompare;
      return (a.firstName || "").localeCompare(b.firstName || "");
    });

    return NextResponse.json({ hosts });
  } catch (error) {
    console.error("Error fetching hosts for priority:", error);
    return NextResponse.json(
      { error: "Failed to fetch hosts" },
      { status: 500 }
    );
  }
}

// PATCH - Update a host's priority
export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check permission
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const userRole = getUserRole(user.publicMetadata);

    if (!hasPermission(userRole, "manageHostPriority")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { hostId, priority } = body as {
      hostId: string;
      priority: SchedulingPriority | null;
    };

    if (!hostId) {
      return NextResponse.json({ error: "Host ID required" }, { status: 400 });
    }

    // Validate priority value
    if (priority !== null && !["high", "medium", "low"].includes(priority)) {
      return NextResponse.json(
        { error: "Invalid priority value" },
        { status: 400 }
      );
    }

    // Update the host's priority
    const updateExpression = priority
      ? "SET schedulingPriority = :priority, updatedAt = :updatedAt"
      : "REMOVE schedulingPriority SET updatedAt = :updatedAt";

    const expressionValues: Record<string, string> = {
      ":updatedAt": new Date().toISOString(),
    };

    if (priority) {
      expressionValues[":priority"] = priority;
    }

    await dynamoDb.send(
      new UpdateCommand({
        TableName: TABLES.HOSTS,
        Key: { id: hostId },
        UpdateExpression: updateExpression,
        ExpressionAttributeValues: expressionValues,
      })
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating host priority:", error);
    return NextResponse.json(
      { error: "Failed to update priority" },
      { status: 500 }
    );
  }
}
