"use client";

import { useState, useEffect } from "react";
import { WeeklyAvailability, DayAvailability, BlockedDateRange } from "@/lib/types";

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
const DAY_LABELS: Record<typeof DAYS[number], string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

const TIME_OPTIONS: string[] = [];
for (let h = 0; h < 24; h++) {
  for (let m = 0; m < 60; m += 30) {
    const hour = h.toString().padStart(2, "0");
    const minute = m.toString().padStart(2, "0");
    TIME_OPTIONS.push(`${hour}:${minute}`);
  }
}

function formatTime(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHour = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${displayHour}:${minutes.toString().padStart(2, "0")} ${period}`;
}

function formatDateRange(start: string, end: string): string {
  const startDate = new Date(start + "T00:00:00");
  const endDate = new Date(end + "T00:00:00");
  const options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };

  if (start === end) {
    return startDate.toLocaleDateString("en-US", options);
  }
  return `${startDate.toLocaleDateString("en-US", options)} - ${endDate.toLocaleDateString("en-US", options)}`;
}

const DEFAULT_AVAILABILITY: WeeklyAvailability = {
  monday: { enabled: false, startTime: "09:00", endTime: "17:00" },
  tuesday: { enabled: false, startTime: "09:00", endTime: "17:00" },
  wednesday: { enabled: false, startTime: "09:00", endTime: "17:00" },
  thursday: { enabled: false, startTime: "09:00", endTime: "17:00" },
  friday: { enabled: false, startTime: "09:00", endTime: "17:00" },
  saturday: { enabled: false, startTime: "09:00", endTime: "17:00" },
  sunday: { enabled: false, startTime: "09:00", endTime: "17:00" },
};

export default function AvailabilityForm() {
  const [weekly, setWeekly] = useState<WeeklyAvailability>(DEFAULT_AVAILABILITY);
  const [blockedDates, setBlockedDates] = useState<BlockedDateRange[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // New blocked date form
  const [newBlockedStart, setNewBlockedStart] = useState("");
  const [newBlockedEnd, setNewBlockedEnd] = useState("");
  const [newBlockedReason, setNewBlockedReason] = useState("");

  useEffect(() => {
    fetchAvailability();
  }, []);

  async function fetchAvailability() {
    try {
      const response = await fetch("/api/availability");
      if (response.ok) {
        const data = await response.json();
        if (data.weekly) {
          setWeekly(data.weekly);
        }
        if (data.blockedDates) {
          setBlockedDates(data.blockedDates);
        }
      }
    } catch (error) {
      console.error("Error fetching availability:", error);
    } finally {
      setLoading(false);
    }
  }

  async function saveAvailability() {
    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/availability", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekly, blockedDates }),
      });

      if (response.ok) {
        setMessage({ type: "success", text: "Availability saved successfully!" });
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ type: "error", text: "Failed to save availability" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Failed to save availability" });
    } finally {
      setSaving(false);
    }
  }

  function updateDay(day: typeof DAYS[number], updates: Partial<DayAvailability>) {
    setWeekly((prev) => ({
      ...prev,
      [day]: { ...prev[day], ...updates },
    }));
  }

  function addBlockedDate() {
    if (!newBlockedStart) return;

    const endDate = newBlockedEnd || newBlockedStart;

    const newBlocked: BlockedDateRange = {
      id: crypto.randomUUID(),
      startDate: newBlockedStart,
      endDate: endDate,
      reason: newBlockedReason || undefined,
    };

    setBlockedDates((prev) => [...prev, newBlocked].sort((a, b) =>
      new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
    ));

    setNewBlockedStart("");
    setNewBlockedEnd("");
    setNewBlockedReason("");
  }

  function removeBlockedDate(id: string) {
    setBlockedDates((prev) => prev.filter((d) => d.id !== id));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-primary">Availability</h1>
        <p className="text-gray-600 mt-1">
          Set your weekly schedule and block off dates when you&apos;re not available.
        </p>
      </div>

      {message && (
        <div
          className={`mb-6 p-4 rounded-lg ${
            message.type === "success"
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Weekly Availability */}
      <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold text-dark mb-4">Weekly Availability</h2>
        <p className="text-sm text-gray-500 mb-6">
          Check the days you&apos;re available and set your working hours for each day.
        </p>

        <div className="space-y-4">
          {DAYS.map((day) => (
            <div
              key={day}
              className={`p-4 rounded-lg border transition-colors ${
                weekly[day].enabled ? "border-accent bg-accent/5" : "border-gray-200 bg-gray-50"
              }`}
            >
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-3 cursor-pointer flex-1">
                  <input
                    type="checkbox"
                    checked={weekly[day].enabled}
                    onChange={(e) => updateDay(day, { enabled: e.target.checked })}
                    className="w-5 h-5 rounded border-gray-300 text-accent focus:ring-accent"
                  />
                  <span className="font-medium text-dark">{DAY_LABELS[day]}</span>
                </label>

                {weekly[day].enabled && (
                  <div className="flex items-center gap-2">
                    <select
                      value={weekly[day].startTime}
                      onChange={(e) => updateDay(day, { startTime: e.target.value })}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                    >
                      {TIME_OPTIONS.map((time) => (
                        <option key={time} value={time}>
                          {formatTime(time)}
                        </option>
                      ))}
                    </select>
                    <span className="text-gray-500">to</span>
                    <select
                      value={weekly[day].endTime}
                      onChange={(e) => updateDay(day, { endTime: e.target.value })}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                    >
                      {TIME_OPTIONS.map((time) => (
                        <option key={time} value={time}>
                          {formatTime(time)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Blocked Dates */}
      <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold text-dark mb-4">Blocked Dates</h2>
        <p className="text-sm text-gray-500 mb-6">
          Add dates or date ranges when you&apos;re not available (vacations, appointments, etc.)
        </p>

        {/* Add new blocked date */}
        <div className="flex flex-wrap gap-3 mb-6 p-4 bg-gray-50 rounded-lg">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Start Date</label>
            <input
              type="date"
              value={newBlockedStart}
              onChange={(e) => setNewBlockedStart(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">End Date (optional)</label>
            <input
              type="date"
              value={newBlockedEnd}
              onChange={(e) => setNewBlockedEnd(e.target.value)}
              min={newBlockedStart}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">Reason (optional)</label>
            <input
              type="text"
              value={newBlockedReason}
              onChange={(e) => setNewBlockedReason(e.target.value)}
              placeholder="e.g., Vacation"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={addBlockedDate}
              disabled={!newBlockedStart}
              className="px-4 py-2 bg-accent text-white font-medium rounded-lg hover:bg-accent-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add
            </button>
          </div>
        </div>

        {/* List of blocked dates */}
        {blockedDates.length === 0 ? (
          <p className="text-gray-400 text-center py-8">No blocked dates added yet.</p>
        ) : (
          <div className="space-y-2">
            {blockedDates.map((blocked) => (
              <div
                key={blocked.id}
                className="flex items-center justify-between p-3 bg-red-50 border border-red-100 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                  <div>
                    <p className="font-medium text-dark">
                      {formatDateRange(blocked.startDate, blocked.endDate)}
                    </p>
                    {blocked.reason && (
                      <p className="text-sm text-gray-500">{blocked.reason}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => removeBlockedDate(blocked.id)}
                  className="p-2 text-red-500 hover:text-red-700 hover:bg-red-100 rounded transition-colors"
                  title="Remove"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={saveAvailability}
          disabled={saving}
          className="px-6 py-3 bg-accent text-white font-semibold rounded-lg hover:bg-accent-600 transition-colors disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Availability"}
        </button>
      </div>
    </div>
  );
}
