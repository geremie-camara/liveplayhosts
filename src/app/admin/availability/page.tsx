"use client";

import { useState, useEffect } from "react";
import { Host, UserAvailability, WeeklyAvailability, DayAvailability, BlockedDateRange } from "@/lib/types";
import { randomUUID } from "crypto";

interface HostWithAvailability extends Host {
  availability?: UserAvailability & { notes?: string };
}

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const defaultDay: DayAvailability = { enabled: false, startTime: "17:00", endTime: "21:00" };

const defaultWeekly: WeeklyAvailability = {
  monday: { ...defaultDay },
  tuesday: { ...defaultDay },
  wednesday: { ...defaultDay },
  thursday: { ...defaultDay },
  friday: { ...defaultDay },
  saturday: { ...defaultDay },
  sunday: { ...defaultDay },
};

export default function AdminAvailabilityPage() {
  const [hosts, setHosts] = useState<HostWithAvailability[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingHost, setEditingHost] = useState<HostWithAvailability | null>(null);
  const [editWeekly, setEditWeekly] = useState<WeeklyAvailability>(defaultWeekly);
  const [editBlocked, setEditBlocked] = useState<BlockedDateRange[]>([]);
  const [editNotes, setEditNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<"all" | "set" | "unset">("all");

  useEffect(() => {
    fetchHosts();
  }, []);

  const fetchHosts = async () => {
    try {
      const res = await fetch("/api/admin/availability");
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

  const openEditor = (host: HostWithAvailability) => {
    setEditingHost(host);
    setEditWeekly(host.availability?.weekly || { ...defaultWeekly });
    setEditBlocked(host.availability?.blockedDates || []);
    setEditNotes((host.availability as { notes?: string } | undefined)?.notes || "");
  };

  const closeEditor = () => {
    setEditingHost(null);
    setEditWeekly(defaultWeekly);
    setEditBlocked([]);
    setEditNotes("");
  };

  const saveAvailability = async () => {
    if (!editingHost) return;
    if (!editingHost.clerkUserId) {
      alert("Cannot save: This host has not signed in yet (no Clerk user ID)");
      return;
    }
    setSaving(true);

    try {
      const res = await fetch(`/api/admin/availability/${editingHost.clerkUserId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekly: editWeekly,
          blockedDates: editBlocked,
          notes: editNotes,
        }),
      });

      if (res.ok) {
        // Update local state
        setHosts((prev) =>
          prev.map((h) =>
            h.id === editingHost.id
              ? {
                  ...h,
                  availability: {
                    userId: h.clerkUserId || h.id,
                    weekly: editWeekly,
                    blockedDates: editBlocked,
                    updatedAt: new Date().toISOString(),
                    notes: editNotes,
                  },
                }
              : h
          )
        );
        closeEditor();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to save");
      }
    } catch (error) {
      console.error("Error saving:", error);
      alert("Failed to save availability");
    } finally {
      setSaving(false);
    }
  };

  const updateDayEnabled = (day: typeof DAYS[number], enabled: boolean) => {
    setEditWeekly((prev) => ({
      ...prev,
      [day]: { ...prev[day], enabled },
    }));
  };

  const updateDayTime = (day: typeof DAYS[number], field: "startTime" | "endTime", value: string) => {
    setEditWeekly((prev) => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }));
  };

  const addBlockedDate = () => {
    const today = new Date().toISOString().split("T")[0];
    setEditBlocked((prev) => [
      ...prev,
      { id: crypto.randomUUID(), startDate: today, endDate: today, reason: "" },
    ]);
  };

  const updateBlockedDate = (id: string, field: keyof BlockedDateRange, value: string) => {
    setEditBlocked((prev) =>
      prev.map((b) => (b.id === id ? { ...b, [field]: value } : b))
    );
  };

  const removeBlockedDate = (id: string) => {
    setEditBlocked((prev) => prev.filter((b) => b.id !== id));
  };

  const formatTime = (time: string) => {
    const [h, m] = time.split(":");
    const hour = parseInt(h);
    const ampm = hour >= 12 ? "PM" : "AM";
    const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${hour12}${m !== "00" ? `:${m}` : ""}${ampm}`;
  };

  const getAvailabilitySummary = (avail?: UserAvailability) => {
    if (!avail?.weekly) return null;

    const enabledDays = DAYS.filter((d) => avail.weekly[d].enabled);
    if (enabledDays.length === 0) return null;

    return enabledDays.map((d, i) => {
      const day = avail.weekly[d];
      return (
        <span key={d} className="inline-flex items-center">
          <span className="font-medium">{DAY_LABELS[DAYS.indexOf(d)]}</span>
          <span className="text-gray-500 text-xs ml-1">
            {formatTime(day.startTime)}-{formatTime(day.endTime)}
          </span>
          {i < enabledDays.length - 1 && <span className="mx-1 text-gray-300">|</span>}
        </span>
      );
    });
  };

  const filteredHosts = hosts.filter((h) => {
    if (filter === "all") return true;
    if (filter === "set") return !!h.availability?.weekly;
    return !h.availability?.weekly;
  });

  const counts = {
    all: hosts.length,
    set: hosts.filter((h) => h.availability?.weekly).length,
    unset: hosts.filter((h) => !h.availability?.weekly).length,
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-primary">Host Availability</h1>
        <p className="text-gray-600 mt-1 sm:mt-2 text-sm sm:text-base">
          View and edit host availability schedules
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6">
        {[
          { key: "all", label: "All Hosts" },
          { key: "set", label: "Has Availability" },
          { key: "unset", label: "No Availability" },
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
            <span className={`px-1.5 py-0.5 rounded-full text-xs ${filter === tab.key ? "bg-white/20" : "bg-gray-200"}`}>
              {counts[tab.key as keyof typeof counts]}
            </span>
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-white rounded-xl p-4 animate-pulse">
              <div className="h-5 bg-gray-200 rounded w-1/4 mb-2" />
              <div className="h-4 bg-gray-100 rounded w-3/4" />
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {/* Desktop Table */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Host</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Weekly Availability</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Blocked</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredHosts.map((host) => (
                  <tr key={host.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-dark">{host.lastName}, {host.firstName}</div>
                      <div className="text-xs text-gray-500">{host.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      {host.availability?.weekly ? (
                        <div className="text-sm flex flex-wrap gap-1">
                          {getAvailabilitySummary(host.availability)}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">Not set</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {host.availability?.blockedDates?.length ? (
                        <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">
                          {host.availability.blockedDates.length} blocked
                        </span>
                      ) : (
                        <span className="text-gray-400 text-sm">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-600 max-w-xs truncate">
                        {(host.availability as { notes?: string } | undefined)?.notes || "-"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openEditor(host)}
                        className="px-3 py-1.5 text-sm font-medium text-primary bg-primary/10 rounded-lg hover:bg-primary/20"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="lg:hidden divide-y divide-gray-100">
            {filteredHosts.map((host) => (
              <div key={host.id} className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-medium text-dark">{host.lastName}, {host.firstName}</div>
                    <div className="text-xs text-gray-500">{host.email}</div>
                  </div>
                  <button
                    onClick={() => openEditor(host)}
                    className="px-3 py-1.5 text-sm font-medium text-primary bg-primary/10 rounded-lg"
                  >
                    Edit
                  </button>
                </div>
                {host.availability?.weekly ? (
                  <div className="text-sm flex flex-wrap gap-1 mb-2">
                    {getAvailabilitySummary(host.availability)}
                  </div>
                ) : (
                  <div className="text-gray-400 text-sm mb-2">No availability set</div>
                )}
                {host.availability?.blockedDates?.length ? (
                  <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">
                    {host.availability.blockedDates.length} blocked dates
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingHost && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-primary">Edit Availability</h2>
                <p className="text-sm text-gray-500">{editingHost.firstName} {editingHost.lastName}</p>
              </div>
              <button onClick={closeEditor} className="p-2 hover:bg-gray-100 rounded-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* Weekly Schedule */}
              <div>
                <h3 className="font-semibold text-dark mb-3">Weekly Schedule</h3>
                <div className="space-y-2">
                  {DAYS.map((day, i) => (
                    <div key={day} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                      <label className="flex items-center gap-2 w-20">
                        <input
                          type="checkbox"
                          checked={editWeekly[day].enabled}
                          onChange={(e) => updateDayEnabled(day, e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <span className="font-medium text-sm">{DAY_LABELS[i]}</span>
                      </label>
                      {editWeekly[day].enabled && (
                        <div className="flex items-center gap-2">
                          <input
                            type="time"
                            value={editWeekly[day].startTime}
                            onChange={(e) => updateDayTime(day, "startTime", e.target.value)}
                            className="px-2 py-1 border rounded-lg text-sm"
                          />
                          <span className="text-gray-400">to</span>
                          <input
                            type="time"
                            value={editWeekly[day].endTime}
                            onChange={(e) => updateDayTime(day, "endTime", e.target.value)}
                            className="px-2 py-1 border rounded-lg text-sm"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Blocked Dates */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-dark">Blocked Dates</h3>
                  <button
                    onClick={addBlockedDate}
                    className="text-sm text-primary hover:underline"
                  >
                    + Add Date
                  </button>
                </div>
                {editBlocked.length === 0 ? (
                  <p className="text-gray-400 text-sm">No blocked dates</p>
                ) : (
                  <div className="space-y-2">
                    {editBlocked.map((blocked) => (
                      <div key={blocked.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                        <input
                          type="date"
                          value={blocked.startDate}
                          onChange={(e) => updateBlockedDate(blocked.id, "startDate", e.target.value)}
                          className="px-2 py-1 border rounded-lg text-sm"
                        />
                        <span className="text-gray-400">to</span>
                        <input
                          type="date"
                          value={blocked.endDate}
                          onChange={(e) => updateBlockedDate(blocked.id, "endDate", e.target.value)}
                          className="px-2 py-1 border rounded-lg text-sm"
                        />
                        <input
                          type="text"
                          value={blocked.reason || ""}
                          onChange={(e) => updateBlockedDate(blocked.id, "reason", e.target.value)}
                          placeholder="Reason"
                          className="flex-1 px-2 py-1 border rounded-lg text-sm"
                        />
                        <button
                          onClick={() => removeBlockedDate(blocked.id)}
                          className="p-1 text-red-500 hover:bg-red-50 rounded"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <h3 className="font-semibold text-dark mb-3">Notes</h3>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Add notes about availability preferences..."
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg text-sm resize-none"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex gap-3 justify-end">
              <button
                onClick={closeEditor}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={saveAvailability}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
