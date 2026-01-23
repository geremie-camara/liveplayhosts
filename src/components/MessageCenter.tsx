"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { UserMessage } from "@/lib/broadcast-types";

export default function MessageCenter() {
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
        // Only show the 3 most recent
        setMessages(data.slice(0, 3));
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
      return "Today";
    } else if (days === 1) {
      return "Yesterday";
    } else if (days < 7) {
      return `${days} days ago`;
    } else {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    }
  };

  const unreadCount = messages.filter((m) => !m.isRead).length;

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <div className="animate-pulse">
          <div className="h-6 w-32 bg-gray-200 rounded mb-4"></div>
          <div className="space-y-3">
            <div className="h-16 bg-gray-100 rounded"></div>
            <div className="h-16 bg-gray-100 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-dark">Messages</h2>
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 bg-accent text-white text-xs font-medium rounded-full">
              {unreadCount} new
            </span>
          )}
        </div>
        <Link
          href="/messages"
          className="text-sm text-accent hover:underline"
        >
          View All
        </Link>
      </div>

      {messages.length === 0 ? (
        <div className="text-center py-6">
          <svg
            className="w-12 h-12 mx-auto text-gray-300 mb-3"
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
          <p className="text-gray-500 text-sm">No messages yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {messages.map((message) => (
            <Link
              key={message.id}
              href={`/messages/${message.id}`}
              className={`block p-3 rounded-lg transition-colors ${
                !message.isRead
                  ? "bg-accent/5 hover:bg-accent/10 border border-accent/20"
                  : "bg-gray-50 hover:bg-gray-100"
              }`}
            >
              <div className="flex items-start gap-3">
                {!message.isRead && (
                  <div className="w-2 h-2 bg-accent rounded-full mt-2 flex-shrink-0"></div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3
                      className={`text-sm truncate ${
                        !message.isRead ? "font-semibold text-dark" : "font-medium text-gray-700"
                      }`}
                    >
                      {message.subject}
                    </h3>
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {formatDate(message.sentAt)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-1">
                    {message.bodyHtml.replace(/<[^>]+>/g, "").substring(0, 80)}...
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
