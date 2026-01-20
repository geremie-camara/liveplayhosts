"use client";

import { useState, useEffect } from "react";
import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { Host, HOST_STATUS_CONFIG } from "@/lib/types";
import { ROLE_NAMES, ROLE_COLORS } from "@/lib/roles";

export default function AdminUsersPage() {
  const [hosts, setHosts] = useState<Host[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchHosts();
  }, [statusFilter, roleFilter, search]);

  async function fetchHosts() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (roleFilter) params.set("role", roleFilter);
      if (search) params.set("search", search);

      const response = await fetch(`/api/hosts?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setHosts(data);
      }
    } catch (error) {
      console.error("Error fetching hosts:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleInvite(hostId: string) {
    try {
      const response = await fetch(`/api/hosts/${hostId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "invited" }),
      });
      if (response.ok) {
        fetchHosts();
      }
    } catch (error) {
      console.error("Error inviting host:", error);
    }
  }

  async function handleActivate(hostId: string) {
    try {
      const response = await fetch(`/api/hosts/${hostId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "active" }),
      });
      if (response.ok) {
        fetchHosts();
      }
    } catch (error) {
      console.error("Error activating host:", error);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <a href="/" className="flex items-center gap-2">
              <img src="/logo.png" alt="LivePlay Hosts" className="h-8 w-auto" />
            </a>
            <div className="flex items-center gap-4">
              <nav className="hidden md:flex items-center gap-6">
                <Link
                  href="/dashboard"
                  className="text-gray-600 font-medium hover:text-accent transition-colors"
                >
                  Dashboard
                </Link>
                <Link
                  href="/admin"
                  className="text-gray-600 font-medium hover:text-accent transition-colors"
                >
                  Admin
                </Link>
                <Link href="/admin/users" className="text-accent font-medium">
                  Users
                </Link>
              </nav>
              <UserButton afterSignOutUrl="/" />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-primary">Manage Users</h1>
            <p className="text-gray-600 mt-1">
              View and manage all hosts and applicants.
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-sm p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search by name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              />
            </div>
            <div className="flex gap-4">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              >
                <option value="">All Statuses</option>
                <option value="applicant">Applicants</option>
                <option value="invited">Invited</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              >
                <option value="">All Roles</option>
                <option value="trainee">Trainee</option>
                <option value="host">Host</option>
                <option value="senior_host">Senior Host</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading...</div>
          ) : hosts.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No users found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">
                      Name
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">
                      Email
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">
                      Role
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">
                      Applied
                    </th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-600">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {hosts.map((host) => (
                    <tr key={host.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {host.headshotUrl ? (
                            <img
                              src={host.headshotUrl}
                              alt={`${host.firstName} ${host.lastName}`}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                              <span className="text-gray-500 text-sm font-medium">
                                {host.firstName.charAt(0)}{host.lastName.charAt(0)}
                              </span>
                            </div>
                          )}
                          <div>
                            <div className="font-medium text-dark">
                              {host.firstName} {host.lastName}
                            </div>
                            <div className="text-sm text-gray-500">{host.phone}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-600">{host.email}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            HOST_STATUS_CONFIG[host.status].color
                          }`}
                        >
                          {HOST_STATUS_CONFIG[host.status].label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            ROLE_COLORS[host.role]
                          }`}
                        >
                          {ROLE_NAMES[host.role]}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(host.appliedAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {host.status === "applicant" && (
                            <button
                              onClick={() => handleInvite(host.id)}
                              className="px-3 py-1 text-sm font-medium text-white bg-accent rounded-lg hover:bg-accent-600 transition-colors"
                            >
                              Invite
                            </button>
                          )}
                          {host.status === "invited" && (
                            <button
                              onClick={() => handleActivate(host.id)}
                              className="px-3 py-1 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
                            >
                              Activate
                            </button>
                          )}
                          <Link
                            href={`/admin/users/${host.id}`}
                            className="px-3 py-1 text-sm font-medium text-primary border border-primary rounded-lg hover:bg-primary-50 transition-colors"
                          >
                            Edit
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
