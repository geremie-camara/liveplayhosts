import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ScanCommand, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoDb, TABLES } from "@/lib/dynamodb";
import { UserRole } from "@/lib/types";
import { hasPermission } from "@/lib/roles";
import { getUserDeliveries } from "@/lib/broadcast-sender";
import { Broadcast, UserMessage } from "@/lib/broadcast-types";

// GET /api/messages - Get user's messages
export async function GET() {
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userRole = (sessionClaims?.metadata as { role?: UserRole })?.role;
  if (!userRole || !hasPermission(userRole, "viewMessages")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
          console.log(`Auto-fixed clerkUserId for host ${host.id} (${userEmail})`);
        }
      }
    }

    if (!host) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get user's deliveries
    const deliveries = await getUserDeliveries(host.id);

    // Get broadcast details for each delivery
    const messages: UserMessage[] = [];

    for (const delivery of deliveries) {
      const broadcastResult = await dynamoDb.send(
        new GetCommand({
          TableName: TABLES.BROADCASTS,
          Key: { id: delivery.broadcastId },
        })
      );

      const broadcast = broadcastResult.Item as Broadcast | undefined;

      if (broadcast && broadcast.status === "sent") {
        messages.push({
          id: broadcast.id,
          broadcastId: broadcast.id,
          subject: broadcast.subject,
          bodyHtml: broadcast.bodyHtml,
          videoUrl: broadcast.videoUrl,
          linkUrl: broadcast.linkUrl,
          linkText: broadcast.linkText,
          sentAt: broadcast.sentAt || delivery.createdAt,
          readAt: delivery.readAt,
          isRead: !!delivery.readAt,
        });
      }
    }

    // Sort by sentAt descending (newest first)
    messages.sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());

    return NextResponse.json(messages);
  } catch (error) {
    console.error("Error fetching messages:", error);
    return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
  }
}
