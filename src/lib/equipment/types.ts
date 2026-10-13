import type { ClearanceSettings } from "../scene/types";

/**
 * Renderer-independent 3D description of an equipment instance, in object-local coordinates:
 * origin = center of the footprint on the floor plane (XY), z = 0 at the object's base.
 * Local +x = width, +y = depth ("front" faces +y), +z = up. Lengths in mm.
 */
export type Material = "steel" | "rubber" | "plate" | "wood" | "plastic" | "glass" | "fabric" | "chrome";

export interface Primitive {
  id: string;
  /** semantic role, used for tests and highlight/inspect (e.g. "upright", "crossmember", "pullup") */
  role: string;
  shape: "box" | "cylinder";
  /** center of the primitive */
  center: [number, number, number];
  /** box: [sx, sy, sz]. cylinder: [diameter, diameter, length] along `axis` */
  size: [number, number, number];
  /** cylinder axis (box ignores) */
  axis?: "x" | "y" | "z";
  color?: string;
  material?: Material;
  /** counts for collision. default true */
  solid?: boolean;
  /** role-specific hint for the renderer (e.g. circular hole through sleeve) */
  holeDiameter?: number;
}

/** A pattern of visible holes on a face of a box primitive (rendered instanced). */
export interface HoleSet {
  id: string;
  /** primitive the holes belong to */
  hostId: string;
  /** face normal axis the holes pierce: "x" (left/right faces) or "y" (front/back faces) */
  axis: "x" | "y";
  diameter: number;
  /** z positions (object-local) */
  zs: number[];
  /** local center xy of the host primitive (faces are offset by half size) */
  /** optional x positions (object-local) for grid patterns; if set, holes are placed at every xs × zs */
  xs?: number[];
  center: [number, number];
  halfSize: [number, number];
}

export interface Model {
  primitives: Primitive[];
  holes: HoleSet[];
}

export interface FieldBase {
  key: string;
  label: string;
  /** optional group heading in the inspector */
  group?: string;
  help?: string;
}
export type FieldDef =
  | (FieldBase & { kind: "length"; min?: number; max?: number })
  | (FieldBase & { kind: "number"; min?: number; max?: number; step?: number; suffix?: string; integer?: boolean })
  | (FieldBase & { kind: "text" })
  | (FieldBase & { kind: "color" })
  | (FieldBase & { kind: "boolean" })
  | (FieldBase & { kind: "select"; options: { value: string; label: string }[] });

export interface Preset<C> {
  id: string;
  label: string;
  config: Partial<C>;
}

export interface EquipmentDef<C extends object = Record<string, unknown>> {
  type: string;
  label: string;
  category: string;
  description?: string;
  /** passive items (e.g. floor mats) never collide with other equipment */
  passive?: boolean;
  /** wall-mounted: attaches to a wall; placement.wall required */
  wallMounted?: boolean;
  defaultConfig(): C;
  presets?: Preset<C>[];
  fields: FieldDef[];
  /** returns human-readable problems; empty if valid. Must not throw for any numeric input. */
  validate(config: C): string[];
  /** Clamp / repair a config (used by import and editing). */
  sanitize(config: C): C;
  build(config: C): Model;
  defaultClearance(config: C): ClearanceSettings;
  defaultName(config: C): string;
  /** extra metadata lines shown in the inspector (weights, counts, ...) */
  metadata?(config: C): { label: string; value: string }[];
  defaultColor?: string;
}
