"use client";

import { useEffect, useState, useCallback } from "react";
import { formatDateBR } from "@/lib/tz";

interface ReparoRow {
  id: string;
  data: string;
  container_numero: string;
  armador: string;
  padrao: string;
  valor_faturado?: string | null;
  faturado_em?: string | null;
}

export default function OficinaClient({
  canRegister,
  canFinance,
}: {
  canRegister: boolean;
  canFinance: boolean;
}) {
  const [rows, setRows] = useState<ReparoRow[]>([]);
  const [meta, setMeta] = useState(35);
  const [faltam, setFaltam] = useState(35);
  const [valorEstimado, setValorEstimado] = useState<number | undefined>(undefined);
  const [numero, setNumero] = useState("");
  const [pending, setPending] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const res = await fetch("/api/reparos");
    const data = await res.json();
    setRows(data.reparos ?? []);
    setMeta(data.meta ?? 35);
    setFaltam(data.faltamParaMeta ?? Math.max((data.meta ?? 35) - (data.reparos?.length ?? 0), 0));
    setValorEstimado(data.valorEstimado);
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [load]);

  function addPending() {
    const n = numero.trim().toUpperCase();
    if (n && !pending.includes(n)) setPending([...pending, n]);
    setNumero("");
  }

  async function submitAll() {
    if (pending.length === 0) return;
    setSubmitting(true);
    setMessage(null);
    const res = await fetch("/api/reparos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ numeros: pending }),
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

      {canRegister && (
        <div className="card p-4">
          <h2 className="text-sm font-semibold mb-3">Registrar containers reparados</h2>
          <div className="flex gap-2 flex-wrap">
            <input
              className="input max-w-[220px]"
              placeholder="Número do container"
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addPending())}
            />
            <button className="btn btn-secondary" onClick={addPending} type="button">
              Adicionar
            </button>
            <button
              className="btn btn-primary disabled:opacity-50"
              onClick={submitAll}
              disabled={pending.length === 0 || submitting}
            >
              {submitting ? "Salvando..." : `Salvar (${pending.length})`}
            </button>
          </div>
          {pending.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {pending.map((p) => (
                <span key={p} className="badge bg-indigo-50 text-indigo-700">
                  {p}
                  <button
                    onClick={() => setPending(pending.filter((x) => x !== p))}
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
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Reparados hoje</h2>
          <span className={`badge ${atingiuMeta ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
            {rows.length} / {meta} unidades
          </span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-[var(--muted)] border-b border-[var(--border)]">
              <th className="px-3 py-2 font-medium">Container</th>
              <th className="px-3 py-2 font-medium">Armador</th>
              <th className="px-3 py-2 font-medium">Padrão</th>
              <th className="px-3 py-2 font-medium">Data do Reparo</th>
              <th className="px-3 py-2 font-medium">Data da Estimativa</th>
              {canFinance && <th className="px-3 py-2 font-medium">Valor faturado</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-[var(--border)] last:border-0 hover:bg-gray-50">
                <td className="px-3 py-2 font-medium">{r.container_numero}</td>
                <td className="px-3 py-2">{r.armador}</td>
                <td className="px-3 py-2">{r.padrao}</td>
                <td className="px-3 py-2 text-[var(--muted)]">{formatDateBR(r.data)}</td>
                <td className="px-3 py-2 text-[var(--muted)]">
                  {r.faturado_em ? formatDateBR(r.faturado_em) : "—"}
                </td>
                {canFinance && (
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <input
                        className="input max-w-[120px]"
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
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={canFinance ? 6 : 5} className="px-3 py-8 text-center text-[var(--muted)]">
                  Nenhum reparo registrado hoje ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
