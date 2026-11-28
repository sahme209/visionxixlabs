/**
 * POST /api/v1/checks/results
 *
 * Customer CI reports the result of one deployment check run. Evidence only: V19 did not run the
 * check and records exactly what was reported, with the API key that reported it. Idempotent per
 * workspace on `idempotencyKey`, so a retried CI step cannot record the same run twice.
 *
 * Auth: Bearer API key with the `checks:report` scope. Kept separate from agent governance keys so
 * an agent key cannot certify its own deployment checks. Records evidence only; grants no execution.
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { authenticateApiKey } from "@/lib/security/authenticateApiKey";
import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/prismaClient";
import { CHECK_STAGES } from "@/lib/releaseops/deploymentChecks";
import { evaluateCostResult, toCents } from "@/lib/releaseops/costEstimate";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "private, no-store" };

const resultSchema = z.object({
  checkKey: z.string().regex(/^[a-z0-9][a-z0-9-]{0,62}$/),
  checkVersion: z.number().int().positive(),
  stage: z.enum(CHECK_STAGES),
  status: z.enum(["passed", "failed", "error"]),
  durationMs: z.number().int().min(0).max(86_400_000).optional(),
  runUrl: z.string().url().max(2000).refine((u) => u.startsWith("https://"), "https only").optional(),
  environmentSlug: z.string().regex(/^[a-z0-9][a-z0-9-]{0,62}$/).optional(),
  releaseRef: z.string().min(1).max(200).optional(),
  idempotencyKey: z.string().regex(/^[A-Za-z0-9._:-]{8,200}$/),
  /** Cost estimate checks only: estimated monthly cost in US dollars. */
  monthlyCostUsd: z.number().finite().min(0).max(100_000_000).optional(),
}).strict();

export async function POST(req: NextRequest): Promise<NextResponse> {
  const auth = await authenticateApiKey({
    authorizationHeader: req.headers.get("authorization"),
    sourceIp: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? null,
    requiredScope: "checks:report",
    correlationId: `v1_check_result_${Date.now().toString(36)}`,
    route: "POST /api/v1/checks/results",
  });
  if (!auth.ok) {
    const headers: Record<string, string> = { ...noStore };
    if (typeof auth.retryAfterSeconds === "number") headers["Retry-After"] = String(auth.retryAfterSeconds);
    return NextResponse.json({ ok: false, error: auth.reason, ...(auth.requiredScope ? { requiredScope: auth.requiredScope } : {}) }, { status: auth.httpStatus, headers });
  }
  const text = await req.text();
  if (text.length > 8 * 1024) return NextResponse.json({ ok: false, error: "payload_too_large" }, { status: 413, headers: noStore });
  let raw: unknown; try { raw = JSON.parse(text); } catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400, headers: noStore }); }
  const parsed = resultSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "invalid_payload", issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) }, { status: 422, headers: noStore });
  const r = parsed.data;
  try {
    const check = await prisma.deploymentCheck.findFirst({ where: { organizationId: auth.organizationId, key: r.checkKey }, select: { version: true, stage: true, kind: true, spec: true } });
    if (!check) return NextResponse.json({ ok: false, error: "check_not_found" }, { status: 404, headers: noStore });
    const { monthlyCostUsd, ...reported } = r;
    let recorded: { status: "passed" | "failed" | "error"; monthlyCostCents: number | null; statusReason: string | null } = { status: r.status, monthlyCostCents: null, statusReason: null };
    let deltaCents: number | null = null;
    if (check.kind === "cost_estimate") {
      // V19 compares with the latest estimate for a different commit; CI's own verdict cannot pass a change over the limit.
      const costCents = monthlyCostUsd === undefined ? null : toCents(monthlyCostUsd);
      const previous = await prisma.deploymentCheckResult.findFirst({ where: { organizationId: auth.organizationId, checkKey: r.checkKey, monthlyCostCents: { not: null }, NOT: { releaseRef: r.releaseRef ?? "" } }, orderBy: { reportedAt: "desc" }, select: { monthlyCostCents: true } });
      const limit = Number((check.spec as { maxMonthlyIncreaseUsd?: unknown } | null)?.maxMonthlyIncreaseUsd);
      const decision = evaluateCostResult({ reportedStatus: r.status, costCents, previousCents: previous?.monthlyCostCents ?? null, maxMonthlyIncreaseUsd: Number.isFinite(limit) ? limit : 0 });
      recorded = { status: decision.status, monthlyCostCents: costCents, statusReason: decision.reason };
      deltaCents = decision.deltaCents;
    } else if (monthlyCostUsd !== undefined) {
      return NextResponse.json({ ok: false, error: "invalid_payload", issues: ["monthlyCostUsd: only for cost estimate checks"] }, { status: 422, headers: noStore });
    }
    try {
      await prisma.deploymentCheckResult.create({ data: { organizationId: auth.organizationId, apiKeyId: auth.apiKeyId, ...reported, ...(check.kind === "cost_estimate" ? recorded : {}) } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return NextResponse.json({ ok: true, recorded: false, duplicate: true }, { headers: noStore });
      throw err;
    }
    return NextResponse.json({ ok: true, recorded: true, currentVersion: check.version, stale: r.checkVersion !== check.version, ...(check.kind === "cost_estimate" ? { recordedStatus: recorded.status, statusReason: recorded.statusReason, monthlyCostDeltaCents: deltaCents } : {}) }, { status: 201, headers: noStore });
  } catch {
    return NextResponse.json({ ok: false, error: "results_unavailable" }, { status: 503, headers: noStore });
  }
}
