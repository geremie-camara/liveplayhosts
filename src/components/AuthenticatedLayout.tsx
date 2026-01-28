import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Role, isAdmin, isActiveUser } from "@/lib/roles";
import { getGhostHostId, getHostById } from "@/lib/host-utils";
import Sidebar from "./Sidebar";
import ImpersonationBanner from "./ImpersonationBanner";

interface AuthenticatedLayoutProps {
  children: React.ReactNode;
  requireRole?: "admin" | "active"; // admin requires admin/owner, active requires host/producer/admin/owner
}

export default async function AuthenticatedLayout({
  children,
  requireRole,
}: AuthenticatedLayoutProps) {
  const user = await currentUser();

  if (!user) {
    redirect("/sign-in");
  }

  // The actual admin's role — always used for route protection
  const actualRole = (user.publicMetadata?.role as Role) || "applicant";
  const userName = user.firstName || user.emailAddresses[0]?.emailAddress || "User";

  // Check if user is active (host, producer, admin, or owner)
  if (!isActiveUser(actualRole)) {
    redirect("/pending");
  }

  // Check role requirement if specified — always uses actual admin role
  if (requireRole === "admin" && !isAdmin(actualRole)) {
    redirect("/dashboard");
  }

  // Check for impersonation
  let sidebarRole: Role = actualRole;
  let sidebarName = userName;
  let impersonating = false;
  let ghostHost: { firstName: string; lastName: string; email: string; role: string } | null = null;

  if (isAdmin(actualRole)) {
    const ghostHostId = await getGhostHostId();
    if (ghostHostId) {
      const host = await getHostById(ghostHostId);
      if (host) {
        impersonating = true;
        ghostHost = {
          firstName: host.firstName,
          lastName: host.lastName,
          email: host.email,
          role: host.role,
        };
        // Show impersonated host's role in sidebar (hides admin nav)
        sidebarRole = host.role as Role;
        sidebarName = `${host.firstName} ${host.lastName}`;
      }
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {impersonating && ghostHost && (
        <ImpersonationBanner
          hostName={`${ghostHost.firstName} ${ghostHost.lastName}`}
          hostEmail={ghostHost.email}
          hostRole={ghostHost.role}
        />
      )}

      <Sidebar userRole={sidebarRole} userName={sidebarName} />

      {/* Main Content */}
      <main className="lg:ml-64 pt-16 lg:pt-0">
        <div className="p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
