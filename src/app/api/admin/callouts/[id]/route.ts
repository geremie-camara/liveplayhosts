import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { dynamoDb, TABLES } from "@/lib/dynamodb";
import { GetCommand, UpdateCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { CallOut, CallOutStatus } from "@/lib/schedule-types";

// GET - Fetch a single call out
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, sessionClaims } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = (sessionClaims?.metadata as { role?: string })?.role;
    const allowedRoles = ["admin", "owner", "talent", "producer"];
    if (!userRole || !allowedRoles.includes(userRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const result = await dynamoDb.send(
      new GetCommand({
        TableName: TABLES.CALLOUTS,
        Key: { id },
      })
    );

    if (!result.Item) {
      return NextResponse.json({ error: "Call out not found" }, { status: 404 });
    }

    return NextResponse.json({ callout: result.Item });
  } catch (error) {
    console.error("Error fetching call out:", error);
    return NextResponse.json(
      { error: "Failed to fetch call out" },
      { status: 500 }
    );
  }
}

// PATCH - Update call out status (approve/deny)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, sessionClaims } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = (sessionClaims?.metadata as { role?: string })?.role;
    const allowedRoles = ["admin", "owner", "talent", "producer"];
    if (!userRole || !allowedRoles.includes(userRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { status, notes } = body as { status: CallOutStatus; notes?: string };

    if (!status || !["pending", "approved", "denied"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status. Must be: pending, approved, or denied" },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    // Build update expression
    let updateExpression = "SET #status = :status, updatedAt = :updatedAt, reviewedBy = :reviewedBy, reviewedAt = :reviewedAt";
    const expressionAttributeNames: Record<string, string> = {
      "#status": "status",
    };
    const expressionAttributeValues: Record<string, string> = {
      ":status": status,
      ":updatedAt": now,
      ":reviewedBy": userId,
      ":reviewedAt": now,
    };

    if (notes !== undefined) {
      updateExpression += ", notes = :notes";
      expressionAttributeValues[":notes"] = notes;
    }

    const result = await dynamoDb.send(
      new UpdateCommand({
        TableName: TABLES.CALLOUTS,
        Key: { id },
        UpdateExpression: updateExpression,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: "ALL_NEW",
      })
    );

    return NextResponse.json({
      success: true,
      callout: result.Attributes as CallOut,
    });
  } catch (error) {
    console.error("Error updating call out:", error);
    return NextResponse.json(
      { error: "Failed to update call out" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a call out
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, sessionClaims } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = (sessionClaims?.metadata as { role?: string })?.role;
    const allowedRoles = ["admin", "owner", "talent"];
    if (!userRole || !allowedRoles.includes(userRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    await dynamoDb.send(
      new DeleteCommand({
        TableName: TABLES.CALLOUTS,
        Key: { id },
      })
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting call out:", error);
    return NextResponse.json(
      { error: "Failed to delete call out" },
      { status: 500 }
    );
  }
}
