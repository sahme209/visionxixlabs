import { NextResponse, type NextRequest } from "next/server";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { buildIntegrationHealthReport } from "@/lib/integrations/integrationHealthChecker";
import type { OrganizationId, UserId } from "@/lib/domain/ids";

export const dynamic = "force-dynamic";

/**
 * Read-only, tenant-scoped health summary for the native Integration Center.
 * It reports the state of connected-system foundations, not deployment health
 * or a claim that a release has been observed in production.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
    try {
        const session = await resolveRequestDesktopSession(request, {
            requiredScope: "pipeline:read",
            route: "GET /api/desktop/integration-health",
        });
        if (!session) {
            return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });
        }

        const report = await buildIntegrationHealthReport({
            tenantId: session.organizationId as OrganizationId,
            actorUserId: session.userId as UserId,
        });
        return NextResponse.json({
            ok: true,
            data: {
                status: report.overallStatus,
                sourceMode: report.overallSourceMode,
                summary: report.summary,
            },
        });
    } catch {
        return NextResponse.json({ ok: false, error: "integration_health_unavailable" }, { status: 500 });
    }
}
