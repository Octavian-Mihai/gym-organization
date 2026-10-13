import { describe, expect, it } from "vitest";
import { dimsOf, footprintObb, modelOf, solidsOf } from "./geometry/world";
import { obbAabb } from "./geometry/rect";
import { validateScene } from "./geometry/validation";
import { defaultScene } from "./scene/defaults";
import { createInstance } from "./scene/factory";
import { addMatGrid, alignToWall, resizePatch, updateConfig, wallMount, updatePlacement, mountTo } from "./store/scene-ops";
import { fromFeet, fromInches } from "./units";
import { allDefs } from "./equipment/registry";

describe("shared model drives both views", () => {
  it("2D footprint, 3D bounds and collision solids all derive from one model", () => {
    const rack = createInstance("power-rack");
    const scene = { ...defaultScene(), equipment: [rack] };
    const fp = footprintObb(rack, scene);
    const d = dimsOf(rack);
    expect(fp.w).toBe(d.width);
    expect(fp.d).toBe(d.depth);
    const sol = solidsOf(rack, scene);
    expect(sol.length).toBe(modelOf(rack).primitives.filter((p) => p.solid !== false).length);
  });

  it("editing a config updates footprint immediately (6-post, taller, wider)", () => {
    let scene = { ...defaultScene(), equipment: [createInstance("power-rack")] };
    const id = scene.equipment[0].id;
    const before = dimsOf(scene.equipment[0]);
    scene = updateConfig(scene, id, { postCount: 6 });
    expect(dimsOf(scene.equipment[0]).depth).toBeGreaterThan(before.depth);
    scene = updateConfig(scene, id, { uprightHeight: fromInches(100), width: fromInches(60) });
    expect(dimsOf(scene.equipment[0]).height).toBeCloseTo(fromInches(100), 3);
    expect(dimsOf(scene.equipment[0]).width).toBeCloseTo(fromInches(60), 3);
  });

  it("rotated footprint swaps axis extents", () => {
    const bench = createInstance("bench-flat", { placement: { x: 2000, y: 2000, z: 0, rotation: 90 } });
    const scene = { ...defaultScene(), equipment: [bench] };
    const bb = obbAabb(footprintObb(bench, scene));
    expect(bb.maxX - bb.minX).toBeCloseTo(dimsOf(bench).depth, 6);
    expect(bb.maxY - bb.minY).toBeCloseTo(dimsOf(bench).width, 6);
  });

  it("mat grid creates independent edge-to-edge mats", () => {
    const { scene, newIds } = addMatGrid(defaultScene(), { rows: 2, cols: 3, originX: 0, originY: 0 });
    expect(newIds).toHaveLength(6);
    const [a, b] = scene.equipment;
    expect(b.placement.x - a.placement.x).toBeCloseTo(fromInches(72), 6);
    expect(validateScene(scene).filter((i) => i.kind === "physical")).toHaveLength(0);
  });

  it("resize patches grow footprints", () => {
    const rack = createInstance("power-rack");
    const p = resizePatch(rack, 100, 0)!;
    expect(p.width).toBeCloseTo((rack.config as { width: number }).width + 100, 6);
  });

  it("wall-mounted items sit flush and flag overhang", () => {
    const base = defaultScene();
    const peg = createInstance("pegboard");
    let scene = { ...base, equipment: [peg] };
    scene = updatePlacement(scene, peg.id, { ...wallMount(scene, peg, "north", fromFeet(7)), z: 900 });
    expect(validateScene(scene).filter((i) => i.kind === "wall-mount")).toHaveLength(0);
    scene = updatePlacement(scene, peg.id, { x: 100 });
    expect(validateScene(scene).some((i) => i.kind === "wall-mount")).toBe(true);
  });

  it("alignToWall accounts for rotation", () => {
    const bench = createInstance("bench-flat", { placement: { x: 2000, y: 2000, z: 0, rotation: 90 } });
    let scene = { ...defaultScene(), equipment: [bench] };
    scene = alignToWall(scene, bench.id, "west");
    const bb = obbAabb(footprintObb(scene.equipment[0], scene));
    expect(bb.minX).toBeCloseTo(0, 6);
  });

  it("mounting a barbell in a rack is exempt from collisions with that rack only", () => {
    const rack = createInstance("power-rack", { placement: { x: fromFeet(7), y: fromFeet(6), z: 0, rotation: 0 } });
    const bar = createInstance("barbell");
    let scene = { ...defaultScene(), equipment: [rack, bar] };
    scene = mountTo(scene, bar.id, rack.id);
    expect(validateScene(scene).filter((i) => i.kind === "physical")).toHaveLength(0);
  });

  it("every registered equipment type builds, validates and has finite geometry", () => {
    for (const d of allDefs()) {
      const inst = createInstance(d.type);
      const m = modelOf(inst);
      expect(m.primitives.length, d.type).toBeGreaterThan(0);
      for (const p of m.primitives) for (const n of [...p.center, ...p.size]) expect(Number.isFinite(n), `${d.type}:${p.id}`).toBe(true);
      expect(d.validate(inst.config), d.type).toHaveLength(0);
      const dm = dimsOf(inst);
      expect(dm.width > 0 && dm.depth > 0 && dm.height > 0, d.type).toBe(true);
    }
  });

  it("stays fast with many instances", () => {
    const eq = Array.from({ length: 150 }, (_, i) => createInstance(i % 5 === 0 ? "power-rack" : i % 5 === 1 ? "barbell" : "stall-mat", { placement: { x: (i % 15) * 800 + 500, y: Math.floor(i / 15) * 800 + 500, z: 0, rotation: (i * 30) % 360 } }));
    const scene = { ...defaultScene(), equipment: eq };
    const t0 = performance.now();
    validateScene(scene);
    expect(performance.now() - t0).toBeLessThan(1500);
  });
});
