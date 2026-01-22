import AuthenticatedLayout from "@/components/AuthenticatedLayout";
import DirectoryList from "@/components/DirectoryList";

export default async function DirectoryPage() {
  return (
    <AuthenticatedLayout>
      <DirectoryList />
    </AuthenticatedLayout>
  );
}
