import {NextResponse, type NextRequest} from "next/server";
import {currentContext} from "@/lib/auth/currentContext";
import {prisma} from "@/lib/db";
import {consumeToken} from "@/lib/api/rateLimiter";
import {inspectAgentStorageRecovery, type AgentRecoveryRepository} from "@/lib/operations/agentStorageRecovery";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const reply = (body: unknown, status = 200) => NextResponse.json(body, {status, headers: {"Cache-Control": "private, no-store"}});
/** Owner-only operational evidence; this endpoint cannot perform a repair. */
export async function GET(request: NextRequest) {
  try {
    const context = await currentContext();
    if (!context.isAuthenticated || !context.userId || !context.organizationId) return reply({ok: false, error: "authentication_required"}, 401);
    if (!context.roles.some(role => role === "owner" || role === "admin")) return reply({ok: false, error: "workspace_owner_required"}, 403);
    if ([...request.nextUrl.searchParams.keys()].length) return reply({ok: false, error: "request_target_not_supported"}, 400);
    if (!consumeToken(`agent-recovery-read:${context.organizationId}:${context.userId}`, {capacity: 2, tokensPerSecond: 1 / 60}).allowed) return reply({ok: false, error: "recovery_read_rate_limited"}, 429);
    const data = await inspectAgentStorageRecovery(prisma as unknown as AgentRecoveryRepository, process.env);
    return reply({ok: true, data}, data.state === "verified" ? 200 : 503);
  } catch { return reply({ok: false, error: "recovery_evidence_unavailable"}, 503); }
}
