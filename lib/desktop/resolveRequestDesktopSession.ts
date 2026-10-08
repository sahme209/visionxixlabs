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
import { ensurePersonalWorkspaceMembership } from "@/lib/auth/ensurePersonalWorkspaceMembership";
import { deriveWorkspaceIdFromEmail } from "@/lib/auth/workspaceId";
import { createLogger } from "@/lib/observability/logger";
import {
    capabilitiesForRole,
    hasDesktopCapability,
    isWorkspaceAdminRole,
    type DesktopCapability,
    type DesktopWorkspaceRole,
} from "./desktopAuthorization";

const log = createLogger("desktop.resolveRequestDesktopSession");

export interface DesktopRequestPrincipal {
    id: string;
    userId: string;
    organizationId: string;
    credentialKind: "desktop_session" | "api_key";
    role: DesktopWorkspaceRole | null;
    capabilities: DesktopCapability[];
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
    /** Capability checks are evaluated from the current accepted membership
     * on every request, so role changes revoke authority immediately. */
    requiredCapability?: DesktopCapability;
    /**
     * Desktop tokens are long-lived device credentials, not a substitute for
     * current workspace membership. Recheck the durable membership on every
     * desktop-session request. A removed or unaccepted member loses access
     * immediately. Scoped API-key automation remains a separate authority.
     */
    requireWorkspaceMembership?: boolean;
}

async function readActiveWorkspaceRole(userId: string, organizationId: string): Promise<DesktopWorkspaceRole | null> {
    try {
        const membership = await prisma.orgMembership.findUnique({
            where: { userId_organizationId: { userId, organizationId } },
            select: { acceptedAt: true, role: true },
        });
        return membership?.acceptedAt !== null && membership?.acceptedAt !== undefined
            ? membership.role as DesktopWorkspaceRole
            : null;
    } catch {
        // A membership-store failure must not extend a long-lived desktop
        // token beyond the workspace's current authority.
        return null;
    }
}

/**
 * Sign-in's own personal-workspace membership bootstrap
 * (ensurePersonalWorkspaceMembership, called from lib/auth.ts) is
 * deliberately best-effort and never blocks sign-in — so it can lag
 * behind, or fail outright on a transient DB blip, leaving a freshly
 * signed-in user with a structurally valid desktop session but no
 * accepted membership row yet. That surfaced as every operational route
 * (deployments, etc.) denying with a bare "desktop_session_required"
 * forever, with no way for the user to recover short of signing out and
 * back in. Self-heal it here: only for the user's OWN derived personal
 * workspace (never a shared/invited org — those must come from a real
 * invite acceptance), retry the same idempotent upsert sign-in already
 * performs unconditionally, then recheck membership once.
 */
async function selfHealPersonalWorkspaceMembership(userId: string, organizationId: string): Promise<void> {
    try {
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
        if (!user?.email) {
            log.error("self-heal skipped: no user row (or no email) found for this session's userId", { userId, organizationId });
            return;
        }
        const derivedPersonalWorkspaceId = String(deriveWorkspaceIdFromEmail(user.email));
        if (derivedPersonalWorkspaceId !== organizationId) {
            log.error("self-heal skipped: session organizationId does not match this identity's derived personal workspace", {
                userId,
                sessionOrganizationId: organizationId,
                derivedPersonalWorkspaceId,
            });
            return;
        }
        await ensurePersonalWorkspaceMembership({ userId, email: user.email });
    } catch (err) {
        log.error("self-heal membership bootstrap retry failed", {
            userId,
            organizationId,
            errorMessage: err instanceof Error ? err.message : String(err),
            errorCode: err instanceof Error && "code" in err ? (err as { code?: unknown }).code : undefined,
        });
        // best-effort — a failure here just means the caller's membership
        // recheck below still fails and the request is denied, same as today.
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
            if (options.allowApiKey === false) {
                log.info("api key not allowed on this route", { route: options.route });
                return undefined;
            }
            if (options.requireWorkspaceAdmin || options.requiredCapability) {
                log.info("api key cannot satisfy admin-only or role-authorized route", { route: options.route });
                return undefined;
            }
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
                role: null,
                capabilities: [],
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
        let role = await readActiveWorkspaceRole(String(session.userId), String(session.organizationId));
        if (options.requireWorkspaceMembership !== false && !role) {
            await selfHealPersonalWorkspaceMembership(String(session.userId), String(session.organizationId));
            role = await readActiveWorkspaceRole(String(session.userId), String(session.organizationId));
            if (!role) {
                log.info("workspace membership missing or unaccepted", { route: options.route, organizationId: session.organizationId, userId: session.userId });
                return undefined;
            }
            log.info("self-healed missing personal workspace membership", { route: options.route, organizationId: session.organizationId, userId: session.userId });
        }
        if (options.requireWorkspaceAdmin && !isWorkspaceAdminRole(role)) {
            log.info("workspace admin role required but absent", { route: options.route, organizationId: session.organizationId, userId: session.userId });
            return undefined;
        }
        if (options.requiredCapability && !hasDesktopCapability(role, options.requiredCapability)) {
            log.info("required workspace capability absent", {
                route: options.route,
                organizationId: session.organizationId,
                userId: session.userId,
                role,
                requiredCapability: options.requiredCapability,
            });
            return undefined;
        }
        await touchDesktopSession(session.id);
        const principal: DesktopRequestPrincipal = {
            id: session.id,
            userId: session.userId,
            organizationId: session.organizationId,
            credentialKind: "desktop_session",
            role,
            capabilities: role ? capabilitiesForRole(role) : [],
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
