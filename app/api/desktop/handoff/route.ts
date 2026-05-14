/**
 * POST /api/desktop/handoff
 *
 * Issues a signed desktop handoff for an approved execution plan. Auth
 * required. Refuses when:
 *   - desktop mode is disabled,
 *   - execution plan id missing,
 *   - allowedOperation is `execute_local` and no approval id supplied,
 *   - signing key isn't available (falls back to NEXTAUTH_SECRET when set).
 *
 * Returns the typed `SignedHandoff` envelope the desktop runtime
 * validates against `validateHandoff()`.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireContext } from "@/lib/auth/currentContext";
import { loadAppEnv } from "@/lib/config/env";
import { getDesktopAvailability } from "@/lib/config/providerModes";
import {
  HANDOFF_CONTRACT_VERSION,
} from "@/lib/desktop/handoffContract";
import type {
  DesktopCapabilityRequirement,
  HandoffArtifactRef,
  HandoffOperation,
  HandoffPayload,
  HandoffResourceSummary,
} from "@/lib/desktop/handoffContract";
import { newHandoffNonce, signHandoff, ACTIVE_SIGNING_KEY_ID } from "@/lib/desktop/handoffSigner";
import { apiFailure, apiSuccess } from "@/lib/api/dtoMappers";
import { AxiomErrors, httpStatusFor, toAxiomError } from "@/lib/errors/axiomErrors";
import { id } from "@/lib/domain/ids";
import { asRecord, requireEnum, requireString, optionalString } from "@/lib/security/validation";
import { createHash } from "node:crypto";

export const dynamic = "force-dynamic";

const ALLOWED_OPERATIONS: HandoffOperation[] = ["review_only", "preview_local", "execute_local", "verify_only"];
const ALLOWED_CAPABILITIES: DesktopCapabilityRequirement[] = ["review", "preview", "verify", "apply", "audit_sync", "keychain"];

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const ctx = await requireContext();
    const env = loadAppEnv();

    // Refuse outright when desktop is disabled.
    const desktopMode = getDesktopAvailability();
    if (desktopMode === "disabled") {
      throw AxiomErrors.policy("desktop.disabled", "Desktop runtime is disabled on this deployment.");
    }
    // Refuse when no signing key is reachable (signer falls back to NEXTAUTH_SECRET).
    if (!env.desktopHandoffSigningKeySet && !env.nextAuthSecret) {
      throw AxiomErrors.internal(
        "desktop.signer.no_key",
        "DESKTOP_HANDOFF_SIGNING_KEY or NEXTAUTH_SECRET (≥ 32 chars) is required.",
      );
    }

    const body = asRecord(await request.json().catch(() => ({})));
    const executionPlanIdStr = requireString(body.executionPlanId, "executionPlanId", { max: 128 });
    const allowedOperation   = requireEnum(body.allowedOperation, "allowedOperation", ALLOWED_OPERATIONS as readonly HandoffOperation[]);
    const policyDecisionIdStr = requireString(body.policyDecisionId, "policyDecisionId", { max: 128 });
    const approvalIdStr      = optionalString(body.approvalId, "approvalId", { max: 128 });
    const ttlMinutes         = body.ttlMinutes !== undefined && typeof body.ttlMinutes === "number"
      ? Math.min(60, Math.max(1, body.ttlMinutes))
      : 30;

    // Apply-class handoffs require an explicit approval id.
    if (allowedOperation === "execute_local" && !approvalIdStr) {
      throw AxiomErrors.policy("handoff.execute_requires_approval", "execute_local handoff requires an approvalId.");
    }

    // Capabilities default to read-only set when not supplied.
    const capabilitiesRaw = Array.isArray(body.requiredCapabilities) ? body.requiredCapabilities : ["review", "preview"];
    const requiredCapabilities = capabilitiesRaw.filter((c): c is DesktopCapabilityRequirement =>
      typeof c === "string" && (ALLOWED_CAPABILITIES as readonly string[]).includes(c)
    );

    const resourceSummary: HandoffResourceSummary = body.resourceSummary && typeof body.resourceSummary === "object"
      ? (body.resourceSummary as HandoffResourceSummary)
      : { total: 0, byProvider: {}, blastRadius: "contained" };

    const artifactsRaw = Array.isArray(body.artifacts) ? body.artifacts : [];
    const artifacts: HandoffArtifactRef[] = artifactsRaw.filter(
      (a): a is HandoffArtifactRef =>
        typeof a === "object" && a !== null &&
        typeof (a as HandoffArtifactRef).id === "string" &&
        typeof (a as HandoffArtifactRef).path === "string"
    );

    // Plan checksum — when not provided, derive a stable one from the
    // signed inputs so the desktop can verify it against its local copy.
    const planChecksum = typeof body.planChecksum === "string"
      ? body.planChecksum
      : createHash("sha256").update(JSON.stringify({ executionPlanIdStr, allowedOperation, policyDecisionIdStr })).digest("hex");

    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + ttlMinutes * 60 * 1000);

    const handoffId = `hf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

    const payload: HandoffPayload = {
      version: HANDOFF_CONTRACT_VERSION,
      handoffId,
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      executionPlanId: id.executionPlan(executionPlanIdStr),
      allowedOperation,
      policyDecisionId: id.policyRule(policyDecisionIdStr),
      approvalId: approvalIdStr ? id.approval(approvalIdStr) : undefined,
      requiredCapabilities,
      issuedAt: issuedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      nonce: newHandoffNonce(),
      planChecksum,
      resourceSummary,
      artifacts,
      auditSyncRequired: true,
    };

    const signed = signHandoff(payload);

    return NextResponse.json(
      apiSuccess({
        signed,
        meta: {
          keyId: ACTIVE_SIGNING_KEY_ID,
          mode: desktopMode,
          ttlMinutes,
        },
      }),
      { status: 200 },
    );
  } catch (err) {
    const axiomErr = toAxiomError(err);
    return NextResponse.json(apiFailure(axiomErr), { status: httpStatusFor(axiomErr.category) });
  }
}

export async function GET() {
  return NextResponse.json(
    apiFailure(AxiomErrors.validation("method.not_allowed", "Use POST.")),
    { status: 405 },
  );
}
