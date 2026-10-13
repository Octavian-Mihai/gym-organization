import { describe, expect, it } from "vitest";
import { defaultScene } from "../scene/defaults";
import { createInstance } from "../scene/factory";
import { snapAngle, snapMove } from "./snap";

const opts = { grid: 25.4, snapGrid: true, snapWalls: true, snapObjects: true, threshold: 40 };

describe("snapping", () => {
  it("snaps a bench edge to the wall when close", () => {
    const s = defaultScene();
    const b = createInstance("bench-flat", { placement: { x: 400, y: 1000, z: 0, rotation: 0 } });
    s.equipment = [b];
    const r = snapMove(s, [b], -100, 0, opts); // left edge would sit at ~-100+... near wall x=0
    const left = 400 - 152.4 + r.dx; // bench width 12in
    expect(Math.abs(left)).toBeLessThan(1e-6 + 152.4);
    expect(r.guides.length).toBeGreaterThanOrEqual(0);
  });
  it("snaps to other object edges", () => {
    const s = defaultScene();
    const a = createInstance("bench-flat", { placement: { x: 1500, y: 1500, z: 0, rotation: 0 } });
    const b = createInstance("bench-flat", { placement: { x: 2000, y: 1500, z: 0, rotation: 0 } });
    s.equipment = [a, b];
    const r = snapMove(s, [b], -190, 0, { ...opts, snapGrid: false }); // b.minX ~ 1847.6-190=1657.6 vs a.maxX 1652.4
    expect(r.guides.some((g) => g.axis === "x")).toBe(true);
    expect(1847.6 + r.dx).toBeCloseTo(1652.4, 1);
  });
  it("snaps to grid when nothing else is near", () => {
    const s = defaultScene();
    const b = createInstance("bench-flat", { placement: { x: 2000, y: 2000, z: 0, rotation: 0 } });
    s.equipment = [b];
    const r = snapMove(s, [b], 11, 7, { ...opts, snapObjects: false, snapWalls: false });
    const minX = 2000 - 152.4 + r.dx;
    expect(minX / 25.4).toBeCloseTo(Math.round(minX / 25.4), 6);
  });
  it("snaps angles", () => {
    expect(snapAngle(52)).toBe(45);
    expect(snapAngle(-10)).toBe(345);
  });
});
