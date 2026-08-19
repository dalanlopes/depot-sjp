"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ALL_TABS, ROLE_LABELS, TAB_LABELS } from "@/lib/roles";
import type { SessionPayload } from "@/lib/auth";

export default function Nav({ session, children }: { session: SessionPayload, children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const tabs = ALL_TABS.filter((t) => (session.tabs ?? []).includes(t));
  
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setOpen(false);
      } else {
        setOpen(true);
      }
    };
    
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (window.innerWidth < 1024) {
      setOpen(false);
    }
  }, [pathname]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--background)]">
      {/* Overlay Mobile */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 lg:static flex flex-col w-64 bg-white border-r border-[var(--border)] shrink-0 transition-all duration-300 ease-in-out ${
          open ? "translate-x-0 lg:ml-0" : "-translate-x-full lg:translate-x-0 lg:-ml-64"
        }`}
      >
        <div className="flex items-center justify-between px-4 h-14 border-b border-[var(--border)] shrink-0">
          <div className="text-sm font-semibold leading-tight text-[var(--foreground)]">Vale do Tibagi</div>
          <button
            onClick={() => setOpen(false)}
            aria-label="Fechar menu"
            className="p-1 text-[var(--muted)] hover:bg-gray-100 rounded-md lg:hidden"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {process.env.NEXT_PUBLIC_ENV === "homologacao" && (
          <div className="mx-4 mt-4 rounded-lg bg-amber-100 text-amber-800 text-[11px] font-semibold text-center py-1.5">
            AMBIENTE DE HOMOLOGAÇÃO
          </div>
        )}

        <nav className="flex-1 space-y-1 p-4 overflow-y-auto">
          {tabs.map((tab) => {
            const meta = TAB_LABELS[tab];
            const href = `/${tab}`;
            const active = pathname.startsWith(href);
            return (
              <Link
                key={tab}
                href={href}
                onClick={() => {
                  if (window.innerWidth < 1024) setOpen(false);
                }}
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

        <div className="border-t border-[var(--border)] p-4 shrink-0">
          <div className="px-2 text-sm font-medium truncate text-[var(--foreground)]">{session.nome}</div>
          <div className="px-2 text-[11px] text-[var(--muted)] leading-tight">{ROLE_LABELS[session.role]}</div>
          <button
            onClick={handleLogout}
            className="mt-2 w-full text-left text-sm text-[var(--muted)] hover:text-[var(--danger)] px-2 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
          >
            Sair
          </button>
        </div>
      </aside>

      {/* Main Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="sticky top-0 z-20 h-14 bg-white border-b border-[var(--border)] px-4 flex items-center shrink-0">
          <button
            onClick={() => setOpen(!open)}
            aria-label="Alternar menu"
            className="p-2 -ml-2 mr-3 text-[var(--foreground)] hover:bg-gray-100 rounded-md transition-colors"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          
          <span className={`text-sm font-semibold text-[var(--foreground)] transition-opacity duration-300 ${open ? 'lg:opacity-0' : 'opacity-100'}`}>
            Vale do Tibagi
          </span>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
          <div className="w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
