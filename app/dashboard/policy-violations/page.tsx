"use client";

/**
 * /dashboard/policy-violations — Phase 477.
 * Inbox of PolicyViolation rows: status + severity + rule + release ref.
 */

import { useEffect, useState } from "react";
import {
  ShieldExclamationIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { PageIntro } from "@/components/dashboard/PageIntro";

type Status = "open" | "exception_pending" | "exception_granted" | "resolved" | "unknown";
type Severity = "advisory" | "warning" | "blocker" | "unknown";

interface Row {
  id: string;
  releaseId: string;
  ruleKey: string;
  ruleLabel: string;
  severity: Severity;
  blocking: boolean;
  exceptionAllowed: boolean;
  status: Status;
  message: string;
  remediation: string | null;
  detectedAtIso: string;
  exceptionGrantedByUserId: string | null;
  exceptionGrantedAtIso: string | null;
}

interface DigestData {
  generatedAt: string;
  violations: Row[];
  summary: {
    total: number;
    byStatus: Record<Status, number>;
    bySeverity: Record<Severity, number>;
    blockingOpen: number;
  };
}

type RespBody =
  | { ok: true; data: DigestData }
  | { ok: false; error: string; hint?: string };

const STATUS_CLASS: Record<Status, string> = {
  open:               "bg-rose-500/15 text-rose-300 border-rose-500/25",
  exception_pending:  "bg-amber-500/15 text-amber-300 border-amber-500/25",
  exception_granted:  "bg-violet-500/15 text-violet-300 border-violet-500/25",
  resolved:           "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  unknown:            "bg-zinc-700/40 text-zinc-300 border-zinc-700/40",
};

const SEVERITY_CLASS: Record<Severity, string> = {
  blocker:  "bg-rose-500/15 text-rose-300 border-rose-500/25",
  warning:  "bg-amber-500/15 text-amber-300 border-amber-500/25",
  advisory: "bg-zinc-700/40 text-zinc-300 border-zinc-700/40",
  unknown:  "bg-zinc-700/40 text-zinc-300 border-zinc-700/40",
};

export default function PolicyViolationsPage() {
  const [resp, setResp] = useState<RespBody | null>(null);
  const [loading, setLoading] = useState(true);
  const [networkError, setNetworkError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard/policy-violation-list", { credentials: "include" })
      .then((r) => r.json())
      .then((j: RespBody) => { if (!cancelled) setResp(j); })
      .catch((e) => { if (!cancelled) setNetworkError(e instanceof Error ? e.message : "Network error."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const data = resp?.ok ? resp.data : null;
  const errorBody = resp && !resp.ok ? resp : null;

  return (
    <div className="relative">
      <PageIntro
        kicker={`ReleaseOps · policy violations${data ? ` · ${data.summary.total} on file` : ""}`}
        title={<>Every rule. <span className="text-zinc-500">Every miss tracked.</span></>}
        description="Output of the Phase 443 policy engine. Each blocker stops a release; warnings + advisories show what's drifting before it becomes a problem."
        helps="See which releases are blocked on which rules, and which exceptions are open."
        connectFirst="Connect Git + CI/CD + a ticket tracker so the engine has full context."
        engineers={["Release Captain", "Compliance", "Security"]}
        requiresApproval="Granting an exception requires the rule's approverRole."
        actions={[
          { label: "Releases",      href: "/dashboard/releases" },
          { label: "Cherry-picks",  href: "/dashboard/cherry-picks" },
        ]}
        safetyNote="Read-only · per-org isolation · 4-status closed-union"
      />

      {loading && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6 text-[12px] text-zinc-400">
          Loading policy violations…
        </div>
      )}

      {!loading && networkError && (
        <div className="rounded-2xl border border-rose-500/[0.18] bg-rose-500/[0.04] p-5 mb-6 text-[13px] text-zinc-300">
          {networkError}
        </div>
      )}

      {!loading && errorBody?.error === "migration_pending" && (
        <div className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 mb-6">
          <div className="flex items-center gap-2 mb-1">
            <ExclamationTriangleIcon className="h-4 w-4 text-amber-300" />
            <p className="text-[12px] font-semibold text-amber-200">Schema migration pending</p>
          </div>
          <p className="text-[12.5px] text-zinc-300">{errorBody.hint}</p>
        </div>
      )}

      {!loading && errorBody?.error === "auth_required" && (
        <div className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 mb-6 text-[13px] text-zinc-300">
          Sign in required.
        </div>
      )}

      {data && (
        <>
          <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat icon={ShieldExclamationIcon} label="Blocking · open" value={String(data.summary.blockingOpen)} tone={data.summary.blockingOpen > 0 ? "rose" : "zinc"} />
            <Stat icon={ClockIcon}             label="Exception pending" value={String(data.summary.byStatus.exception_pending)} tone={data.summary.byStatus.exception_pending > 0 ? "amber" : "zinc"} />
            <Stat icon={CheckCircleIcon}       label="Exception granted" value={String(data.summary.byStatus.exception_granted)} tone={data.summary.byStatus.exception_granted > 0 ? "violet" : "zinc"} />
            <Stat icon={CheckCircleIcon}       label="Resolved"        value={String(data.summary.byStatus.resolved)}          tone={data.summary.byStatus.resolved > 0 ? "emerald" : "zinc"} />
          </div>

          {data.violations.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center text-[13px] text-zinc-400">
              No policy violations on file. Clean releases all around.
            </div>
          ) : (
            <div className="space-y-3 mb-8">
              {data.violations.map((v) => (
                <div key={v.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className={`text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border shrink-0 ${SEVERITY_CLASS[v.severity]}`}>
                        {v.severity}
                      </span>
                      <span className={`text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border shrink-0 ${STATUS_CLASS[v.status]}`}>
                        {v.status.replace("_", " ")}
                      </span>
                      <p className="text-[13px] font-semibold text-white truncate">{v.ruleLabel}</p>
                      <span className="text-[10px] font-mono text-zinc-500">{v.ruleKey}</span>
                    </div>
                    {v.blocking && (
                      <span className="text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-300 border border-rose-500/25 shrink-0">
                        blocking
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] text-zinc-300 mb-1.5 whitespace-pre-wrap">{v.message}</p>
                  {v.remediation && (
                    <p className="text-[11.5px] text-violet-300 italic mb-1.5">→ {v.remediation}</p>
                  )}
                  <div className="flex items-center gap-3 text-[10px] font-mono text-zinc-500 flex-wrap">
                    <span>release {v.releaseId.slice(0, 12)}</span>
                    <span>· detected {new Date(v.detectedAtIso).toLocaleString()}</span>
                    {v.exceptionGrantedAtIso && (
                      <span>· exception by {v.exceptionGrantedByUserId} at {new Date(v.exceptionGrantedAtIso).toLocaleString()}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value, tone }: { icon: typeof ShieldExclamationIcon; label: string; value: string; tone: "violet" | "emerald" | "amber" | "rose" | "zinc" }) {
  const cls = {
    violet:  "border-violet-500/[0.18] bg-violet-500/[0.03] text-violet-200",
    emerald: "border-emerald-500/[0.18] bg-emerald-500/[0.03] text-emerald-200",
    amber:   "border-amber-500/[0.18] bg-amber-500/[0.03] text-amber-200",
    rose:    "border-rose-500/[0.18] bg-rose-500/[0.03] text-rose-200",
    zinc:    "border-white/[0.06] bg-white/[0.02] text-zinc-200",
  }[tone];
  return (
    <div className={`rounded-xl border ${cls} p-3`}>
      <p className="text-[9px] font-mono uppercase tracking-wider opacity-70">{label}</p>
      <div className="flex items-center gap-2 mt-1">
        <Icon className="h-4 w-4 opacity-80" />
        <p className="text-[20px] font-bold">{value}</p>
      </div>
    </div>
  );
}
