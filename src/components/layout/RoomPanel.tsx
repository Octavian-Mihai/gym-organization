"use client";
import { useMemo } from "react";
import { validateSceneCached } from "@/lib/geometry/validation";
import { newId } from "@/lib/scene/ids";
import type { Door, Room, WallId, Window as Win } from "@/lib/scene/types";
import { updateRoom } from "@/lib/store/scene-ops";
import { useStore } from "@/lib/store/useStore";
import { fromInches } from "@/lib/units";
import { ColorField, LengthField, SelectField, TextField } from "../ui/fields";

const walls: WallId[] = ["north", "east", "south", "west"];
const btn = "rounded border border-zinc-300 px-2 py-0.5 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800";

const Fold = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <details className="border-t border-zinc-200 pt-2 dark:border-zinc-800">
    <summary className="cursor-pointer select-none text-xs font-semibold uppercase tracking-wide text-zinc-500">{title}</summary>
    <div className="mt-2 space-y-2">{children}</div>
  </details>
);

export function RoomPanel() {
  const scene = useStore((s) => s.scene);
  const commit = useStore((s) => s.commit);
  const { room } = scene;
  const patch = (p: Partial<Room>) => commit((s) => updateRoom(s, p));
  const outside = useMemo(() => validateSceneCached(scene).filter((i) => i.kind === "outside" || i.kind === "ceiling"), [scene]);

  return (
    <div className="space-y-3 p-3 text-sm">
      {outside.length > 0 && (
        <div className="rounded border border-red-300 bg-red-50 p-2 text-xs text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          <b>{outside.length} item(s) no longer fit:</b>
          <ul className="ml-4 list-disc">{outside.slice(0, 6).map((i) => <li key={i.id}><button className="text-left underline" onClick={() => useStore.getState().select(i.objectIds)}>{i.message}</button></li>)}</ul>
        </div>
      )}
      <div className="space-y-1.5">
        <LengthField label="Length" value={room.length} min={1000} max={30000} onChange={(length) => patch({ length })} />
        <LengthField label="Width" value={room.width} min={1000} max={30000} onChange={(width) => patch({ width })} />
        <LengthField label="Ceiling height" value={room.ceilingHeight} min={1500} max={6000} onChange={(ceilingHeight) => patch({ ceilingHeight })} />
      </div>

      <Fold title={`Doors & windows (${room.openings.length})`}>
        <div className="flex gap-1">
          <button className={btn} onClick={() => patch({ openings: [...room.openings, { id: newId("door"), kind: "door", wall: "south", offset: fromInches(60), width: fromInches(32), height: fromInches(80), swing: "in-left" } as Door] })}>+ Door</button>
          <button className={btn} onClick={() => patch({ openings: [...room.openings, { id: newId("win"), kind: "window", wall: "east", offset: fromInches(30), width: fromInches(36), height: fromInches(36), sillHeight: fromInches(42) } as Win] })}>+ Window</button>
        </div>
        {room.openings.map((o, i) => {
          const up = (p: object) => patch({ openings: room.openings.map((q, j) => (j === i ? ({ ...q, ...p } as typeof q) : q)) });
          return (
            <div key={o.id} className="space-y-1.5 rounded border border-zinc-200 p-2 dark:border-zinc-800">
              <div className="flex items-center justify-between text-xs font-medium capitalize"><span>{o.kind}</span><button className="text-red-600 hover:underline" onClick={() => patch({ openings: room.openings.filter((_, j) => j !== i) })}>Remove</button></div>
              <SelectField label="Wall" value={o.wall} options={walls.map((w) => ({ value: w, label: w }))} onChange={(wall) => up({ wall })} />
              <LengthField label="Position" value={o.offset} hint="From the west end (north/south walls) or north end (east/west walls)" onChange={(offset) => up({ offset })} />
              <LengthField label="Width" value={o.width} min={100} onChange={(width) => up({ width })} />
              <LengthField label="Height" value={o.height} min={100} onChange={(height) => up({ height })} />
              {o.kind === "window" && <LengthField label="Sill height" value={o.sillHeight} min={0} onChange={(sillHeight) => up({ sillHeight })} />}
              {o.kind === "door" && <SelectField label="Opens" value={o.swing} options={[{ value: "in-left", label: "In, hinge left" }, { value: "in-right", label: "In, hinge right" }, { value: "out-left", label: "Out, hinge left" }, { value: "out-right", label: "Out, hinge right" }]} onChange={(swing) => up({ swing })} />}
            </div>
          );
        })}
      </Fold>

      <Fold title={`Columns, pipes & panels (${room.obstacles.length})`}>
        <button className={btn} onClick={() => patch({ obstacles: [...room.obstacles, { id: newId("obs"), name: "Column", kind: "column", wall: "west", offset: fromInches(60), width: fromInches(12), depth: fromInches(12), height: room.ceilingHeight, elevation: 0 }] })}>+ Add obstacle</button>
        {room.obstacles.map((o, i) => {
          const up = (p: object) => patch({ obstacles: room.obstacles.map((q, j) => (j === i ? { ...q, ...p } : q)) });
          return (
            <div key={o.id} className="space-y-1.5 rounded border border-zinc-200 p-2 dark:border-zinc-800">
              <div className="flex items-center gap-2"><TextField label="Name" value={o.name} onChange={(name) => up({ name })} /><button className="text-red-600 hover:underline" onClick={() => patch({ obstacles: room.obstacles.filter((_, j) => j !== i) })}>✕</button></div>
              <SelectField label="Wall" value={o.wall} options={walls.map((w) => ({ value: w, label: w }))} onChange={(wall) => up({ wall })} />
              <LengthField label="Position" value={o.offset} onChange={(offset) => up({ offset })} />
              <LengthField label="Width" value={o.width} min={10} onChange={(width) => up({ width })} />
              <LengthField label="Sticks out" value={o.depth} min={10} onChange={(depth) => up({ depth })} />
              <LengthField label="Height" value={o.height} min={10} onChange={(height) => up({ height })} />
              <LengthField label="Elevation" value={o.elevation} min={0} onChange={(elevation) => up({ elevation })} />
            </div>
          );
        })}
      </Fold>

      <Fold title="Appearance">
        <LengthField label="Wall thickness" value={room.wallThickness} min={0} max={600} onChange={(wallThickness) => patch({ wallThickness })} />
        <ColorField label="Floor color" value={room.floorColor} onChange={(floorColor) => patch({ floorColor })} />
        {walls.map((w) => <ColorField key={w} label={`${w} wall`} value={room.wallColors[w]} onChange={(c) => patch({ wallColors: { ...room.wallColors, [w]: c } })} />)}
      </Fold>
      <p className="text-[11px] text-zinc-500">North is the top of the plan. Positions are measured from the west end of north/south walls and the north end of east/west walls.</p>
    </div>
  );
}
