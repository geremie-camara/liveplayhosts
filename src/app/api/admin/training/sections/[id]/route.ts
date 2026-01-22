import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { GetCommand, PutCommand, DeleteCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoDb, TABLES } from "@/lib/dynamodb";
import { Section } from "@/lib/training-types";
import { UserRole } from "@/lib/types";
import { hasPermission } from "@/lib/roles";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// PUT /api/admin/training/sections/[id] - Update section
export async function PUT(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const user = await currentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userRole = user.publicMetadata?.role as UserRole | undefined;
  if (!userRole || !hasPermission(userRole, "manageTraining")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // Get existing section
    const existing = await dynamoDb.send(
      new GetCommand({
        TableName: TABLES.SECTIONS,
        Key: { id },
      })
    );

    if (!existing.Item) {
      return NextResponse.json({ error: "Section not found" }, { status: 404 });
    }

    const body = await request.json();
    const now = new Date().toISOString();

    const section: Section = {
      ...(existing.Item as Section),
      title: body.title ?? existing.Item.title,
      description: body.description,
      order: body.order ?? existing.Item.order,
      updatedAt: now,
    };

    await dynamoDb.send(
      new PutCommand({
        TableName: TABLES.SECTIONS,
        Item: section,
      })
    );

    return NextResponse.json(section);
  } catch (error) {
    console.error("Error updating section:", error);
    return NextResponse.json({ error: "Failed to update section" }, { status: 500 });
  }
}

// DELETE /api/admin/training/sections/[id] - Delete section and lessons
export async function DELETE(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const user = await currentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userRole = user.publicMetadata?.role as UserRole | undefined;
  if (!userRole || !hasPermission(userRole, "manageTraining")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // Delete all lessons in this section
    const lessonsResult = await dynamoDb.send(
      new ScanCommand({
        TableName: TABLES.LESSONS,
        FilterExpression: "sectionId = :sectionId",
        ExpressionAttributeValues: { ":sectionId": id },
      })
    );

    for (const lesson of lessonsResult.Items || []) {
      await dynamoDb.send(
        new DeleteCommand({
          TableName: TABLES.LESSONS,
          Key: { id: lesson.id },
        })
      );
    }

    // Delete the section
    await dynamoDb.send(
      new DeleteCommand({
        TableName: TABLES.SECTIONS,
        Key: { id },
      })
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting section:", error);
    return NextResponse.json({ error: "Failed to delete section" }, { status: 500 });
  }
}
