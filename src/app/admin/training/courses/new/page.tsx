"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CourseCategory, CourseStatus, CATEGORY_CONFIG } from "@/lib/training-types";

export default function NewCoursePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "onboarding" as CourseCategory,
    isRequired: false,
    isSequential: true,
    estimatedDuration: 30,
    status: "draft" as CourseStatus,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch("/api/admin/training/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        const course = await res.json();
        router.push(`/admin/training/courses/${course.id}`);
      } else {
        const error = await res.json();
        alert(error.error || "Failed to create course");
      }
    } catch (error) {
      console.error("Error creating course:", error);
      alert("Failed to create course");
    } finally {
      setSaving(false);
    }
  };

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
          <li className="text-dark font-medium">New Course</li>
        </ol>
      </nav>

      <div className="max-w-2xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-primary">Create New Course</h1>
          <p className="text-gray-600 mt-2">Set up the basic details for your training course.</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm p-6 space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-dark mb-2">Course Title *</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent"
              placeholder="e.g., Host Onboarding"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-dark mb-2">Description *</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              required
              rows={3}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent"
              placeholder="What will users learn in this course?"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-dark mb-2">Category *</label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value as CourseCategory })}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent"
            >
              {(Object.keys(CATEGORY_CONFIG) as CourseCategory[]).map((cat) => (
                <option key={cat} value={cat}>
                  {CATEGORY_CONFIG[cat].label}
                </option>
              ))}
            </select>
          </div>

          {/* Estimated Duration */}
          <div>
            <label className="block text-sm font-medium text-dark mb-2">Estimated Duration (minutes)</label>
            <input
              type="number"
              value={form.estimatedDuration}
              onChange={(e) => setForm({ ...form, estimatedDuration: parseInt(e.target.value) || 0 })}
              min={1}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent"
            />
          </div>

          {/* Toggles */}
          <div className="space-y-4">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={form.isRequired}
                onChange={(e) => setForm({ ...form, isRequired: e.target.checked })}
                className="w-5 h-5 text-accent rounded focus:ring-accent"
              />
              <div>
                <span className="font-medium text-dark">Required Course</span>
                <p className="text-sm text-gray-500">Users must complete this course</p>
              </div>
            </label>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={form.isSequential}
                onChange={(e) => setForm({ ...form, isSequential: e.target.checked })}
                className="w-5 h-5 text-accent rounded focus:ring-accent"
              />
              <div>
                <span className="font-medium text-dark">Sequential</span>
                <p className="text-sm text-gray-500">Users must complete lessons in order</p>
              </div>
            </label>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-dark mb-2">Status</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="status"
                  value="draft"
                  checked={form.status === "draft"}
                  onChange={(e) => setForm({ ...form, status: e.target.value as CourseStatus })}
                  className="text-accent focus:ring-accent"
                />
                <span>Draft</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="status"
                  value="published"
                  checked={form.status === "published"}
                  onChange={(e) => setForm({ ...form, status: e.target.value as CourseStatus })}
                  className="text-accent focus:ring-accent"
                />
                <span>Published</span>
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-4 pt-4 border-t">
            <Link
              href="/admin/training"
              className="px-4 py-2 text-gray-600 hover:text-dark transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50"
            >
              {saving ? "Creating..." : "Create Course"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
