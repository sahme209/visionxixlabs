import { redirect } from "next/navigation";

import { currentContext } from "@/lib/auth/currentContext";
import { isAdminOrOwner } from "@/lib/auth/platformAdmin";
import { prisma } from "@/lib/db";
import { OrganizationSessionsPanel } from "./OrganizationSessionsPanel";

export const dynamic = "force-dynamic";

const outcomeTone: Record<string, string> = {
  success: "text-emerald-300",
  failure: "text-rose-300",
  blocked: "text-orange-300",
};

export default async function AuditSecurityPage() {
  const context = await currentContext();
  if (!context.isAuthenticated || !context.organizationId) redirect("/auth/signin?callbackUrl=/control/audit-security");
  const canManage = isAdminOrOwner({ email: context.email, roles: context.roles });

  if (!canManage) {
    return (
      <div className="max-w-4xl">
        <p className="text-[11px] uppercase tracking-[0.2em] text-[#ff783d]">Audit &amp; Security</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.045em]">Administrative access required.</h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-400">Organization audit evidence and device revocation are available only to a current owner or administrator. Authority is rechecked by the backend on every request.</p>
      </div>
    );
  }

  const organizationId = String(context.organizationId);
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [records, activeSessions, blockedLastDay, failuresLastDay] = await Promise.all([
    prisma.secureAuditRecord.findMany({
      where: { organizationId },
      orderBy: { occurredAt: "desc" },
      take: 100,
      select: { id: true, action: true, outcome: true, actorKind: true, actorUserId: true, entityRef: true, correlationId: true, source: true, occurredAt: true, errorCode: true },
    }),
    prisma.desktopSessionRecord.count({ where: { organizationId, revokedAt: null, expiresAt: { gt: new Date() } } }),
    prisma.secureAuditRecord.count({ where: { organizationId, outcome: "blocked", occurredAt: { gte: since } } }),
    prisma.secureAuditRecord.count({ where: { organizationId, outcome: "failure", occurredAt: { gte: since } } }),
  ]);

  return (
    <div className="max-w-5xl">
      <p className="text-[11px] uppercase tracking-[0.2em] text-[#ff783d]">Audit &amp; Security</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">Evidence, not estimates.</h1>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-400">Real organization-scoped policy decisions, protected operations, and paired-device state. Axiom displays no simulated security scores.</p>

      <dl className="mt-10 grid gap-px overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.08] sm:grid-cols-3">
        {[["Active desktop sessions", activeSessions], ["Blocked · last 24h", blockedLastDay], ["Failures · last 24h", failuresLastDay]].map(([label, value]) => (
          <div key={String(label)} className="bg-[#171717] p-5"><dt className="text-xs text-zinc-500">{label}</dt><dd className="mt-3 text-2xl font-medium tabular-nums">{value}</dd></div>
        ))}
      </dl>

      <OrganizationSessionsPanel />

      <section className="border-t border-white/[0.08] py-8" aria-labelledby="audit-events-heading">
        <h2 id="audit-events-heading" className="text-base font-medium">Recent audit evidence</h2>
        <p className="mt-2 text-sm text-zinc-500">Latest 100 append-only records for this organization. Correlation IDs connect decisions to execution logs.</p>
        {records.length === 0 ? <p className="mt-5 text-sm text-zinc-500">No audit records have been written for this organization.</p> : (
          <ul className="mt-5 divide-y divide-white/[0.07] border-y border-white/[0.07]">
            {records.map((record) => (
              <li key={record.id} className="grid gap-3 py-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className={(outcomeTone[record.outcome] ?? "text-zinc-400") + " uppercase tracking-[0.12em]"}>{record.outcome}</span>
                    <span className="text-zinc-300">{record.action}</span>
                    {record.errorCode && <span className="text-rose-300">{record.errorCode}</span>}
                  </div>
                  <p className="mt-2 truncate font-mono text-[11px] text-zinc-600">{record.entityRef ?? "organization"} · {record.correlationId}</p>
                  <p className="mt-1 text-xs text-zinc-600">{record.actorKind}{record.actorUserId ? ` · ${record.actorUserId}` : ""} · {record.source}</p>
                </div>
                <time className="text-xs text-zinc-600" dateTime={record.occurredAt.toISOString()}>{record.occurredAt.toLocaleString()}</time>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
