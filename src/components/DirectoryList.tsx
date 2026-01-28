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

interface TabCounts {
  all: number;
  hosts: number;
  producers: number;
  management: number;
}

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
  const [counts, setCounts] = useState<TabCounts>({
    all: 0,
    hosts: 0,
    producers: 0,
    management: 0,
  });

  useEffect(() => {
    fetchCounts();
  }, []);

  useEffect(() => {
    fetchHosts();
  }, [activeTab, search]);

  async function fetchCounts() {
    try {
      // Fetch all active users to count
      const response = await fetch("/api/directory");
      if (response.ok) {
        const allHosts: DirectoryHost[] = await response.json();
        const newCounts: TabCounts = {
          all: allHosts.length,
          hosts: 0,
          producers: 0,
          management: 0,
        };

        allHosts.forEach((host) => {
          if (host.role === "host") {
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
    }
  }

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
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap flex items-center gap-2 ${
                activeTab === "all"
                  ? "border-accent text-accent"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              All
              <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">
                {counts.all}
              </span>
            </button>
            <button
              onClick={() => setActiveTab("hosts")}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap flex items-center gap-2 ${
                activeTab === "hosts"
                  ? "border-accent text-accent"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Hosts
              <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">
                {counts.hosts}
              </span>
            </button>
            <button
              onClick={() => setActiveTab("producers")}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap flex items-center gap-2 ${
                activeTab === "producers"
                  ? "border-accent text-accent"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Producers
              <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">
                {counts.producers}
              </span>
            </button>
            <button
              onClick={() => setActiveTab("management")}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap flex items-center gap-2 ${
                activeTab === "management"
                  ? "border-accent text-accent"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Management
              <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">
                {counts.management}
              </span>
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

      {/* Directory Content */}
      {loading ? (
        <div className="bg-white rounded-2xl shadow-sm p-8 text-center text-gray-500">Loading...</div>
      ) : hosts.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-8 text-center text-gray-500">No team members found.</div>
      ) : (
        <>
          {/* Mobile: Card View */}
          <div className="md:hidden space-y-4">
            {hosts.map((host) => (
              <div key={host.id} className="bg-white rounded-2xl shadow-sm p-4">
                {/* Header: Avatar + Name + Location */}
                <div className="flex items-start gap-3 mb-3">
                  {signedUrls[host.id] ? (
                    <img
                      src={signedUrls[host.id]}
                      alt={`${host.firstName} ${host.lastName}`}
                      className="w-14 h-14 rounded-full object-cover flex-shrink-0"
                    />
                  ) : host.headshotExternalUrl ? (
                    <img
                      src={host.headshotExternalUrl}
                      alt={`${host.firstName} ${host.lastName}`}
                      className="w-14 h-14 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                      <span className="text-gray-500 text-lg font-medium">
                        {host.firstName?.charAt(0)}{host.lastName?.charAt(0)}
                      </span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-dark text-lg">
                      {host.firstName} {host.lastName}
                    </h3>
                    {host.location && (
                      <p className="text-sm text-gray-500">{host.location}</p>
                    )}
                  </div>
                </div>

                {/* Contact Info */}
                <div className="space-y-2 mb-3">
                  {host.phone && (
                    <a
                      href={`tel:${host.phone.replace(/\D/g, "")}`}
                      className="flex items-center gap-2 text-sm text-accent"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      {formatPhone(host.phone)}
                    </a>
                  )}
                  <a
                    href={`mailto:${host.email}`}
                    className="flex items-center gap-2 text-sm text-accent truncate"
                  >
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span className="truncate">{host.email}</span>
                  </a>
                </div>

                {/* Social Links */}
                {(host.socialProfiles?.instagram || host.socialProfiles?.tiktok) && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {host.socialProfiles?.instagram && (
                      <a
                        href={`https://instagram.com/${host.socialProfiles.instagram.replace('@', '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded"
                      >
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                        </svg>
                        {host.socialProfiles.instagram}
                      </a>
                    )}
                    {host.socialProfiles?.tiktok && (
                      <a
                        href={`https://tiktok.com/${host.socialProfiles.tiktok.replace('@', '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-black text-white rounded"
                      >
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z"/>
                        </svg>
                        {host.socialProfiles.tiktok}
                      </a>
                    )}
                  </div>
                )}

                {/* Communication Buttons */}
                <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-100">
                  {host.slackId && (
                    <a
                      href={`https://slack.com/app_redirect?team=TN9K8GS6A&channel=${host.slackId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 min-w-[70px] px-3 py-2 text-sm font-medium text-white bg-accent rounded-lg text-center"
                    >
                      Slack DM
                    </a>
                  )}
                  {host.slackChannelId && (
                    <a
                      href={`https://slack.com/app_redirect?team=TN9K8GS6A&channel=${host.slackChannelId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 min-w-[70px] px-3 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg text-center"
                    >
                      Prod
                    </a>
                  )}
                  {host.phone && (
                    <a
                      href={`https://wa.me/${host.phone.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 min-w-[70px] px-3 py-2 text-sm font-medium text-white bg-green-500 rounded-lg text-center"
                    >
                      WhatsApp
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: Table View */}
          <div className="hidden md:block bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-4 text-left text-sm font-semibold text-gray-600 w-16"></th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">First Name</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Last Name</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Email</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Communication</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Instagram</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">TikTok</th>
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
                      <td className="px-6 py-4 text-gray-600">
                        {host.location || <span className="text-gray-400">-</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  );
}
