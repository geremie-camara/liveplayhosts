import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoDb, TABLES } from "@/lib/dynamodb";
import { UserRole } from "@/lib/types";
import { hasPermission } from "@/lib/roles";
import { getUnreadCount } from "@/lib/broadcast-sender";

// GET /api/messages/unread-count - Get unread message count
export async function GET() {
  const user = await currentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = user.id;
  const userRole = user.publicMetadata?.role as UserRole | undefined;

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

    // Fallback: if not found by clerkUserId, try by email
    if (!host) {
      const userEmail = user.emailAddresses[0]?.emailAddress;
      if (userEmail) {
        hostResult = await dynamoDb.send(
          new ScanCommand({
            TableName: TABLES.HOSTS,
            FilterExpression: "email = :email",
            ExpressionAttributeValues: {
              ":email": userEmail.toLowerCase(),
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
