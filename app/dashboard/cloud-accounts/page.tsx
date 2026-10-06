/**
 * /dashboard/cloud-accounts — the canonical list of connected clouds.
 *
 * Reads CloudAccount rows scoped by org. Each row links to a per-
 * account detail page (/dashboard/cloud-accounts/[id]) showing scan
 * history, scheduled-scan config, and current finding counts.
 *
 * Empty state points at /dashboard/connect-cloud — no fake "demo
 * account" rows seeded. The multi-cloud projector page handles
 * aggregate posture; this one is the raw account inventory.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { currentContext } from "@/lib/auth/currentContext";
import { isAdminOrOwner } from "@/lib/auth/platformAdmin";
import { CloudIcon, ArrowRightIcon } from "@heroicons/react/24/outline";
import { CloudAccountToggle } from "./CloudAccountToggle";

export const dynamic = "force-dynamic";

export default async function CloudAccountsPage() {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    redirect("/auth/signin?callbackUrl=/dashboard/cloud-accounts");
  }
  const isAdmin = isAdminOrOwner({ email: ctx.email, roles: ctx.roles });

  let accounts: Array<{
    id: string;
    provider: string;
    externalAccountId: string;
    alias: string | null;
    regions: string[];
    enabled: boolean;
    lastScannedAt: Date | null;
    connectedAt: Date;
  }> = [];
  let migrationPending = false;
  try {
    accounts = await prisma.cloudAccount.findMany({
      where: { organizationId: ctx.organizationId },
      orderBy: [{ enabled: "desc" }, { connectedAt: "desc" }],
      select: {
        id: true,
        provider: true,
        externalAccountId: true,
        alias: true,
        regions: true,
        enabled: true,
        lastScannedAt: true,
        connectedAt: true,
      },
    }) as typeof accounts;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/relation .* does not exist|table .* does not exist/i.test(msg)) {
      migrationPending = true;
    } else {
      throw err;
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-1 -mt-2">
      <header className="mb-12">
        <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-3">cloud accounts</p>
        <h1 className="text-[34px] sm:text-[40px] leading-[1.05] font-semibold text-white tracking-[-0.03em] mb-3">
          Every cloud you&apos;ve connected.
        </h1>
        <p className="text-[15px] text-zinc-400 leading-relaxed max-w-xl mb-4">
          One row per CloudAccount in your tenant. Click any row to see
          its scan history, scheduled-scan config, and the findings it&apos;s
          currently producing.
        </p>
        {accounts.length > 1 && (
          <Link
            href="/dashboard/cloud-accounts/compare"
            className="text-[11px] font-mono text-zinc-500 hover:text-white transition-colors"
          >
            compare accounts →
          </Link>
        )}
      </header>

      {migrationPending && (
        <div className="mb-8 rounded-2xl border border-amber-500/15 bg-white/[0.015] px-6 py-5">
          <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-amber-300 mb-1">migration pending</p>
          <p className="text-[13px] text-zinc-300">
            CloudAccount table not migrated. Run <code className="font-mono text-white">prisma migrate deploy</code>.
          </p>
        </div>
      )}

      {!migrationPending && accounts.length === 0 && (
        <Link
          href="/dashboard/connect-cloud"
          className="group block rounded-2xl border border-white/[0.06] bg-white/[0.015] hover:border-white/[0.12] transition-colors px-7 py-12 text-center"
        >
          <CloudIcon className="h-8 w-8 text-zinc-600 mx-auto mb-4" />
          <p className="text-[15px] font-semibold text-white mb-1">No clouds connected yet</p>
          <p className="text-[12px] text-zinc-500 leading-relaxed max-w-md mx-auto mb-5">
            Connect AWS via CloudFormation, Azure via service principal, or GCP via Cloud Shell. We never write to your cloud without an approval.
          </p>
          <span className="inline-flex items-center gap-2 text-[13px] font-medium text-zinc-200 group-hover:text-white">
            Connect a cloud
            <ArrowRightIcon className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
          </span>
        </Link>
      )}

      {accounts.length > 0 && (
        <ul className="rounded-2xl border border-white/[0.06] bg-white/[0.015] divide-y divide-white/[0.04] overflow-hidden">
          {accounts.map((a) => (
            <li key={a.id}>
              <Link
                href={`/dashboard/cloud-accounts/${a.id}`}
                className="group flex items-start justify-between gap-4 px-6 py-4 hover:bg-white/[0.015] transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap text-[10px] font-mono uppercase tracking-wider">
                    <CloudAccountToggle cloudAccountId={a.id} enabled={a.enabled} isAdmin={isAdmin} />
                    <span className={a.enabled ? "text-emerald-300" : "text-zinc-500"}>{a.enabled ? "enabled" : "disabled"}</span>
                    <span className="text-zinc-500">·</span>
                    <span className="text-zinc-300">{a.provider}</span>
                    {a.regions.length > 0 && (
                      <>
                        <span className="text-zinc-500">·</span>
                        <span className="text-zinc-500">{a.regions.length} region{a.regions.length === 1 ? "" : "s"}</span>
                      </>
                    )}
                  </div>
                  <p className="text-[14px] font-medium text-white">
                    {a.alias ?? a.externalAccountId}
                  </p>
                  <p className="text-[12px] font-mono text-zinc-600 mt-1 truncate">
                    {a.externalAccountId}
                  </p>
                  <p className="text-[11px] text-zinc-500 mt-1">
                    {a.lastScannedAt
                      ? `Last scanned ${a.lastScannedAt.toLocaleDateString()}`
                      : "Never scanned"}
                    {" · "}connected {a.connectedAt.toLocaleDateString()}
                  </p>
                </div>
                <ArrowRightIcon className="h-3.5 w-3.5 text-zinc-600 group-hover:text-white group-hover:translate-x-0.5 transition-all mt-1 shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
