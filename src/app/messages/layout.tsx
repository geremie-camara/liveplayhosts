import AuthenticatedLayout from "@/components/AuthenticatedLayout";

export default function MessagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthenticatedLayout>{children}</AuthenticatedLayout>;
}
