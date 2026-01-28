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
  const [pendingCallOuts, setPendingCallOuts] = useState<Set<number>>(new Set());

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

        // Fetch pending call outs
        const calloutsResponse = await fetch("/api/callouts?status=pending");
        if (calloutsResponse.ok) {
          const calloutsData = await calloutsResponse.json();
          const pendingIds = new Set<number>(
            (calloutsData.callouts || []).map((c: { shiftId: number }) => c.shiftId)
          );
          setPendingCallOuts(pendingIds);
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

  // Helper to determine urgency icon based on time until shift
  const getUrgencyIcon = (startingOn: string) => {
    const now = new Date();
    const shiftDate = new Date(startingOn);
    const hoursUntil = (shiftDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    const twoWeeksInHours = 14 * 24;

    if (hoursUntil < 48) {
      // Emergency icon (red warning)
      return (
        <div className="flex-shrink-0" title="Emergency - Less than 48 hours">
          <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        </div>
      );
    } else if (hoursUntil < twoWeeksInHours) {
      // Reschedule icon (calendar with clock) - yellow/orange
      return (
        <div className="flex-shrink-0" title="Reschedule - Less than 2 weeks">
          <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 11v4l2 2" />
          </svg>
        </div>
      );
    } else {
      // Reschedule icon (calendar) - green/normal
      return (
        <div className="flex-shrink-0" title="Reschedule - More than 2 weeks notice">
          <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
      );
    }
  };

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
      const selectedEntries = allEntries.filter(e => selectedShifts.has(e.id));

      // Submit to API
      const response = await fetch("/api/callouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shifts: selectedEntries.map(e => ({
            shiftId: e.id,
            shiftDate: e.date,
            shiftTime: e.time,
            studioName: e.studioName,
            startingOn: e.startingOn,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to submit call out");
      }

      // Update pending call outs state
      const newPending = new Set(pendingCallOuts);
      selectedEntries.forEach(e => newPending.add(e.id));
      setPendingCallOuts(newPending);

      const shiftDetails = selectedEntries
        .map(e => `${e.date} ${e.time} - ${e.studioName}`)
        .join("\n");

      // Determine urgency warning based on closest shift
      const now = new Date();
      const minHours = Math.min(
        ...selectedEntries.map(e => (new Date(e.startingOn).getTime() - now.getTime()) / (1000 * 60 * 60))
      );

      let warning = "";
      if (minHours < 48) {
        warning = "\n\n⚠️ Calling out within 48 hours of a shift is for personal emergencies or illness only, call outs for any other reason could result in loss of shifts.";
      } else if (minHours < 14 * 24) {
        warning = "\n\n⚠️ Calling out within two weeks of a shift could result in loss of future shifts.";
      }

      alert(`Call out submitted for:\n\n${shiftDetails}\n\nYour producer will be notified.${warning}`);

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
            className="px-3 py-1.5 text-sm font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors shadow-lg shadow-red-500/50"
          >
            Call Out
          </button>
        </div>

        <div className="space-y-3">
          {entries.map((entry) => (
            <div key={entry.id} className={`flex items-start gap-3 group ${pendingCallOuts.has(entry.id) ? "bg-amber-50 -mx-2 px-2 py-1 rounded-lg" : ""}`}>
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
                  {pendingCallOuts.has(entry.id) && (
                    <span className="px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-700 font-medium flex items-center gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                      </svg>
                      Call Out Pending
                    </span>
                  )}
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
                {allEntries.map((entry) => {
                  const isPending = pendingCallOuts.has(entry.id);
                  return (
                    <label
                      key={entry.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                        isPending
                          ? "border-amber-300 bg-amber-50 cursor-not-allowed opacity-60"
                          : selectedShifts.has(entry.id)
                          ? "border-red-300 bg-red-50 cursor-pointer"
                          : "border-gray-200 hover:bg-gray-50 cursor-pointer"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedShifts.has(entry.id)}
                        onChange={() => !isPending && toggleShift(entry.id)}
                        disabled={isPending}
                        className="w-4 h-4 text-red-600 rounded border-gray-300 focus:ring-red-500 disabled:opacity-50"
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
                      {isPending ? (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-700 font-medium">
                          Already Pending
                        </span>
                      ) : (
                        getUrgencyIcon(entry.startingOn)
                      )}
                    </label>
                  );
                })}
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
