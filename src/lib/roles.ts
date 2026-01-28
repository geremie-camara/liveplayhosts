// Role definitions for LivePlay Hosts
// Import from types.ts for consistency
import { UserRole, ROLE_CONFIG } from "./types";
import { dynamoDb, TABLES } from "./dynamodb";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import type { PermissionKey, PermissionEntry } from "./security-types";

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

// Permission definitions by feature (hardcoded fallback)
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

  // Broadcast messaging
  manageBroadcasts: ["talent", "admin", "owner"] as Role[],
  viewMessages: ["host", "producer", "talent", "finance", "hr", "admin", "owner"] as Role[],

  // Location management
  manageLocations: ["talent", "admin", "owner"] as Role[],

  // Call out management
  manageCallOuts: ["producer", "talent", "admin", "owner"] as Role[],

  // Host priority management (scheduling priority - admin only, never visible to hosts)
  manageHostPriority: ["talent", "admin", "owner"] as Role[],

  // Host availability management (view/edit all host availabilities)
  manageAvailability: ["producer", "talent", "admin", "owner"] as Role[],

  // Finance pay review
  viewFinance: ["host", "producer", "talent", "finance", "hr", "admin", "owner"] as Role[],
};

// --- Dynamic permission cache ---

// Maps role -> PermissionKey -> PermissionEntry
let _dynamicPermissions: Map<string, Record<PermissionKey, PermissionEntry>> | null = null;
let _cacheLoadedAt: number = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Old permission key -> new { feature, access } mapping
const OLD_KEY_MAP: Record<string, { feature: PermissionKey; access: "read" | "write" }> = {
  viewDashboard: { feature: "dashboard", access: "read" },
  viewMessages: { feature: "messages", access: "read" },
  viewSchedule: { feature: "schedule", access: "read" },
  viewFinance: { feature: "finance", access: "read" },
  viewBasicTraining: { feature: "training", access: "read" },
  viewAdvancedTraining: { feature: "training", access: "read" },
  viewAllTraining: { feature: "trainingContent", access: "read" },
  viewAnalytics: { feature: "analytics", access: "read" },
  viewTrainingAnalytics: { feature: "analytics", access: "read" },
  manageTraining: { feature: "trainingContent", access: "write" },
  manageSchedule: { feature: "calendarSync", access: "write" },
  manageUsers: { feature: "manageUsers", access: "write" },
  manageBroadcasts: { feature: "broadcasts", access: "write" },
  manageLocations: { feature: "locations", access: "write" },
  manageCallOuts: { feature: "callOuts", access: "write" },
  manageHostPriority: { feature: "hostPriority", access: "write" },
  manageAvailability: { feature: "hostAvailability", access: "write" },
  manageContent: { feature: "trainingContent", access: "write" },
};

/**
 * Load dynamic permissions from DynamoDB into the in-memory cache.
 * Safe to call multiple times — respects TTL.
 */
export async function loadPermissions(): Promise<void> {
  const now = Date.now();
  if (_dynamicPermissions && now - _cacheLoadedAt < CACHE_TTL_MS) {
    return; // Cache still fresh
  }

  try {
    const result = await dynamoDb.send(
      new ScanCommand({ TableName: TABLES.ROLE_PERMISSIONS })
    );

    if (result.Items && result.Items.length > 0) {
      const map = new Map<string, Record<PermissionKey, PermissionEntry>>();
      for (const item of result.Items) {
        if (item.role && item.permissions) {
          map.set(item.role as string, item.permissions as Record<PermissionKey, PermissionEntry>);
        }
      }
      _dynamicPermissions = map;
    } else {
      // Table exists but is empty — keep null so fallback is used
      _dynamicPermissions = null;
    }
    _cacheLoadedAt = now;
  } catch {
    // DynamoDB error — keep existing cache or null (fallback will be used)
    console.error("[roles] Failed to load dynamic permissions, using fallback");
    _cacheLoadedAt = now; // Avoid hammering on repeated failures
  }
}

/**
 * Clear the in-memory cache so the next hasPermission() call will reload.
 */
export function invalidatePermissionCache(): void {
  _dynamicPermissions = null;
  _cacheLoadedAt = 0;
}

/**
 * Map an old permission key to its dynamic feature + access type.
 */
function mapOldPermissionKey(
  oldKey: string
): { feature: PermissionKey; access: "read" | "write" } | null {
  return OLD_KEY_MAP[oldKey] ?? null;
}

// Check if user has access to the /admin section (any admin-level permission)
// Broader than isAdmin() — includes producer, finance, hr who have specific admin features
export function hasAdminAccess(userRole: Role | undefined): boolean {
  if (!userRole) return false;
  if (userRole === "owner") return true;

  // Check dynamic cache first
  if (_dynamicPermissions) {
    const rolePerms = _dynamicPermissions.get(userRole);
    if (rolePerms) {
      const adminFeatures: PermissionKey[] = [
        "manageUsers", "callOuts", "hostPriority",
        "hostAvailability", "calendarSync", "broadcasts",
        "trainingContent", "locations", "analytics",
        "availabilityChangelog",
      ];
      return adminFeatures.some((f) => {
        const entry = rolePerms[f];
        return entry && (entry.read || entry.write);
      });
    }
  }

  // Hardcoded fallback
  const adminPermissions: (keyof typeof PERMISSIONS)[] = [
    "manageUsers", "manageCallOuts", "manageHostPriority",
    "manageAvailability", "manageSchedule", "manageBroadcasts",
    "manageTraining", "manageLocations", "viewAnalytics",
  ];
  return adminPermissions.some((p) => PERMISSIONS[p].includes(userRole));
}

// Check if user has permission (synchronous — reads from cache or falls back to hardcoded)
export function hasPermission(
  userRole: Role | undefined,
  permission: keyof typeof PERMISSIONS
): boolean {
  if (!userRole) return false;

  // Owner always has full access
  if (userRole === "owner") return true;

  // Try dynamic cache
  if (_dynamicPermissions) {
    const rolePerms = _dynamicPermissions.get(userRole);
    if (rolePerms) {
      const mapped = mapOldPermissionKey(permission);
      if (mapped) {
        const entry = rolePerms[mapped.feature];
        if (entry) {
          // For "read" access, just check read; for "write" access, check write
          return mapped.access === "read" ? entry.read : entry.write;
        }
      }
      // If no mapping exists for this key, fall through to hardcoded
    }
  }

  // Hardcoded fallback
  return PERMISSIONS[permission].includes(userRole);
}
