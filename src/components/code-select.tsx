"use client";

import { useEffect, useRef, useState } from "react";

interface Option {
  value: string;
  label: string;
}

// Select compacto: fechado mostra só a sigla (ex: "AL"), aberto mostra a
// sigla + descrição de cada opção (ex: "AL · Alimento"). Usado nos campos de
// Padrão/Status editáveis, que com o <select> nativo ficavam cortando o texto.
export default function CodeSelect({
  value,
  options,
  onChange,
  disabled,
  className = "",
}: {
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <div ref={ref} className={`relative inline-block ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="input py-1 px-2 text-xs w-auto min-w-[52px] text-left disabled:opacity-50 flex items-center justify-between gap-1"
      >
        <span>{value || "—"}</span>
        <span className="text-[9px] text-[var(--muted)]">▾</span>
      </button>
      {open && (
        <div className="absolute z-20 mt-1 min-w-[180px] rounded-lg border border-[var(--border)] bg-white shadow-lg py-1">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 ${
                opt.value === value ? "font-semibold text-[var(--primary)]" : ""
              }`}
            >
              {opt.value} · {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
