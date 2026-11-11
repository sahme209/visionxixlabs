/**
 * /control/members — workspace members · Phase 639.
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

import { redirect } from "next/navigation";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import { ROLE_LABEL, ASSIGNABLE_ROLES, type InviteRole } from "@/lib/workforce/domains/inviteLinks";
import { BROWSER_NAVIGATION_FIELDS, matchesBrowserNavigationMembership, parseBrowserNavigationArrival, parseBrowserNavigationIntent } from "@/lib/desktop/browserNavigationIntent";
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
  const sp = searchParams ? await searchParams : {};
  const navigationRequested = Object.hasOwn(sp, "desktopNavigation") || BROWSER_NAVIGATION_FIELDS.some(key => Object.hasOwn(sp, key));
  const navigation = navigationRequested ? parseBrowserNavigationArrival(sp, Date.now()) : null;
  const blocked = <section role="status"><h1>Return to desktop Permissions</h1><p>Your browser account, workspace or membership has changed, or this navigation request expired. No member controls are available through this request.</p></section>;
  if (navigationRequested && !navigation) return blocked;
  const ctx = await currentContext();
  if (navigation) {
    if (!ctx.isAuthenticated || !ctx.sessionUserId || String(ctx.sessionUserId) !== navigation.expectedUserId || String(ctx.organizationId ?? "") !== navigation.organizationId || !ctx.roles.length) return blocked;
    try {
      const ownMembership = await prisma.orgMembership.findUnique({ where: { userId_organizationId: { userId: navigation.expectedUserId, organizationId: navigation.organizationId } }, select: { acceptedAt: true, updatedAt: true } });
      if (!matchesBrowserNavigationMembership(navigation, ownMembership) || !parseBrowserNavigationIntent(navigation, Date.now())) return blocked;
    } catch { return blocked; }
  }
  if (ctx.isAuthenticated && !ctx.organizationId) redirect("/control/workspaces");
  if (!ctx.isAuthenticated || !ctx.email || !ctx.organizationId) {
    redirect("/auth/signin?callbackUrl=/control/members");
  }

  if (!ctx.roles.length) return <p role="alert">A current workspace membership is required to view organization members.</p>;

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
        select: { role: true, acceptedAt: true },
      });
      currentRole = me?.acceptedAt ? me.role : null;
    }
  } catch {
    // migration_pending → fall through with null; page degrades to read-only.
  }

  // All members in the workspace. OrgMembership has no User relation
  // declared in the schema, so we fetch members + users separately and
  // join in memory.
  let members: MemberRow[] = [];
  let membersUnavailable = false;
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
    membersUnavailable = true;
  }

  if (navigation && !parseBrowserNavigationIntent(navigation, Date.now())) return blocked;
  const canManage = !membersUnavailable && isAdminRole(currentRole);
  // Ask Axiom access requests (last 30 days). Requests are notifications; admins change roles below.
  const accessRequests = canManage ? await Promise.resolve().then(() => prisma.auditEvent.findMany({ where: { organizationId: String(ctx.organizationId), kind: "access.requested", createdAt: { gte: new Date(Date.now() - 30 * 86_400_000) } }, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, summary: true, detailJson: true, createdAt: true } })).catch(() => []) : [];

  return (
    <div className="w-full min-w-0">
      <header className="mb-7"><h1>Members</h1><p className="mt-3 text-sm leading-6 text-zinc-400">Invite teammates and manage roles in your workspace.</p></header>

      {accessRequests.length > 0 && (
        <section aria-label="Access requests" className="mb-6 rounded-md border border-sky-400/20 bg-sky-400/4 p-4">
          <h2 className="text-sm font-medium text-zinc-100">Access requests</h2>
          <p className="mt-1 text-xs text-zinc-400">Members asked through Ask Axiom. Nothing has changed; adjust a role below if you agree.</p>
          <ul className="mt-3 space-y-2">{accessRequests.map((r) => {
            const reason = (r.detailJson as { reason?: unknown } | null)?.reason;
            return <li key={r.id} className="text-sm text-zinc-300">{r.summary} <span className="text-xs text-zinc-500">· {r.createdAt.toISOString().slice(0, 10)}</span>{typeof reason === "string" && <p className="text-xs text-zinc-500">“{reason}”</p>}</li>;
          })}</ul>
        </section>
      )}

      {/* Notices */}
      {noticeRaw === "invite_sent" && (
        <section role="status" aria-live="polite" className="mb-6 rounded-md border border-emerald-500/30 bg-emerald-500/6 p-4">
          <p className="text-[12.5px] text-emerald-200 mb-2">Invitation link created. Copy and share it with your teammate. It expires in 7 days.</p>
          {inviteUrlRaw && (
            <div className="mt-2 p-3 rounded-sm border border-emerald-500/20 bg-black/30 break-all">
              <p className="text-[11px] text-emerald-200 select-all">{inviteUrlRaw}</p>
            </div>
          )}
        </section>
      )}
      {noticeRaw === "role_updated" && (
        <section role="status" aria-live="polite" className="mb-6 rounded-md border border-emerald-500/30 bg-emerald-500/6 p-4">
          <p className="text-[12.5px] text-emerald-200 ">Role updated.</p>
        </section>
      )}
      {noticeRaw === "removed" && (
        <section role="status" aria-live="polite" className="mb-6 rounded-md border border-zinc-500/30 bg-zinc-500/6 p-4">
          <p className="text-[12.5px] text-zinc-300 ">Member removed from workspace.</p>
        </section>
      )}
      {errorRaw && (
        <section role="alert" aria-live="assertive" className="mb-6 rounded-md border border-rose-500/30 bg-rose-500/6 p-4">
          <p className="text-[12.5px] text-rose-200 ">{errorRaw === "audit_unconfirmed" ? "The request may already have completed, but its audit record was not confirmed. Review current workspace state before retrying. Invitation links are shown only after audit confirmation." : errorRaw === "governance_enrolled_privilege_increase" ? "This workspace is enrolled in Governance, so promotions and new invitations wait until membership changes have reviewed Governance coverage. Demoting or removing members still works. Nothing was changed." : `Error: ${errorRaw}`}</p>
        </section>
      )}

      {/* Member list */}
      <section className="mb-6" aria-label="Workspace members">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium text-zinc-100">Workspace members</h2>
          <span className="text-xs tabular-nums text-zinc-500">{membersUnavailable ? "Unavailable" : `${members.length} ${members.length === 1 ? "member" : "members"}`}</span>
        </div>
        <ul className="rounded-xl border border-white/8 bg-white/1.5 divide-y divide-white/6 overflow-hidden">
          {membersUnavailable ? <li role="alert" className="px-5 py-6 text-sm text-zinc-300">Member records are temporarily unavailable. Refresh to retry; no member count or empty workspace is inferred.</li> : members.length === 0 ? (
            <li className="px-5 py-6 text-center">
              <p className="text-[13px] text-zinc-400">No members recorded yet.</p>
              <p className="text-[11px] text-zinc-500 mt-1 ">Invite a teammate when you are ready.</p>
            </li>
          ) : (
            members.map((m) => (
              <li key={m.id} className="px-5 py-3.5">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="w-8 h-8 border border-white/10 bg-white/4 flex items-center justify-center shrink-0 rounded-full text-xs font-medium text-zinc-300">
                    {m.email.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="break-all text-[13px] font-medium text-zinc-100">
                      {m.email}
                      {m.isSelf && (
                        <span className="ml-2 text-xs text-zinc-500">you</span>
                      )}
                    </p>
                    <p className="text-xs text-zinc-500 mt-1">
                      <span className="text-zinc-400">{ROLE_LABEL[m.role as InviteRole]?.label ?? m.role}</span>
                      {m.acceptedAt ? (
                        <>
                          <span className="text-zinc-700 mx-1.5">·</span>
                          <span>joined {m.acceptedAt.toISOString().slice(0, 10)}</span>
                        </>
                      ) : (
                        <>
                          <span className="text-zinc-700 mx-1.5">·</span>
                          <span className="text-zinc-300">pending acceptance</span>
                        </>
                      )}
                      {m.providerScopes.length > 0 && (
                        <>
                          <span className="text-zinc-700 mx-1.5">·</span>
                          <span>scope {m.providerScopes.join(",")}</span>
                        </>
                      )}
                    </p>
                  </div>
                  {canManage && !m.isSelf && m.role !== "owner" && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <form action="/api/team/role" method="POST" className="flex items-center gap-1.5">
                        {navigation && <><input type="hidden" name="returnIntent" value="members_handoff" />{BROWSER_NAVIGATION_FIELDS.map(key => <input key={key} type="hidden" name={key} value={navigation[key]} />)}</>}
                        <input type="hidden" name="membershipId" value={m.id} />
                        <select
                          name="role"
                          defaultValue={m.role}
                          className="h-8 rounded-lg border border-white/10 bg-[#171717] px-2 text-xs text-zinc-200 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-zinc-400"
                          aria-label={`Role for ${m.email}`}
                        >
                          {ASSIGNABLE_ROLES.map((r) => (
                            <option key={r} value={r}>{ROLE_LABEL[r].label}</option>
                          ))}
                        </select>
                        <button type="submit" className="h-8 rounded-lg border border-white/10 px-3 text-xs text-zinc-200 hover:bg-white/6 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-zinc-400">
                          Update
                        </button>
                      </form>
                      <form action="/api/team/role" method="POST">
                        {navigation && <><input type="hidden" name="returnIntent" value="members_handoff" />{BROWSER_NAVIGATION_FIELDS.map(key => <input key={key} type="hidden" name={key} value={navigation[key]} />)}</>}
                        <input type="hidden" name="membershipId" value={m.id} />
                        <input type="hidden" name="action" value="remove" />
                        <button type="submit" className="h-8 rounded-lg border border-white/10 px-3 text-xs text-rose-300 hover:bg-rose-500/10 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-rose-400">
                          Remove
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
      {canManage && !navigation && (
        <section className="mb-6 rounded-xl border border-white/8 bg-white/1.5 p-5">
          <h2 className="text-sm font-medium text-zinc-100">Invite a teammate</h2>
          <p className="mb-4 mt-1 text-xs leading-5 text-zinc-500">Create an invitation link with the appropriate workspace role.</p>
          <form action="/api/team/invite" method="POST" className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="email" className="text-xs text-zinc-400 mb-1.5 block">Email address</label>
                <input id="email" name="email" type="email" required maxLength={200}
                  placeholder="teammate@company.com"
                  className="w-full rounded-sm border border-white/6 bg-white/2 px-3 py-2 text-[13px] text-zinc-200 placeholder:text-zinc-600 focus:outline-hidden focus:border-emerald-500/40 transition-colors" />
              </div>
              <div>
                <label htmlFor="role" className="text-xs text-zinc-400 mb-1.5 block">Workspace role</label>
                <select id="role" name="role" defaultValue="operator"
                  className="w-full rounded-sm border border-white/6 bg-white/2 px-3 py-2 text-[13px] text-zinc-200 focus:outline-hidden focus:border-emerald-500/40 transition-colors">
                  {ASSIGNABLE_ROLES.map((r) => (
                    <option key={r} value={r}>{ROLE_LABEL[r].label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
              <p className="text-[10.5px] text-zinc-500 ">Invitation links expire after 7 days. Share the link directly with your teammate.</p>
              <TeamInviteButton />
            </div>
          </form>
        </section>
      )}

      <details className="mb-6 rounded-xl border border-white/8 bg-white/1.5 p-5">
        <summary className="cursor-pointer text-sm font-medium text-zinc-200 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-zinc-400">Role permissions</summary>
        <dl className="mt-4 space-y-4">
          {(Object.keys(ROLE_LABEL) as InviteRole[]).map((r) => (
            <div key={r} className="grid gap-1 sm:grid-cols-[150px_1fr] sm:gap-4">
              <dt className="text-xs font-medium text-zinc-200">{ROLE_LABEL[r].label}</dt>
              <dd className="text-xs leading-5 text-zinc-500">{ROLE_LABEL[r].description}</dd>
            </div>
          ))}
        </dl>
      </details>
    </div>
  );
}
