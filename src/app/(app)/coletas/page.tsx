import { requireTab } from "@/lib/guard";
import ColetasClient from "./coletas-client";

export const dynamic = "force-dynamic";

export default async function ColetasPage() {
  await requireTab("coletas");
  return (
    <div>
      <h1 className="text-xl font-semibold mb-6">Coletas</h1>
      <ColetasClient />
    </div>
  );
}
