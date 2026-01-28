"use client";

import { useState, useEffect, useCallback } from "react";
import {
  PERMISSION_FEATURES,
  DISPLAY_GROUPS,
  EDITABLE_ROLES,
  LOCKED_ROLES,
} from "@/lib/security-types";
import type {
  PermissionKey,
  PermissionEntry,
  RoleDisplayGroup,
  RolePermissionRecord,
} from "@/lib/security-types";
import { ROLE_NAMES } from "@/lib/roles";
import type { Role } from "@/lib/roles";

export default function SecurityPage() {
  const [records, setRecords] = useState<RolePermissionRecord[]>([]);
  const [selectedRole, setSelectedRole] = useState<string>(EDITABLE_ROLES[0]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Local edits for the currently selected role
  const [editPermissions, setEditPermissions] = useState<Record<PermissionKey, PermissionEntry>>({} as Record<PermissionKey, PermissionEntry>);
  const [editDisplayGroup, setEditDisplayGroup] = useState<RoleDisplayGroup>("Hosts");

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/security");
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setRecords(data.records || []);
    } catch {
      setFeedback({ type: "error", message: "Failed to load permissions" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // When records or selected role changes, populate edit state
  useEffect(() => {
    const record = records.find((r) => r.role === selectedRole);
    if (record) {
      setEditPermissions({ ...record.permissions });
      setEditDisplayGroup(record.displayGroup);
    }
  }, [records, selectedRole]);

  const isLocked = LOCKED_ROLES.includes(selectedRole as Role);

  const togglePermission = (key: PermissionKey, field: "read" | "write") => {
    if (isLocked) return;
    setEditPermissions((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: !prev[key]?.[field],
      },
    }));
  };

  const handleSave = async () => {
    if (isLocked) return;
    setSaving(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/admin/security", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: selectedRole,
          permissions: editPermissions,
          displayGroup: editDisplayGroup,
          updatedByName: "Owner", // The security page is owner-only
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Save failed");
      }

      setFeedback({ type: "success", message: `Permissions saved for ${ROLE_NAMES[selectedRole as Role] || selectedRole}` });
      // Refresh data
      await loadData();
    } catch (e) {
      setFeedback({ type: "error", message: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const allRoles = [...EDITABLE_ROLES, ...LOCKED_ROLES];
  const userFeatures = PERMISSION_FEATURES.filter((f) => f.section === "user");
  const adminFeatures = PERMISSION_FEATURES.filter((f) => f.section === "admin");

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Security Management</h1>
        <p className="mt-1 text-sm text-gray-500">
          Configure read/write permissions for each role across all features.
        </p>
      </div>

      {/* Feedback */}
      {feedback && (
        <div
          className={`p-3 rounded-lg text-sm ${
            feedback.type === "success"
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {feedback.message}
        </div>
      )}

      {/* Role Selector + Display Group */}
      <div className="bg-white rounded-lg border p-4 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Role
            </label>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
            >
              {allRoles.map((role) => (
                <option key={role} value={role}>
                  {ROLE_NAMES[role as Role] || role}
                  {LOCKED_ROLES.includes(role as Role) ? " (locked)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Viewing Group
            </label>
            <select
              value={editDisplayGroup}
              onChange={(e) => setEditDisplayGroup(e.target.value as RoleDisplayGroup)}
              disabled={isLocked}
              className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm disabled:opacity-50"
            >
              {DISPLAY_GROUPS.map((group) => (
                <option key={group} value={group}>
                  {group}
                </option>
              ))}
            </select>
          </div>
        </div>

        {isLocked && (
          <p className="text-sm text-indigo-600 font-medium">
            Owner role has full access to all features and cannot be modified.
          </p>
        )}
      </div>

      {/* Permission Matrix — Desktop Table */}
      <div className="hidden md:block space-y-6">
        <PermissionTable
          title="User Features"
          features={userFeatures}
          permissions={editPermissions}
          isLocked={isLocked}
          onToggle={togglePermission}
        />
        <PermissionTable
          title="Admin Features"
          features={adminFeatures}
          permissions={editPermissions}
          isLocked={isLocked}
          onToggle={togglePermission}
        />
      </div>

      {/* Permission Matrix — Mobile Cards */}
      <div className="md:hidden space-y-6">
        <PermissionCards
          title="User Features"
          features={userFeatures}
          permissions={editPermissions}
          isLocked={isLocked}
          onToggle={togglePermission}
        />
        <PermissionCards
          title="Admin Features"
          features={adminFeatures}
          permissions={editPermissions}
          isLocked={isLocked}
          onToggle={togglePermission}
        />
      </div>

      {/* Save Button */}
      {!isLocked && (
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
          >
            {saving ? "Saving..." : "Save Permissions"}
          </button>
        </div>
      )}
    </div>
  );
}

// Desktop table component for a section of features
function PermissionTable({
  title,
  features,
  permissions,
  isLocked,
  onToggle,
}: {
  title: string;
  features: typeof PERMISSION_FEATURES;
  permissions: Record<PermissionKey, PermissionEntry>;
  isLocked: boolean;
  onToggle: (key: PermissionKey, field: "read" | "write") => void;
}) {
  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      <div className="px-6 py-3 bg-gray-50 border-b">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
          {title}
        </h3>
      </div>
      <table className="w-full">
        <thead>
          <tr className="border-b bg-gray-50">
            <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">
              Feature
            </th>
            <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase w-32">
              Read
            </th>
            <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase w-32">
              Write
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {features.map((feature) => {
            const entry = permissions[feature.key];
            return (
              <tr key={feature.key} className="hover:bg-gray-50">
                <td className="px-6 py-3">
                  <div className="text-sm font-medium text-gray-900">
                    {feature.label}
                  </div>
                  <div className="text-xs text-gray-500">
                    {feature.readLabel}
                    {feature.writeLabel ? ` / ${feature.writeLabel}` : ""}
                  </div>
                </td>
                <td className="text-center px-4 py-3">
                  <input
                    type="checkbox"
                    checked={entry?.read ?? false}
                    onChange={() => onToggle(feature.key, "read")}
                    disabled={isLocked}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
                  />
                </td>
                <td className="text-center px-4 py-3">
                  {feature.readOnly ? (
                    <span className="text-xs text-gray-400">—</span>
                  ) : (
                    <input
                      type="checkbox"
                      checked={entry?.write ?? false}
                      onChange={() => onToggle(feature.key, "write")}
                      disabled={isLocked}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
                    />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Mobile card layout for a section of features
function PermissionCards({
  title,
  features,
  permissions,
  isLocked,
  onToggle,
}: {
  title: string;
  features: typeof PERMISSION_FEATURES;
  permissions: Record<PermissionKey, PermissionEntry>;
  isLocked: boolean;
  onToggle: (key: PermissionKey, field: "read" | "write") => void;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider px-1">
        {title}
      </h3>
      {features.map((feature) => {
        const entry = permissions[feature.key];
        return (
          <div key={feature.key} className="bg-white rounded-lg border p-4">
            <div className="text-sm font-medium text-gray-900 mb-1">
              {feature.label}
            </div>
            <div className="text-xs text-gray-500 mb-3">
              {feature.readLabel}
              {feature.writeLabel ? ` / ${feature.writeLabel}` : ""}
            </div>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2">
                <ToggleSwitch
                  checked={entry?.read ?? false}
                  onChange={() => onToggle(feature.key, "read")}
                  disabled={isLocked}
                />
                <span className="text-sm text-gray-600">Read</span>
              </label>
              {feature.readOnly ? (
                <span className="text-xs text-gray-400">Write: N/A</span>
              ) : (
                <label className="flex items-center gap-2">
                  <ToggleSwitch
                    checked={entry?.write ?? false}
                    onChange={() => onToggle(feature.key, "write")}
                    disabled={isLocked}
                  />
                  <span className="text-sm text-gray-600">Write</span>
                </label>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Simple toggle switch component
function ToggleSwitch({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
        checked ? "bg-indigo-600" : "bg-gray-200"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}
