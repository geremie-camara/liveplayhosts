import { UserButton } from "@clerk/nextjs";
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function PendingPage() {
  const user = await currentUser();

  if (!user) {
    redirect("/sign-in");
  }

  const primaryEmail = user.emailAddresses.find(e => e.id === user.primaryEmailAddressId)?.emailAddress || "";

  // If user already has a role, they're approved - redirect to dashboard
  if (user.publicMetadata?.role) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <a href="/" className="flex items-center gap-2">
              <img src="/logo.png" alt="LivePlay Hosts" className="h-8 w-auto" />
            </a>
            <UserButton
              afterSignOutUrl="/"
              appearance={{
                elements: {
                  avatarBox: "w-10 h-10",
                },
              }}
            />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
          <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg
              className="w-10 h-10 text-yellow-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-dark mb-4">
            Account Pending Approval
          </h1>

          <p className="text-gray-600 mb-6">
            Hi {user.firstName || "there"}! Your account ({primaryEmail}) is not yet activated as a LivePlay Host.
          </p>

          <div className="bg-gray-50 rounded-lg p-6 mb-6">
            <h3 className="font-semibold text-dark mb-3">What happens next?</h3>
            <ul className="text-left text-gray-600 space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">1.</span>
                If you&apos;ve applied, our team will review your application and activate your account.
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">2.</span>
                You&apos;ll receive an email when your account is approved.
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">3.</span>
                Once approved, just sign in again to access your dashboard.
              </li>
            </ul>
          </div>

          <p className="text-gray-500 text-sm mb-6">
            Haven&apos;t applied yet? Submit your application to become a host.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="/#apply"
              className="bg-cta text-white font-semibold py-3 px-8 rounded-lg hover:bg-cta-600 transition-colors duration-200"
            >
              Apply Now
            </a>
            <a
              href="/"
              className="bg-gray-100 text-dark font-semibold py-3 px-8 rounded-lg hover:bg-gray-200 transition-colors duration-200"
            >
              Back to Home
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
