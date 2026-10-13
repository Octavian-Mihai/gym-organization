"use client";
import { useEffect, useRef, useState } from "react";

/** Small click-to-open panel that closes on outside click / Escape. */
export function Popover({ label, title, children, align = "left", up = false, className = "", panelClassName = "" }: { label: React.ReactNode; title?: string; children: React.ReactNode | ((close: () => void) => React.ReactNode); align?: "left" | "right"; up?: boolean; className?: string; panelClassName?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", down); document.removeEventListener("keydown", key); };
  }, [open]);
  return (
    <div ref={ref} className="relative" data-ui>
      <button title={title} aria-expanded={open} onClick={() => setOpen((o) => !o)} className={`rounded-md border border-zinc-300 px-2.5 py-1 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800 ${open ? "bg-zinc-100 dark:bg-zinc-800" : ""} ${className}`}>{label}</button>
      {open && (
        <div className={`absolute z-50 min-w-48 rounded-lg border border-zinc-200 bg-white p-2 shadow-xl dark:border-zinc-700 dark:bg-zinc-900 ${up ? "bottom-full mb-1" : "top-full mt-1"} ${align === "right" ? "right-0" : "left-0"} ${panelClassName}`}>
          {typeof children === "function" ? children(() => setOpen(false)) : children}
        </div>
      )}
    </div>
  );
}

export const MenuItem = ({ onClick, children, danger, disabled }: { onClick: () => void; children: React.ReactNode; danger?: boolean; disabled?: boolean }) => (
  <button disabled={disabled} className={`block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-zinc-100 disabled:opacity-40 dark:hover:bg-zinc-800 ${danger ? "text-red-600" : ""}`} onClick={onClick}>{children}</button>
);
