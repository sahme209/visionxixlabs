import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { ensureReleaseBatchObservation } from "@/lib/agent/workflows/releaseBatchObservationCreation";
import { RELEASE_BATCH_OBSERVATION_KIND } from "@/lib/agent/workflows/releaseBatchObservationKind";
import { sha256ContentHash } from "@/lib/tauri/contentHash";
import { releaseBatchObservationsEnabled } from "@/lib/agent/workflows/releaseBatchObservationConfig";
import { cancelReleaseBatchObservation } from "@/lib/agent/workflows/releaseBatchObservationCancellation";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const schema = z.object({ expectedVersion: z.number().int().positive().max(999_999_999), deadlineAt: z.number().int().positive().safe() }).strict();
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
const validId = (id: string) => !!id && id === id.trim() && id.length <= 160 && !/[\0\r\n]/.test(id);
async function body(request: NextRequest) {
  if (!request.body) throw new Error("body_required");
  const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let length = 0;
  try {
    for (;;) { const next = await reader.read(); if (next.done) break; length += next.value.byteLength;
      if (length > 2048) { await reader.cancel(); throw new Error("body_too_large"); } chunks.push(next.value); }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
}
function projection(row: { id: string; version: number; status: string; currentStep?: string | null; nextAttemptAt?: Date | null; inputJson: unknown }) {
  const value = row.inputJson && typeof row.inputJson === "object" && !Array.isArray(row.inputJson) ? row.inputJson as Record<string, unknown> : {};
  return { id: row.id, version: row.version, status: row.status, phase: row.currentStep ?? null,
    nextObservationAt: row.nextAttemptAt?.toISOString() ?? null, deadlineAt: typeof value.deadlineAt === "number" ? value.deadlineAt : null };
}
async function exactRelease(organizationId: string, id: string, version: number) {
  const row = await prisma.tauriDeploymentRequest.findFirst({ where: { organizationId, id } });
  return row?.id === id && row.organizationId === organizationId && row.version === version ? row : null;
}
/** Persist read-only waiting intent only. Does not invoke a worker, provider or deployment. */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await resolveRequestDesktopSession(request, { requiredScope: "pipeline:trigger", requiredCapability: "deploy:execute", allowApiKey: false, route: "POST /api/desktop/deployments/:id/batch-wait" });
  if (!session) return reply({ ok: false, error: "desktop_session_required" }, 401);
  if (!releaseBatchObservationsEnabled()) return reply({ ok: false, error: "batch_monitoring_disabled" }, 503);
  const { id } = await context.params;
  let parsed: z.infer<typeof schema>;
  try { parsed = schema.parse(await body(request)); if (!validId(id)) throw new Error("invalid_id"); } catch { return reply({ ok: false, error: "invalid_batch_wait" }, 400); }
  try {
    const organizationId = String(session.organizationId), row = await exactRelease(organizationId, id, parsed.expectedVersion);
    if (row?.status !== "submitted") return reply({ ok: false, error: "release_changed" }, 409);
    const data = await ensureReleaseBatchObservation({ organizationId, requestId: id, expectedVersion: parsed.expectedVersion,
      expectedDigest: sha256ContentHash({ requestVersion: row.version, intake: row.intakeJson }), requestedByUserId: String(session.userId), deadlineAt: parsed.deadlineAt });
    return reply({ ok: true, data: projection(data) });
  } catch { return reply({ ok: false, error: "batch_wait_unavailable" }, 409); }
}
/** Read a safe wait projection for the exact current release snapshot. */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const authority = { requiredScope: "pipeline:read", requiredCapability: "workspace:read", allowApiKey: false,
    route: "GET /api/desktop/deployments/:id/batch-wait" } as const;
  const denied = () => reply({ ok: false, error: "desktop_session_required" }, 401);
  const changed = () => reply({ ok: false, error: "release_changed" }, 409);
  const session = await resolveRequestDesktopSession(request, authority);
  if (!session) return denied();
  const { id } = await context.params;
  const versions = request.nextUrl.searchParams.getAll("expectedVersion");
  if (!validId(id) || versions.length !== 1 || !/^[1-9]\d{0,8}$/.test(versions[0])) {
    return reply({ ok: false, error: "invalid_release_version" }, 400);
  }
  try {
    const organizationId = String(session.organizationId), expectedVersion = Number(versions[0]);
    const row = await exactRelease(organizationId, id, expectedVersion);
    if (row?.status !== "submitted" && row?.status !== "closed") return changed();
    const digest = (intake: unknown) => sha256ContentHash({ requestVersion: expectedVersion, intake });
    const expectedDigest = digest(row.intakeJson);
    const wait = row.status === "submitted" ? await prisma.durableAgentWorkflow.findFirst({ where: {
      organizationId, workflowKind: RELEASE_BATCH_OBSERVATION_KIND,
      id: "release_batch_" + sha256ContentHash({ organizationId, requestId: id, expectedVersion, expectedDigest }),
    } }) : null;
    const currentSession = await resolveRequestDesktopSession(request, {...authority, recordHeartbeat: false});
    if (!currentSession || currentSession.organizationId !== session.organizationId ||
      currentSession.userId !== session.userId || currentSession.id !== session.id || request.signal.aborted) return denied();
    const current = await exactRelease(organizationId, id, expectedVersion);
    if (request.signal.aborted) return denied();
    if (current?.status === "closed") return reply({ok:true,data:{
      requestVersion: expectedVersion, closedRelease: {requestId: id, version: expectedVersion},
      monitoringEnabled:false, canStart:false, canCancel:false, wait:null,
    }});
    if (current?.status !== "submitted" || row.status !== "submitted" || digest(current.intakeJson) !== expectedDigest) return changed();
    const monitoringEnabled = releaseBatchObservationsEnabled();
    const authorized = currentSession.capabilities.includes("deploy:execute");
    return reply({ ok: true, data: { requestVersion: expectedVersion, monitoringEnabled,
      canStart: monitoringEnabled && authorized && !wait,
      canCancel: authorized && !!wait && wait.requestedByUserId === String(currentSession.userId)
        && ["queued", "running", "retrying", "paused_for_input"].includes(wait.status),
      wait: wait ? projection(wait) : null } });
  } catch { return reply({ ok: false, error: "batch_wait_unavailable" }, 502); }
}

const cancellationSchema = z.object({ waitId: z.string().regex(/^release_batch_[a-f0-9]{64}$/), expectedWaitVersion: z.number().int().nonnegative().max(999_999_999) }).strict();
/** Cancels only the current authorized creator's read-only wait, even if disabled. */
export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await resolveRequestDesktopSession(request, { requiredScope: "pipeline:trigger", requiredCapability: "deploy:execute", allowApiKey: false, route: "DELETE /api/desktop/deployments/:id/batch-wait" });
  if (!session) return reply({ ok: false, error: "desktop_session_required" }, 401);
  const { id } = await context.params; let parsed: z.infer<typeof cancellationSchema>;
  try { parsed = cancellationSchema.parse(await body(request)); if (!validId(id)) throw new Error("invalid_id"); }
  catch { return reply({ ok: false, error: "invalid_batch_wait_cancellation" }, 400); }
  try {
    const data = await cancelReleaseBatchObservation({ organizationId: String(session.organizationId), requestId: id,
      workflowRunId: parsed.waitId, expectedVersion: parsed.expectedWaitVersion, actorUserId: String(session.userId) });
    return reply({ ok: true, data: projection(data) });
  } catch { return reply({ ok: false, error: "batch_wait_changed" }, 409); }
}
