/** 2D geometry helpers. Pure functions, no rendering dependencies. Units: mm / degrees. */
export interface Vec2 {
  x: number;
  y: number;
}
/** Oriented rectangle: center, full size (w along local x, d along local y), rotation in degrees. */
export interface OBB {
  cx: number;
  cy: number;
  w: number;
  d: number;
  rotation: number;
}
export interface AABB {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export const rad = (deg: number) => (deg * Math.PI) / 180;

export function rotatePoint(p: Vec2, deg: number): Vec2 {
  const r = rad(deg);
  const c = Math.cos(r);
  const s = Math.sin(r);
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c };
}

/** Local-space corner order: (-w/2,-d/2) (w/2,-d/2) (w/2,d/2) (-w/2,d/2) then rotated and translated. */
export function obbCorners(b: OBB): Vec2[] {
  const hw = b.w / 2;
  const hd = b.d / 2;
  return [
    { x: -hw, y: -hd },
    { x: hw, y: -hd },
    { x: hw, y: hd },
    { x: -hw, y: hd },
  ].map((p) => {
    const r = rotatePoint(p, b.rotation);
    return { x: r.x + b.cx, y: r.y + b.cy };
  });
}

export function aabbOf(points: Vec2[]): AABB {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

export const obbAabb = (b: OBB): AABB => aabbOf(obbCorners(b));

export function unionAabb(list: AABB[]): AABB {
  return {
    minX: Math.min(...list.map((a) => a.minX)),
    minY: Math.min(...list.map((a) => a.minY)),
    maxX: Math.max(...list.map((a) => a.maxX)),
    maxY: Math.max(...list.map((a) => a.maxY)),
  };
}

function project(corners: Vec2[], axis: Vec2): [number, number] {
  let min = Infinity,
    max = -Infinity;
  for (const c of corners) {
    const v = c.x * axis.x + c.y * axis.y;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return [min, max];
}

/**
 * Separating-axis test. Returns the penetration depth (mm) along the minimum-translation axis,
 * or 0 if separated / merely touching (within `epsilon`).
 */
export function obbOverlapDepth(a: OBB, b: OBB, epsilon = 0.5): number {
  const ca = obbCorners(a);
  const cb = obbCorners(b);
  const axes: Vec2[] = [];
  for (const cs of [ca, cb]) {
    for (let i = 0; i < 2; i++) {
      const e = { x: cs[i + 1].x - cs[i].x, y: cs[i + 1].y - cs[i].y };
      const len = Math.hypot(e.x, e.y) || 1;
      axes.push({ x: -e.y / len, y: e.x / len });
    }
  }
  let minDepth = Infinity;
  for (const ax of axes) {
    const [a0, a1] = project(ca, ax);
    const [b0, b1] = project(cb, ax);
    const depth = Math.min(a1, b1) - Math.max(a0, b0);
    if (depth <= epsilon) return 0;
    if (depth < minDepth) minDepth = depth;
  }
  return minDepth;
}

export const obbOverlaps = (a: OBB, b: OBB, epsilon = 0.5) => obbOverlapDepth(a, b, epsilon) > 0;

/** Grow an OBB by per-side margins in its local frame (front = +y local, back = -y, left = -x, right = +x). */
export function expandObb(b: OBB, m: { front: number; back: number; left: number; right: number }): OBB {
  const w = b.w + m.left + m.right;
  const d = b.d + m.front + m.back;
  const off = rotatePoint({ x: (m.right - m.left) / 2, y: (m.front - m.back) / 2 }, b.rotation);
  return { cx: b.cx + off.x, cy: b.cy + off.y, w, d, rotation: b.rotation };
}

/** How far (mm) corners of `inner` extend outside the axis-aligned rectangle [0,L]x[0,W]. 0 if fully inside. */
export function overhangOutsideRect(inner: OBB, L: number, W: number): number {
  const bb = obbAabb(inner);
  return Math.max(0, -bb.minX, -bb.minY, bb.maxX - L, bb.maxY - W);
}

export function snapValue(v: number, grid: number): number {
  return grid > 0 ? Math.round(v / grid) * grid : v;
}
