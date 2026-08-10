"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ALL_TABS, ROLE_LABELS, TAB_LABELS } from "@/lib/roles";
import type { SessionPayload } from "@/lib/auth";

export default function Nav({ session }: { session: SessionPayload }) {
  const pathname = usePathname();
  const router = useRouter();
  // Sempre na mesma ordem (a do menu), independente de como as abas
  // foram salvas para cada usuário.
  const tabs = ALL_TABS.filter((t) => (session.tabs ?? []).includes(t));
  const [open, setOpen] = useState(false);

  // Fecha o menu mobile sempre que a rota muda
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      {/* Barra superior visível apenas em telas pequenas */}
      <div className="md:hidden sticky top-0 z-30 h-14 bg-white border-b border-[var(--border)] px-3 flex items-center justify-between">
        <button
          onClick={() => setOpen(true)}
          aria-label="Abrir menu"
          className="p-2 -ml-2 text-[var(--foreground)]"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <span className="text-sm font-semibold">Vale do Tibagi</span>
        <span className="w-9" />
      </div>

      {/* Fundo escurecido ao abrir o menu mobile */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/40"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={`fixed md:sticky top-0 left-0 z-50 md:z-auto h-screen w-64 shrink-0 border-r border-[var(--border)] bg-white flex flex-col p-4 overflow-y-auto transform transition-transform duration-200 ease-in-out ${
          open ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0`}
      >
        <div className="flex items-center justify-between gap-2 px-2 py-3 mb-2">
          <div>
            <div className="text-sm font-semibold leading-tight">Vale do Tibagi</div>
            <div className="text-[11px] text-[var(--muted)] leading-tight">
              {ROLE_LABELS[session.role]}
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            aria-label="Fechar menu"
            className="md:hidden p-1 text-[var(--muted)]"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
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
                onClick={() => setOpen(false)}
                className={`flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-[var(--primary)] text-white"
                    : "text-[var(--foreground)] hover:bg-gray-100"
                }`}
              >
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
    </>
  );
}
