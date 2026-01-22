import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoDb, TABLES } from "@/lib/dynamodb";
import { Role, hasPermission, isActiveUser, getUserRole } from "@/lib/roles";
import { Course, CourseProgressSummary, TrainingProgress, CATEGORY_CONFIG, CourseCategory } from "@/lib/training-types";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";
import CourseCard from "@/components/training/CourseCard";

async function getCourses(userRole: Role): Promise<Course[]> {
  try {
    const result = await dynamoDb.send(
      new ScanCommand({
        TableName: TABLES.COURSES,
      })
    );

    let courses = (result.Items || []) as Course[];

    // Filter by status (non-admins only see published)
    const canViewAll = hasPermission(userRole, "viewAllTraining");
    if (!canViewAll) {
      courses = courses.filter((c) => c.status === "published");
    }

    // Filter by roles the user can access
    courses = courses.filter(
      (c) => c.requiredRoles.length === 0 || c.requiredRoles.includes(userRole)
    );

    // Sort by order
    courses.sort((a, b) => a.order - b.order);

    return courses;
  } catch (error) {
    console.error("Error fetching courses:", error);
    return [];
  }
}

async function getUserProgress(userId: string): Promise<Record<string, CourseProgressSummary>> {
  try {
    const result = await dynamoDb.send(
      new ScanCommand({
        TableName: TABLES.TRAINING_PROGRESS,
        FilterExpression: "oduserId = :userId",
        ExpressionAttributeValues: {
          ":userId": userId,
        },
      })
    );

    const progress = (result.Items || []) as TrainingProgress[];

    // Group progress by course
    const courseProgress: Record<string, TrainingProgress[]> = {};
    progress.forEach((p) => {
      if (!courseProgress[p.courseId]) {
        courseProgress[p.courseId] = [];
      }
      courseProgress[p.courseId].push(p);
    });

    // Calculate summary for each course
    const summaries: Record<string, CourseProgressSummary> = {};
    Object.entries(courseProgress).forEach(([courseId, lessons]) => {
      const completedLessons = lessons.filter((l) => l.status === "completed").length;
      const inProgressLessons = lessons.filter((l) => l.status === "in_progress").length;
      const totalLessons = lessons.length;
      const totalTimeSpent = lessons.reduce((acc, l) => acc + l.timeSpent, 0);

      summaries[courseId] = {
        courseId,
        totalLessons,
        completedLessons,
        inProgressLessons,
        percentComplete: totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0,
        totalTimeSpent,
        isCompleted: completedLessons === totalLessons && totalLessons > 0,
        lastAccessedAt: lessons
          .map((l) => l.updatedAt)
          .sort()
          .pop(),
      };
    });

    return summaries;
  } catch (error) {
    console.error("Error fetching user progress:", error);
    return {};
  }
}

export default async function TrainingPage() {
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

  const [courses, userProgress] = await Promise.all([
    getCourses(role),
    getUserProgress(user.id),
  ]);

  // Group courses by category
  const coursesByCategory = courses.reduce((acc, course) => {
    if (!acc[course.category]) {
      acc[course.category] = [];
    }
    acc[course.category].push(course);
    return acc;
  }, {} as Record<CourseCategory, Course[]>);

  // Calculate overall progress
  const totalCourses = courses.length;
  const completedCourses = Object.values(userProgress).filter((p) => p.isCompleted).length;
  const overallPercent = totalCourses > 0 ? Math.round((completedCourses / totalCourses) * 100) : 0;

  // Get required courses that aren't completed
  const requiredIncomplete = courses.filter(
    (c) => c.isRequired && !userProgress[c.id]?.isCompleted
  );

  return (
    <AuthenticatedLayout>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-primary">Training Center</h1>
          <p className="text-gray-600 mt-2">
            Complete your training modules to become a certified host.
          </p>
        </div>

        {/* Progress Overview */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-dark">Your Progress</h2>
              <p className="text-gray-600">
                {completedCourses} of {totalCourses} courses completed
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-48">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Overall</span>
                  <span className="text-primary font-medium">{overallPercent}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-accent h-3 rounded-full transition-all"
                    style={{ width: `${overallPercent}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Required courses warning */}
          {requiredIncomplete.length > 0 && (
            <div className="mt-4 p-4 bg-red-50 border border-red-100 rounded-lg">
              <div className="flex items-start gap-3">
                <svg
                  className="w-5 h-5 text-red-500 mt-0.5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                <div>
                  <p className="font-medium text-red-800">
                    You have {requiredIncomplete.length} required course
                    {requiredIncomplete.length > 1 ? "s" : ""} to complete
                  </p>
                  <p className="text-sm text-red-600 mt-1">
                    {requiredIncomplete.map((c) => c.title).join(", ")}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Course Categories */}
        {(Object.keys(CATEGORY_CONFIG) as CourseCategory[]).map((category) => {
          const categoryCourses = coursesByCategory[category];
          if (!categoryCourses || categoryCourses.length === 0) return null;

          const config = CATEGORY_CONFIG[category];

          return (
            <div key={category} className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${config.color}`}>
                  {config.label}
                </span>
                <span className="text-gray-500 text-sm">
                  {categoryCourses.length} course{categoryCourses.length > 1 ? "s" : ""}
                </span>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {categoryCourses.map((course) => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    progress={userProgress[course.id]}
                  />
                ))}
              </div>
            </div>
          );
        })}

        {/* Empty state */}
        {courses.length === 0 && (
          <div className="text-center py-12 bg-white rounded-2xl shadow-sm">
            <svg
              className="w-16 h-16 mx-auto text-gray-300 mb-4"
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
            <h3 className="text-lg font-semibold text-dark mb-2">No courses available</h3>
            <p className="text-gray-500">Check back later for new training content.</p>
          </div>
        )}
      </div>
    </AuthenticatedLayout>
  );
}
