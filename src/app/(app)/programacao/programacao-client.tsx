"use client";

import { useState, useEffect, useCallback } from "react";
import { ARMADORES, SOLICITANTES, SOLICITANTE_LABELS, MAX_CONTAINERS_POR_PROGRAMACAO, type Armador, type SolicitanteTipo, type TipoCarga } from "@/lib/types";
import { formatDateBR } from "@/lib/tz";

interface ProgramacaoRow {
  id: string;
  data_retirada: string;
  solicitante: string;
  destino: SolicitanteTipo;
  armador: Armador;
  booking: string | null;
  cm_codigo: string | null;
  quantidade: number;
  tipo_carga: TipoCarga;
  cliente: string | null;
  criado_em: string;
}

interface ContainerCheio {
  containerNumero: string;
  cliente: string;
}

export default function ProgramacaoClient() {
  const [dataRetirada, setDataRetirada] = useState(() => new Date().toISOString().slice(0, 10));
  const [solicitante, setSolicitante] = useState("");
  const [destino, setDestino] = useState<SolicitanteTipo>("MATRIZ");
  const [armador, setArmador] = useState<Armador>(ARMADORES[0]);
  const [booking, setBooking] = useState("");
  const [cmCodigo, setCmCodigo] = useState("");
  const [quantidade, setQuantidade] = useState(1);
  const [tipoCarga, setTipoCarga] = useState<TipoCarga>("VAZIO");
  const [containersCheio, setContainersCheio] = useState<ContainerCheio[]>([{ containerNumero: "", cliente: "" }]);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const [rows, setRows] = useState<ProgramacaoRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(true);

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
  }, [loadRows]);

  function addContainerCheio() {
    setContainersCheio((prev) =>
      prev.length >= MAX_CONTAINERS_POR_PROGRAMACAO ? prev : [...prev, { containerNumero: "", cliente: "" }]
    );
  }

  function removeContainerCheio(index: number) {
    setContainersCheio((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  function updateContainerCheio(index: number, field: keyof ContainerCheio, value: string) {
    setContainersCheio((prev) => prev.map((c, i) => (i === index ? { ...c, [field]: value } : c)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/programacao", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dataRetirada,
        solicitante,
        destino,
        armador,
        booking: booking || undefined,
        cmCodigo,
        quantidade: tipoCarga === "VAZIO" ? quantidade : undefined,
        tipoCarga,
        containersCheio:
          tipoCarga === "CHEIO"
            ? containersCheio.map((c) => ({ containerNumero: c.containerNumero.trim(), cliente: c.cliente.trim() }))
            : undefined,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (res.ok) {
      setMessage({ type: "ok", text: "Programação registrada com sucesso." });
      setSolicitante("");
      setDestino("MATRIZ");
      setBooking("");
      setCmCodigo("");
      setQuantidade(1);
      setTipoCarga("VAZIO");
      setContainersCheio([{ containerNumero: "", cliente: "" }]);
      loadRows();
    } else {
      setMessage({ type: "error", text: data.error ?? "Erro ao registrar. Verifique os campos." });
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="card p-5 max-w-xl space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
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
              className="input"
              value={solicitante}
              onChange={(e) => setSolicitante(e.target.value)}
              placeholder="Nome de quem solicitou"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
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

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium block mb-1.5">Booking (opcional)</label>
            <input className="input" value={booking} onChange={(e) => setBooking(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">CM</label>
            <input
              className="input"
              value={cmCodigo}
              onChange={(e) => setCmCodigo(e.target.value)}
              placeholder="Código do CM que irá coletar"
              required
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium block mb-1.5">Tipo da coleta</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="tipoCarga"
                checked={tipoCarga === "VAZIO"}
                onChange={() => setTipoCarga("VAZIO")}
              />
              Container vazio
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="tipoCarga"
                checked={tipoCarga === "CHEIO"}
                onChange={() => setTipoCarga("CHEIO")}
              />
              Container cheio
            </label>
          </div>
          <p className="text-[11px] text-[var(--muted)] mt-1">
            {tipoCarga === "VAZIO"
              ? "O analista do gate informa a numeração do container após a coleta pelo veículo."
              : "Container cheio não é retirado do estoque — apenas registrado para o veículo coletar."}
          </p>
        </div>

        {tipoCarga === "VAZIO" && (
          <div>
            <label className="text-sm font-medium block mb-1.5">Quantidade de containers</label>
            <input
              type="number"
              min={1}
              max={MAX_CONTAINERS_POR_PROGRAMACAO}
              className="input max-w-[140px]"
              value={quantidade}
              onChange={(e) =>
                setQuantidade(Math.max(1, Math.min(MAX_CONTAINERS_POR_PROGRAMACAO, Number(e.target.value))))
              }
              required
            />
            <p className="text-[11px] text-[var(--muted)] mt-1">Limite de {MAX_CONTAINERS_POR_PROGRAMACAO} unidades por CM.</p>
          </div>
        )}

        {tipoCarga === "CHEIO" && (
          <div className="space-y-3 rounded-xl border border-[var(--border)] p-3">
            <label className="text-sm font-medium block">Containers cheios (cliente + numeração)</label>
            <div className="space-y-2">
              {containersCheio.map((c, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <input
                    className="input"
                    placeholder="Cliente"
                    value={c.cliente}
                    onChange={(e) => updateContainerCheio(i, "cliente", e.target.value)}
                    required
                  />
                  <input
                    className="input"
                    placeholder={`Container ${i + 1}`}
                    value={c.containerNumero}
                    onChange={(e) => updateContainerCheio(i, "containerNumero", e.target.value)}
                    required
                  />
                  {containersCheio.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeContainerCheio(i)}
                      className="text-[var(--muted)] hover:text-[var(--danger)] px-2 py-2 text-lg leading-none"
                      aria-label="Remover container"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
            {containersCheio.length < MAX_CONTAINERS_POR_PROGRAMACAO && (
              <button type="button" onClick={addContainerCheio} className="btn btn-secondary text-xs px-3 py-1.5">
                + Adicionar container
              </button>
            )}
            <p className="text-[11px] text-[var(--muted)]">Limite de {MAX_CONTAINERS_POR_PROGRAMACAO} unidades por CM.</p>
          </div>
        )}

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
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-[var(--muted)] border-b border-[var(--border)]">
                <th className="px-4 py-3 font-medium">Data</th>
                <th className="px-4 py-3 font-medium">Solicitante</th>
                <th className="px-4 py-3 font-medium">Destino</th>
                <th className="px-4 py-3 font-medium">Armador</th>
                <th className="px-4 py-3 font-medium">Booking</th>
                <th className="px-4 py-3 font-medium">CM</th>
                <th className="px-4 py-3 font-medium">Qtd</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-[var(--border)] last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3">{formatDateBR(`${r.data_retirada}T12:00:00-03:00`)}</td>
                  <td className="px-4 py-3">{r.solicitante || "—"}</td>
                  <td className="px-4 py-3">{SOLICITANTE_LABELS[r.destino]}</td>
                  <td className="px-4 py-3">{r.armador}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">{r.booking ?? "—"}</td>
                  <td className="px-4 py-3">{r.cm_codigo ?? "—"}</td>
                  <td className="px-4 py-3">{r.quantidade}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${r.tipo_carga === "CHEIO" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-700"}`}>
                      {r.tipo_carga === "CHEIO" ? "Cheio" : "Vazio"}
                    </span>
                  </td>
                </tr>
              ))}
              {!loadingRows && rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-[var(--muted)]">
                    Nenhuma programação nos últimos 14 dias.
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
