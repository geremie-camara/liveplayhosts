"use client";

import Link from "next/link";
import { Course, CATEGORY_CONFIG, CourseProgressSummary } from "@/lib/training-types";

interface CourseCardProps {
  course: Course;
  progress?: CourseProgressSummary;
}

export default function CourseCard({ course, progress }: CourseCardProps) {
  const categoryConfig = CATEGORY_CONFIG[course.category];
  const percentComplete = progress?.percentComplete || 0;
  const isCompleted = progress?.isCompleted || false;

  return (
    <Link href={`/training/courses/${course.id}`}>
      <div className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow overflow-hidden group">
        {/* Thumbnail */}
        <div className="relative aspect-video bg-gray-100">
          {course.thumbnailUrl ? (
            <img
              src={course.thumbnailUrl}
              alt={course.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10">
              <svg
                className="w-16 h-16 text-primary/30"
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

          {/* Progress overlay */}
          {progress && percentComplete > 0 && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200">
              <div
                className={`h-full transition-all ${
                  isCompleted ? "bg-green-500" : "bg-accent"
                }`}
                style={{ width: `${percentComplete}%` }}
              />
            </div>
          )}

          {/* Completed badge */}
          {isCompleted && (
            <div className="absolute top-3 right-3 bg-green-500 text-white px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              Completed
            </div>
          )}

          {/* Required badge */}
          {course.isRequired && !isCompleted && (
            <div className="absolute top-3 right-3 bg-red-500 text-white px-2 py-1 rounded-full text-xs font-medium">
              Required
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-5">
          {/* Category */}
          <span
            className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${categoryConfig.color} mb-3`}
          >
            {categoryConfig.label}
          </span>

          {/* Title */}
          <h3 className="text-lg font-semibold text-dark group-hover:text-accent transition-colors mb-2">
            {course.title}
          </h3>

          {/* Description */}
          <p className="text-gray-600 text-sm line-clamp-2 mb-4">
            {course.description}
          </p>

          {/* Meta info */}
          <div className="flex items-center justify-between text-sm text-gray-500">
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

            {progress && percentComplete > 0 && !isCompleted && (
              <span className="text-accent font-medium">{percentComplete}% complete</span>
            )}

            {course.isSequential && (
              <div className="flex items-center gap-1 text-gray-400" title="Must be completed in order">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
