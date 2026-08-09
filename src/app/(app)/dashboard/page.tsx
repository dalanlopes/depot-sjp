import { requireTab } from "@/lib/guard";
import DashboardClient from "./dashboard-client";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await requireTab("dashboard");
  return (
    <div>
      <div className="mb-3">
        <h1 className="text-xl font-semibold mb-1">Indicadores</h1>
      </div>
      <DashboardClient />
    </div>
  );
}
