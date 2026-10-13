"use client";
import { useRef, useState } from "react";
import { exportPng, exportSvg, printFloorPlan } from "../planner2d/export";
import { MenuItem, Popover } from "../ui/Popover";
import { IssuesList } from "./IssuesPanel";
import { validateSceneCached } from "@/lib/geometry/validation";
import { useStore } from "@/lib/store/useStore";
import type { LengthUnit } from "@/lib/units";

const btn = "rounded-md border border-zinc-300 px-2.5 py-1 text-sm hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-zinc-800";

function download(text: string, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  a.download = name.replace(/[^\w.-]+/g, "_");
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export function Toolbar() {
  const s = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const issues = validateSceneCached(s.scene);
  const errors = issues.filter((i) => i.severity === "error").length;
  const saved = s.scene === s.savedScene;
  const startRename = () => { setDraft(s.name); setEditing(true); };

  return (
    <header className="flex flex-wrap items-center gap-2 border-b border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950">
      <Popover label={<span>🏋️ Designs ▾</span>}>
        {(close) => (
          <div className="w-64">
            <div className="max-h-60 overflow-y-auto">
              {s.designs.map((d) => (
                <div key={d.id} className="flex items-center">
                  <button className={`flex-1 truncate rounded px-2 py-1.5 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 ${d.id === s.currentId ? "font-semibold" : ""}`} onClick={() => { s.switchDesign(d.id); close(); }}>{d.id === s.currentId ? "● " : "○ "}{d.id === s.currentId ? s.name : d.name}</button>
                  {s.designs.length > 1 && <button title="Delete design" className="px-2 text-zinc-400 hover:text-red-600" onClick={() => { if (confirm(`Delete “${d.name}”? This cannot be undone.`)) s.deleteDesign(d.id); }}>✕</button>}
                </div>
              ))}
            </div>
            <hr className="my-1 border-zinc-200 dark:border-zinc-800" />
            <MenuItem onClick={() => { const n = prompt("Name for the new design?", "Untitled gym"); if (n) s.newDesign(n); close(); }}>＋ New design…</MenuItem>
            <MenuItem onClick={() => { s.duplicateDesign(); close(); }}>Duplicate this design</MenuItem>
            <MenuItem onClick={() => { startRename(); close(); }}>Rename</MenuItem>
          </div>
        )}
      </Popover>

      {editing ? (
        <input autoFocus className="rounded-md border border-blue-500 bg-transparent px-2 py-1 text-sm outline-none" value={draft} onChange={(e) => setDraft(e.target.value)}
          onBlur={() => { setEditing(false); if (draft.trim()) s.renameDesign(draft.trim()); }} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setEditing(false); }} />
      ) : (
        <button className="max-w-56 truncate rounded px-1.5 py-1 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800" title="Rename" onClick={startRename}>{s.name}</button>
      )}
      <span className="text-xs text-zinc-500">{saved ? "Saved" : "Saving…"}</span>

      <div className="mx-1 flex">
        <button className={`${btn} rounded-r-none`} onClick={s.undo} disabled={!s.past.length} title="Undo (⌘/Ctrl+Z)">↶</button>
        <button className={`${btn} -ml-px rounded-l-none`} onClick={s.redo} disabled={!s.future.length} title="Redo (⇧⌘/Ctrl+Z)">↷</button>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <Popover align="right" label={errors ? <span className="text-red-600">⚠ {issues.length}</span> : issues.length ? <span className="text-amber-600">⚠ {issues.length}</span> : <span className="text-emerald-600">✓ No warnings</span>} title="Layout checks" panelClassName="w-80">
          <IssuesList />
        </Popover>
        <select className="rounded-md border border-zinc-300 bg-transparent px-1.5 py-1 text-sm dark:border-zinc-700" value={s.settings.displayUnit} onChange={(e) => s.setSettings({ displayUnit: e.target.value as LengthUnit })} title="Display units">
          <option value="in">in</option><option value="ft">ft + in</option><option value="mm">mm</option><option value="cm">cm</option><option value="m">m</option>
        </select>
        <div className="flex overflow-hidden rounded-md border border-zinc-300 dark:border-zinc-700" role="tablist">
          {(["2d", "3d", "split"] as const).map((v) => <button key={v} role="tab" aria-selected={s.view === v} className={`px-3 py-1 text-sm ${s.view === v ? "bg-blue-600 text-white" : "hover:bg-zinc-100 dark:hover:bg-zinc-800"}`} onClick={() => s.setView(v)}>{v === "split" ? "Split" : v.toUpperCase()}</button>)}
        </div>
        <Popover align="right" label="Export ▾">
          {(close) => (
            <div className="w-56">
              <MenuItem onClick={() => { download(s.exportCurrent(), `${s.name}.gym.json`); close(); }}>Save design file (JSON)</MenuItem>
              <MenuItem onClick={() => { download(s.exportAll(), "home-gym-all-designs.json"); close(); }}>Save all designs (JSON)</MenuItem>
              <MenuItem onClick={() => { fileRef.current?.click(); close(); }}>Open design file…</MenuItem>
              <hr className="my-1 border-zinc-200 dark:border-zinc-800" />
              <MenuItem onClick={() => { exportPng(s.scene, s.settings.displayUnit, s.name); close(); }}>Floor plan as PNG</MenuItem>
              <MenuItem onClick={() => { exportSvg(s.scene, s.settings.displayUnit, s.name); close(); }}>Floor plan as SVG</MenuItem>
              <MenuItem onClick={() => { if (!printFloorPlan(s.scene, s.settings.displayUnit, s.name)) s.addNotice("Pop-up blocked: allow pop-ups to print."); close(); }}>Print / save as PDF…</MenuItem>
            </div>
          )}
        </Popover>
        <Popover align="right" label="?" title="Keyboard shortcuts" panelClassName="w-64 text-xs">
          <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            {[["Del", "Delete"], ["⌘/Ctrl D", "Duplicate"], ["⌘/Ctrl Z", "Undo"], ["⇧⌘/Ctrl Z", "Redo"], ["⌘/Ctrl C / V", "Copy / paste"], ["R", "Rotate 90°"], ["H / L", "Hide / lock"], ["Arrows", "Nudge"], ["1 / 2 / 3", "2D / 3D / Split"], ["Alt + drag", "Move without snapping"], ["Space + drag", "Pan the plan"]].map(([k, v]) => <><kbd key={k} className="font-mono text-zinc-500">{k}</kbd><span key={v}>{v}</span></>)}
          </div>
        </Popover>
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
