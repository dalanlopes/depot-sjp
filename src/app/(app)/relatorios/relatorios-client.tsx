"use client";

import { useState } from "react";
import { formatDateBR, formatDateTimeBR, todayBR } from "@/lib/tz";
import {
  ARMADORES,
  PADROES,
  PADRAO_LABELS,
  STATUS_CONTAINER,
  STATUS_LABELS,
  SOLICITANTE_LABELS,
  type Armador,
  type SolicitanteTipo,
} from "@/lib/types";

type Processo =
  | "estoque"
  | "oficina"
  | "ocorrencias"
  | "programacao"
  | "coletas"
  | "entradas"
  | "saidasGeral"
  | "saidasExternas";

interface ColetaProgramacao {
  id: string;
  container_numero: string | null;
  codigo_cm_veiculo: string | null;
  status: "PENDENTE" | "CONCLUIDO";
  data: string | null;
  padrao: string | null;
}

interface Acesso {
  estoque: boolean;
  oficina: boolean;
  ocorrencias: boolean;
  programacao: boolean;
  coletas: boolean;
  entradas: boolean;
  saidasGeral: boolean;
  saidasExternas: boolean;
}

const PROCESSO_LABELS: Record<Processo, string> = {
  estoque: "Estoque",
  oficina: "Oficina (reparos)",
  ocorrencias: "Ocorrências",
  programacao: "Programação",
  coletas: "Coletas",
  entradas: "Entradas",
  saidasGeral: "Saídas (CM + Externa)",
  saidasExternas: "Saídas Externas",
};

export default function RelatoriosClient({ acesso }: { acesso: Acesso }) {
  const opcoes = (Object.keys(PROCESSO_LABELS) as Processo[]).filter((p) => acesso[p]);
  const [processo, setProcesso] = useState<Processo | "">(opcoes[0] ?? "");

  // Filtros
  const [armador, setArmador] = useState("");
  const [status, setStatus] = useState("");
  const [padrao, setPadrao] = useState("");
  const [numero, setNumero] = useState("");
  // De/Até começam no mesmo dia (hoje) — quem pesquisa é que escolhe abrir o
  // período, não carregamos um intervalo grande por padrão.
  const [inicio, setInicio] = useState(todayBR());
  const [fim, setFim] = useState(todayBR());

  const [rows, setRows] = useState<Record<string, unknown>[] | null>(null);
  const [loading, setLoading] = useState(false);

  // Popout "containers liberados" — aberto ao clicar no solicitante de uma
  // linha de Programação, mostra as coletas (containers) já vinculadas a ela.
  const [liberadosOpen, setLiberadosOpen] = useState(false);
  const [liberadosLoading, setLiberadosLoading] = useState(false);
  const [liberadosId, setLiberadosId] = useState<string | null>(null);
  const [liberadosInfo, setLiberadosInfo] = useState<{ solicitante: string; data: string } | null>(null);
  const [liberadosRows, setLiberadosRows] = useState<ColetaProgramacao[]>([]);

  function buildParams() {
    const params = new URLSearchParams();
    if (processo === "estoque") {
      if (armador) params.set("armador", armador);
      if (status) params.set("status", status);
      if (padrao) params.set("padrao", padrao);
      if (numero.trim()) params.set("numero", numero.trim());
    } else {
      params.set("inicio", inicio);
      params.set("fim", fim);
    }
    return params;
  }

  function baseEndpoint(p: Processo) {
    if (p === "estoque") return "containers";
    if (p === "oficina") return "reparos";
    if (p === "entradas") return "containers/entradas";
    if (p === "saidasGeral") return "containers/saidas-geral";
    if (p === "saidasExternas") return "containers/saida-externa";
    return p;
  }

  async function gerar() {
    if (!processo) return;
    setLoading(true);
    setRows(null);
    const params = buildParams();
    const res = await fetch(`/api/${baseEndpoint(processo)}?${params.toString()}`);
    const data = await res.json();
    let lista: Record<string, unknown>[] =
      data.containers ??
      data.reparos ??
      data.ocorrencias ??
      data.programacoes ??
      data.coletas ??
      data.entradas ??
      data.saidas ??
      [];
    if (processo === "estoque" && numero.trim()) {
      const q = numero.trim().toUpperCase();
      lista = lista.filter((c) => String(c.numero ?? "").toUpperCase().includes(q));
    }
    setRows(lista);
    setLoading(false);
  }

  const exportHref = processo ? `/api/${baseEndpoint(processo)}/export?${buildParams().toString()}` : "#";

  async function abrirLiberados(p: Record<string, unknown>) {
    const id = String(p.id ?? "");
    if (!id) return;
    setLiberadosOpen(true);
    setLiberadosId(id);
    setLiberadosLoading(true);
    setLiberadosInfo({
      solicitante: String(p.solicitante ?? ""),
      data: String(p.data_retirada ?? ""),
    });
    const res = await fetch(`/api/programacao/${id}/coletas`);
    if (res.ok) {
      const data = await res.json();
      setLiberadosRows(data.coletas ?? []);
    } else {
      setLiberadosRows([]);
    }
    setLiberadosLoading(false);
  }

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:items-end">
          <div>
            <label className="text-xs font-medium text-[var(--muted)] block mb-1">Processo</label>
            <select
              className="input min-w-[180px]"
              value={processo}
              onChange={(e) => {
                setProcesso(e.target.value as Processo);
                setRows(null);
              }}
            >
              {opcoes.map((p) => (
                <option key={p} value={p}>
                  {PROCESSO_LABELS[p]}
                </option>
              ))}
            </select>
          </div>

          {processo === "estoque" ? (
            <>
              <div>
                <label className="text-xs font-medium text-[var(--muted)] block mb-1">Armador</label>
                <select className="input" value={armador} onChange={(e) => setArmador(e.target.value)}>
                  <option value="">Todos</option>
                  {ARMADORES.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--muted)] block mb-1">Status</label>
                <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="">Todos</option>
                  {STATUS_CONTAINER.map((s) => (
                    <option key={s} value={s}>{s} · {STATUS_LABELS[s]}</option>
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
              <div>
                <label className="text-xs font-medium text-[var(--muted)] block mb-1">Buscar número</label>
                <input className="input" placeholder="Ex: CAAU7936686" value={numero} onChange={(e) => setNumero(e.target.value)} />
              </div>
            </>
          ) : (
            <>
              <div className="overflow-hidden rounded-xl">
                <label className="text-xs font-medium text-[var(--muted)] block mb-1">De</label>
                <input type="date" className="input" value={inicio} onChange={(e) => setInicio(e.target.value)} />
              </div>
              <div className="overflow-hidden rounded-xl">
                <label className="text-xs font-medium text-[var(--muted)] block mb-1">Até</label>
                <input type="date" className="input" value={fim} onChange={(e) => setFim(e.target.value)} />
              </div>
            </>
          )}

          <button type="button" onClick={gerar} disabled={!processo || loading} className="btn btn-primary disabled:opacity-60">
            {loading ? "Gerando..." : "Gerar relatório"}
          </button>
          {rows !== null && (
            <a href={exportHref} className="btn btn-secondary">
              Exportar Excel
            </a>
          )}
        </div>
        {opcoes.length === 0 && (
          <p className="text-sm text-[var(--muted)] mt-3">
            Você não tem acesso a nenhum processo com relatório disponível.
          </p>
        )}
      </div>

      {rows !== null && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border)] bg-gray-50 flex items-center justify-between">
            <span className="text-sm font-semibold">{PROCESSO_LABELS[processo as Processo]}</span>
            <span className="text-xs text-[var(--muted)]">{rows.length} registro(s)</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-[var(--muted)] border-b border-[var(--border)]">
                  {processo === "estoque" && (
                    <>
                      <th className="px-3 py-2 font-medium">Número</th>
                      <th className="px-3 py-2 font-medium">Armador</th>
                      <th className="px-3 py-2 font-medium">Padrão</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium">Entrada</th>
                    </>
                  )}
                  {processo === "oficina" && (
                    <>
                      <th className="px-3 py-2 font-medium">Data</th>
                      <th className="px-3 py-2 font-medium">Container</th>
                      <th className="px-3 py-2 font-medium">Armador</th>
                      <th className="px-3 py-2 font-medium">Padrão</th>
                      <th className="px-3 py-2 font-medium">DM</th>
                      <th className="px-3 py-2 font-medium">Upgrade</th>
                    </>
                  )}
                  {processo === "ocorrencias" && (
                    <>
                      <th className="px-3 py-2 font-medium">Data</th>
                      <th className="px-3 py-2 font-medium">Motivo</th>
                      <th className="px-3 py-2 font-medium">Registrado por</th>
                    </>
                  )}
                  {processo === "programacao" && (
                    <>
                      <th className="px-3 py-2 font-medium">Data</th>
                      <th className="px-3 py-2 font-medium">Solicitante</th>
                      <th className="px-3 py-2 font-medium">Destino</th>
                      <th className="px-3 py-2 font-medium">Armador</th>
                      <th className="px-3 py-2 font-medium">Qtd.</th>
                      <th className="px-3 py-2 font-medium">Realizada</th>
                    </>
                  )}
                  {processo === "coletas" && (
                    <>
                      <th className="px-3 py-2 font-medium">Número</th>
                      <th className="px-3 py-2 font-medium">Armador</th>
                      <th className="px-3 py-2 font-medium">Padrão</th>
                      <th className="px-3 py-2 font-medium">Código CM</th>
                      <th className="px-3 py-2 font-medium">Data da Saída</th>
                    </>
                  )}
                  {processo === "saidasExternas" && (
                    <>
                      <th className="px-3 py-2 font-medium">Número</th>
                      <th className="px-3 py-2 font-medium">Armador</th>
                      <th className="px-3 py-2 font-medium">Padrão</th>
                      <th className="px-3 py-2 font-medium">Exportador</th>
                      <th className="px-3 py-2 font-medium">Navio</th>
                      <th className="px-3 py-2 font-medium">Data da Saída</th>
                    </>
                  )}
                  {processo === "entradas" && (
                    <>
                      <th className="px-3 py-2 font-medium">Número</th>
                      <th className="px-3 py-2 font-medium">Armador</th>
                      <th className="px-3 py-2 font-medium">Padrão</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium">Tipo</th>
                      <th className="px-3 py-2 font-medium">Data da Entrada</th>
                    </>
                  )}
                  {processo === "saidasGeral" && (
                    <>
                      <th className="px-3 py-2 font-medium">Número</th>
                      <th className="px-3 py-2 font-medium">Armador</th>
                      <th className="px-3 py-2 font-medium">Padrão</th>
                      <th className="px-3 py-2 font-medium">Origem</th>
                      <th className="px-3 py-2 font-medium">Detalhe</th>
                      <th className="px-3 py-2 font-medium">Data da Saída</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 200).map((r, i) => (
                  <tr
                    key={i}
                    className={`border-b border-[var(--border)] last:border-0 hover:bg-gray-50 ${
                      processo === "programacao" ? "cursor-pointer" : ""
                    }`}
                    onClick={processo === "programacao" ? () => abrirLiberados(r) : undefined}
                  >
                    {processo === "estoque" && (
                      <>
                        <td className="px-3 py-2 font-medium">{String(r.numero ?? "")}</td>
                        <td className="px-3 py-2">{String(r.armador ?? "")}</td>
                        <td className="px-3 py-2">{String(r.padrao ?? "")}</td>
                        <td className="px-3 py-2">{String(r.status ?? "")}</td>
                        <td className="px-3 py-2 text-[var(--muted)]">
                          {r.entrada ? formatDateBR(r.entrada as string) : "—"}
                        </td>
                      </>
                    )}
                    {processo === "oficina" && (
                      <>
                        <td className="px-3 py-2 text-[var(--muted)]">{formatDateTimeBR(r.data as string)}</td>
                        <td className="px-3 py-2 font-medium">{String(r.container_numero ?? "")}</td>
                        <td className="px-3 py-2">{String(r.armador ?? "")}</td>
                        <td className="px-3 py-2">{String(r.padrao ?? "")}</td>
                        <td className="px-3 py-2 text-[var(--muted)]">{String(r.dm ?? "—")}</td>
                        <td className="px-3 py-2 text-[var(--muted)]">{r.upgrade ? "Sim" : "Não"}</td>
                      </>
                    )}
                    {processo === "ocorrencias" && (
                      <>
                        <td className="px-3 py-2 text-[var(--muted)]">{formatDateBR(r.data as string)}</td>
                        <td className="px-3 py-2">{String(r.motivo ?? "")}</td>
                        <td className="px-3 py-2 text-[var(--muted)]">{String(r.criado_por ?? "—")}</td>
                      </>
                    )}
                    {processo === "programacao" && (
                      <>
                        <td className="px-3 py-2 text-[var(--muted)]">
                          {formatDateBR(`${String(r.data_retirada)}T12:00:00-03:00`)}
                        </td>
                        <td className="px-3 py-2 font-medium text-[var(--primary)]">{String(r.solicitante ?? "")}</td>
                        <td className="px-3 py-2">{SOLICITANTE_LABELS[r.destino as SolicitanteTipo] ?? String(r.destino ?? "")}</td>
                        <td className="px-3 py-2">{String(r.armador ?? "")}</td>
                        <td className="px-3 py-2">{String(r.quantidade ?? "")}</td>
                        <td className="px-3 py-2">{String(r.realizada ?? "")}</td>
                      </>
                    )}
                    {processo === "coletas" && (
                      <>
                        <td className="px-3 py-2 font-medium">{String(r.container_numero ?? "")}</td>
                        <td className="px-3 py-2">{String(r.armador ?? "")}</td>
                        <td className="px-3 py-2">{String(r.padrao ?? "")}</td>
                        <td className="px-3 py-2">{String(r.codigo_cm_veiculo ?? "")}</td>
                        <td className="px-3 py-2 text-[var(--muted)]">{r.data ? formatDateTimeBR(r.data as string) : "—"}</td>
                      </>
                    )}
                    {processo === "saidasExternas" && (
                      <>
                        <td className="px-3 py-2 font-medium">{String(r.container_numero ?? "")}</td>
                        <td className="px-3 py-2">{String(r.armador ?? "")}</td>
                        <td className="px-3 py-2">{String(r.padrao ?? "")}</td>
                        <td className="px-3 py-2">{String(r.exportador ?? "—")}</td>
                        <td className="px-3 py-2">{String(r.navio ?? "—")}</td>
                        <td className="px-3 py-2 text-[var(--muted)]">
                          {r.data_saida ? formatDateTimeBR(r.data_saida as string) : "—"}
                        </td>
                      </>
                    )}
                    {processo === "entradas" && (
                      <>
                        <td className="px-3 py-2 font-medium">{String(r.numero ?? "")}</td>
                        <td className="px-3 py-2">{String(r.armador ?? "")}</td>
                        <td className="px-3 py-2">{String(r.padrao ?? "")}</td>
                        <td className="px-3 py-2">{String(r.status ?? "")}</td>
                        <td className="px-3 py-2">{String(r.tipo ?? "—")}</td>
                        <td className="px-3 py-2 text-[var(--muted)]">
                          {r.entrada ? formatDateTimeBR(r.entrada as string) : "—"}
                        </td>
                      </>
                    )}
                    {processo === "saidasGeral" && (
                      <>
                        <td className="px-3 py-2 font-medium">{String(r.numero ?? "")}</td>
                        <td className="px-3 py-2">{String(r.armador ?? "—")}</td>
                        <td className="px-3 py-2">{String(r.padrao ?? "—")}</td>
                        <td className="px-3 py-2">
                          {r.origem === "CM" ? "CM (Coletas)" : "Externa (planilha)"}
                        </td>
                        <td className="px-3 py-2 text-[var(--muted)]">{String(r.detalhe ?? "—")}</td>
                        <td className="px-3 py-2 text-[var(--muted)]">
                          {r.dataSaida ? formatDateTimeBR(r.dataSaida as string) : "—"}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-10 text-center text-[var(--muted)]">
                      Nenhum registro encontrado para os filtros selecionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {rows.length > 200 && (
            <p className="text-xs text-[var(--muted)] px-4 py-2">
              Mostrando os primeiros 200 registros. Exporte em Excel para ver a lista completa ({rows.length}).
            </p>
          )}
        </div>
      )}

      {liberadosOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => setLiberadosOpen(false)}
        >
          <div
            className="card p-4 sm:p-6 w-full max-w-3xl max-h-[85vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold">
                Containers liberados — {liberadosInfo?.solicitante}
                {liberadosInfo?.data && (
                  <span className="text-[var(--muted)] font-normal">
                    {" "}
                    ({formatDateBR(`${liberadosInfo.data}T12:00:00-03:00`)})
                  </span>
                )}
              </h3>
              <div className="flex items-center gap-3">
                {liberadosId && (
                  <a
                    href={`/api/programacao/${liberadosId}/coletas/export`}
                    className="btn btn-secondary text-xs px-3 py-1.5"
                  >
                    Exportar Excel
                  </a>
                )}
                <button
                  onClick={() => setLiberadosOpen(false)}
                  className="text-[var(--muted)] hover:text-[var(--foreground)] text-xl leading-none"
                >
                  ×
                </button>
              </div>
            </div>
            {liberadosLoading && <p className="text-sm text-[var(--muted)]">Carregando...</p>}
            {!liberadosLoading && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-[var(--muted)] border-b border-[var(--border)]">
                      <th className="px-3 py-2 font-medium">Container</th>
                      <th className="px-3 py-2 font-medium">Padrão</th>
                      <th className="px-3 py-2 font-medium">Código CM</th>
                      <th className="px-3 py-2 font-medium">Data da Liberação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {liberadosRows
                      .filter((c) => c.status === "CONCLUIDO")
                      .map((c) => (
                        <tr key={c.id} className="border-b border-[var(--border)] last:border-0 hover:bg-gray-50">
                          <td className="px-3 py-2 font-medium">{c.container_numero ?? "—"}</td>
                          <td className="px-3 py-2">{c.padrao ?? "—"}</td>
                          <td className="px-3 py-2">{c.codigo_cm_veiculo ?? "—"}</td>
                          <td className="px-3 py-2 text-[var(--muted)]">
                            {c.data ? formatDateTimeBR(c.data) : "—"}
                          </td>
                        </tr>
                      ))}
                    {liberadosRows.filter((c) => c.status === "CONCLUIDO").length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-3 py-8 text-center text-[var(--muted)]">
                          Nenhum container liberado ainda para essa solicitação.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
            {!liberadosLoading && liberadosRows.some((c) => c.status === "PENDENTE") && (
              <p className="text-xs text-[var(--muted)] mt-3">
                {liberadosRows.filter((c) => c.status === "PENDENTE").length} vaga(s) ainda pendente(s) nessa
                solicitação.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
