// Role definitions for LivePlay Hosts
// Import from types.ts for consistency
import { UserRole, ROLE_CONFIG } from "./types";

// Re-export for convenience
export type Role = UserRole;

// Role hierarchy (higher index = more permissions)
// applicant and rejected have no app access
export const ROLE_HIERARCHY: Role[] = ["applicant", "rejected", "host", "producer", "talent", "finance", "hr", "admin", "owner"];

// Roles that have dashboard access (approved users only)
export const ACTIVE_ROLES: Role[] = ["host", "producer", "talent", "finance", "hr", "admin", "owner"];

// Role display names
export const ROLE_NAMES: Record<Role, string> = {
  applicant: "Applicant",
  rejected: "Rejected",
  host: "Host",
  producer: "Producer",
  talent: "Talent",
  admin: "Admin",
  owner: "Owner",
  finance: "Finance",
  hr: "HR",
};

// Role colors for UI
export const ROLE_COLORS: Record<Role, string> = {
  applicant: "bg-yellow-100 text-yellow-800",
  rejected: "bg-red-100 text-red-800",
  host: "bg-green-100 text-green-800",
  producer: "bg-purple-100 text-purple-800",
  talent: "bg-pink-100 text-pink-800",
  admin: "bg-blue-100 text-blue-800",
  owner: "bg-indigo-100 text-indigo-800",
  finance: "bg-emerald-100 text-emerald-800",
  hr: "bg-orange-100 text-orange-800",
};

// Check if user has at least the required role level
export function hasRole(userRole: Role | undefined, requiredRole: Role): boolean {
  if (!userRole) return false;
  const userLevel = ROLE_HIERARCHY.indexOf(userRole);
  const requiredLevel = ROLE_HIERARCHY.indexOf(requiredRole);
  return userLevel >= requiredLevel;
}

// Check if user is admin or owner (talent has admin access for now)
export function isAdmin(userRole: Role | undefined): boolean {
  return userRole === "admin" || userRole === "owner" || userRole === "talent";
}

// Check if user has an active/approved role
export function isActiveUser(userRole: Role | undefined): boolean {
  return userRole ? ACTIVE_ROLES.includes(userRole) : false;
}

// Get user role from Clerk metadata
export function getUserRole(publicMetadata: Record<string, unknown> | undefined): Role {
  const role = publicMetadata?.role as Role | undefined;
  return role && ROLE_HIERARCHY.includes(role) ? role : "applicant";
}

// Permission definitions by feature
export const PERMISSIONS = {
  // Dashboard access (only active users)
  viewDashboard: ["host", "producer", "talent", "finance", "hr", "admin", "owner"] as Role[],

  // Training access
  viewBasicTraining: ["host", "producer", "talent", "finance", "hr", "admin", "owner"] as Role[],
  viewAdvancedTraining: ["host", "producer", "talent", "finance", "hr", "admin", "owner"] as Role[],
  viewAllTraining: ["talent", "admin", "owner"] as Role[],

  // Training management (admin)
  manageTraining: ["talent", "admin", "owner"] as Role[],
  viewTrainingAnalytics: ["producer", "talent", "finance", "hr", "admin", "owner"] as Role[],

  // Schedule access
  viewSchedule: ["host", "producer", "talent", "finance", "hr", "admin", "owner"] as Role[],
  manageSchedule: ["producer", "talent", "admin", "owner"] as Role[],

  // Admin features
  manageUsers: ["talent", "hr", "admin", "owner"] as Role[],
  viewAnalytics: ["producer", "talent", "finance", "hr", "admin", "owner"] as Role[],
  manageContent: ["talent", "admin", "owner"] as Role[],
};

// Check if user has permission
export function hasPermission(
  userRole: Role | undefined,
  permission: keyof typeof PERMISSIONS
): boolean {
  if (!userRole) return false;
  return PERMISSIONS[permission].includes(userRole);
}
