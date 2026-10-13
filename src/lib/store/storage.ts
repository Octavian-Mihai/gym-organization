import { ImportError, parseDesign } from "../persistence/schema";
import type { Design, UserSettings } from "../scene/types";

const DESIGNS_KEY = "homegym:v1:designs";
const CURRENT_KEY = "homegym:v1:current";
const SETTINGS_KEY = "homegym:v1:settings";

const ls = (): Storage | null => {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
};

export function loadDesigns(): { designs: Design[]; warnings: string[] } {
  const warnings: string[] = [];
  const raw = ls()?.getItem(DESIGNS_KEY);
  if (!raw) return { designs: [], warnings };
  try {
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) throw new ImportError("bad list");
    const designs: Design[] = [];
    for (const d of list) {
      try {
        designs.push(parseDesign(d, warnings));
      } catch (e) {
        warnings.push(`A saved design could not be loaded: ${(e as Error).message}`);
      }
    }
    return { designs, warnings };
  } catch {
    warnings.push("Saved designs were unreadable and were ignored.");
    return { designs: [], warnings };
  }
}

export function saveDesigns(designs: Design[]): boolean {
  try {
    ls()?.setItem(DESIGNS_KEY, JSON.stringify(designs));
    return true;
  } catch {
    return false;
  }
}
export const loadCurrentId = () => ls()?.getItem(CURRENT_KEY) ?? null;
export const saveCurrentId = (id: string) => { try { ls()?.setItem(CURRENT_KEY, id); } catch { /* ignore */ } };

export const DEFAULT_SETTINGS: UserSettings = {
  displayUnit: "in",
  gridSize: 25.4,
  snapToGrid: true,
  snapToWalls: true,
  snapToObjects: true,
  showClearances: true,
  showDimensions: true,
};
export function loadSettings(): UserSettings {
  try {
    const raw = ls()?.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}
export const saveSettings = (s: UserSettings) => { try { ls()?.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* ignore */ } };
