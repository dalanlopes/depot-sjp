"use client";

import { useEffect, useState, useCallback } from "react";
import { ROLE_LABELS } from "@/lib/roles";
import type { Role } from "@/lib/types";

interface Usuario {
  id: string;
  nome: string;
  email: string;
  role: Role;
  ativo: boolean;
  criado_em: string;
}

const ROLES: Role[] = ["GESTOR", "MECANICO", "ANALISTA_PROGRAMACAO", "ANALISTA_FATURAMENTO"];

export default function UsuariosClient({ currentUserId }: { currentUserId: string }) {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [role, setRole] = useState<Role>("MECANICO");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/usuarios");
    if (res.ok) {
      const data = await res.json();
      setUsuarios(data.usuarios);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch("/api/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, email, senha, role }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Erro ao criar usuário.");
      return;
    }
    setNome("");
    setEmail("");
    setSenha("");
    setRole("MECANICO");
    load();
  }

  async function toggleAtivo(u: Usuario) {
    await fetch(`/api/usuarios/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ativo: !u.ativo }),
    });
    load();
  }

  async function remover(u: Usuario) {
    if (!confirm(`Remover o acesso de ${u.nome}?`)) return;
    await fetch(`/api/usuarios/${u.id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="card p-5 max-w-lg space-y-4">
        <h2 className="text-sm font-semibold">Novo usuário</h2>
        <div>
          <label className="text-sm font-medium block mb-1.5">Nome</label>
          <input className="input" value={nome} onChange={(e) => setNome(e.target.value)} required />
        </div>
        <div>
          <label className="text-sm font-medium block mb-1.5">E-mail</label>
          <input
            type="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="text-sm font-medium block mb-1.5">Senha</label>
          <input
            type="password"
            className="input"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            minLength={6}
            required
          />
        </div>
        <div>
          <label className="text-sm font-medium block mb-1.5">Perfil</label>
          <select
            className="input"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </div>
        {error && (
          <p className="text-sm text-[var(--danger)] bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}
        <button type="submit" disabled={saving} className="btn btn-primary disabled:opacity-60">
          {saving ? "Criando..." : "Criar usuário"}
        </button>
      </form>

      <div className="card p-5">
        <h2 className="text-sm font-semibold mb-4">Usuários cadastrados</h2>
        {loading ? (
          <p className="text-sm text-[var(--muted)]">Carregando...</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[var(--muted)] border-b border-[var(--border)]">
                <th className="py-2 pr-3">Nome</th>
                <th className="py-2 pr-3">E-mail</th>
                <th className="py-2 pr-3">Perfil</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3"></th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="py-2 pr-3">{u.nome}</td>
                  <td className="py-2 pr-3">{u.email}</td>
                  <td className="py-2 pr-3">{ROLE_LABELS[u.role]}</td>
                  <td className="py-2 pr-3">
                    <span className={u.ativo ? "text-green-600" : "text-[var(--muted)]"}>
                      {u.ativo ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-right space-x-3">
                    <button
                      onClick={() => toggleAtivo(u)}
                      className="text-[var(--primary)] hover:underline"
                    >
                      {u.ativo ? "Desativar" : "Reativar"}
                    </button>
                    {u.id !== currentUserId && (
                      <button
                        onClick={() => remover(u)}
                        className="text-[var(--danger)] hover:underline"
                      >
                        Excluir
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
