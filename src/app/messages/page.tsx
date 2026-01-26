"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { UserMessage } from "@/lib/broadcast-types";

export default function MessagesPage() {
  const [messages, setMessages] = useState<UserMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMessages();
  }, []);

  const fetchMessages = async () => {
    try {
      const res = await fetch("/api/messages");
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch (error) {
      console.error("Error fetching messages:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      });
    } else if (days === 1) {
      return "Yesterday";
    } else if (days < 7) {
      return date.toLocaleDateString("en-US", { weekday: "long" });
    } else {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
      });
    }
  };

  const unreadCount = messages.filter((m) => !m.isRead).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
      </div>
    );
  }

  return (
    <>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-primary">Messages</h1>
        <p className="text-gray-600 mt-2">
          {unreadCount > 0
            ? `You have ${unreadCount} unread message${unreadCount > 1 ? "s" : ""}`
            : "All messages read"}
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {messages.length === 0 ? (
          <div className="p-12 text-center">
            <svg
              className="w-16 h-16 mx-auto text-gray-300 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
            <h3 className="text-lg font-semibold text-dark mb-2">No messages yet</h3>
            <p className="text-gray-500">
              You&apos;ll see important announcements and updates here.
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {messages.map((message) => (
              <Link
                key={message.id}
                href={`/messages/${message.id}`}
                className={`block p-6 hover:bg-gray-50 transition-colors ${
                  !message.isRead ? "bg-accent/5" : ""
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 mt-1">
                    {!message.isRead ? (
                      <div className="w-3 h-3 bg-accent rounded-full"></div>
                    ) : (
                      <div className="w-3 h-3 bg-gray-200 rounded-full"></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-4">
                      <h3
                        className={`text-lg truncate ${
                          !message.isRead ? "font-semibold text-dark" : "font-medium text-gray-700"
                        }`}
                      >
                        {message.subject}
                      </h3>
                      <span className="text-sm text-gray-500 flex-shrink-0">
                        {formatDate(message.sentAt)}
                      </span>
                    </div>
                    <p className="text-gray-500 text-sm mt-1 line-clamp-2">
                      {message.bodyHtml.replace(/<[^>]+>/g, "").substring(0, 150)}...
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      {message.senderName && (
                        <span className="text-xs text-gray-500">
                          From: <span className="font-medium text-gray-700">{message.senderName}</span>
                        </span>
                      )}
                      {message.videoUrl && (
                        <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-600 rounded">
                          Video
                        </span>
                      )}
                      {message.linkUrl && (
                        <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-600 rounded">
                          Link
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    <svg
                      className="w-5 h-5 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
