import { describe, expect, it } from "vitest";
import { formatLength, fromInches, fromMm, parseLength, toMm } from "./index";

describe("units", () => {
  it("converts inches to mm exactly", () => {
    expect(toMm(1, "in")).toBe(25.4);
    expect(fromInches(36)).toBeCloseTo(914.4, 10);
  });
  it("round-trips across all units", () => {
    for (const u of ["mm", "cm", "m", "in", "ft"] as const) {
      expect(fromMm(toMm(123.456, u), u)).toBeCloseTo(123.456, 9);
    }
  });
  it("formats", () => {
    expect(formatLength(914.4, "in")).toBe('36"');
    expect(formatLength(3657.6, "ft")).toBe("12'");
    expect(formatLength(1930.4, "ft")).toBe(`6' 4"`);
    expect(formatLength(1500, "m")).toBe("1.5 m");
  });
  it("parses mixed input", () => {
    expect(parseLength("5' 6\"", "mm")).toBeCloseTo(1676.4, 6);
    expect(parseLength("36", "in")).toBeCloseTo(914.4, 6);
    expect(parseLength("915 mm", "in")).toBe(915);
    expect(parseLength("1.2m", "in")).toBe(1200);
    expect(parseLength("abc", "in")).toBeNull();
  });
});
