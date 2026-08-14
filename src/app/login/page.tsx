import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { APP_VERSION } from "@/lib/version";
import LoginForm from "./login-form";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/");

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-vale-do-tibagi.png"
            alt="Vale do Tibagi"
            className="mx-auto h-24 w-auto mb-3"
          />
          <h1 className="text-xl font-semibold">Depot SJP</h1>
        </div>
        <div className="card p-6">
          <LoginForm />
        </div>
        <p className="text-center text-xs text-[var(--muted)] mt-10">Versão {APP_VERSION}</p>
      </div>
    </div>
  );
}
