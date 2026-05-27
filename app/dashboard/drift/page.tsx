"use client";

/**
 * /dashboard/drift — Phase 485.
 * Inbox of drift findings (declared vs observed state).
 */

import { useEffect, useState } from "react";
import {
  ExclamationTriangleIcon,
  ServerStackIcon,
  ShieldExclamationIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";
import { PageIntro } from "@/components/dashboard/PageIntro";

type Status = "open" | "acknowledged" | "suppressed" | "resolved" | "unknown";
type Severity = "low" | "medium" | "high" | "critical" | "unknown";

interface Row {
  id: string;
  resourceKind: string;
  resourceId: string;
  displayName: string;
  applicationId: string | null;
  environmentTier: string | null;
  severity: Severity;
  status: Status;
  summary: string;
  remediationKey: string | null;
  decidedByUserId: string | null;
  decidedAtIso: string | null;
  decisionReason: string | null;
  detectedAtIso: string;
  lastSeenAtIso: string;
}

interface DigestData {
  generatedAt: string;
  findings: Row[];
  summary: {
    total: number;
    byStatus: Record<Status, number>;
    bySeverity: Record<Severity, number>;
    openCritical: number;
  };
}

type RespBody = { ok: true; data: DigestData } | { ok: false; error: string; hint?: string };

const STATUS_CLASS: Record<Status, string> = {
  open:         "bg-rose-500/15 text-rose-300 border-rose-500/25",
  acknowledged: "bg-amber-500/15 text-amber-300 border-amber-500/25",
  suppressed:   "bg-zinc-700/40 text-zinc-300 border-zinc-700/40",
  resolved:     "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  unknown:      "bg-zinc-700/40 text-zinc-300 border-zinc-700/40",
};

const SEVERITY_CLASS: Record<Severity, string> = {
  critical: "bg-rose-500/15 text-rose-300 border-rose-500/25",
  high:     "bg-orange-500/15 text-orange-300 border-orange-500/25",
  medium:   "bg-amber-500/15 text-amber-300 border-amber-500/25",
  low:      "bg-zinc-700/40 text-zinc-300 border-zinc-700/40",
  unknown:  "bg-zinc-700/40 text-zinc-300 border-zinc-700/40",
};

export default function DriftPage() {
  const [resp, setResp] = useState<RespBody | null>(null);
  const [loading, setLoading] = useState(true);
  const [networkError, setNetworkError] = useState<string | null>(null);

  function loadList() {
    setLoading(true);
    setNetworkError(null);
    fetch("/api/dashboard/drift-list", { credentials: "include" })
      .then((r) => r.json())
      .then((j: RespBody) => setResp(j))
      .catch((e) => setNetworkError(e instanceof Error ? e.message : "Network error."))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadList(); }, []);

  const data = resp?.ok ? resp.data : null;
  const errorBody = resp && !resp.ok ? resp : null;

  return (
    <div className="relative">
      <PageIntro
        kicker={`ReleaseOps · drift${data ? ` · ${data.summary.total} on file` : ""}`}
        title={<>Declared vs running. <span className="text-zinc-500">Every diff surfaced.</span></>}
        description="The Phase 485 detector compares the IaC source-of-truth (Terraform plan, Helm release, Liquibase changelog) against what's actually deployed. Each drift = one row with declared/observed snapshots."
        helps="See which resources have drifted, the sensitivity of the change, and which prod resources need urgent reconciliation."
        connectFirst="Drift findings populate after the IaC + cloud-state extractors run (follow-on phases)."
        engineers={["DevOps", "SRE", "Security"]}
        requiresApproval="Suppressing a finding requires a documented reason — surfaced in audit + evidence packs."
        actions={[
          { label: "Releases", href: "/dashboard/releases" },
          { label: "Multi-cloud", href: "/dashboard/multi-cloud" },
        ]}
        safetyNote="Per-org isolation · 4-status closed-union · severity escalates for prod + sensitive attribute changes"
      />

      <DemoDetectButton onCompleted={loadList} />

      {loading && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6 text-[12px] text-zinc-400">
          Loading drift findings…
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
            <Stat icon={ShieldExclamationIcon}    label="Open · critical" value={String(data.summary.openCritical)} tone={data.summary.openCritical > 0 ? "rose" : "zinc"} />
            <Stat icon={ServerStackIcon}          label="Open total"      value={String(data.summary.byStatus.open)} tone={data.summary.byStatus.open > 0 ? "amber" : "zinc"} />
            <Stat icon={ExclamationTriangleIcon}  label="High + critical" value={String(data.summary.bySeverity.high + data.summary.bySeverity.critical)} tone={(data.summary.bySeverity.high + data.summary.bySeverity.critical) > 0 ? "rose" : "zinc"} />
            <Stat icon={CheckCircleIcon}          label="Resolved"        value={String(data.summary.byStatus.resolved)} tone={data.summary.byStatus.resolved > 0 ? "emerald" : "zinc"} />
          </div>

          {data.findings.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center text-[13px] text-zinc-400">
              No drift findings on file. Either the detector hasn't run yet, or everything matches.
            </div>
          ) : (
            <div className="space-y-3 mb-8">
              {data.findings.map((f) => (
                <div key={f.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className={`text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border shrink-0 ${SEVERITY_CLASS[f.severity]}`}>
                        {f.severity}
                      </span>
                      <span className={`text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border shrink-0 ${STATUS_CLASS[f.status]}`}>
                        {f.status}
                      </span>
                      <p className="text-[13px] font-semibold text-white truncate">{f.displayName}</p>
                      <span className="text-[10px] font-mono text-zinc-500">{f.resourceKind}</span>
                    </div>
                    {f.environmentTier && (
                      <span className="text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/5 text-zinc-300 border border-white/[0.08] shrink-0">
                        {f.environmentTier}
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] text-zinc-300 mb-1.5 whitespace-pre-wrap">{f.summary}</p>
                  {f.remediationKey && (
                    <p className="text-[11.5px] text-violet-300 italic mb-1.5">→ remediation: {f.remediationKey}</p>
                  )}
                  <div className="flex items-center gap-3 text-[10px] font-mono text-zinc-500 flex-wrap">
                    <span>{f.resourceId.length > 60 ? `${f.resourceId.slice(0, 57)}…` : f.resourceId}</span>
                    {f.applicationId && <span>· {f.applicationId}</span>}
                    <span>· detected {new Date(f.detectedAtIso).toLocaleString()}</span>
                    {f.decidedAtIso && (
                      <span>· decided by {f.decidedByUserId} at {new Date(f.decidedAtIso).toLocaleString()}</span>
                    )}
                  </div>
                  {f.decisionReason && (
                    <p className="text-[11.5px] text-zinc-400 mt-2 italic">"{f.decisionReason}"</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value, tone }: { icon: typeof ShieldExclamationIcon; label: string; value: string; tone: "emerald" | "amber" | "rose" | "zinc" }) {
  const cls = {
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

/* ──────────────────────────────────────────────────────────────────
   Phase 486 — Demo detect button.
   Sends a small synthetic {declared, observed} payload so an operator
   can see the detection + persistence loop end-to-end without wiring
   a real Terraform/cloud extractor first.
   ────────────────────────────────────────────────────────────── */

type DemoOutcome =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "ok"; upserted: number; autoResolved: number; bySeverity: Record<string, number> }
  | { kind: "error"; message: string };

const DEMO_PAYLOAD = {
  declared: [
    {
      resourceKind: "aws_resource",
      resourceId: "arn:aws:ec2:us-east-1:111:instance/i-prod-web",
      displayName: "prod-web-1",
      applicationId: "app_checkout",
      environmentTier: "prod",
      attributes: { instance_type: "t3.large", volume_type: "gp3", security_group_ids: ["sg-web", "sg-base"] },
      sensitiveAttributeKeys: ["security_group_ids"],
    },
    {
      resourceKind: "k8s_resource",
      resourceId: "deployment/checkout-api",
      displayName: "checkout-api",
      applicationId: "app_checkout",
      environmentTier: "prod",
      attributes: { replicas: 3, image_tag: "v2.4.0" },
    },
    {
      resourceKind: "aws_resource",
      resourceId: "arn:aws:ec2:us-east-1:111:instance/i-staging-web",
      displayName: "staging-web-1",
      applicationId: "app_checkout",
      environmentTier: "stage",
      attributes: { instance_type: "t3.medium" },
    },
  ],
  observed: [
    {
      resourceKind: "aws_resource",
      resourceId: "arn:aws:ec2:us-east-1:111:instance/i-prod-web",
      displayName: "prod-web-1",
      // Drift: security_group_ids changed (sensitive → critical)
      attributes: { instance_type: "t3.large", volume_type: "gp3", security_group_ids: ["sg-web", "sg-base", "sg-shadow-allow-all"] },
    },
    {
      resourceKind: "k8s_resource",
      resourceId: "deployment/checkout-api",
      displayName: "checkout-api",
      // Drift: replicas + image tag both changed in prod (multi-field, prod tier → high)
      attributes: { replicas: 5, image_tag: "v2.4.0-hotfix" },
    },
    {
      resourceKind: "aws_resource",
      resourceId: "arn:aws:ec2:us-east-1:111:instance/i-staging-web",
      displayName: "staging-web-1",
      // No drift.
      attributes: { instance_type: "t3.medium" },
    },
  ],
};

function DemoDetectButton({ onCompleted }: { onCompleted: () => void }) {
  const [outcome, setOutcome] = useState<DemoOutcome>({ kind: "idle" });

  async function trigger() {
    setOutcome({ kind: "running" });
    try {
      const res = await fetch("/api/dashboard/drift-evaluate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(DEMO_PAYLOAD),
      });
      const j = await res.json();
      if (j.ok) {
        setOutcome({
          kind: "ok",
          upserted: j.data.upserted,
          autoResolved: j.data.autoResolved,
          bySeverity: j.data.bySeverity,
        });
        onCompleted();
      } else {
        setOutcome({ kind: "error", message: j.hint ?? j.error });
      }
    } catch (e) {
      setOutcome({ kind: "error", message: e instanceof Error ? e.message : "network error" });
    }
  }

  const busy = outcome.kind === "running";
  return (
    <div className="mb-6 rounded-2xl border border-violet-500/[0.18] bg-violet-500/[0.03] p-4 flex items-center gap-3 flex-wrap text-[12px]">
      <span className="text-[10px] font-mono uppercase tracking-wider text-violet-300/70">Demo detection</span>
      <button
        type="button"
        disabled={busy}
        onClick={trigger}
        className="px-3 py-1.5 rounded-lg border border-violet-500/40 bg-violet-500/[0.12] font-semibold text-violet-100 hover:bg-violet-500/[0.20] disabled:opacity-50 disabled:cursor-wait transition-colors"
      >
        {busy ? "Detecting…" : "Run sample detection"}
      </button>
      <span className="text-[10.5px] font-mono text-zinc-500">
        Posts a 3-resource sample to /drift-evaluate so you can see the loop without wiring Terraform first.
      </span>
      {outcome.kind === "ok" && (
        <span className="font-mono text-[11.5px] text-emerald-300">
          ✓ {outcome.upserted} upserted · {outcome.autoResolved} auto-resolved · severities {Object.entries(outcome.bySeverity).filter(([, v]) => v > 0).map(([k, v]) => `${k}=${v}`).join(" ") || "—"}
        </span>
      )}
      {outcome.kind === "error" && (
        <span className="font-mono text-rose-300 text-[11.5px]">✗ {outcome.message}</span>
      )}
    </div>
  );
}
