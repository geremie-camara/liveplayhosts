import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoDb, TABLES } from "@/lib/dynamodb";
import { UserRole } from "@/lib/types";
import { hasPermission } from "@/lib/roles";
import { markMessageAsRead } from "@/lib/broadcast-sender";

// POST /api/messages/[id]/read - Mark message as read
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await currentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = user.id;
  const userRole = user.publicMetadata?.role as UserRole | undefined;

  if (!userRole || !hasPermission(userRole, "viewMessages")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: broadcastId } = await params;

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
          console.log(`Auto-fixed clerkUserId for host ${host.id} (${userEmail})`);
        }
      }
    }

    if (!host) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Mark as read
    await markMessageAsRead(broadcastId, host.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error marking message as read:", error);
    return NextResponse.json({ error: "Failed to mark message as read" }, { status: 500 });
  }
}
