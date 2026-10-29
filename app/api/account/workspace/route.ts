import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isSameOriginRequest } from "@/lib/auth/requestOrigin";
import { WORKSPACE_COOKIE } from "@/lib/auth/workspaceSelection";
import { BROWSER_NAVIGATION_FIELDS, browserNavigationIntentPath, matchesBrowserNavigationMembership, parseBrowserNavigationIntent } from "@/lib/desktop/browserNavigationIntent";
export const dynamic = "force-dynamic";
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ ok: false, error: "invalid_origin" }, { status: 403 });
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId || !session?.user?.email) return NextResponse.json({ ok: false, error: "authentication_required" }, { status: 401 });
  const form = await request.formData().catch(() => null);
  const organizationId = form?.get("organizationId");
  if (typeof organizationId !== "string" || !/^[A-Za-z0-9_-]{1,200}$/.test(organizationId)) return NextResponse.json({ ok: false, error: "invalid_workspace" }, { status: 400 });
  const extended = form?.has("returnIntent") || BROWSER_NAVIGATION_FIELDS.filter(key => key !== "organizationId").some(key => form?.has(key));
  let intent = null;
  if (extended) {
    const allowed = new Set<string>([...BROWSER_NAVIGATION_FIELDS, "returnIntent"]);
    if (!form || [...form.keys()].some(key => !allowed.has(key)) || [...allowed].some(key => form.getAll(key).length !== 1) || form.get("returnIntent") !== "members_handoff") return NextResponse.json({ ok: false, error: "invalid_navigation_intent" }, { status: 400 });
    intent = parseBrowserNavigationIntent(Object.fromEntries(BROWSER_NAVIGATION_FIELDS.map(key => [key, form.get(key)])), Date.now());
    if (!intent) return NextResponse.json({ ok: false, error: "invalid_navigation_intent" }, { status: 400 });
    if (intent.expectedUserId !== userId) return NextResponse.json({ ok: false, error: "navigation_account_mismatch" }, { status: 403 });
  }
  try {
    const where = { userId_organizationId: { userId, organizationId } };
    const member = await prisma.orgMembership.findUnique({ where, select: intent ? { acceptedAt: true, updatedAt: true } : { acceptedAt: true } });
    if (!member?.acceptedAt || (intent && !matchesBrowserNavigationMembership(intent, member))) return NextResponse.json({ ok: false, error: "workspace_membership_required" }, { status: 403 });
    if (intent) {
      // Awaited work can outlive the browser login or membership snapshot. Recheck
      // both immediately before the synchronous cookie write; hints grant nothing.
      const freshSession = await getServerSession(authOptions);
      if ((freshSession?.user as { id?: string } | undefined)?.id !== intent.expectedUserId || !freshSession?.user?.email) return NextResponse.json({ ok: false, error: "navigation_account_mismatch" }, { status: 403 });
      const freshMember = await prisma.orgMembership.findUnique({ where, select: { acceptedAt: true, updatedAt: true } });
      if (!matchesBrowserNavigationMembership(intent, freshMember) || !parseBrowserNavigationIntent(intent, Date.now())) return NextResponse.json({ ok: false, error: "navigation_context_changed" }, { status: 409 });
    }
  } catch { return NextResponse.json({ ok: false, error: "workspace_membership_unavailable" }, { status: 503 }); }
  const response = NextResponse.redirect(new URL(intent ? browserNavigationIntentPath(intent) : "/control", request.url), 303);
  response.cookies.set(WORKSPACE_COOKIE, JSON.stringify({ userId, organizationId }), { httpOnly: true, secure: request.nextUrl.protocol === "https:", sameSite: "lax", path: "/", maxAge: 30 * 24 * 60 * 60 });
  return response;
}
