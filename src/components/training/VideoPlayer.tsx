"use client";

import { useState, useEffect, useRef } from "react";

interface VideoPlayerProps {
  videoUrl?: string;     // YouTube/Vimeo embed URL
  videoS3Key?: string;   // S3 key for uploaded videos
  title: string;
  onProgress?: (seconds: number) => void;
  onComplete?: () => void;
}

export default function VideoPlayer({
  videoUrl,
  videoS3Key,
  title,
  onProgress,
  onComplete,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [s3VideoUrl, setS3VideoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastReportedTime = useRef(0);

  // Fetch S3 presigned URL if needed
  useEffect(() => {
    if (videoS3Key) {
      setLoading(true);
      fetch(`/api/upload-url?key=${encodeURIComponent(videoS3Key)}&action=get`)
        .then((res) => res.json())
        .then((data) => {
          if (data.url) {
            setS3VideoUrl(data.url);
          } else {
            setError("Failed to load video");
          }
        })
        .catch(() => {
          setError("Failed to load video");
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [videoS3Key]);

  // Track video progress
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      const currentTime = Math.floor(video.currentTime);
      // Report progress every 5 seconds
      if (currentTime - lastReportedTime.current >= 5) {
        lastReportedTime.current = currentTime;
        onProgress?.(currentTime);
      }
    };

    const handleEnded = () => {
      onComplete?.();
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("ended", handleEnded);

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("ended", handleEnded);
    };
  }, [onProgress, onComplete]);

  // Determine video type and URL
  const isYouTube = videoUrl?.includes("youtube.com") || videoUrl?.includes("youtu.be");
  const isVimeo = videoUrl?.includes("vimeo.com");

  // Convert YouTube URL to embed format
  const getYouTubeEmbedUrl = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    const videoId = match && match[2].length === 11 ? match[2] : null;
    return videoId ? `https://www.youtube.com/embed/${videoId}?rel=0&enablejsapi=1` : null;
  };

  // Convert Vimeo URL to embed format
  const getVimeoEmbedUrl = (url: string) => {
    const regExp = /vimeo\.com\/(\d+)/;
    const match = url.match(regExp);
    const videoId = match ? match[1] : null;
    return videoId ? `https://player.vimeo.com/video/${videoId}` : null;
  };

  if (loading) {
    return (
      <div className="aspect-video bg-gray-100 rounded-xl flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="aspect-video bg-gray-100 rounded-xl flex items-center justify-center">
        <div className="text-center text-gray-500">
          <svg
            className="w-12 h-12 mx-auto mb-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  // S3 hosted video
  if (s3VideoUrl) {
    return (
      <div className="aspect-video bg-black rounded-xl overflow-hidden">
        <video
          ref={videoRef}
          className="w-full h-full"
          controls
          playsInline
          title={title}
        >
          <source src={s3VideoUrl} type="video/mp4" />
          Your browser does not support the video tag.
        </video>
      </div>
    );
  }

  // YouTube embed
  if (isYouTube && videoUrl) {
    const embedUrl = getYouTubeEmbedUrl(videoUrl);
    if (embedUrl) {
      return (
        <div className="aspect-video bg-black rounded-xl overflow-hidden">
          <iframe
            className="w-full h-full"
            src={embedUrl}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      );
    }
  }

  // Vimeo embed
  if (isVimeo && videoUrl) {
    const embedUrl = getVimeoEmbedUrl(videoUrl);
    if (embedUrl) {
      return (
        <div className="aspect-video bg-black rounded-xl overflow-hidden">
          <iframe
            className="w-full h-full"
            src={embedUrl}
            title={title}
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
          />
        </div>
      );
    }
  }

  // Direct video URL
  if (videoUrl) {
    return (
      <div className="aspect-video bg-black rounded-xl overflow-hidden">
        <video
          ref={videoRef}
          className="w-full h-full"
          controls
          playsInline
          title={title}
        >
          <source src={videoUrl} type="video/mp4" />
          Your browser does not support the video tag.
        </video>
      </div>
    );
  }

  // No video
  return (
    <div className="aspect-video bg-gray-100 rounded-xl flex items-center justify-center">
      <div className="text-center text-gray-500">
        <svg
          className="w-12 h-12 mx-auto mb-2"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        </svg>
        <p>No video available</p>
      </div>
    </div>
  );
}
