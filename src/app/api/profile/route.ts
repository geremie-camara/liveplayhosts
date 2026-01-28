import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoDb, TABLES } from "@/lib/dynamodb";
import { Host } from "@/lib/types";
import { getEffectiveHostWithEmailFallback } from "@/lib/host-utils";

// GET /api/profile - Get current user's profile
export async function GET() {
  try {
    const effectiveResult = await getEffectiveHostWithEmailFallback();
    if (!effectiveResult) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const host = effectiveResult.host;

    // Remove sensitive fields before returning
    const { slackId, slackChannelId, notes, ...safeHost } = host;

    return NextResponse.json(safeHost);
  } catch (error) {
    console.error("Error fetching profile:", error);
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
  }
}

// PUT /api/profile - Update current user's profile
export async function PUT(request: NextRequest) {
  const effectiveResult = await getEffectiveHostWithEmailFallback();
  if (!effectiveResult) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }
  const host = effectiveResult.host;

  const body = await request.json();
  const now = new Date().toISOString();

  try {

    // Build update expression dynamically
    const updateFields: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, unknown> = {};

    // Fields that users CAN update (excluding role, slackId, slackChannelId, notes)
    const allowedFields = [
      "firstName", "lastName", "email", "phone", "birthday", "location",
      "address", "socialProfiles", "experience", "videoReelUrl", "headshotUrl",
      "headshotExternalUrl"
    ];

    // Track if email changed for future downstream workflows
    const emailChanged = body.email && body.email.toLowerCase() !== host.email.toLowerCase();

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateFields.push(`#${field} = :${field}`);
        expressionAttributeNames[`#${field}`] = field;
        // Lowercase email for consistency
        if (field === "email") {
          expressionAttributeValues[`:${field}`] = body[field].toLowerCase();
        } else {
          expressionAttributeValues[`:${field}`] = body[field];
        }
      }
    }

    // Always update updatedAt
    updateFields.push("#updatedAt = :updatedAt");
    expressionAttributeNames["#updatedAt"] = "updatedAt";
    expressionAttributeValues[":updatedAt"] = now;

    if (updateFields.length === 1) {
      // Only updatedAt, no actual changes
      return NextResponse.json({ host, message: "No changes to save" });
    }

    const result = await dynamoDb.send(
      new UpdateCommand({
        TableName: TABLES.HOSTS,
        Key: { id: host.id },
        UpdateExpression: `SET ${updateFields.join(", ")}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: "ALL_NEW",
      })
    );

    const updatedHost = result.Attributes as Host;

    // Remove sensitive fields before returning
    const { slackId, slackChannelId, notes, ...safeHost } = updatedHost;

    // Log email change for future tracking
    if (emailChanged) {
      console.log(`[PROFILE UPDATE] User ${host.id} changed email from ${host.email} to ${body.email}`);
      // Future: Add webhook/notification for downstream workflows
    }

    return NextResponse.json({
      host: safeHost,
      message: emailChanged ? "Profile updated. Email change may take a moment to sync." : "Profile updated successfully"
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
