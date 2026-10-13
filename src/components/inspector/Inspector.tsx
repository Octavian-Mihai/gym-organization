"use client";
import { useMemo } from "react";
import { allDefs, getDef } from "@/lib/equipment/registry";
import { newPlateGroup } from "@/lib/equipment/barbell";
import { ACCESSORY_DIMS, newAccessory, pegGrid, type AccessoryKind, type PegboardConfig } from "@/lib/equipment/pegboard";
import { PLATE_PRESETS, groupsWeight, kgToLbStr, plateLabel, type PlateGroup } from "@/lib/equipment/plates";
import type { RackConfig } from "@/lib/equipment/rack";
import { dimsOf, worldPlacement } from "@/lib/geometry/world";
import { issuesFor, validateScene } from "@/lib/geometry/validation";
import { newId } from "@/lib/scene/ids";
import type { EquipmentInstance, WallId } from "@/lib/scene/types";
import { alignToWall, centerInRoom, groupInstances, mountTo, ungroupInstances, updateConfig, updateInstance, updatePlacement, wallMount } from "@/lib/store/scene-ops";
import { useStore } from "@/lib/store/useStore";
import { formatLength, fromInches } from "@/lib/units";
import { BoolField, ColorField, ConfigFields, LengthField, NumberField, SelectField, TextField } from "../ui/fields";

const Section = ({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) => (
  <details open={defaultOpen} className="border-b border-zinc-200 py-2 dark:border-zinc-800">
    <summary className="cursor-pointer select-none text-xs font-semibold uppercase tracking-wide text-zinc-500">{title}</summary>
    <div className="mt-2 space-y-1.5">{children}</div>
  </details>
);
const smallBtn = "rounded border border-zinc-300 px-2 py-0.5 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800";

export function Inspector({ inst }: { inst: EquipmentInstance }) {
  const scene = useStore((s) => s.scene);
  const commit = useStore((s) => s.commit);
  const unit = useStore((s) => s.settings.displayUnit);
  const def = getDef(inst.type);
  const dims = dimsOf(inst);
  const wp = worldPlacement(inst, scene);
  const issues = useMemo(() => issuesFor(validateScene(scene), inst.id), [scene, inst.id]);
  const problems = def ? def.validate(inst.config) : [];
  const meta = def?.metadata?.(inst.config) ?? [];
  const patchConfig = (p: Record<string, unknown>) => commit((s) => updateConfig(s, inst.id, p));
  const patchPlace = (p: Partial<EquipmentInstance["placement"]>) => commit((s) => updatePlacement(s, inst.id, p));
  const patchInst = (p: Partial<EquipmentInstance>) => commit((s) => updateInstance(s, inst.id, p));
  const mountTargets = scene.equipment.filter((e) => e.id !== inst.id && !e.parentId);
  const isWall = !!def?.wallMounted;
  const dis = inst.locked;

  return (
    <div className="p-3 text-sm">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <div className="text-xs text-zinc-500">{def?.label ?? inst.type}</div>
          <div className="font-semibold">{inst.name}</div>
        </div>
        <div className="flex gap-1">
          <button className={smallBtn} title={inst.locked ? "Unlock position" : "Lock position"} onClick={() => patchInst({ locked: !inst.locked })}>{inst.locked ? "🔒" : "🔓"}</button>
          <button className={smallBtn} title="Hide in both views" onClick={() => { patchInst({ hidden: true }); useStore.getState().select([]); }}>Hide</button>
        </div>
      </div>

      <div className="mb-2 rounded bg-zinc-100 px-2 py-1.5 font-mono text-xs dark:bg-zinc-800">
        {formatLength(dims.width, unit)} W × {formatLength(dims.depth, unit)} D × {formatLength(dims.height, unit)} H
      </div>

      {(issues.length > 0 || problems.length > 0) && (
        <div className="mb-2 space-y-1">
          {problems.map((p, i) => <div key={i} className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">{p}</div>)}
          {issues.map((i) => <button key={i.id} onClick={() => useStore.getState().setFocusIssue(i.id)} className={`block w-full rounded border px-2 py-1 text-left text-xs ${i.severity === "error" ? "border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-200" : "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"}`}>{i.message}</button>)}
        </div>
      )}

      <Section title="Identity">
        <TextField label="Name" value={inst.name} onChange={(name) => patchInst({ name })} />
        <ColorField label="Tint override" value={inst.color ?? "#888888"} onChange={(color) => patchInst({ color })} />
      </Section>

      <Section title="Position & rotation">
        {inst.parentId && <div className="text-xs text-zinc-500">Offsets are relative to the parent. World: {formatLength(wp.x, unit)}, {formatLength(wp.y, unit)}</div>}
        <LengthField label={inst.parentId ? "Offset X" : "X (center)"} value={inst.placement.x} disabled={dis} onChange={(x) => patchPlace({ x })} />
        <LengthField label={inst.parentId ? "Offset Y" : "Y (center)"} value={inst.placement.y} disabled={dis} onChange={(y) => patchPlace({ y })} />
        <LengthField label={isWall || inst.parentId ? "Height above floor" : "Elevation"} value={inst.placement.z} disabled={dis} onChange={(z) => patchPlace({ z })} />
        <NumberField label="Rotation" suffix="°" value={inst.placement.rotation} step={15} disabled={dis} onChange={(r) => patchPlace({ rotation: ((r % 360) + 360) % 360 })} />
        <div className="flex flex-wrap gap-1 pt-1">
          <button className={smallBtn} disabled={dis} onClick={() => patchPlace({ rotation: (inst.placement.rotation + 90) % 360 })}>Rotate 90°</button>
          {!isWall && !inst.parentId && <>
            <button className={smallBtn} disabled={dis} onClick={() => commit((s) => centerInRoom(s, inst.id, "both"))}>Center in room</button>
            <button className={smallBtn} disabled={dis} onClick={() => commit((s) => centerInRoom(s, inst.id, "x"))}>Center X</button>
            <button className={smallBtn} disabled={dis} onClick={() => commit((s) => centerInRoom(s, inst.id, "y"))}>Center Y</button>
            {(["north", "east", "south", "west"] as WallId[]).map((w) => <button key={w} className={smallBtn} disabled={dis} onClick={() => commit((s) => alignToWall(s, inst.id, w))}>→ {w}</button>)}
          </>}
        </div>
        {isWall && (
          <SelectField label="Mounted on wall" value={inst.placement.wall ?? "north"} options={["north", "east", "south", "west"].map((w) => ({ value: w, label: w }))} onChange={(w) => commit((s) => updatePlacement(s, inst.id, wallMount(s, inst, w as WallId)))} />
        )}
      </Section>

      {!isWall && (inst.type === "barbell" || mountTargets.length > 0) && (
        <Section title="Mounting" defaultOpen={inst.type === "barbell"}>
          <SelectField label="Placed on" value={inst.parentId ?? ""} options={[{ value: "", label: "Floor" }, ...mountTargets.filter((t) => t.type !== "stall-mat").map((t) => ({ value: t.id, label: `${t.name} (${getDef(t.type)?.label ?? t.type})` }))]} onChange={(v) => commit((s) => mountTo(s, inst.id, v || null))} />
          {inst.parentId && <div className="text-[11px] text-zinc-500">Mounted objects move with their parent and are exempt from overlap warnings against it.</div>}
        </Section>
      )}

      {def && (
        <Section title="Configuration">
          {def.presets && def.presets.length > 0 && (
            <SelectField label="Preset" value="" options={[{ value: "", label: "Apply preset…" }, ...def.presets.map((p) => ({ value: p.id, label: p.label }))]} onChange={(id) => { const p = def.presets!.find((x) => x.id === id); if (p) patchConfig(p.config as Record<string, unknown>); }} />
          )}
          <ConfigFields fields={def.fields} config={inst.config as Record<string, unknown>} onChange={patchConfig} disabled={dis} />
        </Section>
      )}

      {inst.type === "power-rack" && <RackExtras inst={inst} patch={patchConfig} />}
      {inst.type === "barbell" && <PlatesEditor inst={inst} patch={patchConfig} />}
      {inst.type === "pegboard" && <PegAccessories inst={inst} patch={patchConfig} />}

      <Section title="Clearance zone" defaultOpen={inst.clearance.enabled}>
        <BoolField label="Show clearance" value={inst.clearance.enabled} onChange={(enabled) => patchInst({ clearance: { ...inst.clearance, enabled } })} />
        <TextField label="Label" value={inst.clearance.label ?? ""} onChange={(label) => patchInst({ clearance: { ...inst.clearance, label } })} />
        {(["front", "back", "left", "right"] as const).map((k) => <LengthField key={k} label={k[0].toUpperCase() + k.slice(1)} value={inst.clearance[k]} min={0} onChange={(v) => patchInst({ clearance: { ...inst.clearance, [k]: v } })} />)}
        <p className="text-[11px] text-zinc-500">Front is the +Y side of the object (the tick on its selection box); for barbells, left/right are the sleeve ends. These are your own planning margins, not safety standards.</p>
      </Section>

      {meta.length > 0 && (
        <Section title="Info">{meta.map((m) => <div key={m.label} className="flex justify-between text-xs"><span className="text-zinc-500">{m.label}</span><span>{m.value}</span></div>)}</Section>
      )}

      <div className="flex flex-wrap gap-1 pt-3">
        <button className={smallBtn} onClick={() => useStore.getState().duplicateSelected()}>Duplicate</button>
        <button className={smallBtn} onClick={() => commit((s) => groupInstances(s, useStore.getState().selection))}>Group</button>
        <button className={smallBtn} onClick={() => commit((s) => ungroupInstances(s, useStore.getState().selection))}>Ungroup</button>
        <button className="rounded border border-red-300 px-2 py-0.5 text-xs text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950" onClick={() => useStore.getState().deleteSelected()} disabled={dis}>Delete</button>
      </div>
    </div>
  );
}

function ListHeader({ title, onAdd }: { title: string; onAdd: () => void }) {
  return <div className="flex items-center justify-between pt-1"><span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{title}</span><button className={smallBtn} onClick={onAdd}>+ Add</button></div>;
}
const rm = "text-xs text-red-600 hover:underline";

function RackExtras({ inst, patch }: { inst: EquipmentInstance; patch: (p: Record<string, unknown>) => void }) {
  const c = inst.config as unknown as RackConfig;
  const upd = <K extends "crossmembers" | "pullupBars" | "safeties" | "jcups">(k: K, i: number, p: Partial<RackConfig[K][number]>) => patch({ [k]: c[k].map((x, j) => (j === i ? { ...x, ...p } : x)) });
  const del = (k: "crossmembers" | "pullupBars" | "safeties" | "jcups", i: number) => patch({ [k]: c[k].filter((_, j) => j !== i) });
  return (
    <Section title="Components">
      <ListHeader title={`Crossmembers (${c.crossmembers.length})`} onAdd={() => patch({ crossmembers: [...c.crossmembers, { id: newId("cm"), axis: "x", z: c.uprightHeight / 2, at: 0 }] })} />
      {c.crossmembers.map((m, i) => (
        <div key={m.id} className="space-y-1 rounded border border-zinc-200 p-1.5 dark:border-zinc-800">
          <div className="flex gap-1">
            <select className="rounded border border-zinc-300 bg-transparent text-xs dark:border-zinc-700" value={m.axis} onChange={(e) => upd("crossmembers", i, { axis: e.target.value as "x" | "y" })}><option value="x">Across width</option><option value="y">Front-to-back</option></select>
            <button className={`${rm} ml-auto`} onClick={() => del("crossmembers", i)}>Remove</button>
          </div>
          <LengthField label="Height (z)" value={m.z} onChange={(z) => upd("crossmembers", i, { z })} />
          <LengthField label={m.axis === "x" ? "Position (depth)" : "Position (width)"} value={m.at} onChange={(at) => upd("crossmembers", i, { at })} />
          <LengthField label="Length override" value={m.length ?? 0} min={0} hint="0 = automatic span between posts" onChange={(len) => upd("crossmembers", i, { length: len > 0 ? len : undefined })} />
        </div>
      ))}
      <ListHeader title={`Pull-up bars (${c.pullupBars.length})`} onAdd={() => patch({ pullupBars: [...c.pullupBars, { id: newId("pu"), at: c.depth / 2, z: c.uprightHeight - fromInches(4), diameter: fromInches(1.25) }] })} />
      {c.pullupBars.map((b, i) => (
        <div key={b.id} className="space-y-1 rounded border border-zinc-200 p-1.5 dark:border-zinc-800">
          <LengthField label="Position (depth)" value={b.at} onChange={(at) => upd("pullupBars", i, { at })} />
          <LengthField label="Height (z)" value={b.z} onChange={(z) => upd("pullupBars", i, { z })} />
          <LengthField label="Diameter" value={b.diameter} onChange={(diameter) => upd("pullupBars", i, { diameter })} />
          <button className={rm} onClick={() => del("pullupBars", i)}>Remove</button>
        </div>
      ))}
      <ListHeader title={`Safeties (${c.safeties.length})`} onAdd={() => patch({ safeties: [...c.safeties, { id: newId("sf"), z: fromInches(26), kind: "pin-pipe", reach: fromInches(2) }] })} />
      {c.safeties.map((s, i) => (
        <div key={s.id} className="space-y-1 rounded border border-zinc-200 p-1.5 dark:border-zinc-800">
          <SelectField label="Type" value={s.kind} options={[{ value: "pin-pipe", label: "Pin & pipe safety" }, { value: "spotter-arm", label: "Spotter arm" }]} onChange={(kind) => upd("safeties", i, { kind: kind as "pin-pipe" | "spotter-arm" })} />
          <LengthField label="Height (z)" value={s.z} onChange={(z) => upd("safeties", i, { z })} />
          <LengthField label="Reach past front" value={s.reach} onChange={(reach) => upd("safeties", i, { reach })} />
          <button className={rm} onClick={() => del("safeties", i)}>Remove</button>
        </div>
      ))}
      <ListHeader title={`J-cups (${c.jcups.length} pair)`} onAdd={() => patch({ jcups: [...c.jcups, { id: newId("jc"), z: fromInches(50) }] })} />
      {c.jcups.map((j, i) => (
        <div key={j.id} className="flex items-center gap-2"><LengthField label="Height (z)" value={j.z} onChange={(z) => upd("jcups", i, { z })} /><button className={rm} onClick={() => del("jcups", i)}>✕</button></div>
      ))}
    </Section>
  );
}

function PlatesEditor({ inst, patch }: { inst: EquipmentInstance; patch: (p: Record<string, unknown>) => void }) {
  const plates = (inst.config as { plates: PlateGroup[] }).plates;
  const used = plates.reduce((s, g) => s + g.count * g.thickness, 0);
  const sleeve = (inst.config as { sleeveLength: number }).sleeveLength;
  const unit = useStore.getState().settings.displayUnit;
  return (
    <Section title="Plates (per sleeve)">
      <div className="flex gap-1">
        <select className="min-w-0 flex-1 rounded border border-zinc-300 bg-transparent text-xs dark:border-zinc-700" id="plate-preset" defaultValue={0}>
          {PLATE_PRESETS.map((p, i) => <option key={i} value={i}>{plateLabel(p)} ({p.diameter}×{p.thickness} mm)</option>)}
        </select>
        <button className={smallBtn} onClick={() => { const i = Number((document.getElementById("plate-preset") as HTMLSelectElement).value); patch({ plates: [...plates, newPlateGroup(PLATE_PRESETS[i], 1)] }); }}>+ Add</button>
      </div>
      {plates.map((g, i) => (
        <div key={g.id} className="space-y-1 rounded border border-zinc-200 p-1.5 dark:border-zinc-800">
          <div className="flex items-center justify-between text-xs"><span className="font-medium">{plateLabel(g)}</span><button className={rm} onClick={() => patch({ plates: plates.filter((_, j) => j !== i) })}>Remove</button></div>
          <NumberField label="Count" value={g.count} min={0} max={30} integer onChange={(count) => patch({ plates: plates.map((x, j) => (j === i ? { ...x, count } : x)) })} />
          <NumberField label="Weight" suffix="kg" value={g.weightKg} min={0.1} onChange={(weightKg) => patch({ plates: plates.map((x, j) => (j === i ? { ...x, weightKg } : x)) })} />
          <LengthField label="Diameter" value={g.diameter} min={50} onChange={(diameter) => patch({ plates: plates.map((x, j) => (j === i ? { ...x, diameter } : x)) })} />
          <LengthField label="Thickness" value={g.thickness} min={3} onChange={(thickness) => patch({ plates: plates.map((x, j) => (j === i ? { ...x, thickness } : x)) })} />
          <ColorField label="Color" value={g.color} onChange={(color) => patch({ plates: plates.map((x, j) => (j === i ? { ...x, color } : x)) })} />
        </div>
      ))}
      <div className="text-xs text-zinc-500">Stack: {formatLength(used, unit)} of {formatLength(sleeve, unit)} sleeve · {groupsWeight(plates) * 2} kg plates ({kgToLbStr(groupsWeight(plates) * 2)})</div>
    </Section>
  );
}

function PegAccessories({ inst, patch }: { inst: EquipmentInstance; patch: (p: Record<string, unknown>) => void }) {
  const c = inst.config as unknown as PegboardConfig;
  const g = pegGrid(c);
  return (
    <Section title="Accessories">
      <div className="flex flex-wrap gap-1">
        {(Object.keys(ACCESSORY_DIMS) as AccessoryKind[]).map((k) => <button key={k} className={smallBtn} onClick={() => patch({ accessories: [...c.accessories, newAccessory(k, Math.min(g.cols - 1, 3 + c.accessories.length * 3), Math.max(0, g.rows - 6))] })}>+ {ACCESSORY_DIMS[k].label}</button>)}
      </div>
      {c.accessories.map((a, i) => (
        <div key={a.id} className="space-y-1 rounded border border-zinc-200 p-1.5 dark:border-zinc-800">
          <div className="flex items-center justify-between text-xs"><span className="font-medium">{ACCESSORY_DIMS[a.kind].label} ({ACCESSORY_DIMS[a.kind].w}×{ACCESSORY_DIMS[a.kind].h} mm)</span><button className={rm} onClick={() => patch({ accessories: c.accessories.filter((_, j) => j !== i) })}>Remove</button></div>
          <NumberField label={`Column (0–${g.cols - 1})`} value={a.col} min={0} max={g.cols - 1} integer onChange={(col) => patch({ accessories: c.accessories.map((x, j) => (j === i ? { ...x, col } : x)) })} />
          <NumberField label={`Row (0–${g.rows - 1})`} value={a.row} min={0} max={g.rows - 1} integer onChange={(row) => patch({ accessories: c.accessories.map((x, j) => (j === i ? { ...x, row } : x)) })} />
        </div>
      ))}
    </Section>
  );
}
void allDefs;
