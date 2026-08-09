"use client";

interface ArmadorAlimento {
  armador: string;
  alimentoOk: number;
}

export default function EstoqueCard({
  alimentoOk,
  avariadas,
  cargaGeralOk,
  porArmador,
}: {
  alimentoOk: number;
  avariadas: number;
  cargaGeralOk: number;
  porArmador: ArmadorAlimento[];
}) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold">Estoque</h3>
        <span className="text-lg">📦</span>
      </div>
      <div className="mb-4 mt-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-green-700">OK para coletar · Alimento (por armador)</p>
          <span className="text-lg font-bold text-green-700">{alimentoOk}</span>
        </div>
        <div className="space-y-1.5">
          {porArmador.map((a) => (
            <div key={a.armador} className="flex items-center justify-between rounded-lg px-3 py-1.5 bg-green-50">
              <span className="text-xs font-medium text-green-800">{a.armador}</span>
              <span className="text-sm font-bold text-green-700">{a.alimentoOk}</span>
            </div>
          ))}
          {porArmador.length === 0 && (
            <p className="text-xs text-[var(--muted)] px-1">Nenhum container disponível no momento.</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 bg-red-50">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-700">Avariadas</p>
            <p className="text-[11px] text-[var(--muted)]">Aguardando autorização, entrada ou em reparo</p>
          </div>
          <span className="text-xl font-bold text-red-700">{avariadas}</span>
        </div>

        <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 bg-gray-100">
          <span className="w-2.5 h-2.5 rounded-full bg-gray-400 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-700">OK · Carga Geral</p>
            <p className="text-[11px] text-[var(--muted)]">Não é coletado pela matriz/PG</p>
          </div>
          <span className="text-xl font-bold text-gray-700">{cargaGeralOk}</span>
        </div>
      </div>
    </div>
  );
}
