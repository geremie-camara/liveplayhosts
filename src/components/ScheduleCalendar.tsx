"use client";

import { useEffect, useState } from "react";
import {
  ScheduleEntry,
  ScheduleWidgetEntry,
  MONTH_NAMES,
  DAY_NAMES,
  DAY_NAMES_FULL,
  getDaysInMonth,
  getFirstDayOfMonth,
  formatScheduleTime,
} from "@/lib/schedule-types";

interface ScheduleCalendarProps {
  userEmail?: string;
}

type ViewMode = "month" | "list";

export default function ScheduleCalendar({ userEmail }: ScheduleCalendarProps) {
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [currentDate, setCurrentDate] = useState(new Date());

  // Call Out modal state
  const [showCallOut, setShowCallOut] = useState(false);
  const [selectedShifts, setSelectedShifts] = useState<Set<number>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [upcomingEntries, setUpcomingEntries] = useState<ScheduleWidgetEntry[]>([]);

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  useEffect(() => {
    async function fetchSchedule() {
      try {
        const params = new URLSearchParams({
          year: currentYear.toString(),
          month: currentMonth.toString(),
        });

        const response = await fetch(`/api/schedule?${params}`);
        if (!response.ok) {
          if (response.status === 404) {
            setEntries([]);
            setError("not_in_system");
          } else {
            throw new Error("Failed to fetch schedule");
          }
          return;
        }

        const data = await response.json();
        // Convert date strings back to Date objects
        const entriesWithDates = (data.entries || []).map((e: ScheduleEntry & { startingOn: string; endingOn: string }) => ({
          ...e,
          startingOn: new Date(e.startingOn),
          endingOn: new Date(e.endingOn),
        }));
        setEntries(entriesWithDates);
        setError(null);
      } catch (err) {
        console.error("Error fetching schedule:", err);
        setError("fetch_error");
      } finally {
        setLoading(false);
      }
    }

    setLoading(true);
    fetchSchedule();
  }, [currentYear, currentMonth, userEmail]);

  // Fetch upcoming entries for call out modal
  useEffect(() => {
    async function fetchUpcoming() {
      try {
        const response = await fetch("/api/schedule/widget?limit=50");
        if (response.ok) {
          const data = await response.json();
          setUpcomingEntries(data.entries || []);
        }
      } catch (err) {
        console.error("Error fetching upcoming entries:", err);
      }
    }
    fetchUpcoming();
  }, []);

  const toggleShift = (id: number) => {
    const newSelected = new Set(selectedShifts);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedShifts(newSelected);
  };

  const handleCallOut = async () => {
    if (selectedShifts.size === 0) return;

    setSubmitting(true);
    try {
      // TODO: Implement actual call out API
      const selectedEntries = upcomingEntries.filter(e => selectedShifts.has(e.id));
      const shiftDetails = selectedEntries
        .map(e => `${e.date} ${e.time} - ${e.studioName}`)
        .join("\n");

      alert(`Call out submitted for:\n\n${shiftDetails}\n\nYour producer will be notified.`);

      setShowCallOut(false);
      setSelectedShifts(new Set());
    } catch (err) {
      console.error("Error submitting call out:", err);
      alert("Failed to submit call out. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Get entries for a specific day
  const getEntriesForDay = (day: number): ScheduleEntry[] => {
    return entries.filter((e) => {
      const entryDate = e.startingOn;
      return (
        entryDate.getDate() === day &&
        entryDate.getMonth() === currentMonth &&
        entryDate.getFullYear() === currentYear
      );
    });
  };

  // Check if a day is today
  const isToday = (day: number): boolean => {
    const today = new Date();
    return (
      day === today.getDate() &&
      currentMonth === today.getMonth() &&
      currentYear === today.getFullYear()
    );
  };

  // Group entries by date for list view
  const entriesByDate = entries.reduce((acc, entry) => {
    const dateKey = entry.startingOn.toISOString().split("T")[0];
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(entry);
    return acc;
  }, {} as Record<string, ScheduleEntry[]>);

  const sortedDates = Object.keys(entriesByDate).sort();

  // Render calendar grid
  const renderCalendarGrid = () => {
    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
    const days: (number | null)[] = [];

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }

    return (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
          {DAY_NAMES.map((day) => (
            <div
              key={day}
              className="p-2 text-center text-xs font-medium text-gray-500"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7">
          {days.map((day, index) => {
            const dayEntries = day ? getEntriesForDay(day) : [];
            const today = isToday(day || 0);

            return (
              <div
                key={index}
                className={`min-h-[80px] sm:min-h-[100px] border-b border-r border-gray-100 p-1 ${
                  !day ? "bg-gray-50" : ""
                }`}
              >
                {day && (
                  <>
                    <div
                      className={`text-xs sm:text-sm font-medium mb-1 ${
                        today
                          ? "w-6 h-6 sm:w-7 sm:h-7 bg-primary text-white rounded-full flex items-center justify-center"
                          : "text-gray-700 px-1"
                      }`}
                    >
                      {day}
                    </div>
                    <div className="space-y-1">
                      {dayEntries.slice(0, 2).map((entry) => (
                        <div
                          key={entry.id}
                          className="px-1 py-0.5 rounded text-xs truncate"
                          style={{
                            backgroundColor: `${entry.studioColor}20`,
                            color: entry.studioColor,
                            borderLeft: `2px solid ${entry.studioColor}`,
                          }}
                          title={`${entry.studioName}: ${formatScheduleTime(entry.startingOn, entry.endingOn)}`}
                        >
                          <span className="hidden sm:inline">
                            {entry.startingOn.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                          </span>
                          <span className="sm:hidden">{entry.studioName.charAt(0)}</span>
                        </div>
                      ))}
                      {dayEntries.length > 2 && (
                        <div className="text-xs text-gray-500 px-1">
                          +{dayEntries.length - 2} more
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Render list view
  const renderListView = () => {
    if (sortedDates.length === 0) {
      return (
        <div className="text-center py-12 text-gray-500">
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
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <p className="text-lg font-medium">No sessions this month</p>
          <p className="text-sm mt-1">Check other months or contact your producer</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {sortedDates.map((dateKey) => {
          const dayEntries = entriesByDate[dateKey];
          const date = new Date(dateKey + "T00:00:00");
          const today = new Date();
          const isEntryToday =
            date.getDate() === today.getDate() &&
            date.getMonth() === today.getMonth() &&
            date.getFullYear() === today.getFullYear();

          return (
            <div key={dateKey} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* Date header */}
              <div
                className={`px-4 py-3 border-b border-gray-100 ${
                  isEntryToday ? "bg-primary text-white" : "bg-gray-50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="text-center">
                    <div className={`text-2xl font-bold ${isEntryToday ? "" : "text-primary"}`}>
                      {date.getDate()}
                    </div>
                    <div className={`text-xs uppercase ${isEntryToday ? "text-white/80" : "text-gray-500"}`}>
                      {DAY_NAMES_FULL[date.getDay()].slice(0, 3)}
                    </div>
                  </div>
                  <div>
                    <div className={`font-medium ${isEntryToday ? "" : "text-dark"}`}>
                      {DAY_NAMES_FULL[date.getDay()]}
                    </div>
                    <div className={`text-sm ${isEntryToday ? "text-white/80" : "text-gray-500"}`}>
                      {date.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                    </div>
                  </div>
                  {isEntryToday && (
                    <span className="ml-auto text-xs bg-white/20 px-2 py-1 rounded-full">
                      Today
                    </span>
                  )}
                </div>
              </div>

              {/* Entries for this day */}
              <div className="divide-y divide-gray-100">
                {dayEntries.map((entry) => (
                  <div key={entry.id} className="px-4 py-3 flex items-start gap-3">
                    <div
                      className="w-1 h-full min-h-[3rem] rounded-full flex-shrink-0"
                      style={{ backgroundColor: entry.studioColor }}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-dark">{entry.studioName}</span>
                        <span
                          className="px-2 py-0.5 text-xs rounded-full"
                          style={{
                            backgroundColor: `${entry.studioColor}15`,
                            color: entry.studioColor,
                          }}
                        >
                          {formatScheduleTime(entry.startingOn, entry.endingOn)}
                        </span>
                      </div>
                      {entry.notes && (
                        <p className="text-sm text-gray-500 mt-1">{entry.notes}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-12 bg-gray-200 rounded-lg" />
        <div className="h-64 bg-gray-100 rounded-xl" />
      </div>
    );
  }

  if (error === "not_in_system") {
    return (
      <div className="text-center py-12">
        <svg
          className="w-16 h-16 mx-auto mb-4 text-gray-300"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        <h2 className="text-xl font-semibold text-dark mb-2">Schedule Not Set Up</h2>
        <p className="text-gray-500 max-w-md mx-auto">
          Your schedule isn&apos;t available yet. Contact your producer or manager to get set up in the scheduling system.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 mb-4">Unable to load schedule</p>
        <button
          onClick={() => window.location.reload()}
          className="text-accent font-medium hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Month navigation */}
        <div className="flex items-center gap-2 sm:gap-4">
          <button
            onClick={goToPreviousMonth}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Previous month"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <h2 className="text-lg sm:text-xl font-semibold text-dark min-w-[180px] text-center">
            {MONTH_NAMES[currentMonth]} {currentYear}
          </h2>

          <button
            onClick={goToNextMonth}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Next month"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <button
            onClick={goToToday}
            className="px-3 py-1.5 text-sm font-medium text-primary border border-primary rounded-lg hover:bg-primary hover:text-white transition-colors"
          >
            Today
          </button>

          <button
            onClick={() => setShowCallOut(true)}
            className="px-3 py-1.5 text-sm font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors shadow-lg shadow-red-500/50"
          >
            Call Out
          </button>
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setViewMode("list")}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              viewMode === "list"
                ? "bg-white text-primary shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            List
          </button>
          <button
            onClick={() => setViewMode("month")}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              viewMode === "month"
                ? "bg-white text-primary shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Calendar
          </button>
        </div>
      </div>

      {/* Studio legend */}
      {entries.length > 0 && (
        <div className="flex flex-wrap gap-3 text-sm">
          {Array.from(new Set(entries.map((e) => e.studioName))).map((studio) => {
            const entry = entries.find((e) => e.studioName === studio);
            return (
              <div key={studio} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: entry?.studioColor }}
                />
                <span className="text-gray-600">{studio}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Calendar view */}
      {viewMode === "month" ? renderCalendarGrid() : renderListView()}

      {/* Call Out Modal */}
      {showCallOut && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[80vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-dark">Call Out</h2>
              <button
                onClick={() => {
                  setShowCallOut(false);
                  setSelectedShifts(new Set());
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 overflow-y-auto flex-1">
              <p className="text-sm text-gray-600 mb-4">
                Select the shifts you need to call out from:
              </p>

              <div className="space-y-2">
                {upcomingEntries.map((entry) => (
                  <label
                    key={entry.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedShifts.has(entry.id)
                        ? "border-red-300 bg-red-50"
                        : "border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedShifts.has(entry.id)}
                      onChange={() => toggleShift(entry.id)}
                      className="w-4 h-4 text-red-600 rounded border-gray-300 focus:ring-red-500"
                    />
                    <div
                      className="w-2 h-8 rounded-full flex-shrink-0"
                      style={{ backgroundColor: entry.studioColor }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-dark text-sm">
                        {entry.date}
                      </div>
                      <div className="text-xs text-gray-500">
                        {entry.time} • {entry.studioName}
                      </div>
                    </div>
                  </label>
                ))}
              </div>

              {upcomingEntries.length === 0 && (
                <p className="text-center text-gray-500 py-4">
                  No upcoming shifts to call out from
                </p>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => {
                  setShowCallOut(false);
                  setSelectedShifts(new Set());
                }}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCallOut}
                disabled={selectedShifts.size === 0 || submitting}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? "Submitting..." : `Call Out (${selectedShifts.size})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
