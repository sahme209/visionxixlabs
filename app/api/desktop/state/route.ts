/**
 * GET /api/desktop/state
 *
 * Desktop-authenticated read of the canonical ControlPlaneState. Same
 * payload as `/api/control-plane/state`, but authenticated by a desktop
 * bearer token instead of a NextAuth cookie — so the Tauri webview can
 * call cross-origin without depending on cookie flow.
 *
 * The desktop client paste-flow embeds the token in
 * `Authorization: Bearer <token>` on every request.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { bearerFromHeader, verifyDesktopToken } from "@/lib/desktop/desktopToken";
import { resolveActiveSession, touchDesktopSession } from "@/lib/desktop/desktopSession";
import { buildControlPlaneState } from "@/lib/controlPlane/controlPlaneBuilder";
import { apiFailure, apiSuccess } from "@/lib/api/dtoMappers";
import { AxiomErrors, httpStatusFor, toAxiomError } from "@/lib/errors/axiomErrors";
import { readDesktopCommercialAccess } from "@/lib/desktop/desktopCommercialAccess";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const token = bearerFromHeader(request.headers.get("authorization"));
    if (!token) {
      throw AxiomErrors.validation("desktop.state.no_bearer", "Desktop bearer token required.");
    }
    const { sessionId } = verifyDesktopToken(token);
    const session = await resolveActiveSession(sessionId);
    if (!session) {
      throw AxiomErrors.validation("desktop.state.session_inactive", "Session is revoked or expired. Re-pair from the web app.");
    }
    const commercialAccess = await readDesktopCommercialAccess(session.organizationId);
    if (!commercialAccess.allowed) {
      return NextResponse.json(
        apiFailure(AxiomErrors.policy(`desktop.access.${commercialAccess.code}`, commercialAccess.message)),
        { status: 402 },
      );
    }
    await touchDesktopSession(session.id);

    const state = await buildControlPlaneState();
    return NextResponse.json(
      apiSuccess({
        state,
        session: {
          id: session.id,
          deviceLabel: session.deviceLabel,
          expiresAt: session.expiresAt,
          lastSeenAt: session.lastSeenAt,
        },
      }),
      { status: 200 },
    );
  } catch (err) {
    const axiomErr = toAxiomError(err);
    return NextResponse.json(apiFailure(axiomErr), { status: httpStatusFor(axiomErr.category) });
  }
}
