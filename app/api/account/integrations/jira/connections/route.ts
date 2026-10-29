import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { currentContext } from "@/lib/auth/currentContext";
import { isAdminOrOwner } from "@/lib/auth/platformAdmin";
import { isSameOriginRequest } from "@/lib/auth/requestOrigin";
import { trustedIntegrationCallbackUrl } from "@/lib/integrations/trustedCallbackUrl";
import { prisma } from "@/lib/db";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const PAGE_ROWS = 20;
const MAX_RESPONSE_BYTES = 16 * 1024;
const identifier = z.string().min(1).max(512).refine(value => value.trim() === value &&
 !/[\x00-\x1f\x7f-\x9f]/.test(value) && Buffer.byteLength(value, "utf8") <= 512 && Buffer.from(value, "utf8").toString("utf8") === value);
const querySchema = z.object({ afterId: identifier.optional() }).strict();
const rowSchema = z.object({ id: identifier, organizationId: identifier, consentedByUserId: identifier, provider: z.literal("jira"),
 status: z.enum(["pending", "active"]), revokedAt: z.null(), updatedAt: z.date(), lastValidatedAt: z.date().nullable() }).strict();
const projection = { id: true, organizationId: true, consentedByUserId: true, provider: true, status: true, revokedAt: true, updatedAt: true, lastValidatedAt: true } as const;
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });

/** Informational stored-state page only. No provider call, credential read,
 * automatic selection, activation, health check, or expanded authority. */
export async function GET(request: NextRequest): Promise<Response> {
 try {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (request.headers.has("origin") && !isSameOriginRequest(request) ||
      fetchSite !== null && fetchSite !== "same-origin" && fetchSite !== "none") return reply({ ok: false, error: "invalid_request_origin" }, 403);
  const initial = await currentContext();
  if (!initial.isAuthenticated || !initial.organizationId || !initial.userId) return reply({ ok: false, error: "auth_required" }, 401);
  if (!isAdminOrOwner({ email: initial.email, roles: initial.roles })) return reply({ ok: false, error: "workspace_owner_required" }, 403);
  const organizationId = identifier.parse(initial.organizationId), userId = identifier.parse(initial.userId);
  const query = request.nextUrl.searchParams;
  if (request.url.length > 2048 || [...query.keys()].some(key => query.getAll(key).length !== 1)) return reply({ ok: false, error: "invalid_jira_connection_query" }, 400);
  const parsed = querySchema.safeParse(Object.fromEntries(query));
  if (!parsed.success) return reply({ ok: false, error: "invalid_jira_connection_query" }, 400);
  request.signal.throwIfAborted();
  const rows = z.array(rowSchema).max(PAGE_ROWS + 1).parse(await prisma.tenantIntegrationConnection.findMany({
   where: { organizationId, consentedByUserId: userId, provider: "jira", status: { in: ["pending", "active"] }, revokedAt: null,
    ...(parsed.data.afterId === undefined ? {} : { id: { gt: parsed.data.afterId } }) },
   orderBy: { id: "asc" }, take: PAGE_ROWS + 1, select: projection,
  }));
  if (rows.some(row => row.organizationId !== organizationId || row.consentedByUserId !== userId || row.status === "active" && !row.lastValidatedAt)) throw Error("invalid_metadata");
  // The OAuth callback refuses every existing workspace/provider record,
  // including another consenter's or a revoked record excluded from this page.
  // Absence of the current user's rows cannot authorize a new consent flow.
  const existing = z.object({ id: identifier }).strict().nullable().parse(await prisma.tenantIntegrationConnection.findUnique({
   where: { organizationId_provider: { organizationId, provider: "jira" } }, select: { id: true },
  }));
  const connections = rows.slice(0, PAGE_ROWS).map(row => ({ connectionId: row.id, revision: row.updatedAt.toISOString(),
   recordedState: row.status === "pending" ? "consent_recorded" : "read_validation_recorded", lastValidatedAt: row.lastValidatedAt?.toISOString() ?? null }));
  // Re-read session, selected workspace and role after the asynchronous row read.
  const latest = await currentContext();
  if (!latest.isAuthenticated || latest.organizationId !== organizationId || latest.userId !== userId ||
      !isAdminOrOwner({ email: latest.email, roles: latest.roles })) return reply({ ok: false, error: "workspace_authority_changed" }, 403);
  request.signal.throwIfAborted();
  // This boolean mirrors start-route registration presence, not provider health.
  const serverConfigured = Boolean(process.env.JIRA_CLIENT_ID?.trim() && process.env.JIRA_CLIENT_SECRET?.trim() && trustedIntegrationCallbackUrl("/api/integrations/jira/callback"));
  const canStartConsent = serverConfigured && existing === null;
  // The lookahead and byte-limited complete-row prefix both preserve continuation.
  // hasMore=false says only that no later eligible rows were observed for this cursor.
  for (let count = connections.length; count >= (rows.length ? 1 : 0); count--) {
   const hasMore = rows.length > count;
   const body = { ok: true, data: { serverConfigured, canStartConsent, scope: "current_consenting_user", connections: connections.slice(0, count),
    hasMore, nextAfterId: hasMore ? connections[count - 1].connectionId : null,
    currentHealth: "not_checked", issueWritePermissionVerified: false } };
   if (Buffer.byteLength(JSON.stringify(body), "utf8") <= MAX_RESPONSE_BYTES) return reply(body);
  }
  throw Error("metadata_too_large");
 } catch { return reply({ ok: false, error: "jira_connection_summary_unavailable" }, 503); }
}
