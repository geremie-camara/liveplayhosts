import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { GetCommand, UpdateCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoDb, TABLES } from "@/lib/dynamodb";
import { Host } from "@/lib/types";

// GET /api/hosts/[id] - Get single host
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (sessionClaims?.metadata as { role?: string })?.role;
  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const result = await dynamoDb.send(
      new GetCommand({
        TableName: TABLES.HOSTS,
        Key: { id },
      })
    );

    if (!result.Item) {
      return NextResponse.json({ error: "Host not found" }, { status: 404 });
    }

    return NextResponse.json(result.Item as Host);
  } catch (error) {
    console.error("Error fetching host:", error);
    return NextResponse.json({ error: "Failed to fetch host" }, { status: 500 });
  }
}

// PUT /api/hosts/[id] - Update host
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (sessionClaims?.metadata as { role?: string })?.role;
  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const now = new Date().toISOString();

  // Build update expression dynamically
  const updateFields: string[] = [];
  const expressionAttributeNames: Record<string, string> = {};
  const expressionAttributeValues: Record<string, unknown> = {};

  // Fields that can be updated
  const allowedFields = [
    "status", "role", "firstName", "lastName", "email", "phone",
    "address", "socialProfiles", "experience", "videoReelUrl", "notes"
  ];

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updateFields.push(`#${field} = :${field}`);
      expressionAttributeNames[`#${field}`] = field;
      expressionAttributeValues[`:${field}`] = body[field];
    }
  }

  // Always update updatedAt
  updateFields.push("#updatedAt = :updatedAt");
  expressionAttributeNames["#updatedAt"] = "updatedAt";
  expressionAttributeValues[":updatedAt"] = now;

  // Handle status change timestamps
  if (body.status === "invited") {
    updateFields.push("#invitedAt = :invitedAt");
    expressionAttributeNames["#invitedAt"] = "invitedAt";
    expressionAttributeValues[":invitedAt"] = now;
  }

  if (body.status === "active") {
    updateFields.push("#hiredAt = :hiredAt");
    expressionAttributeNames["#hiredAt"] = "hiredAt";
    expressionAttributeValues[":hiredAt"] = now;
  }

  try {
    const result = await dynamoDb.send(
      new UpdateCommand({
        TableName: TABLES.HOSTS,
        Key: { id },
        UpdateExpression: `SET ${updateFields.join(", ")}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: "ALL_NEW",
      })
    );

    return NextResponse.json(result.Attributes as Host);
  } catch (error) {
    console.error("Error updating host:", error);
    return NextResponse.json({ error: "Failed to update host" }, { status: 500 });
  }
}

// DELETE /api/hosts/[id] - Delete host
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (sessionClaims?.metadata as { role?: string })?.role;
  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    await dynamoDb.send(
      new DeleteCommand({
        TableName: TABLES.HOSTS,
        Key: { id },
      })
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting host:", error);
    return NextResponse.json({ error: "Failed to delete host" }, { status: 500 });
  }
}
