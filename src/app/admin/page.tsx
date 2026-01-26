"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface DashboardCounts {
  applicants: number;
  hosts: number;
  producers: number;
  management: number;
  total: number;
}

export default function AdminPage() {
  const [counts, setCounts] = useState<DashboardCounts>({
    applicants: 0,
    hosts: 0,
    producers: 0,
    management: 0,
    total: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCounts();
  }, []);

  async function fetchCounts() {
    try {
      const response = await fetch("/api/hosts?countOnly=true");
      if (response.ok) {
        const hosts = await response.json();
        const newCounts: DashboardCounts = {
          applicants: 0,
          hosts: 0,
          producers: 0,
          management: 0,
          total: hosts.length,
        };

        hosts.forEach((host: { role: string }) => {
          if (host.role === "applicant") {
            newCounts.applicants++;
          } else if (host.role === "host") {
            newCounts.hosts++;
          } else if (host.role === "producer") {
            newCounts.producers++;
          } else if (["talent", "admin", "owner", "finance", "hr"].includes(host.role)) {
            newCounts.management++;
          }
        });

        setCounts(newCounts);
      }
    } catch (error) {
      console.error("Error fetching counts:", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-primary">Admin Dashboard</h1>
        <p className="text-gray-600 mt-2">
          Manage users, applicants, and system settings.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid md:grid-cols-4 gap-6 mb-8">
        <Link
          href="/admin/users?tab=applicants"
          className="bg-white rounded-2xl shadow-sm p-6 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center justify-between">
            <div className={`text-3xl font-bold ${counts.applicants > 0 ? "text-red-600" : "text-gray-400"}`}>
              {loading ? "..." : counts.applicants}
            </div>
            {counts.applicants > 0 && (
              <span className="px-3 py-1 text-sm font-bold bg-red-500 text-white rounded-full animate-pulse">
                Action Needed
              </span>
            )}
          </div>
          <div className="text-gray-600 mt-1">Pending Applicants</div>
        </Link>
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="text-3xl font-bold text-green-600">
            {loading ? "..." : counts.hosts}
          </div>
          <div className="text-gray-600 mt-1">Active Hosts</div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="text-3xl font-bold text-purple-600">
            {loading ? "..." : counts.producers}
          </div>
          <div className="text-gray-600 mt-1">Producers</div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="text-3xl font-bold text-primary">
            {loading ? "..." : counts.total}
          </div>
          <div className="text-gray-600 mt-1">Total Users</div>
        </div>
      </div>

      {/* Admin Actions */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Link
          href="/admin/users"
          className="bg-white rounded-2xl shadow-sm p-6 hover:shadow-md transition-shadow"
        >
          <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center mb-4">
            <svg
              className="w-6 h-6 text-primary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-dark">Manage Users</h3>
          <p className="text-gray-600 mt-1">
            View, edit, and manage user accounts and applicants.
          </p>
        </Link>

        <Link
          href="/admin/users?tab=applicants"
          className="bg-white rounded-2xl shadow-sm p-6 hover:shadow-md transition-shadow relative"
        >
          {counts.applicants > 0 && (
            <span className="absolute top-4 right-4 px-2.5 py-1 text-xs font-bold bg-red-500 text-white rounded-full">
              {counts.applicants}
            </span>
          )}
          <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center mb-4">
            <svg
              className="w-6 h-6 text-yellow-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-dark">Review Applications</h3>
          <p className="text-gray-600 mt-1">
            Review pending applications and approve or reject.
          </p>
        </Link>

        <Link
          href="/admin/broadcasts"
          className="bg-white rounded-2xl shadow-sm p-6 hover:shadow-md transition-shadow"
        >
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
            <svg
              className="w-6 h-6 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-dark">Broadcasts</h3>
          <p className="text-gray-600 mt-1">
            Send messages via Slack, Email, and SMS.
          </p>
        </Link>

        <Link
          href="/admin/training"
          className="bg-white rounded-2xl shadow-sm p-6 hover:shadow-md transition-shadow"
        >
          <div className="w-12 h-12 bg-accent-100 rounded-xl flex items-center justify-center mb-4">
            <svg
              className="w-6 h-6 text-accent"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-dark">Training Content</h3>
          <p className="text-gray-600 mt-1">
            Manage courses, lessons, and training materials.
          </p>
        </Link>

        <Link
          href="/admin/locations"
          className="bg-white rounded-2xl shadow-sm p-6 hover:shadow-md transition-shadow"
        >
          <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mb-4">
            <svg
              className="w-6 h-6 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-dark">Locations</h3>
          <p className="text-gray-600 mt-1">
            Manage location tags for user filtering.
          </p>
        </Link>

        <div className="bg-white rounded-2xl shadow-sm p-6 opacity-50 cursor-not-allowed">
          <div className="w-12 h-12 bg-secondary-100 rounded-xl flex items-center justify-center mb-4">
            <svg
              className="w-6 h-6 text-secondary-700"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-dark">Analytics</h3>
          <p className="text-gray-600 mt-1">
            View performance metrics and reports. (Coming soon)
          </p>
        </div>
      </div>
    </>
  );
}
