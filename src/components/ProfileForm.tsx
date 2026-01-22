"use client";

import { useState, useEffect } from "react";
import { Host, UserRole } from "@/lib/types";
import { ROLE_NAMES, ROLE_COLORS } from "@/lib/roles";

export default function ProfileForm() {
  const [host, setHost] = useState<Host | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
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
    headshotExternalUrl: "",
  });

  useEffect(() => {
    fetchProfile();
  }, []);

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
      const urlResponse = await fetch(
        `/api/upload-url?filename=${encodeURIComponent(file.name)}&contentType=${encodeURIComponent(file.type)}`
      );
      if (!urlResponse.ok) {
        const err = await urlResponse.json();
        throw new Error(err.error || "Failed to get upload URL");
      }
      const { uploadUrl, fileUrl } = await urlResponse.json();

      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload file");
      }

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

  async function fetchProfile() {
    try {
      const response = await fetch("/api/profile");
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
          headshotExternalUrl: data.headshotExternalUrl || "",
        });
      } else {
        setError("Could not load your profile");
      }
    } catch (err) {
      setError("Failed to load profile");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/profile", {
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
          headshotExternalUrl: formData.headshotExternalUrl || undefined,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSuccess(data.message || "Profile saved successfully");
        setHost(data.host);
      } else {
        setError("Failed to save changes");
      }
    } catch (err) {
      setError("Failed to save changes");
    } finally {
      setSaving(false);
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
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (error && !host) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-red-600">{error}</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-primary">My Profile</h1>
        <p className="text-gray-600 mt-1">Update your personal information</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <p className="text-green-600">{success}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Role Display (read-only) */}
        {host && (
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-dark mb-4">Your Role</h2>
            <span className={`inline-flex px-3 py-1 text-sm font-medium rounded-full ${ROLE_COLORS[host.role as UserRole]}`}>
              {ROLE_NAMES[host.role as UserRole]}
            </span>
          </div>
        )}

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

        {/* Media (Headshot & Video) */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-dark mb-4">Media</h2>
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
                    View Full Image
                  </a>
                </div>
              ) : formData.headshotUrl ? (
                <div className="w-40 h-40 rounded-full bg-gray-200 flex items-center justify-center">
                  <span className="text-gray-400 text-sm">Loading...</span>
                </div>
              ) : formData.headshotExternalUrl ? (
                <div className="space-y-3">
                  <img
                    src={formData.headshotExternalUrl}
                    alt={`${formData.firstName} ${formData.lastName}`}
                    className="w-40 h-40 rounded-full object-cover border-4 border-gray-100"
                  />
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
                    Open in New Tab
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
          <h2 className="text-lg font-semibold text-dark mb-4">Experience</h2>
          <textarea
            name="experience"
            value={formData.experience}
            onChange={handleChange}
            rows={4}
            placeholder="Tell us about your hosting experience..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent resize-none"
          />
        </div>

        {/* Submit */}
        <div className="flex justify-end">
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
  );
}
