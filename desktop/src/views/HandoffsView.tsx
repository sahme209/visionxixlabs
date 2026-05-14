/**
 * Handoff inbox — desktop-side view of execution-plan handoffs delivered
 * from the web app.
 *
 * The lifecycle taxonomy mirrors `/lib/desktop/handoffLifecycle.ts` in the
 * parent Next.js project. The shape is intentionally a small mirror — when
 * the cross-package path is wired up, this file will import directly.
 */

import { useState } from "react";
import { ViewShell } from "../components/Primitives";

type HandoffState =
  | "not_available"
  | "eligible"
  | "preparing"
  | "ready"
  | "opened_in_desktop"
  | "expired"
  | "failed"
  | "completed"
  | "audit_sync_pending"
  | "audit_synced";

interface HandoffRow {
  id: string;
  planLabel: string;
  approver: string;
  preparedAt: string;
  expiresAt: string;
  state: HandoffState;
  steps: number;
  risk: "low" | "medium" | "high";
  resources: number;
  errorSummary?: string;
}

const SAMPLE_HANDOFFS: HandoffRow[] = [
  {
    id: "hf_close_s3_public",
    planLabel: "Close public S3 buckets · prod-account",
    approver: "bob@example.com",
    preparedAt: nowMinus(38),
    expiresAt: nowPlus(22 * 60),
    state: "ready",
    steps: 4,
    risk: "high",
    resources: 7,
  },
  {
    id: "hf_rightsize_compute",
    planLabel: "Rightsize idle EC2 fleet · staging-account",
    approver: "alice@example.com",
    preparedAt: nowMinus(2 * 60),
    expiresAt: nowPlus(21 * 60),
    state: "opened_in_desktop",
    steps: 12,
    risk: "medium",
    resources: 14,
  },
  {
    id: "hf_drift_db_subnet",
    planLabel: "Drift correction · RDS subnet group",
    approver: "alice@example.com",
    preparedAt: nowMinus(6 * 60),
    expiresAt: nowMinus(2 * 60),
    state: "audit_sync_pending",
    steps: 3,
    risk: "low",
    resources: 2,
  },
];

export function HandoffsView() {
  const [filter, setFilter] = useState<"all" | "active" | "terminal">("all");

  const visible = SAMPLE_HANDOFFS.filter((h) => {
    if (filter === "active") return h.state !== "audit_synced" && h.state !== "expired" && h.state !== "failed";
    if (filter === "terminal") return h.state === "audit_synced" || h.state === "expired" || h.state === "failed";
    return true;
  });

  return (
    <ViewShell>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Handoff Inbox</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Execution plans signed by the web app, awaiting local review</p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-zinc-800/60 p-0.5 text-xs">
          {(["all", "active", "terminal"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded transition-colors ${
                filter === f ? "bg-violet-600 text-white" : "text-zinc-400 hover:text-white"
              }`}
            >
              {f === "all" ? "All" : f === "active" ? "Active" : "Terminal"}
            </button>
          ))}
        </div>
      </div>

      {/* Boundary banner — desktop never bypasses approval */}
      <div className="rounded-xl border border-amber-500/15 bg-amber-500/[0.04] p-4 flex gap-3">
        <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/25 flex items-center justify-center shrink-0 mt-0.5">
          <ShieldIcon className="h-4 w-4 text-amber-300" />
        </div>
        <div className="text-xs text-zinc-300 leading-relaxed">
          <span className="font-semibold text-amber-300">Approval-gated.</span> Desktop apply requires an approval grant
          from the web app plus tenant policy allowance. Review and preview are always available; destructive operations
          are blocked locally until those gates pass.
        </div>
      </div>

      {/* Handoff list */}
      <div className="space-y-2">
        {visible.length === 0 ? (
          <div className="rounded-xl border border-zinc-800/40 bg-zinc-900/30 p-8 text-center">
            <p className="text-sm text-zinc-400">No handoffs in this view.</p>
            <p className="text-xs text-zinc-500 mt-1">When the web app issues a signed handoff, it will appear here.</p>
          </div>
        ) : visible.map((h) => <HandoffRowCard key={h.id} handoff={h} />)}
      </div>
    </ViewShell>
  );
}

function HandoffRowCard({ handoff }: { handoff: HandoffRow }) {
  const display = displayFor(handoff.state);
  const expiresIn = Math.max(0, Math.round((Date.parse(handoff.expiresAt) - Date.now()) / 60_000));
  const expiresLabel = expiresIn === 0
    ? "Expired"
    : expiresIn < 60
      ? `Expires in ${expiresIn}m`
      : `Expires in ${Math.round(expiresIn / 60)}h`;

  return (
    <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4 hover:border-zinc-700/80 transition-colors">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`text-[10px] font-bold uppercase tracking-wider border rounded-full px-1.5 py-px ${riskBadge(handoff.risk)}`}>
              {handoff.risk}
            </span>
            <span className={`text-[10px] font-bold uppercase tracking-wider border rounded-full px-1.5 py-px ${tonePill(display.semantic)}`}>
              {display.pill}
            </span>
            <span className="text-sm font-semibold text-zinc-100 truncate">{handoff.planLabel}</span>
          </div>
          <p className="text-[11px] text-zinc-500 leading-relaxed">{display.detail}</p>
          <div className="mt-2 flex items-center gap-4 text-[10px] text-zinc-500 font-mono">
            <span>{handoff.steps} steps</span>
            <span>{handoff.resources} resources</span>
            <span>approver: {handoff.approver}</span>
            <span>{expiresLabel}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {handoff.state === "ready" && (
            <button className="px-3 py-1.5 rounded-md bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium">
              Open & review
            </button>
          )}
          {handoff.state === "opened_in_desktop" && (
            <button className="px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium">
              Run terraform plan
            </button>
          )}
          {handoff.state === "audit_sync_pending" && (
            <button className="px-3 py-1.5 rounded-md bg-amber-600/80 hover:bg-amber-500 text-white text-xs font-medium">
              Retry audit sync
            </button>
          )}
          {(handoff.state === "expired" || handoff.state === "audit_synced" || handoff.state === "failed") && (
            <button className="px-3 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium">
              View timeline
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function displayFor(state: HandoffState): { pill: string; detail: string; semantic: "neutral" | "running" | "success" | "warning" | "error" } {
  switch (state) {
    case "not_available":      return { pill: "Unavailable",   detail: "Desktop handoff isn't available — see the eligibility checklist.",   semantic: "neutral" };
    case "eligible":           return { pill: "Eligible",      detail: "All gates pass. Request a handoff from the web app.",                semantic: "success" };
    case "preparing":          return { pill: "Preparing",     detail: "Packaging plan + Terraform + CLI + rollback + verification.",       semantic: "running" };
    case "ready":              return { pill: "Ready",         detail: "Bundle prepared and signed. Awaiting desktop pickup.",              semantic: "success" };
    case "opened_in_desktop":  return { pill: "In desktop",    detail: "Desktop confirmed receipt and opened the bundle.",                  semantic: "running" };
    case "completed":          return { pill: "Completed",     detail: "Desktop reported completion. Awaiting audit sync.",                 semantic: "success" };
    case "audit_sync_pending": return { pill: "Sync pending",  detail: "Local audit events haven't reached the web store yet.",            semantic: "warning" };
    case "audit_synced":       return { pill: "Synced",        detail: "All audit events landed in the web store. Handoff complete.",      semantic: "success" };
    case "expired":            return { pill: "Expired",       detail: "Bundle TTL elapsed before pickup.",                                 semantic: "warning" };
    case "failed":             return { pill: "Failed",        detail: "Handoff preparation or verification failed.",                       semantic: "error"   };
  }
}

function tonePill(s: "neutral" | "running" | "success" | "warning" | "error"): string {
  switch (s) {
    case "success": return "text-emerald-300 bg-emerald-500/10 border-emerald-500/20";
    case "running": return "text-violet-300 bg-violet-500/10 border-violet-500/20";
    case "warning": return "text-amber-300 bg-amber-500/10 border-amber-500/20";
    case "error":   return "text-red-300 bg-red-500/10 border-red-500/20";
    case "neutral": return "text-zinc-400 bg-zinc-700/30 border-zinc-700/40";
  }
}

function riskBadge(r: "low" | "medium" | "high"): string {
  if (r === "high")   return "text-red-300 bg-red-500/10 border-red-500/20";
  if (r === "medium") return "text-amber-300 bg-amber-500/10 border-amber-500/20";
  return "text-emerald-300 bg-emerald-500/10 border-emerald-500/20";
}

function nowMinus(mins: number) { return new Date(Date.now() - mins * 60_000).toISOString(); }
function nowPlus(mins: number)  { return new Date(Date.now() + mins * 60_000).toISOString(); }

function ShieldIcon(props: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={props.className}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}
