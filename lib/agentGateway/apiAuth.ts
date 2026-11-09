import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { authenticateApiKey } from "@/lib/security/authenticateApiKey";
import type { GatewayCaller } from "./gatewayService";

/** Authenticates an agent's API key for one gateway scope. Returns the caller or a ready error response. */
export async function gatewayAuth(req: NextRequest, scope: "governance:read" | "governance:request", route: string): Promise<{ caller: GatewayCaller } | { response: NextResponse }> {
  const auth = await authenticateApiKey({
    authorizationHeader: req.headers.get("authorization"),
    sourceIp: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? null,
    requiredScope: scope,
    correlationId: `v1_gateway_${Date.now().toString(36)}`,
    route,
  });
  if (!auth.ok) {
    const headers: Record<string, string> = {};
    if (typeof auth.retryAfterSeconds === "number") headers["Retry-After"] = String(auth.retryAfterSeconds);
    return { response: NextResponse.json({ ok: false, error: auth.reason, ...(auth.requiredScope ? { requiredScope: auth.requiredScope } : {}) }, { status: auth.httpStatus, headers }) };
  }
  return { caller: { organizationId: auth.organizationId, apiKeyId: auth.apiKeyId } };
}

export const noStore = { headers: { "Cache-Control": "no-store" } } as const;
