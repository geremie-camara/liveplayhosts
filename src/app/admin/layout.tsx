import AuthenticatedLayout from "@/components/AuthenticatedLayout";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthenticatedLayout requireRole="admin">
      <div className="max-w-7xl mx-auto">{children}</div>
    </AuthenticatedLayout>
  );
}
