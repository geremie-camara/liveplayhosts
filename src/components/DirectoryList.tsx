"use client";

import { useState, useEffect } from "react";
import { UserRole } from "@/lib/types";

interface DirectoryHost {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  location?: string;
  role: UserRole;
  slackId?: string;
  slackChannelId?: string;
  socialProfiles: {
    instagram?: string;
    tiktok?: string;
  };
  headshotUrl?: string;
  headshotExternalUrl?: string;
}

type Tab = "all" | "hosts" | "producers" | "management";

function formatPhone(phone: string): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits[0] === "1") {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return phone;
}

export default function DirectoryList() {
  const [hosts, setHosts] = useState<DirectoryHost[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchHosts();
  }, [activeTab, search]);

  async function fetchHosts() {
    setLoading(true);
    try {
      const params = new URLSearchParams();

      if (activeTab === "all") {
        // All active users (excludes applicants and rejected - handled by API)
      } else if (activeTab === "hosts") {
        params.set("role", "host");
      } else if (activeTab === "producers") {
        params.set("role", "producer");
      } else if (activeTab === "management") {
        params.set("roles", "talent,hr,admin,owner,finance");
      }

      if (search) params.set("search", search);

      const response = await fetch(`/api/directory?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        const sorted = data.sort((a: DirectoryHost, b: DirectoryHost) => {
          const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
          const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
          return nameA.localeCompare(nameB);
        });
        setHosts(sorted);
        fetchSignedUrls(sorted);
      }
    } catch (error) {
      console.error("Error fetching directory:", error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchSignedUrls(hostList: DirectoryHost[]) {
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

  return (
    <>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-primary">Directory</h1>
        <p className="text-gray-600 mt-1">
          View all team members
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex gap-6 overflow-x-auto">
            <button
              onClick={() => setActiveTab("all")}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                activeTab === "all"
                  ? "border-accent text-accent"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setActiveTab("hosts")}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                activeTab === "hosts"
                  ? "border-accent text-accent"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Hosts
            </button>
            <button
              onClick={() => setActiveTab("producers")}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                activeTab === "producers"
                  ? "border-accent text-accent"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Producers
            </button>
            <button
              onClick={() => setActiveTab("management")}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                activeTab === "management"
                  ? "border-accent text-accent"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Management
            </button>
          </nav>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-2xl shadow-sm p-4 mb-6">
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
        />
      </div>

      {/* Directory Table */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : hosts.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No team members found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-4 text-left text-sm font-semibold text-gray-600 w-16"></th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">First Name</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Last Name</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Email</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Instagram</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">TikTok</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Communication</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Location</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {hosts.map((host) => (
                  <tr key={host.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      {signedUrls[host.id] ? (
                        <img
                          src={signedUrls[host.id]}
                          alt={`${host.firstName} ${host.lastName}`}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : host.headshotExternalUrl ? (
                        <img
                          src={host.headshotExternalUrl}
                          alt={`${host.firstName} ${host.lastName}`}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                          <span className="text-gray-500 text-sm font-medium">
                            {host.firstName?.charAt(0)}{host.lastName?.charAt(0)}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-dark">{host.firstName}</div>
                      {host.phone && (
                        <a href={`tel:${host.phone.replace(/\D/g, "")}`} className="text-sm text-accent underline">
                          {formatPhone(host.phone)}
                        </a>
                      )}
                    </td>
                    <td className="px-6 py-4 text-dark">{host.lastName}</td>
                    <td className="px-6 py-4">
                      <a href={`mailto:${host.email}`} className="text-accent underline">
                        {host.email}
                      </a>
                    </td>
                    <td className="px-6 py-4">
                      {host.socialProfiles?.instagram ? (
                        <a
                          href={`https://instagram.com/${host.socialProfiles.instagram.replace('@', '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-accent underline"
                        >
                          {host.socialProfiles.instagram}
                        </a>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {host.socialProfiles?.tiktok ? (
                        <a
                          href={`https://tiktok.com/${host.socialProfiles.tiktok.replace('@', '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-accent underline"
                        >
                          {host.socialProfiles.tiktok}
                        </a>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {host.slackId ? (
                          <a
                            href={`https://slack.com/app_redirect?team=TN9K8GS6A&channel=${host.slackId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-1 text-xs font-medium text-white bg-accent rounded hover:bg-accent-600 transition-colors"
                            title="Open DM in Slack"
                          >
                            DM
                          </a>
                        ) : (
                          <span className="text-gray-400 text-sm">-</span>
                        )}
                        {host.slackChannelId ? (
                          <a
                            href={`https://slack.com/app_redirect?team=TN9K8GS6A&channel=${host.slackChannelId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-1 text-xs font-medium text-white bg-purple-600 rounded hover:bg-purple-700 transition-colors"
                            title="Open Prod Channel in Slack"
                          >
                            Prod
                          </a>
                        ) : (
                          <span className="text-gray-400 text-sm">-</span>
                        )}
                        {host.phone ? (
                          <a
                            href={`https://wa.me/${host.phone.replace(/\D/g, "")}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-1 text-xs font-medium text-white bg-green-500 rounded hover:bg-green-600 transition-colors"
                            title="Message on WhatsApp"
                          >
                            WA
                          </a>
                        ) : (
                          <span className="text-gray-400 text-sm">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {host.location || <span className="text-gray-400">-</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
