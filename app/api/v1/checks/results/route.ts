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
    const check = await prisma.deploymentCheck.findFirst({ where: { organizationId: auth.organizationId, key: r.checkKey }, select: { version: true, stage: true } });
    if (!check) return NextResponse.json({ ok: false, error: "check_not_found" }, { status: 404, headers: noStore });
    try {
      await prisma.deploymentCheckResult.create({ data: { organizationId: auth.organizationId, apiKeyId: auth.apiKeyId, ...r } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return NextResponse.json({ ok: true, recorded: false, duplicate: true }, { headers: noStore });
      throw err;
    }
    return NextResponse.json({ ok: true, recorded: true, currentVersion: check.version, stale: r.checkVersion !== check.version }, { status: 201, headers: noStore });
  } catch {
    return NextResponse.json({ ok: false, error: "results_unavailable" }, { status: 503, headers: noStore });
  }
}
