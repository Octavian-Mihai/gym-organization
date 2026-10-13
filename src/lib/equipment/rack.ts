import { fromInches } from "../units";
import { box, cyl, normalizeModel } from "./model";
import type { EquipmentDef, HoleSet, Model, Primitive } from "./types";

export interface Crossmember {
  id: string;
  /** "x" runs across the rack width, "y" runs front-to-back */
  axis: "x" | "y";
  /** height of member center above floor */
  z: number;
  /** x: position along depth (0 = front posts, depth = rear posts, >depth = storage posts). y: position along width (0 = left, width = right) */
  at: number;
  /** override automatic length (mm); undefined = span between posts */
  length?: number;
}
export interface PullupBar {
  id: string;
  /** position along depth, 0 = front posts */
  at: number;
  z: number;
  diameter: number;
}
export interface Safety {
  id: string;
  z: number;
  kind: "pin-pipe" | "spotter-arm";
  /** how far past the front posts the arms reach (mm) */
  reach: number;
}
export interface JCup {
  id: string;
  z: number;
}

export interface RackConfig {
  postCount: 4 | 6;
  /** outer cross-section of uprights (square) */
  uprightSize: number;
  uprightProfile: "3x3" | "2x3" | "2x2" | "custom";
  steelThickness: number;
  uprightHeight: number;
  /** outside-to-outside width of the cage */
  width: number;
  /** outside-to-outside depth of the cage (front posts to rear cage posts) */
  depth: number;
  /** extra depth for the rear storage section (6-post only): centerline spacing past the rear cage posts */
  rearStorageDepth: number;
  holeSize: "5/8" | "1" | "custom";
  holeDiameter: number;
  holeSpacing: number;
  holeStartZ: number;
  westsideBench: boolean;
  westsideFrom: number;
  westsideTo: number;
  westsideSpacing: number;
  crossmemberWidth: number;
  crossmemberHeight: number;
  crossmembers: Crossmember[];
  pullupBars: PullupBar[];
  safeties: Safety[];
  jcups: JCup[];
  pegCount: number;
  pegFirstZ: number;
  pegSpacing: number;
  pegLength: number;
  pegDiameter: number;
  pegSide: "outside" | "rear";
  baseFeet: boolean;
  color: string;
}

let n = 0;
const id = (p: string) => `${p}${++n}`;

export const PROFILE_SIZES: Record<string, number> = {
  "3x3": fromInches(3),
  "2x3": fromInches(2),
  "2x2": fromInches(2),
};
export const HOLE_PRESETS = { "5/8": fromInches(5 / 8), "1": fromInches(1) } as const;

export function defaultRack(): RackConfig {
  const H = fromInches(90);
  return {
    postCount: 4,
    uprightSize: fromInches(3),
    uprightProfile: "3x3",
    steelThickness: 3,
    uprightHeight: H,
    width: fromInches(49),
    depth: fromInches(49),
    rearStorageDepth: fromInches(24),
    holeSize: "5/8",
    holeDiameter: fromInches(5 / 8),
    holeSpacing: fromInches(2),
    holeStartZ: fromInches(2),
    westsideBench: false,
    westsideFrom: fromInches(20),
    westsideTo: fromInches(40),
    westsideSpacing: fromInches(1),
    crossmemberWidth: fromInches(3),
    crossmemberHeight: fromInches(2),
    crossmembers: [
      { id: id("cm"), axis: "x", z: H - fromInches(1.5), at: 0 },
      { id: id("cm"), axis: "x", z: H - fromInches(1.5), at: fromInches(49) - fromInches(3) },
      { id: id("cm"), axis: "y", z: H - fromInches(1.5), at: 0 },
      { id: id("cm"), axis: "y", z: H - fromInches(1.5), at: fromInches(49) - fromInches(3) },
      { id: id("cm"), axis: "x", z: fromInches(1.5), at: fromInches(49) - fromInches(3) },
    ],
    pullupBars: [{ id: id("pu"), at: fromInches(49) / 2, z: H - fromInches(4), diameter: fromInches(1.25) }],
    safeties: [{ id: id("sf"), z: fromInches(26), kind: "pin-pipe", reach: fromInches(2) }],
    jcups: [{ id: id("jc"), z: fromInches(50) }],
    pegCount: 0,
    pegFirstZ: fromInches(10),
    pegSpacing: fromInches(8),
    pegLength: fromInches(10),
    pegDiameter: fromInches(2),
    pegSide: "outside",
    baseFeet: false,
    color: "#1f2937",
  };
}

/** Standard hole z positions along an upright, honoring an optional close-spaced bench zone. */
export function holePositions(c: RackConfig): number[] {
  const zs: number[] = [];
  const top = c.uprightHeight - c.uprightSize * 0.5;
  const spacing = Math.max(c.holeSpacing, c.holeDiameter * 1.5, 5);
  for (let z = c.holeStartZ; z <= top + 1e-6; ) {
    zs.push(z);
    const inBench = c.westsideBench && z >= c.westsideFrom && z < c.westsideTo;
    z += inBench ? Math.max(c.westsideSpacing, c.holeDiameter * 1.5, 5) : spacing;
  }
  return zs;
}

export function validateRack(c: RackConfig): string[] {
  const e: string[] = [];
  if (c.uprightHeight < 500) e.push("Upright height must be at least 500 mm.");
  if (c.width < c.uprightSize * 2 + 100) e.push("Rack width is too small for the upright profile.");
  if (c.depth < c.uprightSize * 2 + 100) e.push("Rack depth is too small for the upright profile.");
  if (c.holeDiameter >= c.uprightSize - 2 * c.steelThickness) e.push("Hole diameter is too large for the upright profile.");
  if (c.holeSpacing < c.holeDiameter * 1.5) e.push("Hole spacing is too tight for the hole diameter.");
  if (c.postCount === 6 && c.rearStorageDepth < c.uprightSize + 50) e.push("Rear storage depth is too small.");
  for (const m of c.crossmembers) if (m.z > c.uprightHeight) e.push(`Crossmember ${m.id} is above the uprights.`);
  return e;
}

export function sanitizeRack(c: RackConfig): RackConfig {
  const d = defaultRack();
  const num = (v: unknown, fb: number, min: number, max = 1e6) => (typeof v === "number" && isFinite(v) ? Math.min(max, Math.max(min, v)) : fb);
  return {
    ...d,
    ...c,
    postCount: c.postCount === 6 ? 6 : 4,
    uprightSize: num(c.uprightSize, d.uprightSize, 20, 300),
    steelThickness: num(c.steelThickness, d.steelThickness, 1, 20),
    uprightHeight: num(c.uprightHeight, d.uprightHeight, 300, 5000),
    width: num(c.width, d.width, 200, 5000),
    depth: num(c.depth, d.depth, 200, 5000),
    rearStorageDepth: num(c.rearStorageDepth, d.rearStorageDepth, 100, 3000),
    holeDiameter: num(c.holeDiameter, d.holeDiameter, 3, 100),
    holeSpacing: num(c.holeSpacing, d.holeSpacing, 5, 500),
    crossmembers: Array.isArray(c.crossmembers) ? c.crossmembers : d.crossmembers,
    pullupBars: Array.isArray(c.pullupBars) ? c.pullupBars : d.pullupBars,
    safeties: Array.isArray(c.safeties) ? c.safeties : d.safeties,
    jcups: Array.isArray(c.jcups) ? c.jcups : d.jcups,
  };
}

/** Post centers in rack coordinates (x across width from left, y along depth from front). */
export function postCenters(c: RackConfig): { id: string; x: number; y: number }[] {
  const s = c.uprightSize;
  const xs = [s / 2, c.width - s / 2];
  const ys = [s / 2, c.depth - s / 2];
  const out: { id: string; x: number; y: number }[] = [];
  const names = ["front", "rear"];
  ys.forEach((y, yi) => xs.forEach((x, xi) => out.push({ id: `post-${names[yi]}-${xi ? "r" : "l"}`, x, y })));
  if (c.postCount === 6) {
    const y = c.depth - s / 2 + c.rearStorageDepth;
    xs.forEach((x, xi) => out.push({ id: `post-storage-${xi ? "r" : "l"}`, x, y }));
  }
  return out;
}

/** Total depth including rear storage posts. */
export const rackTotalDepth = (c: RackConfig) => c.depth + (c.postCount === 6 ? c.rearStorageDepth : 0);

export function buildRack(c: RackConfig): Model {
  const s = c.uprightSize;
  const prims: Primitive[] = [];
  const holes: HoleSet[] = [];
  const zs = holePositions(c);
  const steel = { color: c.color, material: "steel" as const };

  // Rack coords -> object coords later normalized.
  for (const p of postCenters(c)) {
    prims.push(box(p.id, "upright", p.x, p.y, c.uprightHeight / 2, s, s, c.uprightHeight, steel));
    // storage posts carry peg holes only on the cage faces; all posts get holes on inner faces
    holes.push({ id: `${p.id}-hx`, hostId: p.id, axis: "x", diameter: c.holeDiameter, zs, center: [p.x, p.y], halfSize: [s / 2, s / 2] });
    holes.push({ id: `${p.id}-hy`, hostId: p.id, axis: "y", diameter: c.holeDiameter, zs, center: [p.x, p.y], halfSize: [s / 2, s / 2] });
    if (c.baseFeet) prims.push(box(`${p.id}-foot`, "foot", p.x, p.y, 3, s + 40, s + 40, 6, steel));
  }

  const innerLeft = s;
  const innerRight = c.width - s;
  const frontFace = s;
  const rearFace = c.depth - s;
  const total = rackTotalDepth(c);

  for (const m of c.crossmembers) {
    if (m.axis === "x") {
      const len = m.length ?? innerRight - innerLeft;
      prims.push(box(m.id, "crossmember", c.width / 2, m.at + c.crossmemberWidth / 2, m.z, len, c.crossmemberWidth, c.crossmemberHeight, steel));
    } else {
      const defLen = c.postCount === 6 ? total - 2 * s : rearFace - frontFace;
      const len = m.length ?? (rearFace - frontFace);
      void defLen;
      prims.push(box(m.id, "crossmember", m.at + c.crossmemberWidth / 2, frontFace + len / 2, m.z, c.crossmemberWidth, len, c.crossmemberHeight, steel));
    }
  }

  for (const b of c.pullupBars) {
    prims.push(cyl(b.id, "pullup", "x", c.width / 2, b.at + s / 2, b.z, b.diameter, c.width - 2 * s + 2, { color: "#d1d5db", material: "chrome" }));
  }

  for (const sf of c.safeties) {
    const d = fromInches(1.25);
    for (const [xi, x] of [innerLeft + d / 2 + 2, innerRight - d / 2 - 2].entries()) {
      const startY = sf.kind === "spotter-arm" ? c.depth - s : s / 2;
      const endY = sf.kind === "spotter-arm" ? s / 2 - sf.reach : c.depth - s / 2 + 0;
      const lenY = Math.abs(endY - startY) + (sf.kind === "pin-pipe" ? sf.reach : 0);
      const cy = sf.kind === "spotter-arm" ? (startY + endY) / 2 : s / 2 - sf.reach + lenY / 2;
      prims.push(cyl(`${sf.id}-${xi}`, sf.kind === "pin-pipe" ? "safety-pipe" : "spotter-arm", "y", x, cy, sf.z, d, lenY, { color: "#ef4444", material: "steel" }));
    }
  }

  for (const jc of c.jcups) {
    for (const [xi, x] of [innerLeft + 15, innerRight - 15].entries()) {
      prims.push(box(`${jc.id}-${xi}`, "jcup", x, s / 2 - 40, jc.z, 30, 60, 60, { color: "#f59e0b", material: "plastic" }));
    }
  }

  if (c.pegCount > 0) {
    const peg = (side: "l" | "r", i: number): Primitive => {
      const z = c.pegFirstZ + i * c.pegSpacing;
      if (c.pegSide === "outside") {
        const x = side === "l" ? -c.pegLength / 2 : c.width + c.pegLength / 2;
        return cyl(`peg-${side}-${i}`, "storage-peg", "x", x, c.depth - s / 2, z, c.pegDiameter, c.pegLength, { color: "#6b7280", material: "steel" });
      }
      const y = total + c.pegLength / 2;
      return cyl(`peg-${side}-${i}`, "storage-peg", "y", side === "l" ? s / 2 : c.width - s / 2, y, z, c.pegDiameter, c.pegLength, { color: "#6b7280", material: "steel" });
    };
    for (let i = 0; i < c.pegCount; i++) {
      prims.push(peg("l", i), peg("r", i));
    }
  }

  // Rack coordinates have y=0 at the front posts; the object frame has the front facing +y.
  return normalizeModel({ primitives: prims, holes }, { flipY: true });
}

export const rackDef: EquipmentDef<RackConfig> = {
  type: "power-rack",
  label: "Power rack",
  category: "Racks",
  description: "Configurable 4- or 6-post rack with crossmembers, pull-up bars, safeties and J-cups.",
  defaultConfig: defaultRack,
  fields: [
    { key: "postCount", kind: "select", label: "Configuration", options: [{ value: "4", label: "Four-post" }, { value: "6", label: "Six-post" }] },
    { key: "width", kind: "length", label: "Width", min: 200, max: 5000 },
    { key: "depth", kind: "length", label: "Depth", min: 200, max: 5000 },
    { key: "uprightHeight", kind: "length", label: "Height", min: 500, max: 5000 },
    { key: "rearStorageDepth", kind: "length", label: "Rear storage depth", showIf: (c: RackConfig) => c.postCount === 6 },
    { key: "color", kind: "color", label: "Color" },
    { key: "uprightProfile", kind: "select", label: "Upright profile", advanced: true, group: "Uprights", options: [{ value: "3x3", label: '3×3 in' }, { value: "2x2", label: '2×2 in' }, { value: "custom", label: "Custom" }] },
    { key: "uprightSize", kind: "length", label: "Upright size", advanced: true, group: "Uprights", min: 20, max: 300, showIf: (c: RackConfig) => c.uprightProfile === "custom" },
    { key: "steelThickness", kind: "length", label: "Steel thickness", advanced: true, group: "Uprights", min: 1, max: 20 },
    { key: "baseFeet", kind: "boolean", label: "Base feet plates", advanced: true, group: "Uprights" },
    { key: "holeSize", kind: "select", label: "Hole size", advanced: true, group: "Holes", options: [{ value: "5/8", label: '5/8 in' }, { value: "1", label: '1 in' }, { value: "custom", label: "Custom" }] },
    { key: "holeDiameter", kind: "length", label: "Hole diameter", advanced: true, group: "Holes", min: 3, max: 100, showIf: (c: RackConfig) => c.holeSize === "custom" },
    { key: "holeSpacing", kind: "length", label: "Hole spacing", advanced: true, group: "Holes", min: 5, max: 500 },
    { key: "holeStartZ", kind: "length", label: "First hole height", advanced: true, group: "Holes" },
    { key: "westsideBench", kind: "boolean", label: "Westside bench zone", advanced: true, group: "Holes" },
    { key: "westsideFrom", kind: "length", label: "Zone from", advanced: true, group: "Holes", showIf: (c: RackConfig) => c.westsideBench },
    { key: "westsideTo", kind: "length", label: "Zone to", advanced: true, group: "Holes", showIf: (c: RackConfig) => c.westsideBench },
    { key: "westsideSpacing", kind: "length", label: "Zone spacing", advanced: true, group: "Holes", showIf: (c: RackConfig) => c.westsideBench },
    { key: "crossmemberWidth", kind: "length", label: "Crossmember width", advanced: true, group: "Crossmembers" },
    { key: "crossmemberHeight", kind: "length", label: "Crossmember thickness", advanced: true, group: "Crossmembers" },
    { key: "pegCount", kind: "number", label: "Storage pegs per side", advanced: true, group: "Storage", min: 0, max: 12, integer: true },
    { key: "pegFirstZ", kind: "length", label: "First peg height", advanced: true, group: "Storage", showIf: (c: RackConfig) => c.pegCount > 0 },
    { key: "pegSpacing", kind: "length", label: "Peg spacing", advanced: true, group: "Storage", showIf: (c: RackConfig) => c.pegCount > 0 },
    { key: "pegLength", kind: "length", label: "Peg length", advanced: true, group: "Storage", showIf: (c: RackConfig) => c.pegCount > 0 },
    { key: "pegDiameter", kind: "length", label: "Peg diameter", advanced: true, group: "Storage", showIf: (c: RackConfig) => c.pegCount > 0 },
    { key: "pegSide", kind: "select", label: "Peg location", advanced: true, group: "Storage", showIf: (c: RackConfig) => c.pegCount > 0, options: [{ value: "outside", label: "Outer sides" }, { value: "rear", label: "Rear" }] },
  ],
  presets: [
    { id: "4post-90", label: '4-post, 90" tall', config: { postCount: 4 } },
    { id: "6post-90", label: '6-post with rear storage', config: { postCount: 6, pegCount: 4 } },
    { id: "short", label: 'Short rack, 80"', config: { uprightHeight: fromInches(80) } },
  ],
  validate: validateRack,
  sanitize: sanitizeRack,
  build: buildRack,
  defaultClearance: () => ({ enabled: false, front: fromInches(36), back: fromInches(6), left: fromInches(24), right: fromInches(24), label: "Rack entry & barbell loading" }),
  defaultName: (c) => (c.postCount === 6 ? "6-post rack" : "4-post rack"),
  defaultColor: "#1f2937",
};
