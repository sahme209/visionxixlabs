import "server-only";

import type { NextRequest } from "next/server";
import { authenticateApiKey } from "@/lib/security/authenticateApiKey";
import type { RequiredScope } from "@/lib/security/apiKeyScope";
import { bearerFromHeader, verifyDesktopToken } from "./desktopToken";
import {
    resolveActiveSession,
    touchDesktopSession,
} from "./desktopSession";

export interface DesktopRequestPrincipal {
    id: string;
    userId: string;
    organizationId: string;
    credentialKind: "desktop_session" | "api_key";
}

interface ResolveOptions {
    requiredScope: RequiredScope;
    route: string;
}

/**
 * Resolves an authenticated native-app session without leaking token parse
 * failures into a 500 response. Expired, revoked, malformed, and unknown
 * credentials all produce the same unauthenticated result.
 */
export async function resolveRequestDesktopSession(
    request: NextRequest,
    options: ResolveOptions,
): Promise<DesktopRequestPrincipal | undefined> {
    const token = bearerFromHeader(request.headers.get("authorization"));
    if (!token) return undefined;

    try {
        if (token.startsWith("vxlk_")) {
            const sourceIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
                ?? request.headers.get("x-real-ip")
                ?? null;
            const auth = await authenticateApiKey({
                authorizationHeader: request.headers.get("authorization"),
                sourceIp,
                requiredScope: options.requiredScope,
                correlationId: request.headers.get("x-correlation-id") ?? crypto.randomUUID(),
                route: options.route,
            });
            if (!auth.ok) return undefined;
            return {
                id: `api_key:${auth.apiKeyId}`,
                userId: `api_key:${auth.apiKeyId}`,
                organizationId: auth.organizationId,
                credentialKind: "api_key",
            };
        }

        const { sessionId } = verifyDesktopToken(token);
        const session = await resolveActiveSession(sessionId);
        if (!session) return undefined;
        await touchDesktopSession(session.id);
        return {
            id: session.id,
            userId: session.userId,
            organizationId: session.organizationId,
            credentialKind: "desktop_session",
        };
    } catch {
        return undefined;
    }
}
