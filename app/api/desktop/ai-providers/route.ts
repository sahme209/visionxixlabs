import { NextResponse, type NextRequest } from "next/server";
import { getAIProviderManager } from "@/lib/ai/AIProviderManager";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";

export const dynamic = "force-dynamic";

/**
 * Read-only service capability summary for the native client.
 * Provider keys, account identifiers, usage, routing policy, and model
 * parameters stay on the server and are intentionally omitted.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
    try {
        const session = await resolveRequestDesktopSession(request, {
            requiredScope: "pipeline:read",
            route: "GET /api/desktop/ai-providers",
        });
        if (!session) {
            return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });
        }

        const providers = getAIProviderManager().status()
            .filter((provider) => provider.provider !== "mock")
            .map((provider) => ({
                provider: provider.provider,
                configured: provider.configured,
                defaultModel: provider.defaultModel,
            }));
        return NextResponse.json({ ok: true, data: providers });
    } catch {
        return NextResponse.json({ ok: false, error: "ai_provider_status_failed" }, { status: 500 });
    }
}
