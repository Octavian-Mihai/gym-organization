import { renderToStaticMarkup } from "react-dom/server";
import { getDef } from "@/lib/equipment/registry";
import { footprintObb, worldPlacement } from "@/lib/geometry/world";
import { obbAabb } from "@/lib/geometry/rect";
import type { Scene } from "@/lib/scene/types";
import { formatLength, type LengthUnit } from "@/lib/units";
import { DoorSvg, Shape2D } from "./Planner2D";

/** Static, self-contained floor plan SVG (same shapes as the interactive planner). */
export function floorPlanSvg(scene: Scene, unit: LengthUnit, title: string): string {
  const { room } = scene;
  const m = 700;
  const t = room.wallThickness;
  const W = room.length + 2 * m, H = room.width + 2 * m + 500;
  const fs = Math.max(room.length, room.width) / 70;
  const items = scene.equipment.filter((e) => !e.hidden).sort((a, b) => Number(!!getDef(b.type)?.passive) - Number(!!getDef(a.type)?.passive) || a.placement.z - b.placement.z);
  const svg = (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`${-m} ${-m} ${W} ${H}`} width={W / 4} height={H / 4} fontFamily="ui-monospace, Menlo, monospace">
      <rect x={-m} y={-m} width={W} height={H} fill="white" />
      <rect x={-t} y={-t} width={room.length + 2 * t} height={room.width + 2 * t} fill="#64748b" />
      <rect x={0} y={0} width={room.length} height={room.width} fill="#f8fafc" />
      {room.openings.map((o) => <DoorSvg key={o.id} o={o} room={room} />)}
      {items.map((e) => { const wp = worldPlacement(e, scene); return <Shape2D key={e.id} inst={e} x={wp.x} y={wp.y} rot={wp.rotation} selected={false} issue={false} dimmed={false} />; })}
      {items.filter((e) => !getDef(e.type)?.passive).map((e) => { const b = obbAabb(footprintObb(e, scene)); return <text key={`l-${e.id}`} x={(b.minX + b.maxX) / 2} y={(b.minY + b.maxY) / 2} fontSize={fs * 0.8} textAnchor="middle" fill="#0f172a" stroke="white" strokeWidth={fs / 4} paintOrder="stroke">{e.name}</text>; })}
      <text x={room.length / 2} y={-t - fs} fontSize={fs} textAnchor="middle" fill="#0f172a">{formatLength(room.length, unit)}</text>
      <text x={-t - fs} y={room.width / 2} fontSize={fs} textAnchor="middle" fill="#0f172a" transform={`rotate(-90 ${-t - fs} ${room.width / 2})`}>{formatLength(room.width, unit)}</text>
      <text x={0} y={room.width + t + fs * 2.5} fontSize={fs * 1.2} fontWeight={700} fill="#0f172a">{title}</text>
      <text x={0} y={room.width + t + fs * 4.2} fontSize={fs * 0.8} fill="#475569">{`Room ${formatLength(room.length, unit)} × ${formatLength(room.width, unit)} · ceiling ${formatLength(room.ceilingHeight, unit)} · ${scene.equipment.length} objects`}</text>
    </svg>
  );
  return renderToStaticMarkup(svg);
}

function download(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
const safe = (s: string) => s.replace(/[^\w.-]+/g, "_");

export function exportSvg(scene: Scene, unit: LengthUnit, name: string) {
  download(new Blob([floorPlanSvg(scene, unit, name)], { type: "image/svg+xml" }), `${safe(name)}-floorplan.svg`);
}

export async function exportPng(scene: Scene, unit: LengthUnit, name: string) {
  const svg = floorPlanSvg(scene, unit, name);
  const img = new Image();
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error("render failed")); img.src = url; });
  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = img.width * scale; canvas.height = img.height * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "white"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(url);
  canvas.toBlob((b) => b && download(b, `${safe(name)}-floorplan.png`), "image/png");
}

export function printFloorPlan(scene: Scene, unit: LengthUnit, name: string) {
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.write(`<!doctype html><title>${name}</title><style>body{margin:0;display:flex;justify-content:center}svg{width:100%;height:auto;max-height:100vh}@page{size:landscape;margin:10mm}</style>${floorPlanSvg(scene, unit, name)}`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
  return true;
}
