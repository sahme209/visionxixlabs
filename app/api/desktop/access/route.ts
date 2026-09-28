import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { apiSuccess } from "@/lib/api/dtoMappers";
import { readDesktopCommercialAccess } from "@/lib/desktop/desktopCommercialAccess";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const principal = await resolveRequestDesktopSession(request, {
    requiredScope: "release_gate:read",
    route: "/api/desktop/access",
    requireActiveAccess: false,
  });
  if (!principal) {
    return NextResponse.json(
      { ok: false, error: { userMessage: "Your saved desktop sign-in is invalid or has expired." } },
      { status: 401 },
    );
  }

  const access = await readDesktopCommercialAccess(principal.organizationId);
  return NextResponse.json(apiSuccess({
    identity: {
      kind: principal.credentialKind,
      organizationId: principal.organizationId,
    },
    access,
  }));
}
