"use client";

import { useEffect, useState } from "react";
import { ScheduleWidgetEntry } from "@/lib/schedule-types";

interface ScheduleWidgetProps {
  userEmail?: string;
}

export default function ScheduleWidget({ userEmail }: ScheduleWidgetProps) {
  const [entries, setEntries] = useState<ScheduleWidgetEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSchedule() {
      try {
        const response = await fetch("/api/schedule/widget");
        if (!response.ok) {
          if (response.status === 404) {
            // User not found in scheduler DB
            setEntries([]);
            setError("not_in_system");
          } else {
            throw new Error("Failed to fetch schedule");
          }
          return;
        }

        const data = await response.json();
        setEntries(data.entries || []);
      } catch (err) {
        console.error("Error fetching schedule:", err);
        setError("fetch_error");
      } finally {
        setLoading(false);
      }
    }

    fetchSchedule();
  }, [userEmail]);

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
    <div className="bg-white rounded-2xl shadow-sm p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-dark">Upcoming Schedule</h3>
        <a href="/schedule" className="text-accent text-sm font-medium hover:underline">
          View All
        </a>
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
  );
}
