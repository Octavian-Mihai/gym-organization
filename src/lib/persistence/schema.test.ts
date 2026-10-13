import { describe, expect, it } from "vitest";
import { newDesign } from "../scene/defaults";
import { createInstance } from "../scene/factory";
import { importJson, ImportError, serializeDesign } from "./schema";

describe("persistence", () => {
  it("round-trips a design through export and import", () => {
    const d = newDesign("Test");
    d.scene.equipment.push(createInstance("power-rack"), createInstance("barbell"));
    const { designs, warnings } = importJson(serializeDesign(d));
    expect(warnings).toHaveLength(0);
    expect(designs[0].name).toBe("Test");
    expect(designs[0].scene.equipment).toHaveLength(2);
    expect(designs[0].scene.equipment[0].config).toEqual(d.scene.equipment[0].config);
    expect(designs[0].scene.room.length).toBe(d.scene.room.length);
  });
  it("rejects malformed files gracefully", () => {
    expect(() => importJson("not json")).toThrow(ImportError);
    expect(() => importJson(JSON.stringify({ format: "other" }))).toThrow(ImportError);
    expect(() => importJson(JSON.stringify({ design: { schemaVersion: 1 } }))).toThrow(ImportError);
  });
  it("rejects newer schema versions", () => {
    const d = { ...newDesign(), schemaVersion: 99 };
    expect(() => importJson(JSON.stringify({ design: d }))).toThrow(/newer version/);
  });
  it("drops unknown equipment with a warning", () => {
    const d = newDesign();
    const e = createInstance("bench-flat");
    d.scene.equipment.push({ ...e, type: "does-not-exist" });
    const r = importJson(JSON.stringify({ design: d }));
    expect(r.designs[0].scene.equipment).toHaveLength(0);
    expect(r.warnings[0]).toMatch(/unknown equipment type/);
  });
  it("repairs out-of-range config values", () => {
    const d = newDesign();
    const rack = createInstance("power-rack");
    rack.config = { ...rack.config, uprightHeight: -5 };
    d.scene.equipment.push(rack);
    const r = importJson(serializeDesign(d));
    expect((r.designs[0].scene.equipment[0].config as { uprightHeight: number }).uprightHeight).toBeGreaterThan(0);
  });
});
