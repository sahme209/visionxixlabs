import { redirect } from "next/navigation";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import { BROWSER_NAVIGATION_FIELDS, browserNavigationIntentPath, browserNavigationMembersPath, matchesBrowserNavigationMembership, parseBrowserNavigationIntent } from "@/lib/desktop/browserNavigationIntent";
export const dynamic = "force-dynamic";
/** Advisory navigation only. No token, session issuance, grant or automatic workspace selection. */
export default async function OpenControlPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
 const hint = parseBrowserNavigationIntent(await searchParams, Date.now());
 if (!hint) return <Message text="This navigation request is invalid or expired. Return to desktop and open it again." />;
 const ctx = await currentContext();
 if (!ctx.isAuthenticated) return <section><h1>Sign in to continue</h1><p>Use the same Axiom account as your desktop. This request does not sign you in or grant access.</p><a href={`/auth/signin?callbackUrl=${encodeURIComponent(browserNavigationIntentPath(hint))}`}>Sign in</a></section>;
 // Do not query or reveal target membership details for another browser account.
 if (!ctx.sessionUserId || String(ctx.sessionUserId) !== hint.expectedUserId) return <Message text="This browser uses a different account. Sign in with your desktop account, then reopen this request. No workspace was changed." />;
 let membership;
 try { membership = await prisma.orgMembership.findUnique({ where: { userId_organizationId: { userId: hint.expectedUserId, organizationId: hint.organizationId } }, select: { acceptedAt: true, updatedAt: true } }); }
 catch { return <Message text="Workspace access could not be confirmed. Return to desktop and try again. No workspace was changed." />; }
 if (!parseBrowserNavigationIntent(hint, Date.now())) return <Message text="This navigation request expired. Return to desktop and open it again." />;
 if (!matchesBrowserNavigationMembership(hint, membership)) return <Message text="Current workspace membership could not be confirmed or has changed. Refresh Permissions in desktop before continuing." />;
 if (String(ctx.organizationId ?? "") === hint.organizationId && ctx.roles.length) redirect(browserNavigationMembersPath(hint));
 return <section><h1>Choose the desktop workspace</h1><p>Your browser currently has a different workspace selected. Continue only if you want to use the desktop workspace shown below.</p><p>Workspace · {hint.organizationId.slice(-8)}</p><p>This changes only your browser selection. It does not grant a role or change desktop work.</p><form action="/api/account/workspace" method="post"><input type="hidden" name="returnIntent" value="members_handoff" />{BROWSER_NAVIGATION_FIELDS.map(key => <input key={key} type="hidden" name={key} value={hint[key]} />)}<button type="submit">Use this workspace</button></form></section>;
}
function Message({ text }: { text: string }) { return <section role="status"><h1>Continue in Axiom Control</h1><p>{text}</p></section>; }
