import { fromInches } from "../units";
import { box, normalizeModel } from "./model";
import type { EquipmentDef } from "./types";

export interface MatConfig {
  length: number; // along local x
  width: number; // along local y
  thickness: number;
  color: string;
  texture: "smooth" | "pebble" | "ribbed";
}

export const matDef: EquipmentDef<MatConfig> = {
  type: "stall-mat",
  label: "Horse stall mat",
  category: "Flooring",
  description: "Individual rubber stall mat. Use the layout tool to place a grid of mats.",
  passive: true,
  defaultConfig: () => ({ length: fromInches(72), width: fromInches(48), thickness: fromInches(0.75), color: "#27272a", texture: "pebble" }),
  presets: [
    { id: "4x6-3/4", label: '4×6 ft, 3/4"', config: { length: fromInches(72), width: fromInches(48), thickness: fromInches(0.75) } },
    { id: "4x6-1/2", label: '4×6 ft, 1/2"', config: { length: fromInches(72), width: fromInches(48), thickness: fromInches(0.5) } },
    { id: "4x8-3/4", label: '4×8 ft, 3/4"', config: { length: fromInches(96), width: fromInches(48), thickness: fromInches(0.75) } },
    { id: "3x4-3/4", label: '3×4 ft, 3/4"', config: { length: fromInches(48), width: fromInches(36), thickness: fromInches(0.75) } },
  ],
  fields: [
    { key: "length", kind: "length", label: "Length", min: 100, max: 5000 },
    { key: "width", kind: "length", label: "Width", min: 100, max: 5000 },
    { key: "thickness", kind: "length", label: "Thickness", min: 3, max: 100 },
    { key: "color", kind: "color", label: "Color", advanced: true },
    { key: "texture", kind: "select", label: "Texture", advanced: true, options: [{ value: "smooth", label: "Smooth" }, { value: "pebble", label: "Pebble" }, { value: "ribbed", label: "Ribbed" }] },
  ],
  validate: (c) => (c.length <= 0 || c.width <= 0 || c.thickness <= 0 ? ["Mat dimensions must be positive."] : []),
  sanitize: (c) => {
    const d = matDef.defaultConfig();
    const n = (v: unknown, fb: number, lo: number, hi: number) => (typeof v === "number" && isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fb);
    return { ...d, ...c, length: n(c.length, d.length, 100, 5000), width: n(c.width, d.width, 100, 5000), thickness: n(c.thickness, d.thickness, 3, 100) };
  },
  build: (c) => normalizeModel({ primitives: [box("mat", "mat", 0, 0, c.thickness / 2, c.length, c.width, c.thickness, { color: c.color, material: "rubber" })], holes: [] }),
  defaultClearance: () => ({ enabled: false, front: 0, back: 0, left: 0, right: 0 }),
  defaultName: (c) => `Mat ${Math.round(c.length / 25.4)}×${Math.round(c.width / 25.4)} in`,
  defaultColor: "#27272a",
};
