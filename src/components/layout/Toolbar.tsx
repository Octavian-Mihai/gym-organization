"use client";
import { useEffect, useRef, useState } from "react";
import { exportPng, exportSvg, printFloorPlan } from "../planner2d/export";
import { isDirty, useStore } from "@/lib/store/useStore";
import type { LengthUnit } from "@/lib/units";

const b = "rounded border border-zinc-300 px-2.5 py-1 text-sm hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-zinc-800";

function Menu({ label, children }: { label: string; children: (close: () => void) => React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div ref={ref} className="relative">
      <button className={b} onClick={() => setOpen((o) => !o)}>{label} ▾</button>
      {open && <div className="absolute right-0 top-full z-50 mt-1 min-w-52 rounded-md border border-zinc-300 bg-white p-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">{children(() => setOpen(false))}</div>}
    </div>
  );
}
const Item = ({ onClick, children, danger }: { onClick: () => void; children: React.ReactNode; danger?: boolean }) => (
  <button className={`block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 ${danger ? "text-red-600" : ""}`} onClick={onClick}>{children}</button>
);

function download(text: string, name: string, type = "application/json") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name.replace(/[^\w.-]+/g, "_");
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export function Toolbar() {
  const s = useStore();
  const dirty = isDirty(s);
  const fileRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState(s.name);
  const startRename = () => { setNameDraft(s.name); setEditing(true); };

  return (
    <header className="flex flex-wrap items-center gap-2 border-b border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mr-2 text-sm font-bold tracking-tight">🏋️ Home Gym Designer</div>

      <Menu label="Designs">
        {(close) => (
          <>
            <div className="max-h-60 overflow-y-auto">
              {s.designs.map((d) => (
                <div key={d.id} className="flex items-center">
                  <button className={`flex-1 truncate rounded px-2 py-1.5 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 ${d.id === s.currentId ? "font-semibold" : ""}`} onClick={() => { s.switchDesign(d.id); close(); }}>{d.id === s.currentId ? "● " : ""}{d.id === s.currentId ? s.name : d.name}</button>
                  <button title="Delete design" className="px-2 text-zinc-400 hover:text-red-600" onClick={() => { if (confirm(`Delete “${d.name}”? This cannot be undone.`)) s.deleteDesign(d.id); }}>✕</button>
                </div>
              ))}
            </div>
            <hr className="my-1 border-zinc-200 dark:border-zinc-800" />
            <Item onClick={() => { const n = prompt("Name for the new design?", "Untitled gym"); if (n) s.newDesign(n); close(); }}>New design…</Item>
            <Item onClick={() => { s.duplicateDesign(); close(); }}>Duplicate current</Item>
            <Item onClick={() => { startRename(); close(); }}>Rename current</Item>
          </>
        )}
      </Menu>

      {editing ? (
        <input autoFocus className="rounded border border-blue-500 bg-transparent px-2 py-1 text-sm outline-none" value={nameDraft} onChange={(e) => setNameDraft(e.target.value)}
          onBlur={() => { setEditing(false); if (nameDraft.trim()) s.renameDesign(nameDraft.trim()); }} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") { setNameDraft(s.name); setEditing(false); } }} />
      ) : (
        <button className="max-w-60 truncate rounded px-2 py-1 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800" title="Click to rename" onClick={startRename}>{s.name}</button>
      )}
      <span className={`text-xs ${dirty ? "text-amber-600" : "text-emerald-600"}`}>{dirty ? "● Unsaved changes" : "✓ Saved"}</span>
      <button className={b} onClick={s.saveCurrent} disabled={!dirty}>Save</button>
      <button className={b} onClick={() => { if (confirm("Discard all unsaved changes?")) s.revert(); }} disabled={!dirty}>Revert</button>

      <div className="mx-1 h-5 w-px bg-zinc-300 dark:bg-zinc-700" />
      <button className={b} onClick={s.undo} disabled={!s.past.length} title="Undo (⌘/Ctrl+Z)">↶ Undo</button>
      <button className={b} onClick={s.redo} disabled={!s.future.length} title="Redo (⇧⌘/Ctrl+Z)">↷ Redo</button>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-400">Units
          <select className="rounded border border-zinc-300 bg-transparent px-1 py-1 text-sm dark:border-zinc-700" value={s.settings.displayUnit} onChange={(e) => s.setSettings({ displayUnit: e.target.value as LengthUnit })}>
            <option value="in">inches</option><option value="ft">feet &amp; inches</option><option value="mm">millimeters</option><option value="cm">centimeters</option><option value="m">meters</option>
          </select>
        </label>
        <div className="flex overflow-hidden rounded border border-zinc-300 dark:border-zinc-700" role="tablist">
          {(["2d", "3d", "split"] as const).map((v) => <button key={v} role="tab" aria-selected={s.view === v} className={`px-3 py-1 text-sm ${s.view === v ? "bg-blue-600 text-white" : "hover:bg-zinc-100 dark:hover:bg-zinc-800"}`} onClick={() => s.setView(v)}>{v === "split" ? "Split" : v.toUpperCase()}</button>)}
        </div>
        <Menu label="Export / Import">
          {(close) => (
            <>
              <Item onClick={() => { download(s.exportCurrent(), `${s.name}.gym.json`); close(); }}>Export design (JSON)</Item>
              <Item onClick={() => { download(s.exportAll(), `home-gym-all-designs.json`); close(); }}>Export all designs (JSON)</Item>
              <Item onClick={() => { fileRef.current?.click(); close(); }}>Import JSON…</Item>
              <hr className="my-1 border-zinc-200 dark:border-zinc-800" />
              <Item onClick={() => { exportPng(s.scene, s.settings.displayUnit, s.name); close(); }}>Floor plan → PNG</Item>
              <Item onClick={() => { exportSvg(s.scene, s.settings.displayUnit, s.name); close(); }}>Floor plan → SVG</Item>
              <Item onClick={() => { if (!printFloorPlan(s.scene, s.settings.displayUnit, s.name)) s.addNotice("Pop-up blocked: allow pop-ups to print."); close(); }}>Print / save as PDF…</Item>
            </>
          )}
        </Menu>
        <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          const r = s.importText(await f.text());
          s.addNotice(r.message);
        }} />
      </div>
    </header>
  );
}
