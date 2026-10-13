import { getDef } from "../equipment/registry";
import { newId } from "./ids";
import type { EquipmentInstance } from "./types";

/** Create a new equipment instance with the registry's default config, name and clearance. */
export function createInstance(type: string, overrides: Partial<EquipmentInstance> = {}, configPatch: object = {}): EquipmentInstance {
  const def = getDef(type);
  if (!def) throw new Error(`Unknown equipment type: ${type}`);
  const config = def.sanitize({ ...def.defaultConfig(), ...configPatch });
  return {
    id: newId("eq"),
    type,
    name: def.defaultName(config),
    placement: { x: 0, y: 0, z: 0, rotation: 0 },
    config,
    color: undefined,
    locked: false,
    hidden: false,
    clearance: def.defaultClearance(config),
    ...overrides,
  };
}
