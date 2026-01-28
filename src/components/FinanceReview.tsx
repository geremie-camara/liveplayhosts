"use client";

import { useEffect, useState, useCallback } from "react";
import {
  HOURLY_RATE,
  FinanceReview as FinanceReviewType,
  FinanceReviewStatus,
  PayCycleHalf,
  getCurrentPayCycle,
  getPayCycleLabel,
} from "@/lib/finance-types";
import {
  ScheduleEntry,
  MONTH_NAMES,
  DAY_NAMES_FULL,
  formatScheduleTime,
} from "@/lib/schedule-types";

interface FinanceReviewProps {
  userEmail?: string;
}

interface FinanceSummary {
  totalHours: number;
  totalPay: number;
  daysWorked: number;
  daysAccepted: number;
  daysDisputed: number;
  daysPending: number;
}

export default function FinanceReview({ userEmail }: FinanceReviewProps) {
  const defaultCycle = getCurrentPayCycle();

  const [currentYear, setCurrentYear] = useState(defaultCycle.year);
  const [currentMonth, setCurrentMonth] = useState(defaultCycle.month);
  const [selectedHalf, setSelectedHalf] = useState<PayCycleHalf>(defaultCycle.half);
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [reviews, setReviews] = useState<Record<string, FinanceReviewType>>({});
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<string | null>(null); // date being submitted
  const [disputeDay, setDisputeDay] = useState<string | null>(null);
  const [disputeText, setDisputeText] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        year: currentYear.toString(),
        month: currentMonth.toString(),
        half: selectedHalf.toString(),
      });

      const response = await fetch(`/api/finance?${params}`);
      if (!response.ok) {
        if (response.status === 404) {
          setEntries([]);
          setReviews({});
          setSummary(null);
          setError("not_in_system");
          return;
        }
        throw new Error("Failed to fetch finance data");
      }

      const data = await response.json();
      const entriesWithDates = (data.entries || []).map(
        (e: ScheduleEntry & { startingOn: string; endingOn: string }) => ({
          ...e,
          startingOn: new Date(e.startingOn),
          endingOn: new Date(e.endingOn),
        })
      );
      setEntries(entriesWithDates);
      setReviews(data.reviews || {});
      setSummary(data.summary || null);
    } catch (err) {
      console.error("Error fetching finance data:", err);
      setError("fetch_error");
    } finally {
      setLoading(false);
    }
  }, [currentYear, currentMonth, selectedHalf]);

  useEffect(() => {
    fetchData();
  }, [fetchData, userEmail]);

  const goToPreviousMonth = () => {
    if (currentMonth === 0) {
      setCurrentYear(currentYear - 1);
      setCurrentMonth(11);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
    setSelectedHalf(1);
  };

  const goToNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentYear(currentYear + 1);
      setCurrentMonth(0);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
    setSelectedHalf(1);
  };

  const goToCurrentPayCycle = () => {
    const cycle = getCurrentPayCycle();
    setCurrentYear(cycle.year);
    setCurrentMonth(cycle.month);
    setSelectedHalf(cycle.half);
  };

  const handleAccept = async (dateStr: string) => {
    setSubmitting(dateStr);
    try {
      const response = await fetch("/api/finance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: dateStr,
          action: "accept",
          year: currentYear,
          month: currentMonth,
          half: selectedHalf,
        }),
      });

      if (!response.ok) throw new Error("Failed to accept");

      const data = await response.json();
      setReviews((prev) => ({ ...prev, [dateStr]: data.review }));
      // Update summary counts
      setSummary((prev) => {
        if (!prev) return prev;
        const wasDisputed = reviews[dateStr]?.status === "disputed";
        const wasPending = !reviews[dateStr] || reviews[dateStr]?.status === "pending";
        return {
          ...prev,
          daysAccepted: prev.daysAccepted + 1,
          daysDisputed: wasDisputed ? prev.daysDisputed - 1 : prev.daysDisputed,
          daysPending: wasPending ? prev.daysPending - 1 : prev.daysPending,
        };
      });
    } catch (err) {
      console.error("Error accepting day:", err);
      alert("Failed to accept. Please try again.");
    } finally {
      setSubmitting(null);
    }
  };

  const handleDispute = async (dateStr: string) => {
    if (!disputeText.trim()) return;

    setSubmitting(dateStr);
    try {
      const response = await fetch("/api/finance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: dateStr,
          action: "dispute",
          disputeText: disputeText.trim(),
          year: currentYear,
          month: currentMonth,
          half: selectedHalf,
        }),
      });

      if (!response.ok) throw new Error("Failed to dispute");

      const data = await response.json();
      setReviews((prev) => ({ ...prev, [dateStr]: data.review }));
      setDisputeDay(null);
      setDisputeText("");
      // Update summary counts
      setSummary((prev) => {
        if (!prev) return prev;
        const wasAccepted = reviews[dateStr]?.status === "accepted";
        const wasPending = !reviews[dateStr] || reviews[dateStr]?.status === "pending";
        return {
          ...prev,
          daysDisputed: prev.daysDisputed + 1,
          daysAccepted: wasAccepted ? prev.daysAccepted - 1 : prev.daysAccepted,
          daysPending: wasPending ? prev.daysPending - 1 : prev.daysPending,
        };
      });
    } catch (err) {
      console.error("Error disputing day:", err);
      alert("Failed to submit dispute. Please try again.");
    } finally {
      setSubmitting(null);
    }
  };

  // Group entries by date
  const entriesByDate = entries.reduce(
    (acc, entry) => {
      const dateKey = entry.startingOn.toISOString().split("T")[0];
      if (!acc[dateKey]) {
        acc[dateKey] = [];
      }
      acc[dateKey].push(entry);
      return acc;
    },
    {} as Record<string, ScheduleEntry[]>
  );

  const sortedDates = Object.keys(entriesByDate).sort();

  const getStatusBadge = (status: FinanceReviewStatus | undefined) => {
    switch (status) {
      case "accepted":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
            Accepted
          </span>
        );
      case "disputed":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            Disputed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                clipRule="evenodd"
              />
            </svg>
            Pending Review
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-12 bg-gray-200 rounded-lg" />
        <div className="h-10 bg-gray-100 rounded-lg" />
        <div className="h-32 bg-gray-100 rounded-xl" />
        <div className="h-48 bg-gray-100 rounded-xl" />
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
            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <h2 className="text-xl font-semibold text-dark mb-2">Finance Not Set Up</h2>
        <p className="text-gray-500 max-w-md mx-auto">
          Your schedule data isn&apos;t available yet. Contact your producer or manager to get set up
          in the scheduling system.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 mb-4">Unable to load finance data</p>
        <button
          onClick={() => fetchData()}
          className="text-accent font-medium hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            onClick={goToPreviousMonth}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Previous month"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>

          <h2 className="text-base sm:text-xl font-semibold text-dark min-w-[120px] sm:min-w-[180px] text-center">
            {MONTH_NAMES[currentMonth]} {currentYear}
          </h2>

          <button
            onClick={goToNextMonth}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Next month"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        </div>

        <button
          onClick={goToCurrentPayCycle}
          className="px-3 py-1.5 text-sm font-medium text-primary border border-primary rounded-lg hover:bg-primary hover:text-white transition-colors"
        >
          Current
        </button>
      </div>

      {/* Pay period toggle */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
        <button
          onClick={() => setSelectedHalf(1)}
          className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
            selectedHalf === 1
              ? "bg-white text-primary shadow-sm"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          1st - 15th
        </button>
        <button
          onClick={() => setSelectedHalf(2)}
          className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
            selectedHalf === 2
              ? "bg-white text-primary shadow-sm"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          16th - {new Date(currentYear, currentMonth + 1, 0).getDate()}
          {currentMonth === 1 ? "th" : "st"}
        </button>
      </div>

      {/* Pay cycle summary */}
      {summary && summary.daysWorked > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
              Pay Period Summary
            </h3>
            <span className="text-xs text-gray-400">
              {getPayCycleLabel(currentYear, currentMonth, selectedHalf)}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <div className="text-2xl sm:text-3xl font-bold text-dark">
                {summary.totalHours}
              </div>
              <div className="text-sm text-gray-500">Hours</div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-bold text-primary">
                ${summary.totalPay.toLocaleString()}
              </div>
              <div className="text-sm text-gray-500">Total Pay</div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-bold text-green-600">
                {summary.daysAccepted}
              </div>
              <div className="text-sm text-gray-500">Accepted</div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-bold text-gray-400">
                {summary.daysPending}
              </div>
              <div className="text-sm text-gray-500">Pending</div>
            </div>
          </div>
          {summary.daysDisputed > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <span className="text-sm text-red-600 font-medium">
                {summary.daysDisputed} day{summary.daysDisputed !== 1 ? "s" : ""} disputed
              </span>
            </div>
          )}
        </div>
      )}

      {/* Day cards */}
      {sortedDates.length === 0 ? (
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
              d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-lg font-medium">No shifts this pay period</p>
          <p className="text-sm mt-1">Check other pay periods or months</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedDates.map((dateKey) => {
            const dayEntries = entriesByDate[dateKey];
            const date = new Date(dateKey + "T00:00:00");
            const review = reviews[dateKey];

            // Calculate day totals
            const dayHours = dayEntries.reduce((sum, e) => {
              return sum + (e.endingOn.getTime() - e.startingOn.getTime()) / (1000 * 60 * 60);
            }, 0);
            const dayPay = dayHours * HOURLY_RATE;

            return (
              <div
                key={dateKey}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden"
              >
                {/* Date header */}
                <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-primary">
                          {date.getDate()}
                        </div>
                        <div className="text-xs uppercase text-gray-500">
                          {DAY_NAMES_FULL[date.getDay()].slice(0, 3)}
                        </div>
                      </div>
                      <div>
                        <div className="font-medium text-dark">
                          {DAY_NAMES_FULL[date.getDay()]}
                        </div>
                        <div className="text-sm text-gray-500">
                          {date.toLocaleDateString("en-US", {
                            month: "long",
                            year: "numeric",
                          })}
                        </div>
                      </div>
                    </div>
                    {getStatusBadge(review?.status)}
                  </div>
                </div>

                {/* Shift entries */}
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
                      </div>
                      <div className="text-sm font-semibold text-dark flex-shrink-0">
                        ${HOURLY_RATE}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Day summary + actions */}
                <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="text-sm font-medium text-gray-700">
                      {dayHours} hour{dayHours !== 1 ? "s" : ""} &mdash;{" "}
                      <span className="text-primary font-semibold">${dayPay.toLocaleString()}</span>
                    </div>

                    {/* Action buttons */}
                    {review?.status !== "accepted" && review?.status !== "disputed" && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleAccept(dateKey)}
                          disabled={submitting === dateKey}
                          className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                        >
                          {submitting === dateKey ? "..." : "Accept"}
                        </button>
                        <button
                          onClick={() => {
                            setDisputeDay(disputeDay === dateKey ? null : dateKey);
                            setDisputeText("");
                          }}
                          disabled={submitting === dateKey}
                          className="px-3 py-1.5 text-sm font-medium text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                        >
                          Dispute
                        </button>
                      </div>
                    )}

                    {/* Show dispute text if already disputed */}
                    {review?.status === "disputed" && review.disputeText && (
                      <div className="w-full mt-2 p-2 bg-red-50 rounded-lg border border-red-100">
                        <p className="text-sm text-red-700">{review.disputeText}</p>
                      </div>
                    )}
                  </div>

                  {/* Dispute textarea */}
                  {disputeDay === dateKey && (
                    <div className="mt-3 space-y-2">
                      <textarea
                        value={disputeText}
                        onChange={(e) => setDisputeText(e.target.value)}
                        placeholder="Describe the issue with this day's pay..."
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary resize-none"
                        rows={3}
                        autoFocus
                      />
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => {
                            setDisputeDay(null);
                            setDisputeText("");
                          }}
                          className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleDispute(dateKey)}
                          disabled={!disputeText.trim() || submitting === dateKey}
                          className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                        >
                          {submitting === dateKey ? "Submitting..." : "Submit Dispute"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
