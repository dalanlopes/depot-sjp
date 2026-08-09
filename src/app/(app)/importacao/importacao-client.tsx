"use client";

import { useCallback, useState } from "react";

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
    </div>
  );
}
