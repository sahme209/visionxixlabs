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

      <OrganizationSessionsPanel />

      <AuditEvidencePanel records={records.map(record => ({ ...record, occurredAt: record.occurredAt.toISOString() }))} />
    </div>
  );
}
