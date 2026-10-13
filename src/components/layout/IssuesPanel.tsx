"use client";
import { useMemo } from "react";
import { validateScene } from "@/lib/geometry/validation";
import { useStore } from "@/lib/store/useStore";

const KIND_LABEL = { physical: "Physical intersection", clearance: "Insufficient clearance", outside: "Outside room", opening: "Door / window", ceiling: "Ceiling", "wall-mount": "Wall mount", obstacle: "Wall obstacle", "mounted-ok": "Mounted" } as const;

export function IssuesPanel() {
  const scene = useStore((s) => s.scene);
  const issues = useMemo(() => validateScene(scene), [scene]);
  const errors = issues.filter((i) => i.severity === "error").length;
  return (
    <details className="border-t border-zinc-200 dark:border-zinc-800" open={issues.length > 0}>
      <summary className="flex cursor-pointer select-none items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
        <span>Checks</span>
        <span className={`rounded-full px-2 py-0.5 text-[11px] normal-case ${errors ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300" : issues.length ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"}`}>{issues.length ? `${issues.length} issue${issues.length > 1 ? "s" : ""}` : "no warnings"}</span>
      </summary>
      <div className="max-h-56 space-y-1 overflow-y-auto px-3 pb-3">
        {issues.map((i) => (
          <button key={i.id} className={`block w-full rounded border px-2 py-1 text-left text-xs ${i.severity === "error" ? "border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200" : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200"}`}
            onClick={() => { useStore.getState().select(i.objectIds); useStore.getState().setFocusIssue(i.id); }}>
            <div className="font-semibold">{KIND_LABEL[i.kind]}</div>
            {i.message}
          </button>
        ))}
        <p className="pt-1 text-[11px] leading-snug text-zinc-500">These checks find geometric conflicts only. A layout with no warnings is <b>not</b> guaranteed to be safe or comfortable — always check real-world spacing yourself.</p>
      </div>
    </details>
  );
}
