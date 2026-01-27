"use client";

import { useEffect, useState } from "react";
import { ScheduleWidgetEntry } from "@/lib/schedule-types";

interface ScheduleWidgetProps {
  userEmail?: string;
}

export default function ScheduleWidget({ userEmail }: ScheduleWidgetProps) {
  const [entries, setEntries] = useState<ScheduleWidgetEntry[]>([]);
  const [allEntries, setAllEntries] = useState<ScheduleWidgetEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCallOut, setShowCallOut] = useState(false);
  const [selectedShifts, setSelectedShifts] = useState<Set<number>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function fetchSchedule() {
      try {
        // Fetch widget entries (limited)
        const response = await fetch("/api/schedule/widget");
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
        setEntries(data.entries || []);

        // Fetch all entries for call out modal
        const allResponse = await fetch("/api/schedule/widget?limit=50");
        if (allResponse.ok) {
          const allData = await allResponse.json();
          setAllEntries(allData.entries || []);
        }
      } catch (err) {
        console.error("Error fetching schedule:", err);
        setError("fetch_error");
      } finally {
        setLoading(false);
      }
    }

    fetchSchedule();
  }, [userEmail]);

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
      // For now, just show an alert
      const selectedEntries = allEntries.filter(e => selectedShifts.has(e.id));
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

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-4 sm:p-6">
        <h3 className="text-lg font-semibold text-dark mb-4">Upcoming Schedule</h3>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse flex items-center gap-3">
              <div className="w-2 h-12 bg-gray-200 rounded-full" />
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded w-24 mb-2" />
                <div className="h-3 bg-gray-100 rounded w-32" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // User not in scheduler system
  if (error === "not_in_system") {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-4 sm:p-6">
        <h3 className="text-lg font-semibold text-dark mb-4">Upcoming Schedule</h3>
        <div className="text-center py-6 text-gray-500">
          <svg className="w-10 h-10 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-sm mb-2">Schedule not set up yet</p>
          <p className="text-xs text-gray-400">Contact your producer to get scheduled</p>
        </div>
      </div>
    );
  }

  // Error fetching
  if (error) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-4 sm:p-6">
        <h3 className="text-lg font-semibold text-dark mb-4">Upcoming Schedule</h3>
        <div className="text-center py-6 text-gray-500">
          <p className="text-sm">Unable to load schedule</p>
          <button
            onClick={() => window.location.reload()}
            className="text-accent text-sm mt-2 hover:underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  // No upcoming sessions
  if (entries.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-4 sm:p-6">
        <h3 className="text-lg font-semibold text-dark mb-4">Upcoming Schedule</h3>
        <div className="text-center py-6 text-gray-500">
          <svg className="w-10 h-10 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-sm">No upcoming sessions</p>
          <a href="/schedule" className="inline-flex items-center text-accent font-medium hover:underline mt-2 text-sm">
            View Full Schedule
          </a>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm p-4 sm:p-6">
        {/* Header with Call Out button */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-dark">Upcoming Schedule</h3>
          <button
            onClick={() => setShowCallOut(true)}
            className="group relative px-3 py-1.5 text-sm font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors animate-pulse shadow-lg shadow-red-500/50"
          >
            {/* Flashing siren effect */}
            <span className="absolute inset-0 rounded-lg bg-red-500 animate-ping opacity-75"></span>
            <span className="relative flex items-center gap-1.5">
              {/* Siren icon */}
              <svg className="w-4 h-4 animate-spin" style={{ animationDuration: '2s' }} viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C11.5 2 11 2.19 10.59 2.59L2.59 10.59C1.8 11.37 1.8 12.63 2.59 13.41L10.59 21.41C11.37 22.2 12.63 22.2 13.41 21.41L21.41 13.41C22.2 12.63 22.2 11.37 21.41 10.59L13.41 2.59C13 2.19 12.5 2 12 2M12 4L20 12L12 20L4 12L12 4M12 7C10.34 7 9 8.34 9 10C9 11.66 10.34 13 12 13C13.66 13 15 11.66 15 10C15 8.34 13.66 7 12 7Z"/>
              </svg>
              Call Out
            </span>
          </button>
        </div>

        <div className="space-y-3">
          {entries.map((entry) => (
            <div key={entry.id} className="flex items-start gap-3 group">
              {/* Color indicator */}
              <div
                className="w-2 h-full min-h-[3rem] rounded-full flex-shrink-0"
                style={{ backgroundColor: entry.studioColor }}
              />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-dark text-sm sm:text-base">
                    {entry.studioName}
                  </span>
                  <span
                    className="px-2 py-0.5 text-xs rounded-full"
                    style={{
                      backgroundColor: `${entry.studioColor}15`,
                      color: entry.studioColor,
                    }}
                  >
                    {entry.date}
                  </span>
                </div>
                <p className="text-gray-500 text-xs sm:text-sm mt-0.5">
                  {entry.time}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-gray-100">
          <a
            href="/schedule"
            className="inline-flex items-center text-accent font-medium hover:underline text-sm"
          >
            View Full Calendar
            <svg className="w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </a>
        </div>
      </div>

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
                {allEntries.map((entry) => (
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

              {allEntries.length === 0 && (
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
    </>
  );
}
