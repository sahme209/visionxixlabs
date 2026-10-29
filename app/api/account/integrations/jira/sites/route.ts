import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { currentContext } from "@/lib/auth/currentContext";
import { isAdminOrOwner } from "@/lib/auth/platformAdmin";
import { isSameOriginRequest } from "@/lib/auth/requestOrigin";
import { prisma } from "@/lib/db";
import type { JiraAuthorizationActor } from "@/lib/integrations/jira/jiraAuthorization";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const identifier = z.string().min(1).max(512).refine(value => value.trim() === value && !/[\x00-\x1f\x7f-\x9f]/.test(value) && Buffer.byteLength(value, "utf8") <= 512);
const revision = z.string().max(32).refine(value => { try { return new Date(value).toISOString() === value; } catch { return false; } });
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });
/** Resolve session and workspace roles again on every service authority check. */
async function readCurrentActor(): Promise<JiraAuthorizationActor | null> {
 const context = await currentContext();
 if (!context.isAuthenticated || !context.organizationId || !context.userId || !isAdminOrOwner({ email: context.email, roles: context.roles })) return null;
 return { organizationId: context.organizationId, userId: context.userId, canManageConnections: true };
}
import { discoverJiraSites, type JiraSiteSelectionRepository } from "@/lib/integrations/jira/jiraSiteSelection";
const querySchema = z.object({ connectionId: identifier, revision }).strict();
export async function GET(request: NextRequest): Promise<Response> {
 try {
  // Read-only GET fetches normally omit Origin. Reject explicit foreign
  // provenance without requiring the mutation-only Origin convention.
  const fetchSite = request.headers.get("sec-fetch-site");
  if (request.headers.has("origin") && !isSameOriginRequest(request) ||
      fetchSite !== null && fetchSite !== "same-origin" && fetchSite !== "none") return reply({ ok: false, error: "invalid_request_origin" }, 403);
  const context = await currentContext();
  if (!context.isAuthenticated || !context.organizationId || !context.userId) return reply({ ok: false, error: "auth_required" }, 401);
  if (!isAdminOrOwner({ email: context.email, roles: context.roles })) return reply({ ok: false, error: "workspace_owner_required" }, 403);
  const actor: JiraAuthorizationActor = { organizationId: context.organizationId, userId: context.userId, canManageConnections: true };
  const query = request.nextUrl.searchParams;
  if (request.url.length > 2048 || [...query.keys()].some(key => query.getAll(key).length !== 1)) return reply({ ok: false, error: "invalid_jira_site_request" }, 400);
  const parsed = querySchema.safeParse(Object.fromEntries(query));
  if (!parsed.success) return reply({ ok: false, error: "invalid_jira_site_request" }, 400);
  const result = await discoverJiraSites(prisma as unknown as JiraSiteSelectionRepository, { actor, readCurrentActor, ...parsed.data, signal: request.signal });
  return reply({ ok: true, data: { revision: result.revision, sites: result.sites.map(({ id, name, url }) => ({ id, name, url })) } });
 } catch { return reply({ ok: false, error: "jira_site_selection_unavailable" }, 503); }
}
