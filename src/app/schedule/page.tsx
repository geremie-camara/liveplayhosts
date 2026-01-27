import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";
import ScheduleCalendar from "@/components/ScheduleCalendar";

export default async function SchedulePage() {
  const user = await currentUser();

  if (!user) {
    redirect("/sign-in");
  }

  const primaryEmail = user.emailAddresses.find(
    (e) => e.id === user.primaryEmailAddressId
  )?.emailAddress;

  return (
    <AuthenticatedLayout>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-primary">
            My Schedule
          </h1>
          <p className="text-gray-600 mt-1 sm:mt-2 text-sm sm:text-base">
            View your upcoming sessions and shifts
          </p>
        </div>

        {/* Calendar */}
        <ScheduleCalendar userEmail={primaryEmail} />
      </div>
    </AuthenticatedLayout>
  );
}
