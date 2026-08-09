"use client";

import {
  BarChart,
  Bar,
  XAxis,
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
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">Reparados Oficina SJP</h3>
        <span className="text-lg">🔧</span>
      </div>
      <div style={{ height: 160 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={series7d} margin={{ top: 20, right: 4, left: 4, bottom: 0 }}>
            <XAxis dataKey="data" tickFormatter={formatDia} tick={{ fontSize: 10 }} interval={0} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(22,163,74,0.06)" }} />
            <ReferenceLine
              y={metaDiaria}
              stroke="var(--danger)"
              strokeDasharray="4 4"
              label={{ value: `Meta ${metaDiaria}`, fontSize: 10, position: "insideTopRight" }}
            />
            <Bar dataKey="quantidade" fill="var(--success)" radius={[6, 6, 0, 0]} maxBarSize={28}>
              <LabelList dataKey="quantidade" position="top" style={{ fontSize: 11, fill: "var(--success)", fontWeight: 600 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
