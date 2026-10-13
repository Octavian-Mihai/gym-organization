"use client";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getDef } from "@/lib/equipment/registry";
import { primitiveExtent } from "@/lib/equipment/model";
import { clearanceObb, dimsOf, footprintObb, modelOf, worldPlacement } from "@/lib/geometry/world";
import { obbAabb, obbCorners, rad, rotatePoint, type OBB } from "@/lib/geometry/rect";
import { snapAngle, snapMove, type Guide } from "@/lib/geometry/snap";
import { validateScene, type Issue } from "@/lib/geometry/validation";
import type { EquipmentInstance, Opening, Scene, WallId } from "@/lib/scene/types";
import { resizePatch, updateConfig, updatePlacement, wallMount } from "@/lib/store/scene-ops";
import { useStore } from "@/lib/store/useStore";
import { formatLength } from "@/lib/units";

interface View { ox: number; oy: number; k: number }

const polyPts = (c: { x: number; y: number }[]) => c.map((p) => `${p.x},${p.y}`).join(" ");

/** Top-down silhouette of one instance, in its local frame (origin = footprint center). */
export const Shape2D = memo(function Shape2D({ inst, x, y, rot, selected, issue, dimmed }: { inst: EquipmentInstance; x: number; y: number; rot: number; selected: boolean; issue: boolean; dimmed: boolean }) {
  const model = modelOf(inst);
  const passive = !!getDef(inst.type)?.passive;
  const prims = [...model.primitives].sort((a, b) => a.center[2] + primitiveExtent(a)[2] / 2 - (b.center[2] + primitiveExtent(b)[2] / 2));
  const d = dimsOf(inst);
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`} opacity={dimmed ? 0.35 : 1} data-id={inst.id} style={{ cursor: inst.locked ? "not-allowed" : "move" }}>
      {/* invisible hit area = footprint, so thin members are still easy to grab */}
      <rect x={-d.width / 2} y={-d.depth / 2} width={d.width} height={d.depth} fill={passive ? "transparent" : "rgba(0,0,0,0.03)"} />
      {prims.map((p) => {
        const e = primitiveExtent(p);
        const fill = p.color ?? "#64748b";
        const op = p.solid === false ? 0.4 : p.role === "mat" ? 0.9 : 0.95;
        if (p.shape === "cylinder" && p.axis === "z") return <circle key={p.id} cx={p.center[0]} cy={p.center[1]} r={e[0] / 2} fill={fill} stroke="#0f172a" strokeWidth={1} vectorEffect="non-scaling-stroke" opacity={op} />;
        return <rect key={p.id} x={p.center[0] - e[0] / 2} y={p.center[1] - e[1] / 2} width={e[0]} height={e[1]} fill={fill} stroke={p.role === "plate" ? "#0f172a" : "#0f172a"} strokeWidth={p.role === "mat" ? 1.5 : 0.8} vectorEffect="non-scaling-stroke" opacity={op} rx={p.shape === "cylinder" ? Math.min(e[0], e[1]) / 2.5 : 0} />;
      })}
      <rect x={-d.width / 2} y={-d.depth / 2} width={d.width} height={d.depth} fill="none" stroke={issue ? "#ef4444" : selected ? "#2563eb" : "none"} strokeWidth={selected || issue ? 2 : 0} strokeDasharray={selected ? "0" : "6 4"} vectorEffect="non-scaling-stroke" pointerEvents="none" />
      {/* front marker: small tick on the +y (front) edge */}
      {selected && <line x1={-d.width * 0.1} x2={d.width * 0.1} y1={d.depth / 2} y2={d.depth / 2} stroke="#2563eb" strokeWidth={4} vectorEffect="non-scaling-stroke" pointerEvents="none" />}
    </g>
  );
});

export function DoorSvg({ o, room }: { o: Opening; room: Scene["room"] }) {
  const { length: L, width: W } = room;
  const frame: Record<WallId, { origin: [number, number]; u: [number, number]; n: [number, number] }> = {
    north: { origin: [0, 0], u: [1, 0], n: [0, 1] },
    south: { origin: [0, W], u: [1, 0], n: [0, -1] },
    west: { origin: [0, 0], u: [0, 1], n: [1, 0] },
    east: { origin: [L, 0], u: [0, 1], n: [-1, 0] },
  };
  const f = frame[o.wall];
  const at = (a: number, d = 0): [number, number] => [f.origin[0] + f.u[0] * a + f.n[0] * d, f.origin[1] + f.u[1] * a + f.n[1] * d];
  const a0 = o.offset, a1 = o.offset + o.width;
  const t = room.wallThickness;
  const wallRect = [at(a0, -t), at(a1, -t), at(a1, 0), at(a0, 0)];
  if (o.kind === "window") {
    const mid = [at(a0, -t / 2), at(a1, -t / 2)];
    return (
      <g pointerEvents="none">
        <polygon points={wallRect.map((p) => p.join(",")).join(" ")} fill="#bae6fd" stroke="#0369a1" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        <line x1={mid[0][0]} y1={mid[0][1]} x2={mid[1][0]} y2={mid[1][1]} stroke="#0369a1" strokeWidth={1} vectorEffect="non-scaling-stroke" />
      </g>
    );
  }
  const hingeLeft = o.swing.endsWith("left");
  const s = o.swing.startsWith("in") ? 1 : -1;
  const hingeA = hingeLeft ? a0 : a1;
  const closedA = hingeLeft ? a1 : a0;
  const H = at(hingeA), C = at(closedA), E = at(hingeA, s * o.width);
  const cross = (C[0] - H[0]) * (E[1] - H[1]) - (C[1] - H[1]) * (E[0] - H[0]);
  return (
    <g pointerEvents="none">
      <polygon points={wallRect.map((p) => p.join(",")).join(" ")} fill="#f8fafc" stroke="none" />
      <path d={`M ${C[0]} ${C[1]} A ${o.width} ${o.width} 0 0 ${cross > 0 ? 1 : 0} ${E[0]} ${E[1]} L ${H[0]} ${H[1]} Z`} fill="rgba(245,158,11,0.10)" stroke="#d97706" strokeWidth={1} strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
      <line x1={H[0]} y1={H[1]} x2={E[0]} y2={E[1]} stroke="#92400e" strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
    </g>
  );
}

type Drag =
  | { kind: "pan"; sx: number; sy: number; ox: number; oy: number }
  | { kind: "move"; start: { x: number; y: number }; startScene: Scene; ids: string[] }
  | { kind: "marquee"; start: { x: number; y: number }; additive: boolean }
  | { kind: "rotate"; id: string; center: { x: number; y: number } }
  | { kind: "resize"; id: string; edge: "e" | "w" | "s" | "n"; startScene: Scene; start: { x: number; y: number } };

export function Planner2D() {
  const scene = useStore((s) => s.scene);
  const selection = useStore((s) => s.selection);
  const settings = useStore((s) => s.settings);
  const focusIssue = useStore((s) => s.focusIssue);
  const st = useStore.getState;
  const ref = useRef<SVGSVGElement>(null);
  const [view, setView] = useState<View>({ ox: 60, oy: 60, k: 0.1 });
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [drag, setDrag] = useState<Drag | null>(null);
  const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [spaceDown, setSpaceDown] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const fitted = useRef(false);

  const issues = useMemo(() => validateScene(scene), [scene]);
  const issueIds = useMemo(() => new Set(issues.filter((i) => i.kind !== "clearance").flatMap((i) => i.objectIds)), [issues]);
  const room = scene.room;
  const unit = settings.displayUnit;

  const fit = useCallback(() => {
    const pad = 70;
    const k = Math.min((size.w - pad * 2) / room.length, (size.h - pad * 2) / room.width);
    setView({ k, ox: (size.w - room.length * k) / 2, oy: (size.h - room.width * k) / 2 });
  }, [size, room.length, room.width]);

  useEffect(() => {
    const el = ref.current?.parentElement;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);
  useEffect(() => { if (!fitted.current && size.w > 100) { fit(); fitted.current = true; } }, [size, fit]);

  const toRoom = useCallback((cx: number, cy: number) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: (cx - r.left - view.ox) / view.k, y: (cy - r.top - view.oy) / view.k };
  }, [view]);

  // wheel zoom (non-passive)
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      setView((v) => {
        const f = Math.exp(-e.deltaY * 0.0015);
        const k = Math.min(2, Math.max(0.01, v.k * f));
        const rr = k / v.k;
        return { k, ox: mx - (mx - v.ox) * rr, oy: my - (my - v.oy) * rr };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    const dn = (e: KeyboardEvent) => { if (e.code === "Space" && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLSelectElement)) { setSpaceDown(true); e.preventDefault(); } };
    const up = (e: KeyboardEvent) => { if (e.code === "Space") setSpaceDown(false); };
    window.addEventListener("keydown", dn); window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", dn); window.removeEventListener("keyup", up); };
  }, []);

  // zoom to an issue when requested from the issues panel
  useEffect(() => {
    if (!focusIssue) return;
    const iss = issues.find((i) => i.id === focusIssue);
    if (iss?.at) setView((v) => ({ ...v, ox: size.w / 2 - iss.at!.x * v.k, oy: size.h / 2 - iss.at!.y * v.k }));
  }, [focusIssue, issues, size]);

  const snapOpts = useCallback(() => {
    const s = st().settings;
    return { grid: s.gridSize, snapGrid: s.snapToGrid, snapWalls: s.snapToWalls, snapObjects: s.snapToObjects, threshold: 12 / view.k };
  }, [st, view.k]);

  const rootsOf = (ids: string[], sc: Scene) => ids.filter((id) => { const e = sc.equipment.find((q) => q.id === id); return e && !e.locked; });

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as Element).closest("[data-ui]")) return;
    const svg = ref.current!;
    svg.setPointerCapture(e.pointerId);
    const p = toRoom(e.clientX, e.clientY);
    if (e.button === 1 || e.button === 2 || spaceDown) { setDrag({ kind: "pan", sx: e.clientX, sy: e.clientY, ox: view.ox, oy: view.oy }); return; }
    if (e.button !== 0) return;
    const hit = (e.target as Element).closest("[data-id]")?.getAttribute("data-id");
    if (hit) {
      const sel = st().selection;
      if (e.shiftKey) {
        if (sel.includes(hit)) st().select(sel.filter((i) => i !== hit)); else st().select([hit], true);
        return;
      }
      if (!sel.includes(hit)) st().select([hit]);
      const ids = rootsOf(st().selection, st().scene);
      if (ids.length) { st().beginGesture(); setDrag({ kind: "move", start: p, startScene: st().scene, ids }); }
    } else {
      if (!e.shiftKey) st().select([]);
      setDrag({ kind: "marquee", start: p, additive: e.shiftKey });
      setMarquee({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const p = toRoom(e.clientX, e.clientY);
    if (drag.kind === "pan") { setView((v) => ({ ...v, ox: drag.ox + e.clientX - drag.sx, oy: drag.oy + e.clientY - drag.sy })); return; }
    if (drag.kind === "marquee") { setMarquee({ x0: drag.start.x, y0: drag.start.y, x1: p.x, y1: p.y }); return; }
    if (drag.kind === "move") {
      const sc0 = drag.startScene;
      const moving = drag.ids.map((id) => sc0.equipment.find((q) => q.id === id)!);
      let dx = p.x - drag.start.x, dy = p.y - drag.start.y;
      if (moving.length === 1 && moving[0].placement.wall && getDef(moving[0].type)?.wallMounted && !moving[0].parentId) {
        const inst = moving[0];
        const horiz = inst.placement.wall === "north" || inst.placement.wall === "south";
        const along = (horiz ? inst.placement.x + dx : inst.placement.y + dy);
        const g = st().settings;
        const a = g.snapToGrid ? Math.round(along / g.gridSize) * g.gridSize : along;
        st().transient((sc) => updatePlacement(sc, inst.id, wallMount(sc, inst, inst.placement.wall!, a)));
        return;
      }
      let g: Guide[] = [];
      if (!e.altKey) { const r = snapMove(sc0, moving, dx, dy, snapOpts()); dx = r.dx; dy = r.dy; g = r.guides; }
      setGuides(g);
      st().transient(() => ({
        ...sc0,
        equipment: sc0.equipment.map((q) => {
          if (!drag.ids.includes(q.id)) return q;
          let ddx = dx, ddy = dy;
          if (q.parentId) { const par = sc0.equipment.find((z) => z.id === q.parentId); const rr = rotatePoint({ x: dx, y: dy }, -(par ? worldPlacement(par, sc0).rotation : 0)); ddx = rr.x; ddy = rr.y; }
          return { ...q, placement: { ...q.placement, x: q.placement.x + ddx, y: q.placement.y + ddy } };
        }),
      }));
      return;
    }
    if (drag.kind === "rotate") {
      const ang = (Math.atan2(p.y - drag.center.y, p.x - drag.center.x) * 180) / Math.PI + 90;
      const inst = st().scene.equipment.find((q) => q.id === drag.id);
      const parentRot = inst?.parentId ? worldPlacement(st().scene.equipment.find((q) => q.id === inst.parentId)!, st().scene).rotation : 0;
      const a = e.shiftKey ? ((ang % 360) + 360) % 360 : snapAngle(ang, 15);
      st().transient((sc) => updatePlacement(sc, drag.id, { rotation: ((a - parentRot) % 360 + 360) % 360 }));
      return;
    }
    if (drag.kind === "resize") {
      const inst = drag.startScene.equipment.find((q) => q.id === drag.id)!;
      const wp = worldPlacement(inst, drag.startScene);
      const ux = Math.cos(rad(wp.rotation)), uy = Math.sin(rad(wp.rotation)); // local x axis
      const vx = -uy, vy = ux; // local y axis
      const dxw = p.x - drag.start.x, dyw = p.y - drag.start.y;
      const horizontal = drag.edge === "e" || drag.edge === "w";
      const sign = drag.edge === "e" || drag.edge === "s" ? 1 : -1;
      let delta = sign * (horizontal ? dxw * ux + dyw * uy : dxw * vx + dyw * vy);
      const g = st().settings;
      if (g.snapToGrid && !e.altKey) delta = Math.round(delta / g.gridSize) * g.gridSize;
      const patch = horizontal ? resizePatch(inst, delta, 0) : resizePatch(inst, 0, delta);
      if (!patch) return;
      const dimsBefore = dimsOf(inst);
      const next = updateConfig(drag.startScene, drag.id, patch);
      const after = next.equipment.find((q) => q.id === drag.id)!;
      const dimsAfter = dimsOf(after);
      const actual = horizontal ? dimsAfter.width - dimsBefore.width : dimsAfter.depth - dimsBefore.depth;
      const shift = (sign * actual) / 2;
      const dir = horizontal ? { x: ux, y: uy } : { x: vx, y: vy };
      const par = inst.parentId;
      const lp = inst.placement;
      const local = par ? rotatePoint({ x: dir.x * shift, y: dir.y * shift }, -wp.rotation + inst.placement.rotation + (wp.rotation - inst.placement.rotation)) : { x: dir.x * shift, y: dir.y * shift };
      st().transient(() => ({ ...next, equipment: next.equipment.map((q) => (q.id === drag.id ? { ...q, placement: { ...q.placement, x: lp.x + (par ? local.x : dir.x * shift), y: lp.y + (par ? local.y : dir.y * shift) } } : q)) }));
      return;
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!drag) return;
    ref.current?.releasePointerCapture(e.pointerId);
    if (drag.kind === "move" || drag.kind === "rotate" || drag.kind === "resize") st().endGesture();
    if (drag.kind === "marquee" && marquee) {
      const x0 = Math.min(marquee.x0, marquee.x1), x1 = Math.max(marquee.x0, marquee.x1), y0 = Math.min(marquee.y0, marquee.y1), y1 = Math.max(marquee.y0, marquee.y1);
      if (x1 - x0 > 20 / view.k || y1 - y0 > 20 / view.k) {
        const sc = st().scene;
        const hit = sc.equipment.filter((q) => { if (q.hidden) return false; const b = obbAabb(footprintObb(q, sc)); return b.maxX >= x0 && b.minX <= x1 && b.maxY >= y0 && b.minY <= y1; }).map((q) => q.id);
        st().select(hit, drag.additive);
      }
      setMarquee(null);
    }
    setGuides([]);
    setDrag(null);
  };

  const onDrop = (e: React.DragEvent) => {
    const type = e.dataTransfer.getData("application/x-gym-type");
    if (!type) return;
    e.preventDefault();
    const p = toRoom(e.clientX, e.clientY);
    const g = st().settings;
    st().addEquipment(type, { at: g.snapToGrid ? { x: Math.round(p.x / g.gridSize) * g.gridSize, y: Math.round(p.y / g.gridSize) * g.gridSize } : p });
  };

  // ---- derived render data
  const ordered = useMemo(() => {
    const depthOf = (e: EquipmentInstance) => { let d = 0, c: EquipmentInstance | undefined = e; while (c?.parentId && d < 5) { d++; c = scene.equipment.find((q) => q.id === c!.parentId); } return d; };
    return [...scene.equipment].filter((e) => !e.hidden).sort((a, b) => Number(!!getDef(b.type)?.passive) - Number(!!getDef(a.type)?.passive) || depthOf(a) - depthOf(b) || (a.placement.z - b.placement.z));
  }, [scene.equipment]);

  const selInst = selection.length === 1 ? scene.equipment.find((q) => q.id === selection[0]) : undefined;
  const selWorld = selInst ? worldPlacement(selInst, scene) : null;
  const selDims = selInst ? dimsOf(selInst) : null;
  const k = view.k;
  const fs = 11 / k;

  const gridStep = useMemo(() => { let g = settings.gridSize; while (g * k < 7) g *= 2; return g; }, [settings.gridSize, k]);

  const Dim = ({ x1, y1, x2, y2, label, color = "#475569", offset = 0 }: { x1: number; y1: number; x2: number; y2: number; label: string; color?: string; offset?: number }) => {
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    const ang = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
    const flip = ang > 90 || ang < -90;
    return (
      <g pointerEvents="none" style={{ userSelect: "none" }}>
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={1} vectorEffect="non-scaling-stroke" />
        <line x1={x1} y1={y1} x2={x1 + (y2 - y1 === 0 ? 0 : 6 / k)} y2={y1 + (x2 - x1 === 0 ? 0 : 6 / k)} stroke={color} strokeWidth={1} vectorEffect="non-scaling-stroke" opacity={0} />
        <g transform={`translate(${mx} ${my}) rotate(${flip ? ang + 180 : ang}) translate(0 ${offset})`}>
          <text fontSize={fs} fill={color} textAnchor="middle" dy={-4 / k} stroke="white" strokeWidth={3 / k} paintOrder="stroke" fontFamily="ui-monospace, monospace">{label}</text>
        </g>
      </g>
    );
  };

  const wallVisible = (w: WallId) => w;
  void wallVisible;
  const t = room.wallThickness;

  return (
    <div className="relative h-full w-full overflow-hidden bg-zinc-100 dark:bg-zinc-950" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
      <svg
        ref={ref}
        className="h-full w-full touch-none select-none"
        style={{ cursor: drag?.kind === "pan" || spaceDown ? "grab" : "default" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onContextMenu={(e) => e.preventDefault()}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <pattern id="grid-minor" width={gridStep} height={gridStep} patternUnits="userSpaceOnUse"><path d={`M ${gridStep} 0 L 0 0 0 ${gridStep}`} fill="none" stroke="#94a3b8" strokeOpacity={0.35} strokeWidth={1} vectorEffect="non-scaling-stroke" /></pattern>
          <pattern id="grid-major" width={gridStep * 5} height={gridStep * 5} patternUnits="userSpaceOnUse"><path d={`M ${gridStep * 5} 0 L 0 0 0 ${gridStep * 5}`} fill="none" stroke="#64748b" strokeOpacity={0.5} strokeWidth={1} vectorEffect="non-scaling-stroke" /></pattern>
        </defs>
        <g transform={`translate(${view.ox} ${view.oy}) scale(${k})`}>
          {/* walls */}
          <rect x={-t} y={-t} width={room.length + 2 * t} height={room.width + 2 * t} fill="#64748b" opacity={0.85} />
          <rect x={0} y={0} width={room.length} height={room.width} fill={room.floorColor} fillOpacity={0.25} />
          <rect x={0} y={0} width={room.length} height={room.width} fill="white" fillOpacity={0.55} />
          <rect x={0} y={0} width={room.length} height={room.width} fill="url(#grid-minor)" pointerEvents="none" />
          <rect x={0} y={0} width={room.length} height={room.width} fill="url(#grid-major)" pointerEvents="none" />
          <rect x={0} y={0} width={room.length} height={room.width} fill="none" stroke="#0f172a" strokeWidth={2} vectorEffect="non-scaling-stroke" pointerEvents="none" />
          {room.openings.map((o) => <DoorSvg key={o.id} o={o} room={room} />)}
          {room.obstacles.map((ob) => {
            const a = ob.offset;
            const r = ob.wall === "north" ? { x: a, y: 0, w: ob.width, h: ob.depth } : ob.wall === "south" ? { x: a, y: room.width - ob.depth, w: ob.width, h: ob.depth } : ob.wall === "west" ? { x: 0, y: a, w: ob.depth, h: ob.width } : { x: room.length - ob.depth, y: a, w: ob.depth, h: ob.width };
            return <rect key={ob.id} x={r.x} y={r.y} width={r.w} height={r.h} fill="#fbbf24" fillOpacity={0.5} stroke="#b45309" strokeWidth={1} vectorEffect="non-scaling-stroke" pointerEvents="none" />;
          })}

          {/* clearance overlays */}
          {settings.showClearances && scene.equipment.map((e) => {
            if (e.hidden) return null;
            const c = clearanceObb(e, scene);
            if (!c) return null;
            const warn = issues.some((i) => i.kind === "clearance" && i.objectIds[0] === e.id);
            return <polygon key={`c-${e.id}`} points={polyPts(obbCorners(c))} fill={warn ? "#ef4444" : "#f59e0b"} fillOpacity={warn ? 0.22 : 0.16} stroke={warn ? "#ef4444" : "#d97706"} strokeDasharray="8 5" strokeWidth={1} vectorEffect="non-scaling-stroke" pointerEvents="none" />;
          })}

          {ordered.map((e) => { const wp = worldPlacement(e, scene); return <Shape2D key={e.id} inst={e} x={wp.x} y={wp.y} rot={wp.rotation} selected={selection.includes(e.id)} issue={issueIds.has(e.id)} dimmed={false} />; })}

          {/* snap guides */}
          {guides.map((g, i) => g.axis === "x" ? <line key={i} x1={g.value} x2={g.value} y1={-t} y2={room.width + t} stroke="#ec4899" strokeWidth={1} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" pointerEvents="none" /> : <line key={i} y1={g.value} y2={g.value} x1={-t} x2={room.length + t} stroke="#ec4899" strokeWidth={1} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" pointerEvents="none" />)}

          {/* room dimensions */}
          {settings.showDimensions && (
            <>
              <Dim x1={0} y1={-t - 28 / k} x2={room.length} y2={-t - 28 / k} label={formatLength(room.length, unit)} color="#1e293b" />
              <Dim x1={-t - 28 / k} y1={room.width} x2={-t - 28 / k} y2={0} label={formatLength(room.width, unit)} color="#1e293b" />
            </>
          )}

          {/* selection dimension annotations + distance to walls */}
          {selInst && selWorld && selDims && settings.showDimensions && (() => {
            const bb = obbAabb(footprintObb(selInst, scene));
            const cx = (bb.minX + bb.maxX) / 2, cy = (bb.minY + bb.maxY) / 2;
            const dist = (a: number, b: number) => b - a;
            return (
              <g>
                <Dim x1={bb.minX} y1={bb.maxY + 14 / k} x2={bb.maxX} y2={bb.maxY + 14 / k} label={formatLength(bb.maxX - bb.minX, unit)} color="#2563eb" />
                <Dim x1={bb.maxX + 14 / k} y1={bb.maxY} x2={bb.maxX + 14 / k} y2={bb.minY} label={formatLength(bb.maxY - bb.minY, unit)} color="#2563eb" />
                {bb.minX > 1 && <Dim x1={0} y1={cy} x2={bb.minX} y2={cy} label={formatLength(dist(0, bb.minX), unit)} color="#16a34a" />}
                {room.length - bb.maxX > 1 && <Dim x1={bb.maxX} y1={cy} x2={room.length} y2={cy} label={formatLength(room.length - bb.maxX, unit)} color="#16a34a" />}
                {bb.minY > 1 && <Dim x1={cx} y1={bb.minY} x2={cx} y2={0} label={formatLength(bb.minY, unit)} color="#16a34a" />}
                {room.width - bb.maxY > 1 && <Dim x1={cx} y1={bb.maxY} x2={cx} y2={room.width} label={formatLength(room.width - bb.maxY, unit)} color="#16a34a" />}
              </g>
            );
          })()}

          {/* issue markers */}
          {issues.map((i) => i.at && (
            <g key={i.id} transform={`translate(${i.at.x} ${i.at.y})`} data-ui>
              <g transform={`scale(${1 / k})`} onPointerDown={(ev) => { ev.stopPropagation(); useStore.getState().setFocusIssue(i.id); useStore.getState().select(i.objectIds); }} style={{ cursor: "pointer" }}>
                <circle r={8} fill={i.severity === "error" ? "#ef4444" : "#f59e0b"} stroke="white" strokeWidth={1.5} />
                <text textAnchor="middle" dy={4} fontSize={11} fontWeight={700} fill="white">!</text>
                <title>{i.message}</title>
              </g>
            </g>
          ))}

          {/* selection handles */}
          {selInst && selWorld && selDims && !selInst.locked && (
            <g data-ui>
              {(() => {
                const handles: { edge: "e" | "w" | "s" | "n"; lx: number; ly: number }[] = [
                  { edge: "e", lx: selDims.width / 2, ly: 0 }, { edge: "w", lx: -selDims.width / 2, ly: 0 },
                  { edge: "s", lx: 0, ly: selDims.depth / 2 }, { edge: "n", lx: 0, ly: -selDims.depth / 2 },
                ];
                const canResize = (e: "e" | "w" | "s" | "n") => !!resizePatch(selInst, e === "e" || e === "w" ? 1 : 0, e === "s" || e === "n" ? 1 : 0) && !selInst.parentId;
                const rotLen = 36 / k;
                const top = rotatePoint({ x: 0, y: -selDims.depth / 2 - rotLen }, selWorld.rotation);
                const topEdge = rotatePoint({ x: 0, y: -selDims.depth / 2 }, selWorld.rotation);
                return (
                  <>
                    <line x1={selWorld.x + topEdge.x} y1={selWorld.y + topEdge.y} x2={selWorld.x + top.x} y2={selWorld.y + top.y} stroke="#2563eb" strokeWidth={1} vectorEffect="non-scaling-stroke" pointerEvents="none" />
                    <circle cx={selWorld.x + top.x} cy={selWorld.y + top.y} r={6 / k} fill="white" stroke="#2563eb" strokeWidth={2} vectorEffect="non-scaling-stroke" style={{ cursor: "crosshair" }}
                      onPointerDown={(ev) => { ev.stopPropagation(); ref.current!.setPointerCapture(ev.pointerId); st().beginGesture(); setDrag({ kind: "rotate", id: selInst.id, center: { x: selWorld.x, y: selWorld.y } }); }} />
                    {handles.filter((h) => canResize(h.edge)).map((h) => {
                      const p = rotatePoint({ x: h.lx, y: h.ly }, selWorld.rotation);
                      return <rect key={h.edge} x={selWorld.x + p.x - 5 / k} y={selWorld.y + p.y - 5 / k} width={10 / k} height={10 / k} fill="white" stroke="#2563eb" strokeWidth={2} vectorEffect="non-scaling-stroke" style={{ cursor: "nwse-resize" }}
                        onPointerDown={(ev) => { ev.stopPropagation(); ref.current!.setPointerCapture(ev.pointerId); st().beginGesture(); setDrag({ kind: "resize", id: selInst.id, edge: h.edge, startScene: st().scene, start: toRoom(ev.clientX, ev.clientY) }); }} />;
                    })}
                  </>
                );
              })()}
            </g>
          )}
          {marquee && <rect x={Math.min(marquee.x0, marquee.x1)} y={Math.min(marquee.y0, marquee.y1)} width={Math.abs(marquee.x1 - marquee.x0)} height={Math.abs(marquee.y1 - marquee.y0)} fill="#3b82f6" fillOpacity={0.12} stroke="#3b82f6" strokeWidth={1} vectorEffect="non-scaling-stroke" pointerEvents="none" />}
        </g>
        {/* HUD: hover */}
        {hover && null}
      </svg>

      <div className="absolute left-3 top-3 flex flex-col gap-1 rounded-md border border-zinc-300 bg-white/90 p-1 text-xs shadow-sm dark:border-zinc-700 dark:bg-zinc-900/90" data-ui>
        <button className="rounded px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800" onClick={fit} title="Fit room to view">Fit</button>
        <button className="rounded px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800" onClick={() => setView((v) => ({ ...v, k: Math.min(2, v.k * 1.25), ox: size.w / 2 - (size.w / 2 - v.ox) * 1.25, oy: size.h / 2 - (size.h / 2 - v.oy) * 1.25 }))}>＋</button>
        <button className="rounded px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800" onClick={() => setView((v) => ({ ...v, k: Math.max(0.01, v.k / 1.25), ox: size.w / 2 - (size.w / 2 - v.ox) / 1.25, oy: size.h / 2 - (size.h / 2 - v.oy) / 1.25 }))}>－</button>
      </div>
      <div className="absolute bottom-3 left-3 flex flex-wrap items-center gap-3 rounded-md border border-zinc-300 bg-white/90 px-2 py-1 text-xs shadow-sm dark:border-zinc-700 dark:bg-zinc-900/90" data-ui>
        <label className="flex items-center gap-1"><input type="checkbox" checked={settings.snapToGrid} onChange={(e) => st().setSettings({ snapToGrid: e.target.checked })} />Grid snap</label>
        <label className="flex items-center gap-1"><input type="checkbox" checked={settings.snapToWalls} onChange={(e) => st().setSettings({ snapToWalls: e.target.checked })} />Walls</label>
        <label className="flex items-center gap-1"><input type="checkbox" checked={settings.snapToObjects} onChange={(e) => st().setSettings({ snapToObjects: e.target.checked })} />Objects</label>
        <label className="flex items-center gap-1"><input type="checkbox" checked={settings.showClearances} onChange={(e) => st().setSettings({ showClearances: e.target.checked })} />Clearances</label>
        <label className="flex items-center gap-1"><input type="checkbox" checked={settings.showDimensions} onChange={(e) => st().setSettings({ showDimensions: e.target.checked })} />Dimensions</label>
        <label className="flex items-center gap-1">Grid
          <select className="rounded border border-zinc-300 bg-transparent px-1 dark:border-zinc-700" value={settings.gridSize} onChange={(e) => st().setSettings({ gridSize: Number(e.target.value) })}>
            <option value={25.4}>1 in</option><option value={50.8}>2 in</option><option value={152.4}>6 in</option><option value={304.8}>1 ft</option><option value={50}>5 cm</option><option value={100}>10 cm</option><option value={500}>50 cm</option>
          </select>
        </label>
        <span className="text-zinc-500">Alt = no snap · Space/right-drag = pan · Wheel = zoom</span>
      </div>
    </div>
  );
}
export type { Issue, OBB };
