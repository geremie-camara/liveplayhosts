import { currentUser } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ScanCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoDb, TABLES } from "@/lib/dynamodb";
import { Role, hasPermission, isActiveUser, getUserRole } from "@/lib/roles";
import {
  Course,
  Section,
  Lesson,
  SectionWithLessons,
  TrainingProgress,
  CATEGORY_CONFIG,
} from "@/lib/training-types";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";
import LessonList from "@/components/training/LessonList";
import CourseProgress from "@/components/training/CourseProgress";

interface PageProps {
  params: Promise<{ courseId: string }>;
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
    // Fetch sections
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

    // Fetch lessons
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

    // Combine sections with their lessons
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

    // Convert to map by lessonId
    return progress.reduce((acc, p) => {
      acc[p.lessonId] = p;
      return acc;
    }, {} as Record<string, TrainingProgress>);
  } catch (error) {
    console.error("Error fetching user progress:", error);
    return {};
  }
}

export default async function CourseDetailPage({ params }: PageProps) {
  const { courseId } = await params;
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

  const course = await getCourse(courseId);

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
    getCourseSections(courseId),
    getUserProgress(user.id, courseId),
  ]);

  // Calculate progress stats
  const totalLessons = sections.reduce((acc, s) => acc + s.lessons.length, 0);
  const completedLessons = Object.values(progress).filter(
    (p) => p.status === "completed"
  ).length;
  const percentComplete =
    totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  // Find the next lesson to continue
  const allLessons = sections.flatMap((s) => s.lessons);
  const nextLesson = allLessons.find((lesson) => {
    const lessonProgress = progress[lesson.id];
    return !lessonProgress || lessonProgress.status !== "completed";
  });

  const categoryConfig = CATEGORY_CONFIG[course.category];

  return (
    <AuthenticatedLayout>
      <div className="max-w-7xl mx-auto">
        {/* Breadcrumb */}
        <nav className="mb-4 sm:mb-6">
          <ol className="flex items-center gap-2 text-xs sm:text-sm text-gray-500 flex-wrap">
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
            <li className="text-dark font-medium truncate max-w-[200px] sm:max-w-none">{course.title}</li>
          </ol>
        </nav>

        <div className="grid lg:grid-cols-3 gap-6 sm:gap-8">
          {/* Main content */}
          <div className="lg:col-span-2">
            {/* Course header */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-6">
              {/* Thumbnail */}
              <div className="aspect-video bg-gray-100 relative">
                {course.thumbnailUrl ? (
                  <img
                    src={course.thumbnailUrl}
                    alt={course.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10">
                    <svg
                      className="w-24 h-24 text-primary/30"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                      />
                    </svg>
                  </div>
                )}

                {/* Status badges */}
                <div className="absolute top-4 left-4 flex gap-2">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${categoryConfig.color}`}>
                    {categoryConfig.label}
                  </span>
                  {course.isRequired && (
                    <span className="px-3 py-1 rounded-full text-sm font-medium bg-red-500 text-white">
                      Required
                    </span>
                  )}
                  {course.status === "draft" && (
                    <span className="px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                      Draft
                    </span>
                  )}
                </div>
              </div>

              {/* Course info */}
              <div className="p-4 sm:p-6">
                <h1 className="text-xl sm:text-2xl font-bold text-dark mb-2">{course.title}</h1>
                <p className="text-gray-600 mb-4 text-sm sm:text-base">{course.description}</p>

                <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-sm text-gray-500">
                  <div className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <span>{course.estimatedDuration} min</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                      />
                    </svg>
                    <span>{sections.length} sections</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                      />
                    </svg>
                    <span>{totalLessons} lessons</span>
                  </div>
                  {course.isSequential && (
                    <div className="flex items-center gap-1 text-gray-400">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                      <span>Sequential</span>
                    </div>
                  )}
                </div>

                {/* Continue button */}
                {nextLesson && (
                  <div className="mt-4 sm:mt-6">
                    <Link
                      href={`/training/lessons/${nextLesson.id}`}
                      className="inline-flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-accent text-white font-medium rounded-lg hover:bg-accent/90 transition-colors text-sm sm:text-base"
                    >
                      {completedLessons > 0 ? "Continue" : "Start"} Course
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M14 5l7 7m0 0l-7 7m7-7H3"
                        />
                      </svg>
                    </Link>
                  </div>
                )}

                {/* Completed message */}
                {percentComplete === 100 && (
                  <div className="mt-6 p-4 bg-green-50 border border-green-100 rounded-lg">
                    <div className="flex items-center gap-3">
                      <svg className="w-6 h-6 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <div>
                        <p className="font-medium text-green-800">Course Completed!</p>
                        <p className="text-sm text-green-600">
                          You&apos;ve completed all lessons in this course.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Lesson list */}
            <div>
              <h2 className="text-base sm:text-lg font-semibold text-dark mb-3 sm:mb-4">Course Content</h2>
              {sections.length > 0 ? (
                <LessonList
                  sections={sections}
                  progress={progress}
                  courseIsSequential={course.isSequential}
                />
              ) : (
                <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
                  <svg
                    className="w-12 h-12 mx-auto text-gray-300 mb-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                    />
                  </svg>
                  <p className="text-gray-500">No lessons available yet.</p>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar - Hidden on mobile, shows below main content */}
          <div className="lg:col-span-1">
            <div className="lg:sticky lg:top-6 space-y-4 sm:space-y-6">
              {/* Progress card */}
              <div className="bg-white rounded-2xl shadow-sm p-4 sm:p-6">
                <h3 className="font-semibold text-dark mb-3 sm:mb-4 text-sm sm:text-base">Your Progress</h3>
                <CourseProgress
                  progress={{
                    courseId,
                    totalLessons,
                    completedLessons,
                    inProgressLessons: Object.values(progress).filter(
                      (p) => p.status === "in_progress"
                    ).length,
                    percentComplete,
                    totalTimeSpent: Object.values(progress).reduce(
                      (acc, p) => acc + p.timeSpent,
                      0
                    ),
                    isCompleted: percentComplete === 100,
                  }}
                  showDetails
                />
              </div>

              {/* Quick navigation */}
              {sections.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm p-4 sm:p-6">
                  <h3 className="font-semibold text-dark mb-3 sm:mb-4 text-sm sm:text-base">Sections</h3>
                  <nav className="space-y-2">
                    {sections.map((section, index) => {
                      const sectionCompleted = section.lessons.every(
                        (l) => progress[l.id]?.status === "completed"
                      );
                      return (
                        <div
                          key={section.id}
                          className="flex items-center gap-2 text-sm"
                        >
                          <span
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                              sectionCompleted
                                ? "bg-green-100 text-green-600"
                                : "bg-gray-100 text-gray-500"
                            }`}
                          >
                            {sectionCompleted ? (
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path
                                  fillRule="evenodd"
                                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            ) : (
                              index + 1
                            )}
                          </span>
                          <span className={sectionCompleted ? "text-green-600" : "text-gray-600"}>
                            {section.title}
                          </span>
                        </div>
                      );
                    })}
                  </nav>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
