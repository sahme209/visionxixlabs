/**
 * POST /api/desktop/handoff
 *
 * Authenticated containment boundary: signed issuance is unavailable until
 * server-owned artifact bytes and plan/approval provenance can be resolved.
 * Caller-supplied IDs/checksums never become authoritative signed evidence.
 * Existing unsigned previews and approved HCL downloads remain separate.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireContext } from "@/lib/auth/currentContext";
import { loadAppEnv } from "@/lib/config/env";
import { getDesktopAvailability } from "@/lib/config/providerModes";
import { apiFailure } from "@/lib/api/dtoMappers";
import { AxiomErrors, httpStatusFor, toAxiomError } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  void request; // Caller assertions cannot establish artifact authority.
  try {
    await requireContext();
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

    // A valid signature proves envelope integrity, not that caller-supplied
    // plan/approval identifiers or hashes resolve to approved artifact bytes.
    // No authoritative stored-artifact issuing boundary exists yet. Refuse
    // every operation rather than laundering those claims into signed proof.
    throw AxiomErrors.policy(
      "handoff.authoritative_artifact_unavailable",
      "Signed handoff issuance is unavailable until server-verified artifacts are bound to the plan. Use the existing read-only preview or approved plan download. Local execution remains disabled.",
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
