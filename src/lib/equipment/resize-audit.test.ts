import { describe, expect, it } from "vitest";
import { createInstance } from "../scene/factory";
import { allDefs } from "./registry";
import { modelBounds, primitiveExtent } from "./model";
import { normalizeConfigPatch } from "./config-rules";
import type { Model } from "./types";
import { getDef } from "./registry";

/** Every hole must sit on its host primitive: inside its z-range and its face extents. */
function holeProblems(m: Model): string[] {
  const out: string[] = [];
  for (const h of m.holes) {
    const host = m.primitives.find((p) => p.id === h.hostId);
    if (!host) { out.push(`${h.id}: missing host`); continue; }
    const e = primitiveExtent(host);
    const zMin = host.center[2] - e[2] / 2, zMax = host.center[2] + e[2] / 2;
    for (const z of h.zs) if (z - h.diameter / 2 < zMin - 0.5 || z + h.diameter / 2 > zMax + 0.5) out.push(`${h.id}: hole z=${Math.round(z)} outside host [${Math.round(zMin)},${Math.round(zMax)}]`);
    if (Math.abs(h.center[0] - host.center[0]) > 0.5 || Math.abs(h.center[1] - host.center[1]) > 0.5) out.push(`${h.id}: hole center not on host`);
    if (Math.abs(h.halfSize[0] - e[0] / 2) > 0.5 || Math.abs(h.halfSize[1] - e[1] / 2) > 0.5) out.push(`${h.id}: halfSize ${h.halfSize} != host ${e[0] / 2},${e[1] / 2}`);
    for (const x of h.xs ?? []) if (Math.abs(x - host.center[0]) + h.diameter / 2 > e[0] / 2 + 0.5) out.push(`${h.id}: hole x outside host`);
  }
  return out;
}

describe("resize audit: every dimension field, every type", () => {
  for (const def of allDefs()) {
    const lengthFields = def.fields.filter((f) => f.kind === "length");
    for (const f of lengthFields) {
      for (const factor of [0.7, 1.4]) {
        it(`${def.type}.${f.key} x${factor}: finite, consistent, holes on host`, () => {
          const inst = createInstance(def.type);
          const cfg = inst.config as Record<string, unknown>;
          const patch = normalizeConfigPatch(def.type, cfg, { [f.key]: Number(cfg[f.key]) * factor });
          const next = def.sanitize({ ...cfg, ...patch });
          const m = def.build(next);
          for (const p of m.primitives) for (const n of [...p.center, ...p.size]) expect(Number.isFinite(n), `${p.id}`).toBe(true);
          expect(holeProblems(m), JSON.stringify(holeProblems(m))).toEqual([]);
          const b = modelBounds(m);
          expect(b.width > 0 && b.depth > 0 && b.height > 0).toBe(true);
        });
      }
    }
  }

  it("rack: no hole is cut into the rail above the last usable hole, for any height", () => {
    const def = getDef("power-rack")!;
    for (const h of [600, 1500, 2286, 3000]) {
      const c = def.sanitize({ ...def.defaultConfig(), uprightHeight: h });
      const m = def.build(c);
      for (const hs of m.holes) for (const z of hs.zs) expect(z).toBeLessThanOrEqual(h);
    }
  });

  it("rack: storage pegs and posts stay attached when depth/width change", () => {
    const def = getDef("power-rack")!;
    const c = def.sanitize({ ...def.defaultConfig(), postCount: 6, pegCount: 3, depth: 900, width: 1000 });
    const m = def.build(c);
    const posts = m.primitives.filter((p) => p.role === "upright");
    const minX = Math.min(...posts.map((p) => p.center[0])), maxX = Math.max(...posts.map((p) => p.center[0]));
    for (const peg of m.primitives.filter((p) => p.role === "storage-peg")) {
      // outer pegs touch the posts' x-extent on one side; rear pegs sit on post x lines
      expect(peg.center[0] >= minX - c.pegLength - 1 && peg.center[0] <= maxX + c.pegLength + 1).toBe(true);
    }
  });

  it("pegboard: accessories stay on the board when it shrinks", () => {
    const def = getDef("pegboard")!;
    const base = def.defaultConfig() as { accessories: unknown[] };
    const c = def.sanitize({ ...base, width: 200, height: 150, accessories: [{ id: "a", kind: "hook", col: 40, row: 20 }] });
    const m = def.build(c);
    const board = m.primitives.find((p) => p.id === "board")!;
    const acc = m.primitives.find((p) => p.id === "a")!;
    expect(Math.abs(acc.center[0] - board.center[0]) <= primitiveExtent(board)[0] / 2).toBe(true);
    expect(acc.center[2] + primitiveExtent(acc)[2] / 2).toBeLessThanOrEqual(board.center[2] + primitiveExtent(board)[2] / 2 + 1);
  });

  it("barbell: plate stacks follow sleeve length and never move off the sleeve", () => {
    const def = getDef("barbell")!;
    const plate = { id: "p", kind: "bumper", weightKg: 20, diameter: 450, thickness: 56, holeDiameter: 50.4, color: "#00f", count: 3 };
    for (const sleeveLength of [200, 415, 600]) {
      const c = def.sanitize({ ...def.defaultConfig(), sleeveLength, plates: [plate] });
      const m = def.build(c);
      const sleeves = m.primitives.filter((p) => p.role === "sleeve");
      for (const s of sleeves) {
        const side = s.center[0] > 0 ? 1 : -1;
        const mine = m.primitives.filter((p) => p.role === "plate" && Math.sign(p.center[0]) === side);
        const innerEdge = s.center[0] - side * (s.size[2] / 2);
        // first plate starts at the sleeve's inner end
        const first = mine.sort((a, b) => side * (a.center[0] - b.center[0]))[0];
        expect(Math.abs(first.center[0] - side * 28 - innerEdge)).toBeLessThan(1);
      }
    }
  });
});
