import AuthenticatedLayout from "@/components/AuthenticatedLayout";
import ProfileForm from "@/components/ProfileForm";

export default async function ProfilePage() {
  return (
    <AuthenticatedLayout>
      <ProfileForm />
    </AuthenticatedLayout>
  );
}
