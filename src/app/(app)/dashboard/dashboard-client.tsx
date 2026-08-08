"use client";

import { useEffect, useState, useCallback } from "react";
import RepairsBarCard from "@/components/dashboard/repairs-bar-card";
import EstoqueCard from "@/components/dashboard/estoque-card";
import ProgramacaoCard from "@/components/dashboard/programacao-card";
import OcorrenciasCard from "@/components/dashboard/ocorrencias-card";

interface Ponto {
  data: string;
  quantidade: number;
  valor?: number;
}

interface ProgramacaoPonto {
  data: string;
  solicitado: number;
  concluido: number;
  pendente: number;
  meta: number;
}

interface Ocorrencia {
  id: string;
  data: string;
  motivo: string;
  criado_por: string | null;
}

interface Summary {
  reparosSeries7d: Ponto[];
  reparosSeries30d: Ponto[];
  metaDiariaReparos: number;
  showFinance: boolean;
  estoque: {
    alimentoOk: number;
    avariadas: number;
    cargaGeralOk: number;
    porArmador: { armador: string; alimentoOk: number }[];
  };
  programacaoSeries7d: ProgramacaoPonto[];
  metaDiariaColetas: number;
  metaSemanalColetas: number;
  coletadosSemana: number;
  faltamSemana: number;
  ocorrenciasRecentes: Ocorrencia[];
}

export default function DashboardClient() {
  const [summary, setSummary] = useState<Summary | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/dashboard/summary");
    if (res.ok) setSummary(await res.json());
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 20000);
    return () => clearInterval(interval);
  }, [load]);

  if (!summary) {
    return <div className="text-sm text-[var(--muted)]">Carregando indicadores...</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      <RepairsBarCard
        series7d={summary.reparosSeries7d}
        series30d={summary.reparosSeries30d}
        metaDiaria={summary.metaDiariaReparos}
        showFinance={summary.showFinance}
      />
      <EstoqueCard
        alimentoOk={summary.estoque.alimentoOk}
        avariadas={summary.estoque.avariadas}
        cargaGeralOk={summary.estoque.cargaGeralOk}
        porArmador={summary.estoque.porArmador}
      />
      <div className="md:col-span-2">
        <ProgramacaoCard
          series7d={summary.programacaoSeries7d}
          metaDiaria={summary.metaDiariaColetas}
          metaSemanal={summary.metaSemanalColetas}
          coletadosSemana={summary.coletadosSemana}
          faltamSemana={summary.faltamSemana}
        />
      </div>
      <div className="md:col-span-2">
        <OcorrenciasCard ocorrencias={summary.ocorrenciasRecentes} />
      </div>
    </div>
  );
}
