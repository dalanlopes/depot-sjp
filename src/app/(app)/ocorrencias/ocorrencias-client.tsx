"use client";

import { useState } from "react";

export default function OcorrenciasClient() {
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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
    } else {
      setMessage("Erro ao registrar. Tente novamente.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card p-5 max-w-lg space-y-4">
      <div>
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
  );
}
