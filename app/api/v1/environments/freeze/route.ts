/**
 * POST /api/v1/environments/freeze
 *
 * Lets incident tooling (a PagerDuty or Opsgenie workflow, a chat command, CI) stop deployments at once:
 * freezes production (tier prod) or every environment from now for 1 to 24 hours with a reason. It can
 * only tighten: ending a freeze early stays with owners and admins in the cockpit.
 *
 * Auth: Bearer API key with the `freeze:start` scope. Idempotent on `idempotencyKey` for 24 hours: a
 * retried call returns the original result instead of adding a second freeze.
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { authenticateApiKey } from "@/lib/security/authenticateApiKey";
import { prisma } from "@/lib/db";
import { appendAuditEvent, type AuditEventRepo } from "@/lib/releaseops/auditEventResponder";
import { applyDeploymentFreeze } from "@/lib/releaseops/deploymentFreezeStore";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "private, no-store" };
export const API_FREEZE_MAX_HOURS = 24;

const bodySchema = z.object({
  scope: z.enum(["production", "all"]),
  hours: z.number().int().min(1).max(API_FREEZE_MAX_HOURS),
  reason: z.string().trim().min(3).max(200),
  idempotencyKey: z.string().regex(/^[A-Za-z0-9._:-]{8,200}$/).optional(),
}).strict();

export async function POST(req: NextRequest): Promise<NextResponse> {
  const auth = await authenticateApiKey({
    authorizationHeader: req.headers.get("authorization"),
    sourceIp: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? null,
    requiredScope: "freeze:start",
    correlationId: `v1_freeze_${Date.now().toString(36)}`,
    route: "POST /api/v1/environments/freeze",
  });
  if (!auth.ok) {
    const headers: Record<string, string> = { ...noStore };
    if (typeof auth.retryAfterSeconds === "number") headers["Retry-After"] = String(auth.retryAfterSeconds);
    return NextResponse.json({ ok: false, error: auth.reason, ...(auth.requiredScope ? { requiredScope: auth.requiredScope } : {}) }, { status: auth.httpStatus, headers });
  }
  const text = await req.text();
  if (text.length > 4 * 1024) return NextResponse.json({ ok: false, error: "payload_too_large" }, { status: 413, headers: noStore });
  let raw: unknown; try { raw = JSON.parse(text); } catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400, headers: noStore }); }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "invalid_payload", issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) }, { status: 422, headers: noStore });
  const { scope, hours, reason, idempotencyKey } = parsed.data;
  const organizationId = auth.organizationId;
  const subjectId = idempotencyKey ? `freeze:${idempotencyKey}` : null;
  try {
    if (subjectId) {
      const prior = await prisma.auditEvent.findFirst({ where: { organizationId, kind: "environment.freeze", subjectId, createdAt: { gte: new Date(Date.now() - 86_400_000) } }, select: { summary: true } });
      if (prior) return NextResponse.json({ ok: true, duplicate: true, summary: prior.summary }, { headers: noStore });
    }
    const out = await applyDeploymentFreeze(organizationId, { action: "start", scope, hours, reason });
    if (!out.ok) return NextResponse.json({ ok: false, error: out.error, ...(out.skipped?.length ? { skipped: out.skipped } : {}) }, { status: 409, headers: noStore });
    const summary = `API key froze ${out.environments.join(", ")} until ${out.endsAt}: ${reason}`;
    try {
      await appendAuditEvent(prisma as unknown as AuditEventRepo, { organizationId, kind: "environment.freeze", subjectKind: "environment", subjectId: subjectId ?? `freeze:${auth.apiKeyId}:${Date.now()}`, summary, actorUserId: null, detailJson: { apiKeyId: auth.apiKeyId, scope, hours, reason, environments: out.environments } });
    } catch { /* best-effort */ }
    return NextResponse.json({ ok: true, environments: out.environments, skipped: out.skipped, endsAt: out.endsAt }, { status: 201, headers: noStore });
  } catch {
    return NextResponse.json({ ok: false, error: "freeze_unavailable" }, { status: 503, headers: noStore });
  }
}
