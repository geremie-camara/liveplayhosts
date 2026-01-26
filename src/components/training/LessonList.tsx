"use client";

import { useState } from "react";
import Link from "next/link";
import { SectionWithLessons, Lesson, TrainingProgress, LESSON_TYPE_CONFIG } from "@/lib/training-types";

interface LessonListProps {
  sections: SectionWithLessons[];
  progress: Record<string, TrainingProgress>; // lessonId -> progress
  courseIsSequential: boolean;
  currentLessonId?: string;
}

export default function LessonList({
  sections,
  progress,
  courseIsSequential,
  currentLessonId,
}: LessonListProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() => {
    // Expand the section containing the current lesson, or all by default
    const initial: Record<string, boolean> = {};
    sections.forEach((section) => {
      const hasCurrentLesson = section.lessons.some((l) => l.id === currentLessonId);
      initial[section.id] = hasCurrentLesson || !currentLessonId;
    });
    return initial;
  });

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  // Build a flat list of lessons to check sequential access
  const allLessons: Lesson[] = sections.flatMap((s) => s.lessons);

  const isLessonLocked = (lesson: Lesson): boolean => {
    if (!courseIsSequential) return false;

    const lessonIndex = allLessons.findIndex((l) => l.id === lesson.id);
    if (lessonIndex <= 0) return false;

    // Check if all previous lessons are completed
    for (let i = 0; i < lessonIndex; i++) {
      const prevProgress = progress[allLessons[i].id];
      if (!prevProgress || prevProgress.status !== "completed") {
        return true;
      }
    }
    return false;
  };

  const getLessonIcon = (type: string) => {
    switch (type) {
      case "video":
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        );
      case "article":
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        );
      case "quiz":
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
            />
          </svg>
        );
      case "faq":
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        );
      default:
        return null;
    }
  };

  const getProgressIcon = (lessonId: string) => {
    const lessonProgress = progress[lessonId];
    if (!lessonProgress) return null;

    if (lessonProgress.status === "completed") {
      return (
        <span className="text-green-500">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
        </span>
      );
    }

    if (lessonProgress.status === "in_progress") {
      return (
        <span className="text-yellow-500">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
              clipRule="evenodd"
            />
          </svg>
        </span>
      );
    }

    return null;
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      {sections.map((section) => {
        const isExpanded = expandedSections[section.id];
        const sectionCompletedCount = section.lessons.filter(
          (l) => progress[l.id]?.status === "completed"
        ).length;
        const sectionTotalCount = section.lessons.length;

        return (
          <div key={section.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
            {/* Section header */}
            <button
              onClick={() => toggleSection(section.id)}
              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <svg
                  className={`w-4 h-4 sm:w-5 sm:h-5 text-gray-400 transition-transform flex-shrink-0 ${
                    isExpanded ? "rotate-90" : ""
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
                <div className="text-left min-w-0">
                  <h3 className="font-semibold text-dark text-sm sm:text-base truncate">{section.title}</h3>
                  {section.description && (
                    <p className="text-xs sm:text-sm text-gray-500 truncate">{section.description}</p>
                  )}
                </div>
              </div>
              <span className="text-xs sm:text-sm text-gray-500 flex-shrink-0 ml-2">
                {sectionCompletedCount}/{sectionTotalCount}
              </span>
            </button>

            {/* Lessons */}
            {isExpanded && (
              <div className="border-t">
                {section.lessons.map((lesson) => {
                  const isLocked = isLessonLocked(lesson);
                  const isCurrent = lesson.id === currentLessonId;

                  return (
                    <div key={lesson.id}>
                      {isLocked ? (
                        <div
                          className="px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between text-gray-400 cursor-not-allowed"
                          title="Complete previous lessons to unlock"
                        >
                          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                            <span className="text-gray-300 flex-shrink-0">{getLessonIcon(lesson.type)}</span>
                            <div className="min-w-0">
                              <p className="font-medium text-sm sm:text-base truncate">{lesson.title}</p>
                              <p className="text-xs">
                                {LESSON_TYPE_CONFIG[lesson.type].label} &middot;{" "}
                                {lesson.estimatedDuration} min
                              </p>
                            </div>
                          </div>
                          <svg
                            className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 ml-2"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
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
                          href={`/training/lessons/${lesson.id}`}
                          className={`px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between hover:bg-gray-50 transition-colors ${
                            isCurrent ? "bg-accent/5 border-l-2 border-accent" : ""
                          }`}
                        >
                          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                            <span className={`flex-shrink-0 ${isCurrent ? "text-accent" : "text-gray-400"}`}>
                              {getLessonIcon(lesson.type)}
                            </span>
                            <div className="min-w-0">
                              <p
                                className={`font-medium text-sm sm:text-base truncate ${
                                  isCurrent ? "text-accent" : "text-dark"
                                }`}
                              >
                                {lesson.title}
                              </p>
                              <p className="text-xs text-gray-500">
                                {LESSON_TYPE_CONFIG[lesson.type].label} &middot;{" "}
                                {lesson.estimatedDuration} min
                              </p>
                            </div>
                          </div>
                          <span className="flex-shrink-0 ml-2">{getProgressIcon(lesson.id)}</span>
                        </Link>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
