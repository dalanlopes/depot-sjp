import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import Nav from "@/components/nav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen flex">
      <Nav session={session} />
      <main className="flex-1 min-w-0 p-6 md:p-8">
        <div className="max-w-6xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
