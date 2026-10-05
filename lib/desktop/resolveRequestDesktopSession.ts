import "server-only";

import type { NextRequest } from "next/server";
import { authenticateApiKey } from "@/lib/security/authenticateApiKey";
import type { RequiredScope } from "@/lib/security/apiKeyScope";
import { prisma } from "@/lib/db";
import { bearerFromHeader, verifyDesktopToken } from "./desktopToken";
import {
    resolveActiveSession,
    touchDesktopSession,
} from "./desktopSession";
import { readDesktopCommercialAccess } from "./desktopCommercialAccess";
import { createLogger } from "@/lib/observability/logger";

const log = createLogger("desktop.resolveRequestDesktopSession");

export interface DesktopRequestPrincipal {
    id: string;
    userId: string;
    organizationId: string;
    credentialKind: "desktop_session" | "api_key";
}

interface ResolveOptions {
    requiredScope: RequiredScope;
    route: string;
    requireActiveAccess?: boolean;
    /** Shared provider-state transitions require a paired user session, not
     * a reusable API key. Existing read routes retain API-key support. */
    allowApiKey?: boolean;
    /** Shared integration state can only be changed by a currently confirmed
     * workspace owner or admin. The desktop token identifies a device; it
     * does not itself freeze role authority for its 30-day lifetime. */
    requireWorkspaceAdmin?: boolean;
    /**
     * Desktop tokens are long-lived device credentials, not a substitute for
     * current workspace membership. Recheck the durable membership on every
     * desktop-session request. A removed or unaccepted member loses access
     * immediately. Scoped API-key automation remains a separate authority.
     */
    requireWorkspaceMembership?: boolean;
}

async function hasActiveWorkspaceMembership(userId: string, organizationId: string): Promise<boolean> {
    try {
        const membership = await prisma.orgMembership.findUnique({
            where: { userId_organizationId: { userId, organizationId } },
            select: { acceptedAt: true },
        });
        return membership?.acceptedAt !== null && membership?.acceptedAt !== undefined;
    } catch {
        // A membership-store failure must not extend a long-lived desktop
        // token beyond the workspace's current authority.
        return false;
    }
}

async function hasWorkspaceAdminRole(userId: string, organizationId: string): Promise<boolean> {
    try {
        const membership = await prisma.orgMembership.findUnique({
            where: { userId_organizationId: { userId, organizationId } },
            select: { role: true, acceptedAt: true },
        });
        return membership?.acceptedAt !== null
            && membership?.acceptedAt !== undefined
            && (membership?.role === "owner" || membership?.role === "admin");
    } catch {
        // A role-store failure must not permit a shared provider-state change.
        return false;
    }
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
            if (options.allowApiKey === false) return undefined;
            if (options.requireWorkspaceAdmin) return undefined;
            const sourceIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
                ?? request.headers.get("x-real-ip")
                ?? null;
            const auth = await authenticateApiKey({
                authorizationHeader: request.headers.get("authorization"),
                sourceIp,
                requiredScope: options.requiredScope,
                correlationId: request.headers.get("x-correlation-id") ?? crypto.randomUUID(),
                route: options.route,
                requireActiveCommercialAccess: options.requireActiveAccess !== false,
            });
            if (!auth.ok) {
                log.info("api key auth rejected", { route: options.route });
                return undefined;
            }
            const principal: DesktopRequestPrincipal = {
                id: `api_key:${auth.apiKeyId}`,
                userId: `api_key:${auth.apiKeyId}`,
                organizationId: auth.organizationId,
                credentialKind: "api_key",
            };
            if (options.requireActiveAccess !== false) {
                const access = await readDesktopCommercialAccess(principal.organizationId);
                if (!access.allowed) {
                    log.info("api key commercial access not allowed", { route: options.route, organizationId: principal.organizationId });
                    return undefined;
                }
            }
            return principal;
        }

        const { sessionId } = verifyDesktopToken(token);
        const session = await resolveActiveSession(sessionId);
        if (!session) {
            // Expected and benign on an expired/revoked/unknown session —
            // but if this fires for every pairing attempt in production,
            // it's a strong signal the session store itself is the problem
            // (e.g. an in-memory store that doesn't survive across
            // serverless invocations), not an individual bad token.
            log.info("no active session for token", { route: options.route });
            return undefined;
        }
        if (options.requireWorkspaceMembership !== false
            && !(await hasActiveWorkspaceMembership(String(session.userId), String(session.organizationId)))) {
            log.info("workspace membership missing or unaccepted", { route: options.route, organizationId: session.organizationId, userId: session.userId });
            return undefined;
        }
        if (options.requireWorkspaceAdmin && !(await hasWorkspaceAdminRole(String(session.userId), String(session.organizationId)))) {
            log.info("workspace admin role required but absent", { route: options.route, organizationId: session.organizationId, userId: session.userId });
            return undefined;
        }
        await touchDesktopSession(session.id);
        const principal: DesktopRequestPrincipal = {
            id: session.id,
            userId: session.userId,
            organizationId: session.organizationId,
            credentialKind: "desktop_session",
        };
        if (options.requireActiveAccess !== false) {
            const access = await readDesktopCommercialAccess(principal.organizationId);
            if (!access.allowed) {
                log.info("commercial access not allowed", { route: options.route, organizationId: principal.organizationId });
                return undefined;
            }
        }
        return principal;
    } catch (error) {
        // Previously this swallowed every exception with zero trace —
        // including a missing/too-short DESKTOP_SESSION_SIGNING_KEY (and
        // NEXTAUTH_SECRET fallback), which would silently break 100% of
        // desktop pairing with nothing in the logs to diagnose from. Log
        // the real error so a production failure actually leaves a trail.
        log.error("unexpected exception resolving desktop session", {
            route: options.route,
            errorMessage: error instanceof Error ? error.message : String(error),
            errorCode: error instanceof Error && "code" in error ? (error as { code?: unknown }).code : undefined,
        });
        return undefined;
    }
}
