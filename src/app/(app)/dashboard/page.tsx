import { requireTab } from "@/lib/guard";
import DashboardClient from "./dashboard-client";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await requireTab("dashboard");
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold mb-1">Dashboard</h1>
          <p className="text-sm text-[var(--muted)]">Visão geral do pátio em tempo real.</p>
        </div>
        <a
          href={process.env.NEXT_PUBLIC_POWERBI_URL || "#"}
          target="_blank"
          rel="noreferrer"
          className="btn text-white flex items-center gap-2"
          style={{ background: "#F2C811", color: "#111" }}
        >
          📊 Acessar Relatório Completo - Power BI
        </a>
      </div>
      <DashboardClient />
    </div>
  );
}
