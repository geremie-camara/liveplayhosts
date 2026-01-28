"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface ImpersonationBannerProps {
  hostName: string;
  hostEmail: string;
  hostRole: string;
}

export default function ImpersonationBanner({
  hostName,
  hostEmail,
  hostRole,
}: ImpersonationBannerProps) {
  const router = useRouter();
  const [stopping, setStopping] = useState(false);

  async function handleStop() {
    setStopping(true);
    try {
      await fetch("/api/admin/impersonate", { method: "DELETE" });
      window.location.href = "/admin/users";
    } catch (error) {
      console.error("Failed to stop impersonation:", error);
      setStopping(false);
    }
  }

  return (
    <div className="bg-amber-500 text-white px-4 py-2 flex items-center justify-between gap-4 text-sm z-[60] relative">
      <div className="flex items-center gap-2 min-w-0">
        <svg
          className="w-4 h-4 flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
          />
        </svg>
        <span className="truncate">
          Viewing as <strong>{hostName}</strong> ({hostEmail}) &mdash;{" "}
          <span className="capitalize">{hostRole}</span>
        </span>
      </div>
      <button
        onClick={handleStop}
        disabled={stopping}
        className="flex-shrink-0 px-3 py-1 bg-white text-amber-700 font-medium rounded hover:bg-amber-100 transition-colors disabled:opacity-50"
      >
        {stopping ? "Stopping..." : "Stop Viewing"}
      </button>
    </div>
  );
}
