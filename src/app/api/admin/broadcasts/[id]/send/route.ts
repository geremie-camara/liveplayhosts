import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoDb, TABLES } from "@/lib/dynamodb";
import { UserRole } from "@/lib/types";
import { hasPermission } from "@/lib/roles";
import { Broadcast } from "@/lib/broadcast-types";
import { sendBroadcast, getTargetHosts, getHostsByIds } from "@/lib/broadcast-sender";

// POST /api/admin/broadcasts/[id]/send - Send broadcast immediately or schedule
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await currentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userRole = user.publicMetadata?.role as UserRole | undefined;
  if (!userRole || !hasPermission(userRole, "manageBroadcasts")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    // Get broadcast
    const result = await dynamoDb.send(
      new GetCommand({
        TableName: TABLES.BROADCASTS,
        Key: { id },
      })
    );

    if (!result.Item) {
      return NextResponse.json({ error: "Broadcast not found" }, { status: 404 });
    }

    const broadcast = result.Item as Broadcast;

    if (broadcast.status !== "draft" && broadcast.status !== "scheduled") {
      return NextResponse.json(
        { error: `Cannot send broadcast with status: ${broadcast.status}` },
        { status: 400 }
      );
    }

    // Parse body for scheduling
    const body = await request.json().catch(() => ({}));
    const scheduledAt = body.scheduledAt as string | undefined;

    if (scheduledAt) {
      // Schedule for later
      const scheduledDate = new Date(scheduledAt);
      if (scheduledDate <= new Date()) {
        return NextResponse.json(
          { error: "Scheduled time must be in the future" },
          { status: 400 }
        );
      }

      await dynamoDb.send(
        new UpdateCommand({
          TableName: TABLES.BROADCASTS,
          Key: { id },
          UpdateExpression: "SET #status = :status, scheduledAt = :scheduledAt, updatedAt = :now",
          ExpressionAttributeNames: {
            "#status": "status",
          },
          ExpressionAttributeValues: {
            ":status": "scheduled",
            ":scheduledAt": scheduledAt,
            ":now": new Date().toISOString(),
          },
        })
      );

      return NextResponse.json({
        success: true,
        status: "scheduled",
        scheduledAt,
      });
    }

    // Send immediately
    // First, get recipient count for validation
    let hosts;
    if (broadcast.targetUserIds && broadcast.targetUserIds.length > 0) {
      hosts = await getHostsByIds(broadcast.targetUserIds);
    } else if (broadcast.userSelection?.selectedUserIds && broadcast.userSelection.selectedUserIds.length > 0) {
      hosts = await getHostsByIds(broadcast.userSelection.selectedUserIds);
    } else if (broadcast.targetRoles && broadcast.targetRoles.length > 0) {
      hosts = await getTargetHosts(broadcast.targetRoles);
    } else {
      return NextResponse.json(
        { error: "No recipients configured for this broadcast" },
        { status: 400 }
      );
    }

    if (hosts.length === 0) {
      return NextResponse.json(
        { error: "No recipients found for the selected users" },
        { status: 400 }
      );
    }

    // Send the broadcast
    const sendResult = await sendBroadcast(id);

    if (!sendResult.success) {
      return NextResponse.json(
        { error: sendResult.error || "Failed to send broadcast" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      status: "sent",
      stats: sendResult.stats,
    });
  } catch (error) {
    console.error("Error sending broadcast:", error);
    return NextResponse.json({ error: "Failed to send broadcast" }, { status: 500 });
  }
}
