import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ScanCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoDb, TABLES } from "@/lib/dynamodb";
import { Course, Section, Lesson, CourseWithContent, SectionWithLessons } from "@/lib/training-types";
import { UserRole } from "@/lib/types";
import { hasPermission } from "@/lib/roles";

// GET /api/training/courses - List available courses for user
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
  const category = searchParams.get("category");
  const includeContent = searchParams.get("includeContent") === "true";

  try {
    // Fetch all courses
    const coursesResult = await dynamoDb.send(
      new ScanCommand({
        TableName: TABLES.COURSES,
      })
    );

    let courses = (coursesResult.Items || []) as Course[];

    // Filter by status (non-admins only see published)
    const canViewAll = hasPermission(userRole, "viewAllTraining");
    if (!canViewAll) {
      courses = courses.filter((c) => c.status === "published");
    }

    // Filter by roles the user can access
    courses = courses.filter((c) =>
      c.requiredRoles.length === 0 || c.requiredRoles.includes(userRole)
    );

    // Filter by category if specified
    if (category) {
      courses = courses.filter((c) => c.category === category);
    }

    // Sort by order
    courses.sort((a, b) => a.order - b.order);

    // If includeContent is true, fetch sections and lessons for each course
    if (includeContent) {
      const sectionsResult = await dynamoDb.send(
        new ScanCommand({ TableName: TABLES.SECTIONS })
      );
      const lessonsResult = await dynamoDb.send(
        new ScanCommand({ TableName: TABLES.LESSONS })
      );

      const sections = (sectionsResult.Items || []) as Section[];
      const lessons = (lessonsResult.Items || []) as Lesson[];

      const coursesWithContent: CourseWithContent[] = courses.map((course) => {
        const courseSections = sections
          .filter((s) => s.courseId === course.id)
          .sort((a, b) => a.order - b.order);

        const sectionsWithLessons: SectionWithLessons[] = courseSections.map((section) => ({
          ...section,
          lessons: lessons
            .filter((l) => l.sectionId === section.id)
            .sort((a, b) => a.order - b.order),
        }));

        return {
          ...course,
          sections: sectionsWithLessons,
        };
      });

      return NextResponse.json(coursesWithContent);
    }

    return NextResponse.json(courses);
  } catch (error) {
    console.error("Error fetching courses:", error);
    return NextResponse.json({ error: "Failed to fetch courses" }, { status: 500 });
  }
}
