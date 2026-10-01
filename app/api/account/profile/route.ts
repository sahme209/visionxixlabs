import { NextResponse, type NextRequest } from "next/server";
import { requireContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function normalizeDisplayName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim().replace(/\s+/g, " ");
  return name.length >= 1 && name.length <= 80 ? name : null;
}

function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  return origin === request.nextUrl.origin;
}

export async function GET() {
  try {
    const context = await requireContext();
    const user = await prisma.user.findUnique({
      where: { id: context.userId },
      select: { email: true, name: true },
    });
    if (!user) return NextResponse.json({ ok: false, error: "account_not_found" }, { status: 404 });
    return NextResponse.json({ ok: true, profile: { email: user.email, displayName: user.name ?? "" } });
  } catch {
    return NextResponse.json({ ok: false, error: "authentication_required" }, { status: 401 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    if (!isSameOrigin(request)) return NextResponse.json({ ok: false, error: "invalid_request_origin" }, { status: 403 });
    const context = await requireContext();
    const body = await request.json().catch(() => null);
    const displayName = normalizeDisplayName((body as { displayName?: unknown } | null)?.displayName);
    if (!displayName) {
      return NextResponse.json({ ok: false, error: "display_name_invalid" }, { status: 400 });
    }
    const user = await prisma.user.update({
      where: { id: context.userId },
      data: { name: displayName },
      select: { email: true, name: true },
    });
    return NextResponse.json({ ok: true, profile: { email: user.email, displayName: user.name ?? "" } });
  } catch {
    return NextResponse.json({ ok: false, error: "profile_update_failed" }, { status: 401 });
  }
}
