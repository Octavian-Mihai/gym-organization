import { fromFeet, fromInches } from "../units";
import { newId } from "./ids";
import type { ClearanceSettings, Design, Room, Scene } from "./types";
import { SCHEMA_VERSION } from "./types";

export const noClearance = (): ClearanceSettings => ({ enabled: false, front: 0, back: 0, left: 0, right: 0 });

export function defaultRoom(): Room {
  return {
    length: fromFeet(14),
    width: fromFeet(12),
    ceilingHeight: fromFeet(8),
    wallThickness: fromInches(4.5),
    floorType: "concrete",
    floorColor: "#9ca3af",
    wallColors: { north: "#e5e7eb", east: "#e5e7eb", south: "#e5e7eb", west: "#e5e7eb" },
    openings: [
      { id: newId("door"), kind: "door", wall: "south", offset: fromInches(24), width: fromInches(32), height: fromInches(80), swing: "in-left" },
      { id: newId("win"), kind: "window", wall: "north", offset: fromInches(48), width: fromInches(48), height: fromInches(36), sillHeight: fromInches(42) },
    ],
    obstacles: [],
  };
}

export const defaultScene = (): Scene => ({ room: defaultRoom(), equipment: [] });

export function newDesign(name = "Untitled gym"): Design {
  const now = new Date().toISOString();
  return { schemaVersion: SCHEMA_VERSION, id: newId("design"), name, createdAt: now, updatedAt: now, scene: defaultScene() };
}
