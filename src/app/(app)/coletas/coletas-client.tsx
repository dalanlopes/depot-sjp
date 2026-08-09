"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { formatDateBR, formatDateTimeBR } from "@/lib/tz";
import { SOLICITANTE_LABELS, type SolicitanteTipo, type TipoCarga } from "@/lib/types";

interface ColetaRow {
  id: string;
  container_numero: string | null;
  armador: string | null;
  padrao: string | null;
  codigo_cm_veiculo: string;
  data: string;
  tipo_carga: TipoCarga | null;
  cliente: string | null;
}

interface PendenteRow {
  id: string;
  programacao_id: string;
  data_retirada: string;
  solicitante: string;
  destino: SolicitanteTipo;
  armador: string;
  programacao_quantidade: number;
}

interface Summary {
  coletasDoDia: number;
  concluidasHoje: number;
  estoqueDisponivel: number;
  metaSemanal: number;
  coletadosSemana: number;
  faltamSemana: number;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoStr(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export default function ColetasClient() {
  const [summary, setSummary] = useState<Summary | null>(null);

  const [pendentes, setPendentes] = useState<PendenteRow[]>([]);
  const [loadingPendentes, setLoadingPendentes] = useState(true);
  const [inputContainer, setInputContainer] = useState<Record<string, string>>({});
  const [inputCm, setInputCm] = useState<Record<string, string>>({});
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [pendMessage, setPendMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  const [codigoCm, setCodigoCm] = useState("");
  const [numero, setNumero] = useState("");
  const [dataSaida, setDataSaida] = useState(todayStr());
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [showAvulso, setShowAvulso] = useState(false);

  const [rows, setRows] = useState<ColetaRow[]>([]);
  const [loadingReport, setLoadingReport] = useState(true);
  const [filtroInicio, setFiltroInicio] = useState(daysAgoStr(29));
  const [filtroFim, setFiltroFim] = useState(todayStr());

  const loadSummary = useCallback(async () => {
    const res = await fetch("/api/coletas/summary");
    if (res.ok) setSummary(await res.json());
  }, []);

  const loadPendentes = useCallback(async () => {
    setLoadingPendentes(true);
    const res = await fetch("/api/coletas?tipo=pendentes");
    if (res.ok) {
      const data = await res.json();
      setPendentes(data.pendentes ?? []);
    }
    setLoadingPendentes(false);
  }, []);

  const loadReport = useCallback(async () => {
    setLoadingReport(true);
    const params = new URLSearchParams({ inicio: filtroInicio, fim: filtroFim });
    const res = await fetch(`/api/coletas?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      setRows(data.coletas ?? []);
    }
    setLoadingReport(false);
  }, [filtroInicio, filtroFim]);

  useEffect(() => {
    loadSummary();
    loadPendentes();
  }, [loadSummary, loadPendentes]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  function refreshAll() {
    loadSummary();
    loadPendentes();
    loadReport();
  }

  const grupos = useMemo(() => {
    const map = new Map<
      string,
      { data_retirada: string; solicitante: string; destino: SolicitanteTipo; armador: string; quantidade: number; itens: PendenteRow[] }
    >();
    for (const p of pendentes) {
      const g = map.get(p.programacao_id);
      if (g) {
        g.itens.push(p);
      } else {
        map.set(p.programacao_id, {
          data_retirada: p.data_retirada,
          solicitante: p.solicitante,
          destino: p.destino,
          armador: p.armador,
          quantidade: p.programacao_quantidade,
          itens: [p],
        });
      }
    }
    return Array.from(map.entries()).sort((a, b) => a[1].data_retirada.localeCompare(b[1].data_retirada));
  }, [pendentes]);

  async function confirmarPendente(p: PendenteRow) {
    setConfirmando(p.id);
    setPendMessage(null);
    const container = inputContainer[p.id]?.trim().toUpperCase();
    const cm = inputCm[p.id]?.trim();
    if (!container) {
      setPendMessage({ type: "error", text: "Informe a numeração do container." });
      setConfirmando(null);
      return;
    }
    if (!cm) {
      setPendMessage({ type: "error", text: "Informe o código do CM." });
      setConfirmando(null);
      return;
    }
    const res = await fetch(`/api/coletas/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ containerNumero: container, codigoCmVeiculo: cm }),
    });
    const data = await res.json();
    setConfirmando(null);
    if (res.ok) {
      setPendMessage({ type: "ok", text: `Coleta confirmada: ${container} (CM ${cm}).` });
      setInputContainer((prev) => ({ ...prev, [p.id]: "" }));
      setInputCm((prev) => ({ ...prev, [p.id]: "" }));
      refreshAll();
    } else {
      setPendMessage({ type: "error", text: data.error ?? "Erro ao confirmar coleta." });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/coletas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ containerNumero: numero, codigoCmVeiculo: codigoCm, data: dataSaida }),
    });
    const data = await res.json();
    setSaving(false);
    if (res.ok) {
      setMessage({ type: "ok", text: `Saída processada para o container ${numero.toUpperCase()}.` });
      setNumero("");
      setCodigoCm("");
      setDataSaida(todayStr());
      refreshAll();
    } else {
      setMessage({ type: "error", text: data.error ?? "Erro ao processar a coleta." });
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-xs text-[var(--muted)] mb-1">Coletas para hoje</p>
          <p className="text-2xl font-bold">{summary?.coletasDoDia ?? "—"}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-[var(--muted)] mb-1">Já concluídas</p>
          <p className="text-2xl font-bold text-[var(--success)]">{summary?.concluidasHoje ?? "—"}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-[var(--muted)] mb-1">Disponíveis em estoque (alimento)</p>
          <p className="text-2xl font-bold">{summary?.estoqueDisponivel ?? "—"}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-[var(--muted)] mb-1">
            Faltam para fechar a semana ({summary?.coletadosSemana ?? 0}/{summary?.metaSemanal ?? 175})
          </p>
          <p className={`text-2xl font-bold ${(summary?.faltamSemana ?? 1) === 0 ? "text-[var(--success)]" : "text-[var(--warning)]"}`}>
            {summary?.faltamSemana ?? "—"}
          </p>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold mb-3">Coletas pendentes (vindas da Programação)</h2>
        {loadingPendentes && <p className="text-sm text-[var(--muted)]">Carregando...</p>}
        {!loadingPendentes && grupos.length === 0 && (
          <div className="card p-10 text-center text-sm text-[var(--muted)]">
            Nenhuma coleta pendente no momento.
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {grupos.map(([programacaoId, g]) => (
            <div key={programacaoId} className="card overflow-hidden">
              <button
                type="button"
                onClick={() => setExpandedGroup((prev) => (prev === programacaoId ? null : programacaoId))}
                className="w-full text-left p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold">{formatDateBR(`${g.data_retirada}T12:00:00-03:00`)}</span>
                  <span className="badge bg-amber-100 text-amber-700">
                    {g.itens.length} pendente{g.itens.length > 1 ? "s" : ""} de {g.quantidade}
                  </span>
                </div>
                <p className="text-sm text-[var(--muted)]">{g.solicitante || "—"}</p>
                <p className="text-xs text-[var(--muted)] mt-1">
                  {SOLICITANTE_LABELS[g.destino]} · {g.armador}
                </p>
              </button>
              {expandedGroup === programacaoId && (
                <div className="border-t border-[var(--border)] p-4 bg-gray-50 space-y-3">
                  {g.itens.map((p) => (
                    <div key={p.id} className="flex flex-wrap gap-2 items-center">
                      <input
                        className="input flex-1 min-w-[140px]"
                        placeholder="Número do container"
                        value={inputContainer[p.id] ?? ""}
                        onChange={(e) => setInputContainer((prev) => ({ ...prev, [p.id]: e.target.value }))}
                      />
                      <input
                        className="input flex-1 min-w-[120px]"
                        placeholder="Código CM"
                        value={inputCm[p.id] ?? ""}
                        onChange={(e) => setInputCm((prev) => ({ ...prev, [p.id]: e.target.value }))}
                      />
                      <button
                        className="btn btn-primary text-xs px-3 py-1.5 disabled:opacity-50"
                        onClick={() => confirmarPendente(p)}
                        disabled={confirmando === p.id}
                      >
                        {confirmando === p.id ? "Salvando..." : "Confirmar"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        {pendMessage && (
          <p className={`text-sm mt-2 ${pendMessage.type === "ok" ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
            {pendMessage.text}
          </p>
        )}
      </div>

      <div>
        <button
          type="button"
          className="text-xs font-medium text-[var(--primary)]"
          onClick={() => setShowAvulso((v) => !v)}
        >
          {showAvulso ? "Ocultar registro avulso" : "+ Registrar coleta avulsa (sem programação)"}
        </button>
        {showAvulso && (
          <form onSubmit={handleSubmit} className="card p-5 max-w-lg space-y-4 mt-3">
            <div>
              <label className="text-sm font-medium block mb-1.5">Código CM do Veículo</label>
              <input
                className="input"
                value={codigoCm}
                onChange={(e) => setCodigoCm(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5">Número do Container</label>
              <input
                className="input"
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5">Data da Saída</label>
              <input
                type="date"
                className="input"
                value={dataSaida}
                onChange={(e) => setDataSaida(e.target.value)}
                required
              />
            </div>
            <button type="submit" disabled={saving} className="btn btn-primary disabled:opacity-60">
              {saving ? "Processando..." : "Registrar Saída"}
            </button>
            {message && (
              <p className={`text-sm ${message.type === "ok" ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
                {message.text}
              </p>
            )}
          </form>
        )}
      </div>

      <div>
        <h2 className="text-sm font-semibold mb-3">Relatório de Saídas</h2>
        <div className="card p-4 mb-4 flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-xs font-medium text-[var(--muted)] block mb-1">De</label>
            <input
              type="date"
              className="input"
              value={filtroInicio}
              onChange={(e) => setFiltroInicio(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--muted)] block mb-1">Até</label>
            <input
              type="date"
              className="input"
              value={filtroFim}
              onChange={(e) => setFiltroFim(e.target.value)}
            />
          </div>
          <button onClick={loadReport} className="btn btn-secondary" type="button">
            Atualizar
          </button>
          <span className="text-xs text-[var(--muted)] ml-auto">
            {loadingReport ? "Carregando..." : `${rows.length} saída(s) no período`}
          </span>
        </div>

        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-[var(--muted)] border-b border-[var(--border)]">
                <th className="px-4 py-3 font-medium">Número</th>
                <th className="px-4 py-3 font-medium">Armador</th>
                <th className="px-4 py-3 font-medium">Padrão</th>
                <th className="px-4 py-3 font-medium">Código CM</th>
                <th className="px-4 py-3 font-medium">Data da Saída</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-[var(--border)] last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{r.container_numero ?? "—"}</td>
                  <td className="px-4 py-3">{r.armador ?? "—"}</td>
                  <td className="px-4 py-3">{r.padrao ?? "—"}</td>
                  <td className="px-4 py-3">{r.codigo_cm_veiculo}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">{formatDateTimeBR(r.data)}</td>
                </tr>
              ))}
              {!loadingReport && rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-[var(--muted)]">
                    Nenhuma saída registrada no período.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
