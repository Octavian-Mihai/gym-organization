import { fromInches } from "../units";
import { box, cyl, normalizeModel } from "./model";
import type { EquipmentDef, FieldDef, Primitive } from "./types";

export interface BoxItemConfig {
  width: number;
  depth: number;
  height: number;
  color: string;
  weightKg?: number;
  /** adjustable bench backrest angle (deg) */
  angle?: number;
  shelves?: number;
}

type Builder = (c: BoxItemConfig) => Primitive[];

const sizeFields: FieldDef[] = [
  { key: "width", kind: "length", label: "Width", min: 50, max: 5000 },
  { key: "depth", kind: "length", label: "Depth", min: 50, max: 5000 },
  { key: "height", kind: "length", label: "Height", min: 20, max: 4000 },
  { key: "color", kind: "color", label: "Color", advanced: true },
];

function makeDef(opts: {
  type: string;
  label: string;
  category: string;
  description?: string;
  w: number;
  d: number;
  h: number;
  color: string;
  wallMounted?: boolean;
  extraFields?: FieldDef[];
  extraDefaults?: Partial<BoxItemConfig>;
  clearance?: { front: number; back: number; left: number; right: number; label: string };
  build: Builder;
}): EquipmentDef<BoxItemConfig> {
  const def: EquipmentDef<BoxItemConfig> = {
    type: opts.type,
    label: opts.label,
    category: opts.category,
    description: opts.description,
    wallMounted: opts.wallMounted,
    defaultConfig: () => ({ width: opts.w, depth: opts.d, height: opts.h, color: opts.color, ...opts.extraDefaults }),
    fields: [...sizeFields, ...(opts.extraFields ?? [])],
    validate: (c) => (c.width > 0 && c.depth > 0 && c.height > 0 ? [] : ["Dimensions must be positive."]),
    sanitize: (c) => {
      const d = def.defaultConfig();
      const n = (v: unknown, fb: number, lo: number, hi: number) => (typeof v === "number" && isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fb);
      return { ...d, ...c, width: n(c.width, d.width, 50, 5000), depth: n(c.depth, d.depth, 20, 5000), height: n(c.height, d.height, 20, 4000) };
    },
    build: (c) => normalizeModel({ primitives: opts.build(c), holes: [] }),
    defaultClearance: () => (opts.clearance ? { enabled: false, ...opts.clearance } : { enabled: false, front: 0, back: 0, left: 0, right: 0 }),
    defaultName: () => opts.label,
    defaultColor: opts.color,
  };
  return def;
}

const metal = (c: BoxItemConfig) => ({ color: c.color, material: "steel" as const });

const bench = (adjustable: boolean): Builder => (c) => {
  const legH = c.height - 90;
  const p: Primitive[] = [];
  const padLen = c.depth; // bench lies along local y (long axis)
  p.push(box("pad", "pad", 0, 0, c.height - 45, c.width, padLen, 90, { color: "#18181b", material: "fabric" }));
  if (adjustable) {
    const a = ((c.angle ?? 0) * Math.PI) / 180;
    const back = padLen * 0.55;
    // visual hint of an inclined backrest (solid=false so footprint stays fixed)
    p.push(box("backrest", "backrest", 0, -padLen / 2 + back / 2 * Math.cos(a), c.height - 45 + (back / 2) * Math.sin(a), c.width, back, 90, { color: "#27272a", material: "fabric", solid: false }));
  }
  for (const x of [-c.width / 2 + 25, c.width / 2 - 25]) for (const y of [-padLen / 2 + 80, padLen / 2 - 80]) p.push(box(`leg-${x}-${y}`, "leg", x, y, legH / 2, 50, 50, legH, metal(c)));
  return p;
};

const shelf: Builder = (c) => {
  const n = Math.max(1, c.shelves ?? 4);
  const p: Primitive[] = [];
  for (const x of [-c.width / 2 + 20, c.width / 2 - 20]) for (const y of [-c.depth / 2 + 20, c.depth / 2 - 20]) p.push(box(`post-${x}-${y}`, "post", x, y, c.height / 2, 40, 40, c.height, metal(c)));
  for (let i = 0; i < n; i++) p.push(box(`shelf-${i}`, "shelf", 0, 0, 30 + (i * (c.height - 60)) / Math.max(1, n - 1), c.width, c.depth, 30, { color: "#a8a29e", material: "wood" }));
  return p;
};

const solid: Builder = (c) => [box("body", "body", 0, 0, c.height / 2, c.width, c.depth, c.height, metal(c))];

export const dumbbellRack: Builder = (c) => {
  const p: Primitive[] = [];
  for (const [i, z] of [c.height * 0.35, c.height * 0.8].entries()) p.push(box(`tier-${i}`, "tier", 0, 0, z, c.width, c.depth, 60, metal(c)));
  for (const x of [-c.width / 2 + 40, 0, c.width / 2 - 40]) p.push(box(`leg-${x}`, "leg", x, 0, c.height / 2, 60, c.depth * 0.9, c.height, metal(c)));
  return p;
};

export const ITEM_DEFS: EquipmentDef<BoxItemConfig>[] = [
  makeDef({ type: "bench-flat", label: "Flat bench", category: "Benches", w: fromInches(12), d: fromInches(48), h: fromInches(17), color: "#3f3f46", build: bench(false), clearance: { front: 600, back: 600, left: 400, right: 400, label: "Bench positioning & use" } }),
  makeDef({ type: "bench-adjustable", label: "Adjustable bench", category: "Benches", w: fromInches(12), d: fromInches(54), h: fromInches(18), color: "#3f3f46", build: bench(true), extraDefaults: { angle: 30 }, extraFields: [{ key: "angle", kind: "number", label: "Backrest angle", suffix: "°", min: 0, max: 90 }], clearance: { front: 600, back: 600, left: 400, right: 400, label: "Bench positioning & use" } }),
  makeDef({ type: "dumbbell-rack", label: "Dumbbell rack", category: "Storage", w: fromInches(72), d: fromInches(20), h: fromInches(32), color: "#1f2937", build: dumbbellRack, clearance: { front: 600, back: 0, left: 0, right: 0, label: "Access" } }),
  makeDef({ type: "kettlebell", label: "Kettlebell", category: "Free weights", w: 230, d: 230, h: 260, color: "#18181b", extraDefaults: { weightKg: 16 }, extraFields: [{ key: "weightKg", kind: "number", label: "Weight", suffix: "kg" }], build: (c) => [cyl("bell", "bell", "z", 0, 0, c.height * 0.35, c.width * 0.85, c.height * 0.7, metal(c)), box("handle", "handle", 0, 0, c.height * 0.85, c.width * 0.6, 30, c.height * 0.3, metal(c))] }),
  makeDef({ type: "weight-tree", label: "Weight tree", category: "Storage", w: 450, d: 450, h: fromInches(48), color: "#27272a", build: (c) => { const p = [box("base", "base", 0, 0, 20, c.width, c.depth, 40, metal(c)), box("post", "post", 0, 0, c.height / 2, 80, 80, c.height, metal(c))]; for (let i = 0; i < 5; i++) p.push(cyl(`peg-${i}`, "peg", "x", 0, 0, 150 + i * ((c.height - 250) / 4), 50, c.width, metal(c))); return p; }, clearance: { front: 400, back: 0, left: 0, right: 0, label: "Plate access" } }),
  makeDef({ type: "cable-machine", label: "Cable machine", category: "Machines", w: fromInches(42), d: fromInches(44), h: fromInches(86), color: "#374151", build: (c) => [box("base", "base", 0, 0, 40, c.width, c.depth, 80, metal(c)), ...[-1, 1].map((s) => box(`col-${s}`, "column", s * (c.width / 2 - 40), 0, c.height / 2, 80, c.depth * 0.5, c.height, metal(c))), box("top", "crossbar", 0, 0, c.height - 40, c.width, 80, 80, metal(c)), box("stack", "weight-stack", 0, -c.depth / 2 + 150, c.height * 0.4, 350, 300, c.height * 0.7, { color: "#6b7280", material: "plate" })], clearance: { front: 1000, back: 0, left: 300, right: 300, label: "Machine movement" } }),
  makeDef({ type: "pulley", label: "Pulley system", category: "Machines", w: fromInches(24), d: fromInches(24), h: fromInches(84), color: "#4b5563", build: solid, clearance: { front: 900, back: 0, left: 200, right: 200, label: "Pulley travel" } }),
  makeDef({ type: "plate-loaded-machine", label: "Plate-loaded machine", category: "Machines", w: fromInches(52), d: fromInches(68), h: fromInches(60), color: "#52525b", build: solid, clearance: { front: 800, back: 100, left: 600, right: 600, label: "Plate loading & entry" } }),
  makeDef({ type: "treadmill", label: "Treadmill", category: "Cardio", w: fromInches(36), d: fromInches(76), h: fromInches(58), color: "#334155", build: (c) => [box("deck", "deck", 0, 0, 150, c.width, c.depth, 300, metal(c)), box("console", "console", 0, -c.depth / 2 + 150, c.height * 0.75, c.width * 0.9, 300, c.height * 0.5, metal(c))], clearance: { front: 0, back: 1000, left: 300, right: 300, label: "Rear run-off" } }),
  makeDef({ type: "bike", label: "Exercise bike", category: "Cardio", w: fromInches(22), d: fromInches(48), h: fromInches(48), color: "#475569", build: solid, clearance: { front: 300, back: 300, left: 300, right: 300, label: "Mounting space" } }),
  makeDef({ type: "storage-shelf", label: "Storage shelf", category: "Storage", w: fromInches(48), d: fromInches(18), h: fromInches(72), color: "#78716c", extraDefaults: { shelves: 4 }, extraFields: [{ key: "shelves", kind: "number", label: "Shelves", min: 1, max: 10, integer: true }], build: shelf, clearance: { front: 700, back: 0, left: 0, right: 0, label: "Access" } }),
  makeDef({ type: "barbell-holder", label: "Wall barbell holder", category: "Wall", w: fromInches(4), d: fromInches(6), h: fromInches(4), color: "#27272a", wallMounted: true, build: (c) => [box("plate-back", "bracket", 0, -c.depth / 2 + 6, c.height / 2, c.width, 12, c.height, metal(c)), box("cradle", "cradle", 0, 0, c.height * 0.3, c.width, c.depth, 30, metal(c))], extraDefaults: {} }),
  makeDef({ type: "resistance-bands", label: "Resistance bands", category: "Accessories", w: 150, d: 100, h: 300, color: "#f97316", build: solid }),
  makeDef({ type: "mirror", label: "Mirror", category: "Wall", w: fromInches(48), d: 30, h: fromInches(72), color: "#bae6fd", wallMounted: true, build: (c) => [box("glass", "mirror", 0, 0, c.height / 2, c.width, c.depth, c.height, { color: c.color, material: "glass" })], clearance: { front: 600, back: 0, left: 0, right: 0, label: "Viewing space" } }),
];
