import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoDb, TABLES } from "@/lib/dynamodb";
import { Lesson } from "@/lib/training-types";
import { UserRole } from "@/lib/types";
import { hasPermission } from "@/lib/roles";

// POST /api/admin/training/lessons - Create lesson
export async function POST(request: NextRequest) {
  const user = await currentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userRole = user.publicMetadata?.role as UserRole | undefined;
  if (!userRole || !hasPermission(userRole, "manageTraining")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { courseId, sectionId, title, type, content, videoUrl, videoS3Key, estimatedDuration } = body;

    if (!courseId || !sectionId || !title || !type) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Get current max order for this section
    const existingResult = await dynamoDb.send(
      new ScanCommand({
        TableName: TABLES.LESSONS,
        FilterExpression: "sectionId = :sectionId",
        ExpressionAttributeValues: { ":sectionId": sectionId },
      })
    );
    const existingLessons = (existingResult.Items || []) as Lesson[];
    const maxOrder = existingLessons.reduce((max, l) => Math.max(max, l.order), -1);

    const now = new Date().toISOString();
    const lessonId = `lesson-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const lesson: Lesson = {
      id: lessonId,
      courseId,
      sectionId,
      title,
      type,
      content: content || "",
      videoUrl: videoUrl || undefined,
      videoS3Key: videoS3Key || undefined,
      estimatedDuration: estimatedDuration || 10,
      order: maxOrder + 1,
      createdAt: now,
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
    console.error("Error creating lesson:", error);
    return NextResponse.json({ error: "Failed to create lesson" }, { status: 500 });
  }
}
