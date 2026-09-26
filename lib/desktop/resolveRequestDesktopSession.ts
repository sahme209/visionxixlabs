import "server-only";

import type { NextRequest } from "next/server";
import { bearerFromHeader, verifyDesktopToken } from "./desktopToken";
import {
    resolveActiveSession,
    touchDesktopSession,
    type DesktopSession,
} from "./desktopSession";

/**
 * Resolves an authenticated native-app session without leaking token parse
 * failures into a 500 response. Expired, revoked, malformed, and unknown
 * credentials all produce the same unauthenticated result.
 */
export async function resolveRequestDesktopSession(
    request: NextRequest,
): Promise<DesktopSession | undefined> {
    const token = bearerFromHeader(request.headers.get("authorization"));
    if (!token) return undefined;

    try {
        const { sessionId } = verifyDesktopToken(token);
        const session = await resolveActiveSession(sessionId);
        if (!session) return undefined;
        await touchDesktopSession(session.id);
        return session;
    } catch {
        return undefined;
    }
}
