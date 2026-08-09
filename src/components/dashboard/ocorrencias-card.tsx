"use client";

import { formatDateBR } from "@/lib/tz";

interface Ocorrencia {
  id: string;
  data: string;
  motivo: string;
  criado_por: string | null;
}

function iniciais(nome: string | null) {
  if (!nome) return "?";
  const partes = nome.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase() || "?";
}

export default function OcorrenciasCard({ ocorrencias }: { ocorrencias: Ocorrencia[] }) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center text-base">⚠️</span>
          <h3 className="text-sm font-semibold">Ocorrências</h3>
        </div>
        <span className="badge bg-amber-100 text-amber-700">{ocorrencias.length} no período</span>
      </div>

      <div className="mt-2 max-h-[220px] overflow-y-auto overflow-x-hidden pr-1">
        {ocorrencias.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <span className="text-2xl">✅</span>
            <p className="text-sm text-[var(--muted)]">Nenhuma ocorrência registrada no período.</p>
          </div>
        ) : (
          <ol className="relative border-l-2 border-amber-100 ml-2 space-y-2">
            {ocorrencias.map((o) => (
              <li key={o.id} className="ml-4 relative">
                <span className="absolute -left-[23px] top-1 w-3 h-3 rounded-full bg-amber-400 ring-4 ring-white" />
                <div className="rounded-lg px-3 py-1.5 bg-gradient-to-br from-amber-50 to-white border border-amber-100 hover:shadow-sm transition-shadow">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="text-xs font-semibold text-amber-800">{formatDateBR(o.data)}</span>
                    {o.criado_por && (
                      <span className="flex items-center gap-1.5 text-[11px] text-[var(--muted)]">
                        <span className="w-4 h-4 rounded-full bg-amber-200 text-amber-800 flex items-center justify-center text-[9px] font-bold">
                          {iniciais(o.criado_por)}
                        </span>
                        {o.criado_por}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-amber-950 leading-snug">{o.motivo}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
