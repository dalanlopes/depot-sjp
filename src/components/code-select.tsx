"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface Option {
  value: string;
  label: string;
}

// Select compacto: fechado mostra só a sigla (ex: "AL"), aberto mostra a
// sigla + descrição de cada opção (ex: "AL · Alimento"). Usado nos campos de
// Padrão/Status editáveis, que com o <select> nativo ficavam cortando o texto.
//
// O menu é renderizado num portal (position: fixed, direto no <body>), não
// dentro do card/tabela onde o botão está. Isso evita que ele fique cortado
// por containers com scroll (ex: popouts de Estoque/Oficina com overflow),
// já que "position: absolute" ficaria preso ao ancestral com overflow.
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
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  function updatePosition() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPos({ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 180) });
  }

  useEffect(() => {
    if (!open) return;
    updatePosition();

    function onDocClick(e: MouseEvent) {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onScrollOrResize() {
      updatePosition();
    }

    document.addEventListener("mousedown", onDocClick);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={`input py-1 px-2 text-xs w-auto min-w-[52px] text-left disabled:opacity-50 flex items-center justify-between gap-1 ${className}`}
      >
        <span>{value || "—"}</span>
        <span className="text-[9px] text-[var(--muted)]">▾</span>
      </button>
      {open &&
        pos &&
        createPortal(
          <div
            ref={menuRef}
            style={{ position: "fixed", top: pos.top, left: pos.left, width: pos.width }}
            className="z-[100] rounded-lg border border-[var(--border)] bg-white shadow-lg py-1 max-h-64 overflow-auto"
          >
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
          </div>,
          document.body
        )}
    </>
  );
}
