// Role definitions for LivePlay Hosts
export type Role = "admin" | "senior_host" | "host" | "trainee";

// Role hierarchy (higher index = more permissions)
export const ROLE_HIERARCHY: Role[] = ["trainee", "host", "senior_host", "admin"];

// Role display names
export const ROLE_NAMES: Record<Role, string> = {
  admin: "Administrator",
  senior_host: "Senior Host",
  host: "Host",
  trainee: "Trainee",
};

// Role colors for UI
export const ROLE_COLORS: Record<Role, string> = {
  admin: "bg-accent text-white",
  senior_host: "bg-primary text-white",
  host: "bg-secondary text-dark",
  trainee: "bg-gray-200 text-gray-700",
};

// Check if user has at least the required role level
export function hasRole(userRole: Role | undefined, requiredRole: Role): boolean {
  if (!userRole) return false;
  const userLevel = ROLE_HIERARCHY.indexOf(userRole);
  const requiredLevel = ROLE_HIERARCHY.indexOf(requiredRole);
  return userLevel >= requiredLevel;
}

// Check if user is admin
export function isAdmin(userRole: Role | undefined): boolean {
  return userRole === "admin";
}

// Get user role from Clerk metadata
export function getUserRole(publicMetadata: Record<string, unknown> | undefined): Role {
  const role = publicMetadata?.role as Role | undefined;
  return role && ROLE_HIERARCHY.includes(role) ? role : "trainee";
}

// Permission definitions by feature
export const PERMISSIONS = {
  // Dashboard access
  viewDashboard: ["trainee", "host", "senior_host", "admin"] as Role[],

  // Training access
  viewBasicTraining: ["trainee", "host", "senior_host", "admin"] as Role[],
  viewAdvancedTraining: ["host", "senior_host", "admin"] as Role[],
  viewAllTraining: ["senior_host", "admin"] as Role[],

  // Schedule access
  viewSchedule: ["host", "senior_host", "admin"] as Role[],
  manageSchedule: ["senior_host", "admin"] as Role[],

  // Admin features
  manageUsers: ["admin"] as Role[],
  viewAnalytics: ["senior_host", "admin"] as Role[],
  manageContent: ["admin"] as Role[],
};

// Check if user has permission
export function hasPermission(
  userRole: Role | undefined,
  permission: keyof typeof PERMISSIONS
): boolean {
  if (!userRole) return false;
  return PERMISSIONS[permission].includes(userRole);
}
