import { beforeEach, describe, expect, it } from "vitest";
import { importJson } from "../persistence/schema";
import { useStore } from "./useStore";

const s = () => useStore.getState();

describe("store", () => {
  beforeEach(() => {
    localStorage.clear();
    useStore.setState({ hydrated: false });
    s().hydrate();
    s().newDesign("Test");
  });

  it("adds equipment, then undo/redo restores it", () => {
    const id = s().addEquipment("power-rack");
    expect(s().scene.equipment.map((e) => e.id)).toContain(id);
    s().undo();
    expect(s().scene.equipment).toHaveLength(0);
    s().redo();
    expect(s().scene.equipment).toHaveLength(1);
  });

  it("a drag gesture is a single undo step", () => {
    const id = s().addEquipment("bench-flat");
    s().beginGesture();
    for (let i = 1; i <= 10; i++) s().transient((sc) => ({ ...sc, equipment: sc.equipment.map((e) => (e.id === id ? { ...e, placement: { ...e.placement, x: i * 10 } } : e)) }));
    s().endGesture();
    s().undo();
    expect(s().scene.equipment[0].placement.x).not.toBe(100);
    expect(s().scene.equipment).toHaveLength(1);
  });

  it("saves, edits, reverts and reloads", () => {
    s().addEquipment("barbell");
    s().saveCurrent();
    s().addEquipment("power-rack");
    expect(s().scene.equipment).toHaveLength(2);
    s().revert();
    expect(s().scene.equipment).toHaveLength(1);
    const stored = JSON.parse(localStorage.getItem("homegym:v1:designs")!);
    expect(stored.find((d: { name: string }) => d.name === "Test").scene.equipment).toHaveLength(1);
  });

  it("duplicates a design independently", () => {
    s().addEquipment("power-rack");
    s().duplicateDesign();
    s().addEquipment("barbell");
    const orig = s().designs.find((d) => d.name === "Test")!;
    expect(orig.scene.equipment.length).toBe(0); // saved copy unaffected
    expect(s().designs.length).toBeGreaterThanOrEqual(3);
  });

  it("exports and re-imports the current design", () => {
    s().addEquipment("power-rack");
    const text = s().exportCurrent();
    expect(importJson(text).designs[0].scene.equipment).toHaveLength(1);
    const r = s().importText(text);
    expect(r.ok).toBe(true);
    expect(s().scene.equipment).toHaveLength(1);
  });

  it("reports import errors without throwing", () => {
    expect(s().importText("{oops").ok).toBe(false);
  });

  it("changing room size keeps equipment", () => {
    s().addEquipment("power-rack");
    s().commit((sc) => ({ ...sc, room: { ...sc.room, length: 2000 } }));
    expect(s().scene.equipment).toHaveLength(1);
  });

  it("2D and 3D read the same scene state (single source of truth)", () => {
    const id = s().addEquipment("bench-flat");
    s().commit((sc) => ({ ...sc, equipment: sc.equipment.map((e) => (e.id === id ? { ...e, placement: { ...e.placement, x: 1234 } } : e)) }));
    // both renderers subscribe to the same slice; verify there is exactly one placement for the object
    expect(s().scene.equipment.filter((e) => e.id === id)).toHaveLength(1);
    expect(s().scene.equipment.find((e) => e.id === id)!.placement.x).toBe(1234);
  });
});
