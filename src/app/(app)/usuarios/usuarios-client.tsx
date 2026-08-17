"use client";

import { Fragment, useEffect, useState, useCallback } from "react";
import { ROLE_LABELS, ALL_TABS, TAB_LABELS, TAB_ACCESS, type Tab } from "@/lib/roles";
import type { Role } from "@/lib/types";

interface Usuario {
  id: string;
  nome: string;
  email: string;
  role: Role;
  ativo: boolean;
  criado_em: string;
  tabs: string[] | null;
  pode_ver_faturamento: boolean;
  pode_editar_status: boolean;
  senhaDefinida: boolean;
  codigoConvite: string | null;
}

interface Solicitacao {
  id: string;
  email: string;
  criado_em: string;
}

const ROLES: Role[] = ["GESTOR", "MECANICO", "ANALISTA_PROGRAMACAO", "ANALISTA_FATURAMENTO", "VISUALIZADOR"];

function TabCheckboxes({
  selected,
  onChange,
}: {
  selected: Tab[];
  onChange: (tabs: Tab[]) => void;
}) {
  function toggle(tab: Tab) {
    if (selected.includes(tab)) onChange(selected.filter((t) => t !== tab));
    else onChange([...selected, tab]);
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {ALL_TABS.map((tab) => (
        <label key={tab} className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={selected.includes(tab)} onChange={() => toggle(tab)} />
          <span>
            {TAB_LABELS[tab].icon} {TAB_LABELS[tab].label}
          </span>
        </label>
      ))}
    </div>
  );
}

export default function UsuariosClient({ currentUserId }: { currentUserId: string }) {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [codigoGerado, setCodigoGerado] = useState<{ email: string; codigo: string } | null>(null);

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("MECANICO");
  const [tabs, setTabs] = useState<Tab[]>(TAB_ACCESS["MECANICO"]);
  const [podeVerFaturamento, setPodeVerFaturamento] = useState(false);
  const [podeEditarStatus, setPodeEditarStatus] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTabs, setEditTabs] = useState<Tab[]>([]);
  const [editFaturamento, setEditFaturamento] = useState(false);
  const [editStatus, setEditStatus] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [resUsuarios, resSolicitacoes] = await Promise.all([
      fetch("/api/usuarios"),
      fetch("/api/usuarios/solicitacoes"),
    ]);
    if (resUsuarios.ok) {
      const data = await resUsuarios.json();
      setUsuarios(data.usuarios);
    }
    if (resSolicitacoes.ok) {
      const data = await resSolicitacoes.json();
      setSolicitacoes(data.solicitacoes);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function handleRoleChange(r: Role) {
    setRole(r);
    setTabs(TAB_ACCESS[r]);
  }

  function preencherComSolicitacao(s: Solicitacao) {
    setEmail(s.email);
    setInfo(`Preenchendo cadastro para ${s.email}. Complete o nome, perfil e abas, depois clique em "Criar usuário".`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function recusarSolicitacao(s: Solicitacao) {
    if (!confirm(`Recusar o acesso de ${s.email}?`)) return;
    await fetch(`/api/usuarios/solicitacoes/${s.id}`, { method: "DELETE" });
    load();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setInfo(null);
    const res = await fetch("/api/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, email, role, tabs, podeVerFaturamento, podeEditarStatus }),
    });
    setSaving(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Erro ao criar usuário.");
      return;
    }
    if (data.codigoConvite) {
      setCodigoGerado({ email, codigo: data.codigoConvite });
    }
    setNome("");
    setEmail("");
    setRole("MECANICO");
    setTabs(TAB_ACCESS["MECANICO"]);
    setPodeVerFaturamento(false);
    setPodeEditarStatus(false);
    setInfo("Usuário criado. Repasse o código de convite abaixo para ele fazer o primeiro acesso.");
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

  async function resetarSenha(u: Usuario) {
    if (!confirm(`Resetar a senha de ${u.nome}? Ele(a) vai precisar do novo código de convite para criar uma senha nova.`)) return;
    const res = await fetch(`/api/usuarios/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resetSenha: true }),
    });
    const data = await res.json().catch(() => ({}));
    if (data.codigoConvite) {
      setCodigoGerado({ email: u.email, codigo: data.codigoConvite });
    }
    load();
  }

  async function remover(u: Usuario) {
    if (!confirm(`Remover o acesso de ${u.nome}?`)) return;
    await fetch(`/api/usuarios/${u.id}`, { method: "DELETE" });
    load();
  }

  function iniciarEdicao(u: Usuario) {
    setEditingId(u.id);
    setEditTabs((u.tabs && u.tabs.length > 0 ? u.tabs : TAB_ACCESS[u.role]) as Tab[]);
    setEditFaturamento(u.pode_ver_faturamento);
    setEditStatus(u.pode_editar_status);
  }

  async function salvarEdicao(u: Usuario) {
    await fetch(`/api/usuarios/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tabs: editTabs, podeVerFaturamento: editFaturamento, podeEditarStatus: editStatus }),
    });
    setEditingId(null);
    load();
  }

  return (
    <div className="space-y-6">
      {codigoGerado && (
        <div className="card p-5 border-2 border-[var(--primary)] bg-green-50 max-w-lg">
          <h2 className="text-sm font-semibold mb-1">Código de convite gerado</h2>
          <p className="text-xs text-[var(--muted)] mb-3">
            Repasse manualmente (WhatsApp, presencial etc) para <strong>{codigoGerado.email}</strong>. Vale por 7
            dias e só funciona uma vez.
          </p>
          <div className="flex items-center gap-3">
            <span className="text-2xl font-bold tracking-widest font-mono">{codigoGerado.codigo}</span>
            <button
              type="button"
              className="btn btn-secondary text-xs"
              onClick={() => navigator.clipboard?.writeText(codigoGerado.codigo)}
            >
              Copiar
            </button>
            <button
              type="button"
              className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] ml-auto"
              onClick={() => setCodigoGerado(null)}
            >
              Fechar
            </button>
          </div>
        </div>
      )}

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
          <label className="text-sm font-medium block mb-1.5">Perfil</label>
          <select
            className="input"
            value={role}
            onChange={(e) => handleRoleChange(e.target.value as Role)}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium block mb-1.5">Abas que esse usuário pode ver</label>
          <TabCheckboxes selected={tabs} onChange={setTabs} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={podeVerFaturamento}
            onChange={(e) => setPodeVerFaturamento(e.target.checked)}
          />
          Pode ver o faturamento da Oficina
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={podeEditarStatus}
            onChange={(e) => setPodeEditarStatus(e.target.checked)}
          />
          Pode alterar o status/padrão dos containers (Estoque/Oficina)
        </label>
        <p className="text-xs text-[var(--muted)]">
          Sem senha aqui: o usuário entra com esse e-mail e cria a própria senha no primeiro acesso.
        </p>
        {error && (
          <p className="text-sm text-[var(--danger)] bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}
        {info && (
          <p className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">{info}</p>
        )}
        <button type="submit" disabled={saving} className="btn btn-primary disabled:opacity-60">
          {saving ? "Criando..." : "Criar usuário"}
        </button>
      </form>

      {solicitacoes.length > 0 && (
        <div className="card p-5">
          <h2 className="text-sm font-semibold mb-1">Solicitações de acesso pendentes</h2>
          <p className="text-xs text-[var(--muted)] mb-4">
            Esses e-mails tentaram entrar mas ainda não têm cadastro. Autorize para criar o acesso.
          </p>
          <ul className="divide-y divide-[var(--border)]">
            {solicitacoes.map((s) => (
              <li key={s.id} className="py-2.5 flex items-center justify-between text-sm">
                <span>{s.email}</span>
                <span className="space-x-3">
                  <button
                    onClick={() => preencherComSolicitacao(s)}
                    className="text-[var(--primary)] hover:underline"
                  >
                    Autorizar
                  </button>
                  <button
                    onClick={() => recusarSolicitacao(s)}
                    className="text-[var(--danger)] hover:underline"
                  >
                    Recusar
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card p-5">
        <h2 className="text-sm font-semibold mb-4">Usuários cadastrados</h2>
        {loading ? (
          <p className="text-sm text-[var(--muted)]">Carregando...</p>
        ) : (
          <div className="overflow-x-auto">
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
                <Fragment key={u.id}>
                  <tr className="border-b border-[var(--border)] last:border-0">
                    <td className="py-2 pr-3">{u.nome}</td>
                    <td className="py-2 pr-3">{u.email}</td>
                    <td className="py-2 pr-3">{ROLE_LABELS[u.role]}</td>
                    <td className="py-2 pr-3">
                      <span className={u.ativo ? "text-green-600" : "text-[var(--muted)]"}>
                        {u.ativo ? "Ativo" : "Inativo"}
                      </span>
                      {u.ativo && !u.senhaDefinida && (
                        <span className="block text-[11px] text-amber-600">
                          Aguardando 1º acesso
                          {u.codigoConvite && (
                            <> · código <span className="font-mono font-semibold">{u.codigoConvite}</span></>
                          )}
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-left space-x-3 whitespace-nowrap">
                      <button
                        onClick={() => (editingId === u.id ? setEditingId(null) : iniciarEdicao(u))}
                        className="text-[var(--primary)] hover:underline"
                      >
                        {editingId === u.id ? "Fechar" : "Editar acessos"}
                      </button>
                      <button
                        onClick={() => resetarSenha(u)}
                        className="text-[var(--primary)] hover:underline"
                      >
                        Resetar senha
                      </button>
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
                  {editingId === u.id && (
                    <tr className="bg-gray-50">
                      <td colSpan={5} className="p-4">
                        <div className="space-y-3 max-w-md">
                          <TabCheckboxes selected={editTabs} onChange={setEditTabs} />
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={editFaturamento}
                              onChange={(e) => setEditFaturamento(e.target.checked)}
                            />
                            Pode ver o faturamento da Oficina
                          </label>
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={editStatus}
                              onChange={(e) => setEditStatus(e.target.checked)}
                            />
                            Pode alterar o status/padrão dos containers (Estoque/Oficina)
                          </label>
                          <button
                            onClick={() => salvarEdicao(u)}
                            className="btn btn-primary"
                          >
                            Salvar permissões
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  );
}
