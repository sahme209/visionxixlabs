/**
 * GET /api/v1/config
 *
 * The workspace's configuration as code in one document: environments (tier, tags, change window),
 * variable sets, variables (plain configuration; secret references stay unresolved) and deployment
 * checks in the v19.checks/v1 shape. The read side of a future Terraform provider and useful in CI.
 *
 * Auth  : Bearer API key with `config:read` scope (or `config:*` / `*`).
 * Writes: none. Changes go through the cockpit and its governed, compare-and-set paths.
 */
import { NextResponse, type NextRequest } from "next/server";
import { authenticateApiKey } from "@/lib/security/authenticateApiKey";
import { prisma } from "@/lib/db";
import { MAX_VARIABLES_PER_WORKSPACE } from "@/lib/releaseops/scopedVariables";
import { MAX_VARIABLE_SETS } from "@/lib/releaseops/variableSets";
import { MAX_CHECKS_PER_WORKSPACE } from "@/lib/releaseops/deploymentChecks";
import { CHECKS_DOCUMENT_KIND, CHECKS_DOCUMENT_VERSION } from "@/lib/releaseops/checksAsCode";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "private, no-store" };
const scopeLabel = (scopeKey: string, envSlug: Map<string, string>) => scopeKey === "workspace" ? { scope: "workspace" } : scopeKey.startsWith("set:") ? { scope: "set", set: scopeKey.slice(4) } : { scope: "environment", environment: envSlug.get(scopeKey.slice(4)) ?? null };

export async function GET(req: NextRequest) {
  const auth = await authenticateApiKey({
    authorizationHeader: req.headers.get("authorization"),
    sourceIp: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? null,
    requiredScope: "config:read",
    correlationId: `v1_config_${Date.now().toString(36)}`,
    route: "GET /api/v1/config",
  });
  if (!auth.ok) {
    const headers: Record<string, string> = { ...noStore };
    if (typeof auth.retryAfterSeconds === "number") headers["Retry-After"] = String(auth.retryAfterSeconds);
    return NextResponse.json({ ok: false, error: auth.reason, ...(auth.requiredScope ? { requiredScope: auth.requiredScope } : {}) }, { status: auth.httpStatus, headers });
  }
  const organizationId = auth.organizationId;
  try {
    const [environments, sets, variables, checks] = await Promise.all([
      prisma.environment.findMany({ where: { organizationId }, orderBy: [{ displayOrder: "asc" }, { slug: "asc" }], select: { id: true, slug: true, name: true, tier: true, tags: true, changeWindowRuleJson: true } }),
      prisma.variableSet.findMany({ where: { organizationId }, orderBy: { slug: "asc" }, take: MAX_VARIABLE_SETS, select: { slug: true, name: true, selector: true, version: true } }),
      prisma.configVariable.findMany({ where: { organizationId }, orderBy: [{ scopeKey: "asc" }, { key: "asc" }], take: MAX_VARIABLES_PER_WORKSPACE, select: { key: true, value: true, scopeKey: true, version: true } }),
      prisma.deploymentCheck.findMany({ where: { organizationId }, orderBy: { key: "asc" }, take: MAX_CHECKS_PER_WORKSPACE, select: { key: true, name: true, kind: true, stage: true, mode: true, spec: true, enabled: true, version: true } }),
    ]);
    const envSlug = new Map(environments.map((e) => [e.id, e.slug]));
    return NextResponse.json({
      ok: true,
      environments: environments.map((e) => ({ slug: e.slug, name: e.name, tier: e.tier, tags: e.tags ?? [], changeWindow: e.changeWindowRuleJson ?? null })),
      variableSets: sets,
      variables: variables.map((v) => ({ key: v.key, value: v.value, version: v.version, ...scopeLabel(v.scopeKey, envSlug) })),
      checks: { kind: CHECKS_DOCUMENT_KIND, version: CHECKS_DOCUMENT_VERSION, checks: checks.map((c) => ({ key: c.key, name: c.name, kind: c.kind, stage: c.stage, mode: c.mode, enabled: c.enabled, spec: c.spec, version: c.version })) },
    }, { headers: noStore });
  } catch {
    return NextResponse.json({ ok: false, error: "config_unavailable" }, { status: 503, headers: noStore });
  }
}
