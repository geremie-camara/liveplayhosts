"use client";

import { useState, useEffect } from "react";
import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { Host, HOST_STATUS_CONFIG } from "@/lib/types";
import { ROLE_NAMES, ROLE_COLORS, Role } from "@/lib/roles";

type Tab = "active" | "applicants" | "pending";

export default function AdminUsersPage() {
  const [hosts, setHosts] = useState<Host[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("active");
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [addingHost, setAddingHost] = useState(false);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [newHost, setNewHost] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    role: "trainee" as Role,
  });

  useEffect(() => {
    fetchHosts();
  }, [activeTab, roleFilter, search]);

  async function fetchHosts() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      // Map tab to status filter
      if (activeTab === "active") params.set("status", "active");
      else if (activeTab === "applicants") params.set("status", "applicant");
      else if (activeTab === "pending") params.set("status", "invited");

      if (roleFilter) params.set("role", roleFilter);
      if (search) params.set("search", search);

      const response = await fetch(`/api/hosts?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setHosts(data);
        // Fetch signed URLs for headshots
        fetchSignedUrls(data);
      }
    } catch (error) {
      console.error("Error fetching hosts:", error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchSignedUrls(hostList: Host[]) {
    const urls: Record<string, string> = {};
    await Promise.all(
      hostList
        .filter((h) => h.headshotUrl)
        .map(async (h) => {
          try {
            const response = await fetch(
              `/api/upload-url?viewUrl=${encodeURIComponent(h.headshotUrl!)}`
            );
            if (response.ok) {
              const data = await response.json();
              urls[h.id] = data.signedUrl;
            }
          } catch (err) {
            console.error("Failed to get signed URL for", h.id);
          }
        })
    );
    setSignedUrls(urls);
  }

  async function handleAddHost(e: React.FormEvent) {
    e.preventDefault();
    setAddingHost(true);
    try {
      const response = await fetch("/api/hosts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newHost,
          status: "active",
        }),
      });
      if (response.ok) {
        setShowAddModal(false);
        setNewHost({
          firstName: "",
          lastName: "",
          email: "",
          phone: "",
          role: "trainee",
        });
        fetchHosts();
      } else {
        const data = await response.json();
        alert(data.error || "Failed to add host");
      }
    } catch (error) {
      console.error("Error adding host:", error);
      alert("Failed to add host");
    } finally {
      setAddingHost(false);
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
        const data = await response.json();
        if (data.message) {
          alert(data.message);
        }
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
              View and manage all users.
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-accent text-white font-medium rounded-lg hover:bg-accent-600 transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add User
          </button>
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex gap-8">
              <button
                onClick={() => setActiveTab("active")}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === "active"
                    ? "border-accent text-accent"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                Active Users
              </button>
              <button
                onClick={() => setActiveTab("applicants")}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === "applicants"
                    ? "border-accent text-accent"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                Applicants
              </button>
              <button
                onClick={() => setActiveTab("pending")}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === "pending"
                    ? "border-accent text-accent"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                Pending
              </button>
            </nav>
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
                          {host.headshotUrl && signedUrls[host.id] ? (
                            <img
                              src={signedUrls[host.id]}
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

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-primary">Add New User</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleAddHost} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    First Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newHost.firstName}
                    onChange={(e) => setNewHost({ ...newHost, firstName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newHost.lastName}
                    onChange={(e) => setNewHost({ ...newHost, lastName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={newHost.email}
                  onChange={(e) => setNewHost({ ...newHost, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  value={newHost.phone}
                  onChange={(e) => setNewHost({ ...newHost, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role
                </label>
                <select
                  value={newHost.role}
                  onChange={(e) => setNewHost({ ...newHost, role: e.target.value as Role })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  <option value="trainee">Trainee</option>
                  <option value="host">Host</option>
                  <option value="senior_host">Senior Host</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingHost}
                  className="flex-1 px-4 py-2 bg-accent text-white font-medium rounded-lg hover:bg-accent-600 transition-colors disabled:opacity-50"
                >
                  {addingHost ? "Adding..." : "Add User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
