"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Inspector } from "../inspector/Inspector";
import { Planner2D } from "../planner2d/Planner2D";
import { IssuesPanel } from "./IssuesPanel";
import { Library } from "./Library";
import { RoomPanel } from "./RoomPanel";
import { Toolbar } from "./Toolbar";
import { useShortcuts } from "./useShortcuts";
import { useStore } from "@/lib/store/useStore";

// three.js is client-only and heavy: load it lazily
const Viewer3D = dynamic(() => import("../viewer3d/Viewer3D").then((m) => m.Viewer3D), { ssr: false, loading: () => <div className="grid h-full place-items-center text-sm text-zinc-500">Loading 3D view…</div> });

function Collapse({ side, open, onToggle, children, width }: { side: "left" | "right"; open: boolean; onToggle: () => void; children: React.ReactNode; width: number }) {
  return (
    <aside className={`relative flex shrink-0 flex-col border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 ${side === "left" ? "border-r" : "border-l"}`} style={{ width: open ? width : 28 }}>
      <button onClick={onToggle} title={open ? "Collapse panel" : "Expand panel"} className="absolute top-2 z-10 h-6 w-6 rounded text-xs text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800" style={side === "left" ? { right: 4 } : { left: 2 }}>
        {side === "left" ? (open ? "◀" : "▶") : open ? "▶" : "◀"}
      </button>
      {open && <div className="flex min-h-0 flex-1 flex-col">{children}</div>}
    </aside>
  );
}

export function App() {
  const hydrate = useStore((s) => s.hydrate);
  const hydrated = useStore((s) => s.hydrated);
  const view = useStore((s) => s.view);
  const selection = useStore((s) => s.selection);
  const scene = useStore((s) => s.scene);
  const notices = useStore((s) => s.notices);
  const [left, setLeft] = useState(true);
  const [right, setRight] = useState(true);
  const [tab, setTab] = useState<"library" | "room">("library");
  useShortcuts();
  useEffect(() => hydrate(), [hydrate]);

  const selected = selection.length === 1 ? scene.equipment.find((e) => e.id === selection[0]) : undefined;
  const hiddenCount = scene.equipment.filter((e) => e.hidden).length;

  if (!hydrated) return <div className="grid h-screen place-items-center text-sm text-zinc-500">Loading…</div>;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <Toolbar />
      {notices.length > 0 && (
        <div className="space-y-1 border-b border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          {notices.map((n, i) => <div key={i} className="flex justify-between"><span>{n}</span><button className="ml-3 underline" onClick={() => useStore.getState().dismissNotice(i)}>Dismiss</button></div>)}
        </div>
      )}
      <div className="flex min-h-0 flex-1">
        <Collapse side="left" open={left} onToggle={() => setLeft(!left)} width={270}>
          <div className="flex border-b border-zinc-200 pr-7 text-sm dark:border-zinc-800">
            {(["library", "room"] as const).map((t) => <button key={t} className={`flex-1 px-3 py-2 capitalize ${tab === t ? "border-b-2 border-blue-600 font-semibold" : "text-zinc-500"}`} onClick={() => setTab(t)}>{t === "library" ? "Equipment" : "Room"}</button>)}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">{tab === "library" ? <Library /> : <RoomPanel />}</div>
        </Collapse>

        <main className={`grid min-w-0 flex-1 ${view === "split" ? "grid-cols-2" : "grid-cols-1"}`}>
          {(view === "2d" || view === "split") && <div className="relative min-h-0 min-w-0 border-r border-zinc-200 dark:border-zinc-800"><Planner2D /></div>}
          {(view === "3d" || view === "split") && <div className="relative min-h-0 min-w-0"><Viewer3D /></div>}
          {hiddenCount > 0 && (
            <button className="absolute bottom-3 right-3 z-10 rounded bg-zinc-800 px-3 py-1.5 text-xs text-white shadow hover:bg-zinc-700" style={{ position: "fixed", bottom: 12, left: left ? 290 : 48 }}
              onClick={() => useStore.getState().commit((s) => ({ ...s, equipment: s.equipment.map((e) => ({ ...e, hidden: false })) }))}>Show {hiddenCount} hidden object{hiddenCount > 1 ? "s" : ""}</button>
          )}
        </main>

        <Collapse side="right" open={right} onToggle={() => setRight(!right)} width={320}>
          <div className="min-h-0 flex-1 overflow-y-auto pl-5">
            {selected ? <Inspector key={selected.id} inst={selected} /> : selection.length > 1 ? (
              <div className="space-y-2 p-3 text-sm"><div className="font-semibold">{selection.length} objects selected</div>
                <div className="flex flex-wrap gap-1">
                  <button className="rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700" onClick={() => useStore.getState().duplicateSelected()}>Duplicate</button>
                  <button className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 dark:border-red-800" onClick={() => useStore.getState().deleteSelected()}>Delete</button>
                </div>
                <p className="text-xs text-zinc-500">Drag to move together. Select a single object to edit its properties.</p>
              </div>
            ) : <RoomPanel />}
          </div>
          <IssuesPanel />
        </Collapse>
      </div>
      <footer className="flex flex-wrap gap-x-4 border-t border-zinc-200 px-3 py-1 text-[11px] text-zinc-500 dark:border-zinc-800">
        <span>Del delete</span><span>⌘/Ctrl+D duplicate</span><span>⌘/Ctrl+Z undo</span><span>⇧⌘/Ctrl+Z redo</span><span>R rotate</span><span>H hide</span><span>L lock</span><span>Arrows nudge</span><span>1/2/3 = 2D/3D/Split</span><span>⌘/Ctrl+S save</span>
      </footer>
    </div>
  );
}
