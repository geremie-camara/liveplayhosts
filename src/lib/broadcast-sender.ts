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
import { sendSlackDM, isSlackConfigured, findSlackUserByEmail } from "./slack";
import { sendBroadcastEmail, isEmailConfigured } from "./email";
import { sendBroadcastSms, isSmsConfigured } from "./sms";

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
  delivery: BroadcastDelivery
): Promise<{ slack: boolean; email: boolean; sms: boolean }> {
  const results = { slack: false, email: false, sms: false };

  // Send Slack DM
  if (broadcast.channels.slack && isSlackConfigured()) {
    // Determine the Slack user ID to use
    let slackUserId: string | null = null;

    // Check if slackId looks like a valid Slack user ID (starts with U or W)
    if (host.slackId && /^[UW][A-Z0-9]+$/.test(host.slackId)) {
      slackUserId = host.slackId;
    } else if (host.email) {
      // Look up by email if slackId is not a valid ID (might be a handle)
      slackUserId = await findSlackUserByEmail(host.email);
    }

    if (slackUserId) {
      const slackResult = await sendSlackDM(
        slackUserId,
        broadcast.subject,
        broadcast.bodyHtml,
        broadcast.videoUrl,
        broadcast.linkUrl,
        broadcast.linkText
      );

      await updateDeliveryStatus(
        delivery.id,
        "slack",
        slackResult.success ? "sent" : "failed",
        slackResult.messageId,
        slackResult.error
      );

      results.slack = slackResult.success;
    } else {
      await updateDeliveryStatus(delivery.id, "slack", "skipped", undefined, "No valid Slack ID found");
    }
  } else if (broadcast.channels.slack && !isSlackConfigured()) {
    await updateDeliveryStatus(delivery.id, "slack", "skipped", undefined, "Slack not configured");
  }

  // Send Email
  if (broadcast.channels.email && host.email && isEmailConfigured()) {
    const emailResult = await sendBroadcastEmail(
      host.email,
      broadcast.subject,
      broadcast.bodyHtml,
      broadcast.videoUrl,
      broadcast.linkUrl,
      broadcast.linkText
    );

    await updateDeliveryStatus(
      delivery.id,
      "email",
      emailResult.success ? "sent" : "failed",
      emailResult.messageId,
      emailResult.error
    );

    results.email = emailResult.success;
  }

  // Send SMS
  if (broadcast.channels.sms && host.phone && isSmsConfigured()) {
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
  }

  // Send to Host Producer Channel (slackChannelId) - additional send, no separate tracking
  if (broadcast.channels.hostProducerChannel && isSlackConfigured()) {
    // Check if slackChannelId looks like a valid Slack ID (starts with U, W, or C for channels)
    let prodSlackId: string | null = null;

    if (host.slackChannelId && /^[UWC][A-Z0-9]+$/.test(host.slackChannelId)) {
      prodSlackId = host.slackChannelId;
    }

    if (prodSlackId) {
      try {
        await sendSlackDM(
          prodSlackId,
          broadcast.subject,
          broadcast.bodyHtml,
          broadcast.videoUrl,
          broadcast.linkUrl,
          broadcast.linkText
        );
      } catch (error) {
        console.error(`Failed to send to Slack Channel ID for ${host.id}:`, error);
      }
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

    // Check for targetUserIds (from userSelection.selectedUserIds)
    if (broadcast.targetUserIds && broadcast.targetUserIds.length > 0) {
      hosts = await getHostsByIds(broadcast.targetUserIds);
    } else if (broadcast.userSelection?.selectedUserIds && broadcast.userSelection.selectedUserIds.length > 0) {
      // Also check userSelection for backwards compatibility
      hosts = await getHostsByIds(broadcast.userSelection.selectedUserIds);
    } else {
      // Fall back to role-based targeting (legacy support)
      hosts = await getTargetHosts(broadcast.targetRoles);
    }

    if (hosts.length === 0) {
      await updateBroadcastStatus(broadcastId, "failed");
      return { success: false, error: "No recipients found for the selected users" };
    }

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

      // Send via all channels
      const results = await sendToHost(broadcast, host, delivery);

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
