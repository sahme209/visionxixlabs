/**
 * /dashboard/team — workspace members.
 *
 * Today: shows the signed-in user as the workspace owner and surfaces
 * the invitation flow as 'coming soon' so operators know team support
 * exists at the platform level. Real invitations require a
 * WorkspaceInvitation schema migration which we ship in a follow-up.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { currentContext } from "@/lib/auth/currentContext";
import { ArrowRightIcon } from "@heroicons/react/24/outline";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.email) {
    redirect("/auth/signin?callbackUrl=/dashboard/team");
  }

  return (
    <div className="max-w-3xl mx-auto px-1 -mt-2">
      <header className="mb-12">
        <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-3">team</p>
        <h1 className="text-[34px] sm:text-[40px] leading-[1.05] font-semibold text-white tracking-[-0.03em] mb-3">
          Who&apos;s in this workspace.
        </h1>
        <p className="text-[15px] text-zinc-400 leading-relaxed max-w-xl">
          Single-user today. Multi-user workspaces with role-based access
          control land in a follow-up — same workspace id, same connected
          accounts, just more operators.
        </p>
      </header>

      <section className="mb-10">
        <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-3">members</p>
        <ul className="rounded-2xl border border-white/[0.06] bg-white/[0.015] divide-y divide-white/[0.04] overflow-hidden">
          <li className="px-6 py-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/[0.06] flex items-center justify-center shrink-0 text-[12px] font-semibold text-zinc-300">
              {ctx.email.slice(0, 1).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-medium text-white">{ctx.email}</p>
              <p className="text-[11px] font-mono uppercase tracking-wider text-emerald-300 mt-0.5">owner · you</p>
            </div>
          </li>
        </ul>
      </section>

      <section className="mb-10">
        <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-3">invite a teammate</p>
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] px-6 py-5">
          <p className="text-[13px] text-zinc-300 mb-1">Coming soon.</p>
          <p className="text-[11px] text-zinc-500 leading-relaxed max-w-md">
            The platform&apos;s data model is already multi-tenant; the
            invitation flow + email + role assignment land together in a
            future commit. Today the workspace owner is the only operator.
          </p>
        </div>
      </section>

      <Link
        href="/dashboard/settings"
        className="inline-flex items-center gap-1.5 text-[12px] text-zinc-500 hover:text-white transition-colors"
      >
        <ArrowRightIcon className="h-3.5 w-3.5 rotate-180" />
        Back to settings
      </Link>
    </div>
  );
}
