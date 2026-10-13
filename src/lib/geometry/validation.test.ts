import { describe, expect, it } from "vitest";
import { createInstance } from "../scene/factory";
import { defaultScene } from "../scene/defaults";
import { fromFeet } from "../units";
import { validateScene } from "./validation";

const sceneWith = (...items: ReturnType<typeof createInstance>[]) => ({ ...defaultScene(), equipment: items });
const at = (inst: ReturnType<typeof createInstance>, x: number, y: number, rotation = 0) => ({ ...inst, placement: { ...inst.placement, x, y, rotation } });

describe("scene validation", () => {
  it("accepts a rack in the middle of the room", () => {
    const s = sceneWith(at(createInstance("power-rack"), fromFeet(7), fromFeet(6)));
    expect(validateScene(s).filter((i) => i.severity === "error")).toHaveLength(0);
  });
  it("detects equipment outside the room", () => {
    const s = sceneWith(at(createInstance("power-rack"), 100, 100));
    expect(validateScene(s).some((i) => i.kind === "outside")).toBe(true);
  });
  it("detects overlapping benches", () => {
    const s = sceneWith(at(createInstance("bench-flat"), 2000, 2000), at(createInstance("bench-flat"), 2050, 2000));
    expect(validateScene(s).some((i) => i.kind === "physical")).toBe(true);
  });
  it("does not flag mats under equipment", () => {
    const s = sceneWith(at(createInstance("stall-mat"), 2000, 2000), at(createInstance("bench-flat"), 2000, 2000));
    expect(validateScene(s).filter((i) => i.kind === "physical")).toHaveLength(0);
  });
  it("allows a barbell mounted on the rack (parent relationship)", () => {
    const rack = at(createInstance("power-rack"), fromFeet(7), fromFeet(6));
    const bar = { ...createInstance("barbell"), parentId: rack.id, placement: { x: 0, y: -600, z: 1300, rotation: 0 } };
    expect(validateScene(sceneWith(rack, bar)).filter((i) => i.kind === "physical")).toHaveLength(0);
  });
  it("flags a rotated rack that no longer fits", () => {
    const s = sceneWith(at(createInstance("power-rack"), 700, fromFeet(6), 45));
    expect(validateScene(s).some((i) => i.kind === "outside")).toBe(true);
  });
  it("flags ceiling violations", () => {
    const rack = createInstance("power-rack");
    rack.config = { ...rack.config, uprightHeight: 3000 };
    const s = sceneWith(at(rack, fromFeet(7), fromFeet(6)));
    expect(validateScene(s).some((i) => i.kind === "ceiling")).toBe(true);
  });
  it("flags a bench blocking a door", () => {
    const s = sceneWith(at(createInstance("bench-flat"), 24 * 25.4 + 400, fromFeet(12) - 300));
    expect(validateScene(s).some((i) => i.kind === "opening")).toBe(true);
  });
});
