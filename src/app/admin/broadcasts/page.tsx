"use client";

import { useState, useEffect, Component, ErrorInfo, ReactNode } from "react";
import Link from "next/link";
import { Broadcast, BROADCAST_STATUS_CONFIG, BroadcastStatus } from "@/lib/broadcast-types";
import { ROLE_NAMES } from "@/lib/roles";

// Error boundary to catch rendering errors
class ErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode; fallback?: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Broadcasts page error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
          <h2 className="text-lg font-semibold text-red-800 mb-2">Something went wrong</h2>
          <p className="text-red-600 mb-4">Error: {this.state.error?.message}</p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function AdminBroadcastsPage() {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetchBroadcasts();
  }, [statusFilter]);

  const fetchBroadcasts = async () => {
    try {
      const url = statusFilter
        ? `/api/admin/broadcasts?status=${statusFilter}`
        : "/api/admin/broadcasts";
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        // Ensure data is an array before setting
        if (Array.isArray(data)) {
          setBroadcasts(data);
        } else {
          console.error("Invalid API response - expected array:", data);
          setBroadcasts([]);
        }
      } else {
        console.error("API error:", res.status);
        setBroadcasts([]);
      }
    } catch (error) {
      console.error("Error fetching broadcasts:", error);
      setBroadcasts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (broadcastId: string) => {
    if (!confirm("Are you sure you want to delete this broadcast?")) {
      return;
    }

    setDeleting(broadcastId);
    try {
      const res = await fetch(`/api/admin/broadcasts/${broadcastId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setBroadcasts(broadcasts.filter((b) => b.id !== broadcastId));
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete broadcast");
      }
    } catch (error) {
      console.error("Error deleting broadcast:", error);
      alert("Failed to delete broadcast");
    } finally {
      setDeleting(null);
    }
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return "—";
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return "—";
    }
  };

  const getStatusCounts = () => {
    const counts = {
      total: broadcasts.length,
      draft: 0,
      scheduled: 0,
      sent: 0,
      failed: 0,
    };
    broadcasts.forEach((b) => {
      if (b.status in counts) {
        counts[b.status as keyof typeof counts]++;
      }
    });
    return counts;
  };

  const counts = getStatusCounts();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-primary">Broadcasts</h1>
          <p className="text-gray-600 mt-2">Send targeted messages to hosts via Slack, Email, and SMS.</p>
        </div>
        <Link
          href="/admin/broadcasts/new"
          className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Broadcast
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-8">
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="text-3xl font-bold text-primary">{counts.total}</div>
          <div className="text-gray-600 mt-1">Total Broadcasts</div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="text-3xl font-bold text-green-600">{counts.sent}</div>
          <div className="text-gray-600 mt-1">Sent</div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="text-3xl font-bold text-yellow-600">{counts.scheduled}</div>
          <div className="text-gray-600 mt-1">Scheduled</div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="text-3xl font-bold text-gray-600">{counts.draft}</div>
          <div className="text-gray-600 mt-1">Drafts</div>
        </div>
      </div>

      {/* Filter */}
      <div className="mb-6 flex items-center gap-4">
        <label className="text-sm font-medium text-gray-700">Filter by status:</label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm focus:ring-accent focus:border-accent"
        >
          <option value="">All</option>
          <option value="draft">Draft</option>
          <option value="scheduled">Scheduled</option>
          <option value="sending">Sending</option>
          <option value="sent">Sent</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {/* Broadcast List */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b bg-gray-50">
          <h2 className="font-semibold text-dark">All Broadcasts</h2>
        </div>

        {broadcasts.length === 0 ? (
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
                d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"
              />
            </svg>
            <h3 className="text-lg font-semibold text-dark mb-2">No broadcasts yet</h3>
            <p className="text-gray-500 mb-4">Create your first broadcast to get started.</p>
            <Link
              href="/admin/broadcasts/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Broadcast
            </Link>
          </div>
        ) : (
          <>
            {/* Mobile: Card View */}
            <div className="md:hidden divide-y divide-gray-100">
              {broadcasts.map((broadcast) => {
                const statusConfig = BROADCAST_STATUS_CONFIG[broadcast.status as BroadcastStatus];
                return (
                  <div key={broadcast.id} className="p-4">
                    {/* Header: Title + Status */}
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-dark">{broadcast.title}</h3>
                        <p className="text-sm text-gray-500 truncate">{broadcast.subject}</p>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${statusConfig?.color}`}>
                        {statusConfig?.label || broadcast.status}
                      </span>
                    </div>

                    {/* Meta Info */}
                    <div className="flex flex-wrap items-center gap-2 mb-3 text-sm">
                      {/* Channels */}
                      {broadcast.channels?.slack && (
                        <span className="px-2 py-0.5 bg-purple-100 text-purple-600 rounded text-xs">Slack</span>
                      )}
                      {broadcast.channels?.email && (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-600 rounded text-xs">Email</span>
                      )}
                      {broadcast.channels?.sms && (
                        <span className="px-2 py-0.5 bg-green-100 text-green-600 rounded text-xs">SMS</span>
                      )}
                      <span className="text-gray-400">•</span>
                      {/* Recipients */}
                      {broadcast.targetUserIds && broadcast.targetUserIds.length > 0 ? (
                        <span className="text-gray-600">
                          {broadcast.targetUserIds.length} user{broadcast.targetUserIds.length !== 1 ? 's' : ''}
                        </span>
                      ) : broadcast.targetRoles && broadcast.targetRoles.length > 0 ? (
                        <span className="text-gray-600">
                          {broadcast.targetRoles.length} role{broadcast.targetRoles.length !== 1 ? 's' : ''}
                        </span>
                      ) : (
                        <span className="text-gray-400">No recipients</span>
                      )}
                    </div>

                    {/* Date & Sender */}
                    <div className="flex items-center justify-between text-sm text-gray-500 mb-3">
                      <span>
                        {broadcast.sentAt
                          ? formatDate(broadcast.sentAt)
                          : broadcast.scheduledAt
                          ? `Scheduled: ${formatDate(broadcast.scheduledAt)}`
                          : formatDate(broadcast.createdAt)}
                      </span>
                      {broadcast.senderName && (
                        <span>by {broadcast.senderName}</span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Link
                        href={`/admin/broadcasts/${broadcast.id}`}
                        className="flex-1 px-3 py-2 text-sm font-medium text-center text-accent border border-accent rounded-lg"
                      >
                        {broadcast.status === "draft" ? "Edit" : "View"}
                      </Link>
                      {broadcast.status === "draft" && (
                        <button
                          onClick={() => handleDelete(broadcast.id)}
                          disabled={deleting === broadcast.id}
                          className="px-3 py-2 text-red-500 border border-red-200 rounded-lg disabled:opacity-50"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop: Table View */}
            <table className="hidden md:table w-full">
              <thead>
                <tr className="text-left text-sm text-gray-500 border-b">
                  <th className="px-6 py-3 font-medium">Title</th>
                  <th className="px-6 py-3 font-medium">Recipients</th>
                  <th className="px-6 py-3 font-medium">Channels</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Date</th>
                  <th className="px-6 py-3 font-medium">Sent By</th>
                  <th className="px-6 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {broadcasts.map((broadcast) => {
                  const statusConfig = BROADCAST_STATUS_CONFIG[broadcast.status as BroadcastStatus];
                  return (
                    <tr key={broadcast.id} className="border-b last:border-b-0 hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div>
                          <div className="font-medium text-dark">{broadcast.title}</div>
                          <div className="text-sm text-gray-500 truncate max-w-xs">
                            {broadcast.subject}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {broadcast.targetUserIds && broadcast.targetUserIds.length > 0 ? (
                            <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                              {broadcast.targetUserIds.length} user{broadcast.targetUserIds.length !== 1 ? 's' : ''}
                            </span>
                          ) : broadcast.targetRoles && broadcast.targetRoles.length > 0 ? (
                            <>
                              {broadcast.targetRoles.slice(0, 3).map((role) => (
                                <span
                                  key={role}
                                  className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded"
                                >
                                  {ROLE_NAMES[role] || role}
                                </span>
                              ))}
                              {broadcast.targetRoles.length > 3 && (
                                <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                                  +{broadcast.targetRoles.length - 3}
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {broadcast.channels?.slack && (
                            <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-600 rounded" title="Slack">
                              Slack
                            </span>
                          )}
                          {broadcast.channels?.email && (
                            <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-600 rounded" title="Email">
                              Email
                            </span>
                          )}
                          {broadcast.channels?.sms && (
                            <span className="text-xs px-2 py-0.5 bg-green-100 text-green-600 rounded" title="SMS">
                              SMS
                            </span>
                          )}
                          {!broadcast.channels && (
                            <span className="text-gray-400">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusConfig?.color}`}>
                          {statusConfig?.label || broadcast.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {broadcast.sentAt
                          ? formatDate(broadcast.sentAt)
                          : broadcast.scheduledAt
                          ? `Scheduled: ${formatDate(broadcast.scheduledAt)}`
                          : formatDate(broadcast.createdAt)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {broadcast.senderName || "—"}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/admin/broadcasts/${broadcast.id}`}
                            className="p-2 text-gray-400 hover:text-accent rounded-lg hover:bg-gray-100"
                            title={broadcast.status === "draft" ? "Edit" : "View"}
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              {broadcast.status === "draft" ? (
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                />
                              ) : (
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                />
                              )}
                            </svg>
                          </Link>
                          {broadcast.status === "draft" && (
                            <button
                              onClick={() => handleDelete(broadcast.id)}
                              disabled={deleting === broadcast.id}
                              className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-gray-100 disabled:opacity-50"
                              title="Delete"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}
      </div>

      {/* Templates link */}
      <div className="mt-8 text-center">
        <Link
          href="/admin/templates"
          className="text-accent hover:underline inline-flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          Manage Templates
        </Link>
      </div>
    </ErrorBoundary>
  );
}
