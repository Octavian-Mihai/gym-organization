import { newId } from "../scene/ids";
import { fromInches } from "../units";
import { box, cyl, normalizeModel } from "./model";
import type { EquipmentDef, HoleSet, Primitive } from "./types";

export type AccessoryKind = "band" | "cable-attachment" | "handle" | "tool" | "lifting-strap" | "hook";

export interface PegAccessory {
  id: string;
  kind: AccessoryKind;
  /** hole column / row index (0,0 = bottom-left hole) */
  col: number;
  row: number;
}

export const ACCESSORY_DIMS: Record<AccessoryKind, { label: string; w: number; h: number; d: number; color: string }> = {
  band: { label: "Resistance band", w: 120, h: 450, d: 40, color: "#f97316" },
  "cable-attachment": { label: "Cable attachment", w: 180, h: 240, d: 60, color: "#a1a1aa" },
  handle: { label: "Handle", w: 130, h: 110, d: 70, color: "#18181b" },
  tool: { label: "Small tool (wrench)", w: 40, h: 220, d: 25, color: "#71717a" },
  "lifting-strap": { label: "Lifting straps", w: 90, h: 300, d: 30, color: "#16a34a" },
  hook: { label: "Hook", w: 40, h: 120, d: 80, color: "#52525b" },
};

export interface PegboardConfig {
  width: number;
  height: number;
  thickness: number;
  holeDiameter: number;
  holeSpacing: number;
  material: "hardboard" | "steel" | "plywood" | "plastic";
  color: string;
  accessories: PegAccessory[];
}

export const MATERIAL_COLORS = { hardboard: "#a16207", steel: "#9ca3af", plywood: "#d6a96a", plastic: "#e5e7eb" } as const;

export function pegGrid(c: PegboardConfig) {
  const cols = Math.max(1, Math.floor((c.width - c.holeSpacing) / c.holeSpacing) + 1);
  const rows = Math.max(1, Math.floor((c.height - c.holeSpacing) / c.holeSpacing) + 1);
  const x0 = -((cols - 1) * c.holeSpacing) / 2;
  return { cols, rows, x0 };
}

export const defaultPegboard = (): PegboardConfig => ({
  width: fromInches(48),
  height: fromInches(24),
  thickness: fromInches(0.25),
  holeDiameter: fromInches(0.25),
  holeSpacing: fromInches(1),
  material: "hardboard",
  color: MATERIAL_COLORS.hardboard,
  accessories: [],
});

export const newAccessory = (kind: AccessoryKind = "hook", col = 4, row = 4): PegAccessory => ({ id: newId("acc"), kind, col, row });

export function buildPegboard(c: PegboardConfig) {
  const { cols, rows, x0 } = pegGrid(c);
  const prims: Primitive[] = [box("board", "pegboard", 0, 0, c.height / 2, c.width, c.thickness, c.height, { color: c.color, material: "wood" })];
  const holes: HoleSet[] = [];
  const zs = Array.from({ length: rows }, (_, r) => c.holeSpacing + r * c.holeSpacing - c.holeSpacing / 2 + (c.height - rows * c.holeSpacing) / 2);
  const xs = Array.from({ length: cols }, (_, i) => x0 + i * c.holeSpacing);
  holes.push({ id: "pegholes", hostId: "board", axis: "y", diameter: c.holeDiameter, zs, xs, center: [0, 0], halfSize: [c.width / 2, c.thickness / 2] });
  for (const a of c.accessories) {
    const dim = ACCESSORY_DIMS[a.kind];
    const x = x0 + Math.min(Math.max(a.col, 0), cols - 1) * c.holeSpacing;
    const z = zs[Math.min(Math.max(a.row, 0), rows - 1)];
    // hangs from the hole, extending downward for tall items
    prims.push(box(a.id, `accessory-${a.kind}`, x, c.thickness / 2 + dim.d / 2, z - dim.h / 2 + 15, dim.w, dim.d, dim.h, { color: dim.color, material: "plastic" }));
  }
  return normalizeModel({ primitives: prims, holes });
}

export const pegboardDef: EquipmentDef<PegboardConfig> = {
  type: "pegboard",
  label: "Pegboard",
  category: "Wall",
  description: "Wall-mounted pegboard with a hole grid and hangable accessories.",
  wallMounted: true,
  defaultConfig: defaultPegboard,
  fields: [
    { key: "width", kind: "length", label: "Width", min: 100, max: 5000 },
    { key: "height", kind: "length", label: "Height", min: 100, max: 3000 },
    { key: "material", kind: "select", label: "Material", options: [{ value: "hardboard", label: "Hardboard" }, { value: "plywood", label: "Plywood" }, { value: "steel", label: "Steel" }, { value: "plastic", label: "Plastic" }] },
    { key: "thickness", kind: "length", label: "Thickness", advanced: true, min: 2, max: 60 },
    { key: "holeDiameter", kind: "length", label: "Hole diameter", advanced: true, min: 2, max: 30 },
    { key: "holeSpacing", kind: "length", label: "Hole spacing", advanced: true, min: 10, max: 100 },
    { key: "color", kind: "color", label: "Color", advanced: true },
  ],
  validate: (c) => (c.holeSpacing <= c.holeDiameter * 1.5 ? ["Hole spacing too tight for the hole diameter."] : []),
  sanitize: (c) => {
    const d = defaultPegboard();
    const n = (v: unknown, fb: number, lo: number, hi: number) => (typeof v === "number" && isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fb);
    return {
      ...d,
      ...c,
      width: n(c.width, d.width, 100, 5000),
      height: n(c.height, d.height, 100, 3000),
      thickness: n(c.thickness, d.thickness, 2, 60),
      holeDiameter: n(c.holeDiameter, d.holeDiameter, 2, 30),
      holeSpacing: n(c.holeSpacing, d.holeSpacing, 10, 100),
      accessories: Array.isArray(c.accessories) ? c.accessories : [],
    };
  },
  build: buildPegboard,
  defaultClearance: () => ({ enabled: false, front: 400, back: 0, left: 0, right: 0, label: "Access to hanging items" }),
  defaultName: () => "Pegboard",
  metadata: (c) => [{ label: "Accessories", value: String(c.accessories.length) }],
  defaultColor: "#a16207",
};
void cyl;
