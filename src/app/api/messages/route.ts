import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { GetCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoDb, TABLES } from "@/lib/dynamodb";
import { UserRole, Host } from "@/lib/types";
import { hasPermission } from "@/lib/roles";
import { getUserDeliveries } from "@/lib/broadcast-sender";
import { Broadcast, UserMessage } from "@/lib/broadcast-types";
import { getPresignedVideoUrl } from "@/lib/s3";
import { getEffectiveHostWithEmailFallback } from "@/lib/host-utils";

// Cache for sender names to avoid repeated lookups
const senderNameCache: Record<string, string> = {};

async function getSenderName(createdBy: string): Promise<string> {
  if (!createdBy) return "LivePlay Team";

  // Check cache first
  if (senderNameCache[createdBy]) {
    return senderNameCache[createdBy];
  }

  try {
    // First try by host ID
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

    // If not found, search by clerkUserId
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

  // Match all img tags with S3 URLs
  const imgRegex = /<img[^>]+src="(https:\/\/[^"]*s3[^"]*amazonaws\.com[^"]*)"/g;
  const matches = Array.from(html.matchAll(imgRegex));

  if (matches.length === 0) {
    return html;
  }

  let processedHtml = html;

  for (const match of matches) {
    const originalUrl = match[1];
    try {
      // Strip any existing query parameters to get the base S3 URL
      const baseUrl = originalUrl.split('?')[0];
      const presignedUrl = await getPresignedVideoUrl(baseUrl);
      processedHtml = processedHtml.replace(originalUrl, presignedUrl);
    } catch (error) {
      console.error(`Failed to get presigned URL for image: ${originalUrl}`, error);
    }
  }

  return processedHtml;
}

// GET /api/messages - Get user's messages
export async function GET() {
  const user = await currentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userRole = user.publicMetadata?.role as UserRole | undefined;

  if (!userRole || !hasPermission(userRole, "viewMessages")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const effectiveResult = await getEffectiveHostWithEmailFallback();
    if (!effectiveResult) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    const host = effectiveResult.host;

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

        messages.push({
          id: broadcast.id,
          broadcastId: broadcast.id,
          subject: broadcast.subject,
          bodyHtml,
          videoUrl,
          linkUrl: broadcast.linkUrl,
          linkText: broadcast.linkText,
          sentAt: broadcast.sentAt || delivery.createdAt,
          readAt: delivery.readAt,
          isRead: !!delivery.readAt,
          senderName,
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
