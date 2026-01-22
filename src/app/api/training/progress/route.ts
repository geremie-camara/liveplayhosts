import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoDb, TABLES } from "@/lib/dynamodb";
import { TrainingProgress, ProgressStatus } from "@/lib/training-types";
import { UserRole } from "@/lib/types";
import { hasPermission } from "@/lib/roles";

// POST /api/training/progress - Save lesson progress
export async function POST(request: NextRequest) {
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userRole = (sessionClaims?.metadata as { role?: UserRole })?.role;
  if (!userRole || !hasPermission(userRole, "viewBasicTraining")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { lessonId, courseId, sectionId, status, timeSpent } = body;

    if (!lessonId || !courseId || !sectionId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const validStatuses: ProgressStatus[] = ["not_started", "in_progress", "completed"];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: "Invalid status" },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const progressId = `${userId}#${lessonId}`;

    const progressItem: TrainingProgress = {
      id: progressId,
      oduserId: userId,
      courseId,
      sectionId,
      lessonId,
      status: status || "in_progress",
      startedAt: now,
      completedAt: status === "completed" ? now : undefined,
      timeSpent: timeSpent || 0,
      updatedAt: now,
    };

    await dynamoDb.send(
      new PutCommand({
        TableName: TABLES.TRAINING_PROGRESS,
        Item: progressItem,
      })
    );

    return NextResponse.json(progressItem);
  } catch (error) {
    console.error("Error saving progress:", error);
    return NextResponse.json(
      { error: "Failed to save progress" },
      { status: 500 }
    );
  }
}

// GET /api/training/progress - Get user's progress
export async function GET(request: NextRequest) {
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userRole = (sessionClaims?.metadata as { role?: UserRole })?.role;
  if (!userRole || !hasPermission(userRole, "viewBasicTraining")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get("courseId");

  try {
    let filterExpression = "oduserId = :userId";
    const expressionValues: Record<string, string> = {
      ":userId": userId,
    };

    if (courseId) {
      filterExpression += " AND courseId = :courseId";
      expressionValues[":courseId"] = courseId;
    }

    const result = await dynamoDb.send(
      new ScanCommand({
        TableName: TABLES.TRAINING_PROGRESS,
        FilterExpression: filterExpression,
        ExpressionAttributeValues: expressionValues,
      })
    );

    const progress = (result.Items || []) as TrainingProgress[];

    return NextResponse.json(progress);
  } catch (error) {
    console.error("Error fetching progress:", error);
    return NextResponse.json(
      { error: "Failed to fetch progress" },
      { status: 500 }
    );
  }
}
