"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { ARMADORES, SOLICITANTES, SOLICITANTE_LABELS, PADRAO_LABELS, type Armador, type SolicitanteTipo } from "@/lib/types";
import { formatDateBR, formatDateTimeBR, todayBR } from "@/lib/tz";

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

export default function ProgramacaoClient() {
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

  const loadRows = useCallback(async () => {
    setLoadingRows(true);
    const res = await fetch("/api/programacao?dias=14");
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
    const map = new Map<string, ProgramacaoRow[]>();
    for (const r of rows) {
      const arr = map.get(r.data_retirada);
      if (arr) arr.push(r);
      else map.set(r.data_retirada, [r]);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows]);

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

      <div>
        <h2 className="text-sm font-semibold mb-3">Programações recentes</h2>
        {loadingRows && <p className="text-sm text-[var(--muted)]">Carregando...</p>}
        {!loadingRows && porData.length === 0 && (
          <div className="card p-10 text-center text-sm text-[var(--muted)]">
            Nenhuma programação nos últimos 14 dias.
          </div>
        )}
        <div className="space-y-4">
          {porData.map(([data, itens]) => (
            <div key={data} className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--border)] bg-gray-50">
                <span className="text-sm font-semibold">{formatDateBR(`${data}T12:00:00-03:00`)}</span>
              </div>
              <div>
                {itens.map((r) => {
                  const completo = r.realizada >= r.quantidade;
                  const faltam = Math.max(r.quantidade - r.realizada, 0);
                  return (
                    <div key={r.id} className="border-b border-[var(--border)] last:border-0 flex items-stretch">
                      <button
                        type="button"
                        onClick={() => toggleCard(r.id)}
                        className="flex-1 text-left px-4 py-3 hover:bg-gray-50 transition-colors flex items-center justify-between gap-3 min-w-0"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{r.solicitante || "—"}</p>
                          <p className="text-xs text-[var(--muted)] mt-0.5">
                            {SOLICITANTE_LABELS[r.destino]} · {r.armador}
                          </p>
                        </div>
                        <span className={`badge shrink-0 ${completo ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                          {r.realizada} realizada{r.realizada === 1 ? "" : "s"} · {faltam} falta{faltam === 1 ? "" : "m"}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => excluirProgramacao(r)}
                        disabled={excluindo === r.id}
                        className="px-3 text-[var(--muted)] hover:text-[var(--danger)] hover:bg-red-50 transition-colors shrink-0 disabled:opacity-50"
                        title="Excluir programação"
                      >
                        {excluindo === r.id ? "..." : "🗑"}
                      </button>
                      {expandedId === r.id && (
                        <div className="border-t border-[var(--border)] p-4 bg-gray-50 text-sm space-y-2">
                          {loadingDetalhe === r.id && <p className="text-[var(--muted)]">Carregando...</p>}
                          {loadingDetalhe !== r.id && (detalhes[r.id]?.length ?? 0) === 0 && (
                            <p className="text-[var(--muted)]">Nenhuma vaga registrada.</p>
                          )}
                          {loadingDetalhe !== r.id &&
                            detalhes[r.id]?.map((c) => (
                              <div key={c.id} className="flex items-center justify-between border-b border-[var(--border)] last:border-0 pb-2 last:pb-0">
                                {c.status === "CONCLUIDO" ? (
                                  <>
                                    <span className="font-medium">{c.container_numero}</span>
                                    <span className="text-[var(--muted)]">CM {c.codigo_cm_veiculo}</span>
                                    <span className="text-[var(--muted)]">{c.padrao ? PADRAO_LABELS[c.padrao as keyof typeof PADRAO_LABELS] : "—"}</span>
                                    <span className="text-[var(--muted)]">{c.data ? formatDateTimeBR(c.data) : "—"}</span>
                                  </>
                                ) : (
                                  <span className="text-amber-600">Pendente de container e CM</span>
                                )}
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
