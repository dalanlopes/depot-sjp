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
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">Reparados Oficina SJP</h3>
        <span className="text-lg">🔧</span>
      </div>
      <div style={{ height: 160 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={series7d} margin={{ top: 20, right: 4, left: 4, bottom: 0 }}>
            <XAxis dataKey="data" tickFormatter={formatDia} tick={{ fontSize: 11 }} interval={0} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} domain={[0, (max: number) => Math.max(max, metaDiaria)]} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(22,163,74,0.06)" }} />
            <ReferenceLine
              y={metaDiaria}
              stroke="var(--muted)"
              strokeDasharray="4 4"
              label={{ value: `Meta ${metaDiaria}`, fontSize: 10, position: "insideTopRight" }}
            />
            <Bar dataKey="quantidade" radius={[6, 6, 0, 0]} maxBarSize={28}>
              <LabelList dataKey="quantidade" position="top" style={{ fontSize: 11, fontWeight: 600 }} />
              {series7d.map((p) => (
                <Cell key={p.data} fill={p.quantidade >= metaDiaria ? "var(--success)" : "var(--danger)"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-gray-50 border border-[var(--border)] px-3 py-2.5 text-center">
          <p className="text-xs text-[var(--muted)] mb-0.5">Reparados hoje</p>
          <p className="text-xl font-bold">{reparadosHoje}</p>
        </div>
        <div className="rounded-xl bg-gray-50 border border-[var(--border)] px-3 py-2.5 text-center">
          <p className="text-xs text-[var(--muted)] mb-0.5">Faltam para a meta</p>
          <p className={`text-xl font-bold ${atingiuMeta ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
            {faltam}
          </p>
        </div>
      </div>
    </div>
  );
}
