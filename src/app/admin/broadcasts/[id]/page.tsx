"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import RichTextEditor from "@/components/RichTextEditor";
import VideoUpload from "@/components/VideoUpload";
import UserSelector from "@/components/UserSelector";
import {
  Broadcast,
  BroadcastDelivery,
  BroadcastFormData,
  BroadcastChannels,
  UserSelection,
  BROADCAST_STATUS_CONFIG,
  DELIVERY_STATUS_CONFIG,
} from "@/lib/broadcast-types";
import { UserRole } from "@/lib/types";
import { ROLE_NAMES, ACTIVE_ROLES } from "@/lib/roles";

export default function BroadcastDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const [broadcast, setBroadcast] = useState<Broadcast | null>(null);
  const [deliveries, setDeliveries] = useState<BroadcastDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

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
    fetchBroadcast();
  }, [id]);

  const fetchBroadcast = async () => {
    try {
      const res = await fetch(`/api/admin/broadcasts/${id}`);
      if (res.ok) {
        const data = await res.json();
        setBroadcast(data);
        setFormData({
          title: data.title,
          subject: data.subject,
          bodyHtml: data.bodyHtml,
          bodySms: data.bodySms,
          videoUrl: data.videoUrl || "",
          linkUrl: data.linkUrl || "",
          linkText: data.linkText || "",
          targetRoles: data.targetRoles || [],
          targetUserIds: data.targetUserIds,
          userSelection: data.userSelection || {
            filterRoles: data.targetRoles || [],
            filterLocations: data.targetLocations || [],
            selectedUserIds: data.targetUserIds || [],
          },
          channels: data.channels,
          scheduledAt: data.scheduledAt || "",
        });

        // If sent, fetch deliveries
        if (data.status === "sent" || data.status === "sending") {
          const deliveriesRes = await fetch(`/api/admin/broadcasts/${id}/deliveries`);
          if (deliveriesRes.ok) {
            const deliveriesData = await deliveriesRes.json();
            setDeliveries(deliveriesData.deliveries || []);
          }
        }
      } else if (res.status === 404) {
        router.push("/admin/broadcasts");
      }
    } catch (error) {
      console.error("Error fetching broadcast:", error);
    } finally {
      setLoading(false);
    }
  };

  const isEditable = broadcast?.status === "draft" || broadcast?.status === "scheduled";

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
      targetUserIds: selection.selectedUserIds,
    }));
  };

  const validateForm = (): string | null => {
    if (!formData.title.trim()) return "Title is required";
    if (!formData.subject.trim()) return "Subject is required";
    if (!formData.bodyHtml.trim()) return "Message body is required";
    // Only require SMS text if SMS channel is selected
    if (formData.channels.sms) {
      if (!formData.bodySms.trim()) return "SMS text is required when SMS is enabled";
      if (formData.bodySms.length > 160) return "SMS text must be 160 characters or less";
    }
    // Check for either new user selection or legacy role-based targeting
    const hasUserIds = formData.userSelection?.selectedUserIds && formData.userSelection.selectedUserIds.length > 0;
    const hasRoles = formData.targetRoles && formData.targetRoles.length > 0;
    if (!hasUserIds && !hasRoles) return "Select at least one recipient";
    if (!formData.channels.slack && !formData.channels.email && !formData.channels.sms) {
      return "Select at least one channel";
    }
    return null;
  };

  const handleSave = async () => {
    const error = validateForm();
    if (error) {
      alert(error);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/broadcasts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        const data = await res.json();
        setBroadcast(data);
        alert("Broadcast saved successfully");
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
      // Save first
      await fetch(`/api/admin/broadcasts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      // Then send
      const sendRes = await fetch(`/api/admin/broadcasts/${id}/send`, {
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

  if (!broadcast) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Broadcast not found</p>
        <Link href="/admin/broadcasts" className="text-accent hover:underline mt-4 inline-block">
          Back to Broadcasts
        </Link>
      </div>
    );
  }

  const statusConfig = BROADCAST_STATUS_CONFIG[broadcast.status];

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
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold text-primary">{broadcast.title}</h1>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusConfig.color}`}>
            {statusConfig.label}
          </span>
        </div>
        <p className="text-gray-600 mt-2">
          Created {formatDate(broadcast.createdAt)}
          {broadcast.sentAt && ` • Sent ${formatDate(broadcast.sentAt)}`}
        </p>
      </div>

      {/* Stats for sent broadcasts */}
      {broadcast.stats && (
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <div className="text-3xl font-bold text-primary">{broadcast.stats.totalRecipients}</div>
            <div className="text-gray-600 mt-1">Total Recipients</div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <div className="text-3xl font-bold text-purple-600">
              {broadcast.stats.slackSent}
              <span className="text-sm font-normal text-gray-400">
                /{broadcast.stats.slackSent + broadcast.stats.slackFailed}
              </span>
            </div>
            <div className="text-gray-600 mt-1">Slack Delivered</div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <div className="text-3xl font-bold text-blue-600">
              {broadcast.stats.emailSent}
              <span className="text-sm font-normal text-gray-400">
                /{broadcast.stats.emailSent + broadcast.stats.emailFailed}
              </span>
            </div>
            <div className="text-gray-600 mt-1">Emails Delivered</div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <div className="text-3xl font-bold text-green-600">
              {broadcast.stats.readCount}
              <span className="text-sm font-normal text-gray-400">
                /{broadcast.stats.totalRecipients}
              </span>
            </div>
            <div className="text-gray-600 mt-1">Read in Message Center</div>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Form/View */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic info */}
          <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
            <h2 className="font-semibold text-dark">Message Details</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              {isEditable ? (
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => handleChange("title", e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-accent focus:border-accent"
                />
              ) : (
                <p className="text-gray-900">{broadcast.title}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
              {isEditable ? (
                <input
                  type="text"
                  value={formData.subject}
                  onChange={(e) => handleChange("subject", e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-accent focus:border-accent"
                />
              ) : (
                <p className="text-gray-900">{broadcast.subject}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Message Body</label>
              {isEditable ? (
                <RichTextEditor
                  content={formData.bodyHtml}
                  onChange={(html) => handleChange("bodyHtml", html)}
                />
              ) : (
                <div
                  className="prose prose-sm max-w-none p-4 bg-gray-50 rounded-lg"
                  dangerouslySetInnerHTML={{ __html: broadcast.bodyHtml }}
                />
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                SMS Text ({isEditable ? formData.bodySms.length : broadcast.bodySms.length}/160)
              </label>
              {isEditable ? (
                <textarea
                  value={formData.bodySms}
                  onChange={(e) => handleChange("bodySms", e.target.value)}
                  maxLength={160}
                  rows={2}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-accent focus:border-accent"
                />
              ) : (
                <p className="text-gray-900 p-4 bg-gray-50 rounded-lg">{broadcast.bodySms}</p>
              )}
            </div>

            {/* Video attachment */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Video Attachment
              </label>
              {isEditable ? (
                <>
                  <VideoUpload
                    value={formData.videoUrl || undefined}
                    onChange={(url) => handleChange("videoUrl", url || "")}
                    folder="broadcast-videos"
                    placeholder="Upload a video to include with your broadcast"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    Video will be embedded in email and message center, and linked in Slack.
                  </p>
                </>
              ) : broadcast.videoUrl ? (
                <div className="aspect-video bg-black rounded-lg overflow-hidden">
                  <video
                    src={broadcast.videoUrl}
                    controls
                    className="w-full h-full object-contain"
                  >
                    Your browser does not support the video tag.
                  </video>
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No video attached</p>
              )}
            </div>
          </div>

          {/* Target Audience / User Selection */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h2 className="font-semibold text-dark mb-4">Select Recipients</h2>
            {isEditable ? (
              <UserSelector
                value={formData.userSelection || { filterRoles: [], filterLocations: [], selectedUserIds: [] }}
                onChange={handleUserSelectionChange}
              />
            ) : (
              <div>
                {/* Show selected user count for broadcasts with user selection */}
                {broadcast.targetUserIds && broadcast.targetUserIds.length > 0 ? (
                  <div className="text-gray-700">
                    <span className="font-medium">{broadcast.targetUserIds.length}</span> recipients selected
                    {broadcast.userSelection?.filterRoles && broadcast.userSelection.filterRoles.length > 0 && (
                      <div className="mt-2 text-sm text-gray-500">
                        Filtered by roles: {broadcast.userSelection.filterRoles.map(r => ROLE_NAMES[r] || r).join(", ")}
                      </div>
                    )}
                    {broadcast.userSelection?.filterLocations && broadcast.userSelection.filterLocations.length > 0 && (
                      <div className="mt-1 text-sm text-gray-500">
                        Filtered by locations: {broadcast.userSelection.filterLocations.join(", ")}
                      </div>
                    )}
                  </div>
                ) : (
                  /* Legacy: show target roles */
                  <div className="flex flex-wrap gap-2">
                    {broadcast.targetRoles.map((role) => (
                      <span key={role} className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                        {ROLE_NAMES[role] || role}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Channels */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h2 className="font-semibold text-dark mb-4">Delivery Channels</h2>
            {isEditable ? (
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.channels.slack}
                    onChange={(e) => handleChannelChange("slack", e.target.checked)}
                    className="rounded text-accent focus:ring-accent"
                  />
                  <span className="px-2 py-1 text-xs bg-purple-100 text-purple-600 rounded">Slack</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.channels.email}
                    onChange={(e) => handleChannelChange("email", e.target.checked)}
                    className="rounded text-accent focus:ring-accent"
                  />
                  <span className="px-2 py-1 text-xs bg-blue-100 text-blue-600 rounded">Email</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.channels.sms}
                    onChange={(e) => handleChannelChange("sms", e.target.checked)}
                    className="rounded text-accent focus:ring-accent"
                  />
                  <span className="px-2 py-1 text-xs bg-green-100 text-green-600 rounded">SMS</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.channels.hostProducerChannel || false}
                    onChange={(e) => handleChannelChange("hostProducerChannel", e.target.checked)}
                    className="rounded text-accent focus:ring-accent"
                  />
                  <span className="px-2 py-1 text-xs bg-orange-100 text-orange-600 rounded">Host Producer</span>
                </label>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {broadcast.channels.slack && (
                  <span className="px-3 py-1 bg-purple-100 text-purple-600 rounded-full text-sm">Slack</span>
                )}
                {broadcast.channels.email && (
                  <span className="px-3 py-1 bg-blue-100 text-blue-600 rounded-full text-sm">Email</span>
                )}
                {broadcast.channels.sms && (
                  <span className="px-3 py-1 bg-green-100 text-green-600 rounded-full text-sm">SMS</span>
                )}
                {broadcast.channels.hostProducerChannel && (
                  <span className="px-3 py-1 bg-orange-100 text-orange-600 rounded-full text-sm">Host Producer</span>
                )}
              </div>
            )}
          </div>

          {/* Deliveries table for sent broadcasts */}
          {deliveries.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b bg-gray-50">
                <h2 className="font-semibold text-dark">Delivery Details</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-sm text-gray-500 border-b">
                      <th className="px-6 py-3 font-medium">Recipient</th>
                      <th className="px-6 py-3 font-medium">Slack</th>
                      <th className="px-6 py-3 font-medium">Email</th>
                      <th className="px-6 py-3 font-medium">SMS</th>
                      <th className="px-6 py-3 font-medium">Read</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deliveries.map((delivery) => (
                      <tr key={delivery.id} className="border-b last:border-b-0 hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div>
                            <div className="font-medium text-dark">{delivery.userName}</div>
                            <div className="text-sm text-gray-500">{delivery.userEmail}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={DELIVERY_STATUS_CONFIG[delivery.slack.status].color}>
                            {DELIVERY_STATUS_CONFIG[delivery.slack.status].label}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={DELIVERY_STATUS_CONFIG[delivery.email.status].color}>
                            {DELIVERY_STATUS_CONFIG[delivery.email.status].label}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={DELIVERY_STATUS_CONFIG[delivery.sms.status].color}>
                            {DELIVERY_STATUS_CONFIG[delivery.sms.status].label}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {delivery.readAt ? formatDate(delivery.readAt) : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Actions sidebar */}
        <div className="space-y-6">
          {isEditable ? (
            <div className="bg-white rounded-2xl shadow-sm p-6 space-y-3">
              <h2 className="font-semibold text-dark mb-4">Actions</h2>
              <button
                onClick={handleSave}
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
                Save Changes
              </button>
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
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm p-6 space-y-3">
              <h2 className="font-semibold text-dark mb-4">Actions</h2>
              <Link
                href={`/admin/broadcasts/new?duplicate=${id}`}
                className="w-full px-4 py-3 bg-accent text-white rounded-lg hover:bg-accent/90 flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Resend as New
              </Link>
            </div>
          )}

          {/* Info card */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h2 className="font-semibold text-dark mb-4">Information</h2>
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-gray-500">Status:</span>
                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.color}`}>
                  {statusConfig.label}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Created:</span>
                <span className="ml-2 text-gray-900">{formatDate(broadcast.createdAt)}</span>
              </div>
              {broadcast.senderName && (
                <div>
                  <span className="text-gray-500">Sent By:</span>
                  <span className="ml-2 text-gray-900">{broadcast.senderName}</span>
                </div>
              )}
              {broadcast.scheduledAt && (
                <div>
                  <span className="text-gray-500">Scheduled:</span>
                  <span className="ml-2 text-gray-900">{formatDate(broadcast.scheduledAt)}</span>
                </div>
              )}
              {broadcast.sentAt && (
                <div>
                  <span className="text-gray-500">Sent:</span>
                  <span className="ml-2 text-gray-900">{formatDate(broadcast.sentAt)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
