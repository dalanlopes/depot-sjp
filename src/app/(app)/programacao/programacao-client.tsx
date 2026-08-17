"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { ARMADORES, SOLICITANTES, SOLICITANTE_LABELS, PADRAO_LABELS, type Armador, type SolicitanteTipo } from "@/lib/types";
import { formatDateBR, formatDateTimeBR, todayBR, addDaysBR, nowHourBR } from "@/lib/tz";

interface ProgramacaoRow {
  id: string;
  data_retirada: string;
  solicitante: string;
  destino: SolicitanteTipo;
  armador: Armador;
  quantidade: number;
  realizada: number;
  criado_em: string;
}

interface ColetaDetalhe {
  id: string;
  container_numero: string | null;
  codigo_cm_veiculo: string | null;
  status: "PENDENTE" | "CONCLUIDO";
  data: string | null;
  padrao: string | null;
}

export default function ProgramacaoClient({ podeEditar = true }: { podeEditar?: boolean }) {
  const [dataRetirada, setDataRetirada] = useState(() => todayBR());
  const [solicitante, setSolicitante] = useState("");
  const [destino, setDestino] = useState<SolicitanteTipo>("MATRIZ");
  const [armador, setArmador] = useState<Armador>(ARMADORES[0]);
  const [quantidade, setQuantidade] = useState("1");

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const [rows, setRows] = useState<ProgramacaoRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(true);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detalhes, setDetalhes] = useState<Record<string, ColetaDetalhe[]>>({});
  const [loadingDetalhe, setLoadingDetalhe] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState<string | null>(null);
  const [removerQtd, setRemoverQtd] = useState<Record<string, string>>({});
  const [removendo, setRemovendo] = useState<string | null>(null);
  const [removerMsg, setRemoverMsg] = useState<{ id: string; type: "ok" | "error"; text: string } | null>(null);

  // A lista mostra hoje, os próximos 4 dias (programações futuras já
  // registradas) e, até 12h depois da virada do dia, o dia anterior também
  // (pra quem está fechando um turno que passou da meia-noite). Depois disso
  // o dia anterior some da lista — o histórico completo fica no Relatórios.
  // Todas as datas vêm fechadas por padrão; clique no cabeçalho pra abrir.
  const hoje = todayBR();
  const ontem = addDaysBR(hoje, -1);
  const ontemNaJanela = nowHourBR() < 12;

  const [expandedDates, setExpandedDates] = useState<Set<string>>(() => new Set());

  function toggleDate(data: string) {
    setExpandedDates((prev) => {
      const next = new Set(prev);
      if (next.has(data)) next.delete(data);
      else next.add(data);
      return next;
    });
  }

  const loadRows = useCallback(async () => {
    setLoadingRows(true);
    const res = await fetch("/api/programacao?dias=1");
    if (res.ok) {
      const data = await res.json();
      setRows(data.programacoes ?? []);
    }
    setLoadingRows(false);
  }, []);

  useEffect(() => {
    loadRows();
    const interval = setInterval(loadRows, 60000);
    return () => clearInterval(interval);
  }, [loadRows]);

  const porData = useMemo(() => {
    const datasVisiveis = new Set([
      hoje,
      addDaysBR(hoje, 1),
      addDaysBR(hoje, 2),
      addDaysBR(hoje, 3),
      addDaysBR(hoje, 4),
      ...(ontemNaJanela ? [ontem] : []),
    ]);
    const map = new Map<string, ProgramacaoRow[]>();
    for (const r of rows) {
      if (!datasVisiveis.has(r.data_retirada)) continue;
      const arr = map.get(r.data_retirada);
      if (arr) arr.push(r);
      else map.set(r.data_retirada, [r]);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows, hoje, ontem, ontemNaJanela]);

  async function excluirProgramacao(r: ProgramacaoRow) {
    if (!confirm(`Excluir a programação de ${r.solicitante || "—"} (${formatDateBR(`${r.data_retirada}T12:00:00-03:00`)})?`)) return;
    setExcluindo(r.id);
    const res = await fetch(`/api/programacao/${r.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    setExcluindo(null);
    if (res.ok) {
      loadRows();
    } else {
      setMessage({ type: "error", text: data.error ?? "Erro ao excluir a programação." });
    }
  }

  async function removerVagas(r: ProgramacaoRow) {
    const faltam = Math.max(r.quantidade - r.realizada, 0);
    const qtd = Math.max(1, Math.min(faltam, parseInt(removerQtd[r.id] ?? "1", 10) || 0));
    if (!confirm(`Remover ${qtd} vaga(s) pendente(s) de ${r.armador} (${r.solicitante || "—"})?`)) return;
    setRemovendo(r.id);
    setRemoverMsg(null);
    const res = await fetch(`/api/programacao/${r.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ removerQuantidade: qtd }),
    });
    const data = await res.json().catch(() => ({}));
    setRemovendo(null);
    if (res.ok) {
      setRemoverQtd((prev) => ({ ...prev, [r.id]: "1" }));
      setDetalhes((prev) => {
        const next = { ...prev };
        delete next[r.id];
        return next;
      });
      loadRows();
    } else {
      setRemoverMsg({ id: r.id, type: "error", text: data.error ?? "Erro ao remover vagas." });
    }
  }

  async function toggleCard(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (!detalhes[id]) {
      setLoadingDetalhe(id);
      const res = await fetch(`/api/programacao/${id}/coletas`);
      if (res.ok) {
        const data = await res.json();
        setDetalhes((prev) => ({ ...prev, [id]: data.coletas ?? [] }));
      }
      setLoadingDetalhe(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const qtd = Math.max(1, parseInt(quantidade, 10) || 0);
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/programacao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataRetirada, solicitante, destino, armador, quantidade: qtd }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setMessage({ type: "ok", text: "Programação registrada com sucesso." });
        setSolicitante("");
        setDestino("MATRIZ");
        setQuantidade("1");
        loadRows();
      } else {
        setMessage({ type: "error", text: data.error ?? "Erro ao registrar. Verifique os campos." });
      }
    } catch {
      setMessage({ type: "error", text: "Erro ao conectar. Tente novamente." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {podeEditar && (
      <form onSubmit={handleSubmit} className="card p-5 max-w-xl space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="overflow-hidden rounded-xl">
            <label className="text-sm font-medium block mb-1.5">Data da Retirada</label>
            <input
              type="date"
              className="input"
              value={dataRetirada}
              onChange={(e) => setDataRetirada(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">Solicitante</label>
            <input
              className="input uppercase"
              value={solicitante}
              onChange={(e) => setSolicitante(e.target.value.toUpperCase())}
              placeholder="Nome"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium block mb-1.5">Destino</label>
            <select className="input" value={destino} onChange={(e) => setDestino(e.target.value as SolicitanteTipo)}>
              {SOLICITANTES.map((s) => (
                <option key={s} value={s}>{SOLICITANTE_LABELS[s]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">Armador</label>
            <select className="input" value={armador} onChange={(e) => setArmador(e.target.value as Armador)}>
              {ARMADORES.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium block mb-1.5">Quantidade de containers</label>
          <input
            type="number"
            min={1}
            className="input max-w-[140px]"
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
            onBlur={() => {
              if (!quantidade || Number(quantidade) < 1) setQuantidade("1");
            }}
            required
          />
          <p className="text-[11px] text-[var(--muted)] mt-1">
            O container e o CM de cada unidade são informados depois, na aba Coletas.
          </p>
        </div>

        <button type="submit" disabled={saving} className="btn btn-primary disabled:opacity-60">
          {saving ? "Salvando..." : "Registrar Programação"}
        </button>
        {message && (
          <p className={`text-sm ${message.type === "ok" ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
            {message.text}
          </p>
        )}
      </form>
      )}

      <div>
        <h2 className="text-sm font-semibold mb-3">Programações recentes</h2>
        {loadingRows && <p className="text-sm text-[var(--muted)]">Carregando...</p>}
        {!loadingRows && porData.length === 0 && (
          <div className="card p-10 text-center text-sm text-[var(--muted)]">
            Nenhuma programação nos próximos dias.
          </div>
        )}
        <div className="space-y-4">
          {porData.map(([data, itens]) => {
            const dataAberta = expandedDates.has(data);
            return (
            <div key={data} className="card overflow-hidden">
              <button
                type="button"
                onClick={() => toggleDate(data)}
                className="w-full px-4 py-3 border-b border-[var(--border)] bg-gray-50 flex items-center justify-between hover:bg-gray-100 transition-colors"
              >
                <span className="text-sm font-semibold">{formatDateBR(`${data}T12:00:00-03:00`)}</span>
                <span className="text-xs text-[var(--muted)] flex items-center gap-2">
                  {itens.length} pedido{itens.length === 1 ? "" : "s"}
                  <span className={`transition-transform ${dataAberta ? "rotate-180" : ""}`}>▾</span>
                </span>
              </button>
              {dataAberta && (
              <div>
                {itens.map((r) => {
                  const completo = r.realizada >= r.quantidade;
                  const faltam = Math.max(r.quantidade - r.realizada, 0);
                  return (
                    <div key={r.id} className="border-b border-[var(--border)] last:border-0">
                      <div className="flex items-stretch">
                        <button
                          type="button"
                          onClick={() => toggleCard(r.id)}
                          className="flex-1 text-left px-4 py-3 hover:bg-gray-50 transition-colors flex items-center justify-between gap-3 min-w-0"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{r.armador}</p>
                            <p className="text-xs text-[var(--muted)] mt-0.5">
                              {SOLICITANTE_LABELS[r.destino]} · {r.solicitante || "—"}
                            </p>
                          </div>
                          <span className={`badge shrink-0 ${completo ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                            {r.realizada} realizada{r.realizada === 1 ? "" : "s"} · {faltam} falta{faltam === 1 ? "" : "m"}
                          </span>
                        </button>
                        {podeEditar && (
                        <button
                          type="button"
                          onClick={() => excluirProgramacao(r)}
                          disabled={excluindo === r.id}
                          className="px-3 text-[var(--muted)] hover:text-[var(--danger)] hover:bg-red-50 transition-colors shrink-0 disabled:opacity-50"
                          title="Excluir programação"
                        >
                          {excluindo === r.id ? "..." : "🗑"}
                        </button>
                        )}
                      </div>
                      {expandedId === r.id && (
                        <div className="border-t border-[var(--border)] p-4 bg-gray-50">
                          {podeEditar && faltam > 0 && (
                            <div className="flex flex-wrap items-end gap-2 mb-4 pb-4 border-b border-[var(--border)]">
                              <div>
                                <label className="text-xs font-medium text-[var(--muted)] block mb-1">
                                  Remover vagas pendentes ({faltam} dispon{faltam === 1 ? "ível" : "íveis"})
                                </label>
                                <input
                                  type="number"
                                  min={1}
                                  max={faltam}
                                  className="input max-w-[100px]"
                                  value={removerQtd[r.id] ?? "1"}
                                  onChange={(e) => setRemoverQtd((prev) => ({ ...prev, [r.id]: e.target.value }))}
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => removerVagas(r)}
                                disabled={removendo === r.id}
                                className="btn btn-secondary text-xs px-3 py-1.5 disabled:opacity-50"
                              >
                                {removendo === r.id ? "Removendo..." : "Remover"}
                              </button>
                              {removerMsg?.id === r.id && (
                                <p className="text-xs text-[var(--danger)] w-full">{removerMsg.text}</p>
                              )}
                            </div>
                          )}
                          {loadingDetalhe === r.id && <p className="text-sm text-[var(--muted)]">Carregando...</p>}
                          {loadingDetalhe !== r.id && (detalhes[r.id]?.length ?? 0) === 0 && (
                            <p className="text-sm text-[var(--muted)]">Nenhuma vaga registrada.</p>
                          )}
                          {loadingDetalhe !== r.id && (detalhes[r.id]?.length ?? 0) > 0 && (
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="text-left text-[10px] uppercase tracking-wide text-[var(--muted)] border-b border-[var(--border)]">
                                    <th className="py-1.5 pr-3 font-medium">Vaga</th>
                                    <th className="py-1.5 pr-3 font-medium">Container</th>
                                    <th className="py-1.5 pr-3 font-medium">CM</th>
                                    <th className="py-1.5 pr-3 font-medium">Padrão</th>
                                    <th className="py-1.5 font-medium">Status</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {detalhes[r.id]?.map((c, i) => (
                                    <tr key={c.id} className="border-b border-[var(--border)] last:border-0">
                                      <td className="py-1.5 pr-3 text-[var(--muted)]">{i + 1}</td>
                                      <td className="py-1.5 pr-3 font-medium">{c.container_numero ?? "—"}</td>
                                      <td className="py-1.5 pr-3">{c.codigo_cm_veiculo ?? "—"}</td>
                                      <td className="py-1.5 pr-3">
                                        {c.padrao ? PADRAO_LABELS[c.padrao as keyof typeof PADRAO_LABELS] : "—"}
                                      </td>
                                      <td className="py-1.5">
                                        {c.status === "CONCLUIDO" ? (
                                          <span className="badge bg-green-100 text-green-700 text-[10px]">
                                            {c.data ? formatDateTimeBR(c.data) : "Concluído"}
                                          </span>
                                        ) : (
                                          <span className="badge bg-amber-100 text-amber-700 text-[10px]">Pendente</span>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              )}
            </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
