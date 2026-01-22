"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Lesson, LessonType, LESSON_TYPE_CONFIG } from "@/lib/training-types";

export default function EditLessonPage() {
  const params = useParams();
  const courseId = params.id as string;
  const lessonId = params.lessonId as string;
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    fetchLesson();
  }, [lessonId]);

  const fetchLesson = async () => {
    try {
      const res = await fetch(`/api/admin/training/lessons/${lessonId}`);
      if (res.ok) {
        const data = await res.json();
        setLesson(data);
      } else if (res.status === 404) {
        router.push(`/admin/training/courses/${courseId}`);
      }
    } catch (error) {
      console.error("Error fetching lesson:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!lesson) return;
    setSaving(true);

    try {
      const res = await fetch(`/api/admin/training/lessons/${lessonId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lesson),
      });

      if (res.ok) {
        alert("Lesson saved successfully");
      } else {
        alert("Failed to save lesson");
      }
    } catch (error) {
      console.error("Error saving lesson:", error);
      alert("Failed to save lesson");
    } finally {
      setSaving(false);
    }
  };

  const handleVideoUpload = async (file: File) => {
    setUploading(true);
    setUploadProgress(0);

    try {
      // Get presigned URL
      const urlRes = await fetch(
        `/api/upload-url?filename=${encodeURIComponent(file.name)}&contentType=${encodeURIComponent(file.type)}&folder=training-videos`
      );
      if (!urlRes.ok) {
        throw new Error("Failed to get upload URL");
      }
      const { uploadUrl, key } = await urlRes.json();

      // Upload to S3
      const xhr = new XMLHttpRequest();
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          setUploadProgress(Math.round((e.loaded / e.total) * 100));
        }
      });

      await new Promise<void>((resolve, reject) => {
        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type);
        xhr.onload = () => {
          if (xhr.status === 200) {
            resolve();
          } else {
            reject(new Error("Upload failed"));
          }
        };
        xhr.onerror = () => reject(new Error("Upload failed"));
        xhr.send(file);
      });

      // Update lesson with S3 key
      setLesson({ ...lesson!, videoS3Key: key, videoUrl: undefined });
      alert("Video uploaded successfully! Remember to save the lesson.");
    } catch (error) {
      console.error("Error uploading video:", error);
      alert("Failed to upload video");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
      </div>
    );
  }

  if (!lesson) {
    return <div>Lesson not found</div>;
  }

  return (
    <>
      {/* Breadcrumb */}
      <nav className="mb-6">
        <ol className="flex items-center gap-2 text-sm text-gray-500 flex-wrap">
          <li>
            <Link href="/admin/training" className="hover:text-accent">
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
            <Link href={`/admin/training/courses/${courseId}`} className="hover:text-accent">
              Course
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

      <div className="max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-primary">Edit Lesson</h1>
          <div className="flex items-center gap-3">
            <Link
              href={`/training/lessons/${lessonId}`}
              target="_blank"
              className="px-4 py-2 text-gray-600 hover:text-accent flex items-center gap-2"
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
              Preview
            </Link>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Lesson"}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-6 space-y-6">
          {/* Basic Info */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark mb-1">Title *</label>
              <input
                type="text"
                value={lesson.title}
                onChange={(e) => setLesson({ ...lesson, title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark mb-1">Type</label>
              <select
                value={lesson.type}
                onChange={(e) => setLesson({ ...lesson, type: e.target.value as LessonType })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg"
              >
                {(Object.keys(LESSON_TYPE_CONFIG) as LessonType[]).map((type) => (
                  <option key={type} value={type}>
                    {LESSON_TYPE_CONFIG[type].label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-dark mb-1">Duration (minutes)</label>
              <input
                type="number"
                value={lesson.estimatedDuration}
                onChange={(e) =>
                  setLesson({ ...lesson, estimatedDuration: parseInt(e.target.value) || 0 })
                }
                min={1}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark mb-1">Order</label>
              <input
                type="number"
                value={lesson.order}
                onChange={(e) => setLesson({ ...lesson, order: parseInt(e.target.value) || 0 })}
                min={0}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg"
              />
            </div>
          </div>

          {/* Video Section */}
          {lesson.type === "video" && (
            <div className="border-t pt-6">
              <h3 className="font-semibold text-dark mb-4">Video Content</h3>

              {/* YouTube URL */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-dark mb-1">
                  YouTube/Vimeo URL
                </label>
                <input
                  type="url"
                  value={lesson.videoUrl || ""}
                  onChange={(e) =>
                    setLesson({ ...lesson, videoUrl: e.target.value || undefined, videoS3Key: undefined })
                  }
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                  placeholder="https://www.youtube.com/watch?v=..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  Paste a YouTube or Vimeo URL for embedded video
                </p>
              </div>

              <div className="text-center text-gray-400 my-4">— or —</div>

              {/* S3 Upload */}
              <div>
                <label className="block text-sm font-medium text-dark mb-2">Upload Video</label>
                {lesson.videoS3Key ? (
                  <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="text-green-700 text-sm flex-1">Video uploaded</span>
                    <button
                      onClick={() => setLesson({ ...lesson, videoS3Key: undefined })}
                      className="text-red-500 text-sm hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center">
                    {uploading ? (
                      <div>
                        <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                          <div
                            className="bg-accent h-2 rounded-full transition-all"
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                        <p className="text-sm text-gray-500">Uploading... {uploadProgress}%</p>
                      </div>
                    ) : (
                      <>
                        <input
                          type="file"
                          accept="video/mp4,video/quicktime,video/webm"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleVideoUpload(file);
                          }}
                          className="hidden"
                          id="video-upload"
                        />
                        <label
                          htmlFor="video-upload"
                          className="cursor-pointer flex flex-col items-center"
                        >
                          <svg
                            className="w-12 h-12 text-gray-300 mb-2"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1.5}
                              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                            />
                          </svg>
                          <span className="text-accent font-medium">Click to upload</span>
                          <span className="text-xs text-gray-500 mt-1">MP4, MOV, WebM (max 500MB)</span>
                        </label>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Article Content */}
          {(lesson.type === "article" || lesson.type === "faq") && (
            <div className="border-t pt-6">
              <h3 className="font-semibold text-dark mb-4">
                {lesson.type === "article" ? "Article Content" : "FAQ Content"}
              </h3>
              <div>
                <label className="block text-sm font-medium text-dark mb-1">
                  Content (HTML supported)
                </label>
                <textarea
                  value={lesson.content}
                  onChange={(e) => setLesson({ ...lesson, content: e.target.value })}
                  rows={20}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg font-mono text-sm"
                  placeholder="<h2>Section Title</h2>
<p>Your content here...</p>

<h3>Subsection</h3>
<ul>
  <li>Point 1</li>
  <li>Point 2</li>
</ul>"
                />
                <p className="text-xs text-gray-500 mt-1">
                  You can use HTML tags: h2, h3, p, ul, ol, li, strong, em, a, blockquote, code, pre
                </p>
              </div>
            </div>
          )}

          {/* Quiz placeholder */}
          {lesson.type === "quiz" && (
            <div className="border-t pt-6">
              <div className="text-center py-8 text-gray-500">
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
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                  />
                </svg>
                <p>Quiz editor coming soon.</p>
                <p className="text-sm">For now, you can change the lesson type or add placeholder content.</p>
              </div>
            </div>
          )}
        </div>

        {/* Back link */}
        <div className="mt-6">
          <Link
            href={`/admin/training/courses/${courseId}`}
            className="text-gray-500 hover:text-accent flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            Back to Course
          </Link>
        </div>
      </div>
    </>
  );
}
