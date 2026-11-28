import { NextResponse, type NextRequest } from "next/server";
import { authenticateApiKey } from "@/lib/security/authenticateApiKey";
import { prisma } from "@/lib/db";
import { SCIM_CONTENT_TYPE, SCIM_ERROR_SCHEMA, type ScimDb, type ScimContext, type ScimResult } from "@/lib/iam/scim/scimService";

const headers = { "Content-Type": SCIM_CONTENT_TYPE, "Cache-Control": "private, no-store" };

export function scimResponse(r: ScimResult): Response {
  return r.body === null ? new Response(null, { status: r.status, headers }) : NextResponse.json(r.body, { status: r.status, headers });
}

/** Bearer API key with the scim:provision scope. The key's workspace is the only one SCIM can touch. */
export async function scimAuth(req: NextRequest, route: string): Promise<{ ok: true; ctx: ScimContext } | { ok: false; response: Response }> {
  const auth = await authenticateApiKey({
    authorizationHeader: req.headers.get("authorization"),
    sourceIp: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? null,
    requiredScope: "scim:provision",
    correlationId: `scim_${Date.now().toString(36)}`,
    route,
  });
  if (auth.ok) return { ok: true, ctx: { organizationId: auth.organizationId, apiKeyId: auth.apiKeyId, baseUrl: `${req.nextUrl.origin}/api/scim/v2` } };
  const h: Record<string, string> = { ...headers };
  if (typeof auth.retryAfterSeconds === "number") h["Retry-After"] = String(auth.retryAfterSeconds);
  return { ok: false, response: NextResponse.json({ schemas: [SCIM_ERROR_SCHEMA], status: String(auth.httpStatus), detail: auth.reason }, { status: auth.httpStatus, headers: h }) };
}

/** Runs a SCIM change in one transaction; a uniqueness race becomes a SCIM 409 instead of a 500. */
export async function inTransaction(fn: (db: ScimDb) => Promise<ScimResult>): Promise<ScimResult> {
  try {
    return await prisma.$transaction((tx) => fn(tx as unknown as ScimDb));
  } catch (e) {
    if (e && typeof e === "object" && (e as { code?: string }).code === "P2002") {
      return { status: 409, body: { schemas: [SCIM_ERROR_SCHEMA], status: "409", scimType: "uniqueness", detail: "A user with this externalId is already provisioned." } };
    }
    throw e;
  }
}

export async function readJson(req: NextRequest): Promise<unknown> {
  const text = await req.text();
  if (text.length > 64 * 1024) return null;
  try { return JSON.parse(text); } catch { return null; }
}
