import { redirect } from "next/navigation";

import { currentContext } from "@/lib/auth/currentContext";
import { isAdminOrOwner } from "@/lib/auth/platformAdmin";
import { prisma } from "@/lib/db";
import { OrganizationSessionsPanel } from "./OrganizationSessionsPanel";
import { AuditEvidencePanel } from "@/components/cockpit/AuditEvidencePanel";

export const dynamic = "force-dynamic";

export default async function AuditSecurityPage() {
  const context = await currentContext();
  if (context.isAuthenticated && !context.organizationId) redirect("/control/workspaces");
  if (!context.isAuthenticated || !context.organizationId) redirect("/auth/signin?callbackUrl=/control/audit-security");
  const canManage = isAdminOrOwner({ email: context.email, roles: context.roles });

  if (!canManage) {
    return (
      <div className="w-full min-w-0">

        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.045em]">Administrative access required.</h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-400">Organization audit evidence and device revocation are available only to a current owner or administrator. Authority is rechecked by the backend on every request.</p>
      </div>
    );
  }

  const organizationId = String(context.organizationId);
  const now = new Date();
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const [records, activeSessions, blockedLastDay, failuresLastDay] = await Promise.all([
    prisma.secureAuditRecord.findMany({
      where: { organizationId },
      orderBy: { occurredAt: "desc" },
      take: 100,
      select: { id: true, action: true, outcome: true, actorKind: true, actorUserId: true, entityRef: true, correlationId: true, source: true, occurredAt: true, errorCode: true },
    }),
    prisma.desktopSessionRecord.count({ where: { organizationId, revokedAt: null, expiresAt: { gt: now } } }),
    prisma.secureAuditRecord.count({ where: { organizationId, outcome: "blocked", occurredAt: { gte: since } } }),
    prisma.secureAuditRecord.count({ where: { organizationId, outcome: "failure", occurredAt: { gte: since } } }),
  ]);

  return (
    <div className="w-full min-w-0">

      <h1 className="text-2xl font-medium">Audit &amp; security</h1>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-400">Review organization activity, policy decisions, and active desktop sessions.</p>

      <dl className="mt-6 grid gap-px overflow-hidden rounded-xl border border-white/8 bg-white/8 sm:grid-cols-3">
        {[["Active desktop sessions", activeSessions], ["Blocked · last 24h", blockedLastDay], ["Failures · last 24h", failuresLastDay]].map(([label, value]) => (
          <div key={String(label)} className="bg-[#171717] p-5"><dt className="text-xs text-zinc-500">{label}</dt><dd className="mt-3 text-2xl font-medium tabular-nums">{value}</dd></div>
        ))}
      </dl>

      <form action="/api/control/audit-security/export" method="get" aria-labelledby="audit-export-heading" className="mt-6 rounded-xl border border-white/8 bg-[#111111] p-4">
        <h2 id="audit-export-heading" className="text-sm font-medium">Export audit log</h2>
        <p className="mt-1 text-xs leading-5 text-zinc-400">Download this workspace&apos;s audit records for a security tool or an auditor: time, action, outcome, actor, subject and correlation ID, newest first, up to 10,000 records. The export itself is recorded.</p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-xs text-zinc-400">Period
            <select name="days" defaultValue="30" className="mt-1 block rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-zinc-100">
              <option value="1">Last 24 hours</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option>
            </select></label>
          <label className="text-xs text-zinc-400">Format
            <select name="format" defaultValue="csv" className="mt-1 block rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-zinc-100">
              <option value="csv">CSV (spreadsheets)</option><option value="ndjson">NDJSON (log tools)</option>
            </select></label>
          <button type="submit" className="inline-flex min-h-9 items-center rounded-lg border border-white/12 px-3 text-sm text-zinc-200 hover:bg-white/5">Download audit log</button>
        </div>
      </form>

      <OrganizationSessionsPanel />

      <AuditEvidencePanel records={records.map(record => ({ ...record, occurredAt: record.occurredAt.toISOString() }))} />
    </div>
  );
}
