import { NextResponse, type NextRequest } from "next/server";
import { authenticateApiKey } from "@/lib/security/authenticateApiKey";

export const noStore = { "Cache-Control": "private, no-store" };

/** API key with the policy:propose scope. Proposals still need a different admin's approval in the cockpit. */
export async function policyKey(req: NextRequest, route: string) {
  const auth = await authenticateApiKey({
    authorizationHeader: req.headers.get("authorization"),
    sourceIp: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? null,
    requiredScope: "policy:propose",
    correlationId: `v1_policy_${Date.now().toString(36)}`,
    route,
  });
  if (auth.ok) return { ok: true as const, organizationId: auth.organizationId, apiKeyId: auth.apiKeyId };
  const headers: Record<string, string> = { ...noStore };
  if (typeof auth.retryAfterSeconds === "number") headers["Retry-After"] = String(auth.retryAfterSeconds);
  return { ok: false as const, response: NextResponse.json({ ok: false, error: auth.reason, ...(auth.requiredScope ? { requiredScope: auth.requiredScope } : {}) }, { status: auth.httpStatus, headers }) };
}
