import { getDef } from "../equipment/registry";
import { modelBounds, primitiveExtent } from "../equipment/model";
import type { Model } from "../equipment/types";
import type { EquipmentInstance, Placement, Scene } from "../scene/types";
import { expandObb, obbAabb, rotatePoint, type AABB, type OBB } from "./rect";

const modelCache = new WeakMap<object, Model>();

/** Model for an instance. Memoized by config object identity (configs are immutable in the store). */
export function modelOf(inst: EquipmentInstance): Model {
  const cached = modelCache.get(inst.config);
  if (cached) return cached;
  const def = getDef(inst.type);
  const m: Model = def ? def.build(inst.config) : { primitives: [], holes: [] };
  modelCache.set(inst.config, m);
  return m;
}

/** Resolve a placement into world (room) coordinates, composing parent relationships. */
export function worldPlacement(inst: EquipmentInstance, scene: Pick<Scene, "equipment">, depth = 0): Placement {
  if (!inst.parentId || depth > 4) return inst.placement;
  const parent = scene.equipment.find((e) => e.id === inst.parentId);
  if (!parent) return inst.placement;
  const pp = worldPlacement(parent, scene, depth + 1);
  const off = rotatePoint({ x: inst.placement.x, y: inst.placement.y }, pp.rotation);
  return { x: pp.x + off.x, y: pp.y + off.y, z: pp.z + inst.placement.z, rotation: pp.rotation + inst.placement.rotation, wall: inst.placement.wall };
}

export interface Dims {
  width: number;
  depth: number;
  height: number;
}
export const dimsOf = (inst: EquipmentInstance): Dims => modelBounds(modelOf(inst));

/** Physical footprint (outer bounds in plan), at the instance's world placement. */
export function footprintObb(inst: EquipmentInstance, scene: Pick<Scene, "equipment">): OBB {
  const p = worldPlacement(inst, scene);
  const d = dimsOf(inst);
  return { cx: p.x, cy: p.y, w: d.width, d: d.depth, rotation: p.rotation };
}

export function clearanceObb(inst: EquipmentInstance, scene: Pick<Scene, "equipment">): OBB | null {
  if (!inst.clearance.enabled) return null;
  const { front, back, left, right } = inst.clearance;
  return expandObb(footprintObb(inst, scene), { front, back, left, right });
}

export interface Solid {
  instId: string;
  primId: string;
  obb: OBB;
  zMin: number;
  zMax: number;
  aabb: AABB;
}

/** Collision solids: every solid primitive as an oriented rectangle with a z-range, in room coordinates. */
export function solidsOf(inst: EquipmentInstance, scene: Pick<Scene, "equipment">): Solid[] {
  const p = worldPlacement(inst, scene);
  const m = modelOf(inst);
  const out: Solid[] = [];
  for (const prim of m.primitives) {
    if (prim.solid === false) continue;
    const e = primitiveExtent(prim);
    const c = rotatePoint({ x: prim.center[0], y: prim.center[1] }, p.rotation);
    const obb: OBB = { cx: p.x + c.x, cy: p.y + c.y, w: e[0], d: e[1], rotation: p.rotation };
    out.push({ instId: inst.id, primId: prim.id, obb, zMin: p.z + prim.center[2] - e[2] / 2, zMax: p.z + prim.center[2] + e[2] / 2, aabb: obbAabb(obb) });
  }
  return out;
}

export function topOf(inst: EquipmentInstance, scene: Pick<Scene, "equipment">): number {
  return worldPlacement(inst, scene).z + dimsOf(inst).height;
}

/** Instance ids related by mounting (ancestors/descendants). */
export function isRelated(a: EquipmentInstance, b: EquipmentInstance, scene: Pick<Scene, "equipment">): boolean {
  const chain = (x: EquipmentInstance) => {
    const ids = new Set<string>([x.id]);
    let cur: EquipmentInstance | undefined = x;
    for (let i = 0; cur?.parentId && i < 5; i++) {
      ids.add(cur.parentId);
      cur = scene.equipment.find((e) => e.id === cur!.parentId);
    }
    return ids;
  };
  return chain(a).has(b.id) || chain(b).has(a.id);
}
