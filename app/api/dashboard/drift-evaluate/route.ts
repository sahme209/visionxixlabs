/**
 * POST /api/dashboard/drift-evaluate — Phase 486.
 *
 * Body: { declared: DeclaredResource[], observed: ObservedResource[] }
 *
 * External scripts (Terraform plan parser, cloud describe loop) POST
 * their declared + observed snapshots; this route runs the Phase 485
 * detector and upserts the resulting findings into DriftFinding.
 * Resources that previously had open findings but now match get
 * auto-resolved.
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import {
  buildDriftPersistResponse,
  type DriftPersistRepo,
} from "@/lib/releaseops/driftPersistResponder";
import {
  ALL_RESOURCE_KINDS,
  type DeclaredResource,
  type ObservedResource,
  type ResourceKind,
} from "@/lib/releaseops/driftDetector";

export const dynamic = "force-dynamic";

function isResourceKind(s: unknown): s is ResourceKind {
  return typeof s === "string" && (ALL_RESOURCE_KINDS as readonly string[]).includes(s);
}

function normalizeDeclared(raw: unknown): DeclaredResource | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!isResourceKind(r.resourceKind)) return null;
  if (typeof r.resourceId !== "string" || typeof r.displayName !== "string") return null;
  if (!r.attributes || typeof r.attributes !== "object") return null;
  const sensitive = Array.isArray(r.sensitiveAttributeKeys)
    ? r.sensitiveAttributeKeys.filter((s): s is string => typeof s === "string")
    : undefined;
  return {
    resourceKind: r.resourceKind,
    resourceId: r.resourceId,
    displayName: r.displayName,
    ...(typeof r.applicationId === "string" ? { applicationId: r.applicationId } : {}),
    ...(typeof r.environmentTier === "string" ? { environmentTier: r.environmentTier } : {}),
    attributes: r.attributes as Record<string, unknown>,
    ...(sensitive && sensitive.length > 0 ? { sensitiveAttributeKeys: sensitive } : {}),
  };
}

function normalizeObserved(raw: unknown): ObservedResource | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!isResourceKind(r.resourceKind)) return null;
  if (typeof r.resourceId !== "string") return null;
  if (!r.attributes || typeof r.attributes !== "object") return null;
  return {
    resourceKind: r.resourceKind,
    resourceId: r.resourceId,
    ...(typeof r.displayName === "string" ? { displayName: r.displayName } : {}),
    attributes: r.attributes as Record<string, unknown>,
  };
}

export async function POST(req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }

  let body: { declared?: unknown; observed?: unknown } = {};
  try { body = await req.json(); } catch { /* fall through */ }

  if (!Array.isArray(body.declared) || !Array.isArray(body.observed)) {
    return NextResponse.json(
      { ok: false, error: "invalid_payload", hint: "Body must contain { declared: [], observed: [] } arrays." },
      { status: 400 },
    );
  }

  const declared = body.declared.map(normalizeDeclared).filter((d): d is DeclaredResource => d !== null);
  const observed = body.observed.map(normalizeObserved).filter((o): o is ObservedResource => o !== null);

  const r = await buildDriftPersistResponse(
    prisma as unknown as DriftPersistRepo,
    { organizationId: ctx.organizationId, declared, observed },
  );
  return NextResponse.json(r.body, { status: r.status });
}
