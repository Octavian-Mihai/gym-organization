import { describe, expect, it } from "vitest";
import { fromInches } from "../units";
import { modelBounds } from "./model";
import type { Model } from "./types";

/** Bounds of the structural frame only (uprights), excluding J-cups/pegs that protrude. */
const frame = (m: Model) => modelBounds({ ...m, primitives: m.primitives.filter((p) => p.role === "upright") });
import { buildRack, defaultRack, holePositions, validateRack } from "./rack";

const uprights = (c = defaultRack()) => buildRack(c).primitives.filter((p) => p.role === "upright");

describe("power rack", () => {
  it("has four uprights by default, six when switched", () => {
    expect(uprights()).toHaveLength(4);
    expect(uprights({ ...defaultRack(), postCount: 6 })).toHaveLength(6);
  });
  it("footprint follows width/depth", () => {
    const m = buildRack(defaultRack());
    expect(frame(m).width).toBeCloseTo(fromInches(49), 3);
    expect(frame(m).depth).toBeCloseTo(fromInches(49), 3);
    // J-cups protrude ahead of the front posts, so the full footprint is deeper than the frame
    expect(modelBounds(m).depth).toBeGreaterThan(frame(m).depth);
  });
  it("six-post footprint is deeper by the storage section", () => {
    const c = { ...defaultRack(), postCount: 6 as const };
    expect(frame(buildRack(c)).depth).toBeCloseTo(c.depth + c.rearStorageDepth, 3);
  });
  it("changing upright height changes overall height and hole count", () => {
    const base = defaultRack();
    const tall = { ...base, uprightHeight: fromInches(100) };
    expect(modelBounds(buildRack(tall)).height).toBeCloseTo(fromInches(100), 3);
    expect(holePositions(tall).length).toBeGreaterThan(holePositions(base).length);
  });
  it("crossmember length follows rack width", () => {
    const c = { ...defaultRack(), width: fromInches(60) };
    const cm = buildRack(c).primitives.find((p) => p.role === "crossmember" && p.size[0] > p.size[1])!;
    expect(cm.size[0]).toBeCloseTo(fromInches(60) - 2 * c.uprightSize, 3);
  });
  it("honors explicit crossmember length", () => {
    const c = defaultRack();
    c.crossmembers = [{ ...c.crossmembers[0], length: 1000 }];
    expect(buildRack(c).primitives.find((p) => p.role === "crossmember")!.size[0]).toBe(1000);
  });
  it("validates oversize holes", () => {
    expect(validateRack({ ...defaultRack(), holeDiameter: 80 }).length).toBeGreaterThan(0);
    expect(validateRack(defaultRack())).toHaveLength(0);
  });
});
