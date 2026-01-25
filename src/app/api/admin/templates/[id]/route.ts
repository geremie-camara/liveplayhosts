import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { GetCommand, UpdateCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoDb, TABLES } from "@/lib/dynamodb";
import { UserRole } from "@/lib/types";
import { hasPermission } from "@/lib/roles";
import { BroadcastTemplate, TemplateFormData } from "@/lib/broadcast-types";

// GET /api/admin/templates/[id] - Get single template
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
        TableName: TABLES.BROADCAST_TEMPLATES,
        Key: { id },
      })
    );

    if (!result.Item) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    return NextResponse.json(result.Item as BroadcastTemplate);
  } catch (error) {
    console.error("Error fetching template:", error);
    return NextResponse.json({ error: "Failed to fetch template" }, { status: 500 });
  }
}

// PUT /api/admin/templates/[id] - Update template
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
    // Check if template exists
    const existingResult = await dynamoDb.send(
      new GetCommand({
        TableName: TABLES.BROADCAST_TEMPLATES,
        Key: { id },
      })
    );

    if (!existingResult.Item) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const body: Partial<TemplateFormData> = await request.json();
    const now = new Date().toISOString();

    // Build update expression dynamically
    const updateFields: string[] = [];
    const expressionNames: Record<string, string> = {};
    const expressionValues: Record<string, unknown> = {};

    const allowedFields = [
      "name",
      "subject",
      "bodyHtml",
      "bodySms",
      "videoUrl",
      "linkUrl",
      "linkText",
      "defaultChannels",
      "defaultUserSelection",
      "variables",
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
        TableName: TABLES.BROADCAST_TEMPLATES,
        Key: { id },
        UpdateExpression: `SET ${updateFields.join(", ")}`,
        ExpressionAttributeNames: Object.keys(expressionNames).length > 0 ? expressionNames : undefined,
        ExpressionAttributeValues: expressionValues,
      })
    );

    // Fetch updated record
    const updatedResult = await dynamoDb.send(
      new GetCommand({
        TableName: TABLES.BROADCAST_TEMPLATES,
        Key: { id },
      })
    );

    return NextResponse.json(updatedResult.Item);
  } catch (error) {
    console.error("Error updating template:", error);
    return NextResponse.json({ error: "Failed to update template" }, { status: 500 });
  }
}

// DELETE /api/admin/templates/[id] - Delete template
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
    // Check if template exists
    const existingResult = await dynamoDb.send(
      new GetCommand({
        TableName: TABLES.BROADCAST_TEMPLATES,
        Key: { id },
      })
    );

    if (!existingResult.Item) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    await dynamoDb.send(
      new DeleteCommand({
        TableName: TABLES.BROADCAST_TEMPLATES,
        Key: { id },
      })
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting template:", error);
    return NextResponse.json({ error: "Failed to delete template" }, { status: 500 });
  }
}
