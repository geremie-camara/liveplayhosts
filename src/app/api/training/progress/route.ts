import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoDb, TABLES } from "@/lib/dynamodb";
import { TrainingProgress, ProgressStatus } from "@/lib/training-types";
import { UserRole, Host } from "@/lib/types";
import { isActiveUser } from "@/lib/roles";

// Helper to get host by clerkUserId
async function getHostByClerkId(clerkUserId: string): Promise<Host | null> {
  try {
    const result = await dynamoDb.send(
      new ScanCommand({
        TableName: TABLES.HOSTS,
        FilterExpression: "clerkUserId = :clerkUserId",
        ExpressionAttributeValues: {
          ":clerkUserId": clerkUserId,
        },
        Limit: 1,
      })
    );
    return (result.Items?.[0] as Host) || null;
  } catch {
    return null;
  }
}

// POST /api/training/progress - Save lesson progress
export async function POST(request: NextRequest) {
  const user = await currentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userRole = user.publicMetadata?.role as UserRole | undefined;

  // Check if user has an active role that can access training
  if (!userRole || !isActiveUser(userRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Look up host by clerkUserId
  const host = await getHostByClerkId(user.id);
  if (!host) {
    return NextResponse.json({ error: "Host record not found" }, { status: 404 });
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
    const progressId = `${host.id}#${lessonId}`;

    const progressItem: TrainingProgress = {
      id: progressId,
      oduserId: host.id, // oduserId stores host.id (legacy field name)
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
  const user = await currentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userRole = user.publicMetadata?.role as UserRole | undefined;

  if (!userRole || !isActiveUser(userRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Look up host by clerkUserId
  const host = await getHostByClerkId(user.id);
  if (!host) {
    return NextResponse.json([]);
  }

  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get("courseId");

  try {
    let filterExpression = "oduserId = :oduserId";
    const expressionValues: Record<string, string> = {
      ":oduserId": host.id,
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
