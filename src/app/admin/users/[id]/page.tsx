"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Host, UserRole } from "@/lib/types";
import { ROLE_NAMES, ROLE_COLORS } from "@/lib/roles";

export default function EditUserPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [host, setHost] = useState<Host | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [uploadingHeadshot, setUploadingHeadshot] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [signedHeadshotUrl, setSignedHeadshotUrl] = useState<string | null>(null);
  const [signedVideoUrl, setSignedVideoUrl] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    location: "",
    street: "",
    city: "",
    state: "",
    zip: "",
    instagram: "",
    tiktok: "",
    youtube: "",
    linkedin: "",
    otherSocial: "",
    experience: "",
    videoReelUrl: "",
    headshotUrl: "",
    role: "applicant" as UserRole,
    notes: "",
    slackId: "",
    slackChannelId: "",
  });

  useEffect(() => {
    fetchHost();
  }, [id]);

  // Get signed URLs when headshot/video URLs change
  useEffect(() => {
    if (formData.headshotUrl) {
      getSignedUrl(formData.headshotUrl).then(setSignedHeadshotUrl);
    } else {
      setSignedHeadshotUrl(null);
    }
  }, [formData.headshotUrl]);

  useEffect(() => {
    if (formData.videoReelUrl) {
      getSignedUrl(formData.videoReelUrl).then(setSignedVideoUrl);
    } else {
      setSignedVideoUrl(null);
    }
  }, [formData.videoReelUrl]);

  async function getSignedUrl(url: string): Promise<string | null> {
    try {
      const response = await fetch(`/api/upload-url?viewUrl=${encodeURIComponent(url)}`);
      if (response.ok) {
        const data = await response.json();
        return data.signedUrl;
      }
    } catch (err) {
      console.error("Failed to get signed URL:", err);
    }
    return null;
  }

  async function handleFileUpload(file: File, type: "headshot" | "video") {
    const isVideo = type === "video";
    if (isVideo) setUploadingVideo(true);
    else setUploadingHeadshot(true);

    try {
      // Get pre-signed upload URL
      const urlResponse = await fetch(
        `/api/upload-url?filename=${encodeURIComponent(file.name)}&contentType=${encodeURIComponent(file.type)}`
      );
      if (!urlResponse.ok) {
        const err = await urlResponse.json();
        throw new Error(err.error || "Failed to get upload URL");
      }
      const { uploadUrl, fileUrl } = await urlResponse.json();

      // Upload file to S3
      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload file");
      }

      // Update form data
      if (isVideo) {
        setFormData(prev => ({ ...prev, videoReelUrl: fileUrl }));
      } else {
        setFormData(prev => ({ ...prev, headshotUrl: fileUrl }));
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Upload failed");
    } finally {
      if (isVideo) setUploadingVideo(false);
      else setUploadingHeadshot(false);
    }
  }

  async function fetchHost() {
    try {
      const response = await fetch(`/api/hosts/${id}`);
      if (response.ok) {
        const data = await response.json();
        setHost(data);
        setFormData({
          firstName: data.firstName || "",
          lastName: data.lastName || "",
          email: data.email || "",
          phone: data.phone || "",
          location: data.location || "",
          street: data.address?.street || "",
          city: data.address?.city || "",
          state: data.address?.state || "",
          zip: data.address?.zip || "",
          instagram: data.socialProfiles?.instagram || "",
          tiktok: data.socialProfiles?.tiktok || "",
          youtube: data.socialProfiles?.youtube || "",
          linkedin: data.socialProfiles?.linkedin || "",
          otherSocial: data.socialProfiles?.other || "",
          experience: data.experience || "",
          videoReelUrl: data.videoReelUrl || "",
          headshotUrl: data.headshotUrl || "",
          role: data.role || "applicant",
          notes: data.notes || "",
          slackId: data.slackId || "",
          slackChannelId: data.slackChannelId || "",
        });
      } else {
        setError("Host not found");
      }
    } catch (err) {
      setError("Failed to load host");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const response = await fetch(`/api/hosts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phone: formData.phone,
          location: formData.location || undefined,
          address: {
            street: formData.street,
            city: formData.city,
            state: formData.state,
            zip: formData.zip,
          },
          socialProfiles: {
            instagram: formData.instagram || undefined,
            tiktok: formData.tiktok || undefined,
            youtube: formData.youtube || undefined,
            linkedin: formData.linkedin || undefined,
            other: formData.otherSocial || undefined,
          },
          experience: formData.experience,
          videoReelUrl: formData.videoReelUrl || undefined,
          headshotUrl: formData.headshotUrl || undefined,
          role: formData.role,
          notes: formData.notes || undefined,
          slackId: formData.slackId || undefined,
          slackChannelId: formData.slackChannelId || undefined,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.message) {
          alert(data.message);
        }
        router.push("/admin/users");
      } else {
        setError("Failed to save changes");
      }
    } catch (err) {
      setError("Failed to save changes");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this user? This cannot be undone.")) {
      return;
    }

    try {
      const response = await fetch(`/api/hosts/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        router.push("/admin/users");
      } else {
        setError("Failed to delete user");
      }
    } catch (err) {
      setError("Failed to delete user");
    }
  }

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (error && !host) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 mb-4">{error}</div>
          <Link href="/admin/users" className="text-accent hover:underline">
            Back to Users
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <Link
              href="/admin/users"
              className="text-accent hover:underline text-sm mb-2 inline-block"
            >
              ← Back to Users
            </Link>
            <h1 className="text-3xl font-bold text-primary">
              Edit User: {host?.firstName} {host?.lastName}
            </h1>
          </div>
          <button
            onClick={handleDelete}
            className="px-4 py-2 text-sm font-medium text-red-600 border border-red-600 rounded-lg hover:bg-red-50 transition-colors"
          >
            Delete User
          </button>
        </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      <div className="max-w-4xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Role */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-dark mb-4">Role</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                User Role
              </label>
              <select
                name="role"
                value={formData.role}
                onChange={handleChange}
                className="w-full max-w-xs px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              >
                {Object.entries(ROLE_NAMES).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Personal Information */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-dark mb-4">
              Personal Information
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  First Name
                </label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Last Name
                </label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Location
                </label>
                <input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  placeholder="e.g., Los Angeles, CA"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Address */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-dark mb-4">Address</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Street
                </label>
                <input
                  type="text"
                  name="street"
                  value={formData.street}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                />
              </div>
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    City
                  </label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    State
                  </label>
                  <input
                    type="text"
                    name="state"
                    value={formData.state}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ZIP
                  </label>
                  <input
                    type="text"
                    name="zip"
                    value={formData.zip}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Social Profiles */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-dark mb-4">Social Profiles</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Instagram
                </label>
                <input
                  type="text"
                  name="instagram"
                  value={formData.instagram}
                  onChange={handleChange}
                  placeholder="@username"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  TikTok
                </label>
                <input
                  type="text"
                  name="tiktok"
                  value={formData.tiktok}
                  onChange={handleChange}
                  placeholder="@username"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  YouTube
                </label>
                <input
                  type="text"
                  name="youtube"
                  value={formData.youtube}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  LinkedIn
                </label>
                <input
                  type="text"
                  name="linkedin"
                  value={formData.linkedin}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Other Social
                </label>
                <input
                  type="text"
                  name="otherSocial"
                  value={formData.otherSocial}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Slack Integration */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-dark mb-4">Slack Integration</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Slack ID
                </label>
                <input
                  type="text"
                  name="slackId"
                  value={formData.slackId}
                  onChange={handleChange}
                  placeholder="e.g., U095KESC6GL"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Slack Channel ID
                </label>
                <input
                  type="text"
                  name="slackChannelId"
                  value={formData.slackChannelId}
                  onChange={handleChange}
                  placeholder="e.g., C095P0T2XU6"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Media (Headshot & Video) */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-dark mb-4">
              Media
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              {/* Headshot */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Headshot
                </label>
                {formData.headshotUrl && signedHeadshotUrl ? (
                  <div className="space-y-3">
                    <img
                      src={signedHeadshotUrl}
                      alt={`${formData.firstName} ${formData.lastName}`}
                      className="w-40 h-40 rounded-full object-cover border-4 border-gray-100"
                    />
                    <a
                      href={signedHeadshotUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent text-sm hover:underline inline-block"
                    >
                      View Full Image →
                    </a>
                  </div>
                ) : formData.headshotUrl ? (
                  <div className="w-40 h-40 rounded-full bg-gray-200 flex items-center justify-center">
                    <span className="text-gray-400 text-sm">Loading...</span>
                  </div>
                ) : (
                  <div className="w-40 h-40 rounded-full bg-gray-200 flex items-center justify-center">
                    <span className="text-gray-400 text-sm">No headshot</span>
                  </div>
                )}
                <div className="mt-3">
                  <label className="cursor-pointer">
                    <span className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      uploadingHeadshot
                        ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}>
                      {uploadingHeadshot ? (
                        <>Uploading...</>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {formData.headshotUrl ? "Replace" : "Upload"} Headshot
                        </>
                      )}
                    </span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="hidden"
                      disabled={uploadingHeadshot}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file, "headshot");
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
              </div>

              {/* Video */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Video Reel
                </label>
                {formData.videoReelUrl && signedVideoUrl ? (
                  <div className="space-y-3">
                    <video
                      src={signedVideoUrl}
                      controls
                      className="w-full max-w-sm rounded-lg"
                    />
                    <a
                      href={signedVideoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent text-sm hover:underline inline-block"
                    >
                      Open in New Tab →
                    </a>
                  </div>
                ) : formData.videoReelUrl ? (
                  <div className="w-full max-w-sm h-40 bg-gray-200 rounded-lg flex items-center justify-center">
                    <span className="text-gray-400 text-sm">Loading...</span>
                  </div>
                ) : (
                  <div className="w-full max-w-sm h-40 bg-gray-200 rounded-lg flex items-center justify-center">
                    <span className="text-gray-400 text-sm">No video</span>
                  </div>
                )}
                <div className="mt-3">
                  <label className="cursor-pointer">
                    <span className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      uploadingVideo
                        ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}>
                      {uploadingVideo ? (
                        <>Uploading...</>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          {formData.videoReelUrl ? "Replace" : "Upload"} Video
                        </>
                      )}
                    </span>
                    <input
                      type="file"
                      accept="video/mp4,video/quicktime,video/webm,video/x-msvideo"
                      className="hidden"
                      disabled={uploadingVideo}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file, "video");
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Experience */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-dark mb-4">
              Experience
            </h2>
            <div>
              <textarea
                name="experience"
                value={formData.experience}
                onChange={handleChange}
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent resize-none"
              />
            </div>
          </div>

          {/* Admin Notes */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-dark mb-4">Admin Notes</h2>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={3}
              placeholder="Internal notes about this user..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent resize-none"
            />
          </div>

          {/* Timestamps */}
          {host && (
            <div className="bg-gray-100 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-dark mb-4">History</h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Applied:</span>
                  <div className="font-medium">
                    {new Date(host.appliedAt).toLocaleDateString()}
                  </div>
                </div>
                {host.invitedAt && (
                  <div>
                    <span className="text-gray-500">Invited:</span>
                    <div className="font-medium">
                      {new Date(host.invitedAt).toLocaleDateString()}
                    </div>
                  </div>
                )}
                {host.hiredAt && (
                  <div>
                    <span className="text-gray-500">Hired:</span>
                    <div className="font-medium">
                      {new Date(host.hiredAt).toLocaleDateString()}
                    </div>
                  </div>
                )}
                <div>
                  <span className="text-gray-500">Last Updated:</span>
                  <div className="font-medium">
                    {new Date(host.updatedAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Submit */}
          <div className="flex justify-end gap-4">
            <Link
              href="/admin/users"
              className="px-6 py-3 text-gray-600 font-medium hover:text-gray-800 transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 bg-accent text-white font-semibold rounded-lg hover:bg-accent-600 transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
