import AuthenticatedLayout from "@/components/AuthenticatedLayout";
import AvailabilityForm from "./AvailabilityForm";

export default function AvailabilityPage() {
  return (
    <AuthenticatedLayout>
      <AvailabilityForm />
    </AuthenticatedLayout>
  );
}
