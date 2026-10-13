"use client";
import { useMemo, useState } from "react";
import { allDefs } from "@/lib/equipment/registry";
import { addMatGrid } from "@/lib/store/scene-ops";
import { useStore } from "@/lib/store/useStore";
import { matDef } from "@/lib/equipment/mat";
import { NumberField, SelectField } from "../ui/fields";
import { dimsOf } from "@/lib/geometry/world";
import { createInstance } from "@/lib/scene/factory";
import { formatLength } from "@/lib/units";

export function Library() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const addEquipment = useStore((s) => s.addEquipment);
  const unit = useStore((s) => s.settings.displayUnit);
  const defs = allDefs();
  const grouped = useMemo(() => {
    const m: Record<string, typeof defs> = {};
    for (const d of defs) if (!q || `${d.label} ${d.category} ${d.description ?? ""}`.toLowerCase().includes(q.toLowerCase())) (m[d.category] ||= []).push(d);
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, defs.length]);

  return (
    <div className="flex h-full flex-col">
      <div className="p-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search equipment…" className="w-full rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-900" />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {Object.entries(grouped).map(([cat, list]) => (
          <div key={cat} className="mb-1">
            <button className="flex w-full items-center justify-between py-1 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500" onClick={() => setOpen((o) => ({ ...o, [cat]: o[cat] === false }))}>
              {cat}<span>{open[cat] === false ? "▸" : "▾"}</span>
            </button>
            {open[cat] !== false && list.map((d) => {
              const dm = dimsOf(createInstance(d.type));
              return (
                <div key={d.type} draggable onDragStart={(e) => { e.dataTransfer.setData("application/x-gym-type", d.type); e.dataTransfer.effectAllowed = "copy"; }}
                  className="group mb-1 flex cursor-grab items-center justify-between rounded border border-zinc-200 bg-white px-2 py-1.5 hover:border-blue-400 dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="min-w-0">
                    <div className="truncate text-sm">{d.label}</div>
                    <div className="truncate font-mono text-[10px] text-zinc-500">{formatLength(dm.width, unit)} × {formatLength(dm.depth, unit)} × {formatLength(dm.height, unit)}</div>
                  </div>
                  <button className="ml-2 rounded bg-blue-600 px-2 py-0.5 text-xs text-white hover:bg-blue-700" onClick={() => addEquipment(d.type)}>Add</button>
                </div>
              );
            })}
          </div>
        ))}
        {Object.keys(grouped).length === 0 && <div className="p-4 text-center text-sm text-zinc-500">No equipment matches “{q}”.</div>}
        <MatLayoutTool />
      </div>
    </div>
  );
}

function MatLayoutTool() {
  const [rows, setRows] = useState(2);
  const [cols, setCols] = useState(3);
  const [preset, setPreset] = useState(matDef.presets![0].id);
  const [rot, setRot] = useState("0");
  const commit = useStore((s) => s.commit);
  return (
    <div className="mt-3 rounded border border-zinc-200 p-2 dark:border-zinc-800">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Mat layout tool</div>
      <div className="space-y-1.5">
        <SelectField label="Mat size" value={preset} options={matDef.presets!.map((p) => ({ value: p.id, label: p.label }))} onChange={setPreset} />
        <NumberField label="Rows" value={rows} min={1} max={20} integer onChange={setRows} />
        <NumberField label="Columns" value={cols} min={1} max={20} integer onChange={setCols} />
        <SelectField label="Orientation" value={rot} options={[{ value: "0", label: "Long side along X" }, { value: "90", label: "Long side along Y" }]} onChange={setRot} />
        <button className="w-full rounded bg-zinc-800 px-2 py-1.5 text-xs text-white hover:bg-zinc-700 dark:bg-zinc-200 dark:text-zinc-900" onClick={() => {
          const p = matDef.presets!.find((x) => x.id === preset)!;
          let ids: string[] = [];
          commit((s) => { const r = addMatGrid(s, { rows, cols, preset: p.config, originX: 0, originY: 0, rotation: Number(rot) }); ids = r.newIds; return r.scene; });
          useStore.getState().select(ids);
        }}>Create {rows * cols} mats from the top-left corner</button>
        <p className="text-[11px] text-zinc-500">Each mat is an independent object you can move, rotate, resize or delete afterwards.</p>
      </div>
    </div>
  );
}
