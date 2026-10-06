"use client";

/**
 * Client-side form that posts a policy override to
 * /api/workforce/[id]/policy. Renders the 5 approval-rule options with
 * tightening rails — loosening choices are disabled at the UI level and
 * rejected at the API boundary by canTightenApprovalRule().
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircleIcon, ExclamationTriangleIcon, ArrowPathIcon } from "@heroicons/react/24/outline";
import { canTightenApprovalRule } from "@/lib/workforce/runtimeActionGate";
import type { ApprovalRule } from "@/lib/workforce/agentWorkforceRegistry";

const RULE_OPTIONS: readonly ApprovalRule[] = [
  "no_approval_needed",
  "single_approver",
  "two_step_approval",
  "incident_commander_only",
  "blocked_always",
];

const RULE_LABEL: Record<ApprovalRule, string> = {
  no_approval_needed:      "Auto-OK (no approval)",
  single_approver:         "Single approval",
  two_step_approval:       "Two-step approval",
  incident_commander_only: "Incident commander only",
  blocked_always:          "Policy-blocked",
};

interface Props {
  engineerId: string;
  canonical: ApprovalRule;
  initialRule: ApprovalRule;
  initialEnabled: boolean;
}

type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; overrideActive: boolean }
  | { kind: "error"; message: string };

export function PolicyOverrideForm({ engineerId, canonical, initialRule, initialEnabled }: Props) {
  const router = useRouter();
  const [rule, setRule] = useState<ApprovalRule>(initialRule);
  const [isEnabled, setIsEnabled] = useState<boolean>(initialEnabled);
  const [state, setState] = useState<SaveState>({ kind: "idle" });

  async function save() {
    if (!canTightenApprovalRule(canonical, rule)) {
      setState({ kind: "error", message: "Cannot loosen below the canonical baseline." });
      return;
    }
    setState({ kind: "saving" });
    try {
      const res = await fetch(`/api/workforce/${engineerId}/policy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ rule, isEnabled }),
      });
      const json = (await res.json()) as { ok?: boolean; overrideActive?: boolean; reason?: string; detail?: string };
      if (!res.ok || !json.ok) {
        setState({ kind: "error", message: json.detail ?? json.reason ?? `HTTP ${res.status}` });
        return;
      }
      setState({ kind: "saved", overrideActive: !!json.overrideActive });
      router.refresh();
    } catch (err) {
      setState({ kind: "error", message: err instanceof Error ? err.message : "Network error" });
    }
  }

  return (
    <div>
      <header className="mb-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">Current rule</p>
        <p className="text-[14px] font-semibold text-white mt-1">{RULE_LABEL[rule]}</p>
        {rule === canonical && (
          <p className="text-[10px] font-mono text-zinc-500 mt-0.5">canonical default in force</p>
        )}
        {rule !== canonical && (
          <p className="text-[10px] font-mono text-zinc-300 mt-0.5">workspace override active · tighter than canonical</p>
        )}
      </header>

      <div className="grid gap-2">
        {RULE_OPTIONS.map((option) => {
          const allowed = canTightenApprovalRule(canonical, option);
          const isSelected = option === rule;
          return (
            <label
              key={option}
              className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 ${
                isSelected
                  ? "border-violet-500/40 bg-violet-500/[0.05] cursor-pointer"
                  : allowed
                    ? "border-white/[0.06] bg-white/[0.01] cursor-pointer hover:border-white/[0.12]"
                    : "border-rose-500/15 bg-rose-500/[0.03] opacity-70 cursor-not-allowed"
              }`}
            >
              <div>
                <p className="text-[12.5px] font-semibold text-white">{RULE_LABEL[option]}</p>
                <p className="text-[10.5px] text-zinc-500 mt-0.5">
                  {!allowed
                    ? "Loosening below the canonical baseline — not allowed."
                    : isSelected
                      ? "Currently in force in this workspace."
                      : "Tightening allowed."}
                </p>
              </div>
              <input
                type="radio"
                name="rule"
                value={option}
                checked={isSelected}
                disabled={!allowed}
                onChange={() => setRule(option)}
                className="accent-violet-500"
              />
            </label>
          );
        })}
      </div>

      <div className="mt-5 flex items-center justify-between gap-3 flex-wrap">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isEnabled}
            onChange={(e) => setIsEnabled(e.target.checked)}
            className="accent-violet-500"
          />
          <span className="text-[12px] text-zinc-300">Engineer enabled in this workspace</span>
        </label>
        <button
          onClick={save}
          disabled={state.kind === "saving"}
          className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg bg-violet-500/15 text-violet-100 border border-violet-500/30 hover:bg-violet-500/25 transition disabled:opacity-60"
        >
          {state.kind === "saving" ? (
            <>
              <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <CheckCircleIcon className="h-3.5 w-3.5" />
              Save policy
            </>
          )}
        </button>
      </div>

      {state.kind === "saved" && (
        <div className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] px-3 py-2">
          <p className="text-[11px] font-semibold text-emerald-200 inline-flex items-center gap-1.5">
            <CheckCircleIcon className="h-3.5 w-3.5" />
            Saved · audit row written · runtime gate updated.
          </p>
        </div>
      )}
      {state.kind === "error" && (
        <div className="mt-3 rounded-lg border border-rose-500/20 bg-rose-500/[0.04] px-3 py-2">
          <p className="text-[11px] font-semibold text-rose-200 inline-flex items-center gap-1.5">
            <ExclamationTriangleIcon className="h-3.5 w-3.5" />
            {state.message}
          </p>
        </div>
      )}
    </div>
  );
}
