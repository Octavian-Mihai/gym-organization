import type { HoleSet, Model, Primitive } from "./types";

/** Re-center a model so the XY bounding box center is (0,0) and the lowest z is 0 (unless keepZ). */
export function normalizeModel(m: Model, opts: { keepZ?: boolean; flipY?: boolean } = {}): Model {
  if (m.primitives.length === 0) return m;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity;
  for (const p of m.primitives) {
    const e = primitiveExtent(p);
    minX = Math.min(minX, p.center[0] - e[0] / 2);
    maxX = Math.max(maxX, p.center[0] + e[0] / 2);
    minY = Math.min(minY, p.center[1] - e[1] / 2);
    maxY = Math.max(maxY, p.center[1] + e[1] / 2);
    minZ = Math.min(minZ, p.center[2] - e[2] / 2);
  }
  const dx = -(minX + maxX) / 2;
  const dy = -(minY + maxY) / 2;
  const dz = opts.keepZ ? 0 : -minZ;
  const fy = opts.flipY ? -1 : 1;
  return {
    primitives: m.primitives.map((p) => ({ ...p, center: [p.center[0] + dx, fy * (p.center[1] + dy), p.center[2] + dz] })),
    holes: m.holes.map((h) => ({
      ...h,
      center: [h.center[0] + dx, fy * (h.center[1] + dy)],
      zs: h.zs.map((z) => z + dz),
      xs: h.xs?.map((x) => x + dx),
    })),
  };
}

/** Axis-aligned full extents (x,y,z) of a primitive in object space. */
export function primitiveExtent(p: Primitive): [number, number, number] {
  if (p.shape === "box") return p.size;
  const [d, , len] = p.size;
  if (p.axis === "x") return [len, d, d];
  if (p.axis === "y") return [d, len, d];
  return [d, d, len];
}

export interface ModelBounds {
  width: number; // x extent
  depth: number; // y extent
  height: number; // z extent from lowest to highest
  minZ: number;
  maxZ: number;
}

export function modelBounds(m: Model): ModelBounds {
  if (m.primitives.length === 0) return { width: 0, depth: 0, height: 0, minZ: 0, maxZ: 0 };
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of m.primitives) {
    if (p.solid === false) continue;
    const e = primitiveExtent(p);
    minX = Math.min(minX, p.center[0] - e[0] / 2);
    maxX = Math.max(maxX, p.center[0] + e[0] / 2);
    minY = Math.min(minY, p.center[1] - e[1] / 2);
    maxY = Math.max(maxY, p.center[1] + e[1] / 2);
    minZ = Math.min(minZ, p.center[2] - e[2] / 2);
    maxZ = Math.max(maxZ, p.center[2] + e[2] / 2);
  }
  return { width: maxX - minX, depth: maxY - minY, height: maxZ - minZ, minZ, maxZ };
}

export const box = (
  id: string,
  role: string,
  cx: number,
  cy: number,
  cz: number,
  sx: number,
  sy: number,
  sz: number,
  extra: Partial<Primitive> = {},
): Primitive => ({ id, role, shape: "box", center: [cx, cy, cz], size: [sx, sy, sz], ...extra });

export const cyl = (
  id: string,
  role: string,
  axis: "x" | "y" | "z",
  cx: number,
  cy: number,
  cz: number,
  diameter: number,
  length: number,
  extra: Partial<Primitive> = {},
): Primitive => ({ id, role, shape: "cylinder", axis, center: [cx, cy, cz], size: [diameter, diameter, length], ...extra });

export const emptyModel = (): Model => ({ primitives: [], holes: [] as HoleSet[] });
