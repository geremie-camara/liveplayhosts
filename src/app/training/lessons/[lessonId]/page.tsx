import { currentUser } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ScanCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoDb, TABLES } from "@/lib/dynamodb";
import { Role, hasPermission, isActiveUser, getUserRole } from "@/lib/roles";
import {
  Course,
  Lesson,
  Section,
  SectionWithLessons,
  TrainingProgress,
  LESSON_TYPE_CONFIG,
} from "@/lib/training-types";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";
import LessonList from "@/components/training/LessonList";
import LessonContent from "./LessonContent";

interface PageProps {
  params: Promise<{ lessonId: string }>;
}

async function getLesson(lessonId: string): Promise<Lesson | null> {
  try {
    const result = await dynamoDb.send(
      new GetCommand({
        TableName: TABLES.LESSONS,
        Key: { id: lessonId },
      })
    );
    return (result.Item as Lesson) || null;
  } catch (error) {
    console.error("Error fetching lesson:", error);
    return null;
  }
}

async function getCourse(courseId: string): Promise<Course | null> {
  try {
    const result = await dynamoDb.send(
      new GetCommand({
        TableName: TABLES.COURSES,
        Key: { id: courseId },
      })
    );
    return (result.Item as Course) || null;
  } catch (error) {
    console.error("Error fetching course:", error);
    return null;
  }
}

async function getCourseSections(courseId: string): Promise<SectionWithLessons[]> {
  try {
    const sectionsResult = await dynamoDb.send(
      new ScanCommand({
        TableName: TABLES.SECTIONS,
        FilterExpression: "courseId = :courseId",
        ExpressionAttributeValues: {
          ":courseId": courseId,
        },
      })
    );

    const sections = (sectionsResult.Items || []) as Section[];

    const lessonsResult = await dynamoDb.send(
      new ScanCommand({
        TableName: TABLES.LESSONS,
        FilterExpression: "courseId = :courseId",
        ExpressionAttributeValues: {
          ":courseId": courseId,
        },
      })
    );

    const lessons = (lessonsResult.Items || []) as Lesson[];

    const sectionsWithLessons: SectionWithLessons[] = sections
      .sort((a, b) => a.order - b.order)
      .map((section) => ({
        ...section,
        lessons: lessons
          .filter((l) => l.sectionId === section.id)
          .sort((a, b) => a.order - b.order),
      }));

    return sectionsWithLessons;
  } catch (error) {
    console.error("Error fetching course sections:", error);
    return [];
  }
}

async function getUserProgress(
  userId: string,
  courseId: string
): Promise<Record<string, TrainingProgress>> {
  try {
    const result = await dynamoDb.send(
      new ScanCommand({
        TableName: TABLES.TRAINING_PROGRESS,
        FilterExpression: "oduserId = :userId AND courseId = :courseId",
        ExpressionAttributeValues: {
          ":userId": userId,
          ":courseId": courseId,
        },
      })
    );

    const progress = (result.Items || []) as TrainingProgress[];

    return progress.reduce((acc, p) => {
      acc[p.lessonId] = p;
      return acc;
    }, {} as Record<string, TrainingProgress>);
  } catch (error) {
    console.error("Error fetching user progress:", error);
    return {};
  }
}

export default async function LessonPage({ params }: PageProps) {
  const { lessonId } = await params;
  const user = await currentUser();

  if (!user) {
    redirect("/sign-in");
  }

  const role = getUserRole(user.publicMetadata);

  if (!isActiveUser(role)) {
    redirect("/pending");
  }

  if (!hasPermission(role, "viewBasicTraining")) {
    redirect("/dashboard");
  }

  const lesson = await getLesson(lessonId);

  if (!lesson) {
    notFound();
  }

  const course = await getCourse(lesson.courseId);

  if (!course) {
    notFound();
  }

  // Check if user has access to this course
  if (course.requiredRoles.length > 0 && !course.requiredRoles.includes(role)) {
    redirect("/training");
  }

  // Non-admins can't view draft courses
  if (course.status === "draft" && !hasPermission(role, "viewAllTraining")) {
    redirect("/training");
  }

  const [sections, progress] = await Promise.all([
    getCourseSections(lesson.courseId),
    getUserProgress(user.id, lesson.courseId),
  ]);

  // Check if lesson is locked (sequential course)
  if (course.isSequential) {
    const allLessons = sections.flatMap((s) => s.lessons);
    const lessonIndex = allLessons.findIndex((l) => l.id === lessonId);

    if (lessonIndex > 0) {
      // Check if all previous lessons are completed
      for (let i = 0; i < lessonIndex; i++) {
        const prevProgress = progress[allLessons[i].id];
        if (!prevProgress || prevProgress.status !== "completed") {
          // Lesson is locked, redirect to course page
          redirect(`/training/courses/${course.id}`);
        }
      }
    }
  }

  // Find previous and next lessons
  const allLessons = sections.flatMap((s) => s.lessons);
  const currentIndex = allLessons.findIndex((l) => l.id === lessonId);
  const prevLesson = currentIndex > 0 ? allLessons[currentIndex - 1] : null;
  const nextLesson = currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null;

  // Check if next lesson is available (for sequential courses)
  const nextLessonLocked =
    course.isSequential &&
    nextLesson &&
    !progress[lessonId]?.status?.includes("completed");

  const lessonTypeConfig = LESSON_TYPE_CONFIG[lesson.type];
  const currentProgress = progress[lessonId];

  return (
    <AuthenticatedLayout>
      <div className="max-w-7xl mx-auto">
        {/* Breadcrumb */}
        <nav className="mb-6">
          <ol className="flex items-center gap-2 text-sm text-gray-500 flex-wrap">
            <li>
              <Link href="/training" className="hover:text-accent">
                Training
              </Link>
            </li>
            <li>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </li>
            <li>
              <Link href={`/training/courses/${course.id}`} className="hover:text-accent">
                {course.title}
              </Link>
            </li>
            <li>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </li>
            <li className="text-dark font-medium">{lesson.title}</li>
          </ol>
        </nav>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main content */}
          <div className="lg:col-span-2">
            {/* Lesson header */}
            <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-700">
                  {lessonTypeConfig.label}
                </span>
                <span className="text-sm text-gray-500">
                  {lesson.estimatedDuration} min
                </span>
                {currentProgress?.status === "completed" && (
                  <span className="flex items-center gap-1 text-sm text-green-600">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Completed
                  </span>
                )}
              </div>

              <h1 className="text-2xl font-bold text-dark">{lesson.title}</h1>
            </div>

            {/* Lesson content */}
            <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
              <LessonContent
                lesson={lesson}
                userId={user.id}
                courseId={course.id}
                currentProgress={currentProgress}
                nextLessonId={nextLesson?.id}
              />
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between gap-4">
              {prevLesson ? (
                <Link
                  href={`/training/lessons/${prevLesson.id}`}
                  className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-accent transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 19l-7-7m0 0l7-7m-7 7h18"
                    />
                  </svg>
                  <span className="hidden sm:inline">Previous:</span>
                  <span className="font-medium truncate max-w-[150px]">{prevLesson.title}</span>
                </Link>
              ) : (
                <div />
              )}

              {nextLesson && !nextLessonLocked ? (
                <Link
                  href={`/training/lessons/${nextLesson.id}`}
                  className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors"
                >
                  <span className="hidden sm:inline">Next:</span>
                  <span className="font-medium truncate max-w-[150px]">{nextLesson.title}</span>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M14 5l7 7m0 0l-7 7m7-7H3"
                    />
                  </svg>
                </Link>
              ) : nextLesson && nextLessonLocked ? (
                <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-400 rounded-lg cursor-not-allowed">
                  <span>Complete this lesson to continue</span>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                </div>
              ) : (
                <Link
                  href={`/training/courses/${course.id}`}
                  className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                >
                  <span>Back to Course</span>
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                </Link>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-6">
              <div className="bg-white rounded-2xl shadow-sm p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-dark">Course Content</h3>
                  <Link
                    href={`/training/courses/${course.id}`}
                    className="text-sm text-accent hover:underline"
                  >
                    View all
                  </Link>
                </div>
                <LessonList
                  sections={sections}
                  progress={progress}
                  courseIsSequential={course.isSequential}
                  currentLessonId={lessonId}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
