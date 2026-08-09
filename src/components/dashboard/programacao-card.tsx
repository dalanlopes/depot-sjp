"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";

interface Ponto {
  data: string;
  solicitado: number;
  concluido: number;
  pendente: number;
  meta: number;
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
      <p>Solicitado: {p.solicitado}</p>
      <p className="text-green-700">Concluído: {p.concluido}</p>
      <p className="text-amber-700">A realizar: {p.pendente}</p>
    </div>
  );
}

export default function ProgramacaoCard({
  series7d,
  metaDiaria = 35,
  metaSemanal = 175,
  coletadosSemana = 0,
  faltamSemana = 0,
}: {
  series7d: Ponto[];
  metaDiaria?: number;
  metaSemanal?: number;
  coletadosSemana?: number;
  faltamSemana?: number;
}) {
  const totalSolicitado = series7d.reduce((a, p) => a + p.solicitado, 0);
  const totalConcluido = series7d.reduce((a, p) => a + p.concluido, 0);
  const totalPendente = series7d.reduce((a, p) => a + p.pendente, 0);

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold">Programação</h3>
        <span className="text-lg">🗓️</span>
      </div>
      <div className="flex justify-center mb-3 mt-3">
        <div className="rounded-xl bg-indigo-50 px-3 py-2.5 max-w-full inline-flex flex-wrap items-center justify-center text-center gap-x-5 gap-y-1 text-xs">
          <span className="font-semibold text-indigo-700">Meta diária: {metaDiaria} unidades</span>
          <span>
            <strong>{coletadosSemana}</strong> coletados esta semana (meta {metaSemanal})
          </span>
          <span className={faltamSemana === 0 ? "text-green-700" : "text-amber-700"}>
            <strong>{faltamSemana}</strong> faltam para fechar a semana
          </span>
        </div>
      </div>

      <div className="flex justify-center gap-4 mb-3 text-xs">
        <span><strong>{totalSolicitado}</strong> solicitados</span>
        <span className="text-green-700"><strong>{totalConcluido}</strong> concluídos</span>
        <span className="text-amber-700"><strong>{totalPendente}</strong> a realizar</span>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={series7d} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <XAxis dataKey="data" tickFormatter={formatDia} tick={{ fontSize: 11 }} />
            <YAxis
              tick={{ fontSize: 11 }}
              allowDecimals={false}
              width={28}
              domain={[0, (max: number) => Math.max(max, metaDiaria)]}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(79,70,229,0.06)" }} />
            <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v) => (v === "concluido" ? "Concluído" : "A realizar")} />
            <ReferenceLine y={metaDiaria} stroke="var(--muted)" strokeDasharray="4 4" label={{ value: `Meta ${metaDiaria}`, fontSize: 10, position: "insideTopRight" }} />
            <Bar dataKey="concluido" stackId="op" fill="var(--success)" radius={[0, 0, 0, 0]} maxBarSize={34} />
            <Bar dataKey="pendente" stackId="op" fill="var(--warning)" radius={[6, 6, 0, 0]} maxBarSize={34} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
