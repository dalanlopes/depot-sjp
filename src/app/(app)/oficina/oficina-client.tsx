"use client";

import { useEffect, useState, useCallback } from "react";
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  LabelList,
} from "recharts";
import { formatDateBR, todayBR } from "@/lib/tz";
import { DM_OPCOES, PADROES, PADRAO_LABELS, type Dm } from "@/lib/types";
import CodeSelect from "@/components/code-select";

interface ReparoRow {
  id: string;
  data: string;
  container_numero: string;
  armador: string;
  padrao: string;
  dm: Dm | null;
  por_conta_depot: boolean;
  valor_faturado?: string | null;
  faturado_em?: string | null;
}

interface PontoDia {
  data: string;
  quantidade: number;
}

function todayStr() {
  return todayBR();
}

function formatDia(iso: string) {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: PontoDia }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="card p-2.5 text-xs shadow-lg">
      <p className="font-semibold mb-0.5">{formatDia(p.data)}</p>
      <p>{p.quantidade} reparo(s)</p>
      <p className="text-[var(--muted)]">Clique para ver o DM do dia</p>
    </div>
  );
}

export default function OficinaClient({
  canRegister,
  canFinance,
  canEditFinance = canFinance,
  canEditPadrao,
}: {
  canRegister: boolean;
  canFinance: boolean;
  canEditFinance?: boolean;
  canEditPadrao: boolean;
}) {
  const [rows, setRows] = useState<ReparoRow[]>([]);
  const [meta, setMeta] = useState(35);
  const [faltam, setFaltam] = useState(35);
  const [valorEstimado, setValorEstimado] = useState<number | undefined>(undefined);

  const [numero, setNumero] = useState("");
  const [dm, setDm] = useState<Dm>("DM1");
  const [checking, setChecking] = useState(false);
  const [pending, setPending] = useState<{ numero: string; dm: Dm }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [excluindoReparo, setExcluindoReparo] = useState<string | null>(null);
  const [savingPadrao, setSavingPadrao] = useState<string | null>(null);

  const [series7d, setSeries7d] = useState<PontoDia[]>([]);
  const [metaDiaria, setMetaDiaria] = useState(35);

  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null);
  const [diaSelecionadoDm, setDiaSelecionadoDm] = useState<Record<string, number> | null>(null);
  const [diaSelecionadoLoading, setDiaSelecionadoLoading] = useState(false);

  const [historyDate, setHistoryDate] = useState(todayStr());
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyRows, setHistoryRows] = useState<ReparoRow[]>([]);

  const load = useCallback(async () => {
    const res = await fetch("/api/reparos");
    const data = await res.json();
    setRows(data.reparos ?? []);
    setMeta(data.meta ?? 35);
    setFaltam(data.faltamParaMeta ?? Math.max((data.meta ?? 35) - (data.reparos?.length ?? 0), 0));
    setValorEstimado(data.valorEstimado);
  }, []);

  const loadSummary = useCallback(async () => {
    const res = await fetch("/api/reparos/summary");
    if (res.ok) {
      const data = await res.json();
      setSeries7d(data.series7d ?? []);
      setMetaDiaria(data.metaDiaria ?? 35);
    }
  }, []);

  useEffect(() => {
    load();
    loadSummary();
    const interval = setInterval(() => {
      load();
      loadSummary();
    }, 60000);
    return () => clearInterval(interval);
  }, [load, loadSummary]);

  async function handleBarClick(point: PontoDia) {
    if (diaSelecionado === point.data) {
      setDiaSelecionado(null);
      setDiaSelecionadoDm(null);
      return;
    }
    setDiaSelecionado(point.data);
    setDiaSelecionadoLoading(true);
    const res = await fetch(`/api/reparos?data=${point.data}`);
    if (res.ok) {
      const data = await res.json();
      const counts: Record<string, number> = Object.fromEntries(DM_OPCOES.map((o) => [o, 0]));
      for (const r of (data.reparos ?? []) as ReparoRow[]) {
        if (r.dm && counts[r.dm] !== undefined) counts[r.dm] += 1;
      }
      setDiaSelecionadoDm(counts);
    }
    setDiaSelecionadoLoading(false);
  }

  async function addPending() {
    const n = numero.trim().toUpperCase();
    setAddError(null);
    if (!n) return;
    if (pending.some((p) => p.numero === n)) {
      setAddError("Esse container já está na lista.");
      return;
    }
    setChecking(true);
    try {
      const res = await fetch(`/api/containers/check?numero=${encodeURIComponent(n)}`);
      const data = await res.json();
      if (!res.ok) {
        setAddError(data.error ?? "Erro ao consultar o estoque.");
        return;
      }
      if (!data.existe) {
        setAddError("Container não encontrado no estoque.");
        return;
      }
      setPending((prev) => [...prev, { numero: n, dm }]);
      setNumero("");
    } finally {
      setChecking(false);
    }
  }

  async function submitAll() {
    if (pending.length === 0) return;
    setSubmitting(true);
    setMessage(null);
    const res = await fetch("/api/reparos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itens: pending }),
    });
    const data = await res.json();
    setSubmitting(false);
    setPending([]);
    if (data.failed?.length) {
      setMessage(
        `${data.created.length} registrado(s). Falhas: ${data.failed
          .map((f: { numero: string; motivo: string }) => `${f.numero} (${f.motivo})`)
          .join(", ")}`
      );
    } else {
      setMessage(`${data.created.length} container(s) marcados como OK.`);
    }
    load();
    loadSummary();
  }

  async function saveValor(id: string) {
    const raw = editing[id];
    const valor = Number(raw?.replace(",", "."));
    if (Number.isNaN(valor)) return;
    await fetch(`/api/reparos/${id}/valor`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ valor }),
    });
    load();
    if (historyOpen) abrirHistorico(historyDate);
  }

  async function toggleDepot(r: ReparoRow) {
    await fetch(`/api/reparos/${r.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ porContaDepot: !r.por_conta_depot }),
    });
    load();
    loadSummary();
    if (historyOpen) abrirHistorico(historyDate);
  }

  async function salvarPadrao(r: ReparoRow, novoPadrao: string) {
    if (novoPadrao === r.padrao) return;
    setSavingPadrao(r.id);
    await fetch(`/api/containers/${encodeURIComponent(r.container_numero)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ padrao: novoPadrao }),
    });
    setSavingPadrao(null);
    load();
    if (historyOpen) abrirHistorico(historyDate);
  }

  async function excluirReparo(r: ReparoRow) {
    if (!confirm(`Excluir o reparo do container ${r.container_numero}?`)) return;
    setExcluindoReparo(r.id);
    await fetch(`/api/reparos/${r.id}`, { method: "DELETE" });
    setExcluindoReparo(null);
    load();
    loadSummary();
    if (historyOpen) abrirHistorico(historyDate);
  }

  async function abrirHistorico(dia: string) {
    setHistoryDate(dia);
    setHistoryOpen(true);
    setHistoryLoading(true);
    const res = await fetch(`/api/reparos?data=${dia}`);
    if (res.ok) {
      const data = await res.json();
      setHistoryRows(data.reparos ?? []);
    }
    setHistoryLoading(false);
  }

  const atingiuMeta = rows.length >= meta;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4">
          <p className="text-xs text-[var(--muted)] mb-1">Reparados hoje</p>
          <p className="text-2xl font-bold">{rows.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-[var(--muted)] mb-1">Faltam para a meta ({meta})</p>
          <p className={`text-2xl font-bold ${atingiuMeta ? "text-[var(--success)]" : "text-[var(--warning)]"}`}>
            {faltam}
          </p>
        </div>
        {canFinance && (
          <div className="card p-4">
            <p className="text-xs text-[var(--muted)] mb-1">Valor já estimado (faturamento)</p>
            <p className="text-2xl font-bold">
              R$ {(valorEstimado ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
          </div>
        )}
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-semibold mb-3">Últimos 7 dias</h2>
        <div style={{ height: 150 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={series7d} margin={{ top: 20, right: 4, left: 0, bottom: 0 }}>
              <XAxis dataKey="data" tickFormatter={formatDia} tick={{ fontSize: 11 }} interval={0} />
              <YAxis
                tick={{ fontSize: 11 }}
                allowDecimals={false}
                width={28}
                domain={[0, (max: number) => Math.max(max, metaDiaria)]}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(22,163,74,0.06)" }} />
              <ReferenceLine
                y={metaDiaria}
                stroke="var(--muted)"
                strokeDasharray="4 4"
                label={{ value: `Meta ${metaDiaria}`, fontSize: 10, position: "insideTopRight" }}
              />
              <Bar
                dataKey="quantidade"
                radius={[6, 6, 0, 0]}
                maxBarSize={28}
                cursor="pointer"
                onClick={(point) => handleBarClick(point as unknown as PontoDia)}
              >
                <LabelList dataKey="quantidade" position="top" style={{ fontSize: 11, fontWeight: 600 }} />
                {series7d.map((p) => (
                  <Cell key={p.data} fill={p.quantidade >= metaDiaria ? "var(--success)" : "var(--danger)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {diaSelecionado && (
          <div className="mt-4 border-t border-[var(--border)] pt-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-[var(--muted)]">
                DM em {formatDateBR(`${diaSelecionado}T12:00:00-03:00`)}
              </p>
              <button
                type="button"
                onClick={() => { setDiaSelecionado(null); setDiaSelecionadoDm(null); }}
                className="text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
              >
                Fechar
              </button>
            </div>
            {diaSelecionadoLoading ? (
              <p className="text-sm text-[var(--muted)]">Carregando...</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {DM_OPCOES.map((opt) => (
                  <div key={opt} className="rounded-xl bg-indigo-50 px-3 py-2.5 text-center">
                    <p className="text-[11px] font-semibold text-indigo-700">{opt}</p>
                    <p className="text-lg font-bold text-indigo-900">{diaSelecionadoDm?.[opt] ?? 0}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {canRegister && (
        <div className="card p-4">
          <h2 className="text-sm font-semibold mb-3">Registrar containers reparados</h2>
          <div className="flex gap-2 flex-wrap items-center">
            <input
              className="input max-w-[220px]"
              placeholder="Número do container"
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addPending())}
            />
            <select className="input max-w-[110px]" value={dm} onChange={(e) => setDm(e.target.value as Dm)}>
              {DM_OPCOES.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
            <button className="btn btn-secondary disabled:opacity-50" onClick={addPending} type="button" disabled={checking}>
              {checking ? "Verificando..." : "Adicionar"}
            </button>
            <button
              className="btn btn-primary disabled:opacity-50"
              onClick={submitAll}
              disabled={pending.length === 0 || submitting}
            >
              {submitting ? "Salvando..." : `Salvar (${pending.length})`}
            </button>
          </div>
          {addError && <p className="text-sm text-[var(--danger)] mt-2">{addError}</p>}
          {pending.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {pending.map((p) => (
                <span key={p.numero} className="badge bg-indigo-50 text-indigo-700">
                  {p.numero} · {p.dm}
                  <button
                    onClick={() => setPending(pending.filter((x) => x.numero !== p.numero))}
                    className="ml-1"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          {message && (
            <p className="text-sm text-[var(--muted)] mt-3">{message}</p>
          )}
        </div>
      )}

      <div className="card p-4">
        <h2 className="text-sm font-semibold mb-3">Consultar histórico de reparos</h2>
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-3">
          <div className="w-full sm:w-auto overflow-hidden rounded-xl">
            <label className="text-xs font-medium text-[var(--muted)] block mb-1">Data</label>
            <input
              type="date"
              className="input"
              value={historyDate}
              onChange={(e) => abrirHistorico(e.target.value)}
            />
          </div>
          <button type="button" className="btn btn-secondary w-full sm:w-auto" onClick={() => abrirHistorico(historyDate)}>
            Ver reparados
          </button>
        </div>
      </div>

      {historyOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => setHistoryOpen(false)}
        >
          <div
            className="card p-4 sm:p-6 w-full max-w-4xl max-h-[85vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold">Reparados em {formatDateBR(`${historyDate}T12:00:00-03:00`)}</h3>
              <button onClick={() => setHistoryOpen(false)} className="text-[var(--muted)] hover:text-[var(--foreground)] text-xl leading-none">
                ×
              </button>
            </div>
            {historyLoading && <p className="text-sm text-[var(--muted)]">Carregando...</p>}
            {!historyLoading && (
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-[var(--muted)] border-b border-[var(--border)]">
                    <th className="px-3 py-2 font-medium">Container</th>
                    <th className="px-3 py-2 font-medium">DM</th>
                    <th className="px-3 py-2 font-medium">Armador</th>
                    <th className="px-3 py-2 font-medium">Padrão</th>
                    <th className="px-3 py-2 font-medium">Data do Reparo</th>
                    {canFinance && <th className="px-3 py-2 font-medium">Faturamento</th>}
                  </tr>
                </thead>
                <tbody>
                  {historyRows.map((r) => (
                    <tr key={r.id} className="border-b border-[var(--border)] last:border-0 hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium">
                        {r.container_numero}
                        {r.por_conta_depot && (
                          <span className="ml-1.5 badge bg-amber-100 text-amber-700 text-[10px]">Depot</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-[var(--muted)]">{r.dm ?? "—"}</td>
                      <td className="px-3 py-2">{r.armador}</td>
                      <td className="px-3 py-2">
                        {canEditPadrao ? (
                          <CodeSelect
                            value={r.padrao}
                            disabled={savingPadrao === r.id}
                            onChange={(v) => salvarPadrao(r, v)}
                            options={PADROES.map((p) => ({ value: p, label: PADRAO_LABELS[p] }))}
                          />
                        ) : (
                          r.padrao
                        )}
                      </td>
                      <td className="px-3 py-2 text-[var(--muted)]">{formatDateBR(r.data)}</td>
                      {canFinance && (
                        <td className="px-3 py-2">
                          {canEditFinance ? (
                            <>
                              <label className="flex items-center gap-1.5 text-[10px] text-[var(--muted)] mb-1.5">
                                <input
                                  type="checkbox"
                                  checked={r.por_conta_depot}
                                  onChange={() => toggleDepot(r)}
                                />
                                Por conta do Depot
                              </label>
                              <div className="flex items-center gap-2">
                                {r.por_conta_depot ? (
                                  <span className="text-xs text-[var(--muted)]">Não cobrado</span>
                                ) : (
                                  <>
                                    <input
                                      className="input max-w-[110px]"
                                      placeholder="0,00"
                                      defaultValue={r.valor_faturado ?? ""}
                                      onChange={(e) =>
                                        setEditing((prev) => ({ ...prev, [r.id]: e.target.value }))
                                      }
                                    />
                                    <button
                                      className="btn btn-secondary text-xs px-2 py-1"
                                      onClick={() => saveValor(r.id)}
                                    >
                                      Salvar
                                    </button>
                                  </>
                                )}
                                <button
                                  className="text-xs text-[var(--danger)] hover:underline disabled:opacity-50"
                                  onClick={() => excluirReparo(r)}
                                  disabled={excluindoReparo === r.id}
                                >
                                  {excluindoReparo === r.id ? "..." : "Excluir"}
                                </button>
                              </div>
                            </>
                          ) : r.por_conta_depot ? (
                            <span className="text-xs text-[var(--muted)]">Por conta do Depot (não cobrado)</span>
                          ) : (
                            <span className="text-xs">
                              {r.valor_faturado
                                ? `R$ ${Number(r.valor_faturado).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                                : "—"}
                            </span>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                  {historyRows.length === 0 && (
                    <tr>
                      <td colSpan={canFinance ? 6 : 5} className="px-3 py-8 text-center text-[var(--muted)]">
                        Nenhum reparo registrado nesse dia.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
