"use client";

import { useCallback, useState } from "react";

interface ImportResult {
  imported: number;
  total: number;
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
        <div className="card p-4 space-y-2">
          <p className="text-sm font-medium">
            {result.imported} de {result.total} linhas importadas com sucesso.
          </p>
          {result.errors.length > 0 && (
            <div className="text-xs text-[var(--muted)] space-y-1 max-h-48 overflow-auto">
              {result.errors.map((e, i) => (
                <div key={i}>
                  Linha {e.linha}: {e.motivo}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
