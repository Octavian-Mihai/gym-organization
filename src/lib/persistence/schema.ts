import { z } from "zod";
import { getDef } from "../equipment/registry";
import { defaultRoom, noClearance } from "../scene/defaults";
import { newId } from "../scene/ids";
import { SCHEMA_VERSION, type Design, type EquipmentInstance, type Room } from "../scene/types";

export const FILE_FORMAT = "home-gym-designer";

const finite = z.number().refine(Number.isFinite, "must be finite");
const wall = z.enum(["north", "east", "south", "west"]);

const openingSchema = z.discriminatedUnion("kind", [
  z.object({ id: z.string(), kind: z.literal("door"), wall, offset: finite, width: finite.positive(), height: finite.positive(), swing: z.enum(["in-left", "in-right", "out-left", "out-right"]).default("in-left") }),
  z.object({ id: z.string(), kind: z.literal("window"), wall, offset: finite, width: finite.positive(), height: finite.positive(), sillHeight: finite.min(0) }),
]);
const obstacleSchema = z.object({ id: z.string(), name: z.string(), kind: z.enum(["column", "pipe", "panel", "other"]), wall, offset: finite, width: finite.positive(), depth: finite.positive(), height: finite.positive(), elevation: finite.min(0) });

const roomSchema = z.object({
  length: finite.positive(),
  width: finite.positive(),
  ceilingHeight: finite.positive(),
  wallThickness: finite.min(0),
  floorType: z.enum(["concrete", "wood", "rubber", "tile"]),
  floorColor: z.string(),
  wallColors: z.object({ north: z.string(), east: z.string(), south: z.string(), west: z.string() }),
  openings: z.array(openingSchema),
  obstacles: z.array(obstacleSchema),
});

const clearanceSchema = z.object({ enabled: z.boolean(), front: finite, back: finite, left: finite, right: finite, label: z.string().optional() });

const equipmentSchema = z.object({
  id: z.string(),
  type: z.string(),
  name: z.string(),
  placement: z.object({ x: finite, y: finite, z: finite, rotation: finite, wall: wall.optional() }),
  config: z.record(z.string(), z.unknown()),
  color: z.string().optional(),
  locked: z.boolean().default(false),
  hidden: z.boolean().default(false),
  groupId: z.string().optional(),
  parentId: z.string().optional(),
  clearance: clearanceSchema.optional(),
});

const designSchema = z.object({
  schemaVersion: z.number().int(),
  id: z.string(),
  name: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  scene: z.object({ room: roomSchema, equipment: z.array(equipmentSchema) }),
});

export interface ImportResult {
  designs: Design[];
  warnings: string[];
}
export class ImportError extends Error {}

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);

/** Upgrade older schema versions to the current one. Add a case per version bump. */
export function migrateDesign(raw: Json): Json {
  let v = typeof raw.schemaVersion === "number" ? raw.schemaVersion : 0;
  const d = { ...raw };
  if (v > SCHEMA_VERSION) throw new ImportError(`This design was saved by a newer version of the app (schema v${v}; this app supports v${SCHEMA_VERSION}).`);
  if (v < 1) {
    // v0 had no schemaVersion; treat as v1-compatible
    v = 1;
  }
  d.schemaVersion = SCHEMA_VERSION;
  return d;
}

/** Validate and normalize a single design. Unknown equipment types are dropped with a warning. */
export function parseDesign(raw: unknown, warnings: string[] = []): Design {
  if (!isObj(raw)) throw new ImportError("Design is not an object.");
  const migrated = migrateDesign(raw);
  const parsed = designSchema.safeParse(migrated);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new ImportError(`Invalid design data at "${first.path.join(".")}": ${first.message}`);
  }
  const d = parsed.data;
  const equipment: EquipmentInstance[] = [];
  const ids = new Set<string>();
  for (const e of d.scene.equipment) {
    const def = getDef(e.type);
    if (!def) {
      warnings.push(`Skipped "${e.name}" — unknown equipment type "${e.type}".`);
      continue;
    }
    const id = ids.has(e.id) ? newId("eq") : e.id;
    ids.add(id);
    const config = def.sanitize({ ...def.defaultConfig(), ...e.config });
    equipment.push({ ...e, id, config, clearance: e.clearance ?? { ...noClearance(), ...def.defaultClearance(config) } });
  }
  for (const e of equipment) if (e.parentId && !ids.has(e.parentId)) { delete e.parentId; warnings.push(`"${e.name}" lost its parent; it was detached.`); }
  const room: Room = { ...defaultRoom(), ...d.scene.room };
  return { ...d, scene: { room, equipment } };
}

export function serializeDesign(design: Design): string {
  return JSON.stringify({ format: FILE_FORMAT, schemaVersion: SCHEMA_VERSION, design }, null, 2);
}
export function serializeAll(designs: Design[]): string {
  return JSON.stringify({ format: FILE_FORMAT, schemaVersion: SCHEMA_VERSION, designs }, null, 2);
}

/** Parse a JSON export (single design or bundle). Throws ImportError with a friendly message. */
export function importJson(text: string): ImportResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ImportError("File is not valid JSON.");
  }
  if (!isObj(data)) throw new ImportError("Unrecognized file contents.");
  const warnings: string[] = [];
  if (data.format !== undefined && data.format !== FILE_FORMAT) throw new ImportError("This file is not a Home Gym Designer export.");
  const list: unknown[] = Array.isArray(data.designs) ? data.designs : isObj(data.design) ? [data.design] : data.scene ? [data] : [];
  if (list.length === 0) throw new ImportError("No designs found in file.");
  const designs = list.map((d) => parseDesign(d, warnings));
  return { designs, warnings };
}
