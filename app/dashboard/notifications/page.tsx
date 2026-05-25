"use client";

/**
 * /dashboard/notifications
 *
 * Notification Center. Derived from real canonical events — Risk
 * Queue, Integration Health, Priority Report, AxiomOSState critical
 * blockers. No fake noise. Each row carries source / sourceMode /
 * evidence refs / safe next action.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  BellAlertIcon,
  ExclamationTriangleIcon,
  ShieldExclamationIcon,
  ServerStackIcon,
  CheckCircleIcon,
  CloudIcon,
  RocketLaunchIcon,
  WrenchScrewdriverIcon,
  BeakerIcon,
  LockClosedIcon,
  ComputerDesktopIcon,
  DocumentTextIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";
import { PageIntro } from "@/components/dashboard/PageIntro";

type Severity = "info" | "warning" | "critical";
type SourceMode = "live" | "partial_live" | "preview" | "foundation" | "planned" | "blocked" | "disabled" | "unknown";
type NotificationType = string;

interface NotificationLite {
  id: string;
  type: NotificationType;
  severity: Severity;
  createdAt: string;
  title: string;
  description: string;
  sourceSystem: string;
  sourceMode: SourceMode;
  route: { label: string; href: string };
  safeNextAction?: { label: string; href: string };
  linkedObjectType?: string;
  linkedObjectId?: string;
  evidenceRefs: string[];
  limitations: string[];
}

interface ReportLite {
  generatedAt: string;
  notifications: NotificationLite[];
  summary: { total: number; critical: number; warning: number; info: number; byType: Record<string, number> };
  safetyContract: "notifications_review_only_no_action_taken";
  limitations: string[];
}

const SEVERITY_VISUAL: Record<Severity, { border: string; bg: string; text: string; pill: string }> = {
  critical: { border: "border-rose-500/[0.28]",   bg: "bg-rose-500/[0.05]",   text: "text-rose-300",    pill: "bg-rose-500/20 text-rose-200"     },
  warning:  { border: "border-amber-500/[0.22]",  bg: "bg-amber-500/[0.04]",  text: "text-amber-300",   pill: "bg-amber-500/15 text-amber-300"   },
  info:     { border: "border-cyan-500/[0.18]",   bg: "bg-cyan-500/[0.04]",   text: "text-cyan-300",    pill: "bg-cyan-500/15 text-cyan-300"     },
};

const TYPE_ICON: Record<string, typeof BellAlertIcon> = {
  integration_failed:        CloudIcon,
  integration_recovered:     CheckCircleIcon,
  scan_completed:            CheckCircleIcon,
  scan_failed:               ExclamationTriangleIcon,
  security_finding_detected: ShieldExclamationIcon,
  release_blocker_detected:  RocketLaunchIcon,
  risk_created:              ShieldExclamationIcon,
  remediation_ready:         WrenchScrewdriverIcon,
  simulation_ready:          BeakerIcon,
  approval_required:         LockClosedIcon,
  approval_decided:          CheckCircleIcon,
  desktop_handoff_ready:     ComputerDesktopIcon,
  evidence_export_ready:     DocumentTextIcon,
  readiness_blocker:         ExclamationTriangleIcon,
  policy_violation:          LockClosedIcon,
  scheduled_scan_failed:     ClockIcon,
};

export default function NotificationsPage() {
  const [report, setReport] = useState<ReportLite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | Severity>("all");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/notifications", { credentials: "include" })
      .then((r) => r.json())
      .then((json: { ok?: boolean; data?: ReportLite; error?: { userMessage?: string } }) => {
        if (cancelled) return;
        if (json.ok && json.data) setReport(json.data);
        else setError(json.error?.userMessage ?? "Notifications unavailable.");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Network error.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const visible = report?.notifications.filter((n) => filter === "all" || n.severity === filter) ?? [];

  return (
    <div className="relative">
      <PageIntro
        kicker={`Team workflows · notifications${report?.generatedAt ? ` · last sync ${new Date(report.generatedAt).toLocaleTimeString()}` : ""}`}
        title={<>What needs <span className="text-zinc-500">attention.</span></>}
        description="Every notification is derived from a real canonical event. No random noise, no fake alerts — review only, no action taken."
        helps="See critical, warning, and informational signals derived from cloud + monitoring + agent activity, with the source link for every one."
        connectFirst="Connectors that produce events: cloud, monitoring, GitHub. Slack/Teams downstream for outbound digests."
        engineers={["Notification routing", "Incident Engineer"]}
        requiresApproval="Notification routing rules + Slack/Teams outbound digest configuration."
        actions={[
          { label: "Configure outbound digest", href: "/dashboard/outbound-digest" },
          { label: "Manage connectors", href: "/dashboard/connectors" },
        ]}
        safetyNote="Review-only · Every signal cites its canonical source event"
      />

      {/* Hidden md+ summary card kept for layout — Stat is still useful here */}
      <div className="hidden md:flex items-end gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.025] backdrop-blur-sm px-5 py-4 mb-6">
        <div className="min-w-0">
          {report && (
            <div className="flex items-end gap-4">
              <Stat label="Critical" value={report.summary.critical} tone={report.summary.critical > 0 ? "text-rose-300" : "text-zinc-500"} />
              <div className="w-px h-9 bg-white/[0.08]" />
              <Stat label="Warning" value={report.summary.warning} tone={report.summary.warning > 0 ? "text-amber-300" : "text-zinc-500"} />
              <div className="w-px h-9 bg-white/[0.08]" />
              <Stat label="Info" value={report.summary.info} tone="text-cyan-300" />
            </div>
          )}
        </div>
      </div>

      {/* Filter pills */}
      {report && report.notifications.length > 0 && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {(["all", "critical", "warning", "info"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`inline-flex items-center px-3 py-1.5 rounded-full text-[11px] font-medium border transition-all ${
                filter === f
                  ? "bg-violet-500/15 border-violet-500/30 text-violet-300"
                  : "bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:text-white hover:border-white/[0.12]"
              }`}
            >
              {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6">
          <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em]">// synthesising notifications…</p>
        </div>
      )}
      {!loading && error && (
        <div className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 mb-6">
          <p className="text-[11px] font-mono text-amber-300/80 uppercase tracking-[0.18em] mb-1">// notifications unavailable</p>
          <p className="text-[13px] text-zinc-300">{error}</p>
        </div>
      )}

      {!loading && !error && report && visible.length === 0 && (
        <div className="rounded-2xl border border-emerald-500/[0.22] bg-emerald-500/[0.04] p-6 mb-6">
          <p className="text-[11px] font-mono text-emerald-300/80 uppercase tracking-[0.18em] mb-1">// inbox clear</p>
          <p className="text-[14px] text-emerald-100 font-semibold">No notifications match this filter.</p>
        </div>
      )}

      {!loading && !error && report && visible.length > 0 && (
        <div className="space-y-2 mb-10">
          {visible.map((n) => {
            const v = SEVERITY_VISUAL[n.severity];
            const Icon = TYPE_ICON[n.type] ?? BellAlertIcon;
            return (
              <Link
                key={n.id}
                href={n.route.href}
                className={`block rounded-2xl border ${v.border} ${v.bg} p-4 hover:-translate-y-0.5 transition-all`}
              >
                <div className="flex items-start gap-3">
                  <div className={`shrink-0 w-9 h-9 rounded-lg border ${v.border} ${v.bg} flex items-center justify-center`}>
                    <Icon className={`h-4.5 w-4.5 ${v.text}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded ${v.pill}`}>
                        {n.severity}
                      </span>
                      <span className="text-[10px] font-mono text-zinc-500">{n.type.replace(/_/g, " ")}</span>
                      <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-700/40 text-zinc-300">
                        {n.sourceMode.replace(/_/g, " ")}
                      </span>
                      <span className="text-[10px] font-mono text-zinc-500 ml-auto">
                        {new Date(n.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-[13.5px] font-semibold text-white tracking-tight leading-snug">{n.title}</p>
                    <p className="text-[12px] text-zinc-300 leading-relaxed mt-0.5">{n.description}</p>
                    <div className="flex items-center gap-3 mt-2 flex-wrap text-[10px] font-mono text-zinc-500">
                      <span>source: {n.sourceSystem}</span>
                      {n.evidenceRefs.length > 0 && <span>· {n.evidenceRefs.length} evidence</span>}
                      <span className="ml-auto inline-flex items-center gap-1">
                        {n.route.label}
                        <ArrowRightIcon className="h-3 w-3" />
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {!loading && !error && report && (
        <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.04] p-5 mb-8 flex items-start gap-3">
          <CheckCircleIcon className="h-5 w-5 text-emerald-300 mt-0.5 shrink-0" />
          <div>
            <p className="text-[11px] font-mono text-emerald-300/80 uppercase tracking-[0.18em] mb-1">// notification engine contract</p>
            <p className="text-[13px] text-emerald-100 font-semibold leading-snug">
              safetyContract = <code className="font-mono text-[12px] bg-black/30 border border-white/[0.06] rounded px-1.5 py-px">{report.safetyContract}</code>
            </p>
            <p className="text-[12px] text-zinc-300 leading-relaxed mt-1">
              {report.limitations.join(" ")}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="text-right min-w-[4rem]">
      <p className={`text-2xl font-bold tracking-tight leading-none ${tone}`}>{value}</p>
      <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1.5">{label}</p>
    </div>
  );
}
