/**
 * Renderer-independent scene model. Single source of truth for 2D and 3D.
 * Conventions: lengths in mm. X along room length, Y along room width (top-down, +Y down on screen),
 * Z up. Equipment position = center of footprint on the floor plane; rotation in degrees (CCW from +X when viewed from above... stored as plain degrees, see geometry/footprint).
 */
export const SCHEMA_VERSION = 1;

export type WallId = "north" | "east" | "south" | "west";

export interface OpeningBase {
  id: string;
  wall: WallId;
  /** distance from the wall's start corner to the opening's left edge (mm) */
  offset: number;
  width: number;
  height: number;
}
export interface Door extends OpeningBase {
  kind: "door";
  swing: "in-left" | "in-right" | "out-left" | "out-right";
}
export interface Window extends OpeningBase {
  kind: "window";
  sillHeight: number;
}
export type Opening = Door | Window;

export interface WallObstacle {
  id: string;
  name: string;
  kind: "column" | "pipe" | "panel" | "other";
  wall: WallId;
  offset: number;
  width: number;
  depth: number; // protrusion from wall
  height: number;
  elevation: number;
}

export interface Room {
  length: number; // along X
  width: number; // along Y
  ceilingHeight: number;
  wallThickness: number;
  floorType: "concrete" | "wood" | "rubber" | "tile";
  floorColor: string;
  wallColors: Record<WallId, string>;
  openings: Opening[];
  obstacles: WallObstacle[];
}

export interface ClearanceSettings {
  enabled: boolean;
  /** extra free space beyond footprint, per side (mm) */
  front: number;
  back: number;
  left: number;
  right: number;
  label?: string;
}

export interface Placement {
  /** center of footprint (mm) */
  x: number;
  y: number;
  /** elevation of the object's base above the floor (mm) */
  z: number;
  /** degrees, rotation about vertical axis */
  rotation: number;
  /** wall attachment for wall-mounted items */
  wall?: WallId;
}

export interface EquipmentInstance<C = Record<string, unknown>> {
  id: string;
  type: string; // key into equipment registry
  name: string;
  placement: Placement;
  config: C;
  color?: string;
  locked: boolean;
  hidden: boolean;
  groupId?: string;
  /** mounted-on / contained-in relationship: parent instance id */
  parentId?: string;
  clearance: ClearanceSettings;
}

export interface Scene {
  room: Room;
  equipment: EquipmentInstance[];
}

export interface Design {
  schemaVersion: number;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  scene: Scene;
}

export interface UserSettings {
  displayUnit: "mm" | "cm" | "m" | "in" | "ft";
  gridSize: number; // mm
  snapToGrid: boolean;
  snapToWalls: boolean;
  snapToObjects: boolean;
  showClearances: boolean;
  showDimensions: boolean;
}
