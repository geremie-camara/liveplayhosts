import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { PutCommand, ScanCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoDb, TABLES } from "@/lib/dynamodb";
import { UserRole } from "@/lib/types";
import { hasPermission } from "@/lib/roles";
import { Broadcast, BroadcastFormData } from "@/lib/broadcast-types";

// GET /api/admin/broadcasts - List all broadcasts
export async function GET(request: NextRequest) {
  const user = await currentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userRole = user.publicMetadata?.role as UserRole | undefined;
  if (!userRole || !hasPermission(userRole, "manageBroadcasts")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Get query params
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  try {
    let broadcasts: Broadcast[];

    if (status) {
      // Use GSI to query by status
      const result = await dynamoDb.send(
        new QueryCommand({
          TableName: TABLES.BROADCASTS,
          IndexName: "status-createdAt-index",
          KeyConditionExpression: "#status = :status",
          ExpressionAttributeNames: {
            "#status": "status",
          },
          ExpressionAttributeValues: {
            ":status": status,
          },
          ScanIndexForward: false, // Newest first
        })
      );
      broadcasts = (result.Items || []) as Broadcast[];
    } else {
      // Scan all broadcasts
      const result = await dynamoDb.send(
        new ScanCommand({ TableName: TABLES.BROADCASTS })
      );
      broadcasts = (result.Items || []) as Broadcast[];
      // Sort by createdAt descending
      broadcasts.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }

    return NextResponse.json(broadcasts);
  } catch (error) {
    console.error("Error fetching broadcasts:", error);
    return NextResponse.json({ error: "Failed to fetch broadcasts" }, { status: 500 });
  }
}

// POST /api/admin/broadcasts - Create new broadcast
export async function POST(request: NextRequest) {
  const user = await currentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userRole = user.publicMetadata?.role as UserRole | undefined;
  if (!userRole || !hasPermission(userRole, "manageBroadcasts")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body: BroadcastFormData = await request.json();

    // Validate required fields
    if (!body.title || !body.subject || !body.bodyHtml) {
      return NextResponse.json(
        { error: "Missing required fields: title, subject, bodyHtml" },
        { status: 400 }
      );
    }

    // Validate recipients: either targetUserIds or targetRoles must be provided
    const hasUserIds = body.targetUserIds && body.targetUserIds.length > 0;
    const hasUserSelection = body.userSelection?.selectedUserIds && body.userSelection.selectedUserIds.length > 0;
    const hasRoles = body.targetRoles && body.targetRoles.length > 0;

    if (!hasUserIds && !hasUserSelection && !hasRoles) {
      return NextResponse.json(
        { error: "At least one recipient must be selected" },
        { status: 400 }
      );
    }

    if (!body.channels || (!body.channels.slack && !body.channels.email && !body.channels.sms)) {
      return NextResponse.json(
        { error: "At least one channel must be selected" },
        { status: 400 }
      );
    }

    // Validate SMS only if SMS channel is enabled
    if (body.channels.sms) {
      if (!body.bodySms) {
        return NextResponse.json(
          { error: "SMS text is required when SMS channel is enabled" },
          { status: 400 }
        );
      }
      if (body.bodySms.length > 160) {
        return NextResponse.json(
          { error: "SMS body must be 160 characters or less" },
          { status: 400 }
        );
      }
    }

    const now = new Date().toISOString();
    const broadcastId = `broadcast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Get creator's host record ID
    const hostResult = await dynamoDb.send(
      new ScanCommand({
        TableName: TABLES.HOSTS,
        FilterExpression: "clerkUserId = :clerkUserId",
        ExpressionAttributeValues: {
          ":clerkUserId": user.id,
        },
      })
    );
    const creatorHostId = hostResult.Items?.[0]?.id || user.id;

    const broadcast: Broadcast = {
      id: broadcastId,
      title: body.title,
      subject: body.subject,
      bodyHtml: body.bodyHtml,
      bodySms: body.bodySms || "",
      videoUrl: body.videoUrl || undefined,
      videoS3Key: body.videoS3Key || undefined,
      linkUrl: body.linkUrl || undefined,
      linkText: body.linkText || undefined,
      targetRoles: body.targetRoles || [],
      targetLocations: body.targetLocations || undefined,
      targetUserIds: body.targetUserIds || body.userSelection?.selectedUserIds || undefined,
      userSelection: body.userSelection || undefined,
      channels: body.channels,
      status: "draft",
      scheduledAt: body.scheduledAt || undefined,
      templateId: body.templateId || undefined,
      createdBy: creatorHostId,
      createdAt: now,
      updatedAt: now,
    };

    await dynamoDb.send(
      new PutCommand({
        TableName: TABLES.BROADCASTS,
        Item: broadcast,
      })
    );

    return NextResponse.json(broadcast, { status: 201 });
  } catch (error) {
    console.error("Error creating broadcast:", error);
    return NextResponse.json({ error: "Failed to create broadcast" }, { status: 500 });
  }
}
