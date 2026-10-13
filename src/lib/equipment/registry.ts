import { barbellDef } from "./barbell";
import { ITEM_DEFS } from "./items";
import { matDef } from "./mat";
import { pegboardDef } from "./pegboard";
import { rackDef } from "./rack";
import { uprightsDef } from "./uprights";
import type { EquipmentDef } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDef = EquipmentDef<any>;

const defs: AnyDef[] = [rackDef, uprightsDef, matDef, barbellDef, pegboardDef, ...ITEM_DEFS];
const map = new Map<string, AnyDef>(defs.map((d) => [d.type, d]));

/** Register additional equipment without modifying the application: registerEquipment(myDef). */
export function registerEquipment(def: AnyDef) {
  map.set(def.type, def);
}
export const getDef = (type: string): AnyDef | undefined => map.get(type);
export const allDefs = (): AnyDef[] => [...map.values()];
export const categories = (): string[] => [...new Set(allDefs().map((d) => d.category))];
