import type { EquipmentInstance, Opening, Scene, WallId } from "../scene/types";
import { getDef } from "../equipment/registry";
import { clearanceObb, dimsOf, footprintObb, isRelated, solidsOf, topOf, worldPlacement } from "./world";
import { obbOverlapDepth, overhangOutsideRect, unionAabb, type OBB } from "./rect";

export type IssueKind = "physical" | "mounted-ok" | "clearance" | "outside" | "opening" | "ceiling" | "wall-mount" | "obstacle";
export interface Issue {
  id: string;
  kind: IssueKind;
  severity: "error" | "warning" | "info";
  message: string;
  objectIds: string[];
  /** where to draw a marker (room coords) */
  at?: { x: number; y: number };
}

const isPassive = (i: EquipmentInstance) => !!getDef(i.type)?.passive;
const isWallMounted = (i: EquipmentInstance) => !!getDef(i.type)?.wallMounted;

export function openingRect(room: Scene["room"], o: Opening): OBB & { wall: WallId } {
  const { length: L, width: W } = room;
  const depth = o.kind === "door" ? o.width : 60;
  switch (o.wall) {
    case "north": return { wall: o.wall, cx: o.offset + o.width / 2, cy: depth / 2, w: o.width, d: depth, rotation: 0 };
    case "south": return { wall: o.wall, cx: o.offset + o.width / 2, cy: W - depth / 2, w: o.width, d: depth, rotation: 0 };
    case "west": return { wall: o.wall, cx: depth / 2, cy: o.offset + o.width / 2, w: depth, d: o.width, rotation: 0 };
    case "east": return { wall: o.wall, cx: L - depth / 2, cy: o.offset + o.width / 2, w: depth, d: o.width, rotation: 0 };
  }
}

export function wallLength(room: Scene["room"], wall: WallId) {
  return wall === "north" || wall === "south" ? room.length : room.width;
}

/** Compute every spatial issue for a scene. Pure; O(n^2) over instances with AABB pruning. */
export function validateScene(scene: Scene): Issue[] {
  const issues: Issue[] = [];
  const { room } = scene;
  const items = scene.equipment.filter((e) => !e.hidden);
  const solids = new Map(items.map((e) => [e.id, solidsOf(e, scene)]));
  const bounds = new Map(items.map((e) => { const s = solids.get(e.id)!; return [e.id, s.length ? unionAabb(s.map((x) => x.aabb)) : null] as const; }));
  const name = (e: EquipmentInstance) => e.name || e.type;
  let n = 0;
  const add = (i: Omit<Issue, "id">) => issues.push({ ...i, id: `iss${n++}` });

  for (const e of items) {
    const fp = footprintObb(e, scene);
    const wp = worldPlacement(e, scene);
    const dims = dimsOf(e);

    if (isWallMounted(e) && e.placement.wall && !e.parentId) {
      const wl = wallLength(room, e.placement.wall);
      const along = e.placement.wall === "north" || e.placement.wall === "south" ? wp.x : wp.y;
      if (along - dims.width / 2 < -0.5 || along + dims.width / 2 > wl + 0.5) {
        add({ kind: "wall-mount", severity: "error", message: `${name(e)} extends beyond the ${e.placement.wall} wall.`, objectIds: [e.id], at: { x: wp.x, y: wp.y } });
      }
    } else if (!isPassive(e) || true) {
      const over = overhangOutsideRect(fp, room.length, room.width);
      if (over > 1) add({ kind: "outside", severity: "error", message: `${name(e)} extends ${Math.round(over)} mm outside the room.`, objectIds: [e.id], at: { x: wp.x, y: wp.y } });
    }

    if (topOf(e, scene) > room.ceilingHeight + 0.5) {
      add({ kind: "ceiling", severity: "error", message: `${name(e)} (${Math.round(topOf(e, scene))} mm) exceeds the ceiling height.`, objectIds: [e.id], at: { x: wp.x, y: wp.y } });
    }

    // Openings
    if (!isPassive(e)) {
      for (const o of room.openings) {
        const r = openingRect(room, o);
        const top = o.kind === "door" ? o.height : o.sillHeight + o.height;
        const bottom = o.kind === "door" ? 0 : o.sillHeight;
        const hit = (solids.get(e.id) ?? []).some((s) => s.zMin < top && s.zMax > bottom && obbOverlapDepth(s.obb, r) > 0);
        if (hit) add({ kind: "opening", severity: o.kind === "door" ? "error" : "warning", message: o.kind === "door" ? `${name(e)} blocks a door on the ${o.wall} wall.` : `${name(e)} covers a window on the ${o.wall} wall.`, objectIds: [e.id], at: { x: r.cx, y: r.cy } });
      }
    }
    for (const ob of room.obstacles) {
      const along = ob.offset + ob.width / 2;
      const r: OBB = ob.wall === "north" ? { cx: along, cy: ob.depth / 2, w: ob.width, d: ob.depth, rotation: 0 }
        : ob.wall === "south" ? { cx: along, cy: room.width - ob.depth / 2, w: ob.width, d: ob.depth, rotation: 0 }
        : ob.wall === "west" ? { cx: ob.depth / 2, cy: along, w: ob.depth, d: ob.width, rotation: 0 }
        : { cx: room.length - ob.depth / 2, cy: along, w: ob.depth, d: ob.width, rotation: 0 };
      if (!isPassive(e) && (solids.get(e.id) ?? []).some((s) => s.zMin < ob.elevation + ob.height && s.zMax > ob.elevation && obbOverlapDepth(s.obb, r) > 0)) {
        add({ kind: "obstacle", severity: "error", message: `${name(e)} intersects ${ob.name}.`, objectIds: [e.id], at: { x: r.cx, y: r.cy } });
      }
    }
  }

  // Pairwise checks
  const reported = new Set<string>();
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i], b = items[j];
      if (isPassive(a) || isPassive(b)) continue;
      if (isRelated(a, b, scene)) continue;
      const ba = bounds.get(a.id), bb = bounds.get(b.id);
      if (!ba || !bb || ba.maxX < bb.minX || bb.maxX < ba.minX || ba.maxY < bb.minY || bb.maxY < ba.minY) continue;
      const sa = solids.get(a.id)!, sb = solids.get(b.id)!;
      let hit: { x: number; y: number } | null = null;
      outer: for (const x of sa) for (const y of sb) {
        if (x.zMax <= y.zMin || y.zMax <= x.zMin) continue;
        if (x.aabb.maxX < y.aabb.minX || y.aabb.maxX < x.aabb.minX || x.aabb.maxY < y.aabb.minY || y.aabb.maxY < x.aabb.minY) continue;
        if (obbOverlapDepth(x.obb, y.obb) > 0) { hit = { x: (x.obb.cx + y.obb.cx) / 2, y: (x.obb.cy + y.obb.cy) / 2 }; break outer; }
      }
      if (hit) {
        reported.add(`${a.id}|${b.id}`);
        add({ kind: "physical", severity: "error", message: `${name(a)} physically intersects ${name(b)}.`, objectIds: [a.id, b.id], at: hit });
      }
    }
  }

  // Clearance conflicts
  for (const a of items) {
    const c = clearanceObb(a, scene);
    if (!c) continue;
    for (const b of items) {
      if (a.id === b.id || isPassive(b) || isRelated(a, b, scene)) continue;
      const key = a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`;
      if (reported.has(key)) continue;
      const hit = (solids.get(b.id) ?? []).find((s) => obbOverlapDepth(c, s.obb) > 0);
      if (hit) {
        reported.add(key);
        add({ kind: "clearance", severity: "warning", message: `${name(b)} is inside the ${a.clearance.label ?? "clearance zone"} of ${name(a)}.`, objectIds: [a.id, b.id], at: { x: hit.obb.cx, y: hit.obb.cy } });
      }
    }
  }
  return issues;
}

export function issuesFor(issues: Issue[], id: string) {
  return issues.filter((i) => i.objectIds.includes(id));
}

const issueCache = new WeakMap<object, Issue[]>();
/** Memoized by scene identity so the 2D view, 3D view and panels share one computation per edit. */
export function validateSceneCached(scene: Scene): Issue[] {
  let r = issueCache.get(scene);
  if (!r) { r = validateScene(scene); issueCache.set(scene, r); }
  return r;
}
