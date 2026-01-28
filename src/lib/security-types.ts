// Security management types for dynamic role-based permissions
import { UserRole } from "./types";

// A single permission entry: read and/or write access
export interface PermissionEntry {
  read: boolean;
  write: boolean;
}

// All permission feature keys
export type PermissionKey =
  | "dashboard"
  | "messages"
  | "availability"
  | "training"
  | "schedule"
  | "finance"
  | "profile"
  | "directory"
  | "manageUsers"
  | "callOuts"
  | "hostPriority"
  | "hostAvailability"
  | "availabilityChangelog"
  | "calendarSync"
  | "broadcasts"
  | "trainingContent"
  | "locations"
  | "analytics";

// Viewing group categories (cosmetic only)
export type RoleDisplayGroup = "Hosts" | "Producers" | "Management" | "Support";

// DynamoDB record for a role's permissions
export interface RolePermissionRecord {
  role: string;
  permissions: Record<PermissionKey, PermissionEntry>;
  displayGroup: RoleDisplayGroup;
  updatedAt: string;
  updatedBy: string;
  updatedByName: string;
}

// Feature definition for the UI matrix
export interface PermissionFeature {
  key: PermissionKey;
  label: string;
  readLabel: string;
  writeLabel: string;
  readOnly: boolean; // If true, write column is disabled
  section: "user" | "admin";
}

// All permission features displayed in the matrix
export const PERMISSION_FEATURES: PermissionFeature[] = [
  // User Features
  { key: "dashboard", label: "Dashboard", readLabel: "View", writeLabel: "", readOnly: true, section: "user" },
  { key: "messages", label: "Messages", readLabel: "View messages", writeLabel: "", readOnly: true, section: "user" },
  { key: "availability", label: "Availability", readLabel: "View own", writeLabel: "Edit own", readOnly: false, section: "user" },
  { key: "training", label: "Training", readLabel: "View courses", writeLabel: "", readOnly: true, section: "user" },
  { key: "schedule", label: "Schedule", readLabel: "View schedule", writeLabel: "", readOnly: true, section: "user" },
  { key: "finance", label: "Finance", readLabel: "View pay review", writeLabel: "Accept/dispute", readOnly: false, section: "user" },
  { key: "profile", label: "Profile", readLabel: "View", writeLabel: "Edit", readOnly: false, section: "user" },
  { key: "directory", label: "Directory", readLabel: "View", writeLabel: "", readOnly: true, section: "user" },

  // Admin Features
  { key: "manageUsers", label: "Manage Users", readLabel: "View list", writeLabel: "Edit/approve/reject", readOnly: false, section: "admin" },
  { key: "callOuts", label: "Call Outs", readLabel: "View", writeLabel: "Approve/deny", readOnly: false, section: "admin" },
  { key: "hostPriority", label: "Host Priority", readLabel: "View", writeLabel: "Set priority", readOnly: false, section: "admin" },
  { key: "hostAvailability", label: "Host Availability", readLabel: "View all", writeLabel: "Edit", readOnly: false, section: "admin" },
  { key: "availabilityChangelog", label: "Avail. Changelog", readLabel: "View log", writeLabel: "", readOnly: true, section: "admin" },
  { key: "calendarSync", label: "Calendar Sync", readLabel: "View config", writeLabel: "Trigger sync", readOnly: false, section: "admin" },
  { key: "broadcasts", label: "Broadcasts", readLabel: "View", writeLabel: "Create/send", readOnly: false, section: "admin" },
  { key: "trainingContent", label: "Training Content", readLabel: "View admin", writeLabel: "Create/edit", readOnly: false, section: "admin" },
  { key: "locations", label: "Locations", readLabel: "View", writeLabel: "Add/edit/delete", readOnly: false, section: "admin" },
  { key: "analytics", label: "Analytics", readLabel: "View", writeLabel: "", readOnly: true, section: "admin" },
];

// Display groups available for assignment
export const DISPLAY_GROUPS: RoleDisplayGroup[] = ["Hosts", "Producers", "Management", "Support"];

// Default display group assignments
export const DEFAULT_DISPLAY_GROUPS: Record<string, RoleDisplayGroup> = {
  host: "Hosts",
  producer: "Producers",
  talent: "Management",
  admin: "Management",
  owner: "Management",
  finance: "Support",
  hr: "Support",
};

// Roles that can be edited on the security page (owner is always full access, applicant/rejected are excluded)
export const EDITABLE_ROLES: UserRole[] = ["host", "producer", "talent", "finance", "hr", "admin"];

// Roles shown but not editable
export const LOCKED_ROLES: UserRole[] = ["owner"];
