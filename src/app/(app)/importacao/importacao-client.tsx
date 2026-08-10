"use client";

import { useCallback, useState } from "react";
import {
  ARMADORES,
  PADROES,
  PADRAO_LABELS,
  STATUS_CONTAINER,
  STATUS_LABELS,
  type Armador,
  type Padrao,
  type StatusContainer,
} from "@/lib/types";
import { todayBR } from "@/lib/tz";

interface ImportResult {
  imported: number;
  total: number;
  criados: number;
  atualizados: number;
  semAlteracao: number;
  mudancasStatus: { numero: string; de: string; para: string }[];
  errors: { linha: number; motivo: string }[];
}

export default function ImportacaoClient() {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [manualOpen, setManualOpen] = useState(false);
  const [numero, setNumero] = useState("");
  const [armador, setArmador] = useState<Armador>(ARMADORES[0]);
  const [padrao, setPadrao] = useState<Padrao>(PADROES[0]);
  const [status, setStatus] = useState<StatusContainer>("WS");
  const [tipo, setTipo] = useState("");
  const [entrada, setEntrada] = useState(() => todayBR());
  const [estimativa, setEstimativa] = useState("");
  const [savingManual, setSavingManual] = useState(false);
  const [manualMsg, setManualMsg] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSavingManual(true);
    setManualMsg(null);
    const valor = estimativa.trim() ? Number(estimativa.replace(",", ".")) : undefined;
    try {
      const res = await fetch("/api/containers/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          numero,
          armador,
          padrao,
          status,
          tipo: tipo.trim() || undefined,
          entrada,
          valorEstimado: valor,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setManualMsg({ type: "ok", text: `Container ${data.numero} cadastrado no estoque.` });
        setNumero("");
        setTipo("");
        setEstimativa("");
      } else {
        setManualMsg({ type: "error", text: data.error ?? "Erro ao cadastrar o container." });
      }
    } catch {
      setManualMsg({ type: "error", text: "Erro ao conectar. Tente novamente." });
    } finally {
      setSavingManual(false);
    }
  }

  const handleFile = useCallback(async (file: File) => {
    setUploading(true);
    setError(null);
    setResult(null);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/containers/import", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao importar.");
      } else {
        setResult(data);
      }
    } catch {
      setError("Erro ao enviar o arquivo.");
    } finally {
      setUploading(false);
    }
  }, []);

  return (
    <div className="space-y-5 max-w-2xl">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) handleFile(file);
        }}
        className={`card flex flex-col items-center justify-center gap-2 py-14 cursor-pointer border-2 border-dashed transition-colors ${
          dragOver ? "border-[var(--primary)] bg-indigo-50" : "border-[var(--border)]"
        }`}
      >
        <span className="text-3xl">⬆️</span>
        <span className="text-sm font-medium">
          {uploading ? "Enviando..." : "Arraste sua planilha aqui ou clique para selecionar"}
        </span>
        <span className="text-xs text-[var(--muted)]">Formatos aceitos: .csv, .xlsx, .xls</span>
        <input
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
      </label>

      {error && (
        <div className="card p-4 text-sm text-[var(--danger)] bg-red-50 border-red-100">{error}</div>
      )}

      {result && (
        <div className="card p-4 space-y-3">
          <p className="text-sm font-medium">
            {result.imported} de {result.total} linhas processadas com sucesso.
          </p>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="badge bg-green-100 text-green-700">{result.criados} novos</span>
            <span className="badge bg-indigo-100 text-indigo-700">{result.atualizados} atualizados</span>
            <span className="badge bg-gray-100 text-gray-700">{result.semAlteracao} sem alteração</span>
          </div>

          {result.mudancasStatus.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-[var(--foreground)] mb-1">
                Mudanças de status ({result.mudancasStatus.length})
              </p>
              <div className="text-xs text-[var(--muted)] space-y-1 max-h-48 overflow-auto border border-[var(--border)] rounded-lg p-2">
                {result.mudancasStatus.map((m, i) => (
                  <div key={i}>
                    <strong className="text-[var(--foreground)]">{m.numero}</strong>: {m.de} → {m.para}
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.errors.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-[var(--danger)] mb-1">Erros ({result.errors.length})</p>
              <div className="text-xs text-[var(--muted)] space-y-1 max-h-48 overflow-auto">
                {result.errors.map((e, i) => (
                  <div key={i}>
                    Linha {e.linha}: {e.motivo}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="card p-4">
        <button
          type="button"
          onClick={() => setManualOpen((o) => !o)}
          className="text-sm font-medium flex items-center justify-between w-full"
        >
          <span>Inserir container manualmente (sem planilha)</span>
          <span className="text-[var(--muted)]">{manualOpen ? "▲" : "▼"}</span>
        </button>

        {manualOpen && (
          <form onSubmit={handleManualSubmit} className="mt-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium block mb-1.5">Número do container</label>
                <input
                  className="input uppercase"
                  value={numero}
                  onChange={(e) => setNumero(e.target.value.toUpperCase())}
                  placeholder="Ex: CAAU7936686"
                  required
                />
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

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium block mb-1.5">Padrão</label>
                <select className="input" value={padrao} onChange={(e) => setPadrao(e.target.value as Padrao)}>
                  {PADROES.map((p) => (
                    <option key={p} value={p}>{p} · {PADRAO_LABELS[p]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1.5">Status</label>
                <select className="input" value={status} onChange={(e) => setStatus(e.target.value as StatusContainer)}>
                  {STATUS_CONTAINER.map((s) => (
                    <option key={s} value={s}>{s} · {STATUS_LABELS[s]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1.5">Tipo (opcional)</label>
                <input className="input" value={tipo} onChange={(e) => setTipo(e.target.value)} placeholder="Ex: 40HC" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="overflow-hidden rounded-xl">
                <label className="text-sm font-medium block mb-1.5">Data de entrada</label>
                <input type="date" className="input" value={entrada} onChange={(e) => setEntrada(e.target.value)} required />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1.5">Estimativa de reparo (opcional)</label>
                <input
                  className="input"
                  placeholder="0,00"
                  value={estimativa}
                  onChange={(e) => setEstimativa(e.target.value)}
                />
              </div>
            </div>

            <button type="submit" disabled={savingManual} className="btn btn-primary disabled:opacity-60">
              {savingManual ? "Salvando..." : "Cadastrar container"}
            </button>
            {manualMsg && (
              <p className={`text-sm ${manualMsg.type === "ok" ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
                {manualMsg.text}
              </p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
