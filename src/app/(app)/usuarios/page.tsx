import { requireTab } from "@/lib/guard";
import UsuariosClient from "./usuarios-client";

export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
  const session = await requireTab("usuarios");
  return (
    <div>
      <h1 className="text-xl font-semibold mb-6">Usuários</h1>
      <UsuariosClient currentUserId={session.userId} />
    </div>
  );
}
