import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoDb, TABLES } from "@/lib/dynamodb";
import { Course } from "@/lib/training-types";
import { UserRole } from "@/lib/types";
import { hasPermission } from "@/lib/roles";

// GET /api/admin/training/courses - List all courses (admin)
export async function GET() {
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
      new ScanCommand({ TableName: TABLES.COURSES })
    );

    const courses = (result.Items || []) as Course[];
    courses.sort((a, b) => a.order - b.order);

    return NextResponse.json(courses);
  } catch (error) {
    console.error("Error fetching courses:", error);
    return NextResponse.json({ error: "Failed to fetch courses" }, { status: 500 });
  }
}

// POST /api/admin/training/courses - Create course
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
    const { title, description, category, isRequired, isSequential, estimatedDuration, status } = body;

    if (!title || !description || !category) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Get current max order
    const existingResult = await dynamoDb.send(
      new ScanCommand({ TableName: TABLES.COURSES })
    );
    const existingCourses = (existingResult.Items || []) as Course[];
    const maxOrder = existingCourses.reduce((max, c) => Math.max(max, c.order), -1);

    const now = new Date().toISOString();
    const courseId = `course-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const course: Course = {
      id: courseId,
      title,
      description,
      category,
      isRequired: isRequired || false,
      isSequential: isSequential ?? true,
      requiredRoles: [],
      estimatedDuration: estimatedDuration || 30,
      order: maxOrder + 1,
      status: status || "draft",
      createdAt: now,
      updatedAt: now,
    };

    await dynamoDb.send(
      new PutCommand({
        TableName: TABLES.COURSES,
        Item: course,
      })
    );

    return NextResponse.json(course);
  } catch (error) {
    console.error("Error creating course:", error);
    return NextResponse.json({ error: "Failed to create course" }, { status: 500 });
  }
}
