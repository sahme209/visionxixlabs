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
import { activateJiraReadConnection, JiraReadActivationOutcomeUnknown, type JiraReadActivationRepository } from "@/lib/integrations/jira/jiraReadActivation";
const bodySchema = z.object({ connectionId: identifier, revision, siteId: z.string().uuid() }).strict();
/** Bound bytes before decoding/parsing, including chunked or stalled bodies. */
async function boundedBody(request: NextRequest): Promise<unknown> {
 const length = request.headers.get("content-length");
 if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json" || !request.body ||
     length !== null && (!/^\d+$/.test(length) || Number(length) > 4096)) throw Error("invalid_body");
 const signal = AbortSignal.any([request.signal, AbortSignal.timeout(5000)]);
 const reader = request.body.getReader(); let bytes = 0, reads = 0; const chunks: Uint8Array[] = [];
 try {
  while (true) {
   signal.throwIfAborted();
   if (++reads > 4097) throw Error("invalid_body");
   const next = await new Promise<ReadableStreamReadResult<Uint8Array>>((resolve, reject) => {
    const abort = () => { signal.removeEventListener("abort", abort); reject(Error("invalid_body")); };
    signal.addEventListener("abort", abort, { once: true });
    reader.read().then(value => { signal.removeEventListener("abort", abort); signal.aborted ? reject(Error("invalid_body")) : resolve(value); }, () => { signal.removeEventListener("abort", abort); reject(Error("invalid_body")); });
   });
   if (next.done) break;
   bytes += next.value.byteLength; if (bytes > 4096) throw Error("invalid_body"); chunks.push(next.value);
  }
  signal.throwIfAborted();
  const body = new Uint8Array(bytes); let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
 } finally { void reader.cancel().catch(() => undefined); reader.releaseLock(); }
}
export async function POST(request: NextRequest): Promise<Response> {
 try {
  if (!isSameOriginRequest(request)) return reply({ ok: false, error: "invalid_request_origin" }, 403);
  const context = await currentContext();
  if (!context.isAuthenticated || !context.organizationId || !context.userId) return reply({ ok: false, error: "auth_required" }, 401);
  if (!isAdminOrOwner({ email: context.email, roles: context.roles })) return reply({ ok: false, error: "workspace_owner_required" }, 403);
  const actor: JiraAuthorizationActor = { organizationId: context.organizationId, userId: context.userId, canManageConnections: true };
  let parsed: z.infer<typeof bodySchema>;
  try { parsed = bodySchema.parse(await boundedBody(request)); }
  catch { return reply({ ok: false, error: "invalid_jira_activation_request" }, 400); }
  const result = await activateJiraReadConnection(prisma as unknown as JiraReadActivationRepository, { actor, readCurrentActor, ...parsed, signal: request.signal });
  return reply({ ok: true, data: { connectionId: result.connectionId, cloudId: result.cloudId, readValidated: result.readValidated, issueWritePermissionVerified: result.issueWritePermissionVerified } });
 } catch (error) {
  if (error instanceof JiraReadActivationOutcomeUnknown) return reply({ ok: false, error: "jira_read_activation_outcome_unknown" }, 409);
  return reply({ ok: false, error: "jira_read_activation_unavailable" }, 503);
 }
}
