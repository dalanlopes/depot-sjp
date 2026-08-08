import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import LoginForm from "./login-form";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/");

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-[var(--primary)] flex items-center justify-center text-white font-bold text-lg mb-3">
            SJP
          </div>
          <h1 className="text-xl font-semibold">Depot SJP</h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            Gestão de Estoque e Reparos de Containers
          </p>
        </div>
        <div className="card p-6">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
