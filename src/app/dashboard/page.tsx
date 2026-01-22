import { currentUser, clerkClient } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Role, ROLE_NAMES, ROLE_COLORS, hasPermission } from "@/lib/roles";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoDb, TABLES } from "@/lib/dynamodb";
import { Host } from "@/lib/types";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";

async function syncUserRole(userId: string, email: string, currentRole?: string): Promise<{ role: Role; isApproved: boolean }> {
  // If user already has a role set, they're approved
  if (currentRole) return { role: currentRole as Role, isApproved: true };

  try {
    // Look up host by email in DynamoDB
    const result = await dynamoDb.send(
      new ScanCommand({
        TableName: TABLES.HOSTS,
        FilterExpression: "email = :email AND #status = :status",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: {
          ":email": email.toLowerCase(),
          ":status": "active"
        },
      })
    );

    const hosts = result.Items as Host[];
    if (hosts.length > 0) {
      const host = hosts[0];
      const role = host.role || "trainee";

      // Update Clerk user metadata
      const clerk = await clerkClient();
      await clerk.users.updateUser(userId, {
        publicMetadata: { role },
      });

      return { role: role as Role, isApproved: true };
    }
  } catch (error) {
    console.error("Error syncing user role:", error);
  }

  // No matching active host - not approved
  return { role: "trainee", isApproved: false };
}

export default async function DashboardPage() {
  const user = await currentUser();

  if (!user) {
    redirect("/sign-in");
  }

  const primaryEmail = user.emailAddresses.find(e => e.id === user.primaryEmailAddressId)?.emailAddress || "";
  const existingRole = user.publicMetadata?.role as Role | undefined;

  // Sync role from DynamoDB if not set
  const { role, isApproved } = await syncUserRole(user.id, primaryEmail, existingRole);

  // If not approved, redirect to pending page
  if (!isApproved) {
    redirect("/pending");
  }

  const canViewSchedule = hasPermission(role, "viewSchedule");
  const canViewAnalytics = hasPermission(role, "viewAnalytics");
  const canManageUsers = hasPermission(role, "manageUsers");

  return (
    <AuthenticatedLayout>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-primary">
              Welcome back, {user.firstName || "there"}!
            </h1>
            <p className="text-gray-600 mt-2">
              Here&apos;s your dashboard. Manage your schedule, access training,
              and more.
            </p>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium self-start ${ROLE_COLORS[role]}`}>
            {ROLE_NAMES[role]}
          </span>
        </div>

        {/* Dashboard Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Quick Stats */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-dark mb-4">Quick Stats</h3>
            <div className="space-y-4">
              {canViewSchedule && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Upcoming Sessions</span>
                  <span className="text-2xl font-bold text-primary">0</span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Completed This Month</span>
                <span className="text-2xl font-bold text-accent">0</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Training Progress</span>
                <span className="text-2xl font-bold text-secondary">0%</span>
              </div>
            </div>
          </div>

          {/* Training Progress */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-dark mb-4">
              Training Progress
            </h3>
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600">Overall Progress</span>
                <span className="text-primary font-medium">0%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-accent h-3 rounded-full"
                  style={{ width: "0%" }}
                />
              </div>
            </div>
            <a
              href="/training"
              className="inline-flex items-center text-accent font-medium hover:underline"
            >
              Continue Training →
            </a>
          </div>

          {/* Upcoming Schedule - Only for hosts and above */}
          {canViewSchedule ? (
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-dark mb-4">
                Upcoming Schedule
              </h3>
              <div className="text-center py-8 text-gray-500">
                <p>No upcoming sessions</p>
                <a
                  href="/schedule"
                  className="inline-flex items-center text-accent font-medium hover:underline mt-2"
                >
                  View Schedule →
                </a>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-dark mb-4">
                Complete Training
              </h3>
              <div className="text-center py-8 text-gray-500">
                <p className="mb-2">Complete your training to unlock scheduling</p>
                <span className="inline-flex items-center px-3 py-1 bg-gray-100 rounded-full text-sm">
                  Requires Host role
                </span>
              </div>
            </div>
          )}

          {/* Analytics - Only for senior hosts and admins */}
          {canViewAnalytics && (
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-dark mb-4">
                Performance Analytics
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Avg. Session Rating</span>
                  <span className="text-2xl font-bold text-primary">-</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Total Viewers</span>
                  <span className="text-2xl font-bold text-accent">0</span>
                </div>
              </div>
            </div>
          )}

          {/* Admin Quick Actions - Only for admins */}
          {canManageUsers && (
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-dark mb-4">
                Admin Actions
              </h3>
              <div className="space-y-3">
                <a
                  href="/admin/users"
                  className="block w-full text-left px-4 py-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <span className="font-medium text-dark">Manage Users</span>
                  <p className="text-sm text-gray-500">View and edit user roles</p>
                </a>
                <a
                  href="/admin/content"
                  className="block w-full text-left px-4 py-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <span className="font-medium text-dark">Manage Content</span>
                  <p className="text-sm text-gray-500">Edit training modules</p>
                </a>
              </div>
            </div>
          )}

          {/* Announcements */}
          <div className={`bg-white rounded-2xl shadow-sm p-6 ${canViewAnalytics ? "lg:col-span-2" : "md:col-span-2 lg:col-span-3"}`}>
            <h3 className="text-lg font-semibold text-dark mb-4">
              Announcements
            </h3>
            <div className="bg-primary-50 border border-primary-100 rounded-lg p-4">
              <p className="text-primary font-medium">Welcome to LivePlay Hosts!</p>
              <p className="text-gray-600 mt-1">
                {role === "trainee"
                  ? "Complete your training modules to become a certified host and unlock scheduling features."
                  : role === "host"
                  ? "You're ready to host! Check your schedule and start your first session."
                  : role === "senior_host"
                  ? "As a senior host, you have access to analytics and advanced features."
                  : "You have full admin access. Manage users and content from the admin panel."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
