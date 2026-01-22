import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { GetCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoDb, TABLES } from "@/lib/dynamodb";
import { Course, Section, Lesson, CourseWithContent, SectionWithLessons } from "@/lib/training-types";
import { UserRole } from "@/lib/types";
import { hasPermission } from "@/lib/roles";

// GET /api/training/courses/[id] - Get course with sections & lessons
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userRole = (sessionClaims?.metadata as { role?: UserRole })?.role;
  if (!userRole || !hasPermission(userRole, "viewBasicTraining")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    // Fetch the course
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

    // Check if user has access to this course
    const canViewAll = hasPermission(userRole, "viewAllTraining");
    if (!canViewAll) {
      if (course.status !== "published") {
        return NextResponse.json({ error: "Course not found" }, { status: 404 });
      }
      if (course.requiredRoles.length > 0 && !course.requiredRoles.includes(userRole)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Fetch sections for this course
    const sectionsResult = await dynamoDb.send(
      new ScanCommand({
        TableName: TABLES.SECTIONS,
        FilterExpression: "courseId = :courseId",
        ExpressionAttributeValues: {
          ":courseId": id,
        },
      })
    );

    const sections = (sectionsResult.Items || []) as Section[];
    sections.sort((a, b) => a.order - b.order);

    // Fetch lessons for this course
    const lessonsResult = await dynamoDb.send(
      new ScanCommand({
        TableName: TABLES.LESSONS,
        FilterExpression: "courseId = :courseId",
        ExpressionAttributeValues: {
          ":courseId": id,
        },
      })
    );

    const lessons = (lessonsResult.Items || []) as Lesson[];

    // Build sections with lessons
    const sectionsWithLessons: SectionWithLessons[] = sections.map((section) => ({
      ...section,
      lessons: lessons
        .filter((l) => l.sectionId === section.id)
        .sort((a, b) => a.order - b.order),
    }));

    const courseWithContent: CourseWithContent = {
      ...course,
      sections: sectionsWithLessons,
    };

    return NextResponse.json(courseWithContent);
  } catch (error) {
    console.error("Error fetching course:", error);
    return NextResponse.json({ error: "Failed to fetch course" }, { status: 500 });
  }
}
