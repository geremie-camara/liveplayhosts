import { ScanCommand, GetCommand, PutCommand, UpdateCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoDb, TABLES } from "./dynamodb";
import { Host } from "./types";
import {
  Broadcast,
  BroadcastDelivery,
  BroadcastStats,
  DeliveryStatus,
  BROADCASTS_PER_DAY_LIMIT,
} from "./broadcast-types";
import { sendSlackDM, isSlackConfigured } from "./slack";
import { sendBroadcastEmail, isEmailConfigured } from "./email";
import { sendBroadcastSms, isSmsConfigured } from "./sms";
import { getPresignedVideoUrl } from "./s3";

// Process HTML to replace S3 image URLs with presigned URLs
async function processHtmlImages(html: string): Promise<string> {
  // Match all img tags with S3 URLs
  const imgRegex = /<img[^>]+src="(https:\/\/[^"]*s3[^"]*amazonaws\.com[^"]*)"/g;
  const matches = Array.from(html.matchAll(imgRegex));

  if (matches.length === 0) {
    return html;
  }

  let processedHtml = html;

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const originalUrl = match[1];
    try {
      const presignedUrl = await getPresignedVideoUrl(originalUrl);
      processedHtml = processedHtml.replace(originalUrl, presignedUrl);
    } catch (error) {
      console.error(`Failed to get presigned URL for image: ${originalUrl}`, error);
    }
  }

  return processedHtml;
}

// Get broadcast by ID
export async function getBroadcast(broadcastId: string): Promise<Broadcast | null> {
  const result = await dynamoDb.send(
    new GetCommand({
      TableName: TABLES.BROADCASTS,
      Key: { id: broadcastId },
    })
  );
  return (result.Item as Broadcast) || null;
}

// Get hosts by target roles (legacy support)
export async function getTargetHosts(targetRoles: string[]): Promise<Host[]> {
  const result = await dynamoDb.send(
    new ScanCommand({
      TableName: TABLES.HOSTS,
    })
  );

  const hosts = (result.Items || []) as Host[];

  // Filter by target roles
  return hosts.filter((host) => targetRoles.includes(host.role));
}

// Get hosts by specific user IDs
export async function getHostsByIds(userIds: string[]): Promise<Host[]> {
  if (!userIds || userIds.length === 0) {
    return [];
  }

  const result = await dynamoDb.send(
    new ScanCommand({
      TableName: TABLES.HOSTS,
    })
  );

  const hosts = (result.Items || []) as Host[];

  // Filter by the specific IDs
  return hosts.filter((host) => userIds.includes(host.id));
}

// Check rate limit for a user (max broadcasts per day)
export async function checkRateLimit(userId: string): Promise<boolean> {
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const todayStart = `${today}T00:00:00.000Z`;

  // Query deliveries for this user created today
  const result = await dynamoDb.send(
    new QueryCommand({
      TableName: TABLES.BROADCAST_DELIVERIES,
      IndexName: "userId-createdAt-index",
      KeyConditionExpression: "userId = :userId AND createdAt >= :todayStart",
      ExpressionAttributeValues: {
        ":userId": userId,
        ":todayStart": todayStart,
      },
    })
  );

  const deliveryCount = result.Items?.length || 0;
  return deliveryCount < BROADCASTS_PER_DAY_LIMIT;
}

// Create delivery record for a user
async function createDeliveryRecord(
  broadcast: Broadcast,
  host: Host
): Promise<BroadcastDelivery> {
  const now = new Date().toISOString();

  const delivery: BroadcastDelivery = {
    id: `${broadcast.id}#${host.id}`,
    broadcastId: broadcast.id,
    userId: host.id,
    userEmail: host.email,
    userName: `${host.firstName} ${host.lastName}`,
    slack: {
      status: broadcast.channels.slack ? "pending" : "skipped",
    },
    email: {
      status: broadcast.channels.email ? "pending" : "skipped",
    },
    sms: {
      status: broadcast.channels.sms ? "pending" : "skipped",
    },
    createdAt: now,
  };

  await dynamoDb.send(
    new PutCommand({
      TableName: TABLES.BROADCAST_DELIVERIES,
      Item: delivery,
    })
  );

  return delivery;
}

// Update delivery status for a specific channel
async function updateDeliveryStatus(
  deliveryId: string,
  channel: "slack" | "email" | "sms",
  status: DeliveryStatus,
  messageId?: string,
  error?: string
): Promise<void> {
  const now = new Date().toISOString();

  const updateData: Record<string, unknown> = {
    status,
  };

  if (status === "sent") {
    updateData.sentAt = now;
    if (messageId) {
      updateData.messageId = messageId;
    }
  } else if (status === "failed" && error) {
    updateData.error = error;
  }

  await dynamoDb.send(
    new UpdateCommand({
      TableName: TABLES.BROADCAST_DELIVERIES,
      Key: { id: deliveryId },
      UpdateExpression: `SET #channel = :channelData`,
      ExpressionAttributeNames: {
        "#channel": channel,
      },
      ExpressionAttributeValues: {
        ":channelData": updateData,
      },
    })
  );
}

// Send broadcast to a single host
async function sendToHost(
  broadcast: Broadcast,
  host: Host,
  delivery: BroadcastDelivery,
  senderName: string
): Promise<{ slack: boolean; email: boolean; sms: boolean }> {
  const results = { slack: false, email: false, sms: false };

  // Send Slack DM
  if (broadcast.channels.slack) {
    if (!isSlackConfigured()) {
      console.log(`Slack not configured for host ${host.id}`);
      await updateDeliveryStatus(delivery.id, "slack", "skipped", undefined, "Slack not configured");
    } else if (!host.slackId) {
      console.log(`No Slack ID for host ${host.id}`);
      await updateDeliveryStatus(delivery.id, "slack", "skipped", undefined, "No Slack ID");
    } else {
      console.log(`Sending Slack to ${host.slackId} for host ${host.id}`);
      const slackResult = await sendSlackDM(
        host.slackId,
        broadcast.subject,
        broadcast.bodyHtml,
        broadcast.videoUrl,
        broadcast.linkUrl,
        broadcast.linkText,
        senderName
      );

      await updateDeliveryStatus(
        delivery.id,
        "slack",
        slackResult.success ? "sent" : "failed",
        slackResult.messageId,
        slackResult.error
      );

      results.slack = slackResult.success;
      console.log(`Slack result for ${host.id}: ${slackResult.success ? "sent" : "failed"} - ${slackResult.error || ""}`);
    }
  }

  // Send Email
  if (broadcast.channels.email) {
    if (!isEmailConfigured()) {
      console.log(`Email not configured for host ${host.id}`);
      await updateDeliveryStatus(delivery.id, "email", "skipped", undefined, "Email not configured");
    } else if (!host.email) {
      console.log(`No email for host ${host.id}`);
      await updateDeliveryStatus(delivery.id, "email", "skipped", undefined, "No email address");
    } else {
      console.log(`Sending email to ${host.email} for host ${host.id}`);
      const emailResult = await sendBroadcastEmail(
        host.email,
        broadcast.subject,
        broadcast.bodyHtml,
        broadcast.videoUrl,
        broadcast.linkUrl,
        broadcast.linkText,
        senderName
      );

      await updateDeliveryStatus(
        delivery.id,
        "email",
        emailResult.success ? "sent" : "failed",
        emailResult.messageId,
        emailResult.error
      );

      results.email = emailResult.success;
      console.log(`Email result for ${host.id}: ${emailResult.success ? "sent" : "failed"} - ${emailResult.error || ""}`);
    }
  }

  // Send SMS
  if (broadcast.channels.sms) {
    if (!isSmsConfigured()) {
      console.log(`SMS not configured for host ${host.id}`);
      await updateDeliveryStatus(delivery.id, "sms", "skipped", undefined, "SMS not configured");
    } else if (!host.phone) {
      console.log(`No phone for host ${host.id}`);
      await updateDeliveryStatus(delivery.id, "sms", "skipped", undefined, "No phone number");
    } else {
      console.log(`Sending SMS to ${host.phone} for host ${host.id}`);
      const smsResult = await sendBroadcastSms(
        host.phone,
        broadcast.subject,
        broadcast.bodySms,
        broadcast.id
      );

      await updateDeliveryStatus(
        delivery.id,
        "sms",
        smsResult.success ? "sent" : "failed",
        smsResult.messageId,
        smsResult.error
      );

      results.sms = smsResult.success;
      console.log(`SMS result for ${host.id}: ${smsResult.success ? "sent" : "failed"} - ${smsResult.error || ""}`);
    }
  }

  // Send to Host Producer Channel (slackChannelId) - additional send, no separate tracking
  if (broadcast.channels.hostProducerChannel && host.slackChannelId && isSlackConfigured()) {
    try {
      await sendSlackDM(
        host.slackChannelId,
        broadcast.subject,
        broadcast.bodyHtml,
        broadcast.videoUrl,
        broadcast.linkUrl,
        broadcast.linkText,
        senderName
      );
    } catch (error) {
      console.error(`Failed to send to Slack Channel ID for ${host.id}:`, error);
    }
  }

  return results;
}

// Update broadcast status
export async function updateBroadcastStatus(
  broadcastId: string,
  status: Broadcast["status"],
  stats?: BroadcastStats
): Promise<void> {
  const now = new Date().toISOString();

  const updateExpression = stats
    ? "SET #status = :status, updatedAt = :now, stats = :stats, sentAt = :sentAt"
    : "SET #status = :status, updatedAt = :now";

  const expressionValues: Record<string, unknown> = {
    ":status": status,
    ":now": now,
  };

  if (stats) {
    expressionValues[":stats"] = stats;
    expressionValues[":sentAt"] = now;
  }

  await dynamoDb.send(
    new UpdateCommand({
      TableName: TABLES.BROADCASTS,
      Key: { id: broadcastId },
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: {
        "#status": "status",
      },
      ExpressionAttributeValues: expressionValues,
    })
  );
}

// Main function to send a broadcast
export async function sendBroadcast(broadcastId: string): Promise<{
  success: boolean;
  stats?: BroadcastStats;
  error?: string;
}> {
  try {
    // 1. Get broadcast from DB
    const broadcast = await getBroadcast(broadcastId);
    if (!broadcast) {
      return { success: false, error: "Broadcast not found" };
    }

    if (broadcast.status !== "draft" && broadcast.status !== "scheduled") {
      return { success: false, error: `Cannot send broadcast with status: ${broadcast.status}` };
    }

    // 2. Update status to sending
    await updateBroadcastStatus(broadcastId, "sending");

    // 3. Get target hosts - prefer specific user IDs, fall back to role-based targeting
    let hosts: Host[];
    let targetSource = "";

    // Check for targetUserIds (from userSelection.selectedUserIds)
    if (broadcast.targetUserIds && broadcast.targetUserIds.length > 0) {
      hosts = await getHostsByIds(broadcast.targetUserIds);
      targetSource = `targetUserIds: ${broadcast.targetUserIds.join(", ")}`;
    } else if (broadcast.userSelection?.selectedUserIds && broadcast.userSelection.selectedUserIds.length > 0) {
      // Also check userSelection for backwards compatibility
      hosts = await getHostsByIds(broadcast.userSelection.selectedUserIds);
      targetSource = `userSelection.selectedUserIds: ${broadcast.userSelection.selectedUserIds.join(", ")}`;
    } else if (broadcast.targetRoles && broadcast.targetRoles.length > 0) {
      // Fall back to role-based targeting (legacy support)
      hosts = await getTargetHosts(broadcast.targetRoles);
      targetSource = `targetRoles: ${broadcast.targetRoles.join(", ")}`;
    } else {
      await updateBroadcastStatus(broadcastId, "failed");
      console.error("Broadcast has no targeting data:", {
        targetUserIds: broadcast.targetUserIds,
        userSelection: broadcast.userSelection,
        targetRoles: broadcast.targetRoles,
      });
      return { success: false, error: "No targeting data found (no userIds, userSelection, or roles)" };
    }

    console.log(`Broadcast ${broadcastId} targeting: ${targetSource}, found ${hosts.length} hosts`);

    // Get sender's name (createdBy can be either host ID or Clerk user ID)
    let senderName = "LivePlay Team";
    if (broadcast.createdBy) {
      // First try by host ID
      let senderHosts = await getHostsByIds([broadcast.createdBy]);
      // If not found, search by clerkUserId
      if (senderHosts.length === 0) {
        const allHosts = await dynamoDb.send(
          new ScanCommand({
            TableName: TABLES.HOSTS,
            FilterExpression: "clerkUserId = :clerkId",
            ExpressionAttributeValues: { ":clerkId": broadcast.createdBy },
          })
        );
        senderHosts = (allHosts.Items || []) as Host[];
      }
      if (senderHosts.length > 0) {
        senderName = `${senderHosts[0].firstName} ${senderHosts[0].lastName}`.trim();
      }
    }

    if (hosts.length === 0) {
      await updateBroadcastStatus(broadcastId, "failed");
      console.error(`No hosts found for broadcast ${broadcastId}. Target: ${targetSource}`);
      return { success: false, error: `No recipients found. Target: ${targetSource}` };
    }

    // Generate presigned URL for video if present (7 day expiration)
    let videoUrl = broadcast.videoUrl;
    if (videoUrl && videoUrl.includes('s3') && videoUrl.includes('amazonaws.com')) {
      console.log(`Generating presigned URL for video: ${videoUrl}`);
      videoUrl = await getPresignedVideoUrl(videoUrl);
      console.log(`Presigned URL generated: ${videoUrl.substring(0, 100)}...`);
    }

    // Process bodyHtml to replace S3 image URLs with presigned URLs
    let bodyHtml = broadcast.bodyHtml;
    if (bodyHtml && bodyHtml.includes('s3') && bodyHtml.includes('amazonaws.com')) {
      console.log(`Processing images in bodyHtml...`);
      bodyHtml = await processHtmlImages(bodyHtml);
    }

    // Create a modified broadcast object with presigned URLs
    const broadcastWithPresignedUrl = {
      ...broadcast,
      videoUrl,
      bodyHtml,
    };

    // 4. Initialize stats
    const stats: BroadcastStats = {
      totalRecipients: hosts.length,
      slackSent: 0,
      slackFailed: 0,
      emailSent: 0,
      emailFailed: 0,
      smsSent: 0,
      smsFailed: 0,
      readCount: 0,
    };

    // 5. Send to each host
    for (const host of hosts) {
      // Check rate limit
      const withinLimit = await checkRateLimit(host.id);
      if (!withinLimit) {
        console.log(`Rate limit exceeded for user ${host.id}, skipping`);
        continue;
      }

      // Create delivery record
      const delivery = await createDeliveryRecord(broadcast, host);

      // Send via all channels (using presigned video URL)
      const results = await sendToHost(broadcastWithPresignedUrl, host, delivery, senderName);

      // Update stats
      if (broadcast.channels.slack) {
        if (results.slack) stats.slackSent++;
        else stats.slackFailed++;
      }
      if (broadcast.channels.email) {
        if (results.email) stats.emailSent++;
        else stats.emailFailed++;
      }
      if (broadcast.channels.sms) {
        if (results.sms) stats.smsSent++;
        else stats.smsFailed++;
      }
    }

    // 6. Update broadcast with final status and stats
    await updateBroadcastStatus(broadcastId, "sent", stats);

    return { success: true, stats };
  } catch (error) {
    console.error("Failed to send broadcast:", error);
    await updateBroadcastStatus(broadcastId, "failed");
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Get deliveries for a broadcast
export async function getBroadcastDeliveries(
  broadcastId: string
): Promise<BroadcastDelivery[]> {
  const result = await dynamoDb.send(
    new QueryCommand({
      TableName: TABLES.BROADCAST_DELIVERIES,
      IndexName: "broadcastId-index",
      KeyConditionExpression: "broadcastId = :broadcastId",
      ExpressionAttributeValues: {
        ":broadcastId": broadcastId,
      },
    })
  );

  return (result.Items || []) as BroadcastDelivery[];
}

// Get user's deliveries (for message center)
export async function getUserDeliveries(userId: string): Promise<BroadcastDelivery[]> {
  const result = await dynamoDb.send(
    new QueryCommand({
      TableName: TABLES.BROADCAST_DELIVERIES,
      IndexName: "userId-createdAt-index",
      KeyConditionExpression: "userId = :userId",
      ExpressionAttributeValues: {
        ":userId": userId,
      },
      ScanIndexForward: false, // Newest first
    })
  );

  return (result.Items || []) as BroadcastDelivery[];
}

// Mark message as read
export async function markMessageAsRead(
  broadcastId: string,
  userId: string
): Promise<void> {
  const now = new Date().toISOString();
  const deliveryId = `${broadcastId}#${userId}`;

  await dynamoDb.send(
    new UpdateCommand({
      TableName: TABLES.BROADCAST_DELIVERIES,
      Key: { id: deliveryId },
      UpdateExpression: "SET readAt = :readAt",
      ExpressionAttributeValues: {
        ":readAt": now,
      },
    })
  );

  // Update broadcast read count
  const broadcast = await getBroadcast(broadcastId);
  if (broadcast?.stats) {
    await dynamoDb.send(
      new UpdateCommand({
        TableName: TABLES.BROADCASTS,
        Key: { id: broadcastId },
        UpdateExpression: "SET stats.readCount = stats.readCount + :inc",
        ExpressionAttributeValues: {
          ":inc": 1,
        },
      })
    );
  }
}

// Get unread count for a user
export async function getUnreadCount(userId: string): Promise<number> {
  const deliveries = await getUserDeliveries(userId);
  return deliveries.filter((d) => !d.readAt).length;
}

// Process scheduled broadcasts (called by cron)
export async function processScheduledBroadcasts(): Promise<{
  processed: number;
  errors: string[];
}> {
  const now = new Date().toISOString();

  // Query scheduled broadcasts where scheduledAt <= now
  const result = await dynamoDb.send(
    new QueryCommand({
      TableName: TABLES.BROADCASTS,
      IndexName: "status-scheduledAt-index",
      KeyConditionExpression: "#status = :status AND scheduledAt <= :now",
      ExpressionAttributeNames: {
        "#status": "status",
      },
      ExpressionAttributeValues: {
        ":status": "scheduled",
        ":now": now,
      },
    })
  );

  const broadcasts = (result.Items || []) as Broadcast[];
  const errors: string[] = [];
  let processed = 0;

  for (const broadcast of broadcasts) {
    const sendResult = await sendBroadcast(broadcast.id);
    if (sendResult.success) {
      processed++;
    } else {
      errors.push(`${broadcast.id}: ${sendResult.error}`);
    }
  }

  return { processed, errors };
}
