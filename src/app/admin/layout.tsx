import AuthenticatedLayout from "@/components/AuthenticatedLayout";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthenticatedLayout requireRole="adminAccess">
      <div className="max-w-7xl mx-auto">{children}</div>
    </AuthenticatedLayout>
  );
}
