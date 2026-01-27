"use client";

import { useState, useEffect } from "react";
import { CallOut, CallOutStatus } from "@/lib/schedule-types";

interface CallOutWithUser extends CallOut {
  userName?: string;
  userEmail?: string;
}

type Tab = "pending" | "approved" | "denied" | "all";

const STATUS_CONFIG: Record<CallOutStatus, { label: string; color: string; bgColor: string }> = {
  pending: { label: "Pending", color: "text-amber-700", bgColor: "bg-amber-100" },
  approved: { label: "Approved", color: "text-green-700", bgColor: "bg-green-100" },
  denied: { label: "Denied", color: "text-red-700", bgColor: "bg-red-100" },
};

export default function AdminCalloutsPage() {
  const [callouts, setCallouts] = useState<CallOutWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("pending");
  const [updating, setUpdating] = useState<string | null>(null);
  const [counts, setCounts] = useState({ pending: 0, approved: 0, denied: 0, all: 0 });

  useEffect(() => {
    fetchCallouts();
  }, [activeTab]);

  const fetchCallouts = async () => {
    setLoading(true);
    try {
      const url = activeTab === "all"
        ? "/api/admin/callouts"
        : `/api/admin/callouts?status=${activeTab}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setCallouts(data.callouts || []);
      }

      // Fetch counts for all statuses
      const [pendingRes, approvedRes, deniedRes, allRes] = await Promise.all([
        fetch("/api/admin/callouts?status=pending"),
        fetch("/api/admin/callouts?status=approved"),
        fetch("/api/admin/callouts?status=denied"),
        fetch("/api/admin/callouts"),
      ]);

      const [pendingData, approvedData, deniedData, allData] = await Promise.all([
        pendingRes.json(),
        approvedRes.json(),
        deniedRes.json(),
        allRes.json(),
      ]);

      setCounts({
        pending: pendingData.callouts?.length || 0,
        approved: approvedData.callouts?.length || 0,
        denied: deniedData.callouts?.length || 0,
        all: allData.callouts?.length || 0,
      });
    } catch (error) {
      console.error("Error fetching call outs:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: string, status: CallOutStatus) => {
    setUpdating(id);
    try {
      const res = await fetch(`/api/admin/callouts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (res.ok) {
        // Refresh the list
        fetchCallouts();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to update call out");
      }
    } catch (error) {
      console.error("Error updating call out:", error);
      alert("Failed to update call out");
    } finally {
      setUpdating(null);
    }
  };

  // Helper to determine urgency based on time until shift
  const getUrgency = (startingOn: string) => {
    const now = new Date();
    const shiftDate = new Date(startingOn);
    const hoursUntil = (shiftDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    const twoWeeksInHours = 14 * 24;

    if (hoursUntil < 0) {
      return { label: "Past", color: "text-gray-500", bgColor: "bg-gray-100" };
    } else if (hoursUntil < 48) {
      return { label: "Emergency", color: "text-red-700", bgColor: "bg-red-100" };
    } else if (hoursUntil < twoWeeksInHours) {
      return { label: "< 2 Weeks", color: "text-amber-700", bgColor: "bg-amber-100" };
    } else {
      return { label: "> 2 Weeks", color: "text-green-700", bgColor: "bg-green-100" };
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "pending", label: "Pending", count: counts.pending },
    { key: "approved", label: "Approved", count: counts.approved },
    { key: "denied", label: "Denied", count: counts.denied },
    { key: "all", label: "All", count: counts.all },
  ];

  return (
    <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-primary">
            Call Out Requests
          </h1>
          <p className="text-gray-600 mt-1 sm:mt-2 text-sm sm:text-base">
            Review and manage host call out requests
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-colors flex items-center gap-2 ${
                activeTab === tab.key
                  ? "bg-primary text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {tab.label}
              <span
                className={`px-2 py-0.5 rounded-full text-xs ${
                  activeTab === tab.key
                    ? "bg-white/20"
                    : tab.key === "pending" && tab.count > 0
                    ? "bg-red-500 text-white"
                    : "bg-gray-200"
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Loading state */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-xl p-4 animate-pulse">
                <div className="h-5 bg-gray-200 rounded w-1/4 mb-3" />
                <div className="h-4 bg-gray-100 rounded w-1/2 mb-2" />
                <div className="h-4 bg-gray-100 rounded w-1/3" />
              </div>
            ))}
          </div>
        ) : callouts.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center">
            <svg
              className="w-12 h-12 mx-auto mb-4 text-gray-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            <p className="text-gray-500 text-lg">No {activeTab === "all" ? "" : activeTab} call outs</p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block bg-white rounded-xl shadow-sm overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Host
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Shift
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Urgency
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Submitted
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {callouts.map((callout) => {
                    const urgency = getUrgency(callout.shiftDate);
                    const statusConfig = STATUS_CONFIG[callout.status];

                    return (
                      <tr key={callout.id} className="hover:bg-gray-50">
                        <td className="px-4 py-4">
                          <div className="font-medium text-dark">{callout.userName}</div>
                          <div className="text-sm text-gray-500">{callout.userEmail}</div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="font-medium text-dark">{callout.studioName}</div>
                          <div className="text-sm text-gray-500">
                            {formatDate(callout.shiftDate)} • {callout.shiftTime}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${urgency.bgColor} ${urgency.color}`}>
                            {urgency.label}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-500">
                          {formatDateTime(callout.createdAt)}
                        </td>
                        <td className="px-4 py-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusConfig.bgColor} ${statusConfig.color}`}>
                            {statusConfig.label}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right">
                          {callout.status === "pending" ? (
                            <div className="flex gap-2 justify-end">
                              <button
                                onClick={() => updateStatus(callout.id, "approved")}
                                disabled={updating === callout.id}
                                className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
                              >
                                {updating === callout.id ? "..." : "Approve"}
                              </button>
                              <button
                                onClick={() => updateStatus(callout.id, "denied")}
                                disabled={updating === callout.id}
                                className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
                              >
                                {updating === callout.id ? "..." : "Deny"}
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => updateStatus(callout.id, "pending")}
                              disabled={updating === callout.id}
                              className="px-3 py-1.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                            >
                              {updating === callout.id ? "..." : "Reset"}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-4">
              {callouts.map((callout) => {
                const urgency = getUrgency(callout.shiftDate);
                const statusConfig = STATUS_CONFIG[callout.status];

                return (
                  <div key={callout.id} className="bg-white rounded-xl p-4 shadow-sm">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="font-medium text-dark">{callout.userName}</div>
                        <div className="text-sm text-gray-500">{callout.userEmail}</div>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusConfig.bgColor} ${statusConfig.color}`}>
                        {statusConfig.label}
                      </span>
                    </div>

                    {/* Shift Details */}
                    <div className="bg-gray-50 rounded-lg p-3 mb-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-dark">{callout.studioName}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${urgency.bgColor} ${urgency.color}`}>
                          {urgency.label}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600">
                        {formatDate(callout.shiftDate)} • {callout.shiftTime}
                      </div>
                    </div>

                    {/* Submitted */}
                    <div className="text-xs text-gray-500 mb-3">
                      Submitted {formatDateTime(callout.createdAt)}
                    </div>

                    {/* Actions */}
                    {callout.status === "pending" ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => updateStatus(callout.id, "approved")}
                          disabled={updating === callout.id}
                          className="flex-1 px-3 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
                        >
                          {updating === callout.id ? "..." : "Approve"}
                        </button>
                        <button
                          onClick={() => updateStatus(callout.id, "denied")}
                          disabled={updating === callout.id}
                          className="flex-1 px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
                        >
                          {updating === callout.id ? "..." : "Deny"}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => updateStatus(callout.id, "pending")}
                        disabled={updating === callout.id}
                        className="w-full px-3 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                      >
                        {updating === callout.id ? "..." : "Reset to Pending"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
    </div>
  );
}
