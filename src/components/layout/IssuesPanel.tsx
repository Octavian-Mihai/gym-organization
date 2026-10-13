"use client";
import { useMemo } from "react";
import { validateSceneCached } from "@/lib/geometry/validation";
import { useStore } from "@/lib/store/useStore";

const KIND_LABEL = { physical: "Physical intersection", clearance: "Insufficient clearance", outside: "Outside room", opening: "Door / window", ceiling: "Ceiling", "wall-mount": "Wall mount", obstacle: "Wall obstacle", "mounted-ok": "Mounted" } as const;

export function IssuesList() {
  const scene = useStore((s) => s.scene);
  const issues = useMemo(() => validateSceneCached(scene), [scene]);
  return (
    <div className="max-h-80 space-y-1 overflow-y-auto">
      {issues.length === 0 && <div className="px-1 py-2 text-sm text-emerald-700 dark:text-emerald-400">No geometric conflicts found.</div>}
      {issues.map((i) => (
        <button key={i.id} className={`block w-full rounded border px-2 py-1 text-left text-xs ${i.severity === "error" ? "border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200" : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200"}`}
          onClick={() => { useStore.getState().select(i.objectIds); useStore.getState().setFocusIssue(i.id); }}>
          <div className="font-semibold">{KIND_LABEL[i.kind]}</div>
          {i.message}
        </button>
      ))}
      <p className="pt-1 text-[11px] leading-snug text-zinc-500">These checks only find geometric conflicts. No warnings does <b>not</b> mean a layout is safe or comfortable.</p>
    </div>
  );
}
