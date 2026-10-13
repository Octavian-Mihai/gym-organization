/** All stored lengths are millimeters. Conversions are explicit and only used at the display boundary. */
export type LengthUnit = "mm" | "cm" | "m" | "in" | "ft";

export const MM_PER_UNIT: Record<LengthUnit, number> = {
  mm: 1,
  cm: 10,
  m: 1000,
  in: 25.4,
  ft: 304.8,
};

export const UNIT_SYSTEM: Record<LengthUnit, "metric" | "imperial"> = {
  mm: "metric",
  cm: "metric",
  m: "metric",
  in: "imperial",
  ft: "imperial",
};

export const toMm = (value: number, unit: LengthUnit): number => value * MM_PER_UNIT[unit];
export const fromMm = (mm: number, unit: LengthUnit): number => mm / MM_PER_UNIT[unit];

const round = (n: number, dp: number) => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};

/** Format a stored mm value for display, e.g. 914.4 -> `36"` (in) or `914 mm`. */
export function formatLength(mm: number, unit: LengthUnit, dp?: number): string {
  switch (unit) {
    case "mm":
      return `${round(mm, dp ?? 0)} mm`;
    case "cm":
      return `${round(mm / 10, dp ?? 1)} cm`;
    case "m":
      return `${round(mm / 1000, dp ?? 2)} m`;
    case "in":
      return `${round(mm / 25.4, dp ?? 2)}"`;
    case "ft": {
      const totalIn = mm / 25.4;
      const sign = totalIn < 0 ? "-" : "";
      const abs = Math.abs(totalIn);
      let ft = Math.floor(abs / 12);
      let inch = round(abs - ft * 12, dp ?? 1);
      if (inch >= 12) {
        ft += 1;
        inch = 0;
      }
      return `${sign}${ft}'${inch ? ` ${inch}"` : ""}`;
    }
  }
}

/**
 * Parse user input into mm. Accepts `36`, `36 in`, `36"`, `5'`, `5' 6"`, `5ft 6in`, `915mm`, `1.2 m`.
 * Bare numbers use `defaultUnit`. Returns null if unparseable.
 */
export function parseLength(input: string, defaultUnit: LengthUnit): number | null {
  const s = input.trim().toLowerCase().replace(/,/g, ".");
  if (!s) return null;

  const feetInches = s.match(/^(-?\d+(?:\.\d+)?)\s*(?:'|ft|feet|foot)\s*(?:(\d+(?:\.\d+)?)\s*(?:"|in|inch|inches)?)?$/);
  if (feetInches) {
    const ft = parseFloat(feetInches[1]);
    const inch = feetInches[2] ? parseFloat(feetInches[2]) : 0;
    return (Math.abs(ft) * 12 + inch) * 25.4 * (ft < 0 ? -1 : 1);
  }

  const simple = s.match(/^(-?\d+(?:\.\d+)?)\s*(mm|cm|m|in|inch|inches|"|ft|')?$/);
  if (!simple) return null;
  const n = parseFloat(simple[1]);
  const u = simple[2];
  const unit: LengthUnit = !u
    ? defaultUnit
    : u === "inch" || u === "inches" || u === '"'
      ? "in"
      : u === "'"
        ? "ft"
        : (u as LengthUnit);
  return toMm(n, unit);
}

export const fromInches = (n: number) => n * 25.4;
export const fromFeet = (n: number) => n * 304.8;
export const mmToInches = (mm: number) => mm / 25.4;
export const lbToKg = (lb: number) => lb * 0.45359237;
export const kgToLb = (kg: number) => kg / 0.45359237;
