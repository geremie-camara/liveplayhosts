"use client";

import { useEffect, useState } from "react";
import { AvailabilityChangeLog } from "@/lib/types";

export default function AvailabilityChangelogPage() {
  const [changes, setChanges] = useState<AvailabilityChangeLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextKey, setNextKey] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchChanges();
  }, []);

  async function fetchChanges(startKey?: string) {
    try {
      if (startKey) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      const params = new URLSearchParams();
      params.set("limit", "50");
      if (startKey) {
        params.set("startKey", startKey);
      }

      const response = await fetch(`/api/admin/availability-changelog?${params}`);
      if (!response.ok) {
        throw new Error("Failed to fetch changelog");
      }

      const data = await response.json();

      if (startKey) {
        setChanges((prev) => [...prev, ...data.changes]);
      } else {
        setChanges(data.changes);
      }
      setNextKey(data.nextKey);
    } catch (err) {
      console.error("Error fetching changelog:", err);
      setError("Failed to load changelog");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  function toggleExpand(id: string) {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedIds(newExpanded);
  }

  function formatDate(isoString: string): string {
    const date = new Date(isoString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function getChangeTypeLabel(changeType: string): string {
    switch (changeType) {
      case "weekly":
        return "Weekly Schedule";
      case "blocked_dates":
        return "Time Off";
      case "both":
        return "Schedule & Time Off";
      default:
        return changeType;
    }
  }

  function getChangeTypeColor(changeType: string): string {
    switch (changeType) {
      case "weekly":
        return "bg-blue-100 text-blue-800";
      case "blocked_dates":
        return "bg-orange-100 text-orange-800";
      case "both":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-primary mb-6">Availability Change Log</h1>
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="animate-pulse space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-20 bg-gray-100 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-primary mb-6">Availability Change Log</h1>
        <div className="bg-white rounded-2xl shadow-sm p-6 text-center">
          <p className="text-red-600">{error}</p>
          <button
            onClick={() => fetchChanges()}
            className="mt-4 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-primary">Availability Change Log</h1>
          <p className="text-gray-600 mt-1">Track when hosts update their availability</p>
        </div>
        <button
          onClick={() => fetchChanges()}
          className="px-4 py-2 text-sm font-medium text-accent bg-accent/10 rounded-lg hover:bg-accent/20"
        >
          Refresh
        </button>
      </div>

      {changes.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
          <svg className="w-12 h-12 mx-auto text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-gray-500">No availability changes recorded yet</p>
          <p className="text-sm text-gray-400 mt-1">Changes will appear here when hosts update their availability</p>
        </div>
      ) : (
        <div className="space-y-3">
          {changes.map((change) => (
            <div key={change.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
              {/* Header - always visible */}
              <button
                onClick={() => toggleExpand(change.id)}
                className="w-full p-4 text-left hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-dark">{change.hostName}</span>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getChangeTypeColor(change.changeType)}`}>
                        {getChangeTypeLabel(change.changeType)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">{change.hostEmail}</p>
                    {/* Summary preview */}
                    <div className="mt-2 text-sm text-gray-600">
                      {change.changes.weekly && <p className="truncate">{change.changes.weekly.summary}</p>}
                      {change.changes.blockedDates && <p className="truncate">{change.changes.blockedDates.summary}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-sm text-gray-500">{formatDate(change.createdAt)}</span>
                    <svg
                      className={`w-5 h-5 text-gray-400 transition-transform ${expandedIds.has(change.id) ? "rotate-180" : ""}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </button>

              {/* Expanded details */}
              {expandedIds.has(change.id) && (
                <div className="px-4 pb-4 border-t border-gray-100">
                  {/* Weekly changes */}
                  {change.changes.weekly && (
                    <div className="mt-4">
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">Weekly Schedule Changes</h4>
                      <div className="grid sm:grid-cols-2 gap-3">
                        {/* Before */}
                        <div className="bg-red-50 rounded-lg p-3">
                          <p className="text-xs font-medium text-red-700 mb-2">Before</p>
                          <div className="space-y-1 text-xs">
                            {(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const).map((day) => {
                              const d = change.changes.weekly!.before[day];
                              return (
                                <div key={day} className={`flex justify-between ${d.enabled ? "text-gray-700" : "text-gray-400"}`}>
                                  <span className="capitalize">{day}</span>
                                  <span>{d.enabled ? `${d.startTime}-${d.endTime}` : "Off"}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        {/* After */}
                        <div className="bg-green-50 rounded-lg p-3">
                          <p className="text-xs font-medium text-green-700 mb-2">After</p>
                          <div className="space-y-1 text-xs">
                            {(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const).map((day) => {
                              const d = change.changes.weekly!.after[day];
                              const beforeD = change.changes.weekly!.before[day];
                              const changed = d.enabled !== beforeD.enabled || d.startTime !== beforeD.startTime || d.endTime !== beforeD.endTime;
                              return (
                                <div
                                  key={day}
                                  className={`flex justify-between ${changed ? "font-semibold text-green-700" : d.enabled ? "text-gray-700" : "text-gray-400"}`}
                                >
                                  <span className="capitalize">{day}</span>
                                  <span>{d.enabled ? `${d.startTime}-${d.endTime}` : "Off"}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Blocked dates changes */}
                  {change.changes.blockedDates && (
                    <div className="mt-4">
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">Time Off Changes</h4>
                      <div className="space-y-2">
                        {change.changes.blockedDates.removed.length > 0 && (
                          <div className="bg-red-50 rounded-lg p-3">
                            <p className="text-xs font-medium text-red-700 mb-1">Removed</p>
                            {change.changes.blockedDates.removed.map((r) => (
                              <div key={r.id} className="text-sm text-red-800">
                                {r.startDate} to {r.endDate}
                                {r.reason && <span className="text-red-600"> ({r.reason})</span>}
                              </div>
                            ))}
                          </div>
                        )}
                        {change.changes.blockedDates.added.length > 0 && (
                          <div className="bg-green-50 rounded-lg p-3">
                            <p className="text-xs font-medium text-green-700 mb-1">Added</p>
                            {change.changes.blockedDates.added.map((a) => (
                              <div key={a.id} className="text-sm text-green-800">
                                {a.startDate} to {a.endDate}
                                {a.reason && <span className="text-green-600"> ({a.reason})</span>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Load more button */}
          {nextKey && (
            <div className="text-center pt-4">
              <button
                onClick={() => fetchChanges(nextKey)}
                disabled={loadingMore}
                className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
              >
                {loadingMore ? "Loading..." : "Load More"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
