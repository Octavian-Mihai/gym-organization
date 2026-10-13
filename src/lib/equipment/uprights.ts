import { newId } from "../scene/ids";
import { fromInches } from "../units";
import { box, normalizeModel } from "./model";
import { holePositions, PROFILE_SIZES } from "./rack";
import type { EquipmentDef, HoleSet, Primitive } from "./types";

export interface UprightCrossmember {
  id: string;
  /** height of the member's center */
  z: number;
  zAnchor?: "bottom" | "top";
}

/**
 * One upright, or a pair joined by crossmembers of an exact length.
 * Pair: `crossmemberLength` is the clear span between the two uprights, so overall width = length + 2 × upright size.
 * Single: crossmembers become arms that stick out of the upright by `crossmemberLength` on the chosen side.
 */
export interface UprightsConfig {
  count: 1 | 2;
  uprightHeight: number;
  uprightProfile: "3x3" | "2x2" | "custom";
  uprightSize: number;
  steelThickness: number;
  crossmemberLength: number;
  crossmemberWidth: number;
  crossmemberHeight: number;
  armSide: "right" | "left";
  crossmembers: UprightCrossmember[];
  holeSize: "5/8" | "1" | "custom";
  holeDiameter: number;
  holeSpacing: number;
  holeStartZ: number;
  baseFeet: boolean;
  color: string;
}

export const defaultUprights = (): UprightsConfig => ({
  count: 2,
  uprightHeight: fromInches(90),
  uprightProfile: "3x3",
  uprightSize: fromInches(3),
  steelThickness: 3,
  crossmemberLength: fromInches(43),
  crossmemberWidth: fromInches(3),
  crossmemberHeight: fromInches(2),
  armSide: "right",
  crossmembers: [{ id: newId("ucm"), z: fromInches(1.5), zAnchor: "top" }],
  holeSize: "5/8",
  holeDiameter: fromInches(5 / 8),
  holeSpacing: fromInches(2),
  holeStartZ: fromInches(2),
  baseFeet: false,
  color: "#1f2937",
});

const zOf = (m: UprightCrossmember, h: number) => Math.min(h, Math.max(0, m.zAnchor === "top" ? h - m.z : m.z));

export function buildUprights(c: UprightsConfig) {
  const s = c.uprightSize;
  const steel = { color: c.color, material: "steel" as const };
  const prims: Primitive[] = [];
  const holes: HoleSet[] = [];
  const zs = holePositions({ ...c, westsideBench: false, westsideFrom: 0, westsideTo: 0, westsideSpacing: c.holeSpacing });
  const xs = c.count === 2 ? [-(c.crossmemberLength / 2 + s / 2), c.crossmemberLength / 2 + s / 2] : [0];
  xs.forEach((x, i) => {
    const id = c.count === 2 ? (i === 0 ? "upright-l" : "upright-r") : "upright";
    prims.push(box(id, "upright", x, 0, c.uprightHeight / 2, s, s, c.uprightHeight, steel));
    holes.push({ id: `${id}-hx`, hostId: id, axis: "x", diameter: c.holeDiameter, zs, center: [x, 0], halfSize: [s / 2, s / 2] });
    holes.push({ id: `${id}-hy`, hostId: id, axis: "y", diameter: c.holeDiameter, zs, center: [x, 0], halfSize: [s / 2, s / 2] });
    if (c.baseFeet) prims.push(box(`${id}-foot`, "foot", x, 0, 3, s + 40, s + 40, 6, steel));
  });
  const side = c.armSide === "left" ? -1 : 1;
  for (const m of c.crossmembers) {
    const z = zOf(m, c.uprightHeight);
    if (c.count === 2) prims.push(box(m.id, "crossmember", 0, 0, z, c.crossmemberLength, c.crossmemberWidth, c.crossmemberHeight, steel));
    else prims.push(box(m.id, "crossmember", side * (s / 2 + c.crossmemberLength / 2), 0, z, c.crossmemberLength, c.crossmemberWidth, c.crossmemberHeight, steel));
  }
  return normalizeModel({ primitives: prims, holes });
}

export const uprightsDef: EquipmentDef<UprightsConfig> = {
  type: "uprights",
  label: "Uprights (1 or 2)",
  category: "Racks",
  description: "A single upright or a pair, with crossmembers cut to an exact length.",
  defaultConfig: defaultUprights,
  presets: [
    { id: "pair", label: "Pair of uprights", config: { count: 2 } },
    { id: "single", label: "Single upright with arm", config: { count: 1, crossmemberLength: fromInches(16) } },
    { id: "single-bare", label: "Single upright, no crossmember", config: { count: 1, crossmembers: [] } },
  ],
  fields: [
    { key: "count", kind: "select", label: "Uprights", options: [{ value: "2", label: "Pair" }, { value: "1", label: "Single" }] },
    { key: "crossmemberLength", kind: "length", label: "Crossmember length", min: 50, max: 4000, help: "Pair: clear span between the uprights. Single: how far each arm sticks out." },
    { key: "uprightHeight", kind: "length", label: "Height", min: 300, max: 5000 },
    { key: "armSide", kind: "select", label: "Arm side", showIf: (c: UprightsConfig) => c.count === 1, options: [{ value: "right", label: "Right" }, { value: "left", label: "Left" }] },
    { key: "color", kind: "color", label: "Color" },
    { key: "uprightProfile", kind: "select", label: "Upright profile", advanced: true, group: "Uprights", options: [{ value: "3x3", label: "3×3 in" }, { value: "2x2", label: "2×2 in" }, { value: "custom", label: "Custom" }] },
    { key: "uprightSize", kind: "length", label: "Upright size", advanced: true, group: "Uprights", min: 20, max: 300, showIf: (c: UprightsConfig) => c.uprightProfile === "custom" },
    { key: "steelThickness", kind: "length", label: "Steel thickness", advanced: true, group: "Uprights", min: 1, max: 20 },
    { key: "baseFeet", kind: "boolean", label: "Base feet plates", advanced: true, group: "Uprights" },
    { key: "crossmemberWidth", kind: "length", label: "Crossmember width", advanced: true, group: "Crossmembers" },
    { key: "crossmemberHeight", kind: "length", label: "Crossmember thickness", advanced: true, group: "Crossmembers" },
    { key: "holeSize", kind: "select", label: "Hole size", advanced: true, group: "Holes", options: [{ value: "5/8", label: "5/8 in" }, { value: "1", label: "1 in" }, { value: "custom", label: "Custom" }] },
    { key: "holeDiameter", kind: "length", label: "Hole diameter", advanced: true, group: "Holes", min: 3, max: 100, showIf: (c: UprightsConfig) => c.holeSize === "custom" },
    { key: "holeSpacing", kind: "length", label: "Hole spacing", advanced: true, group: "Holes", min: 5, max: 500 },
    { key: "holeStartZ", kind: "length", label: "First hole height", advanced: true, group: "Holes" },
  ],
  validate: (c) => {
    const e: string[] = [];
    if (c.crossmemberLength < 50) e.push("Crossmember length must be at least 50 mm.");
    if (c.holeDiameter >= c.uprightSize - 2 * c.steelThickness) e.push("Hole diameter is too large for the upright profile.");
    if (c.holeSpacing < c.holeDiameter * 1.5) e.push("Hole spacing is too tight for the hole diameter.");
    for (const m of c.crossmembers) if (zOf(m, c.uprightHeight) !== (m.zAnchor === "top" ? c.uprightHeight - m.z : m.z)) e.push("A crossmember is outside the upright height.");
    return e;
  },
  sanitize: (c) => {
    const d = defaultUprights();
    const n = (v: unknown, fb: number, lo: number, hi: number) => (typeof v === "number" && isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fb);
    const profile = c.uprightProfile === "custom" || c.uprightProfile in PROFILE_SIZES ? c.uprightProfile : d.uprightProfile;
    return {
      ...d,
      ...c,
      count: c.count === 1 ? 1 : 2,
      uprightProfile: profile,
      uprightSize: n(c.uprightSize, d.uprightSize, 20, 300),
      steelThickness: n(c.steelThickness, d.steelThickness, 1, 20),
      uprightHeight: n(c.uprightHeight, d.uprightHeight, 300, 5000),
      crossmemberLength: n(c.crossmemberLength, d.crossmemberLength, 50, 4000),
      crossmemberWidth: n(c.crossmemberWidth, d.crossmemberWidth, 10, 300),
      crossmemberHeight: n(c.crossmemberHeight, d.crossmemberHeight, 5, 300),
      holeDiameter: n(c.holeDiameter, d.holeDiameter, 3, 100),
      holeSpacing: n(c.holeSpacing, d.holeSpacing, 5, 500),
      crossmembers: Array.isArray(c.crossmembers) ? c.crossmembers : d.crossmembers,
    };
  },
  build: buildUprights,
  defaultClearance: () => ({ enabled: false, front: fromInches(24), back: fromInches(12), left: fromInches(12), right: fromInches(12), label: "Working space" }),
  defaultName: (c) => (c.count === 1 ? "Upright" : "Upright pair"),
  metadata: (c) => [
    { label: "Uprights", value: String(c.count) },
    { label: "Crossmembers", value: `${c.crossmembers.length} × ${Math.round(c.crossmemberLength)} mm` },
  ],
  defaultColor: "#1f2937",
};
