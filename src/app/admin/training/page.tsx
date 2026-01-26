"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Course, CATEGORY_CONFIG, CourseCategory } from "@/lib/training-types";

export default function AdminTrainingPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      const res = await fetch("/api/admin/training/courses");
      if (res.ok) {
        const data = await res.json();
        setCourses(data);
      }
    } catch (error) {
      console.error("Error fetching courses:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (courseId: string) => {
    if (!confirm("Are you sure you want to delete this course? This will also delete all sections and lessons.")) {
      return;
    }

    setDeleting(courseId);
    try {
      const res = await fetch(`/api/admin/training/courses/${courseId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setCourses(courses.filter((c) => c.id !== courseId));
      } else {
        alert("Failed to delete course");
      }
    } catch (error) {
      console.error("Error deleting course:", error);
      alert("Failed to delete course");
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
      </div>
    );
  }

  return (
    <>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-primary">Training Content</h1>
          <p className="text-gray-600 mt-2">Manage courses, lessons, and training materials.</p>
        </div>
        <Link
          href="/admin/training/courses/new"
          className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Course
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-8">
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="text-3xl font-bold text-primary">{courses.length}</div>
          <div className="text-gray-600 mt-1">Total Courses</div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="text-3xl font-bold text-green-600">
            {courses.filter((c) => c.status === "published").length}
          </div>
          <div className="text-gray-600 mt-1">Published</div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="text-3xl font-bold text-yellow-600">
            {courses.filter((c) => c.status === "draft").length}
          </div>
          <div className="text-gray-600 mt-1">Drafts</div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="text-3xl font-bold text-red-600">
            {courses.filter((c) => c.isRequired).length}
          </div>
          <div className="text-gray-600 mt-1">Required</div>
        </div>
      </div>

      {/* Course List */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b bg-gray-50">
          <h2 className="font-semibold text-dark">All Courses</h2>
        </div>

        {courses.length === 0 ? (
          <div className="p-12 text-center">
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
            <h3 className="text-lg font-semibold text-dark mb-2">No courses yet</h3>
            <p className="text-gray-500 mb-4">Create your first course to get started.</p>
            <Link
              href="/admin/training/courses/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Course
            </Link>
          </div>
        ) : (
          <>
            {/* Mobile: Card View */}
            <div className="md:hidden divide-y divide-gray-100">
              {courses
                .sort((a, b) => a.order - b.order)
                .map((course) => {
                  const categoryConfig = CATEGORY_CONFIG[course.category as CourseCategory];
                  return (
                    <div key={course.id} className="p-4">
                      {/* Header: Title + Status */}
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-dark flex items-center gap-2 flex-wrap">
                            {course.title}
                            {course.isRequired && (
                              <span className="px-2 py-0.5 text-xs bg-red-100 text-red-600 rounded">
                                Required
                              </span>
                            )}
                          </h3>
                          <p className="text-sm text-gray-500 line-clamp-2 mt-1">{course.description}</p>
                        </div>
                      </div>

                      {/* Meta Info */}
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${categoryConfig?.color || "bg-gray-100 text-gray-600"}`}>
                          {categoryConfig?.label || course.category}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            course.status === "published"
                              ? "bg-green-100 text-green-600"
                              : "bg-yellow-100 text-yellow-600"
                          }`}
                        >
                          {course.status}
                        </span>
                        <span className="text-sm text-gray-500">{course.estimatedDuration} min</span>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <Link
                          href={`/admin/training/courses/${course.id}`}
                          className="flex-1 px-3 py-2 text-sm font-medium text-center text-accent border border-accent rounded-lg"
                        >
                          Edit
                        </Link>
                        <Link
                          href={`/training/courses/${course.id}`}
                          target="_blank"
                          className="px-3 py-2 text-sm font-medium text-blue-500 border border-blue-200 rounded-lg"
                        >
                          Preview
                        </Link>
                        <button
                          onClick={() => handleDelete(course.id)}
                          disabled={deleting === course.id}
                          className="px-3 py-2 text-red-500 border border-red-200 rounded-lg disabled:opacity-50"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Desktop: Table View */}
            <table className="hidden md:table w-full">
              <thead>
                <tr className="text-left text-sm text-gray-500 border-b">
                  <th className="px-6 py-3 font-medium">Course</th>
                  <th className="px-6 py-3 font-medium">Category</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Duration</th>
                  <th className="px-6 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {courses
                  .sort((a, b) => a.order - b.order)
                  .map((course) => {
                    const categoryConfig = CATEGORY_CONFIG[course.category as CourseCategory];
                    return (
                      <tr key={course.id} className="border-b last:border-b-0 hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div>
                            <div className="font-medium text-dark flex items-center gap-2">
                              {course.title}
                              {course.isRequired && (
                                <span className="px-2 py-0.5 text-xs bg-red-100 text-red-600 rounded">
                                  Required
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-500 truncate max-w-md">
                              {course.description}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${categoryConfig?.color || "bg-gray-100 text-gray-600"}`}>
                            {categoryConfig?.label || course.category}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                              course.status === "published"
                                ? "bg-green-100 text-green-600"
                                : "bg-yellow-100 text-yellow-600"
                            }`}
                          >
                            {course.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-gray-600">{course.estimatedDuration} min</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/admin/training/courses/${course.id}`}
                              className="p-2 text-gray-400 hover:text-accent rounded-lg hover:bg-gray-100"
                              title="Edit"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                />
                              </svg>
                            </Link>
                            <Link
                              href={`/training/courses/${course.id}`}
                              className="p-2 text-gray-400 hover:text-blue-500 rounded-lg hover:bg-gray-100"
                              title="Preview"
                              target="_blank"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                />
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                />
                              </svg>
                            </Link>
                            <button
                              onClick={() => handleDelete(course.id)}
                              disabled={deleting === course.id}
                              className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-gray-100 disabled:opacity-50"
                              title="Delete"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </>
        )}
      </div>
    </>
  );
}
