"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { UserMessage } from "@/lib/broadcast-types";

export default function MessageDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const [message, setMessage] = useState<UserMessage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMessage();
  }, [id]);

  const fetchMessage = async () => {
    try {
      // Fetch all messages and find the one we want
      const res = await fetch("/api/messages");
      if (res.ok) {
        const messages: UserMessage[] = await res.json();
        const found = messages.find((m) => m.id === id);

        if (found) {
          setMessage(found);

          // Mark as read if not already
          if (!found.isRead) {
            await fetch(`/api/messages/${id}/read`, { method: "POST" });
          }
        } else {
          router.push("/messages");
        }
      }
    } catch (error) {
      console.error("Error fetching message:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
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

  if (!message) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Message not found</p>
        <Link href="/messages" className="text-accent hover:underline mt-4 inline-block">
          Back to Messages
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="mb-8">
        <Link
          href="/messages"
          className="text-gray-500 hover:text-gray-700 inline-flex items-center gap-1 mb-4"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Messages
        </Link>
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b">
          <h1 className="text-2xl font-bold text-primary">{message.subject}</h1>
          <p className="text-gray-500 mt-2">{formatDate(message.sentAt)}</p>
        </div>

        {/* Body */}
        <div className="p-6">
          {/* Video */}
          {message.videoUrl && (
            <div className="mb-6">
              <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
                {message.videoUrl.includes("youtube") || message.videoUrl.includes("youtu.be") ? (
                  <iframe
                    src={message.videoUrl.replace("watch?v=", "embed/")}
                    className="w-full h-full"
                    allowFullScreen
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  />
                ) : message.videoUrl.includes("vimeo") ? (
                  <iframe
                    src={message.videoUrl.replace("vimeo.com", "player.vimeo.com/video")}
                    className="w-full h-full"
                    allowFullScreen
                  />
                ) : (
                  <video
                    src={message.videoUrl}
                    controls
                    className="w-full h-full object-contain"
                  />
                )}
              </div>
            </div>
          )}

          {/* Content */}
          <div
            className="prose prose-lg max-w-none"
            dangerouslySetInnerHTML={{ __html: message.bodyHtml }}
          />

          {/* CTA Button */}
          {message.linkUrl && (
            <div className="mt-8">
              <a
                href={message.linkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors"
              >
                {message.linkText || "Learn More"}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </a>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
