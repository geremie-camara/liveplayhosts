"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  Course,
  Section,
  Lesson,
  CourseCategory,
  CourseStatus,
  CATEGORY_CONFIG,
  LESSON_TYPE_CONFIG,
  LessonType,
} from "@/lib/training-types";

interface SectionWithLessons extends Section {
  lessons: Lesson[];
}

export default function EditCoursePage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [course, setCourse] = useState<Course | null>(null);
  const [sections, setSections] = useState<SectionWithLessons[]>([]);

  // Section modal state
  const [sectionModal, setSectionModal] = useState<{
    open: boolean;
    editing: Section | null;
    title: string;
    description: string;
  }>({ open: false, editing: null, title: "", description: "" });

  // Lesson modal state
  const [lessonModal, setLessonModal] = useState<{
    open: boolean;
    sectionId: string;
    editing: Lesson | null;
  }>({ open: false, sectionId: "", editing: null });

  useEffect(() => {
    fetchCourse();
  }, [id]);

  const fetchCourse = async () => {
    try {
      const res = await fetch(`/api/admin/training/courses/${id}?includeContent=true`);
      if (res.ok) {
        const data = await res.json();
        setCourse(data.course);
        setSections(data.sections || []);
      } else if (res.status === 404) {
        router.push("/admin/training");
      }
    } catch (error) {
      console.error("Error fetching course:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCourse = async () => {
    if (!course) return;
    setSaving(true);

    try {
      const res = await fetch(`/api/admin/training/courses/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(course),
      });

      if (res.ok) {
        alert("Course saved successfully");
      } else {
        alert("Failed to save course");
      }
    } catch (error) {
      console.error("Error saving course:", error);
      alert("Failed to save course");
    } finally {
      setSaving(false);
    }
  };

  // Section handlers
  const handleSaveSection = async () => {
    const { editing, title, description } = sectionModal;
    if (!title.trim()) return;

    try {
      if (editing) {
        // Update existing section
        const res = await fetch(`/api/admin/training/sections/${editing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, description }),
        });
        if (res.ok) {
          const updated = await res.json();
          setSections(sections.map((s) => (s.id === editing.id ? { ...s, ...updated } : s)));
        }
      } else {
        // Create new section
        const res = await fetch("/api/admin/training/sections", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            courseId: id,
            title,
            description,
            order: sections.length,
          }),
        });
        if (res.ok) {
          const newSection = await res.json();
          setSections([...sections, { ...newSection, lessons: [] }]);
        }
      }
      setSectionModal({ open: false, editing: null, title: "", description: "" });
    } catch (error) {
      console.error("Error saving section:", error);
      alert("Failed to save section");
    }
  };

  const handleDeleteSection = async (sectionId: string) => {
    if (!confirm("Delete this section and all its lessons?")) return;

    try {
      const res = await fetch(`/api/admin/training/sections/${sectionId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setSections(sections.filter((s) => s.id !== sectionId));
      }
    } catch (error) {
      console.error("Error deleting section:", error);
    }
  };

  // Lesson handlers
  const openNewLessonModal = (sectionId: string) => {
    setLessonModal({ open: true, sectionId, editing: null });
  };

  const openEditLessonModal = (lesson: Lesson) => {
    setLessonModal({ open: true, sectionId: lesson.sectionId, editing: lesson });
  };

  const handleDeleteLesson = async (lessonId: string, sectionId: string) => {
    if (!confirm("Delete this lesson?")) return;

    try {
      const res = await fetch(`/api/admin/training/lessons/${lessonId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setSections(
          sections.map((s) =>
            s.id === sectionId ? { ...s, lessons: s.lessons.filter((l) => l.id !== lessonId) } : s
          )
        );
      }
    } catch (error) {
      console.error("Error deleting lesson:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
      </div>
    );
  }

  if (!course) {
    return <div>Course not found</div>;
  }

  return (
    <>
      {/* Breadcrumb */}
      <nav className="mb-6">
        <ol className="flex items-center gap-2 text-sm text-gray-500">
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
          <li className="text-dark font-medium">{course.title}</li>
        </ol>
      </nav>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Course Details */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl shadow-sm p-6 sticky top-6">
            <h2 className="text-lg font-semibold text-dark mb-4">Course Details</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-dark mb-1">Title</label>
                <input
                  type="text"
                  value={course.title}
                  onChange={(e) => setCourse({ ...course, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-dark mb-1">Description</label>
                <textarea
                  value={course.description}
                  onChange={(e) => setCourse({ ...course, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-dark mb-1">Category</label>
                <select
                  value={course.category}
                  onChange={(e) => setCourse({ ...course, category: e.target.value as CourseCategory })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                >
                  {(Object.keys(CATEGORY_CONFIG) as CourseCategory[]).map((cat) => (
                    <option key={cat} value={cat}>
                      {CATEGORY_CONFIG[cat].label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-dark mb-1">Duration (min)</label>
                <input
                  type="number"
                  value={course.estimatedDuration}
                  onChange={(e) =>
                    setCourse({ ...course, estimatedDuration: parseInt(e.target.value) || 0 })
                  }
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-dark mb-1">Status</label>
                <select
                  value={course.status}
                  onChange={(e) => setCourse({ ...course, status: e.target.value as CourseStatus })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={course.isRequired}
                    onChange={(e) => setCourse({ ...course, isRequired: e.target.checked })}
                    className="rounded text-accent"
                  />
                  Required course
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={course.isSequential}
                    onChange={(e) => setCourse({ ...course, isSequential: e.target.checked })}
                    className="rounded text-accent"
                  />
                  Sequential (must complete in order)
                </label>
              </div>

              <button
                onClick={handleSaveCourse}
                disabled={saving}
                className="w-full px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Course"}
              </button>
            </div>
          </div>
        </div>

        {/* Sections & Lessons */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-dark">Sections & Lessons</h2>
            <button
              onClick={() => setSectionModal({ open: true, editing: null, title: "", description: "" })}
              className="px-3 py-1.5 bg-accent text-white text-sm rounded-lg hover:bg-accent/90 flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Section
            </button>
          </div>

          {sections.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
              <p className="text-gray-500 mb-4">No sections yet. Add a section to start organizing lessons.</p>
              <button
                onClick={() => setSectionModal({ open: true, editing: null, title: "", description: "" })}
                className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90"
              >
                Add First Section
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {sections
                .sort((a, b) => a.order - b.order)
                .map((section) => (
                  <div key={section.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                    {/* Section Header */}
                    <div className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-dark">{section.title}</h3>
                        {section.description && (
                          <p className="text-sm text-gray-500">{section.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openNewLessonModal(section.id)}
                          className="p-1.5 text-accent hover:bg-accent/10 rounded"
                          title="Add Lesson"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 4v16m8-8H4"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={() =>
                            setSectionModal({
                              open: true,
                              editing: section,
                              title: section.title,
                              description: section.description || "",
                            })
                          }
                          className="p-1.5 text-gray-400 hover:text-accent hover:bg-gray-100 rounded"
                          title="Edit Section"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteSection(section.id)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-gray-100 rounded"
                          title="Delete Section"
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
                    </div>

                    {/* Lessons */}
                    <div className="divide-y">
                      {section.lessons.length === 0 ? (
                        <div className="px-4 py-6 text-center text-gray-400 text-sm">
                          No lessons yet.{" "}
                          <button
                            onClick={() => openNewLessonModal(section.id)}
                            className="text-accent hover:underline"
                          >
                            Add one
                          </button>
                        </div>
                      ) : (
                        section.lessons
                          .sort((a, b) => a.order - b.order)
                          .map((lesson) => (
                            <div
                              key={lesson.id}
                              className="px-4 py-3 flex items-center justify-between hover:bg-gray-50"
                            >
                              <div className="flex items-center gap-3">
                                <span className="text-gray-400">
                                  {lesson.type === "video" && (
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                                  )}
                                  {lesson.type === "article" && (
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                      />
                                    </svg>
                                  )}
                                  {lesson.type === "quiz" && (
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                                      />
                                    </svg>
                                  )}
                                </span>
                                <div>
                                  <div className="font-medium text-dark text-sm">{lesson.title}</div>
                                  <div className="text-xs text-gray-500">
                                    {LESSON_TYPE_CONFIG[lesson.type]?.label} &middot; {lesson.estimatedDuration} min
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <Link
                                  href={`/admin/training/courses/${id}/lessons/${lesson.id}`}
                                  className="p-1.5 text-gray-400 hover:text-accent hover:bg-gray-100 rounded"
                                  title="Edit Lesson"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                    />
                                  </svg>
                                </Link>
                                <button
                                  onClick={() => handleDeleteLesson(lesson.id, section.id)}
                                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-gray-100 rounded"
                                  title="Delete"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                    />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          ))
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Section Modal */}
      {sectionModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-dark mb-4">
              {sectionModal.editing ? "Edit Section" : "Add Section"}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-dark mb-1">Title *</label>
                <input
                  type="text"
                  value={sectionModal.title}
                  onChange={(e) => setSectionModal({ ...sectionModal, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                  placeholder="Section title"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark mb-1">Description</label>
                <textarea
                  value={sectionModal.description}
                  onChange={(e) => setSectionModal({ ...sectionModal, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                  rows={2}
                  placeholder="Optional description"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setSectionModal({ open: false, editing: null, title: "", description: "" })}
                className="px-4 py-2 text-gray-600 hover:text-dark"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSection}
                className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90"
              >
                {sectionModal.editing ? "Save" : "Add"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Lesson Modal - redirects to lesson editor */}
      {lessonModal.open && !lessonModal.editing && (
        <NewLessonModal
          courseId={id}
          sectionId={lessonModal.sectionId}
          onClose={() => setLessonModal({ open: false, sectionId: "", editing: null })}
          onCreated={(lesson) => {
            setSections(
              sections.map((s) =>
                s.id === lessonModal.sectionId ? { ...s, lessons: [...s.lessons, lesson] } : s
              )
            );
            setLessonModal({ open: false, sectionId: "", editing: null });
          }}
        />
      )}
    </>
  );
}

// New Lesson Modal Component
function NewLessonModal({
  courseId,
  sectionId,
  onClose,
  onCreated,
}: {
  courseId: string;
  sectionId: string;
  onClose: () => void;
  onCreated: (lesson: Lesson) => void;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    type: "article" as LessonType,
    estimatedDuration: 10,
  });

  const handleCreate = async () => {
    if (!form.title.trim()) return;
    setSaving(true);

    try {
      const res = await fetch("/api/admin/training/lessons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          courseId,
          sectionId,
          content: "",
        }),
      });

      if (res.ok) {
        const lesson = await res.json();
        onCreated(lesson);
        // Navigate to lesson editor
        router.push(`/admin/training/courses/${courseId}/lessons/${lesson.id}`);
      } else {
        alert("Failed to create lesson");
      }
    } catch (error) {
      console.error("Error creating lesson:", error);
      alert("Failed to create lesson");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4">
        <h3 className="text-lg font-semibold text-dark mb-4">Add Lesson</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-dark mb-1">Title *</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg"
              placeholder="Lesson title"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-dark mb-1">Type</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as LessonType })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg"
            >
              <option value="article">Article</option>
              <option value="video">Video</option>
              <option value="quiz">Quiz</option>
              <option value="faq">FAQ</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-dark mb-1">Duration (minutes)</label>
            <input
              type="number"
              value={form.estimatedDuration}
              onChange={(e) => setForm({ ...form, estimatedDuration: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg"
              min={1}
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:text-dark">
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={saving || !form.title.trim()}
            className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-50"
          >
            {saving ? "Creating..." : "Create & Edit"}
          </button>
        </div>
      </div>
    </div>
  );
}
