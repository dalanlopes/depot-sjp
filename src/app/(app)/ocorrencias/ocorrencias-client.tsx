"use client";

import { useCallback, useEffect, useState } from "react";
import { formatDateBR } from "@/lib/tz";

interface Ocorrencia {
  id: string;
  data: string;
  motivo: string;
  criado_por: string | null;
}

export default function OcorrenciasClient() {
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [historico, setHistorico] = useState<Ocorrencia[]>([]);
  const [loadingHistorico, setLoadingHistorico] = useState(true);
  const [excluindo, setExcluindo] = useState<string | null>(null);

  const loadHistorico = useCallback(async () => {
    setLoadingHistorico(true);
    const res = await fetch("/api/ocorrencias?dias=3650");
    if (res.ok) {
      const json = await res.json();
      setHistorico(json.ocorrencias ?? []);
    }
    setLoadingHistorico(false);
  }, []);

  useEffect(() => {
    loadHistorico();
  }, [loadHistorico]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/ocorrencias", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data, motivo }),
    });
    setSaving(false);
    if (res.ok) {
      setMessage("Ocorrência registrada com sucesso.");
      setMotivo("");
      loadHistorico();
    } else {
      setMessage("Erro ao registrar. Tente novamente.");
    }
  }

  async function excluirOcorrencia(id: string) {
    if (!confirm("Excluir esta ocorrência?")) return;
    setExcluindo(id);
    const res = await fetch(`/api/ocorrencias/${id}`, { method: "DELETE" });
    setExcluindo(null);
    if (res.ok) {
      loadHistorico();
    } else {
      alert("Erro ao excluir. Tente novamente.");
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="card p-5 max-w-lg space-y-4">
        <div className="overflow-hidden rounded-xl">
          <label className="text-sm font-medium block mb-1.5">Data</label>
          <input
            type="date"
            className="input"
            value={data}
            onChange={(e) => setData(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="text-sm font-medium block mb-1.5">
            Motivo do não cumprimento da meta
          </label>
          <textarea
            className="input min-h-[100px]"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            required
          />
        </div>
        <button type="submit" disabled={saving} className="btn btn-primary disabled:opacity-60">
          {saving ? "Salvando..." : "Registrar Ocorrência"}
        </button>
        {message && <p className="text-sm text-[var(--muted)]">{message}</p>}
      </form>

      <div className="card p-5">
        <h2 className="text-sm font-semibold mb-4">Histórico de ocorrências</h2>
        {loadingHistorico ? (
          <p className="text-sm text-[var(--muted)]">Carregando...</p>
        ) : historico.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Nenhuma ocorrência registrada.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-[var(--muted)] border-b border-[var(--border)]">
                  <th className="px-3 py-2 font-medium">Data</th>
                  <th className="px-3 py-2 font-medium">Motivo</th>
                  <th className="px-3 py-2 font-medium">Registrado por</th>
                  <th className="px-3 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {historico.map((o) => (
                  <tr key={o.id} className="border-b border-[var(--border)] last:border-0 hover:bg-gray-50">
                    <td className="px-3 py-2 whitespace-nowrap text-[var(--muted)]">{formatDateBR(o.data)}</td>
                    <td className="px-3 py-2">{o.motivo}</td>
                    <td className="px-3 py-2 text-[var(--muted)]">{o.criado_por ?? "—"}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => excluirOcorrencia(o.id)}
                        disabled={excluindo === o.id}
                        className="text-xs text-[var(--muted)] hover:text-[var(--danger)] disabled:opacity-50"
                      >
                        {excluindo === o.id ? "..." : "Excluir"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
