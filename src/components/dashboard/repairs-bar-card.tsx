"use client";

import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  LabelList,
} from "recharts";

interface Ponto {
  data: string;
  quantidade: number;
}

function formatDia(iso: string) {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: Ponto }[];
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="card p-2.5 text-xs shadow-lg">
      <p className="font-semibold mb-0.5">{formatDia(p.data)}</p>
      <p>{p.quantidade} reparo(s)</p>
    </div>
  );
}

export default function RepairsBarCard({
  series7d,
  metaDiaria,
}: {
  series7d: Ponto[];
  metaDiaria: number;
}) {
  const hoje = series7d[series7d.length - 1];
  const reparadosHoje = hoje?.quantidade ?? 0;
  const faltam = Math.max(metaDiaria - reparadosHoje, 0);
  const atingiuMeta = reparadosHoje >= metaDiaria;

  return (
    <div className="card p-5 h-[380px] flex flex-col">
      <div className="flex items-center justify-between mb-2 shrink-0">
        <h3 className="text-sm font-semibold">Reparados Oficina SJP</h3>
        <span className="text-lg">🔧</span>
      </div>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={series7d} margin={{ top: 18, right: 4, left: 0, bottom: 0 }}>
            <XAxis dataKey="data" tickFormatter={formatDia} tick={{ fontSize: 12 }} interval={0} />
            <YAxis
              tick={{ fontSize: 12 }}
              allowDecimals={false}
              width={28}
              domain={[0, (max: number) => Math.max(max, metaDiaria)]}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(22,163,74,0.06)" }} />
            <ReferenceLine
              y={metaDiaria}
              stroke="var(--muted)"
              strokeDasharray="4 4"
              label={{ value: `Meta ${metaDiaria}`, fontSize: 11, position: "insideTopRight" }}
            />
            <Bar dataKey="quantidade" radius={[6, 6, 0, 0]} maxBarSize={36}>
              <LabelList dataKey="quantidade" position="top" style={{ fontSize: 12, fontWeight: 700 }} />
              {series7d.map((p) => (
                <Cell key={p.data} fill={p.quantidade >= metaDiaria ? "var(--success)" : "var(--danger)"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 shrink-0">
        <div className="rounded-xl bg-gray-50 border border-[var(--border)] px-3 py-2 text-center">
          <p className="text-xs text-[var(--muted)] mb-0.5">Reparados hoje</p>
          <p className="text-xl font-bold">{reparadosHoje}</p>
        </div>
        <div className="rounded-xl bg-gray-50 border border-[var(--border)] px-3 py-2 text-center">
          <p className="text-xs text-[var(--muted)] mb-0.5">Faltam para a meta</p>
          <p className={`text-xl font-bold ${atingiuMeta ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
            {faltam}
          </p>
        </div>
      </div>
    </div>
  );
}
