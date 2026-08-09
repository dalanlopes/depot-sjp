"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ROLE_LABELS, TAB_LABELS } from "@/lib/roles";
import type { SessionPayload } from "@/lib/auth";

export default function Nav({ session }: { session: SessionPayload }) {
  const pathname = usePathname();
  const router = useRouter();
  const tabs = session.tabs;

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="w-64 shrink-0 border-r border-[var(--border)] bg-white flex flex-col p-4 h-screen sticky top-0 overflow-y-auto">
      <div className="flex items-center gap-2 px-2 py-3 mb-2">
        <div className="w-8 h-8 rounded-xl bg-[var(--primary)] text-white flex items-center justify-center font-bold text-sm">
          SJP
        </div>
        <div>
          <div className="text-sm font-semibold leading-tight">Depot SJP</div>
          <div className="text-[11px] text-[var(--muted)] leading-tight">
            {ROLE_LABELS[session.role]}
          </div>
        </div>
      </div>

      {process.env.NEXT_PUBLIC_ENV === "homologacao" && (
        <div className="mb-2 rounded-lg bg-amber-100 text-amber-800 text-[11px] font-semibold text-center py-1.5">
          AMBIENTE DE HOMOLOGAÇÃO
        </div>
      )}
      <nav className="flex-1 space-y-1">
        {tabs.map((tab) => {
          const meta = TAB_LABELS[tab];
          const href = `/${tab}`;
          const active = pathname.startsWith(href);
          return (
            <Link
              key={tab}
              href={href}
              className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-[var(--primary)] text-white"
                  : "text-[var(--foreground)] hover:bg-gray-100"
              }`}
            >
              <span>{meta.icon}</span>
              {meta.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-[var(--border)] pt-3 mt-3 shrink-0">
        <div className="px-2 text-sm font-medium truncate">{session.nome}</div>
        <button
          onClick={handleLogout}
          className="mt-2 w-full text-left text-sm text-[var(--muted)] hover:text-[var(--danger)] px-2 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
        >
          Sair
        </button>
      </div>
    </aside>
  );
}
