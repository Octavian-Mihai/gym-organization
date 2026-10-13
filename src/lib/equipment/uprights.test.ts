import { describe, expect, it } from "vitest";
import { createInstance } from "../scene/factory";
import { fromInches } from "../units";
import { dimsOf, modelOf } from "../geometry/world";
import { normalizeConfigPatch } from "./config-rules";
import { resizePatch, updateConfig } from "../store/scene-ops";
import { defaultScene } from "../scene/defaults";
import { buildUprights, defaultUprights, uprightsDef } from "./uprights";

const ups = (c = defaultUprights()) => buildUprights(c).primitives.filter((p) => p.role === "upright");
const cms = (c = defaultUprights()) => buildUprights(c).primitives.filter((p) => p.role === "crossmember");

describe("uprights (1 or a pair)", () => {
  it("pair has two uprights and the crossmember is exactly the requested length", () => {
    const c = { ...defaultUprights(), crossmemberLength: 1234 };
    expect(ups(c)).toHaveLength(2);
    expect(cms(c)[0].size[0]).toBe(1234);
  });
  it("overall width = crossmember length + two upright sizes", () => {
    const inst = createInstance("uprights", {}, { crossmemberLength: 1000 });
    expect(dimsOf(inst).width).toBeCloseTo(1000 + 2 * fromInches(3), 6);
  });
  it("the crossmember spans exactly between the inner faces of the uprights", () => {
    const c = { ...defaultUprights(), crossmemberLength: 900 };
    const [l, r] = ups(c);
    expect(r.center[0] - r.size[0] / 2 - (l.center[0] + l.size[0] / 2)).toBeCloseTo(900, 6);
  });
  it("a single upright has one post and arms of the requested length on the chosen side", () => {
    const c = { ...defaultUprights(), count: 1 as const, crossmemberLength: 400 };
    expect(ups(c)).toHaveLength(1);
    const post = ups(c)[0], arm = cms(c)[0];
    expect(arm.size[0]).toBe(400);
    expect(arm.center[0]).toBeGreaterThan(post.center[0]);
    const left = cms({ ...c, armSide: "left" })[0];
    expect(left.center[0]).toBeLessThan(ups({ ...c, armSide: "left" })[0].center[0]);
  });
  it("a single upright can have no crossmembers", () => {
    expect(cms({ ...defaultUprights(), count: 1, crossmembers: [] })).toHaveLength(0);
  });
  it("crossmember heights follow the upright height when anchored to the top", () => {
    const inst = createInstance("uprights");
    const tall = { ...(inst.config as object), uprightHeight: fromInches(100) } as ReturnType<typeof defaultUprights>;
    const m = cms(tall)[0];
    expect(m.center[2]).toBeCloseTo(fromInches(100) - fromInches(1.5), 6);
  });
  it("is resizable by dragging the crossmember length", () => {
    const inst = createInstance("uprights");
    const p = resizePatch(inst, 100, 0)!;
    expect(p.crossmemberLength).toBeCloseTo(defaultUprights().crossmemberLength + 100, 6);
  });
  it("profile change updates the real upright size", () => {
    const inst = createInstance("uprights");
    const p = normalizeConfigPatch("uprights", inst.config as Record<string, unknown>, { uprightProfile: "2x2" });
    const scene = updateConfig({ ...defaultScene(), equipment: [inst] }, inst.id, p);
    expect(modelOf(scene.equipment[0]).primitives.find((q) => q.role === "upright")!.size[0]).toBeCloseTo(fromInches(2), 6);
  });
  it("validates", () => {
    expect(uprightsDef.validate(defaultUprights())).toEqual([]);
    expect(uprightsDef.validate({ ...defaultUprights(), crossmemberLength: 10 }).length).toBeGreaterThan(0);
  });
});
