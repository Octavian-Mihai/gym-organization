"use client";
import { create } from "zustand";
import { importJson, serializeAll, serializeDesign } from "../persistence/schema";
import { newDesign } from "../scene/defaults";
import { createInstance } from "../scene/factory";
import { newId } from "../scene/ids";
import type { Design, EquipmentInstance, Scene, UserSettings, WallId } from "../scene/types";
import { DEFAULT_SETTINGS, loadCurrentId, loadDesigns, loadSettings, saveCurrentId, saveDesigns, saveSettings } from "./storage";
import * as ops from "./scene-ops";

const HISTORY_LIMIT = 100;
const DRAFT_KEY = "homegym:v1:draft";

export type ViewMode = "2d" | "3d" | "split";
export type WallVis = "auto" | "visible" | "transparent" | "hidden";
export type CameraPreset = "iso" | "top" | "front" | "side";

interface State {
  hydrated: boolean;
  designs: Design[];
  currentId: string;
  name: string;
  scene: Scene;
  savedScene: Scene;
  past: Scene[];
  future: Scene[];
  gestureStart: Scene | null;
  selection: string[];
  settings: UserSettings;
  view: ViewMode;
  notices: string[];
  focusIssue: string | null;
  clipboard: EquipmentInstance[];
  // 3D view options
  showCeiling: boolean;
  wallVis: Record<WallId, WallVis>;
  ortho: boolean;
  wireframe: boolean;
  cameraPreset: { preset: CameraPreset; nonce: number };
}

interface Actions {
  hydrate(): void;
  commit(fn: (s: Scene) => Scene): void;
  beginGesture(): void;
  transient(fn: (s: Scene) => Scene): void;
  endGesture(): void;
  undo(): void;
  redo(): void;
  select(ids: string[], additive?: boolean): void;
  addEquipment(type: string, opts?: { configPatch?: object; at?: { x: number; y: number } }): string;
  deleteSelected(): void;
  duplicateSelected(): void;
  copySelected(): void;
  paste(): void;
  setSettings(p: Partial<UserSettings>): void;
  setView(v: ViewMode): void;
  set3d(p: Partial<Pick<State, "showCeiling" | "ortho" | "wireframe">>): void;
  setWallVis(w: WallId, v: WallVis): void;
  setCameraPreset(p: CameraPreset): void;
  // designs
  saveCurrent(): void;
  revert(): void;
  newDesign(name?: string): void;
  duplicateDesign(): void;
  renameDesign(name: string): void;
  deleteDesign(id: string): void;
  switchDesign(id: string): void;
  exportCurrent(): string;
  exportAll(): string;
  importText(text: string): { ok: boolean; message: string };
  dismissNotice(i: number): void;
  addNotice(m: string): void;
  setFocusIssue(id: string | null): void;
}

const initial = newDesign("My home gym");

export const useStore = create<State & Actions>()((set, get) => {
  const pushHistory = (prev: Scene) =>
    set((st) => ({ past: [...st.past, prev].slice(-HISTORY_LIMIT), future: [] }));

  const persistDraft = () => {
    try {
      const st = get();
      if (st.scene === st.savedScene) localStorage.removeItem(DRAFT_KEY);
      else localStorage.setItem(DRAFT_KEY, JSON.stringify({ id: st.currentId, scene: st.scene }));
    } catch { /* storage unavailable */ }
  };

  const loadInto = (d: Design) =>
    set({ currentId: d.id, name: d.name, scene: d.scene, savedScene: d.scene, past: [], future: [], selection: [], gestureStart: null });

  return {
    hydrated: false,
    designs: [initial],
    currentId: initial.id,
    name: initial.name,
    scene: initial.scene,
    savedScene: initial.scene,
    past: [],
    future: [],
    gestureStart: null,
    selection: [],
    settings: DEFAULT_SETTINGS,
    view: "2d",
    notices: [],
    focusIssue: null,
    clipboard: [],
    showCeiling: false,
    wallVis: { north: "auto", east: "auto", south: "auto", west: "auto" },
    ortho: false,
    wireframe: false,
    cameraPreset: { preset: "iso", nonce: 0 },

    hydrate() {
      if (get().hydrated) return;
      const { designs, warnings } = loadDesigns();
      const settings = loadSettings();
      const list = designs.length ? designs : [initial];
      if (!designs.length) saveDesigns(list);
      const cur = list.find((d) => d.id === loadCurrentId()) ?? list[0];
      set({ hydrated: true, designs: list, settings, notices: warnings });
      loadInto(cur);
      try {
        const raw = localStorage.getItem(DRAFT_KEY);
        if (raw) {
          const dr = JSON.parse(raw);
          if (dr.id === cur.id) {
            const parsed = importJson(JSON.stringify({ design: { ...cur, scene: dr.scene } })).designs[0];
            set({ scene: parsed.scene });
            get().addNotice("Restored unsaved changes from your last session.");
          }
        }
      } catch { /* ignore bad draft */ }
    },

    commit(fn) {
      const prev = get().scene;
      const next = fn(prev);
      if (next === prev) return;
      pushHistory(prev);
      set({ scene: next });
      persistDraft();
    },
    beginGesture() { set({ gestureStart: get().scene }); },
    transient(fn) { set((st) => ({ scene: fn(st.scene) })); },
    endGesture() {
      const { gestureStart, scene } = get();
      if (gestureStart && gestureStart !== scene) pushHistory(gestureStart);
      set({ gestureStart: null });
      persistDraft();
    },
    undo() {
      const { past, scene, future } = get();
      if (!past.length) return;
      set({ scene: past[past.length - 1], past: past.slice(0, -1), future: [scene, ...future] });
      persistDraft();
    },
    redo() {
      const { past, scene, future } = get();
      if (!future.length) return;
      set({ scene: future[0], past: [...past, scene], future: future.slice(1) });
      persistDraft();
    },
    select(ids, additive) {
      const st = get();
      const expanded = ops.expandGroups(st.scene, ids);
      set({ selection: additive ? [...new Set([...st.selection, ...expanded])] : expanded });
    },
    addEquipment(type, opts = {}) {
      const st = get();
      const inst = createInstance(type, {}, opts.configPatch ?? {});
      const { length: L, width: W } = st.scene.room;
      inst.placement = { ...inst.placement, x: opts.at?.x ?? L / 2, y: opts.at?.y ?? W / 2 };
      const wm = wallMountedType(inst);
      get().commit((s) => {
        let next: Scene = { ...s, equipment: [...s.equipment, inst] };
        if (wm) {
          const patch = ops.wallMount(next, inst, "north");
          next = ops.updatePlacement(next, inst.id, { ...patch, z: inst.type === "pegboard" ? 900 : inst.type === "mirror" ? 200 : 600 });
        }
        return next;
      });
      set({ selection: [inst.id] });
      return inst.id;
    },
    deleteSelected() {
      const ids = get().selection.filter((id) => !get().scene.equipment.find((e) => e.id === id)?.locked);
      if (!ids.length) return;
      get().commit((s) => ops.removeInstances(s, ids));
      set({ selection: [] });
    },
    duplicateSelected() {
      const ids = get().selection;
      if (!ids.length) return;
      let created: string[] = [];
      get().commit((s) => {
        const r = ops.duplicateInstances(s, ids);
        created = r.newIds;
        return r.scene;
      });
      set({ selection: created });
    },
    copySelected() {
      const st = get();
      set({ clipboard: st.scene.equipment.filter((e) => st.selection.includes(e.id)) });
    },
    paste() {
      const clip = get().clipboard;
      if (!clip.length) return;
      const idMap = new Map(clip.map((e) => [e.id, newId("eq")]));
      const clones = clip.map((e) => ({ ...e, id: idMap.get(e.id)!, parentId: e.parentId && idMap.has(e.parentId) ? idMap.get(e.parentId) : undefined, placement: { ...e.placement, x: e.placement.x + (e.parentId ? 0 : 300), y: e.placement.y + (e.parentId ? 0 : 300) }, config: JSON.parse(JSON.stringify(e.config)) }));
      get().commit((s) => ({ ...s, equipment: [...s.equipment, ...clones] }));
      set({ selection: clones.map((c) => c.id) });
    },
    setSettings(p) {
      const settings = { ...get().settings, ...p };
      set({ settings });
      saveSettings(settings);
    },
    setView(view) { set({ view }); },
    set3d(p) { set(p); },
    setWallVis(w, v) { set((st) => ({ wallVis: { ...st.wallVis, [w]: v } })); },
    setCameraPreset(preset) { set((st) => ({ cameraPreset: { preset, nonce: st.cameraPreset.nonce + 1 } })); },

    saveCurrent() {
      const st = get();
      const now = new Date().toISOString();
      const designs = st.designs.map((d) => (d.id === st.currentId ? { ...d, name: st.name, scene: st.scene, updatedAt: now } : d));
      if (!saveDesigns(designs)) { get().addNotice("Could not save: browser storage is unavailable or full. Use Export to back up."); return; }
      saveCurrentId(st.currentId);
      set({ designs, savedScene: st.scene });
      persistDraft();
    },
    revert() {
      const st = get();
      const d = st.designs.find((x) => x.id === st.currentId);
      if (!d) return;
      loadInto(d);
      persistDraft();
    },
    newDesign(name = "Untitled gym") {
      const d = newDesign(name);
      const designs = [...get().designs, d];
      saveDesigns(designs);
      set({ designs });
      saveCurrentId(d.id);
      loadInto(d);
    },
    duplicateDesign() {
      const st = get();
      const now = new Date().toISOString();
      const d: Design = { ...JSON.parse(JSON.stringify({ ...st.designs.find((x) => x.id === st.currentId)!, scene: st.scene })), id: newId("design"), name: `${st.name} copy`, createdAt: now, updatedAt: now };
      const designs = [...st.designs, d];
      saveDesigns(designs);
      set({ designs });
      saveCurrentId(d.id);
      loadInto(d);
    },
    renameDesign(name) {
      const st = get();
      const designs = st.designs.map((d) => (d.id === st.currentId ? { ...d, name } : d));
      set({ name, designs });
      saveDesigns(designs);
    },
    deleteDesign(id) {
      const st = get();
      let designs = st.designs.filter((d) => d.id !== id);
      if (!designs.length) designs = [newDesign("My home gym")];
      saveDesigns(designs);
      set({ designs });
      if (id === st.currentId) { loadInto(designs[0]); saveCurrentId(designs[0].id); }
      persistDraft();
    },
    switchDesign(id) {
      const st = get();
      if (id === st.currentId) return;
      const d = st.designs.find((x) => x.id === id);
      if (!d) return;
      // keep unsaved edits of the design we are leaving as its draft
      saveCurrentId(id);
      loadInto(d);
      persistDraft();
    },
    exportCurrent() {
      const st = get();
      const d = st.designs.find((x) => x.id === st.currentId)!;
      return serializeDesign({ ...d, name: st.name, scene: st.scene });
    },
    exportAll() {
      const st = get();
      return serializeAll(st.designs.map((d) => (d.id === st.currentId ? { ...d, name: st.name, scene: st.scene } : d)));
    },
    importText(text) {
      try {
        const { designs: imported, warnings } = importJson(text);
        const st = get();
        const existing = new Set(st.designs.map((d) => d.id));
        const fresh = imported.map((d) => (existing.has(d.id) ? { ...d, id: newId("design"), name: `${d.name} (imported)` } : d));
        const designs = [...st.designs, ...fresh];
        saveDesigns(designs);
        set({ designs, notices: [...st.notices, ...warnings] });
        saveCurrentId(fresh[0].id);
        loadInto(fresh[0]);
        return { ok: true, message: `Imported ${fresh.length} design${fresh.length > 1 ? "s" : ""}.${warnings.length ? ` ${warnings.length} warning(s).` : ""}` };
      } catch (e) {
        return { ok: false, message: (e as Error).message };
      }
    },
    dismissNotice(i) { set((st) => ({ notices: st.notices.filter((_, j) => j !== i) })); },
    addNotice(m) { set((st) => ({ notices: [...st.notices, m] })); },
    setFocusIssue(id) { set({ focusIssue: id }); },
  };
});

import { getDef } from "../equipment/registry";
function wallMountedType(inst: EquipmentInstance) {
  return !!getDef(inst.type)?.wallMounted;
}

export const isDirty = (s: Pick<State, "scene" | "savedScene">) => s.scene !== s.savedScene;
export const selectedInstances = (s: Pick<State, "scene" | "selection">) => s.scene.equipment.filter((e) => s.selection.includes(e.id));

// Dev-only handle for debugging and browser-driven checks.
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  (window as unknown as { __store: typeof useStore }).__store = useStore;
}
