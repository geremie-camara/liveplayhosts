"use client";

import { CourseProgressSummary } from "@/lib/training-types";

interface CourseProgressProps {
  progress: CourseProgressSummary;
  showDetails?: boolean;
}

export default function CourseProgress({ progress, showDetails = false }: CourseProgressProps) {
  const { totalLessons, completedLessons, percentComplete, isCompleted, totalTimeSpent } = progress;

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  };

  return (
    <div className="space-y-2">
      {/* Progress bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${
              isCompleted ? "bg-green-500" : "bg-accent"
            }`}
            style={{ width: `${percentComplete}%` }}
          />
        </div>
        <span className={`text-sm font-medium ${isCompleted ? "text-green-600" : "text-gray-600"}`}>
          {percentComplete}%
        </span>
      </div>

      {/* Details */}
      {showDetails && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>
            {completedLessons} of {totalLessons} lessons completed
          </span>
          {totalTimeSpent > 0 && (
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              {formatTime(totalTimeSpent)} spent
            </span>
          )}
        </div>
      )}

      {/* Completed badge */}
      {isCompleted && (
        <div className="flex items-center gap-2 text-green-600 text-sm">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          <span className="font-medium">Course completed!</span>
        </div>
      )}
    </div>
  );
}
