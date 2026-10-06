"use client";

/**
 * /dashboard/policies
 *
 * Operator-facing view of every policy Axiom enforces. Declarative
 * catalog grouped by category. Each row shows enforcement level,
 * severity, rationale, what is blocked, and the canonical evidence
 * ref the operator can audit.
 *
 * Read-only. The page declares — it never enables anything.
 */

import { useEffect, useState } from "react";
import {
  ShieldCheckIcon,
  LockClosedIcon,
  EyeIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  DocumentCheckIcon,
} from "@heroicons/react/24/outline";
import { PageIntro } from "@/components/dashboard/PageIntro";

type Enforcement = "enforced_always" | "enforced_with_audit" | "advisory" | "disabled";
type Severity = "critical" | "high" | "medium" | "low";
type Category =
  | "read_only_enforcement" | "approval_required" | "no_mutation"
  | "no_desktop_execution" | "evidence_required" | "sourceMode_required"
  | "trust_boundary" | "credential_safety" | "export_control"
  | "role_permission" | "scheduled_scan_safety";

interface PolicyLite {
  id: string;
  category: Category;
  enforcement: Enforcement;
  severity: Severity;
  title: string;
  description: string;
  rationale: string;
  appliesTo: string[];
  blockedActions: string[];
  evidenceRef: string;
}

interface ReportLite {
  generatedAt: string;
  policies: PolicyLite[];
  summary: {
    total: number; enforcedAlways: number; enforcedWithAudit: number;
    advisory: number; disabled: number;
    byCategory: Record<Category, number>;
  };
  safetyContract: "policies_declared_no_action_taken";
  limitations: string[];
}

const ENF_VISUAL: Record<Enforcement, { border: string; bg: string; text: string; pill: string; icon: typeof ShieldCheckIcon }> = {
  enforced_always:     { border: "border-emerald-500/[0.22]", bg: "bg-emerald-500/[0.04]", text: "text-emerald-300", pill: "bg-emerald-500/15 text-emerald-300", icon: ShieldCheckIcon  },
  enforced_with_audit: { border: "border-cyan-500/[0.22]",    bg: "bg-cyan-500/[0.04]",    text: "text-cyan-300",    pill: "bg-cyan-500/15 text-cyan-300",       icon: DocumentCheckIcon },
  advisory:            { border: "border-white/[0.22]",   bg: "bg-white/[0.04]",   text: "text-zinc-300",   pill: "bg-white/15 text-zinc-300",     icon: EyeIcon          },
  disabled:            { border: "border-zinc-700/30",        bg: "bg-white/[0.02]",       text: "text-zinc-400",    pill: "bg-zinc-700/40 text-zinc-300",       icon: XCircleIcon       },
};

const ENF_LABEL: Record<Enforcement, string> = {
  enforced_always:     "Enforced always",
  enforced_with_audit: "Enforced · audit",
  advisory:            "Advisory",
  disabled:            "Disabled",
};

const SEV_PILL: Record<Severity, string> = {
  critical: "bg-rose-500/20 text-rose-200",
  high:     "bg-white/15 text-zinc-300",
  medium:   "bg-cyan-500/15 text-cyan-300",
  low:      "bg-zinc-700/40 text-zinc-300",
};

const CATEGORY_LABEL: Record<Category, string> = {
  read_only_enforcement: "Read-only enforcement",
  approval_required:     "Approval required",
  no_mutation:           "No mutation",
  no_desktop_execution:  "No desktop execution",
  evidence_required:     "Evidence required",
  sourceMode_required:   "Source mode required",
  trust_boundary:        "Trust boundary",
  credential_safety:     "Credential safety",
  export_control:        "Export control",
  role_permission:       "Role permission",
  scheduled_scan_safety: "Scheduled scan safety",
};

const CATEGORY_ORDER: Category[] = [
  "trust_boundary",
  "no_mutation",
  "no_desktop_execution",
  "read_only_enforcement",
  "approval_required",
  "credential_safety",
  "evidence_required",
  "sourceMode_required",
  "export_control",
  "scheduled_scan_safety",
  "role_permission",
];

export default function PoliciesPage() {
  const [report, setReport] = useState<ReportLite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/policies", { credentials: "include" })
      .then((r) => r.json())
      .then((json: { ok?: boolean; data?: ReportLite; error?: { userMessage?: string } }) => {
        if (cancelled) return;
        if (json.ok && json.data) setReport(json.data);
        else setError(json.error?.userMessage ?? "Policies unavailable.");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Network error.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="relative">
      <PageIntro
        kicker={`Business / admin · policy registry${report?.generatedAt ? ` · declared ${new Date(report.generatedAt).toLocaleTimeString()}` : ""}`}
        title={<>What governs <span className="text-zinc-500">every action.</span></>}
        description="Every policy Axiom enforces — declarative, auditable, with canonical evidence refs. The registry declares; the underlying engines enforce."
        helps="Read every policy in plain English, see its current enforcement state, and the canonical source-of-truth it points at."
        connectFirst="Already in effect — policies apply platform-wide, no setup required."
        engineers={["Council / Safety", "Compliance Officer", "Security Engineer"]}
        requiresApproval="Policy edits are admin-only and require dual control."
        actions={[
          { label: "Automation boundaries", href: "/dashboard/automation-boundaries" },
          { label: "Audit log", href: "/dashboard/audit" },
        ]}
        safetyNote="policies_declared_no_action_taken · Read-only registry · Tamper-evident evidence refs"
      />

      {loading && (
        <div className="surface-glass rounded-2xl p-5 mb-6">
          <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em]">// loading policy registry…</p>
        </div>
      )}
      {!loading && error && (
        <div role="alert" aria-live="assertive" className="rounded-2xl border border-white/[0.18] bg-white/[0.04] p-5 mb-6">
          <p className="text-[11px] font-mono text-zinc-300/80 uppercase tracking-[0.18em] mb-1">// policies unavailable</p>
          <p className="text-[13px] text-zinc-300">{error}</p>
        </div>
      )}

      {!loading && !error && report && (
        <>
          {/* Counts ribbon */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
            <SummaryStat label="Total" value={report.summary.total} tone="text-white" />
            <SummaryStat label="Enforced always" value={report.summary.enforcedAlways} tone="text-emerald-300" />
            <SummaryStat label="Enforced + audit" value={report.summary.enforcedWithAudit} tone="text-cyan-300" />
            <SummaryStat label="Advisory" value={report.summary.advisory} tone="text-zinc-300" />
          </div>

          {/* Grouped by category */}
          <div className="space-y-6 mb-10">
            {CATEGORY_ORDER.map((cat) => {
              const policies = report.policies.filter((p) => p.category === cat);
              if (policies.length === 0) return null;
              return (
                <section key={cat}>
                  <div className="flex items-center gap-2 mb-3">
                    <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-zinc-400">
                      // {CATEGORY_LABEL[cat]} · {policies.length} polic{policies.length === 1 ? "y" : "ies"}
                    </p>
                  </div>
                  <div className="grid lg:grid-cols-2 gap-2">
                    {policies.map((p) => {
                      const v = ENF_VISUAL[p.enforcement];
                      const Icon = v.icon;
                      return (
                        <div key={p.id} className={`rounded-2xl border ${v.border} ${v.bg} p-4`}>
                          <div className="flex items-start justify-between gap-2 mb-2 flex-wrap">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className={`w-7 h-7 rounded-md border ${v.border} ${v.bg} flex items-center justify-center shrink-0`}>
                                <Icon className={`h-4 w-4 ${v.text}`} />
                              </div>
                              <div className="min-w-0">
                                <p className="text-[13px] font-semibold text-white tracking-tight">{p.title}</p>
                                <p className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider mt-0.5">{p.id}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <span className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded ${v.pill}`}>
                                {ENF_LABEL[p.enforcement]}
                              </span>
                              <span className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded ${SEV_PILL[p.severity]}`}>
                                {p.severity}
                              </span>
                            </div>
                          </div>
                          <p className="text-[12px] text-zinc-300 leading-relaxed mb-2">{p.description}</p>
                          <p className="text-[11px] text-zinc-400 italic leading-snug mb-2">{p.rationale}</p>

                          {p.blockedActions.length > 0 && (
                            <div className="rounded-md border border-rose-500/[0.18] bg-rose-500/[0.04] p-2 mb-2">
                              <p className="text-[9px] font-mono text-rose-300/80 uppercase tracking-wider mb-1">// blocks</p>
                              <div className="flex flex-wrap gap-1">
                                {p.blockedActions.map((a, i) => (
                                  <span key={i} className="text-[10px] font-mono text-rose-200 bg-black/30 border border-rose-500/[0.18] rounded px-1.5 py-0.5">{a}</span>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="flex items-center gap-2 flex-wrap text-[10px] font-mono text-zinc-500">
                            <span>applies to: {p.appliesTo.join(", ")}</span>
                            <span className="ml-auto">evidence: {p.evidenceRef}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>

          {/* Contract footer */}
          <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.04] p-5 mb-8 flex items-start gap-3">
            <ShieldCheckIcon className="h-5 w-5 text-emerald-300 mt-0.5 shrink-0" />
            <div>
              <p className="text-[11px] font-mono text-emerald-300/80 uppercase tracking-[0.18em] mb-1">// registry contract</p>
              <p className="text-[13px] text-emerald-100 font-semibold leading-snug">
                safetyContract = <code className="font-mono text-[12px] bg-black/30 border border-white/[0.06] rounded px-1.5 py-px">{report.safetyContract}</code>
              </p>
              <p className="text-[12px] text-zinc-300 leading-relaxed mt-1">
                {report.limitations.join(" ")}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SummaryStat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="surface-glass rounded-xl p-4">
      <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-bold tracking-tight ${tone}`}>{value}</p>
    </div>
  );
}
