import "server-only";
import type { NextRequest } from "next/server";
import type { RequiredScope } from "@/lib/security/apiKeyScope";
type ApiAuthenticator = (input: { authorizationHeader: string | null; sourceIp: string | null; requiredScope: RequiredScope; correlationId: string; route: string; requireActiveCommercialAccess?: boolean }) => Promise<{ ok: false } | { ok: true; apiKeyId: string; organizationId: string }>;
import type { createPrivateDesktopTokenCodec } from "./privateDesktopToken";
import type { createPrivateDesktopSessionService } from "./privateDesktopSession";
import { capabilitiesForRole, hasDesktopCapability, isWorkspaceAdminRole, type DesktopCapability, type DesktopWorkspaceRole } from "./desktopAuthorization";
function bearerFromHeader(header: string | null): string | null {
 const trimmed = header?.trim();
 return trimmed?.toLowerCase().startsWith("bearer ") ? trimmed.slice(7).trim() || null : null;
}
export interface DesktopRequestPrincipal {
    id: string;
    userId: string;
    organizationId: string;
    credentialKind: "desktop_session" | "api_key";
    role: DesktopWorkspaceRole | null;
    capabilities: DesktopCapability[];
}

export interface ResolveOptions {
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
    /** Read-only authority rechecks may run while the caller holds session locks.
     * Authentication, membership and entitlement checks still run; only the
     * incidental lastSeenAt write is omitted. Server option, never request input. */
    recordHeartbeat?: boolean;
}


export interface SessionResolverDependencies {
 tokenCodec: Pick<ReturnType<typeof createPrivateDesktopTokenCodec>, "verifyDesktopToken">;
 sessions: Pick<ReturnType<typeof createPrivateDesktopSessionService>, "resolveActiveSession" | "touchDesktopSession">;
 readActiveWorkspaceRole: (userId: string, organizationId: string) => Promise<DesktopWorkspaceRole | null>;
 selfHealPersonalWorkspaceMembership: ((userId: string, organizationId: string) => Promise<void>) | null;
 readDesktopCommercialAccess: (organizationId: string) => Promise<{ allowed: boolean }>;
}
export function createDesktopSessionResolverCore(deps: SessionResolverDependencies, authenticateApiKey: ApiAuthenticator | null, log: { info: (message: string, fields: any) => void; error: (message: string, fields: any) => void }) {
 const { tokenCodec: { verifyDesktopToken }, sessions: { resolveActiveSession, touchDesktopSession }, readActiveWorkspaceRole, readDesktopCommercialAccess } = deps;
 const selfHealPersonalWorkspaceMembership = deps.selfHealPersonalWorkspaceMembership ?? (async () => {});
 return async (request: Pick<NextRequest, "headers">, options: ResolveOptions): Promise<DesktopRequestPrincipal | undefined> => {
    const token = bearerFromHeader(request.headers.get("authorization"));
    if (!token) return undefined;

    try {
        if (token.startsWith("vxlk_")) {
            if (!authenticateApiKey || options.allowApiKey === false) {
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
        if (options.recordHeartbeat !== false) await touchDesktopSession(session.id);
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

 };
}
