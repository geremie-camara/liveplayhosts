"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import RichTextEditor from "@/components/RichTextEditor";
import { BroadcastTemplate, TemplateFormData, BroadcastChannels } from "@/lib/broadcast-types";

export default function EditTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [template, setTemplate] = useState<BroadcastTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState<TemplateFormData>({
    name: "",
    subject: "",
    bodyHtml: "",
    bodySms: "",
    defaultChannels: { slack: true, email: true, sms: false },
    variables: [],
  });

  useEffect(() => {
    fetchTemplate();
  }, [id]);

  const fetchTemplate = async () => {
    try {
      const res = await fetch(`/api/admin/templates/${id}`);
      if (res.ok) {
        const data = await res.json();
        setTemplate(data);
        setFormData({
          name: data.name,
          subject: data.subject,
          bodyHtml: data.bodyHtml,
          bodySms: data.bodySms,
          defaultChannels: data.defaultChannels,
          variables: data.variables || [],
        });
      } else if (res.status === 404) {
        router.push("/admin/templates");
      }
    } catch (error) {
      console.error("Error fetching template:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof TemplateFormData, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleChannelChange = (channel: keyof BroadcastChannels, checked: boolean) => {
    setFormData((prev) => ({
      ...prev,
      defaultChannels: { ...prev.defaultChannels, [channel]: checked },
    }));
  };

  const handleSave = async () => {
    if (!formData.name || !formData.subject || !formData.bodyHtml || !formData.bodySms) {
      alert("Please fill in all required fields");
      return;
    }

    if (formData.bodySms.length > 160) {
      alert("SMS text must be 160 characters or less");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/templates/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        const data = await res.json();
        setTemplate(data);
        alert("Template saved successfully");
      } else {
        const data = await res.json();
        alert(data.error || "Failed to save template");
      }
    } catch (error) {
      console.error("Error saving template:", error);
      alert("Failed to save template");
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
      </div>
    );
  }

  if (!template) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Template not found</p>
        <Link href="/admin/templates" className="text-accent hover:underline mt-4 inline-block">
          Back to Templates
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="mb-8">
        <Link
          href="/admin/templates"
          className="text-gray-500 hover:text-gray-700 inline-flex items-center gap-1 mb-4"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Templates
        </Link>
        <h1 className="text-3xl font-bold text-primary">Edit Template</h1>
        <p className="text-gray-600 mt-2">
          Last updated {formatDate(template.updatedAt)}
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Form */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
            <h2 className="font-semibold text-dark">Template Details</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Template Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleChange("name", e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-accent focus:border-accent"
                placeholder="e.g., Weekly Update"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Subject *
              </label>
              <input
                type="text"
                value={formData.subject}
                onChange={(e) => handleChange("subject", e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-accent focus:border-accent"
                placeholder="e.g., Important Update from LivePlay"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Message Body *
              </label>
              <RichTextEditor
                content={formData.bodyHtml}
                onChange={(html) => handleChange("bodyHtml", html)}
                placeholder="Write your message template here..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                SMS Text * <span className="text-gray-400">({formData.bodySms.length}/160)</span>
              </label>
              <textarea
                value={formData.bodySms}
                onChange={(e) => handleChange("bodySms", e.target.value)}
                maxLength={160}
                rows={2}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-accent focus:border-accent ${
                  formData.bodySms.length > 160 ? "border-red-500" : ""
                }`}
                placeholder="Short message for SMS"
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h2 className="font-semibold text-dark mb-4">Default Channels</h2>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.defaultChannels.slack}
                  onChange={(e) => handleChannelChange("slack", e.target.checked)}
                  className="rounded text-accent focus:ring-accent"
                />
                <span className="flex items-center gap-2">
                  <span className="px-2 py-1 text-xs bg-purple-100 text-purple-600 rounded">Slack</span>
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.defaultChannels.email}
                  onChange={(e) => handleChannelChange("email", e.target.checked)}
                  className="rounded text-accent focus:ring-accent"
                />
                <span className="flex items-center gap-2">
                  <span className="px-2 py-1 text-xs bg-blue-100 text-blue-600 rounded">Email</span>
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.defaultChannels.sms}
                  onChange={(e) => handleChannelChange("sms", e.target.checked)}
                  className="rounded text-accent focus:ring-accent"
                />
                <span className="flex items-center gap-2">
                  <span className="px-2 py-1 text-xs bg-green-100 text-green-600 rounded">SMS</span>
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm p-6 space-y-3">
            <h2 className="font-semibold text-dark mb-4">Actions</h2>
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full px-4 py-3 bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
              )}
              Save Changes
            </button>
            <Link
              href={`/admin/broadcasts/new?template=${id}`}
              className="w-full px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Use in New Broadcast
            </Link>
          </div>

          {/* Preview */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h2 className="font-semibold text-dark mb-4">Preview</h2>
            <div className="border rounded-lg p-4 bg-gray-50 max-h-64 overflow-y-auto">
              <div className="text-xs text-gray-500 mb-2">Subject: {formData.subject || "(no subject)"}</div>
              <div
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: formData.bodyHtml || "<p>(no content)</p>" }}
              />
            </div>
          </div>

          {/* Info */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h2 className="font-semibold text-dark mb-4">Information</h2>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-gray-500">Created:</span>
                <span className="ml-2 text-gray-900">{formatDate(template.createdAt)}</span>
              </div>
              <div>
                <span className="text-gray-500">Updated:</span>
                <span className="ml-2 text-gray-900">{formatDate(template.updatedAt)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
