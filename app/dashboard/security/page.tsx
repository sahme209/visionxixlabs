/**
 * /dashboard/security — real-data security posture.
 *
 * Replaces the prior SAMPLE_CREDS / SAMPLE_DESKTOPS demo with reads
 * against the canonical tables:
 *   - Lead.fullPayload.connectors → which connectors hold credentials,
 *     when each was last linked, what the status is
 *   - AxiomFinding (category = security) → recent security findings
 *     scoped to the tenant
 *   - AxiomApprovalItem (riskLevel = high) → high-risk decisions pending
 *   - SecureAuditRecord → recent security-relevant events
 *
 * Empty states render an honest 'nothing wired yet' card with a
 * single connect-cloud or run-scan CTA. No sample data anywhere.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import { ArrowRightIcon } from "@heroicons/react/24/outline";

export const dynamic = "force-dynamic";

type Severity = "info" | "low" | "medium" | "high" | "critical";

const SEVERITY_TONE: Record<Severity, string> = {
  critical: "text-rose-400",
  high:     "text-rose-300",
  medium:   "text-amber-300",
  low:      "text-zinc-400",
  info:     "text-zinc-500",
};

interface ConnectorCred {
  provider: string;
  status: string;
  linkedAt?: string;
  authMethod?: string;
  verifiedAccountId?: string;
}

interface SecurityFinding {
  id: string;
  severity: Severity;
  title: string;
  description: string;
  region: string;
  createdAt: Date;
}

interface SecurityAudit {
  id: string;
  action: string;
  outcome: string;
  occurredAt: Date;
  entityRef: string | null;
}

export default async function SecurityPage() {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId || !ctx.email) {
    redirect("/auth/signin?callbackUrl=/dashboard/security");
  }

  // Connector credentials — read from the user's cloud-operator Lead.
  const user = await prisma.user.findUnique({
    where: { email: ctx.email.toLowerCase() },
    select: { id: true },
  });
  const lead = await prisma.lead.findFirst({
    where: {
      source: "cloud-operator",
      OR: [
        ...(user?.id ? [{ userId: user.id }] : []),
        { email: ctx.email.toLowerCase() },
      ],
    },
    orderBy: { updatedAt: "desc" },
    select: { fullPayload: true },
  });
  const payload = (lead?.fullPayload as Record<string, unknown>) || {};
  const connectors = (payload.connectors as Record<string, unknown>) || {};
  const creds: ConnectorCred[] = [];
  for (const [provider, raw] of Object.entries(connectors)) {
    const meta = raw as Record<string, unknown>;
    creds.push({
      provider,
      status: String(meta.status ?? "unknown"),
      linkedAt: meta.linkedAt ? String(meta.linkedAt) : undefined,
      authMethod: meta.authMethod ? String(meta.authMethod) : undefined,
      verifiedAccountId: meta.verifiedAccountId ? String(meta.verifiedAccountId) : undefined,
    });
  }

  // Recent security findings.
  let recentSecurity: SecurityFinding[] = [];
  let highRiskPending = 0;
  let migrationPending = false;
  try {
    const findings = await prisma.axiomFinding.findMany({
      where: {
        run: { organizationId: ctx.organizationId },
        category: "security",
      },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        severity: true,
        title: true,
        description: true,
        region: true,
        createdAt: true,
      },
    });
    recentSecurity = findings.map((f) => ({
      id: f.id,
      severity: f.severity as Severity,
      title: f.title,
      description: f.description,
      region: f.region,
      createdAt: f.createdAt,
    }));
    highRiskPending = await prisma.axiomApprovalItem.count({
      where: {
        organizationId: ctx.organizationId,
        status: { in: ["pending", "snoozed"] },
        riskLevel: "high",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/relation .* does not exist|table .* does not exist/i.test(msg)) {
      migrationPending = true;
    }
  }

  // Recent security-relevant audit events.
  let recentAudits: SecurityAudit[] = [];
  try {
    const rows = await (prisma as unknown as {
      secureAuditRecord: {
        findMany: (args: unknown) => Promise<Array<SecurityAudit>>;
      };
    }).secureAuditRecord.findMany({
      where: {
        organizationId: ctx.organizationId,
        OR: [
          { action: { startsWith: "connector." } },
          { action: { startsWith: "approval." } },
          { action: { startsWith: "aws." } },
        ],
      },
      orderBy: { occurredAt: "desc" },
      take: 6,
      select: {
        id: true,
        action: true,
        outcome: true,
        occurredAt: true,
        entityRef: true,
      },
    });
    recentAudits = rows;
  } catch { /* migration_pending captured above */ }

  return (
    <div className="max-w-5xl mx-auto px-1 -mt-2">
      <header className="mb-12">
        <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-3">security</p>
        <h1 className="text-[34px] sm:text-[40px] leading-[1.05] font-semibold text-white tracking-[-0.03em] mb-3">
          Your posture, today.
        </h1>
        <p className="text-[15px] text-zinc-400 leading-relaxed max-w-xl">
          Reads from your real connectors, findings, approvals, and audit
          trail. Nothing on this page is sample data.
        </p>
      </header>

      {migrationPending && (
        <div className="mb-8 rounded-2xl border border-amber-500/15 bg-white/[0.015] px-6 py-5">
          <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-amber-300 mb-1">migration pending</p>
          <p className="text-[13px] text-zinc-300">
            Findings / approvals tables aren&apos;t migrated yet. Run <code className="font-mono text-white">prisma migrate deploy</code>.
          </p>
        </div>
      )}

      {/* Connector credentials */}
      <section className="mb-10">
        <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-3">connector credentials</p>
        {creds.length === 0 ? (
          <Link
            href="/dashboard/connect-cloud"
            className="group block rounded-2xl border border-white/[0.06] bg-white/[0.015] hover:border-white/[0.12] transition-colors px-7 py-7"
          >
            <p className="text-[14px] font-medium text-white mb-1">No connectors yet</p>
            <p className="text-[12px] text-zinc-500 leading-relaxed max-w-md mb-4">
              Credentials appear here when you link a cloud account. They&apos;re
              stored encrypted; only the assumed role is used during scans.
            </p>
            <span className="inline-flex items-center gap-2 text-[13px] font-medium text-zinc-200 group-hover:text-white">
              Connect a cloud
              <ArrowRightIcon className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
            </span>
          </Link>
        ) : (
          <ul className="rounded-2xl border border-white/[0.06] bg-white/[0.015] divide-y divide-white/[0.04] overflow-hidden">
            {creds.map((c) => {
              const linkedDate = c.linkedAt ? new Date(c.linkedAt) : null;
              const tone = c.status === "linked" ? "text-emerald-300" : c.status === "invalid" ? "text-rose-300" : "text-zinc-400";
              return (
                <li key={c.provider} className="px-6 py-4">
                  <div className="flex items-baseline justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-medium text-white">
                        {c.provider.toUpperCase()}
                        {c.verifiedAccountId && <span className="text-zinc-500 font-mono text-[12px]"> · {c.verifiedAccountId}</span>}
                      </p>
                      <p className="text-[11px] font-mono uppercase tracking-wider mt-0.5">
                        <span className={tone}>{c.status}</span>
                        {c.authMethod && <span className="text-zinc-600"> · {c.authMethod.replace(/-/g, " ")}</span>}
                      </p>
                    </div>
                    {linkedDate && (
                      <span className="text-[11px] text-zinc-500 shrink-0">
                        linked {linkedDate.toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Recent security findings */}
      <section className="mb-10">
        <div className="flex items-baseline justify-between mb-3">
          <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500">recent security findings</p>
          {recentSecurity.length > 0 && (
            <Link href="/dashboard/findings?q=security" className="text-[11px] text-zinc-500 hover:text-white transition-colors">
              All security findings
            </Link>
          )}
        </div>
        {recentSecurity.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] px-6 py-8 text-center">
            <p className="text-[13px] text-zinc-300 mb-1">No security findings yet</p>
            <p className="text-[11px] text-zinc-500 leading-relaxed max-w-md mx-auto">
              Run a scan from the dashboard to populate findings. Security-category
              rows from your real scan show up here.
            </p>
          </div>
        ) : (
          <ul className="rounded-2xl border border-white/[0.06] bg-white/[0.015] divide-y divide-white/[0.04] overflow-hidden">
            {recentSecurity.map((f) => (
              <li key={f.id}>
                <Link
                  href={`/dashboard/findings/${f.id}`}
                  className="group block px-6 py-4 hover:bg-white/[0.015] transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1 text-[10px] font-mono uppercase tracking-wider">
                    <span className={SEVERITY_TONE[f.severity]}>{f.severity}</span>
                    <span className="text-zinc-600">· {f.region}</span>
                  </div>
                  <p className="text-[14px] font-medium text-white">{f.title}</p>
                  <p className="text-[12px] text-zinc-500 leading-relaxed mt-1 line-clamp-2">{f.description}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* High-risk approvals counter */}
      <section className="mb-10">
        <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-3">high-risk approvals</p>
        <Link
          href="/dashboard/approvals"
          className="group block rounded-2xl border border-white/[0.06] bg-white/[0.015] hover:border-white/[0.12] transition-colors px-7 py-5"
        >
          <div className="flex items-baseline justify-between gap-4">
            <div>
              <p className={`text-[24px] font-semibold tabular-nums ${highRiskPending > 0 ? "text-amber-300" : "text-white"}`}>
                {highRiskPending}
              </p>
              <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-zinc-500 mt-1">
                pending decisions with high-risk classification
              </p>
            </div>
            <ArrowRightIcon className="h-4 w-4 text-zinc-600 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
          </div>
        </Link>
      </section>

      {/* Recent audit events */}
      <section className="mb-10">
        <div className="flex items-baseline justify-between mb-3">
          <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500">recent security events</p>
          <Link href="/dashboard/audit" className="text-[11px] text-zinc-500 hover:text-white transition-colors">
            Full audit
          </Link>
        </div>
        {recentAudits.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] px-6 py-6 text-center">
            <p className="text-[12px] text-zinc-500">No security-relevant events yet.</p>
          </div>
        ) : (
          <ul className="rounded-2xl border border-white/[0.06] bg-white/[0.015] divide-y divide-white/[0.04] overflow-hidden">
            {recentAudits.map((a) => {
              const tone = a.outcome === "success" ? "text-emerald-300"
                         : a.outcome === "failure" ? "text-rose-300"
                         : a.outcome === "blocked" ? "text-amber-300"
                         : "text-zinc-400";
              return (
                <li key={a.id} className="px-6 py-3 flex items-center gap-3">
                  <span className={`text-[10px] font-mono uppercase tracking-wider ${tone} w-14 shrink-0`}>{a.outcome}</span>
                  <span className="text-[12px] font-mono text-zinc-300 truncate flex-1 min-w-0">
                    {a.action}
                    {a.entityRef && <span className="text-zinc-600"> · {a.entityRef}</span>}
                  </span>
                  <span className="text-[10px] font-mono text-zinc-600 shrink-0">
                    {Math.floor((Date.now() - a.occurredAt.getTime()) / 60000)}m ago
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
