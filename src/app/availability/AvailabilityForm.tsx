"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  // Track if initial data has loaded (to prevent auto-save on first load)
  const hasLoadedRef = useRef(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // New blocked date form
  const [newBlockedStart, setNewBlockedStart] = useState("");
  const [newBlockedEnd, setNewBlockedEnd] = useState("");
  const [newBlockedReason, setNewBlockedReason] = useState("");

  // Auto-save function
  const autoSave = useCallback(async (weeklyData: WeeklyAvailability, blockedData: BlockedDateRange[]) => {
    setSaveStatus("saving");

    try {
      const response = await fetch("/api/availability", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekly: weeklyData, blockedDates: blockedData }),
      });

      if (response.ok) {
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      } else {
        setSaveStatus("error");
        setTimeout(() => setSaveStatus("idle"), 3000);
      }
    } catch (error) {
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  }, []);

  // Debounced auto-save when weekly or blockedDates change
  useEffect(() => {
    if (!hasLoadedRef.current) return;

    // Clear any existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout for auto-save (500ms debounce)
    saveTimeoutRef.current = setTimeout(() => {
      autoSave(weekly, blockedDates);
    }, 500);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [weekly, blockedDates, autoSave]);

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
      // Mark as loaded after a brief delay to ensure state has settled
      setTimeout(() => {
        hasLoadedRef.current = true;
      }, 100);
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
    <div className="max-w-4xl pb-6">
      <div className="mb-6 sm:mb-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-primary">Availability</h1>
            <p className="text-gray-600 mt-1 text-sm sm:text-base">
              Set your weekly schedule and block off dates when you&apos;re not available.
            </p>
          </div>
          {/* Auto-save status indicator */}
          <div className="flex-shrink-0">
            {saveStatus === "saving" && (
              <span className="flex items-center gap-2 text-sm text-gray-500">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="hidden sm:inline">Saving...</span>
              </span>
            )}
            {saveStatus === "saved" && (
              <span className="flex items-center gap-2 text-sm text-green-600">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="hidden sm:inline">Saved</span>
              </span>
            )}
            {saveStatus === "error" && (
              <span className="flex items-center gap-2 text-sm text-red-600">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span className="hidden sm:inline">Error saving</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Weekly Availability */}
      <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold text-dark mb-4">Weekly Availability</h2>
        <p className="text-sm text-gray-500 mb-6">
          Check the days you&apos;re available and set your working hours for each day.
        </p>

        <div className="space-y-3">
          {DAYS.map((day) => (
            <div
              key={day}
              className={`p-4 rounded-lg border transition-colors ${
                weekly[day].enabled ? "border-accent bg-accent/5" : "border-gray-200 bg-gray-50"
              }`}
            >
              {/* Desktop Layout */}
              <div className="hidden sm:flex items-center gap-4">
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

              {/* Mobile Layout */}
              <div className="sm:hidden">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={weekly[day].enabled}
                    onChange={(e) => updateDay(day, { enabled: e.target.checked })}
                    className="w-5 h-5 rounded border-gray-300 text-accent focus:ring-accent"
                  />
                  <span className="font-medium text-dark">{DAY_LABELS[day]}</span>
                  {weekly[day].enabled && (
                    <span className="ml-auto text-sm text-accent">
                      {formatTime(weekly[day].startTime)} - {formatTime(weekly[day].endTime)}
                    </span>
                  )}
                </label>

                {weekly[day].enabled && (
                  <div className="mt-3 pt-3 border-t border-gray-200 grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Start</label>
                      <select
                        value={weekly[day].startTime}
                        onChange={(e) => updateDay(day, { startTime: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                      >
                        {TIME_OPTIONS.map((time) => (
                          <option key={time} value={time}>
                            {formatTime(time)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">End</label>
                      <select
                        value={weekly[day].endTime}
                        onChange={(e) => updateDay(day, { endTime: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                      >
                        {TIME_OPTIONS.map((time) => (
                          <option key={time} value={time}>
                            {formatTime(time)}
                          </option>
                        ))}
                      </select>
                    </div>
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
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          {/* Desktop Layout */}
          <div className="hidden sm:flex flex-wrap gap-3">
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

          {/* Mobile Layout */}
          <div className="sm:hidden space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Start Date</label>
                <input
                  type="date"
                  value={newBlockedStart}
                  onChange={(e) => setNewBlockedStart(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">End Date</label>
                <input
                  type="date"
                  value={newBlockedEnd}
                  onChange={(e) => setNewBlockedEnd(e.target.value)}
                  min={newBlockedStart}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Reason (optional)</label>
              <input
                type="text"
                value={newBlockedReason}
                onChange={(e) => setNewBlockedReason(e.target.value)}
                placeholder="e.g., Vacation"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <button
              onClick={addBlockedDate}
              disabled={!newBlockedStart}
              className="w-full px-4 py-3 bg-accent text-white font-medium rounded-lg hover:bg-accent-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add Blocked Date
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
                className="flex items-center justify-between p-3 bg-red-50 border border-red-100 rounded-lg gap-3"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                  <div className="min-w-0">
                    <p className="font-medium text-dark text-sm sm:text-base">
                      {formatDateRange(blocked.startDate, blocked.endDate)}
                    </p>
                    {blocked.reason && (
                      <p className="text-sm text-gray-500 truncate">{blocked.reason}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => removeBlockedDate(blocked.id)}
                  className="p-2 text-red-500 hover:text-red-700 hover:bg-red-100 rounded transition-colors flex-shrink-0"
                  title="Remove"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
