/**
 * Handoff inbox — desktop-side view of signed execution-plan handoffs.
 *
 * The lifecycle taxonomy mirrors `/lib/desktop/handoffLifecycle.ts` in the
 * parent Next.js project. The shape is intentionally a small mirror — when
 * the cross-package path is wired up, this file will import directly.
 */

import { useEffect, useState } from "react";
import { DataSourceBanner, ViewShell } from "../components/Primitives";
import { desktopClient } from "../lib/desktopClient";
import { handoffInbox, type HandoffLifecycleState, type InboxHandoff } from "../lib/handoffInbox";

export function HandoffsView() {
  const [filter, setFilter] = useState<"all" | "active" | "terminal">("all");
  const [handoffs, setHandoffs] = useState<InboxHandoff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    try {
      setHandoffs(await handoffInbox.list());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, []);

  const visible = handoffs.filter((h) => {
    if (filter === "active") return h.state !== "audit_synced" && h.state !== "expired" && h.state !== "failed";
    if (filter === "terminal") return h.state === "audit_synced" || h.state === "expired" || h.state === "failed";
    return true;
  });

  return (
    <ViewShell>
      <DataSourceBanner
        mode={desktopClient.hasAuth() ? "authenticated_no_data" : "preview"}
        surfaceName="handoff inbox"
        webPath="/dashboard/handoffs"
      />
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Handoff Inbox</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Signed execution plans received by this installed application</p>
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
          <span className="font-semibold text-amber-300">Approval-gated.</span> Desktop apply requires a persisted approval grant
          plus tenant policy allowance. Review and preview are always available; destructive operations
          are blocked locally until those gates pass.
        </div>
      </div>

      {/* Handoff list */}
      <div className="space-y-2">
        {loading ? (
          <div className="rounded-xl border border-zinc-800/40 bg-zinc-900/30 p-8 text-center text-sm text-zinc-500">Loading handoffs…</div>
        ) : error ? (
          <div role="alert" className="rounded-xl border border-red-500/20 bg-red-500/[0.06] p-4 text-sm text-red-300">Handoff inbox unavailable: {error}</div>
        ) : visible.length === 0 ? (
          <div className="rounded-xl border border-zinc-800/40 bg-zinc-900/30 p-8 text-center">
            <p className="text-sm text-zinc-400">No handoffs in this view.</p>
            <p className="text-xs text-zinc-500 mt-1">Signed handoffs received for this authenticated desktop will appear here. No sample records are shown.</p>
          </div>
        ) : visible.map((h) => <HandoffRowCard key={h.id} handoff={h} onChanged={refresh} />)}
      </div>
    </ViewShell>
  );
}

function HandoffRowCard({ handoff, onChanged }: { handoff: InboxHandoff; onChanged: () => Promise<void> }) {
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
            <button
              onClick={async () => { await handoffInbox.setState(handoff.id, "opened_in_desktop"); await onChanged(); }}
              className="px-3 py-1.5 rounded-md bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium"
            >
              Open & review
            </button>
          )}
          {handoff.state === "opened_in_desktop" && (
            <button disabled title="Local apply is not available in this release" className="px-3 py-1.5 rounded-md bg-zinc-800 text-zinc-500 text-xs font-medium cursor-not-allowed">
              Apply unavailable
            </button>
          )}
          {handoff.state === "audit_sync_pending" && (
            <button disabled title="Automatic audit retry is unavailable" className="px-3 py-1.5 rounded-md bg-zinc-800 text-zinc-500 text-xs font-medium cursor-not-allowed">
              Sync pending
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function displayFor(state: HandoffLifecycleState): { pill: string; detail: string; semantic: "neutral" | "running" | "success" | "warning" | "error" } {
  switch (state) {
    case "not_available":      return { pill: "Unavailable",   detail: "Desktop handoff isn't available — see the eligibility checklist.",   semantic: "neutral" };
    case "eligible":           return { pill: "Eligible",      detail: "All gates pass. Request a signed desktop handoff.",                 semantic: "success" };
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

function ShieldIcon(props: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={props.className}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}
