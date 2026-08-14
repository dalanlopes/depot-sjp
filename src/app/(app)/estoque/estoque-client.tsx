"use client";

import { useEffect, useState, useCallback } from "react";
import StatusBadge from "@/components/status-badge";
import CodeSelect from "@/components/code-select";
import { formatDateBR, diasEmEstoque } from "@/lib/tz";
import { PADROES, PADRAO_LABELS, STATUS_CONTAINER, STATUS_LABELS, type StatusContainer, type Armador, type Padrao } from "@/lib/types";

interface ArmadorSummary {
  armador: Armador;
  total: number;
  alimentoOk: number;
  cargaGeralOk: number;
  avariadas: number;
  aguardandoVistoria: number;
}

interface ContainerDetalhe {
  numero: string;
  armador: Armador;
  padrao: Padrao;
  status: StatusContainer;
  tipo: string | null;
  entrada: string | null;
  valor_estimado: string | null;
  valor_reparo: string | null;
  faturado_em: string | null;
}

export default function EstoqueClient({ canEdit = false }: { canEdit?: boolean }) {
  const [armadores, setArmadores] = useState<ArmadorSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const [selecionado, setSelecionado] = useState<Armador | null>(null);
  const [detalhes, setDetalhes] = useState<ContainerDetalhe[]>([]);
  const [loadingDetalhe, setLoadingDetalhe] = useState(false);
  const [status, setStatus] = useState("");
  const [padrao, setPadrao] = useState("");
  const [buscaNumero, setBuscaNumero] = useState("");
  const [savingStatus, setSavingStatus] = useState<string | null>(null);
  const [savingPadrao, setSavingPadrao] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/containers/summary");
    const data = await res.json();
    setArmadores(data.armadores ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadSummary();
    const interval = setInterval(loadSummary, 60000);
    return () => clearInterval(interval);
  }, [loadSummary]);

  const loadDetalhe = useCallback(async (armador: Armador) => {
    setLoadingDetalhe(true);
    const params = new URLSearchParams({ armador });
    if (status) params.set("status", status);
    if (padrao) params.set("padrao", padrao);
    const res = await fetch(`/api/containers?${params.toString()}`);
    const data = await res.json();
    setDetalhes(data.containers ?? []);
    setLoadingDetalhe(false);
  }, [status, padrao]);

  useEffect(() => {
    if (selecionado) loadDetalhe(selecionado);
  }, [selecionado, loadDetalhe]);

  async function salvarStatus(numero: string, novoStatus: string) {
    setSavingStatus(numero);
    await fetch(`/api/containers/${encodeURIComponent(numero)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: novoStatus }),
    });
    setSavingStatus(null);
    if (selecionado) loadDetalhe(selecionado);
    loadSummary();
  }

  async function salvarPadrao(numero: string, novoPadrao: string) {
    setSavingPadrao(numero);
    await fetch(`/api/containers/${encodeURIComponent(numero)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ padrao: novoPadrao }),
    });
    setSavingPadrao(null);
    if (selecionado) loadDetalhe(selecionado);
    loadSummary();
  }

  const detalhesFiltrados = buscaNumero.trim()
    ? detalhes.filter((c) => c.numero.toUpperCase().includes(buscaNumero.trim().toUpperCase()))
    : detalhes;

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-2">
        {armadores.map((a) => (
          <button
            key={a.armador}
            onClick={() => setSelecionado(a.armador)}
            className="card p-4 text-left hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold">{a.armador}</span>
              <span className="text-lg font-bold">{a.total}</span>
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-green-700">OK · Alimento</span>
                <span className="font-semibold text-green-700">{a.alimentoOk}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">OK · Carga Geral</span>
                <span className="font-semibold text-gray-600">{a.cargaGeralOk}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-red-700">Avariadas</span>
                <span className="font-semibold text-red-700">{a.avariadas}</span>
              </div>
              {a.aguardandoVistoria > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-[var(--muted)]">Aguardando vistoria</span>
                  <span className="font-semibold text-[var(--muted)]">{a.aguardandoVistoria}</span>
                </div>
              )}
            </div>
          </button>
        ))}
        {!loading && armadores.length === 0 && (
          <p className="text-sm text-[var(--muted)] col-span-full text-center py-10">
            Nenhum container em estoque.
          </p>
        )}
      </div>

      {selecionado && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => setSelecionado(null)}
        >
          <div
            className="card p-4 sm:p-6 w-full max-w-4xl max-h-[85vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold">{selecionado} · Unidades em estoque</h3>
              <button onClick={() => setSelecionado(null)} className="text-[var(--muted)] hover:text-[var(--foreground)] text-xl leading-none">
                ×
              </button>
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1.5 mb-4 text-xs text-[var(--muted)]">
              {STATUS_CONTAINER.map((s) => (
                <span key={s} className="inline-flex items-center gap-1.5">
                  <StatusBadge status={s} />
                  {STATUS_LABELS[s]}
                </span>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:items-end mb-4">
              <div>
                <label className="text-xs font-medium text-[var(--muted)] block mb-1">Buscar número</label>
                <input
                  className="input"
                  placeholder="Ex: CAAU7936686"
                  value={buscaNumero}
                  onChange={(e) => setBuscaNumero(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--muted)] block mb-1">Status</label>
                <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="">Todos</option>
                  {STATUS_CONTAINER.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--muted)] block mb-1">Padrão</label>
                <select className="input" value={padrao} onChange={(e) => setPadrao(e.target.value)}>
                  <option value="">Todos</option>
                  {PADROES.map((p) => (
                    <option key={p} value={p}>{p} · {PADRAO_LABELS[p]}</option>
                  ))}
                </select>
              </div>
              <a
                href={`/api/containers/export?${new URLSearchParams({
                  ...(selecionado ? { armador: selecionado } : {}),
                  ...(status ? { status } : {}),
                  ...(padrao ? { padrao } : {}),
                  ...(buscaNumero.trim() ? { numero: buscaNumero.trim() } : {}),
                }).toString()}`}
                className="btn btn-secondary text-xs px-3 py-1.5"
              >
                Exportar Excel
              </a>
              <span className="text-xs text-[var(--muted)] ml-auto">
                {loadingDetalhe ? "Carregando..." : `${detalhesFiltrados.length} containers`}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-[var(--muted)] border-b border-[var(--border)]">
                    <th className="px-3 py-2 font-medium">Número</th>
                    <th className="px-3 py-2 font-medium">Tipo</th>
                    <th className="px-3 py-2 font-medium">Padrão</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Entrada</th>
                    <th className="px-3 py-2 font-medium">Dias em estoque</th>
                  </tr>
                </thead>
                <tbody>
                  {detalhesFiltrados.map((c) => {
                    const dias = diasEmEstoque(c.entrada);
                    return (
                      <tr key={c.numero} className="border-b border-[var(--border)] last:border-0 hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium">{c.numero}</td>
                        <td className="px-3 py-2">{c.tipo ?? "—"}</td>
                        <td className="px-3 py-2">
                          {canEdit ? (
                            <CodeSelect
                              value={c.padrao}
                              disabled={savingPadrao === c.numero}
                              onChange={(v) => salvarPadrao(c.numero, v)}
                              options={PADROES.map((p) => ({ value: p, label: PADRAO_LABELS[p] }))}
                            />
                          ) : (
                            c.padrao
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {canEdit ? (
                            <CodeSelect
                              value={c.status}
                              disabled={savingStatus === c.numero}
                              onChange={(v) => salvarStatus(c.numero, v)}
                              options={STATUS_CONTAINER.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
                            />
                          ) : (
                            <StatusBadge status={c.status} />
                          )}
                        </td>
                        <td className="px-3 py-2 text-[var(--muted)]">
                          {c.entrada ? formatDateBR(c.entrada) : "—"}
                        </td>
                        <td className="px-3 py-2 text-[var(--muted)]">{dias !== null ? `${dias} dia(s)` : "—"}</td>
                      </tr>
                    );
                  })}
                  {!loadingDetalhe && detalhesFiltrados.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-center text-[var(--muted)]">
                        Nenhum container encontrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
