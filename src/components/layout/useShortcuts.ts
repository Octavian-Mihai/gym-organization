"use client";
import { useEffect } from "react";
import { updatePlacement } from "@/lib/store/scene-ops";
import { useStore } from "@/lib/store/useStore";

export function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t instanceof HTMLInputElement && t.type !== "checkbox" || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) return;
      const s = useStore.getState();
      const mod = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      if (mod && k === "z") { e.preventDefault(); e.shiftKey ? s.redo() : s.undo(); return; }
      if (mod && k === "y") { e.preventDefault(); s.redo(); return; }
      if (mod && k === "s") { e.preventDefault(); s.saveCurrent(); return; }
      if (mod && k === "d") { e.preventDefault(); s.duplicateSelected(); return; }
      if (mod && k === "c") { s.copySelected(); return; }
      if (mod && k === "v") { e.preventDefault(); s.paste(); return; }
      if (mod && k === "a") { e.preventDefault(); s.select(s.scene.equipment.filter((q) => !q.hidden).map((q) => q.id)); return; }
      if (mod) return;
      if (k === "delete" || k === "backspace") { e.preventDefault(); s.deleteSelected(); return; }
      if (k === "escape") { s.select([]); return; }
      if (k === "1") { s.setView("2d"); return; }
      if (k === "2") { s.setView("3d"); return; }
      if (k === "3") { s.setView("split"); return; }
      if (k === "r" && s.selection.length) {
        s.commit((sc) => s.selection.reduce((acc, id) => { const q = acc.equipment.find((z) => z.id === id); return q && !q.locked ? updatePlacement(acc, id, { rotation: (q.placement.rotation + (e.shiftKey ? 270 : 90)) % 360 }) : acc; }, sc));
        return;
      }
      if (k === "h" && s.selection.length) { s.commit((sc) => ({ ...sc, equipment: sc.equipment.map((q) => (s.selection.includes(q.id) ? { ...q, hidden: true } : q)) })); s.select([]); return; }
      if (k === "l" && s.selection.length) { s.commit((sc) => ({ ...sc, equipment: sc.equipment.map((q) => (s.selection.includes(q.id) ? { ...q, locked: !q.locked } : q)) })); return; }
      if (k.startsWith("arrow") && s.selection.length) {
        e.preventDefault();
        const step = e.shiftKey ? s.settings.gridSize * 10 : s.settings.gridSize;
        const dx = k === "arrowleft" ? -step : k === "arrowright" ? step : 0;
        const dy = k === "arrowup" ? -step : k === "arrowdown" ? step : 0;
        s.commit((sc) => ({ ...sc, equipment: sc.equipment.map((q) => (s.selection.includes(q.id) && !q.locked && !q.parentId ? { ...q, placement: { ...q.placement, x: q.placement.x + dx, y: q.placement.y + dy } } : q)) }));
      }
    };
    window.addEventListener("keydown", onKey);
    const beforeUnload = (e: BeforeUnloadEvent) => { const s = useStore.getState(); if (s.scene !== s.savedScene) { e.preventDefault(); } };
    window.addEventListener("beforeunload", beforeUnload);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("beforeunload", beforeUnload); };
  }, []);
}
