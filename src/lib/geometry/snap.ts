import type { EquipmentInstance, Scene } from "../scene/types";
import { footprintObb } from "./world";
import { obbAabb, snapValue, type AABB } from "./rect";

export interface SnapOptions {
  grid: number;
  snapGrid: boolean;
  snapWalls: boolean;
  snapObjects: boolean;
  /** snap threshold (mm) */
  threshold: number;
}
export interface Guide { axis: "x" | "y"; value: number }
export interface SnapResult { dx: number; dy: number; guides: Guide[] }

/**
 * Given a proposed translation of a group's bounding box, return an adjusted translation that snaps its
 * edges to walls / other objects (guides) and otherwise its min corner to the grid.
 */
export function snapMove(scene: Scene, moving: EquipmentInstance[], dxIn: number, dyIn: number, o: SnapOptions): SnapResult {
  const boxes = moving.map((m) => obbAabb(footprintObb(m, scene)));
  const bb: AABB = {
    minX: Math.min(...boxes.map((b) => b.minX)) + dxIn,
    maxX: Math.max(...boxes.map((b) => b.maxX)) + dxIn,
    minY: Math.min(...boxes.map((b) => b.minY)) + dyIn,
    maxY: Math.max(...boxes.map((b) => b.maxY)) + dyIn,
  };
  let dx = dxIn, dy = dyIn;
  const guides: Guide[] = [];
  const movingIds = new Set(moving.map((m) => m.id));

  const candX: number[] = [];
  const candY: number[] = [];
  if (o.snapWalls) { candX.push(0, scene.room.length); candY.push(0, scene.room.width); }
  if (o.snapObjects) {
    for (const e of scene.equipment) {
      if (movingIds.has(e.id) || e.hidden || e.parentId) continue;
      const b = obbAabb(footprintObb(e, scene));
      candX.push(b.minX, b.maxX);
      candY.push(b.minY, b.maxY);
    }
  }

  const pick = (edges: number[], cands: number[]) => {
    let best: { d: number; v: number } | null = null;
    for (const e of edges) for (const c of cands) {
      const d = c - e;
      if (Math.abs(d) <= o.threshold && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, v: c };
    }
    return best;
  };
  const sx = pick([bb.minX, bb.maxX], candX);
  const sy = pick([bb.minY, bb.maxY], candY);
  if (sx) { dx += sx.d; guides.push({ axis: "x", value: sx.v }); }
  else if (o.snapGrid) dx += snapValue(bb.minX, o.grid) - bb.minX;
  if (sy) { dy += sy.d; guides.push({ axis: "y", value: sy.v }); }
  else if (o.snapGrid) dy += snapValue(bb.minY, o.grid) - bb.minY;
  return { dx, dy, guides };
}

export function snapAngle(deg: number, step = 15): number {
  const r = Math.round(deg / step) * step;
  return ((r % 360) + 360) % 360;
}
