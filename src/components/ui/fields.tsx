"use client";
import { useState } from "react";
import { formatLength, fromMm, parseLength, toMm, type LengthUnit } from "@/lib/units";
import { useStore } from "@/lib/store/useStore";
import type { FieldDef } from "@/lib/equipment/types";

const inputCls = "w-full rounded border border-zinc-300 bg-white px-1.5 py-1 text-xs text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

export const useUnit = (): LengthUnit => useStore((s) => s.settings.displayUnit);

/** Editable length. Shows a value in the display unit; accepts "36", "36 in", "5' 6\"", "915mm". Stores mm. */
export function LengthField({ label, value, onChange, min, max, disabled, hint }: { label: string; value: number; onChange: (mm: number) => void; min?: number; max?: number; disabled?: boolean; hint?: string }) {
  const unit = useUnit();
  const [draft, setDraft] = useState<string | null>(null); // non-null only while editing
  const [bad, setBad] = useState(false);
  const shown = draft ?? formatLength(value, unit, 2);
  const commit = () => {
    if (draft === null) return;
    const mm = parseLength(draft, unit);
    setDraft(null);
    if (mm === null || !isFinite(mm)) { setBad(true); setTimeout(() => setBad(false), 900); return; }
    const clamped = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, mm));
    if (clamped !== value) onChange(clamped);
  };
  return (
    <label className="flex items-center gap-2 text-xs" title={hint}>
      {label && <span className="w-28 shrink-0 truncate text-zinc-600 dark:text-zinc-400">{label}</span>}
      <input
        className={`${inputCls} ${bad ? "border-red-500" : ""}`}
        value={shown}
        disabled={disabled}
        onFocus={(e) => { setDraft(formatLength(value, unit, 2)); e.target.select(); }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") { setDraft(null); (e.target as HTMLInputElement).blur(); } e.stopPropagation(); }}
      />
    </label>
  );
}

export function NumberField({ label, value, onChange, min, max, step = 1, suffix, integer, disabled }: { label: string; value: number; onChange: (n: number) => void; min?: number; max?: number; step?: number; suffix?: string; integer?: boolean; disabled?: boolean }) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? String(round(value));
  const commit = () => {
    if (draft === null) return;
    let n = parseFloat(draft.replace(",", "."));
    setDraft(null);
    if (!isFinite(n)) return;
    if (integer) n = Math.round(n);
    n = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n));
    if (n !== value) onChange(n);
  };
  return (
    <label className="flex items-center gap-2 text-xs">
      {label && <span className="w-28 shrink-0 truncate text-zinc-600 dark:text-zinc-400">{label}</span>}
      <input className={inputCls} type="text" inputMode="decimal" value={shown} disabled={disabled}
        onFocus={(e) => { setDraft(String(round(value))); e.target.select(); }} onChange={(e) => setDraft(e.target.value)} onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "ArrowUp") { e.preventDefault(); onChange(Math.min(max ?? Infinity, value + step)); } if (e.key === "ArrowDown") { e.preventDefault(); onChange(Math.max(min ?? -Infinity, value - step)); } e.stopPropagation(); }} />
      {suffix && <span className="w-6 text-zinc-500">{suffix}</span>}
    </label>
  );
}
const round = (n: number) => Math.round(n * 1000) / 1000;

export function TextField({ label, value, onChange, disabled }: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <label className="flex items-center gap-2 text-xs">
      {label && <span className="w-28 shrink-0 truncate text-zinc-600 dark:text-zinc-400">{label}</span>}
      <input className={inputCls} value={draft ?? value} disabled={disabled} onFocus={() => setDraft(value)} onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { if (draft !== null && draft !== value) onChange(draft); setDraft(null); }} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); e.stopPropagation(); }} />
    </label>
  );
}

export function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center gap-2 text-xs">
      {label && <span className="w-28 shrink-0 truncate text-zinc-600 dark:text-zinc-400">{label}</span>}
      <input type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#888888"} onChange={(e) => onChange(e.target.value)} className="h-6 w-10 cursor-pointer rounded border border-zinc-300 bg-transparent p-0 dark:border-zinc-700" />
      <span className="font-mono text-zinc-500">{value}</span>
    </label>
  );
}

export function BoolField({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-xs">
      {label && <span className="w-28 shrink-0 truncate text-zinc-600 dark:text-zinc-400">{label}</span>}
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

export function SelectField({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center gap-2 text-xs">
      {label && <span className="w-28 shrink-0 truncate text-zinc-600 dark:text-zinc-400">{label}</span>}
      <select className={inputCls} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

/** Renders a def's declared fields (basic or advanced tier), grouped, honoring `showIf`. */
export function ConfigFields({ fields, config, onChange, disabled, tier = "basic" }: { fields: FieldDef[]; config: Record<string, unknown>; onChange: (patch: Record<string, unknown>) => void; disabled?: boolean; tier?: "basic" | "advanced" }) {
  const visible = fields.filter((f) => !!f.advanced === (tier === "advanced") && (!f.showIf || f.showIf(config)));
  const groups: Record<string, FieldDef[]> = {};
  for (const f of visible) (groups[f.group ?? ""] ||= []).push(f);
  if (visible.length === 0) return null;
  return (
    <div className="space-y-3">
      {Object.entries(groups).map(([g, fs]) => (
        <div key={g} className="space-y-1.5">
          {g && <div className="pt-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{g}</div>}
          {fs.map((f) => {
            const v = config[f.key];
            switch (f.kind) {
              case "length": return <LengthField key={f.key} label={f.label} value={Number(v)} min={f.min} max={f.max} hint={f.help} disabled={disabled} onChange={(mm) => onChange({ [f.key]: mm })} />;
              case "number": return <NumberField key={f.key} label={f.label} value={Number(v ?? 0)} min={f.min} max={f.max} step={f.step} suffix={f.suffix} integer={f.integer} disabled={disabled} onChange={(n) => onChange({ [f.key]: n })} />;
              case "text": return <TextField key={f.key} label={f.label} value={String(v ?? "")} disabled={disabled} onChange={(t) => onChange({ [f.key]: t })} />;
              case "color": return <ColorField key={f.key} label={f.label} value={String(v)} onChange={(c) => onChange({ [f.key]: c })} />;
              case "boolean": return <BoolField key={f.key} label={f.label} value={!!v} onChange={(b) => onChange({ [f.key]: b })} />;
              case "select": return <SelectField key={f.key} label={f.label} value={String(v)} options={f.options} onChange={(o) => onChange({ [f.key]: /^\d+$/.test(o) ? Number(o) : o })} />;
            }
          })}
        </div>
      ))}
    </div>
  );
}

export { fromMm, toMm };
