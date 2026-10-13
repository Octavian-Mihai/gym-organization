"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Inspector } from "../inspector/Inspector";
import { Planner2D } from "../planner2d/Planner2D";
import { Library } from "./Library";
import { RoomPanel } from "./RoomPanel";
import { Toolbar } from "./Toolbar";
import { useShortcuts } from "./useShortcuts";
import { useStore } from "@/lib/store/useStore";

// three.js is client-only and heavy: load it lazily, then keep it mounted (remounting the WebGL canvas is what blanked the view)
const Viewer3D = dynamic(() => import("../viewer3d/Viewer3D").then((m) => m.Viewer3D), { ssr: false, loading: () => <div className="grid h-full place-items-center text-sm text-zinc-500">Loading 3D view…</div> });

export function App() {
  const hydrate = useStore((s) => s.hydrate);
  const hydrated = useStore((s) => s.hydrated);
  const view = useStore((s) => s.view);
  const selection = useStore((s) => s.selection);
  const scene = useStore((s) => s.scene);
  const notices = useStore((s) => s.notices);
  const [left, setLeft] = useState(() => typeof window === "undefined" || window.innerWidth >= 700);
  const [tab, setTab] = useState<"library" | "room">("library");
  const [seen3d, setSeen3d] = useState(false);
  useShortcuts();
  useEffect(() => hydrate(), [hydrate]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- remember that the 3D view was opened so it can stay mounted
  useEffect(() => { if (view !== "2d" && !seen3d) setSeen3d(true); }, [view, seen3d]);

  const selected = selection.length === 1 ? scene.equipment.find((e) => e.id === selection[0]) : undefined;
  const hiddenCount = scene.equipment.filter((e) => e.hidden).length;
  const show2d = view === "2d" || view === "split";
  const show3d = view === "3d" || view === "split";

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
        {left ? (
          <aside className="flex w-64 shrink-0 flex-col border-r border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex border-b border-zinc-200 text-sm dark:border-zinc-800">
              {(["library", "room"] as const).map((t) => <button key={t} className={`flex-1 px-3 py-2 ${tab === t ? "border-b-2 border-blue-600 font-semibold" : "text-zinc-500"}`} onClick={() => setTab(t)}>{t === "library" ? "Equipment" : "Room"}</button>)}
              <button className="px-2 text-zinc-400 hover:text-zinc-700" title="Hide panel" onClick={() => setLeft(false)}>◀</button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">{tab === "library" ? <Library /> : <RoomPanel />}</div>
          </aside>
        ) : (
          <button className="w-7 shrink-0 border-r border-zinc-200 bg-zinc-50 text-xs text-zinc-500 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900" title="Show equipment & room panel" onClick={() => setLeft(true)}>▶</button>
        )}

        <main className={`relative grid min-w-0 flex-1 ${view === "split" ? "grid-cols-2" : "grid-cols-1"}`}>
          <div className={`relative min-h-0 min-w-0 ${show2d ? "" : "hidden"} ${view === "split" ? "border-r border-zinc-200 dark:border-zinc-800" : ""}`}><Planner2D /></div>
          {seen3d && <div className={`relative min-h-0 min-w-0 ${show3d ? "" : "hidden"}`}><Viewer3D active={show3d} /></div>}
          {scene.equipment.length === 0 && (
            <div className="pointer-events-none absolute inset-x-0 top-1/3 z-10 mx-auto w-72 rounded-lg border border-zinc-200 bg-white/95 p-4 text-center text-sm shadow dark:border-zinc-700 dark:bg-zinc-900/95">
              <div className="font-semibold">Start with your room</div>
              <p className="mt-1 text-zinc-500">Set its size in the <b>Room</b> tab, then add equipment from the list or drag it onto the plan.</p>
            </div>
          )}
          {hiddenCount > 0 && (
            <button className="absolute bottom-3 right-3 z-10 rounded-md bg-zinc-800 px-3 py-1.5 text-xs text-white shadow hover:bg-zinc-700"
              onClick={() => useStore.getState().commit((s) => ({ ...s, equipment: s.equipment.map((e) => ({ ...e, hidden: false })) }))}>Show {hiddenCount} hidden</button>
          )}
        </main>

        {selection.length > 0 && (
          <aside className="w-72 shrink-0 overflow-y-auto border-l border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
            {selected ? <Inspector key={selected.id} inst={selected} /> : (
              <div className="space-y-2 p-3 text-sm"><div className="font-semibold">{selection.length} objects selected</div>
                <div className="flex flex-wrap gap-1">
                  <button className="rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700" onClick={() => useStore.getState().duplicateSelected()}>Duplicate</button>
                  <button className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 dark:border-red-800" onClick={() => useStore.getState().deleteSelected()}>Delete</button>
                  <button className="rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700" onClick={() => useStore.getState().select([])}>Deselect</button>
                </div>
                <p className="text-xs text-zinc-500">Drag to move them together. Select one object to edit it.</p>
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
