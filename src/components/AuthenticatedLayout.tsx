import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Role } from "@/lib/roles";
import Sidebar from "./Sidebar";

interface AuthenticatedLayoutProps {
  children: React.ReactNode;
  requireRole?: Role;
}

export default async function AuthenticatedLayout({
  children,
  requireRole,
}: AuthenticatedLayoutProps) {
  const user = await currentUser();

  if (!user) {
    redirect("/sign-in");
  }

  const userRole = (user.publicMetadata?.role as Role) || "trainee";
  const userName = user.firstName || user.emailAddresses[0]?.emailAddress || "User";

  // Check role requirement if specified
  if (requireRole) {
    const roleHierarchy: Role[] = ["trainee", "host", "senior_host", "admin"];
    const userLevel = roleHierarchy.indexOf(userRole);
    const requiredLevel = roleHierarchy.indexOf(requireRole);

    if (userLevel < requiredLevel) {
      redirect("/dashboard");
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar userRole={userRole} userName={userName} />

      {/* Main Content */}
      <main className="lg:ml-64 pt-16 lg:pt-0">
        <div className="p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
