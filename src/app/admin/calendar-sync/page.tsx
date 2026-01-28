import AuthenticatedLayout from "@/components/AuthenticatedLayout";
import CalendarSyncClient from "./CalendarSyncClient";

export default function CalendarSyncPage() {
  return (
    <AuthenticatedLayout>
      <CalendarSyncClient />
    </AuthenticatedLayout>
  );
}
