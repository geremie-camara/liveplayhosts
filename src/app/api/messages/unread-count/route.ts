import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoDb, TABLES } from "@/lib/dynamodb";
import { UserRole } from "@/lib/types";
import { hasPermission } from "@/lib/roles";
import { getUnreadCount } from "@/lib/broadcast-sender";

// GET /api/messages/unread-count - Get unread message count
export async function GET() {
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userRole = (sessionClaims?.metadata as { role?: UserRole })?.role;
  if (!userRole || !hasPermission(userRole, "viewMessages")) {
    return NextResponse.json({ count: 0 });
  }

  try {
    // Find the user's host record
    const hostResult = await dynamoDb.send(
      new ScanCommand({
        TableName: TABLES.HOSTS,
        FilterExpression: "clerkUserId = :clerkUserId",
        ExpressionAttributeValues: {
          ":clerkUserId": userId,
        },
      })
    );

    const host = hostResult.Items?.[0];
    if (!host) {
      return NextResponse.json({ count: 0 });
    }

    const count = await getUnreadCount(host.id);

    return NextResponse.json({ count });
  } catch (error) {
    console.error("Error fetching unread count:", error);
    return NextResponse.json({ count: 0 });
  }
}
