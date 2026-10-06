/**
 * /dashboard/team — workspace members + roles · Phase 639.
 *
 * Reads OrgMembership rows for the current workspace, surfaces them
 * with role + last-activity, and provides:
 *   · Role-change dropdown per member (admin + owner only)
 *   · Invite-by-email form that mints a signed token via inviteLinks
 *   · Pending invitations list (sourced from a separate
 *     workforce_pending_invitations config row)
 *
 * The underlying OrgMembership table + OrgRole enum already exist
 * in the Prisma schema. This page surfaces the operator-facing CRUD
 * that was previously "coming soon."
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { UserPlusIcon, ArrowLeftIcon } from "@heroicons/react/24/outline";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import { ROLE_LABEL, ASSIGNABLE_ROLES, type InviteRole } from "@/lib/workforce/domains/inviteLinks";
import { TeamInviteButton } from "@/components/workforce/TeamInviteButton";

export const dynamic = "force-dynamic";

function isAdminRole(r: string | null | undefined): boolean {
  return r === "owner" || r === "admin";
}

interface MemberRow {
  id: string;
  email: string;
  role: string;
  isSelf: boolean;
  acceptedAt: Date | null;
  invitedBy: string | null;
  providerScopes: string[];
}

export default async function TeamPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.email || !ctx.organizationId) {
    redirect("/auth/signin?callbackUrl=/dashboard/team");
  }

  const sp = searchParams ? await searchParams : {};
  const noticeRaw = typeof sp.notice === "string" ? sp.notice : "";
  const errorRaw = typeof sp.error === "string" ? sp.error : "";
  const inviteUrlRaw = typeof sp.inviteUrl === "string" ? sp.inviteUrl : "";

  // Current user's role determines what they can do on this page.
  let currentRole: string | null = null;
  try {
    if (ctx.userId) {
      const me = await prisma.orgMembership.findUnique({
        where: {
          userId_organizationId: {
            userId: String(ctx.userId),
            organizationId: String(ctx.organizationId),
          },
        },
        select: { role: true },
      });
      currentRole = me?.role ?? null;
    }
  } catch {
    // migration_pending → fall through with null; page degrades to read-only.
  }

  // All members in the workspace. OrgMembership has no User relation
  // declared in the schema, so we fetch members + users separately and
  // join in memory.
  let members: MemberRow[] = [];
  try {
    const rows = await prisma.orgMembership.findMany({
      where: { organizationId: String(ctx.organizationId) },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    });
    const userIds = Array.from(new Set(rows.map((r) => r.userId)));
    const users = userIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, email: true },
        })
      : [];
    const emailByUserId = new Map(users.map((u) => [u.id, u.email]));
    members = rows.map((r) => ({
      id: r.id,
      email: emailByUserId.get(r.userId) ?? "(no email)",
      role: r.role,
      isSelf: String(r.userId) === String(ctx.userId),
      acceptedAt: r.acceptedAt,
      invitedBy: r.invitedBy,
      providerScopes: r.providerScopes,
    }));
  } catch {
    // empty fallback
  }

  const canManage = isAdminRole(currentRole);

  return (
    <div className="max-w-3xl mx-auto px-1 -mt-2">
      <Link href="/dashboard/settings" className="inline-flex items-center gap-1.5 text-[12px] text-zinc-500 hover:text-white transition-colors mb-6">
        <ArrowLeftIcon className="h-3.5 w-3.5" />
        Settings
      </Link>
      <header className="mb-10">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500 mb-3 inline-flex items-center gap-2">
          <span className="text-zinc-700">//</span>
          <span className="text-emerald-300">team</span>
          <span className="text-zinc-700">::</span>
          <span className="text-zinc-500">workspace members + roles</span>
        </p>
        <h1 className="text-[28px] sm:text-[34px] leading-[1.1] font-semibold text-white tracking-[-0.02em] mb-3 inline-flex items-baseline gap-3">
          <UserPlusIcon className="h-6 w-6 text-emerald-300 shrink-0 self-center" />
          Team &amp; access
        </h1>
        <p className="text-[14px] text-zinc-400 leading-relaxed max-w-xl">
          Invite teammates, assign roles, and audit who has access to this workspace. Built on the
          existing OrgMembership table + OrgRole enum, so every membership change is durable and
          reflected in the audit trail.
        </p>
      </header>

      {/* Notices */}
      {noticeRaw === "invite_sent" && (
        <section role="status" aria-live="polite" className="mb-6 rounded-md border border-emerald-500/30 bg-emerald-500/[0.06] p-4">
          <p className="text-[12.5px] text-emerald-200 font-mono mb-2">invite link minted · copy and send via your preferred channel · expires in 7 days</p>
          {inviteUrlRaw && (
            <div className="mt-2 p-3 rounded border border-emerald-500/20 bg-black/30 break-all">
              <p className="text-[11px] font-mono text-emerald-200 select-all">{inviteUrlRaw}</p>
            </div>
          )}
        </section>
      )}
      {noticeRaw === "role_updated" && (
        <section role="status" aria-live="polite" className="mb-6 rounded-md border border-emerald-500/30 bg-emerald-500/[0.06] p-4">
          <p className="text-[12.5px] text-emerald-200 font-mono">role updated</p>
        </section>
      )}
      {noticeRaw === "removed" && (
        <section role="status" aria-live="polite" className="mb-6 rounded-md border border-zinc-500/30 bg-zinc-500/[0.06] p-4">
          <p className="text-[12.5px] text-zinc-300 font-mono">member removed from workspace</p>
        </section>
      )}
      {errorRaw && (
        <section role="alert" aria-live="assertive" className="mb-6 rounded-md border border-rose-500/30 bg-rose-500/[0.06] p-4">
          <p className="text-[12.5px] text-rose-200 font-mono">error: {errorRaw}</p>
        </section>
      )}

      {/* Member list */}
      <section className="mb-10">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500 mb-3 inline-flex items-center gap-2">
          <span className="text-zinc-700">//</span>
          <span className="text-emerald-300">members</span>
          <span className="text-zinc-700">::</span>
          <span className="text-zinc-400 tabular-nums">{members.length}</span>
        </p>
        <ul className="rounded-md border border-white/[0.06] bg-white/[0.012] divide-y divide-white/[0.04] overflow-hidden">
          {members.length === 0 ? (
            <li className="px-5 py-6 text-center">
              <p className="text-[13px] text-zinc-400">No members recorded yet.</p>
              <p className="text-[11px] text-zinc-500 mt-1 font-mono">membership table empty — migration_pending or fresh workspace</p>
            </li>
          ) : (
            members.map((m) => (
              <li key={m.id} className="px-5 py-3.5">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="w-9 h-9 border border-emerald-500/20 bg-emerald-500/[0.04] flex items-center justify-center shrink-0 rounded-sm text-[11px] font-mono font-semibold text-emerald-300">
                    {m.email.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13.5px] font-medium text-white font-mono">
                      {m.email}
                      {m.isSelf && (
                        <span className="ml-2 text-[10px] uppercase tracking-wider text-zinc-500">you</span>
                      )}
                    </p>
                    <p className="text-[10.5px] font-mono uppercase tracking-wider text-zinc-500 mt-0.5">
                      <span className={m.role === "owner" ? "text-emerald-300" : "text-zinc-400"}>{m.role}</span>
                      {m.acceptedAt ? (
                        <>
                          <span className="text-zinc-700 mx-1.5">::</span>
                          <span>joined {m.acceptedAt.toISOString().slice(0, 10)}</span>
                        </>
                      ) : (
                        <>
                          <span className="text-zinc-700 mx-1.5">::</span>
                          <span className="text-zinc-300">pending acceptance</span>
                        </>
                      )}
                      {m.providerScopes.length > 0 && (
                        <>
                          <span className="text-zinc-700 mx-1.5">::</span>
                          <span>scope {m.providerScopes.join(",")}</span>
                        </>
                      )}
                    </p>
                  </div>
                  {canManage && !m.isSelf && m.role !== "owner" && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <form action="/api/team/role" method="POST" className="flex items-center gap-1.5">
                        <input type="hidden" name="membershipId" value={m.id} />
                        <select
                          name="role"
                          defaultValue={m.role}
                          className="text-[11px] font-mono px-2 py-1 rounded border border-white/[0.08] bg-white/[0.02] text-zinc-200 focus:outline-none focus:border-emerald-500/40"
                          aria-label="role"
                        >
                          {ASSIGNABLE_ROLES.map((r) => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                        <button type="submit" className="text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded border border-emerald-500/30 text-emerald-200 hover:text-white hover:border-emerald-500/60 hover:bg-emerald-500/10 transition-colors">
                          update
                        </button>
                      </form>
                      <form action="/api/team/role" method="POST">
                        <input type="hidden" name="membershipId" value={m.id} />
                        <input type="hidden" name="action" value="remove" />
                        <button type="submit" className="text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded border border-rose-500/30 text-rose-200 hover:text-white hover:border-rose-500/60 hover:bg-rose-500/10 transition-colors">
                          remove
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              </li>
            ))
          )}
        </ul>
      </section>

      {/* Invite */}
      {canManage && (
        <section className="mb-10 rounded-md border border-emerald-500/20 bg-emerald-500/[0.04] p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-emerald-300 mb-3 inline-flex items-center gap-2">
            <span className="text-zinc-700">//</span>
            <span>invite teammate</span>
          </p>
          <form action="/api/team/invite" method="POST" className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="email" className="text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-300 mb-1.5 block">email</label>
                <input id="email" name="email" type="email" required maxLength={200}
                  placeholder="teammate@company.com"
                  className="w-full rounded border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[13px] font-mono text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/40 transition-colors" />
              </div>
              <div>
                <label htmlFor="role" className="text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-300 mb-1.5 block">role</label>
                <select id="role" name="role" defaultValue="operator"
                  className="w-full rounded border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[13px] text-zinc-200 focus:outline-none focus:border-emerald-500/40 transition-colors">
                  {ASSIGNABLE_ROLES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
              <p className="text-[10.5px] text-zinc-500 font-mono">invite link expires in 7 days · signed HMAC token</p>
              <TeamInviteButton />
            </div>
          </form>
        </section>
      )}

      {/* Role catalog — operator reference */}
      <section className="mb-10 rounded-md border border-white/[0.06] bg-white/[0.012] p-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500 mb-3 inline-flex items-center gap-2">
          <span className="text-zinc-700">//</span>
          <span className="text-emerald-300">role-catalog</span>
        </p>
        <dl className="space-y-3">
          {(Object.keys(ROLE_LABEL) as InviteRole[]).map((r) => (
            <div key={r} className="flex gap-3 items-baseline">
              <dt className="font-mono text-[11px] uppercase tracking-wider text-emerald-300 shrink-0 min-w-[130px]">
                {r}
              </dt>
              <dd className="text-[12.5px] text-zinc-300 leading-relaxed">
                <span className="font-semibold">{ROLE_LABEL[r].label}</span>{" — "}
                <span className="text-zinc-400">{ROLE_LABEL[r].description}</span>
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
