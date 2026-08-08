"use client";

import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";

interface Ponto {
  data: string;
  quantidade: number;
  valor?: number;
}

function formatDia(iso: string) {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

function CustomTooltip({
  active,
  payload,
  showFinance,
}: {
  active?: boolean;
  payload?: { payload: Ponto }[];
  showFinance: boolean;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="card p-2.5 text-xs shadow-lg">
      <p className="font-semibold mb-0.5">{formatDia(p.data)}</p>
      <p>{p.quantidade} reparo(s)</p>
      {showFinance && p.valor !== undefined && (
        <p className="text-[var(--muted)]">
          R$ {p.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
        </p>
      )}
    </div>
  );
}

function MiniChart({
  data,
  showFinance,
  metaDiaria,
  height = 90,
}: {
  data: Ponto[];
  showFinance: boolean;
  metaDiaria: number;
  height?: number;
}) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
          <XAxis dataKey="data" tickFormatter={formatDia} tick={{ fontSize: 10 }} interval={0} />
          <Tooltip content={<CustomTooltip showFinance={showFinance} />} cursor={{ fill: "rgba(79,70,229,0.06)" }} />
          <ReferenceLine
            y={metaDiaria}
            stroke="var(--danger)"
            strokeDasharray="4 4"
            label={{ value: `Meta ${metaDiaria}`, fontSize: 10, position: "insideTopRight" }}
          />
          <Bar dataKey="quantidade" fill="var(--primary)" radius={[6, 6, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function RepairsBarCard({
  series7d,
  series30d,
  metaDiaria,
  showFinance,
}: {
  series7d: Ponto[];
  series30d: Ponto[];
  metaDiaria: number;
  showFinance: boolean;
}) {
  const [open, setOpen] = useState(false);
  const hoje = series7d[series7d.length - 1];
  const totalValor30d = series30d.reduce((acc, p) => acc + (p.valor ?? 0), 0);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="card p-5 text-left w-full hover:shadow-md transition-shadow"
      >
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-semibold">Reparados Oficina SJP</h3>
          <span className="text-lg">🔧</span>
        </div>
        <p className="text-xs text-[var(--muted)] mb-3">Últimos 7 dias · meta {metaDiaria}/dia</p>
        <div className="flex items-end gap-2 mb-2">
          <span className="text-2xl font-bold">{hoje?.quantidade ?? 0}</span>
          <span className="text-xs text-[var(--muted)] mb-1">hoje</span>
        </div>
        <MiniChart data={series7d} showFinance={showFinance} metaDiaria={metaDiaria} />
        <p className="text-[11px] text-[var(--muted)] mt-2">Clique para ver os últimos 30 dias</p>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="card p-6 w-full max-w-2xl max-h-[85vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-base font-semibold">Reparados Oficina SJP · Últimos 30 dias</h3>
              <button onClick={() => setOpen(false)} className="text-[var(--muted)] hover:text-[var(--foreground)] text-xl leading-none">
                ×
              </button>
            </div>
            {showFinance && (
              <p className="text-sm text-[var(--muted)] mb-3">
                Valor total faturado no período: <strong>R$ {totalValor30d.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong>
              </p>
            )}
            <MiniChart data={series30d} showFinance={showFinance} metaDiaria={metaDiaria} height={280} />
            <div className="mt-4 max-h-52 overflow-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[var(--muted)] border-b border-[var(--border)]">
                    <th className="py-1.5 font-medium">Dia</th>
                    <th className="py-1.5 font-medium">Reparos</th>
                    {showFinance && <th className="py-1.5 font-medium">Valor</th>}
                  </tr>
                </thead>
                <tbody>
                  {[...series30d].reverse().map((p) => (
                    <tr key={p.data} className="border-b border-[var(--border)] last:border-0">
                      <td className="py-1.5">{formatDia(p.data)}</td>
                      <td className="py-1.5">{p.quantidade}</td>
                      {showFinance && (
                        <td className="py-1.5">
                          R$ {(p.valor ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
