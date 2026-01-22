import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { GetCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoDb, TABLES } from "@/lib/dynamodb";
import { Lesson, Quiz, Course, LessonWithQuiz } from "@/lib/training-types";
import { UserRole } from "@/lib/types";
import { hasPermission } from "@/lib/roles";

// GET /api/training/lessons/[id] - Get lesson content
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
    // Fetch the lesson
    const lessonResult = await dynamoDb.send(
      new GetCommand({
        TableName: TABLES.LESSONS,
        Key: { id },
      })
    );

    if (!lessonResult.Item) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    const lesson = lessonResult.Item as Lesson;

    // Verify user has access to the course this lesson belongs to
    const courseResult = await dynamoDb.send(
      new GetCommand({
        TableName: TABLES.COURSES,
        Key: { id: lesson.courseId },
      })
    );

    if (!courseResult.Item) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const course = courseResult.Item as Course;

    const canViewAll = hasPermission(userRole, "viewAllTraining");
    if (!canViewAll) {
      if (course.status !== "published") {
        return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
      }
      if (course.requiredRoles.length > 0 && !course.requiredRoles.includes(userRole)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // If lesson is quiz type, fetch the quiz
    let quiz: Quiz | undefined;
    if (lesson.type === "quiz") {
      const quizResult = await dynamoDb.send(
        new ScanCommand({
          TableName: TABLES.QUIZZES,
          FilterExpression: "lessonId = :lessonId",
          ExpressionAttributeValues: {
            ":lessonId": id,
          },
        })
      );

      if (quizResult.Items && quizResult.Items.length > 0) {
        quiz = quizResult.Items[0] as Quiz;
        // Remove correct answers from quiz for non-admin users (they submit and get results)
        if (!canViewAll) {
          quiz = {
            ...quiz,
            questions: quiz.questions.map((q) => ({
              ...q,
              correctAnswers: [], // Hide correct answers
              explanation: undefined, // Hide explanations until after submission
            })),
          };
        }
      }
    }

    const lessonWithQuiz: LessonWithQuiz = {
      ...lesson,
      quiz,
    };

    return NextResponse.json(lessonWithQuiz);
  } catch (error) {
    console.error("Error fetching lesson:", error);
    return NextResponse.json({ error: "Failed to fetch lesson" }, { status: 500 });
  }
}
