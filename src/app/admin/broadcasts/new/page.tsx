"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import RichTextEditor from "@/components/RichTextEditor";
import VideoUpload from "@/components/VideoUpload";
import UserSelector from "@/components/UserSelector";
import { BroadcastFormData, BroadcastTemplate, BroadcastChannels, UserSelection } from "@/lib/broadcast-types";

export default function NewBroadcastPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [templates, setTemplates] = useState<BroadcastTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [previewMode, setPreviewMode] = useState<"email" | "slack" | "sms">("email");

  const [formData, setFormData] = useState<BroadcastFormData>({
    title: "",
    subject: "",
    bodyHtml: "",
    bodySms: "",
    videoUrl: "",
    linkUrl: "",
    linkText: "",
    targetRoles: [],
    userSelection: {
      filterRoles: [],
      filterLocations: [],
      selectedUserIds: [],
    },
    channels: { slack: true, email: true, sms: false },
    scheduledAt: "",
  });

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const res = await fetch("/api/admin/templates");
      if (res.ok) {
        const data = await res.json();
        setTemplates(data);
      }
    } catch (error) {
      console.error("Error fetching templates:", error);
    }
  };

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    if (!templateId) return;

    const template = templates.find((t) => t.id === templateId);
    if (template) {
      setFormData((prev) => ({
        ...prev,
        subject: template.subject,
        bodyHtml: template.bodyHtml,
        bodySms: template.bodySms,
        channels: template.defaultChannels,
        templateId: template.id,
        userSelection: template.defaultUserSelection || prev.userSelection,
      }));
    }
  };

  const handleChange = (field: keyof BroadcastFormData, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleChannelChange = (channel: keyof BroadcastChannels, checked: boolean) => {
    setFormData((prev) => ({
      ...prev,
      channels: { ...prev.channels, [channel]: checked },
    }));
  };

  const handleUserSelectionChange = (selection: UserSelection) => {
    setFormData((prev) => ({
      ...prev,
      userSelection: selection,
      // Also update targetUserIds for the API
      targetUserIds: selection.selectedUserIds,
    }));
  };

  const validateForm = (): string | null => {
    if (!formData.title.trim()) return "Title is required";
    if (!formData.subject.trim()) return "Subject is required";
    if (!formData.bodyHtml.trim()) return "Message body is required";
    if (!formData.bodySms.trim()) return "SMS text is required";
    if (formData.bodySms.length > 160) return "SMS text must be 160 characters or less";
    if (!formData.userSelection?.selectedUserIds.length) return "Select at least one recipient";
    if (!formData.channels.slack && !formData.channels.email && !formData.channels.sms) {
      return "Select at least one channel";
    }
    return null;
  };

  const handleSaveDraft = async () => {
    const error = validateForm();
    if (error) {
      alert(error);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/broadcasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        router.push("/admin/broadcasts");
      } else {
        const data = await res.json();
        alert(data.error || "Failed to save broadcast");
      }
    } catch (error) {
      console.error("Error saving broadcast:", error);
      alert("Failed to save broadcast");
    } finally {
      setSaving(false);
    }
  };

  const handleSendNow = async () => {
    const error = validateForm();
    if (error) {
      alert(error);
      return;
    }

    if (!confirm("Are you sure you want to send this broadcast immediately?")) {
      return;
    }

    setSending(true);
    try {
      // First create the broadcast
      const createRes = await fetch("/api/admin/broadcasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!createRes.ok) {
        const data = await createRes.json();
        alert(data.error || "Failed to create broadcast");
        return;
      }

      const broadcast = await createRes.json();

      // Then send it
      const sendRes = await fetch(`/api/admin/broadcasts/${broadcast.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (sendRes.ok) {
        router.push("/admin/broadcasts");
      } else {
        const data = await sendRes.json();
        alert(data.error || "Failed to send broadcast");
      }
    } catch (error) {
      console.error("Error sending broadcast:", error);
      alert("Failed to send broadcast");
    } finally {
      setSending(false);
    }
  };

  const handleSchedule = async () => {
    if (!formData.scheduledAt) {
      alert("Please select a schedule date and time");
      return;
    }

    const error = validateForm();
    if (error) {
      alert(error);
      return;
    }

    const scheduledDate = new Date(formData.scheduledAt);
    if (scheduledDate <= new Date()) {
      alert("Scheduled time must be in the future");
      return;
    }

    setSending(true);
    try {
      // First create the broadcast
      const createRes = await fetch("/api/admin/broadcasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!createRes.ok) {
        const data = await createRes.json();
        alert(data.error || "Failed to create broadcast");
        return;
      }

      const broadcast = await createRes.json();

      // Then schedule it
      const sendRes = await fetch(`/api/admin/broadcasts/${broadcast.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledAt: formData.scheduledAt }),
      });

      if (sendRes.ok) {
        router.push("/admin/broadcasts");
      } else {
        const data = await sendRes.json();
        alert(data.error || "Failed to schedule broadcast");
      }
    } catch (error) {
      console.error("Error scheduling broadcast:", error);
      alert("Failed to schedule broadcast");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <div className="mb-8">
        <Link
          href="/admin/broadcasts"
          className="text-gray-500 hover:text-gray-700 inline-flex items-center gap-1 mb-4"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Broadcasts
        </Link>
        <h1 className="text-3xl font-bold text-primary">New Broadcast</h1>
        <p className="text-gray-600 mt-2">Create and send a new message to your hosts.</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Template selector */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Start from template (optional)
            </label>
            <select
              value={selectedTemplate}
              onChange={(e) => handleTemplateSelect(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-accent focus:border-accent"
            >
              <option value="">Select a template...</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Channels - moved to top */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h2 className="font-semibold text-dark mb-4">Delivery Channels *</h2>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.channels.slack}
                  onChange={(e) => handleChannelChange("slack", e.target.checked)}
                  className="rounded text-accent focus:ring-accent"
                />
                <span className="flex items-center gap-2">
                  <span className="px-2 py-1 text-xs bg-purple-100 text-purple-600 rounded">Slack</span>
                  Full message as DM
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.channels.email}
                  onChange={(e) => handleChannelChange("email", e.target.checked)}
                  className="rounded text-accent focus:ring-accent"
                />
                <span className="flex items-center gap-2">
                  <span className="px-2 py-1 text-xs bg-blue-100 text-blue-600 rounded">Email</span>
                  Full formatted email
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.channels.sms}
                  onChange={(e) => handleChannelChange("sms", e.target.checked)}
                  className="rounded text-accent focus:ring-accent"
                />
                <span className="flex items-center gap-2">
                  <span className="px-2 py-1 text-xs bg-green-100 text-green-600 rounded">SMS</span>
                  Short text + link
                </span>
              </label>
            </div>
          </div>

          {/* Basic info */}
          <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
            <h2 className="font-semibold text-dark">Message Details</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title (internal reference) *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => handleChange("title", e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-accent focus:border-accent"
                placeholder="e.g., Weekly Update - Jan 2025"
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
                placeholder="Write your message here..."
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
                placeholder="Short message for SMS (link to full message will be added)"
              />
              <p className="text-xs text-gray-500 mt-1">
                A link to the full message will be automatically added to SMS.
              </p>
            </div>
          </div>

          {/* Optional fields */}
          <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
            <h2 className="font-semibold text-dark">Optional Content</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Video Attachment
              </label>
              <VideoUpload
                value={formData.videoUrl || undefined}
                onChange={(url) => handleChange("videoUrl", url || "")}
                folder="broadcast-videos"
                placeholder="Upload a video to include with your broadcast"
              />
              <p className="text-xs text-gray-500 mt-2">
                Video will be embedded in email and message center, and linked in Slack.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  CTA Link URL
                </label>
                <input
                  type="url"
                  value={formData.linkUrl || ""}
                  onChange={(e) => handleChange("linkUrl", e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-accent focus:border-accent"
                  placeholder="https://..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  CTA Button Text
                </label>
                <input
                  type="text"
                  value={formData.linkText || ""}
                  onChange={(e) => handleChange("linkText", e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-accent focus:border-accent"
                  placeholder="Learn More"
                />
              </div>
            </div>
          </div>

          {/* User Selection */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h2 className="font-semibold text-dark mb-4">Select Recipients *</h2>
            <UserSelector
              value={formData.userSelection || { filterRoles: [], filterLocations: [], selectedUserIds: [] }}
              onChange={handleUserSelectionChange}
            />
          </div>

          {/* Schedule */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h2 className="font-semibold text-dark mb-4">Schedule (Optional)</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Send at specific time
              </label>
              <input
                type="datetime-local"
                value={formData.scheduledAt || ""}
                onChange={(e) => handleChange("scheduledAt", e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-accent focus:border-accent"
              />
              <p className="text-xs text-gray-500 mt-1">
                Leave empty to send immediately, or select a future date/time.
              </p>
            </div>
          </div>
        </div>

        {/* Preview & Actions */}
        <div className="space-y-6">
          {/* Actions */}
          <div className="bg-white rounded-2xl shadow-sm p-6 space-y-3">
            <h2 className="font-semibold text-dark mb-4">Actions</h2>
            <button
              onClick={handleSaveDraft}
              disabled={saving || sending}
              className="w-full px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600" />
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
              )}
              Save as Draft
            </button>

            {formData.scheduledAt ? (
              <button
                onClick={handleSchedule}
                disabled={saving || sending}
                className="w-full px-4 py-3 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {sending ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                Schedule Send
              </button>
            ) : (
              <button
                onClick={handleSendNow}
                disabled={saving || sending}
                className="w-full px-4 py-3 bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {sending ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                )}
                Send Now
              </button>
            )}
          </div>

          {/* Preview */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-dark">Preview</h2>
              <div className="flex gap-1">
                <button
                  onClick={() => setPreviewMode("email")}
                  className={`px-3 py-1 text-xs rounded ${
                    previewMode === "email"
                      ? "bg-blue-100 text-blue-600"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  Email
                </button>
                <button
                  onClick={() => setPreviewMode("slack")}
                  className={`px-3 py-1 text-xs rounded ${
                    previewMode === "slack"
                      ? "bg-purple-100 text-purple-600"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  Slack
                </button>
                <button
                  onClick={() => setPreviewMode("sms")}
                  className={`px-3 py-1 text-xs rounded ${
                    previewMode === "sms"
                      ? "bg-green-100 text-green-600"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  SMS
                </button>
              </div>
            </div>

            <div className="border rounded-lg p-4 bg-gray-50 max-h-96 overflow-y-auto">
              {previewMode === "email" && (
                <div>
                  <div className="text-xs text-gray-500 mb-2">Subject: {formData.subject || "(no subject)"}</div>
                  <div
                    className="prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: formData.bodyHtml || "<p>(no content)</p>" }}
                  />
                  {formData.videoUrl && (
                    <div className="mt-4 p-4 bg-gray-200 rounded text-center text-sm text-gray-600">
                      [Video: {formData.videoUrl}]
                    </div>
                  )}
                  {formData.linkUrl && (
                    <div className="mt-4">
                      <span className="inline-block px-4 py-2 bg-accent text-white rounded text-sm">
                        {formData.linkText || "Learn More"}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {previewMode === "slack" && (
                <div className="font-mono text-sm">
                  <div className="font-bold mb-2">{formData.subject || "(no subject)"}</div>
                  <div className="whitespace-pre-wrap">
                    {formData.bodyHtml
                      ? formData.bodyHtml.replace(/<[^>]+>/g, "").trim()
                      : "(no content)"}
                  </div>
                  {formData.videoUrl && (
                    <div className="mt-2 text-blue-600">{formData.videoUrl}</div>
                  )}
                  {formData.linkUrl && (
                    <div className="mt-2">
                      <span className="text-blue-600">[{formData.linkText || "Learn More"}]</span>
                    </div>
                  )}
                </div>
              )}

              {previewMode === "sms" && (
                <div className="font-mono text-sm">
                  <div className="p-3 bg-green-100 rounded-lg">
                    New message: {formData.subject || "(subject)"}. {formData.bodySms || "(message)"}
                    {" "}Read: https://liveplayhosts.com/messages/...
                  </div>
                  <div className="text-xs text-gray-500 mt-2">
                    ~{(formData.bodySms?.length || 0) + 60} characters
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Summary */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h2 className="font-semibold text-dark mb-4">Summary</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Recipients:</span>
                <span className="font-medium">{formData.userSelection?.selectedUserIds.length || 0} users</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Channels:</span>
                <span className="font-medium">
                  {[
                    formData.channels.slack && "Slack",
                    formData.channels.email && "Email",
                    formData.channels.sms && "SMS",
                  ]
                    .filter(Boolean)
                    .join(", ") || "None"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Schedule:</span>
                <span className="font-medium">
                  {formData.scheduledAt
                    ? new Date(formData.scheduledAt).toLocaleString()
                    : "Immediate"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
