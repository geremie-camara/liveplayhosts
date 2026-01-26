import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { GetCommand, UpdateCommand, DeleteCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoDb, TABLES } from "@/lib/dynamodb";
import { UserRole, Host } from "@/lib/types";
import { hasPermission } from "@/lib/roles";
import { Broadcast, BroadcastFormData } from "@/lib/broadcast-types";
import { getBroadcastDeliveries } from "@/lib/broadcast-sender";
import { getPresignedVideoUrl } from "@/lib/s3";

// Cache for sender names to avoid repeated lookups
const senderNameCache: Record<string, string> = {};

async function getSenderName(createdBy: string): Promise<string> {
  if (!createdBy) return "LivePlay Team";

  if (senderNameCache[createdBy]) {
    return senderNameCache[createdBy];
  }

  try {
    const hostResult = await dynamoDb.send(
      new GetCommand({
        TableName: TABLES.HOSTS,
        Key: { id: createdBy },
      })
    );

    if (hostResult.Item) {
      const host = hostResult.Item as Host;
      const name = `${host.firstName} ${host.lastName}`.trim();
      senderNameCache[createdBy] = name;
      return name;
    }

    const clerkResult = await dynamoDb.send(
      new ScanCommand({
        TableName: TABLES.HOSTS,
        FilterExpression: "clerkUserId = :clerkId",
        ExpressionAttributeValues: { ":clerkId": createdBy },
      })
    );

    if (clerkResult.Items && clerkResult.Items.length > 0) {
      const host = clerkResult.Items[0] as Host;
      const name = `${host.firstName} ${host.lastName}`.trim();
      senderNameCache[createdBy] = name;
      return name;
    }
  } catch (error) {
    console.error(`Error looking up sender name for ${createdBy}:`, error);
  }

  return "LivePlay Team";
}

// Process HTML to replace S3 image URLs with presigned URLs
async function processHtmlImages(html: string): Promise<string> {
  if (!html) return html;

  const imgRegex = /<img[^>]+src="(https:\/\/[^"]*s3[^"]*amazonaws\.com[^"]*)"/g;
  const matches = Array.from(html.matchAll(imgRegex));

  if (matches.length === 0) {
    return html;
  }

  let processedHtml = html;

  for (const match of matches) {
    const originalUrl = match[1];
    try {
      const baseUrl = originalUrl.split('?')[0];
      const presignedUrl = await getPresignedVideoUrl(baseUrl);
      processedHtml = processedHtml.replace(originalUrl, presignedUrl);
    } catch (error) {
      console.error(`Failed to get presigned URL for image: ${originalUrl}`, error);
    }
  }

  return processedHtml;
}

// GET /api/admin/broadcasts/[id] - Get single broadcast with stats
export async function GET(
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

    // Generate presigned URL for video if it's an S3 URL
    let videoUrl = broadcast.videoUrl;
    if (videoUrl && videoUrl.includes('s3') && videoUrl.includes('amazonaws.com')) {
      try {
        const baseUrl = videoUrl.split('?')[0];
        videoUrl = await getPresignedVideoUrl(baseUrl);
      } catch (error) {
        console.error(`Failed to get presigned URL for video: ${videoUrl}`, error);
      }
    }

    // Process images in bodyHtml to get presigned URLs
    let bodyHtml = broadcast.bodyHtml;
    if (bodyHtml && bodyHtml.includes('s3') && bodyHtml.includes('amazonaws.com')) {
      bodyHtml = await processHtmlImages(bodyHtml);
    }

    // Get sender name
    const senderName = await getSenderName(broadcast.createdBy);

    const processedBroadcast = {
      ...broadcast,
      videoUrl,
      bodyHtml,
      senderName,
    };

    // If sent, include delivery count
    if (broadcast.status === "sent" || broadcast.status === "sending") {
      const deliveries = await getBroadcastDeliveries(id);
      return NextResponse.json({
        ...processedBroadcast,
        deliveryCount: deliveries.length,
      });
    }

    return NextResponse.json(processedBroadcast);
  } catch (error) {
    console.error("Error fetching broadcast:", error);
    return NextResponse.json({ error: "Failed to fetch broadcast" }, { status: 500 });
  }
}

// PUT /api/admin/broadcasts/[id] - Update broadcast (draft/scheduled only)
export async function PUT(
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
    // Check if broadcast exists and is editable
    const existingResult = await dynamoDb.send(
      new GetCommand({
        TableName: TABLES.BROADCASTS,
        Key: { id },
      })
    );

    if (!existingResult.Item) {
      return NextResponse.json({ error: "Broadcast not found" }, { status: 404 });
    }

    const existing = existingResult.Item as Broadcast;

    if (existing.status !== "draft" && existing.status !== "scheduled") {
      return NextResponse.json(
        { error: "Cannot edit broadcast with status: " + existing.status },
        { status: 400 }
      );
    }

    const body: Partial<BroadcastFormData> = await request.json();
    const now = new Date().toISOString();

    // Build update expression dynamically
    const updateFields: string[] = [];
    const expressionNames: Record<string, string> = {};
    const expressionValues: Record<string, unknown> = {};

    const allowedFields = [
      "title",
      "subject",
      "bodyHtml",
      "bodySms",
      "videoUrl",
      "videoS3Key",
      "linkUrl",
      "linkText",
      "targetRoles",
      "targetLocations",
      "targetUserIds",
      "userSelection",
      "channels",
      "scheduledAt",
      "templateId",
    ];

    for (const field of allowedFields) {
      if (field in body) {
        updateFields.push(`#${field} = :${field}`);
        expressionNames[`#${field}`] = field;
        expressionValues[`:${field}`] = (body as Record<string, unknown>)[field];
      }
    }

    // Always update updatedAt
    updateFields.push("updatedAt = :updatedAt");
    expressionValues[":updatedAt"] = now;

    // Validate SMS length if updating
    if (body.bodySms && body.bodySms.length > 160) {
      return NextResponse.json(
        { error: "SMS body must be 160 characters or less" },
        { status: 400 }
      );
    }

    await dynamoDb.send(
      new UpdateCommand({
        TableName: TABLES.BROADCASTS,
        Key: { id },
        UpdateExpression: `SET ${updateFields.join(", ")}`,
        ExpressionAttributeNames: Object.keys(expressionNames).length > 0 ? expressionNames : undefined,
        ExpressionAttributeValues: expressionValues,
        ReturnValues: "ALL_NEW",
      })
    );

    // Fetch updated record
    const updatedResult = await dynamoDb.send(
      new GetCommand({
        TableName: TABLES.BROADCASTS,
        Key: { id },
      })
    );

    return NextResponse.json(updatedResult.Item);
  } catch (error) {
    console.error("Error updating broadcast:", error);
    return NextResponse.json({ error: "Failed to update broadcast" }, { status: 500 });
  }
}

// DELETE /api/admin/broadcasts/[id] - Delete broadcast (draft only)
export async function DELETE(
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
    // Check if broadcast exists and is deletable
    const existingResult = await dynamoDb.send(
      new GetCommand({
        TableName: TABLES.BROADCASTS,
        Key: { id },
      })
    );

    if (!existingResult.Item) {
      return NextResponse.json({ error: "Broadcast not found" }, { status: 404 });
    }

    const existing = existingResult.Item as Broadcast;

    if (existing.status !== "draft") {
      return NextResponse.json(
        { error: "Only draft broadcasts can be deleted" },
        { status: 400 }
      );
    }

    await dynamoDb.send(
      new DeleteCommand({
        TableName: TABLES.BROADCASTS,
        Key: { id },
      })
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting broadcast:", error);
    return NextResponse.json({ error: "Failed to delete broadcast" }, { status: 500 });
  }
}
