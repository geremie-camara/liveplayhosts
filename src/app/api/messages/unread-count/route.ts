import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
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
    // Find the user's host record by clerkUserId
    let hostResult = await dynamoDb.send(
      new ScanCommand({
        TableName: TABLES.HOSTS,
        FilterExpression: "clerkUserId = :clerkUserId",
        ExpressionAttributeValues: {
          ":clerkUserId": userId,
        },
      })
    );

    let host = hostResult.Items?.[0];

    // Fallback: if not found by clerkUserId, try by email from session
    if (!host) {
      const userEmail = sessionClaims?.email as string | undefined;
      if (userEmail) {
        hostResult = await dynamoDb.send(
          new ScanCommand({
            TableName: TABLES.HOSTS,
            FilterExpression: "email = :email",
            ExpressionAttributeValues: {
              ":email": userEmail,
            },
          })
        );
        host = hostResult.Items?.[0];

        // Auto-fix: Update the host record with clerkUserId for future lookups
        if (host && !host.clerkUserId) {
          await dynamoDb.send(
            new UpdateCommand({
              TableName: TABLES.HOSTS,
              Key: { id: host.id },
              UpdateExpression: "SET clerkUserId = :clerkUserId",
              ExpressionAttributeValues: {
                ":clerkUserId": userId,
              },
            })
          );
        }
      }
    }

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
