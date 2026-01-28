"use client";

import { useState, useEffect } from "react";

interface SyncConfig {
  configured: {
    schedulerDb: boolean;
    googleCalendar: boolean;
    calendarMappings: boolean;
  };
  calendars: Array<{ studio: string; calendarId: string }>;
  ready: boolean;
  willUseMockData: boolean;
  envVarsNeeded: {
    googleCalendar: string[];
    calendarMappings: string[];
  };
}

interface SyncResult {
  message: string;
  synced: number;
  errors?: string[];
  dateRange?: { start: string; end: string };
  calendars?: string[];
  usingMockData?: boolean;
  hostsIncluded?: number;
  error?: string;
}

export default function CalendarSyncClient() {
  const [config, setConfig] = useState<SyncConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);

  // Sync options
  const [startDate, setStartDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const twoWeeks = new Date();
    twoWeeks.setDate(twoWeeks.getDate() + 14);
    return twoWeeks.toISOString().split("T")[0];
  });
  const [useMockData, setUseMockData] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  async function fetchConfig() {
    try {
      const response = await fetch("/api/admin/schedule/sync");
      if (response.ok) {
        const data = await response.json();
        setConfig(data);
        // Auto-enable mock data if scheduler DB not configured
        if (data.willUseMockData) {
          setUseMockData(true);
        }
      }
    } catch (error) {
      console.error("Error fetching config:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setResult(null);

    try {
      const response = await fetch("/api/admin/schedule/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: new Date(startDate).toISOString(),
          endDate: new Date(endDate).toISOString(),
          useMockData,
        }),
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({
        message: "Failed to sync",
        synced: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setSyncing(false);
    }
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
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-primary">Calendar Sync</h1>
        <p className="text-gray-600 mt-1 text-sm sm:text-base">
          Sync host schedules to Google Calendar
        </p>
      </div>

      {/* Configuration Status */}
      <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold text-dark mb-4">Configuration Status</h2>

        <div className="space-y-3">
          {/* Google Calendar API */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${config?.configured.googleCalendar ? "bg-green-500" : "bg-red-500"}`} />
              <span className="font-medium">Google Calendar API</span>
            </div>
            <span className={`text-sm ${config?.configured.googleCalendar ? "text-green-600" : "text-red-600"}`}>
              {config?.configured.googleCalendar ? "Connected" : "Not configured"}
            </span>
          </div>

          {/* Calendar Mappings */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${config?.configured.calendarMappings ? "bg-green-500" : "bg-red-500"}`} />
              <span className="font-medium">Calendar Mappings</span>
            </div>
            <span className={`text-sm ${config?.configured.calendarMappings ? "text-green-600" : "text-red-600"}`}>
              {config?.calendars?.length || 0} calendars
            </span>
          </div>

          {/* Scheduler Database */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${config?.configured.schedulerDb ? "bg-green-500" : "bg-yellow-500"}`} />
              <span className="font-medium">Scheduler Database</span>
            </div>
            <span className={`text-sm ${config?.configured.schedulerDb ? "text-green-600" : "text-yellow-600"}`}>
              {config?.configured.schedulerDb ? "Connected" : "Using mock data"}
            </span>
          </div>
        </div>

        {/* Calendar list */}
        {config?.calendars && config.calendars.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-sm font-medium text-gray-500 mb-2">Configured Calendars:</p>
            <div className="flex flex-wrap gap-2">
              {config.calendars.map((cal) => (
                <span
                  key={cal.studio}
                  className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                >
                  {cal.studio}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Missing configuration help */}
        {!config?.ready && (
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm font-medium text-yellow-800 mb-2">Missing Configuration:</p>
            <div className="text-sm text-yellow-700 space-y-1">
              {!config?.configured.googleCalendar && (
                <p>• Set <code className="bg-yellow-100 px-1 rounded">GOOGLE_SERVICE_ACCOUNT_EMAIL</code> and <code className="bg-yellow-100 px-1 rounded">GOOGLE_PRIVATE_KEY</code></p>
              )}
              {!config?.configured.calendarMappings && (
                <p>• Set <code className="bg-yellow-100 px-1 rounded">GOOGLE_CALENDAR_MAIN_ROOM</code>, <code className="bg-yellow-100 px-1 rounded">GOOGLE_CALENDAR_SPEED_BINGO</code>, <code className="bg-yellow-100 px-1 rounded">GOOGLE_CALENDAR_BREAK</code></p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Sync Controls */}
      <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold text-dark mb-4">Sync Schedules</h2>

        <div className="space-y-4">
          {/* Date Range */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
          </div>

          {/* Mock Data Toggle */}
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <input
              type="checkbox"
              id="useMockData"
              checked={useMockData}
              onChange={(e) => setUseMockData(e.target.checked)}
              disabled={config?.willUseMockData}
              className="w-5 h-5 rounded border-gray-300 text-accent focus:ring-accent"
            />
            <label htmlFor="useMockData" className="flex-1">
              <span className="font-medium text-dark">Use Mock Data</span>
              <p className="text-sm text-gray-500">
                Generate test schedules for hosts instead of using real scheduler database
              </p>
            </label>
          </div>

          {/* Sync Button */}
          <button
            onClick={handleSync}
            disabled={!config?.ready || syncing}
            className="w-full sm:w-auto px-6 py-3 bg-accent text-white font-medium rounded-lg hover:bg-accent-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {syncing ? (
              <>
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Syncing...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Sync to Google Calendar
              </>
            )}
          </button>
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className={`bg-white rounded-2xl shadow-sm p-6 ${result.error ? "border-2 border-red-200" : result.synced > 0 ? "border-2 border-green-200" : ""}`}>
          <h2 className="text-lg font-semibold text-dark mb-4">Sync Result</h2>

          {result.error ? (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 font-medium">Error: {result.error}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Success Message */}
              <div className={`p-4 rounded-lg ${result.synced > 0 ? "bg-green-50 border border-green-200" : "bg-gray-50 border border-gray-200"}`}>
                <p className={`font-medium ${result.synced > 0 ? "text-green-800" : "text-gray-800"}`}>
                  {result.message}
                </p>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-3 bg-gray-50 rounded-lg text-center">
                  <p className="text-2xl font-bold text-accent">{result.synced}</p>
                  <p className="text-sm text-gray-500">Events Synced</p>
                </div>
                {result.hostsIncluded && (
                  <div className="p-3 bg-gray-50 rounded-lg text-center">
                    <p className="text-2xl font-bold text-accent">{result.hostsIncluded}</p>
                    <p className="text-sm text-gray-500">Hosts Included</p>
                  </div>
                )}
                {result.calendars && (
                  <div className="p-3 bg-gray-50 rounded-lg text-center">
                    <p className="text-2xl font-bold text-accent">{result.calendars.length}</p>
                    <p className="text-sm text-gray-500">Calendars</p>
                  </div>
                )}
                {result.usingMockData !== undefined && (
                  <div className="p-3 bg-gray-50 rounded-lg text-center">
                    <p className="text-2xl font-bold text-accent">{result.usingMockData ? "Yes" : "No"}</p>
                    <p className="text-sm text-gray-500">Mock Data</p>
                  </div>
                )}
              </div>

              {/* Date Range */}
              {result.dateRange && (
                <div className="text-sm text-gray-500">
                  Date range: {new Date(result.dateRange.start).toLocaleDateString()} - {new Date(result.dateRange.end).toLocaleDateString()}
                </div>
              )}

              {/* Errors */}
              {result.errors && result.errors.length > 0 && (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="font-medium text-yellow-800 mb-2">Warnings ({result.errors.length}):</p>
                  <ul className="text-sm text-yellow-700 space-y-1 max-h-40 overflow-y-auto">
                    {result.errors.map((err, idx) => (
                      <li key={idx}>• {err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
