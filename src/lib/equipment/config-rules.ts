import { fromInches } from "../units";
import { BAR_PRESETS, FINISH_COLORS, type BarType } from "./barbell";
import { MATERIAL_COLORS } from "./pegboard";
import { PROFILE_SIZES } from "./rack";

/**
 * Keeps linked config fields consistent when one of them is edited (e.g. choosing a bar type applies
 * that bar's dimensions). Pure: returns the patch to actually apply.
 */
export function normalizeConfigPatch(type: string, config: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> {
  const out = { ...patch };
  if (type === "power-rack") {
    if ("uprightProfile" in patch && patch.uprightProfile !== "custom") out.uprightSize = PROFILE_SIZES[String(patch.uprightProfile)] ?? config.uprightSize;
    else if ("uprightSize" in patch && !("uprightProfile" in patch)) out.uprightProfile = "custom";
    if ("holeSize" in patch && patch.holeSize !== "custom") out.holeDiameter = patch.holeSize === "1" ? fromInches(1) : fromInches(5 / 8);
    else if ("holeDiameter" in patch && !("holeSize" in patch)) out.holeSize = "custom";
  }
  if (type === "barbell") {
    if ("barType" in patch) Object.assign(out, BAR_PRESETS[patch.barType as BarType] ?? {});
    if ("overallLength" in patch && !("barType" in patch)) {
      const sleeve = Number(config.sleeveLength);
      out.shaftLength = Math.max(100, Number(patch.overallLength) - 2 * sleeve);
      delete out.overallLength;
    }
    if ("finish" in patch) out.color = FINISH_COLORS[patch.finish as keyof typeof FINISH_COLORS] ?? config.color;
  }
  if (type === "pegboard" && "material" in patch && !("color" in patch)) out.color = MATERIAL_COLORS[patch.material as keyof typeof MATERIAL_COLORS] ?? config.color;
  return out;
}
