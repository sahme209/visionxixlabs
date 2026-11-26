/**
 * GET /api/v1/environments/{slug}/variables
 *
 * The resolved configuration variables for one environment (workspace
 * defaults overridden by that environment's values) plus their
 * fingerprint, so a customer's CI can load configuration at deploy time
 * and record exactly which configuration it used.
 *
 * Auth   : Bearer API key with `pipeline:read` scope (or `*`).
 * Values : plain configuration only; V19 refuses credential-like values
 *          when variables are saved, so secrets never come from here.
 */
import { NextResponse, type NextRequest } from "next/server";
import { authenticateApiKey } from "@/lib/security/authenticateApiKey";
import { prisma } from "@/lib/db";
import { MAX_VARIABLES_PER_WORKSPACE, resolvedDigest } from "@/lib/releaseops/scopedVariables";
import { MAX_VARIABLE_SETS, resolveWithSets } from "@/lib/releaseops/variableSets";
import { secretReferencesIn } from "@/lib/releaseops/secretReferences";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "private, no-store" };

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const auth = await authenticateApiKey({
    authorizationHeader: req.headers.get("authorization"),
    sourceIp: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? null,
    requiredScope: "pipeline:read",
    correlationId: `v1_env_variables_${Date.now().toString(36)}`,
    route: "GET /api/v1/environments/{slug}/variables",
  });
  if (!auth.ok) {
    const headers: Record<string, string> = { ...noStore };
    if (typeof auth.retryAfterSeconds === "number") headers["Retry-After"] = String(auth.retryAfterSeconds);
    return NextResponse.json({ ok: false, error: auth.reason, ...(auth.requiredScope ? { requiredScope: auth.requiredScope } : {}) }, { status: auth.httpStatus, headers });
  }
  const { slug } = await params;
  if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(slug)) return NextResponse.json({ ok: false, error: "environment_slug_invalid" }, { status: 400, headers: noStore });
  try {
    const environment = await prisma.environment.findFirst({ where: { organizationId: auth.organizationId, slug }, select: { id: true, slug: true, name: true, tags: true } });
    if (!environment) return NextResponse.json({ ok: false, error: "environment_not_found" }, { status: 404, headers: noStore });
    const [stored, sets] = await Promise.all([
      prisma.configVariable.findMany({ where: { organizationId: auth.organizationId }, take: MAX_VARIABLES_PER_WORKSPACE, select: { key: true, value: true, scopeKey: true } }),
      prisma.variableSet.findMany({ where: { organizationId: auth.organizationId }, take: MAX_VARIABLE_SETS, select: { slug: true, name: true, selector: true } }),
    ]);
    const { resolved, conflicts } = resolveWithSets(stored, { id: environment.id, tags: environment.tags ?? [] }, sets);
    return NextResponse.json({
      ok: true,
      environment: { slug: environment.slug, name: environment.name },
      variables: Object.fromEntries(resolved.map((v) => [v.key, v.value])),
      sources: Object.fromEntries(resolved.map((v) => [v.key, v.source])),
      digest: resolvedDigest(resolved),
      count: resolved.length,
      ...(conflicts.length ? { conflicts } : {}),
      // Secret references are returned as written; V19 never resolves them. Your CI reads them with its own identity.
      ...(() => { const refs = secretReferencesIn(resolved); return Object.keys(refs).length ? { secretRefs: refs } : {}; })(),
    }, { headers: noStore });
  } catch {
    return NextResponse.json({ ok: false, error: "variables_unavailable" }, { status: 503, headers: noStore });
  }
}
