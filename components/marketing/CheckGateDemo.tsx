"use client";
import { useId, useMemo, useState } from "react";
import { evaluateStageGate, type GateCheck, type GateResult } from "@/lib/releaseops/deploymentCheckGate";

/** Synthetic, client-only example of the deployment check gate. Uses the same rule as the product. */
const COMMIT = "4f1c2d9e8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d";
const CHECKS: GateCheck[] = [
  { key: "migration-dry-run", name: "Migration dry run", kind: "migration_dry_run", stage: "validate", mode: "blocking", enabled: true, version: 3 },
  { key: "smoke-staging", name: "Smoke test on staging", kind: "smoke_test", stage: "validate", mode: "blocking", enabled: true, version: 1 },
  { key: "change-approval", name: "Change approval checklist", kind: "manual_checklist", stage: "approve", mode: "blocking", enabled: true, version: 2 },
];
type Choice = "passed" | "failed" | "none" | "old_version";
const LABEL: Record<Choice, string> = { passed: "Passed", failed: "Failed", none: "No result", old_version: "Passed on an older check version" };
const REASON: Record<string, string> = { no_result: "no result for this commit", failed: "failed", stale_version: "ran an older version of the check", expired: "result is too old" };

export function CheckGateDemo() {
  const id = useId();
  const [choices, setChoices] = useState<Record<string, Choice>>({ "migration-dry-run": "passed", "smoke-staging": "passed", "change-approval": "none" });
  const outcome = useMemo(() => {
    const now = new Date("2026-11-26T12:00:00Z");
    const results: GateResult[] = CHECKS.flatMap((c) => {
      const choice = choices[c.key];
      if (choice === "none") return [];
      return [{ checkKey: c.key, checkVersion: choice === "old_version" ? c.version - 1 || 0 : c.version, status: choice === "failed" ? "failed" : "passed", releaseRef: COMMIT, reportedAt: new Date("2026-11-26T11:30:00Z") }];
    });
    return evaluateStageGate({ checks: CHECKS, results, startingStage: "deploy", commitSha: COMMIT, now });
  }, [choices]);
  return (
    <div className="mt-6 rounded-xl border border-white/10 bg-[#111111] p-5" aria-labelledby={`${id}-title`}>
      <p id={`${id}-title`} className="text-sm font-medium text-zinc-100">Try it: can this commit deploy?</p>
      <p className="mt-1 text-xs leading-5 text-zinc-400">Synthetic example for commit <span className="font-mono">{COMMIT.slice(0, 7)}</span>. Set what CI and reviewers reported, and see the same rule V19 applies before dispatch.</p>
      <ul className="mt-4 space-y-3">
        {CHECKS.map((c) => (
          <li key={c.key} className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm text-zinc-200">{c.name} <span className="text-xs text-zinc-400">· {c.stage === "approve" ? "Approve" : "Validate"} · blocking</span></span>
            <label className="text-xs text-zinc-400"><span className="sr-only">Result for {c.name}</span>
              <select value={choices[c.key]} onChange={(e) => setChoices({ ...choices, [c.key]: e.target.value as Choice })} className="rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-zinc-100">
                {(Object.keys(LABEL) as Choice[]).map((k) => <option key={k} value={k}>{LABEL[k]}</option>)}
              </select>
            </label>
          </li>))}
      </ul>
      <div aria-live="polite" className={`mt-4 rounded-lg border p-3 text-sm ${outcome.ok ? "border-emerald-400/30 bg-emerald-400/5 text-emerald-200" : "border-amber-400/30 bg-amber-400/5 text-amber-200"}`}>
        {outcome.ok ? "Deployment can be dispatched: every blocking check passed for this commit at its current version." : (
          <><p>Deployment is refused. Nothing is dispatched.</p>
            <ul className="mt-1 list-disc pl-5 text-xs">{outcome.blocked.map((b) => <li key={b.key}>{b.name}: {REASON[b.reason]}</li>)}</ul></>)}
      </div>
    </div>);
}
