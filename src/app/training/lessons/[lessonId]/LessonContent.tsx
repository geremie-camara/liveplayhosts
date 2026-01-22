"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Lesson, TrainingProgress } from "@/lib/training-types";
import VideoPlayer from "@/components/training/VideoPlayer";
import ArticleContent from "@/components/training/ArticleContent";

interface LessonContentProps {
  lesson: Lesson;
  userId: string;
  courseId: string;
  currentProgress?: TrainingProgress;
  nextLessonId?: string;
}

export default function LessonContent({
  lesson,
  userId,
  courseId,
  currentProgress,
  nextLessonId,
}: LessonContentProps) {
  const router = useRouter();
  const [isCompleted, setIsCompleted] = useState(
    currentProgress?.status === "completed"
  );
  const [timeSpent, setTimeSpent] = useState(currentProgress?.timeSpent || 0);
  const [saving, setSaving] = useState(false);

  // Track time spent on lesson
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeSpent((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Save progress periodically
  useEffect(() => {
    const saveProgress = async () => {
      if (saving) return;

      try {
        await fetch("/api/training/progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lessonId: lesson.id,
            courseId,
            sectionId: lesson.sectionId,
            status: isCompleted ? "completed" : "in_progress",
            timeSpent,
          }),
        });
      } catch (error) {
        console.error("Error saving progress:", error);
      }
    };

    // Save every 30 seconds
    const interval = setInterval(saveProgress, 30000);

    // Save on unmount
    return () => {
      clearInterval(interval);
      saveProgress();
    };
  }, [lesson.id, courseId, lesson.sectionId, isCompleted, timeSpent, saving]);

  const handleComplete = useCallback(async () => {
    if (isCompleted || saving) return;

    setSaving(true);
    setIsCompleted(true);

    try {
      const res = await fetch("/api/training/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lessonId: lesson.id,
          courseId,
          sectionId: lesson.sectionId,
          status: "completed",
          timeSpent,
        }),
      });

      if (res.ok) {
        // Refresh to update the navigation buttons, then navigate to next lesson
        router.refresh();
        if (nextLessonId) {
          // Small delay to let the refresh complete
          setTimeout(() => {
            router.push(`/training/lessons/${nextLessonId}`);
          }, 500);
        }
      } else {
        console.error("Error saving progress:", await res.text());
        setIsCompleted(false);
      }
    } catch (error) {
      console.error("Error saving progress:", error);
      setIsCompleted(false);
    } finally {
      setSaving(false);
    }
  }, [isCompleted, saving, lesson.id, courseId, lesson.sectionId, timeSpent, router, nextLessonId]);

  const handleVideoProgress = useCallback((seconds: number) => {
    // Could be used for more granular video progress tracking
    console.log("Video progress:", seconds);
  }, []);

  const handleArticleProgress = useCallback((scrollPercent: number) => {
    // Could be used for more granular article progress tracking
    console.log("Article progress:", scrollPercent);
  }, []);

  // Render content based on lesson type
  const renderContent = () => {
    switch (lesson.type) {
      case "video":
        return (
          <div>
            <VideoPlayer
              videoUrl={lesson.videoUrl}
              videoS3Key={lesson.videoS3Key}
              title={lesson.title}
              onProgress={handleVideoProgress}
              onComplete={handleComplete}
            />
            {!isCompleted && (
              <div className="mt-6 text-center">
                <p className="text-gray-500 mb-3">
                  Watch the video to completion or mark it complete manually.
                </p>
                <button
                  onClick={handleComplete}
                  disabled={saving}
                  className="px-6 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Mark as Complete"}
                </button>
              </div>
            )}
          </div>
        );

      case "article":
        return (
          <div>
            <ArticleContent
              content={lesson.content}
              onProgress={handleArticleProgress}
              onComplete={handleComplete}
            />
            {!isCompleted && (
              <div className="mt-8 pt-6 border-t text-center">
                <p className="text-gray-500 mb-3">
                  Finished reading? Mark this lesson as complete.
                </p>
                <button
                  onClick={handleComplete}
                  disabled={saving}
                  className="px-6 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Mark as Complete"}
                </button>
              </div>
            )}
          </div>
        );

      case "quiz":
        return (
          <div className="text-center py-12">
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
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
              />
            </svg>
            <h3 className="text-lg font-semibold text-dark mb-2">Quiz Coming Soon</h3>
            <p className="text-gray-500 mb-6">
              The quiz feature is currently under development.
            </p>
            {!isCompleted && (
              <button
                onClick={handleComplete}
                disabled={saving}
                className="px-6 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50"
              >
                {saving ? "Saving..." : "Mark as Complete"}
              </button>
            )}
          </div>
        );

      case "faq":
        return (
          <div>
            {lesson.content ? (
              <ArticleContent
                content={lesson.content}
                onProgress={handleArticleProgress}
                onComplete={handleComplete}
              />
            ) : (
              <div className="text-center py-12">
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
                    d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <h3 className="text-lg font-semibold text-dark mb-2">FAQ</h3>
                <p className="text-gray-500">No FAQ content available.</p>
              </div>
            )}
            {!isCompleted && (
              <div className="mt-8 pt-6 border-t text-center">
                <button
                  onClick={handleComplete}
                  disabled={saving}
                  className="px-6 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Mark as Complete"}
                </button>
              </div>
            )}
          </div>
        );

      default:
        return (
          <div className="text-center py-12 text-gray-500">
            Unknown lesson type
          </div>
        );
    }
  };

  return (
    <div>
      {renderContent()}

      {/* Completed message */}
      {isCompleted && (
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
              <p className="font-medium text-green-800">Lesson Complete!</p>
              <p className="text-sm text-green-600">
                {nextLessonId
                  ? "Great job! Taking you to the next lesson..."
                  : "Great job! You've finished this lesson."}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
