"use client";

import { useState, useEffect } from "react";
import { Host, SchedulingPriority } from "@/lib/types";

const PRIORITY_CONFIG: Record<SchedulingPriority, { label: string; color: string; bgColor: string }> = {
  high: { label: "High", color: "text-green-700", bgColor: "bg-green-100" },
  medium: { label: "Medium", color: "text-amber-700", bgColor: "bg-amber-100" },
  low: { label: "Low", color: "text-red-700", bgColor: "bg-red-100" },
};

export default function HostPriorityPage() {
  const [hosts, setHosts] = useState<Host[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [filter, setFilter] = useState<SchedulingPriority | "unset" | "all">("all");

  useEffect(() => {
    fetchHosts();
  }, []);

  const fetchHosts = async () => {
    try {
      const res = await fetch("/api/admin/host-priority");
      if (res.ok) {
        const data = await res.json();
        setHosts(data.hosts || []);
      }
    } catch (error) {
      console.error("Error fetching hosts:", error);
    } finally {
      setLoading(false);
    }
  };

  const updatePriority = async (hostId: string, priority: SchedulingPriority | null) => {
    setUpdating(hostId);
    try {
      const res = await fetch("/api/admin/host-priority", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostId, priority }),
      });

      if (res.ok) {
        // Update local state
        setHosts((prev) =>
          prev.map((h) =>
            h.id === hostId
              ? { ...h, schedulingPriority: priority || undefined }
              : h
          )
        );
      } else {
        const data = await res.json();
        alert(data.error || "Failed to update priority");
      }
    } catch (error) {
      console.error("Error updating priority:", error);
      alert("Failed to update priority");
    } finally {
      setUpdating(null);
    }
  };

  const filteredHosts = hosts.filter((host) => {
    if (filter === "all") return true;
    if (filter === "unset") return !host.schedulingPriority;
    return host.schedulingPriority === filter;
  });

  const counts = {
    all: hosts.length,
    high: hosts.filter((h) => h.schedulingPriority === "high").length,
    medium: hosts.filter((h) => h.schedulingPriority === "medium").length,
    low: hosts.filter((h) => h.schedulingPriority === "low").length,
    unset: hosts.filter((h) => !h.schedulingPriority).length,
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-primary">
          Host Scheduling Priority
        </h1>
        <p className="text-gray-600 mt-1 sm:mt-2 text-sm sm:text-base">
          Set priority levels for scheduling preferences
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {[
          { key: "all", label: "All" },
          { key: "high", label: "High", color: "text-green-700" },
          { key: "medium", label: "Medium", color: "text-amber-700" },
          { key: "low", label: "Low", color: "text-red-700" },
          { key: "unset", label: "Unset", color: "text-gray-500" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key as typeof filter)}
            className={`px-3 py-1.5 rounded-lg font-medium text-sm transition-colors flex items-center gap-2 ${
              filter === tab.key
                ? "bg-primary text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {tab.label}
            <span
              className={`px-1.5 py-0.5 rounded-full text-xs ${
                filter === tab.key ? "bg-white/20" : "bg-gray-200"
              }`}
            >
              {counts[tab.key as keyof typeof counts]}
            </span>
          </button>
        ))}
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-white rounded-xl p-4 animate-pulse">
              <div className="h-5 bg-gray-200 rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : filteredHosts.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center">
          <p className="text-gray-500">No hosts found</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {/* Desktop Table */}
          <div className="hidden sm:block">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Host
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Current Priority
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Set Priority
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredHosts.map((host) => (
                  <tr key={host.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-dark">
                        {host.lastName}, {host.firstName}
                      </div>
                      <div className="text-sm text-gray-500">{host.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      {host.schedulingPriority ? (
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            PRIORITY_CONFIG[host.schedulingPriority].bgColor
                          } ${PRIORITY_CONFIG[host.schedulingPriority].color}`}
                        >
                          {PRIORITY_CONFIG[host.schedulingPriority].label}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-sm">Not set</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 justify-end">
                        {(["high", "medium", "low"] as SchedulingPriority[]).map(
                          (priority) => (
                            <button
                              key={priority}
                              onClick={() => updatePriority(host.id, priority)}
                              disabled={
                                updating === host.id ||
                                host.schedulingPriority === priority
                              }
                              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 ${
                                host.schedulingPriority === priority
                                  ? `${PRIORITY_CONFIG[priority].bgColor} ${PRIORITY_CONFIG[priority].color}`
                                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                              }`}
                            >
                              {updating === host.id ? "..." : PRIORITY_CONFIG[priority].label}
                            </button>
                          )
                        )}
                        {host.schedulingPriority && (
                          <button
                            onClick={() => updatePriority(host.id, null)}
                            disabled={updating === host.id}
                            className="px-2 py-1.5 text-xs font-medium text-gray-400 hover:text-gray-600 disabled:opacity-50"
                            title="Clear priority"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="sm:hidden divide-y divide-gray-100">
            {filteredHosts.map((host) => (
              <div key={host.id} className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-medium text-dark">
                      {host.lastName}, {host.firstName}
                    </div>
                    <div className="text-sm text-gray-500">{host.email}</div>
                  </div>
                  {host.schedulingPriority && (
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        PRIORITY_CONFIG[host.schedulingPriority].bgColor
                      } ${PRIORITY_CONFIG[host.schedulingPriority].color}`}
                    >
                      {PRIORITY_CONFIG[host.schedulingPriority].label}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  {(["high", "medium", "low"] as SchedulingPriority[]).map(
                    (priority) => (
                      <button
                        key={priority}
                        onClick={() => updatePriority(host.id, priority)}
                        disabled={
                          updating === host.id ||
                          host.schedulingPriority === priority
                        }
                        className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 ${
                          host.schedulingPriority === priority
                            ? `${PRIORITY_CONFIG[priority].bgColor} ${PRIORITY_CONFIG[priority].color}`
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        {updating === host.id ? "..." : PRIORITY_CONFIG[priority].label}
                      </button>
                    )
                  )}
                  {host.schedulingPriority && (
                    <button
                      onClick={() => updatePriority(host.id, null)}
                      disabled={updating === host.id}
                      className="px-3 py-2 text-xs font-medium text-gray-400 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                      title="Clear"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
