import { requireTab } from "@/lib/guard";
import UsuariosClient from "./usuarios-client";

export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
  const session = await requireTab("usuarios");
  return (
    <div>
      <h1 className="text-xl font-semibold mb-1">Usuários</h1>
      <p className="text-sm text-[var(--muted)] mb-6">
        Gerencie quem tem acesso ao sistema e qual o perfil de cada pessoa.
      </p>
      <UsuariosClient currentUserId={session.userId} />
    </div>
  );
}
