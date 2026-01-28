import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Role } from "@/lib/roles";

export default async function SecurityLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();

  if (!user) {
    redirect("/sign-in");
  }

  const actualRole = (user.publicMetadata?.role as Role) || "applicant";

  // Owner only — no exceptions
  if (actualRole !== "owner") {
    redirect("/admin");
  }

  return <>{children}</>;
}
