import Link from "next/link";

export default function AdminPage() {
  return (
    <>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-primary">Admin Dashboard</h1>
        <p className="text-gray-600 mt-2">
          Manage users, applicants, and system settings.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="text-3xl font-bold text-yellow-600">2</div>
          <div className="text-gray-600 mt-1">Pending Applicants</div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="text-3xl font-bold text-blue-600">1</div>
          <div className="text-gray-600 mt-1">Invited</div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="text-3xl font-bold text-green-600">3</div>
          <div className="text-gray-600 mt-1">Active Users</div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="text-3xl font-bold text-primary">6</div>
          <div className="text-gray-600 mt-1">Total Users</div>
        </div>
      </div>

      {/* Admin Actions */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Link
          href="/admin/users"
          className="bg-white rounded-2xl shadow-sm p-6 hover:shadow-md transition-shadow"
        >
          <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center mb-4">
            <svg
              className="w-6 h-6 text-primary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-dark">Manage Users</h3>
          <p className="text-gray-600 mt-1">
            View, edit, and manage user accounts and applicants.
          </p>
        </Link>

        <Link
          href="/admin/users?status=applicant"
          className="bg-white rounded-2xl shadow-sm p-6 hover:shadow-md transition-shadow"
        >
          <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center mb-4">
            <svg
              className="w-6 h-6 text-yellow-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-dark">Review Applications</h3>
          <p className="text-gray-600 mt-1">
            Review pending applications and approve or reject.
          </p>
        </Link>

        <div className="bg-white rounded-2xl shadow-sm p-6 opacity-50 cursor-not-allowed">
          <div className="w-12 h-12 bg-accent-100 rounded-xl flex items-center justify-center mb-4">
            <svg
              className="w-6 h-6 text-accent"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-dark">Training Content</h3>
          <p className="text-gray-600 mt-1">
            Manage training modules and materials. (Coming soon)
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-6 opacity-50 cursor-not-allowed">
          <div className="w-12 h-12 bg-secondary-100 rounded-xl flex items-center justify-center mb-4">
            <svg
              className="w-6 h-6 text-secondary-700"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-dark">Analytics</h3>
          <p className="text-gray-600 mt-1">
            View performance metrics and reports. (Coming soon)
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-6 opacity-50 cursor-not-allowed">
          <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mb-4">
            <svg
              className="w-6 h-6 text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-dark">Settings</h3>
          <p className="text-gray-600 mt-1">
            Configure system settings. (Coming soon)
          </p>
        </div>
      </div>
    </>
  );
}
