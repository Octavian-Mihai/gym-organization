"use client";
import { useEffect, useState } from "react";
import { formatLength, fromMm, parseLength, toMm, type LengthUnit } from "@/lib/units";
import { useStore } from "@/lib/store/useStore";
import type { FieldDef } from "@/lib/equipment/types";

const inputCls = "w-full rounded border border-zinc-300 bg-white px-1.5 py-1 text-xs text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

export const useUnit = (): LengthUnit => useStore((s) => s.settings.displayUnit);

/** Editable length. Shows a value in the display unit; accepts "36", "36 in", "5' 6\"", "915mm". Stores mm. */
export function LengthField({ label, value, onChange, min, max, disabled, hint }: { label: string; value: number; onChange: (mm: number) => void; min?: number; max?: number; disabled?: boolean; hint?: string }) {
  const unit = useUnit();
  const [text, setText] = useState(() => formatLength(value, unit, 2));
  const [editing, setEditing] = useState(false);
  const [bad, setBad] = useState(false);
  useEffect(() => { if (!editing) setText(formatLength(value, unit, 2)); }, [value, unit, editing]);
  const commit = () => {
    setEditing(false);
    const mm = parseLength(text, unit);
    if (mm === null || !isFinite(mm)) { setBad(true); setText(formatLength(value, unit, 2)); setTimeout(() => setBad(false), 900); return; }
    const clamped = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, mm));
    if (clamped !== value) onChange(clamped);
    else setText(formatLength(value, unit, 2));
  };
  return (
    <label className="flex items-center gap-2 text-xs" title={hint}>
      <span className="w-28 shrink-0 truncate text-zinc-600 dark:text-zinc-400">{label}</span>
      <input
        className={`${inputCls} ${bad ? "border-red-500" : ""}`}
        value={text}
        disabled={disabled}
        onFocus={(e) => { setEditing(true); e.target.select(); }}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") { setEditing(false); setText(formatLength(value, unit, 2)); (e.target as HTMLInputElement).blur(); } e.stopPropagation(); }}
      />
    </label>
  );
}

export function NumberField({ label, value, onChange, min, max, step = 1, suffix, integer, disabled }: { label: string; value: number; onChange: (n: number) => void; min?: number; max?: number; step?: number; suffix?: string; integer?: boolean; disabled?: boolean }) {
  const [text, setText] = useState(String(round(value)));
  const [editing, setEditing] = useState(false);
  useEffect(() => { if (!editing) setText(String(round(value))); }, [value, editing]);
  const commit = () => {
    setEditing(false);
    let n = parseFloat(text.replace(",", "."));
    if (!isFinite(n)) { setText(String(round(value))); return; }
    if (integer) n = Math.round(n);
    n = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n));
    if (n !== value) onChange(n); else setText(String(round(value)));
  };
  return (
    <label className="flex items-center gap-2 text-xs">
      <span className="w-28 shrink-0 truncate text-zinc-600 dark:text-zinc-400">{label}</span>
      <input className={inputCls} type="text" inputMode="decimal" value={text} disabled={disabled} step={step}
        onFocus={(e) => { setEditing(true); e.target.select(); }} onChange={(e) => setText(e.target.value)} onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "ArrowUp") { e.preventDefault(); onChange(Math.min(max ?? Infinity, value + step)); } if (e.key === "ArrowDown") { e.preventDefault(); onChange(Math.max(min ?? -Infinity, value - step)); } e.stopPropagation(); }} />
      {suffix && <span className="w-6 text-zinc-500">{suffix}</span>}
    </label>
  );
}
const round = (n: number) => Math.round(n * 1000) / 1000;

export function TextField({ label, value, onChange, disabled }: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <label className="flex items-center gap-2 text-xs">
      <span className="w-28 shrink-0 truncate text-zinc-600 dark:text-zinc-400">{label}</span>
      <input className={inputCls} value={text} disabled={disabled} onChange={(e) => setText(e.target.value)} onBlur={() => text !== value && onChange(text)} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); e.stopPropagation(); }} />
    </label>
  );
}

export function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center gap-2 text-xs">
      <span className="w-28 shrink-0 truncate text-zinc-600 dark:text-zinc-400">{label}</span>
      <input type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#888888"} onChange={(e) => onChange(e.target.value)} className="h-6 w-10 cursor-pointer rounded border border-zinc-300 bg-transparent p-0 dark:border-zinc-700" />
      <span className="font-mono text-zinc-500">{value}</span>
    </label>
  );
}

export function BoolField({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-xs">
      <span className="w-28 shrink-0 truncate text-zinc-600 dark:text-zinc-400">{label}</span>
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

export function SelectField({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center gap-2 text-xs">
      <span className="w-28 shrink-0 truncate text-zinc-600 dark:text-zinc-400">{label}</span>
      <select className={inputCls} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

/** Renders a def's declared fields, grouped, for any config object. */
export function ConfigFields({ fields, config, onChange, disabled }: { fields: FieldDef[]; config: Record<string, unknown>; onChange: (patch: Record<string, unknown>) => void; disabled?: boolean }) {
  const groups: Record<string, FieldDef[]> = {};
  for (const f of fields) (groups[f.group ?? ""] ||= []).push(f);
  return (
    <div className="space-y-3">
      {Object.entries(groups).map(([g, fs]) => (
        <div key={g} className="space-y-1.5">
          {g && <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{g}</div>}
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
