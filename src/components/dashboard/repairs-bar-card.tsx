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
    <div className="card p-4">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold">Reparados Oficina SJP</h3>
        <span className="text-lg">🔧</span>
      </div>
      <div className="flex justify-center mb-2 mt-1.5">
        <div className="rounded-xl bg-indigo-50 px-3 py-1.5 max-w-full inline-flex flex-wrap items-center justify-center text-center gap-x-5 gap-y-0.5 text-xs">
          <span className="font-semibold text-indigo-700">Meta diária: {metaDiaria} unidades</span>
          <span>
            <strong>{reparadosHoje}</strong> reparados hoje
          </span>
          <span className={atingiuMeta ? "text-green-700" : "text-amber-700"}>
            <strong>{faltam}</strong> faltam para a meta
          </span>
        </div>
      </div>

      <div className="h-36">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={series7d} margin={{ top: 14, right: 4, left: 0, bottom: 0 }}>
            <XAxis dataKey="data" tickFormatter={formatDia} tick={{ fontSize: 11 }} interval={0} />
            <YAxis
              tick={{ fontSize: 11 }}
              allowDecimals={false}
              width={28}
              domain={[0, (max: number) => Math.max(max, metaDiaria)]}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(22,163,74,0.06)" }} />
            <ReferenceLine
              y={metaDiaria}
              stroke="var(--muted)"
              strokeDasharray="4 4"
              label={{ value: `Meta ${metaDiaria}`, fontSize: 10, position: "insideTopRight" }}
            />
            <Bar dataKey="quantidade" radius={[6, 6, 0, 0]} maxBarSize={36}>
              <LabelList dataKey="quantidade" position="top" style={{ fontSize: 11, fontWeight: 700 }} />
              {series7d.map((p) => (
                <Cell key={p.data} fill={p.quantidade >= metaDiaria ? "var(--success)" : "var(--danger)"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
