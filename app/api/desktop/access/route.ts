import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { apiSuccess } from "@/lib/api/dtoMappers";
import { readDesktopCommercialAccess } from "@/lib/desktop/desktopCommercialAccess";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const principal = await resolveRequestDesktopSession(request, {
    requiredScope: "release_gate:read",
    route: "/api/desktop/access",
    requireActiveAccess: false,
    // Pairing identity and workspace standing are deliberately separate.
    // This is the status endpoint the desktop calls right after a browser
    // approval to decide which screen to show — it must succeed for any
    // structurally valid, non-expired, non-revoked session so the real
    // workspace state (no membership yet, no entitlement, active) can be
    // reported as data in `access` below, not collapsed into a generic
    // "invalid or expired" auth failure. A user whose personal-workspace
    // membership bootstrap hasn't completed (see lib/auth.ts — that
    // bootstrap is intentionally best-effort and never blocks sign-in)
    // would otherwise see their perfectly valid, just-approved pairing
    // rejected as if the token itself were bad. Every operational route
    // still defaults to requiring membership — only this read-only status
    // check opts out.
    requireWorkspaceMembership: false,
  });
  if (!principal) {
    return NextResponse.json(
      { ok: false, error: { userMessage: "Your saved desktop sign-in is invalid or has expired." } },
      { status: 401 },
    );
  }

  const access = await readDesktopCommercialAccess(principal.organizationId);
  const user = principal.credentialKind === "desktop_session"
    ? await prisma.user.findUnique({
        where: { id: principal.userId },
        select: { email: true, name: true },
      }).catch(() => null)
    : null;
  return NextResponse.json(apiSuccess({
    identity: {
      kind: principal.credentialKind,
      organizationId: principal.organizationId,
      email: user?.email ?? undefined,
      displayName: user?.name ?? user?.email ?? undefined,
      role: principal.role ?? undefined,
      capabilities: principal.capabilities,
    },
    access,
  }));
}
