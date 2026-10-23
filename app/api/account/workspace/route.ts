import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isSameOriginRequest } from "@/lib/auth/requestOrigin";
import { WORKSPACE_COOKIE } from "@/lib/auth/workspaceSelection";
export const dynamic = "force-dynamic";
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ ok: false, error: "invalid_origin" }, { status: 403 });
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId || !session?.user?.email) return NextResponse.json({ ok: false, error: "authentication_required" }, { status: 401 });
  const form = await request.formData().catch(() => null);
  const organizationId = form?.get("organizationId");
  if (typeof organizationId !== "string" || !/^[A-Za-z0-9_-]{1,200}$/.test(organizationId)) return NextResponse.json({ ok: false, error: "invalid_workspace" }, { status: 400 });
  try {
    const member = await prisma.orgMembership.findUnique({ where: { userId_organizationId: { userId, organizationId } }, select: { acceptedAt: true } });
    if (!member?.acceptedAt) return NextResponse.json({ ok: false, error: "workspace_membership_required" }, { status: 403 });
  } catch { return NextResponse.json({ ok: false, error: "workspace_membership_unavailable" }, { status: 503 }); }
  const response = NextResponse.redirect(new URL("/control", request.url), 303);
  response.cookies.set(WORKSPACE_COOKIE, JSON.stringify({ userId, organizationId }), { httpOnly: true, secure: request.nextUrl.protocol === "https:", sameSite: "lax", path: "/", maxAge: 30 * 24 * 60 * 60 });
  return response;
}
