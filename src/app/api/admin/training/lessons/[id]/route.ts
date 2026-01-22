import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { GetCommand, PutCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoDb, TABLES } from "@/lib/dynamodb";
import { Lesson } from "@/lib/training-types";
import { UserRole } from "@/lib/types";
import { hasPermission } from "@/lib/roles";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/admin/training/lessons/[id] - Get lesson
export async function GET(request: NextRequest, context: RouteContext) {
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
    const result = await dynamoDb.send(
      new GetCommand({
        TableName: TABLES.LESSONS,
        Key: { id },
      })
    );

    if (!result.Item) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    return NextResponse.json(result.Item as Lesson);
  } catch (error) {
    console.error("Error fetching lesson:", error);
    return NextResponse.json({ error: "Failed to fetch lesson" }, { status: 500 });
  }
}

// PUT /api/admin/training/lessons/[id] - Update lesson
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
    // Get existing lesson
    const existing = await dynamoDb.send(
      new GetCommand({
        TableName: TABLES.LESSONS,
        Key: { id },
      })
    );

    if (!existing.Item) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    const body = await request.json();
    const now = new Date().toISOString();

    const lesson: Lesson = {
      ...(existing.Item as Lesson),
      title: body.title ?? existing.Item.title,
      type: body.type ?? existing.Item.type,
      content: body.content ?? existing.Item.content,
      videoUrl: body.videoUrl,
      videoS3Key: body.videoS3Key,
      estimatedDuration: body.estimatedDuration ?? existing.Item.estimatedDuration,
      order: body.order ?? existing.Item.order,
      updatedAt: now,
    };

    await dynamoDb.send(
      new PutCommand({
        TableName: TABLES.LESSONS,
        Item: lesson,
      })
    );

    return NextResponse.json(lesson);
  } catch (error) {
    console.error("Error updating lesson:", error);
    return NextResponse.json({ error: "Failed to update lesson" }, { status: 500 });
  }
}

// DELETE /api/admin/training/lessons/[id] - Delete lesson
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
    await dynamoDb.send(
      new DeleteCommand({
        TableName: TABLES.LESSONS,
        Key: { id },
      })
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting lesson:", error);
    return NextResponse.json({ error: "Failed to delete lesson" }, { status: 500 });
  }
}
