"use client";

import { useUser } from "@clerk/nextjs";
import { Role, hasRole, hasPermission, PERMISSIONS } from "@/lib/roles";

interface RoleGateProps {
  children: React.ReactNode;
  requiredRole?: Role;
  permission?: keyof typeof PERMISSIONS;
  fallback?: React.ReactNode;
}

export function RoleGate({
  children,
  requiredRole,
  permission,
  fallback = null,
}: RoleGateProps) {
  const { user, isLoaded } = useUser();

  if (!isLoaded) {
    return null;
  }

  const userRole = user?.publicMetadata?.role as Role | undefined;

  // Check by role
  if (requiredRole && !hasRole(userRole, requiredRole)) {
    return <>{fallback}</>;
  }

  // Check by permission
  if (permission && !hasPermission(userRole, permission)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

// Hook to get current user's role
export function useUserRole(): { role: Role; isLoaded: boolean } {
  const { user, isLoaded } = useUser();
  const role = (user?.publicMetadata?.role as Role) || "trainee";
  return { role, isLoaded };
}
