"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { formatDateBR, formatDateTimeBR, todayBR, addDaysBR, nowHourBR } from "@/lib/tz";
import { SOLICITANTE_LABELS, type SolicitanteTipo } from "@/lib/types";

interface ColetaRow {
  id: string;
  container_numero: string | null;
  armador: string | null;
  padrao: string | null;
  codigo_cm_veiculo: string;
  data: string;
  cliente: string | null;
}

interface SaidaExternaRow {
  id: string;
  container_numero: string;
  armador: string | null;
  padrao: string | null;
  tipo: string | null;
  data_saida: string;
  booking: string | null;
  exportador: string | null;
  navio: string | null;
  vg: string | null;
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

interface FormState {
  cm: string;
  containers: string[];
}

interface ProgramacaoGrupo {
  data_retirada: string;
  solicitante: string;
  destino: SolicitanteTipo;
  armador: string;
  quantidade: number;
  itens: PendenteRow[];
}

function todayStr() {
  return todayBR();
}

export default function ColetasClient({
  podeConfirmar = true,
  podeExcluirSaidaExterna = false,
}: {
  podeConfirmar?: boolean;
  podeExcluirSaidaExterna?: boolean;
}) {
  const [summary, setSummary] = useState<Summary | null>(null);

  const [pendentes, setPendentes] = useState<PendenteRow[]>([]);
  const [loadingPendentes, setLoadingPendentes] = useState(true);
  const [formState, setFormState] = useState<Record<string, FormState>>({});
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [pendMessage, setPendMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  // Mesma regra da aba Programação: mostra hoje, os próximos 4 dias, e o dia
  // anterior só até 12h depois da virada (turno que passa da meia-noite).
  // Tudo começa fechado; clique no cabeçalho da data pra abrir.
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

  const [rows, setRows] = useState<ColetaRow[] | null>(null);
  const [excluindoColeta, setExcluindoColeta] = useState<string | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [filtroInicio, setFiltroInicio] = useState(todayStr());
  const [filtroFim, setFiltroFim] = useState(todayStr());

  const [rowsExternas, setRowsExternas] = useState<SaidaExternaRow[] | null>(null);
  const [excluindoExterna, setExcluindoExterna] = useState<string | null>(null);
  const [loadingExternas, setLoadingExternas] = useState(false);
  const [filtroInicioExt, setFiltroInicioExt] = useState(todayStr());
  const [filtroFimExt, setFiltroFimExt] = useState(todayStr());

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

  const loadExternas = useCallback(async () => {
    setLoadingExternas(true);
    const params = new URLSearchParams({ inicio: filtroInicioExt, fim: filtroFimExt });
    const res = await fetch(`/api/containers/saida-externa?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      setRowsExternas(data.saidas ?? []);
    }
    setLoadingExternas(false);
  }, [filtroInicioExt, filtroFimExt]);

  useEffect(() => {
    loadSummary();
    loadPendentes();
    const interval = setInterval(() => {
      loadSummary();
      loadPendentes();
    }, 60000);
    return () => clearInterval(interval);
  }, [loadSummary, loadPendentes]);

  // Os relatórios abaixo só carregam quando o usuário clica em "Pesquisar" —
  // não buscam nada sozinhos ao abrir a página.
  function refreshAll() {
    loadSummary();
    loadPendentes();
    if (rows !== null) loadReport();
    if (rowsExternas !== null) loadExternas();
  }

  async function excluirSaidaExterna(r: SaidaExternaRow) {
    if (!confirm(`Excluir a saída externa do container ${r.container_numero}?`)) return;
    setExcluindoExterna(r.id);
    const res = await fetch(`/api/containers/saida-externa/${r.id}`, { method: "DELETE" });
    setExcluindoExterna(null);
    if (res.ok) {
      loadExternas();
    }
  }

  const porData = useMemo(() => {
    const byProg = new Map<string, ProgramacaoGrupo>();
    for (const p of pendentes) {
      const g = byProg.get(p.programacao_id);
      if (g) g.itens.push(p);
      else
        byProg.set(p.programacao_id, {
          data_retirada: p.data_retirada,
          solicitante: p.solicitante,
          destino: p.destino,
          armador: p.armador,
          quantidade: p.programacao_quantidade,
          itens: [p],
        });
    }

    const datasVisiveis = new Set([
      hoje,
      addDaysBR(hoje, 1),
      addDaysBR(hoje, 2),
      addDaysBR(hoje, 3),
      addDaysBR(hoje, 4),
      ...(ontemNaJanela ? [ontem] : []),
    ]);

    const byDate = new Map<string, [string, ProgramacaoGrupo][]>();
    for (const [progId, g] of byProg) {
      if (!datasVisiveis.has(g.data_retirada)) continue;
      const arr = byDate.get(g.data_retirada);
      if (arr) arr.push([progId, g]);
      else byDate.set(g.data_retirada, [[progId, g]]);
    }
    return Array.from(byDate.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [pendentes, hoje, ontem, ontemNaJanela]);

  function getForm(programacaoId: string): FormState {
    return formState[programacaoId] ?? { cm: "", containers: [""] };
  }

  function updateForm(programacaoId: string, patch: Partial<FormState>) {
    setFormState((prev) => ({ ...prev, [programacaoId]: { ...getForm(programacaoId), ...patch } }));
  }

  function updateContainer(programacaoId: string, index: number, value: string) {
    const form = getForm(programacaoId);
    const containers = form.containers.map((c, i) => (i === index ? value : c));
    updateForm(programacaoId, { containers });
  }

  function addContainerField(programacaoId: string) {
    const form = getForm(programacaoId);
    if (form.containers.length >= 2) return;
    updateForm(programacaoId, { containers: [...form.containers, ""] });
  }

  function removeContainerField(programacaoId: string, index: number) {
    const form = getForm(programacaoId);
    if (form.containers.length <= 1) return;
    updateForm(programacaoId, { containers: form.containers.filter((_, i) => i !== index) });
  }

  async function excluirColeta(r: ColetaRow) {
    if (!confirm(`Excluir a coleta do container ${r.container_numero ?? "—"}?`)) return;
    setExcluindoColeta(r.id);
    const res = await fetch(`/api/coletas/${r.id}`, { method: "DELETE" });
    setExcluindoColeta(null);
    if (res.ok) {
      refreshAll();
    } else {
      const data = await res.json().catch(() => ({}));
      setPendMessage({ type: "error", text: data.error ?? "Erro ao excluir a coleta." });
    }
  }

  async function confirmarGrupo(programacaoId: string, itens: PendenteRow[]) {
    const form = getForm(programacaoId);
    const cm = form.cm.trim();
    const containers = form.containers.map((c) => c.trim().toUpperCase()).filter(Boolean);

    setPendMessage(null);
    if (containers.length === 0) {
      setPendMessage({ type: "error", text: "Informe ao menos um container." });
      return;
    }
    if (!cm) {
      setPendMessage({ type: "error", text: "Informe o código do CM." });
      return;
    }
    if (new Set(containers).size !== containers.length) {
      setPendMessage({ type: "error", text: "Os containers precisam ser diferentes." });
      return;
    }

    setConfirmando(programacaoId);
    for (let i = 0; i < containers.length; i++) {
      const pendente = itens[i];
      // Dentro do número de vagas pendentes, preenche a vaga existente.
      // Além disso (2º container no mesmo CM sem vaga formal), cria um
      // registro extra direto vinculado à mesma programação.
      const res = pendente
        ? await fetch(`/api/coletas/${pendente.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ containerNumero: containers[i], codigoCmVeiculo: cm }),
          })
        : await fetch(`/api/programacao/${programacaoId}/coletas`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ containerNumero: containers[i], codigoCmVeiculo: cm }),
          });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setPendMessage({ type: "error", text: data.error ?? `Erro ao confirmar o container ${containers[i]}.` });
        setConfirmando(null);
        refreshAll();
        return;
      }
    }
    setConfirmando(null);
    setPendMessage({ type: "ok", text: `Coleta confirmada: ${containers.join(", ")} (CM ${cm}).` });
    setFormState((prev) => ({ ...prev, [programacaoId]: { cm: "", containers: [""] } }));
    refreshAll();
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
        {!loadingPendentes && porData.length === 0 && (
          <div className="card p-10 text-center text-sm text-[var(--muted)]">
            Nenhuma coleta pendente nos próximos dias.
          </div>
        )}
        <div className="space-y-4">
          {porData.map(([data, progGroups]) => {
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
                  {progGroups.length} pedido{progGroups.length === 1 ? "" : "s"}
                  <span className={`transition-transform ${dataAberta ? "rotate-180" : ""}`}>▾</span>
                </span>
              </button>
              {dataAberta && (
              <div>
                {progGroups.map(([programacaoId, g]) => {
                  const form = getForm(programacaoId);
                  return (
                    <div key={programacaoId} className="border-b border-[var(--border)] last:border-0">
                      <button
                        type="button"
                        onClick={() => setExpandedGroup((prev) => (prev === programacaoId ? null : programacaoId))}
                        className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors flex items-center justify-between gap-3"
                      >
                        <div>
                          <p className="text-sm font-medium">{g.armador}</p>
                          <p className="text-xs text-[var(--muted)] mt-0.5">
                            {SOLICITANTE_LABELS[g.destino]} · {g.solicitante || "—"}
                          </p>
                        </div>
                        <span className="badge shrink-0 bg-amber-100 text-amber-700">
                          {g.itens.length} pendente{g.itens.length > 1 ? "s" : ""} de {g.quantidade}
                        </span>
                      </button>
                      {expandedGroup === programacaoId && (
                        <div className="border-t border-[var(--border)] p-4 bg-gray-50 space-y-3">
                          {podeConfirmar ? (
                          <>
                          <div className="flex flex-wrap gap-2 items-center">
                            {form.containers.map((c, i) => (
                              <div key={i} className="flex items-center gap-1">
                                <input
                                  className="input flex-1 min-w-[140px]"
                                  placeholder={i === 0 ? "Número do container" : "2º container (mesmo CM)"}
                                  value={c}
                                  onChange={(e) => updateContainer(programacaoId, i, e.target.value)}
                                />
                                {i === 1 && (
                                  <button
                                    type="button"
                                    onClick={() => removeContainerField(programacaoId, i)}
                                    className="text-[var(--muted)] hover:text-[var(--danger)] px-1 text-lg leading-none"
                                    aria-label="Remover container"
                                  >
                                    ×
                                  </button>
                                )}
                              </div>
                            ))}
                            <input
                              className="input flex-1 min-w-[120px]"
                              placeholder="Código CM"
                              value={form.cm}
                              onChange={(e) => updateForm(programacaoId, { cm: e.target.value })}
                            />
                            <button
                              className="btn btn-primary text-xs px-3 py-1.5 disabled:opacity-50"
                              onClick={() => confirmarGrupo(programacaoId, g.itens)}
                              disabled={confirmando === programacaoId}
                            >
                              {confirmando === programacaoId ? "Salvando..." : "Confirmar"}
                            </button>
                          </div>
                          {form.containers.length < 2 && (
                            <button
                              type="button"
                              onClick={() => addContainerField(programacaoId)}
                              className="text-xs font-medium text-[var(--primary)]"
                            >
                              + Adicionar outro container para o mesmo CM
                            </button>
                          )}
                          </>
                          ) : (
                            <p className="text-xs text-[var(--muted)]">
                              {g.itens.length} vaga{g.itens.length > 1 ? "s" : ""} pendente{g.itens.length > 1 ? "s" : ""} de container e CM.
                            </p>
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
        {pendMessage && (
          <p className={`text-sm mt-2 ${pendMessage.type === "ok" ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
            {pendMessage.text}
          </p>
        )}
      </div>

      <div>
        <h2 className="text-sm font-semibold mb-3">Relatório de Saídas</h2>
        <div className="card p-4 mb-4 flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:items-end">
          <div className="w-full sm:w-auto overflow-hidden rounded-xl">
            <label className="text-xs font-medium text-[var(--muted)] block mb-1">De</label>
            <input
              type="date"
              className="input"
              value={filtroInicio}
              onChange={(e) => setFiltroInicio(e.target.value)}
            />
          </div>
          <div className="w-full sm:w-auto overflow-hidden rounded-xl">
            <label className="text-xs font-medium text-[var(--muted)] block mb-1">Até</label>
            <input
              type="date"
              className="input"
              value={filtroFim}
              onChange={(e) => setFiltroFim(e.target.value)}
            />
          </div>
          <button onClick={loadReport} className="btn btn-primary w-full sm:w-auto" type="button">
            {loadingReport ? "Pesquisando..." : "Pesquisar"}
          </button>
          {rows !== null && (
            <span className="text-xs text-[var(--muted)] sm:ml-auto">
              {loadingReport ? "Carregando..." : `${rows.length} saída(s) no período`}
            </span>
          )}
        </div>

        {rows !== null && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-[var(--muted)] border-b border-[var(--border)]">
                <th className="px-4 py-3 font-medium">Número</th>
                <th className="px-4 py-3 font-medium">Armador</th>
                <th className="px-4 py-3 font-medium">Padrão</th>
                <th className="px-4 py-3 font-medium">Código CM</th>
                <th className="px-4 py-3 font-medium">Data da Saída</th>
                {podeConfirmar && <th className="px-4 py-3 font-medium"></th>}
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
                  {podeConfirmar && (
                  <td className="px-4 py-3 text-right">
                    <button
                      className="text-xs text-[var(--danger)] hover:underline disabled:opacity-50"
                      onClick={() => excluirColeta(r)}
                      disabled={excluindoColeta === r.id}
                    >
                      {excluindoColeta === r.id ? "..." : "Excluir"}
                    </button>
                  </td>
                  )}
                </tr>
              ))}
              {!loadingReport && rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-[var(--muted)]">
                    Nenhuma saída registrada no período.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Saídas Externas (planilha do terminal)</h2>
          <a
            href={`/api/containers/saida-externa/export?inicio=${filtroInicioExt}&fim=${filtroFimExt}`}
            className="btn btn-secondary text-xs px-3 py-1.5"
          >
            Exportar Excel
          </a>
        </div>
        <p className="text-xs text-[var(--muted)] mb-3">
          Saídas registradas pela planilha do sistema do terminal, separadas das saídas via CM acima.
        </p>
        <div className="card p-4 mb-4 flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:items-end">
          <div className="w-full sm:w-auto overflow-hidden rounded-xl">
            <label className="text-xs font-medium text-[var(--muted)] block mb-1">De</label>
            <input
              type="date"
              className="input"
              value={filtroInicioExt}
              onChange={(e) => setFiltroInicioExt(e.target.value)}
            />
          </div>
          <div className="w-full sm:w-auto overflow-hidden rounded-xl">
            <label className="text-xs font-medium text-[var(--muted)] block mb-1">Até</label>
            <input
              type="date"
              className="input"
              value={filtroFimExt}
              onChange={(e) => setFiltroFimExt(e.target.value)}
            />
          </div>
          <button onClick={loadExternas} className="btn btn-primary w-full sm:w-auto" type="button">
            {loadingExternas ? "Pesquisando..." : "Pesquisar"}
          </button>
          {rowsExternas !== null && (
            <span className="text-xs text-[var(--muted)] sm:ml-auto">
              {loadingExternas ? "Carregando..." : `${rowsExternas.length} saída(s) no período`}
            </span>
          )}
        </div>

        {rowsExternas !== null && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-[var(--muted)] border-b border-[var(--border)]">
                <th className="px-4 py-3 font-medium">Número</th>
                <th className="px-4 py-3 font-medium">Armador</th>
                <th className="px-4 py-3 font-medium">Padrão</th>
                <th className="px-4 py-3 font-medium">Exportador</th>
                <th className="px-4 py-3 font-medium">Navio</th>
                <th className="px-4 py-3 font-medium">Data da Saída</th>
                {podeExcluirSaidaExterna && <th className="px-4 py-3 font-medium"></th>}
              </tr>
            </thead>
            <tbody>
              {rowsExternas.map((r) => (
                <tr key={r.id} className="border-b border-[var(--border)] last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{r.container_numero}</td>
                  <td className="px-4 py-3">{r.armador ?? "—"}</td>
                  <td className="px-4 py-3">{r.padrao ?? "—"}</td>
                  <td className="px-4 py-3">{r.exportador ?? "—"}</td>
                  <td className="px-4 py-3">{r.navio ?? "—"}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">{formatDateTimeBR(r.data_saida)}</td>
                  {podeExcluirSaidaExterna && (
                  <td className="px-4 py-3 text-right">
                    <button
                      className="text-xs text-[var(--danger)] hover:underline disabled:opacity-50"
                      onClick={() => excluirSaidaExterna(r)}
                      disabled={excluindoExterna === r.id}
                    >
                      {excluindoExterna === r.id ? "..." : "Excluir"}
                    </button>
                  </td>
                  )}
                </tr>
              ))}
              {!loadingExternas && rowsExternas.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-[var(--muted)]">
                    Nenhuma saída externa registrada no período.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
