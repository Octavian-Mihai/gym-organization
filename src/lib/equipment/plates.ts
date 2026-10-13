import { fromInches } from "../units";

export type PlateKind = "bumper" | "iron" | "calibrated" | "change";

export interface PlateSpec {
  kind: PlateKind;
  weightKg: number;
  diameter: number;
  thickness: number;
  holeDiameter: number;
  color: string;
}

/** Approximate real-world plate dimensions (mm). Editable per stack in the UI. */
export const PLATE_PRESETS: PlateSpec[] = [
  { kind: "bumper", weightKg: 25, diameter: 450, thickness: 68, holeDiameter: 50.4, color: "#dc2626" },
  { kind: "bumper", weightKg: 20, diameter: 450, thickness: 56, holeDiameter: 50.4, color: "#2563eb" },
  { kind: "bumper", weightKg: 15, diameter: 450, thickness: 42, holeDiameter: 50.4, color: "#eab308" },
  { kind: "bumper", weightKg: 10, diameter: 450, thickness: 30, holeDiameter: 50.4, color: "#16a34a" },
  { kind: "bumper", weightKg: 5, diameter: 450, thickness: 18, holeDiameter: 50.4, color: "#f4f4f5" },
  { kind: "iron", weightKg: 20, diameter: 430, thickness: 40, holeDiameter: 51, color: "#27272a" },
  { kind: "iron", weightKg: 10, diameter: 330, thickness: 32, holeDiameter: 51, color: "#27272a" },
  { kind: "iron", weightKg: 5, diameter: 260, thickness: 25, holeDiameter: 51, color: "#27272a" },
  { kind: "calibrated", weightKg: 25, diameter: 450, thickness: 26, holeDiameter: 50.4, color: "#dc2626" },
  { kind: "calibrated", weightKg: 10, diameter: 400, thickness: 15, holeDiameter: 50.4, color: "#16a34a" },
  { kind: "change", weightKg: 2.5, diameter: 190, thickness: 20, holeDiameter: 51, color: "#e11d48" },
  { kind: "change", weightKg: 1.25, diameter: 170, thickness: 12, holeDiameter: 51, color: "#3b82f6" },
  { kind: "change", weightKg: 0.5, diameter: 150, thickness: 8, holeDiameter: 51, color: "#a1a1aa" },
];

export interface PlateGroup extends PlateSpec {
  id: string;
  count: number;
}

export const plateLabel = (p: PlateSpec) => `${p.kind} ${p.weightKg} kg`;

export const groupWeight = (g: PlateGroup) => g.count * g.weightKg;
export const groupsWeight = (gs: PlateGroup[]) => gs.reduce((s, g) => s + groupWeight(g), 0);
export const groupsThickness = (gs: PlateGroup[]) => gs.reduce((s, g) => s + g.count * g.thickness, 0);
export const kgToLbStr = (kg: number) => `${Math.round(kg * 2.20462 * 10) / 10} lb`;
export const defaultPlateDiameter = fromInches(17.72);
