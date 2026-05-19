/**
 * /api/flags
 *
 * GET    — returns every flag (catalog × per-tenant overrides).
 * POST   — sets one flag. Body: { key, enabled, rationale? }.
 * DELETE — clears one override. Body: { key }.
 *
 * Tenant-scoped, audited.
 */

import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import {
  clearFeatureFlag,
  readFeatureFlags,
  setFeatureFlag,
} from "@/lib/flags/featureFlagStore";
import { isFeatureFlagKey, type FeatureFlagKey } from "@/lib/flags/featureFlagCatalog";
import { apiOk, apiErr, asApiSourceMode, resolveCorrelationId } from "@/lib/api";
import { AxiomErrors } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const correlationId = resolveCorrelationId(req.headers);
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated || !ctx.organizationId) {
      throw AxiomErrors.validation("auth.required", "Sign in required.");
    }
    const records = await readFeatureFlags({ organizationId: String(ctx.organizationId) });
    return apiOk({ records, total: records.length, overrideCount: records.filter((r) => r.hasOverride).length }, {
      correlationId,
      safetyContract: "policy_governance_read_only",
      sourceMode: asApiSourceMode("live"),
    });
  } catch (err) {
    return apiErr(err, { correlationId, safetyContract: "policy_governance_read_only" });
  }
}

export async function POST(req: NextRequest) {
  const correlationId = resolveCorrelationId(req.headers);
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated || !ctx.organizationId) {
      throw AxiomErrors.validation("auth.required", "Sign in required.");
    }
    const body = (await req.json()) as { key?: string; enabled?: boolean; rationale?: string } | null;
    if (!body?.key || typeof body.enabled !== "boolean" || !isFeatureFlagKey(body.key)) {
      throw AxiomErrors.validation("flag.invalid", "Body must include a valid key + boolean enabled.");
    }
    const record = await setFeatureFlag({
      organizationId: String(ctx.organizationId),
      key: body.key as FeatureFlagKey,
      enabled: body.enabled,
      rationale: body.rationale,
      updatedBy: ctx.userId ? String(ctx.userId) : undefined,
    });
    return apiOk({ record }, {
      correlationId,
      safetyContract: "policy_governance_read_only",
      sourceMode: asApiSourceMode("live"),
    });
  } catch (err) {
    return apiErr(err, { correlationId, safetyContract: "policy_governance_read_only" });
  }
}

export async function DELETE(req: NextRequest) {
  const correlationId = resolveCorrelationId(req.headers);
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated || !ctx.organizationId) {
      throw AxiomErrors.validation("auth.required", "Sign in required.");
    }
    const body = (await req.json()) as { key?: string } | null;
    if (!body?.key || !isFeatureFlagKey(body.key)) {
      throw AxiomErrors.validation("flag.invalid", "Body must include a valid key.");
    }
    const cleared = await clearFeatureFlag({
      organizationId: String(ctx.organizationId),
      key: body.key as FeatureFlagKey,
    });
    return apiOk({ cleared }, {
      correlationId,
      safetyContract: "policy_governance_read_only",
      sourceMode: asApiSourceMode("live"),
    });
  } catch (err) {
    return apiErr(err, { correlationId, safetyContract: "policy_governance_read_only" });
  }
}
