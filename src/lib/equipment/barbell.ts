import { newId } from "../scene/ids";
import { fromInches } from "../units";
import { box, cyl, normalizeModel } from "./model";
import { groupsThickness, groupsWeight, PLATE_PRESETS, type PlateGroup } from "./plates";
import type { EquipmentDef, Primitive } from "./types";

export type BarType = "olympic" | "short" | "ez-curl" | "trap";
export interface BarbellConfig {
  barType: BarType;
  overallLength: number;
  shaftDiameter: number;
  shaftLength: number; // between sleeves
  sleeveLength: number;
  sleeveDiameter: number;
  barWeightKg: number;
  color: string;
  finish: "chrome" | "black-oxide" | "cerakote";
  /** plates loaded on EACH sleeve, ordered from inside (shaft) to outside */
  plates: PlateGroup[];
  /** trap bar frame width (y) */
  frameWidth: number;
}

const finishColor = { chrome: "#d4d4d8", "black-oxide": "#3f3f46", cerakote: "#b91c1c" } as const;

export const BAR_PRESETS: Record<BarType, Partial<BarbellConfig>> = {
  olympic: { barType: "olympic", overallLength: 2200, shaftDiameter: 28, shaftLength: 1310, sleeveLength: 415, sleeveDiameter: 50, barWeightKg: 20 },
  short: { barType: "short", overallLength: 1500, shaftDiameter: 28, shaftLength: 760, sleeveLength: 370, sleeveDiameter: 50, barWeightKg: 12 },
  "ez-curl": { barType: "ez-curl", overallLength: 1200, shaftDiameter: 28, shaftLength: 560, sleeveLength: 320, sleeveDiameter: 50, barWeightKg: 8 },
  trap: { barType: "trap", overallLength: 1450, shaftDiameter: 32, shaftLength: 750, sleeveLength: 350, sleeveDiameter: 50, barWeightKg: 25, frameWidth: 560 },
};

export const defaultBarbell = (): BarbellConfig => ({
  barType: "olympic",
  overallLength: 2200,
  shaftDiameter: 28,
  shaftLength: 1310,
  sleeveLength: 415,
  sleeveDiameter: 50,
  barWeightKg: 20,
  color: finishColor.chrome,
  finish: "chrome",
  plates: [],
  frameWidth: 560,
});

export const newPlateGroup = (preset = PLATE_PRESETS[0], count = 1): PlateGroup => ({ ...preset, id: newId("pl"), count });

export function sleeveLoad(c: BarbellConfig) {
  return { used: groupsThickness(c.plates), available: c.sleeveLength };
}

export function barbellTotalWeight(c: BarbellConfig) {
  return c.barWeightKg + 2 * groupsWeight(c.plates);
}

export function buildBarbell(c: BarbellConfig) {
  const prims: Primitive[] = [];
  const steel = { color: c.color, material: "chrome" as const };
  const sleeveCenterOffset = c.shaftLength / 2 + c.sleeveLength / 2;
  const barRadiusZ = Math.max(c.sleeveDiameter, ...c.plates.map((p) => (p.count > 0 ? p.diameter : 0))) / 2;
  const zAxis = barRadiusZ;

  if (c.barType === "trap") {
    const w = c.frameWidth / 2;
    const len = c.shaftLength;
    // hex frame approximated by a rectangle with handles
    prims.push(box("rail-l", "frame", 0, -w, zAxis, len, 30, 30, steel));
    prims.push(box("rail-r", "frame", 0, w, zAxis, len, 30, 30, steel));
    prims.push(box("end-l", "frame", -len / 2, 0, zAxis, 30, c.frameWidth, 30, steel));
    prims.push(box("end-r", "frame", len / 2, 0, zAxis, 30, c.frameWidth, 30, steel));
    prims.push(cyl("handle-l", "handle", "x", 0, -w + 130, zAxis + 40, c.shaftDiameter, len * 0.6, { color: "#18181b", material: "plastic" }));
    prims.push(cyl("handle-r", "handle", "x", 0, w - 130, zAxis + 40, c.shaftDiameter, len * 0.6, { color: "#18181b", material: "plastic" }));
  } else {
    prims.push(cyl("shaft", "shaft", "x", 0, 0, zAxis, c.shaftDiameter, c.shaftLength + 2, steel));
    if (c.barType === "ez-curl") {
      prims.push(box("ez-bend", "grip", 0, 0, zAxis, c.shaftLength * 0.5, c.shaftDiameter * 2.2, c.shaftDiameter, { color: c.color, material: "chrome", solid: false }));
    }
  }

  for (const side of [-1, 1]) {
    const cx = side * sleeveCenterOffset;
    prims.push(cyl(`sleeve-${side}`, "sleeve", "x", cx, 0, zAxis, c.sleeveDiameter, c.sleeveLength, steel));
    let offset = -side * c.sleeveLength / 2; // start at inner end of sleeve
    offset = cx - side * c.sleeveLength / 2;
    for (const g of c.plates) {
      for (let i = 0; i < g.count; i++) {
        const px = offset + side * g.thickness / 2;
        prims.push(cyl(`plate-${side}-${g.id}-${i}`, "plate", "x", px, 0, zAxis, g.diameter, g.thickness, { color: g.color, material: "plate", holeDiameter: g.holeDiameter }));
        offset += side * g.thickness;
      }
    }
  }
  return normalizeModel({ primitives: prims, holes: [] });
}

export const barbellDef: EquipmentDef<BarbellConfig> = {
  type: "barbell",
  label: "Barbell",
  category: "Barbells & plates",
  description: "Barbell with loaded plates. Place on the floor, in a rack, or on a holder.",
  defaultConfig: defaultBarbell,
  presets: (Object.keys(BAR_PRESETS) as BarType[]).map((k) => ({ id: k, label: { olympic: "Olympic bar", short: "Short bar", "ez-curl": "EZ curl bar", trap: "Trap bar" }[k], config: BAR_PRESETS[k] })),
  fields: [
    { key: "barType", kind: "select", label: "Bar type", options: [{ value: "olympic", label: "Olympic" }, { value: "short", label: "Short" }, { value: "ez-curl", label: "EZ curl" }, { value: "trap", label: "Trap bar" }] },
    { key: "overallLength", kind: "length", label: "Overall length", group: "Dimensions", min: 300, max: 3000 },
    { key: "shaftLength", kind: "length", label: "Shaft length", group: "Dimensions", min: 100, max: 3000 },
    { key: "shaftDiameter", kind: "length", label: "Shaft diameter", group: "Dimensions", min: 10, max: 60 },
    { key: "sleeveLength", kind: "length", label: "Sleeve length", group: "Dimensions", min: 50, max: 800 },
    { key: "sleeveDiameter", kind: "length", label: "Sleeve diameter", group: "Dimensions", min: 20, max: 100 },
    { key: "frameWidth", kind: "length", label: "Trap bar frame width", group: "Dimensions" },
    { key: "barWeightKg", kind: "number", label: "Bar weight", suffix: "kg", min: 0, max: 100 },
    { key: "finish", kind: "select", label: "Finish", options: [{ value: "chrome", label: "Chrome" }, { value: "black-oxide", label: "Black oxide" }, { value: "cerakote", label: "Cerakote red" }] },
  ],
  validate: (c) => {
    const e: string[] = [];
    if (Math.abs(c.shaftLength + 2 * c.sleeveLength - c.overallLength) > 2) e.push("Overall length should equal shaft + two sleeves.");
    const { used, available } = sleeveLoad(c);
    if (used > available) e.push(`Plates (${Math.round(used)} mm) exceed sleeve length (${Math.round(available)} mm).`);
    return e;
  },
  sanitize: (c) => {
    const d = defaultBarbell();
    const n = (v: unknown, fb: number, lo: number, hi: number) => (typeof v === "number" && isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fb);
    const m = { ...d, ...c };
    m.shaftLength = n(c.shaftLength, d.shaftLength, 100, 3000);
    m.sleeveLength = n(c.sleeveLength, d.sleeveLength, 50, 800);
    m.shaftDiameter = n(c.shaftDiameter, d.shaftDiameter, 10, 60);
    m.sleeveDiameter = n(c.sleeveDiameter, d.sleeveDiameter, 20, 100);
    m.overallLength = m.shaftLength + 2 * m.sleeveLength;
    m.plates = Array.isArray(c.plates) ? c.plates.filter((p) => p && p.count >= 0 && p.thickness > 0 && p.diameter > 0) : [];
    return m;
  },
  build: buildBarbell,
  // Sleeve loading space at each end (bar axis = x). front/back = y, left/right = x.
  defaultClearance: () => ({ enabled: false, front: 300, back: 300, left: 400, right: 400, label: "Loading space & bar ends" }),
  defaultName: (c) => ({ olympic: "Olympic bar", short: "Short bar", "ez-curl": "EZ curl bar", trap: "Trap bar" })[c.barType],
  metadata: (c) => [
    { label: "Bar weight", value: `${c.barWeightKg} kg` },
    { label: "Plates per side", value: String(c.plates.reduce((s, g) => s + g.count, 0)) },
    { label: "Total loaded", value: `${barbellTotalWeight(c)} kg` },
  ],
  defaultColor: "#d4d4d8",
};
void fromInches;
