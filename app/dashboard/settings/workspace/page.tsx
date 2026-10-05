"use client";

/**
 * /dashboard/settings/workspace
 *
 * Workspace + team + RBAC view. Premium dashboard for the typed role
 * catalog and per-permission enforcement posture. Read-only — no
 * dangerous toggles. Member persistence honest about the preview state.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ShieldCheckIcon,
  UserGroupIcon,
  UserCircleIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  EyeIcon,
} from "@heroicons/react/24/outline";

type WorkspaceRole = "owner" | "admin" | "cloud_engineer" | "security_reviewer" | "release_manager" | "viewer";
type Permission = string;
type Enforcement = "preview" | "partial" | "enforced";

interface MemberLite {
  id: string;
  email: string;
  displayName: string;
  role: WorkspaceRole;
  addedAt: string;
  isCurrentSession: boolean;
}

interface RoleDefLite {
  role: WorkspaceRole;
  label: string;
  description: string;
  permissions: Permission[];
  rationale: string;
}

interface WorkspaceStateLite {
  generatedAt: string;
  workspaceId: string;
  workspaceLabel: string;
  currentMember: MemberLite | null;
  members: MemberLite[];
  roleCatalog: RoleDefLite[];
  enforcement: Record<Permission, Enforcement>;
  summary: { memberCount: number; rolesDefined: number; permissionsDefined: number; enforcedPermissions: number; previewPermissions: number };
  safetyContract: "rbac_never_enables_mutation";
  limitations: string[];
  safeNextAction: { label: string; href: string };
}

const ROLE_PILL: Record<WorkspaceRole, string> = {
  owner:             "bg-rose-500/15 text-rose-300",
  admin:             "bg-amber-500/15 text-amber-300",
  cloud_engineer:    "bg-cyan-500/15 text-cyan-300",
  security_reviewer: "bg-violet-500/15 text-violet-300",
  release_manager:   "bg-emerald-500/15 text-emerald-300",
  viewer:            "bg-zinc-700/40 text-zinc-300",
};

const ENF_PILL: Record<Enforcement, { pill: string; icon: typeof CheckCircleIcon; label: string }> = {
  enforced: { pill: "bg-emerald-500/15 text-emerald-300", icon: CheckCircleIcon,        label: "Enforced"       },
  partial:  { pill: "bg-cyan-500/15 text-cyan-300",       icon: EyeIcon,                 label: "Partial · auth" },
  preview:  { pill: "bg-amber-500/15 text-amber-300",     icon: ExclamationTriangleIcon, label: "Preview · pending" },
};

const PERMISSION_LABEL: Record<string, string> = {
  view_sources:             "View sources",
  validate_sources:         "Validate sources",
  run_readonly_scan:        "Run read-only scan",
  view_findings:            "View findings",
  create_remediation_plan:  "Create remediation plan",
  create_simulation:        "Create simulation",
  request_approval:         "Request approval",
  approve_plan:             "Approve plan",
  export_evidence:          "Export evidence",
  manage_workspace:         "Manage workspace",
  manage_members:           "Manage members",
  view_audit:               "View audit",
  manage_desktop_sessions:  "Manage desktop sessions",
};

export default function WorkspaceSettingsPage() {
  const [state, setState] = useState<WorkspaceStateLite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/workspace/state", { credentials: "include" })
      .then((r) => r.json())
      .then((json: { ok?: boolean; data?: WorkspaceStateLite; error?: { userMessage?: string } }) => {
        if (cancelled) return;
        if (json.ok && json.data) setState(json.data);
        else setError(json.error?.userMessage ?? "Workspace state unavailable.");
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
      <div className="relative mb-8 rounded-3xl border border-white/[0.05] bg-gradient-to-br from-white/[0.025] via-white/[0.015] to-transparent p-6 md:p-8 overflow-hidden">
        <div
          className="absolute inset-0 -z-10 opacity-90 pointer-events-none"
          style={{
            background:
              "radial-gradient(900px 320px at 12% 0%, rgba(99,102,241,0.10), transparent 60%), radial-gradient(700px 260px at 88% 110%, rgba(45,212,191,0.06), transparent 60%)",
          }}
          aria-hidden
        />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" aria-hidden />

        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1">
            <UserGroupIcon className="h-3.5 w-3.5 text-emerald-300" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-emerald-300">
              Workspace + team + RBAC · rbac_never_enables_mutation
            </span>
          </span>
          {state?.generatedAt && (
            <span className="text-[10px] font-mono text-zinc-500">last sync {new Date(state.generatedAt).toLocaleTimeString()}</span>
          )}
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white tracking-[-0.045em] leading-[1.05] mb-3">
          Roles + permissions <span className="text-gradient">at a glance.</span>
        </h1>
        <p className="text-[15px] text-zinc-400 max-w-2xl leading-relaxed">
          6 typed roles × 13 typed permissions. No role enables mutation or bypasses approval — the closed union itself excludes those permissions.
        </p>
      </div>

      {loading && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6">
          <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em]">// loading workspace state…</p>
        </div>
      )}
      {!loading && error && (
        <div role="alert" aria-live="assertive" className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 mb-6">
          <p className="text-[11px] font-mono text-amber-300/80 uppercase tracking-[0.18em] mb-1">// workspace unavailable</p>
          <p className="text-[13px] text-zinc-300">{error}</p>
        </div>
      )}

      {!loading && !error && state && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
            <Stat label="Members" value={state.summary.memberCount} tone="text-white" />
            <Stat label="Roles defined" value={state.summary.rolesDefined} tone="text-cyan-300" />
            <Stat label="Permissions enforced" value={state.summary.enforcedPermissions} tone="text-emerald-300" />
            <Stat label="Pending enforcement" value={state.summary.previewPermissions} tone="text-amber-300" />
          </div>

          {/* Members */}
          <section className="mb-8">
            <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em] mb-3">// members</p>
            <div className="space-y-2">
              {state.members.map((m) => (
                <div key={m.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center shrink-0">
                      <UserCircleIcon className="h-5 w-5 text-zinc-300" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-semibold text-white tracking-tight">{m.displayName}</p>
                      <p className="text-[11px] font-mono text-zinc-500">{m.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {m.isCurrentSession && (
                      <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-300">current session</span>
                    )}
                    <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded ${ROLE_PILL[m.role]}`}>
                      {m.role.replace(/_/g, " ")}
                    </span>
                  </div>
                </div>
              ))}
              {state.members.length === 0 && (
                <p className="text-[12px] text-zinc-400">No members yet.</p>
              )}
            </div>
          </section>

          {/* Role catalog */}
          <section className="mb-8">
            <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em] mb-3">// role catalog</p>
            <div className="grid lg:grid-cols-2 gap-2">
              {state.roleCatalog.map((r) => (
                <div key={r.role} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                    <p className="text-[13.5px] font-semibold text-white tracking-tight">{r.label}</p>
                    <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded ${ROLE_PILL[r.role]}`}>
                      {r.role.replace(/_/g, " ")}
                    </span>
                  </div>
                  <p className="text-[12px] text-zinc-300 leading-relaxed mb-2">{r.description}</p>
                  <p className="text-[11px] text-zinc-400 italic leading-snug mb-2">{r.rationale}</p>
                  <div className="flex flex-wrap gap-1">
                    {r.permissions.map((p, i) => (
                      <span key={i} className="text-[10px] font-mono text-zinc-300 bg-white/[0.04] border border-white/[0.06] rounded px-1.5 py-0.5">
                        {PERMISSION_LABEL[p] ?? p}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Per-permission enforcement table */}
          <section className="mb-8">
            <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em] mb-3">// permission enforcement</p>
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
              <div className="divide-y divide-white/[0.04]">
                {Object.entries(state.enforcement).map(([perm, enf]) => {
                  const v = ENF_PILL[enf];
                  const Icon = v.icon;
                  return (
                    <div key={perm} className="flex items-center justify-between px-4 py-2.5">
                      <p className="text-[12.5px] text-zinc-200">{PERMISSION_LABEL[perm] ?? perm}</p>
                      <span className={`inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded ${v.pill}`}>
                        <Icon className="h-3 w-3" />
                        {v.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Contract footer */}
          <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.04] p-5 mb-8 flex items-start gap-3">
            <ShieldCheckIcon className="h-5 w-5 text-emerald-300 mt-0.5 shrink-0" />
            <div>
              <p className="text-[11px] font-mono text-emerald-300/80 uppercase tracking-[0.18em] mb-1">// rbac contract</p>
              <p className="text-[13px] text-emerald-100 font-semibold leading-snug">
                safetyContract = <code className="font-mono text-[12px] bg-black/30 border border-white/[0.06] rounded px-1.5 py-px">{state.safetyContract}</code>
              </p>
              <p className="text-[12px] text-zinc-300 leading-relaxed mt-1">
                {state.limitations[2]} {state.limitations[0]}
              </p>
              <div className="mt-3">
                <Link href={state.safeNextAction.href} className="inline-flex items-center gap-1.5 text-[12px] font-medium text-emerald-200 hover:text-emerald-100 border border-emerald-500/30 bg-emerald-500/[0.06] rounded-md px-3 py-1.5 transition-colors">
                  {state.safeNextAction.label} →
                </Link>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-bold tracking-tight ${tone}`}>{value}</p>
    </div>
  );
}
