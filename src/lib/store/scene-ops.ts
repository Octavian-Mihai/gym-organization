import { dimsOf, footprintObb, worldPlacement } from "../geometry/world";
import { snapValue } from "../geometry/rect";
import { createInstance } from "../scene/factory";
import { newId } from "../scene/ids";
import type { EquipmentInstance, Placement, Room, Scene, WallId } from "../scene/types";
import { getDef } from "../equipment/registry";

/** Pure scene transforms. Each returns a new Scene; the store handles history. */
export const updateInstance = (s: Scene, id: string, patch: Partial<EquipmentInstance>): Scene => ({
  ...s,
  equipment: s.equipment.map((e) => (e.id === id ? { ...e, ...patch } : e)),
});

export const updatePlacement = (s: Scene, id: string, patch: Partial<Placement>): Scene => ({
  ...s,
  equipment: s.equipment.map((e) => (e.id === id ? { ...e, placement: { ...e.placement, ...patch } } : e)),
});

/** Replace config; clearance defaults are left alone so user edits survive. */
export const updateConfig = (s: Scene, id: string, patch: Record<string, unknown>): Scene => ({
  ...s,
  equipment: s.equipment.map((e) => {
    if (e.id !== id) return e;
    const def = getDef(e.type);
    const merged = { ...e.config, ...patch };
    return { ...e, config: def ? def.sanitize(merged) : merged };
  }),
});

export const updateRoom = (s: Scene, patch: Partial<Room>): Scene => ({ ...s, room: { ...s.room, ...patch } });

/** Remove instances and detach/remove children mounted on them. */
export function removeInstances(s: Scene, ids: string[]): Scene {
  const gone = new Set(ids);
  let changed = true;
  while (changed) {
    changed = false;
    for (const e of s.equipment) if (e.parentId && gone.has(e.parentId) && !gone.has(e.id)) { gone.add(e.id); changed = true; }
  }
  return { ...s, equipment: s.equipment.filter((e) => !gone.has(e.id)) };
}

export function duplicateInstances(s: Scene, ids: string[], offset = 300): { scene: Scene; newIds: string[] } {
  const idMap = new Map<string, string>();
  const source = s.equipment.filter((e) => ids.includes(e.id));
  const clones = source.map((e) => {
    const nid = newId("eq");
    idMap.set(e.id, nid);
    return { ...e, id: nid, name: `${e.name} copy`, locked: false, config: JSON.parse(JSON.stringify(e.config)), clearance: { ...e.clearance } };
  });
  for (const c of clones) {
    if (c.parentId && idMap.has(c.parentId)) c.parentId = idMap.get(c.parentId);
    else if (!c.parentId) c.placement = { ...c.placement, x: c.placement.x + offset, y: c.placement.y + offset };
  }
  return { scene: { ...s, equipment: [...s.equipment, ...clones] }, newIds: clones.map((c) => c.id) };
}

/** Inside-face position for a wall-mounted object with its back against `wall`. */
export function wallMount(s: Scene, inst: EquipmentInstance, wall: WallId, along?: number): Partial<Placement> {
  const d = dimsOf(inst);
  const { length: L, width: W } = s.room;
  const a = along ?? (wall === "north" || wall === "south" ? L : W) / 2;
  switch (wall) {
    case "north": return { wall, x: a, y: d.depth / 2, rotation: 0 };
    case "south": return { wall, x: a, y: W - d.depth / 2, rotation: 180 };
    case "west": return { wall, x: d.depth / 2, y: a, rotation: 270 };
    case "east": return { wall, x: L - d.depth / 2, y: a, rotation: 90 };
  }
}

export function centerInRoom(s: Scene, id: string, axis: "x" | "y" | "both"): Scene {
  const e = s.equipment.find((q) => q.id === id);
  if (!e) return s;
  const patch: Partial<Placement> = {};
  if (axis !== "y") patch.x = s.room.length / 2;
  if (axis !== "x") patch.y = s.room.width / 2;
  return updatePlacement(s, id, patch);
}

/** Align the object's footprint flush against a wall (accounts for rotation). */
export function alignToWall(s: Scene, id: string, wall: WallId): Scene {
  const e = s.equipment.find((q) => q.id === id);
  if (!e) return s;
  const fp = footprintObb(e, s);
  const rot = (fp.rotation * Math.PI) / 180;
  const hw = Math.abs(Math.cos(rot)) * fp.w / 2 + Math.abs(Math.sin(rot)) * fp.d / 2;
  const hh = Math.abs(Math.sin(rot)) * fp.w / 2 + Math.abs(Math.cos(rot)) * fp.d / 2;
  switch (wall) {
    case "west": return updatePlacement(s, id, { x: hw });
    case "east": return updatePlacement(s, id, { x: s.room.length - hw });
    case "north": return updatePlacement(s, id, { y: hh });
    case "south": return updatePlacement(s, id, { y: s.room.width - hh });
  }
}

export interface MatGridOptions { rows: number; cols: number; preset?: object; originX: number; originY: number; rotation?: number }

/** Create a rows x cols grid of mats, edge to edge, starting at the top-left of (originX, originY). */
export function addMatGrid(s: Scene, o: MatGridOptions): { scene: Scene; newIds: string[] } {
  const proto = createInstance("stall-mat", {}, o.preset ?? {});
  const cfg = proto.config as { length: number; width: number };
  const created: EquipmentInstance[] = [];
  const rot = o.rotation ?? 0;
  const [mw, md] = rot % 180 === 0 ? [cfg.length, cfg.width] : [cfg.width, cfg.length];
  for (let r = 0; r < o.rows; r++) for (let c = 0; c < o.cols; c++) {
    created.push(createInstance("stall-mat", { name: `Mat ${r * o.cols + c + 1}`, placement: { x: o.originX + mw / 2 + c * mw, y: o.originY + md / 2 + r * md, z: 0, rotation: rot } }, o.preset ?? {}));
  }
  return { scene: { ...s, equipment: [...s.equipment, ...created] }, newIds: created.map((e) => e.id) };
}

export function groupInstances(s: Scene, ids: string[]): Scene {
  const gid = newId("grp");
  return { ...s, equipment: s.equipment.map((e) => (ids.includes(e.id) ? { ...e, groupId: gid } : e)) };
}
export function ungroupInstances(s: Scene, ids: string[]): Scene {
  return { ...s, equipment: s.equipment.map((e) => (ids.includes(e.id) ? { ...e, groupId: undefined } : e)) };
}

/** Expand a selection to include everything sharing a group. */
export function expandGroups(s: Scene, ids: string[]): string[] {
  const groups = new Set(s.equipment.filter((e) => ids.includes(e.id) && e.groupId).map((e) => e.groupId));
  return [...new Set([...ids, ...s.equipment.filter((e) => e.groupId && groups.has(e.groupId)).map((e) => e.id)])];
}

/** Mount `child` into `parent`: stores a placement relative to the parent. Barbells snap into the rack's first J-cup. */
export function mountTo(s: Scene, childId: string, parentId: string | null, z?: number): Scene {
  const child = s.equipment.find((e) => e.id === childId);
  if (!child) return s;
  if (parentId === null) return updateInstance(s, childId, { parentId: undefined, placement: { ...worldPlacement(child, s), z: 0 } });
  const parent = s.equipment.find((e) => e.id === parentId);
  if (!parent || parentId === childId) return s;
  const pd = dimsOf(parent);
  if (child.type === "barbell" && parent.type === "power-rack") {
    const cfg = child.config as { plates?: { diameter: number; count: number }[]; sleeveDiameter: number };
    const axisH = Math.max(cfg.sleeveDiameter, ...(cfg.plates ?? []).filter((p) => p.count > 0).map((p) => p.diameter)) / 2;
    const cupZ = z ?? (parent.config as { jcups?: { z: number }[] }).jcups?.[0]?.z ?? pd.height * 0.55;
    return updateInstance(s, childId, { parentId, placement: { x: 0, y: pd.depth / 2 - 30, z: cupZ + 44 - axisH, rotation: 0 } });
  }
  return updateInstance(s, childId, { parentId, placement: { x: 0, y: 0, z: z ?? 0, rotation: 0 } });
}
export { snapValue };

/** Config patch resulting from growing the object's footprint by dW (local x) and dD (local y) mm. */
export function resizePatch(inst: EquipmentInstance, dW: number, dD: number): Record<string, number> | null {
  const c = inst.config as Record<string, number>;
  switch (inst.type) {
    case "power-rack": return { width: c.width + dW, depth: c.depth + dD };
    case "uprights": return dW ? { crossmemberLength: c.crossmemberLength + dW } : null;
    case "stall-mat": return { length: c.length + dW, width: c.width + dD };
    case "barbell": return dW ? { shaftLength: c.shaftLength + dW } : null;
    case "pegboard": return dW ? { width: c.width + dW } : null;
    default: return "width" in c && "depth" in c ? { width: c.width + dW, depth: c.depth + dD } : null;
  }
}
