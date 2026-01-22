import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { GetCommand, PutCommand, DeleteCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoDb, TABLES } from "@/lib/dynamodb";
import { Course, Section, Lesson, SectionWithLessons } from "@/lib/training-types";
import { UserRole } from "@/lib/types";
import { hasPermission } from "@/lib/roles";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/admin/training/courses/[id] - Get course with content
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
    const courseResult = await dynamoDb.send(
      new GetCommand({
        TableName: TABLES.COURSES,
        Key: { id },
      })
    );

    if (!courseResult.Item) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const course = courseResult.Item as Course;

    // Fetch sections and lessons
    const sectionsResult = await dynamoDb.send(
      new ScanCommand({
        TableName: TABLES.SECTIONS,
        FilterExpression: "courseId = :courseId",
        ExpressionAttributeValues: { ":courseId": id },
      })
    );

    const lessonsResult = await dynamoDb.send(
      new ScanCommand({
        TableName: TABLES.LESSONS,
        FilterExpression: "courseId = :courseId",
        ExpressionAttributeValues: { ":courseId": id },
      })
    );

    const sections = (sectionsResult.Items || []) as Section[];
    const lessons = (lessonsResult.Items || []) as Lesson[];

    const sectionsWithLessons: SectionWithLessons[] = sections
      .sort((a, b) => a.order - b.order)
      .map((section) => ({
        ...section,
        lessons: lessons
          .filter((l) => l.sectionId === section.id)
          .sort((a, b) => a.order - b.order),
      }));

    return NextResponse.json({ course, sections: sectionsWithLessons });
  } catch (error) {
    console.error("Error fetching course:", error);
    return NextResponse.json({ error: "Failed to fetch course" }, { status: 500 });
  }
}

// PUT /api/admin/training/courses/[id] - Update course
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
    const body = await request.json();
    const now = new Date().toISOString();

    const course: Course = {
      ...body,
      id,
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
    console.error("Error updating course:", error);
    return NextResponse.json({ error: "Failed to update course" }, { status: 500 });
  }
}

// DELETE /api/admin/training/courses/[id] - Delete course and all content
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
    // Delete all lessons in this course
    const lessonsResult = await dynamoDb.send(
      new ScanCommand({
        TableName: TABLES.LESSONS,
        FilterExpression: "courseId = :courseId",
        ExpressionAttributeValues: { ":courseId": id },
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

    // Delete all sections in this course
    const sectionsResult = await dynamoDb.send(
      new ScanCommand({
        TableName: TABLES.SECTIONS,
        FilterExpression: "courseId = :courseId",
        ExpressionAttributeValues: { ":courseId": id },
      })
    );

    for (const section of sectionsResult.Items || []) {
      await dynamoDb.send(
        new DeleteCommand({
          TableName: TABLES.SECTIONS,
          Key: { id: section.id },
        })
      );
    }

    // Delete the course
    await dynamoDb.send(
      new DeleteCommand({
        TableName: TABLES.COURSES,
        Key: { id },
      })
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting course:", error);
    return NextResponse.json({ error: "Failed to delete course" }, { status: 500 });
  }
}
