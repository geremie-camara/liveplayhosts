"use client";

import { useState, useEffect } from "react";

interface VideoItem {
  key: string;
  url: string;
  name: string;
  size: number;
  lastModified: string;
}

interface VideoUploadProps {
  value?: string;
  onChange: (videoUrl: string | undefined) => void;
  folder?: string;
  placeholder?: string;
}

export default function VideoUpload({
  value,
  onChange,
  folder = "broadcast-videos",
  placeholder = "Upload a video to include with your broadcast",
}: VideoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showLibrary, setShowLibrary] = useState(false);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loadingLibrary, setLoadingLibrary] = useState(false);

  const fetchVideos = async () => {
    setLoadingLibrary(true);
    try {
      const res = await fetch(`/api/admin/videos?folder=${folder}`);
      if (res.ok) {
        const data = await res.json();
        setVideos(data.videos || []);
      }
    } catch (err) {
      console.error("Error fetching videos:", err);
    } finally {
      setLoadingLibrary(false);
    }
  };

  useEffect(() => {
    if (showLibrary && videos.length === 0) {
      fetchVideos();
    }
  }, [showLibrary]);

  const handleVideoUpload = async (file: File) => {
    setUploading(true);
    setUploadProgress(0);
    setError(null);

    // Validate file size (max 500MB)
    const maxSize = 500 * 1024 * 1024;
    if (file.size > maxSize) {
      setError("File size must be less than 500MB");
      setUploading(false);
      return;
    }

    try {
      // Get presigned URL
      const urlRes = await fetch(
        `/api/upload-url?filename=${encodeURIComponent(file.name)}&contentType=${encodeURIComponent(file.type)}&folder=${folder}`
      );
      if (!urlRes.ok) {
        const data = await urlRes.json();
        throw new Error(data.error || "Failed to get upload URL");
      }
      const { uploadUrl, fileUrl } = await urlRes.json();

      // Upload to S3 with progress tracking
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

      // Update with the public S3 URL
      onChange(fileUrl);

      // Refresh the video library
      if (videos.length > 0) {
        fetchVideos();
      }
    } catch (err) {
      console.error("Error uploading video:", err);
      setError(err instanceof Error ? err.message : "Failed to upload video");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleRemove = () => {
    onChange(undefined);
    setError(null);
  };

  const handleSelectFromLibrary = (url: string) => {
    onChange(url);
    setShowLibrary(false);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div>
      {value ? (
        <div className="space-y-3">
          {/* Video preview */}
          <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
            <video
              src={value}
              controls
              className="w-full h-full object-contain"
            >
              Your browser does not support the video tag.
            </video>
          </div>

          {/* Video URL and remove button */}
          <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
            <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-green-700 text-sm flex-1 truncate" title={value}>
              Video attached
            </span>
            <button
              type="button"
              onClick={handleRemove}
              className="text-red-500 text-sm hover:underline flex-shrink-0"
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Upload area */}
          <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center">
            {uploading ? (
              <div className="space-y-2">
                <div className="w-full bg-gray-200 rounded-full h-2">
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
                  accept="video/mp4,video/quicktime,video/webm,video/x-msvideo"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleVideoUpload(file);
                  }}
                  className="hidden"
                  id="broadcast-video-upload"
                />
                <label
                  htmlFor="broadcast-video-upload"
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
                      d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                  <span className="text-accent font-medium">Click to upload new video</span>
                  <span className="text-xs text-gray-500 mt-1">
                    {placeholder}
                  </span>
                  <span className="text-xs text-gray-400 mt-1">
                    MP4, MOV, WebM, AVI (max 500MB)
                  </span>
                </label>
              </>
            )}

            {error && (
              <div className="mt-3 p-2 bg-red-50 text-red-600 text-sm rounded">
                {error}
              </div>
            )}
          </div>

          {/* Library toggle */}
          <div className="text-center">
            <button
              type="button"
              onClick={() => setShowLibrary(!showLibrary)}
              className="text-sm text-accent hover:underline inline-flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
              {showLibrary ? "Hide" : "Select from"} video library
            </button>
          </div>

          {/* Video library */}
          {showLibrary && (
            <div className="border rounded-lg p-4 bg-gray-50">
              <h4 className="font-medium text-sm text-gray-700 mb-3">Previously Uploaded Videos</h4>

              {loadingLibrary ? (
                <div className="flex justify-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent"></div>
                </div>
              ) : videos.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  No videos uploaded yet. Upload a video above to add it to your library.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-3 max-h-64 overflow-y-auto">
                  {videos.map((video) => (
                    <button
                      key={video.key}
                      type="button"
                      onClick={() => handleSelectFromLibrary(video.url)}
                      className="text-left border rounded-lg p-2 bg-white hover:border-accent hover:bg-accent/5 transition-colors"
                    >
                      <div className="aspect-video bg-gray-200 rounded mb-2 overflow-hidden">
                        <video
                          src={video.url}
                          className="w-full h-full object-cover"
                          preload="metadata"
                        />
                      </div>
                      <p className="text-xs font-medium text-gray-700 truncate" title={video.name}>
                        {video.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatFileSize(video.size)} • {formatDate(video.lastModified)}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
