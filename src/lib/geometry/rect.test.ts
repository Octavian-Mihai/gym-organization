import { describe, expect, it } from "vitest";
import { expandObb, obbAabb, obbOverlapDepth, obbOverlaps, overhangOutsideRect } from "./rect";

describe("rect geometry", () => {
  it("rotated footprint AABB (90deg swaps extents)", () => {
    const bb = obbAabb({ cx: 1000, cy: 1000, w: 2000, d: 1000, rotation: 90 });
    expect(bb.maxX - bb.minX).toBeCloseTo(1000, 6);
    expect(bb.maxY - bb.minY).toBeCloseTo(2000, 6);
  });
  it("45deg square bounding box grows by sqrt2", () => {
    const bb = obbAabb({ cx: 0, cy: 0, w: 1000, d: 1000, rotation: 45 });
    expect(bb.maxX - bb.minX).toBeCloseTo(1000 * Math.SQRT2, 6);
  });
  it("detects overlap and ignores touching", () => {
    const a = { cx: 0, cy: 0, w: 1000, d: 1000, rotation: 0 };
    expect(obbOverlaps(a, { ...a, cx: 500 })).toBe(true);
    expect(obbOverlapDepth(a, { ...a, cx: 500 })).toBeCloseTo(500, 6);
    expect(obbOverlaps(a, { ...a, cx: 1000 })).toBe(false);
  });
  it("rotated rects that AABBs-overlap but do not intersect", () => {
    const bar = { cx: 0, cy: 0, w: 3000, d: 100, rotation: 45 };
    const box = { cx: 1000, cy: -1000, w: 300, d: 300, rotation: 0 };
    expect(obbOverlaps(bar, box)).toBe(false);
  });
  it("overhang beyond the room", () => {
    expect(overhangOutsideRect({ cx: 500, cy: 500, w: 1000, d: 1000, rotation: 0 }, 4000, 3000)).toBe(0);
    expect(overhangOutsideRect({ cx: 4200, cy: 500, w: 1000, d: 1000, rotation: 0 }, 4000, 3000)).toBe(700);
  });
  it("expands by clearance", () => {
    const e = expandObb({ cx: 0, cy: 0, w: 1000, d: 1000, rotation: 0 }, { front: 200, back: 0, left: 0, right: 300 });
    expect(e.w).toBe(1300);
    expect(e.d).toBe(1200);
    expect(e.cx).toBe(150);
    expect(e.cy).toBe(100);
  });
});
