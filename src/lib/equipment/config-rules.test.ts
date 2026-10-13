import { describe, expect, it } from "vitest";
import { createInstance } from "../scene/factory";
import { fromInches } from "../units";
import { normalizeConfigPatch } from "./config-rules";
import { buildRack } from "./rack";
import type { RackConfig } from "./rack";
import { dimsOf } from "../geometry/world";

const cfg = (t: string) => createInstance(t).config as Record<string, unknown>;

describe("linked config fields", () => {
  it("bar type applies that bar's dimensions", () => {
    const p = normalizeConfigPatch("barbell", cfg("barbell"), { barType: "short" });
    expect(p.overallLength).toBe(1500);
    expect(p.shaftLength).toBe(760);
  });
  it("overall length edits change the shaft", () => {
    const p = normalizeConfigPatch("barbell", cfg("barbell"), { overallLength: 2000 });
    expect(p.shaftLength).toBe(2000 - 2 * 415);
    expect(p.overallLength).toBeUndefined();
  });
  it("upright profile and hole size drive the real dimensions", () => {
    const p = normalizeConfigPatch("power-rack", cfg("power-rack"), { uprightProfile: "2x2", holeSize: "1" });
    expect(p.uprightSize).toBeCloseTo(fromInches(2), 6);
    expect(p.holeDiameter).toBeCloseTo(fromInches(1), 6);
    const rack = createInstance("power-rack");
    const before = dimsOf(rack).width;
    const narrower = { ...(rack.config as unknown as RackConfig), ...p } as unknown as RackConfig;
    expect(buildRack(narrower).primitives.find((q) => q.role === "upright")!.size[0]).toBeCloseTo(fromInches(2), 6);
    expect(before).toBeGreaterThan(0);
  });
  it("editing a raw size switches the profile to custom", () => {
    expect(normalizeConfigPatch("power-rack", cfg("power-rack"), { uprightSize: 60 }).uprightProfile).toBe("custom");
  });
  it("finish and material update colors", () => {
    expect(normalizeConfigPatch("barbell", cfg("barbell"), { finish: "cerakote" }).color).toBe("#b91c1c");
    expect(normalizeConfigPatch("pegboard", cfg("pegboard"), { material: "steel" }).color).toBe("#9ca3af");
  });
});
