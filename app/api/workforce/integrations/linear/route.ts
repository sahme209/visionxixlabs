/** POST /api/workforce/integrations/linear — Phase 648 — save Linear integration. */

import { NextResponse } from "next/server";
import { requireContext } from "@/lib/auth/currentContext";
import {
  isValidCredentialReference,
  isValidLinearLabel,
  isValidLinearTeamId,
  readIntegrationConfig,
  writeIntegrationConfig,
} from "@/lib/workforce/domains/integrationRegistry";
import { record as auditRecord } from "@/lib/audit/secureAudit";
import { id as ids } from "@/lib/domain/ids";
import type { CorrelationId } from "@/lib/domain/ids";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function s(v: FormDataEntryValue | null): string { return typeof v === "string" ? v : ""; }

export async function POST(req: Request) {
  const ctx = await requireContext();
  const org = String(ctx.organizationId);
  const f = await req.formData();
  const correlationId = `integration_linear_${Date.now().toString(36)}` as CorrelationId;

  const teamId = s(f.get("teamId")).trim();
  const apiKeyReference = s(f.get("apiKeyReference")).trim();
  const labelName = s(f.get("labelName")).trim() || "axiom-finding";
  const enabled = s(f.get("enabled")) !== "false";

  if (!isValidLinearTeamId(teamId)) {
    return NextResponse.redirect(
      new URL("/dashboard/workforce/integrations?error=invalid_linear_team_id", req.url),
      303,
    );
  }
  if (!isValidCredentialReference(apiKeyReference)) {
    return NextResponse.redirect(
      new URL("/dashboard/workforce/integrations?error=invalid_linear_api_key_reference", req.url),
      303,
    );
  }
  if (!isValidLinearLabel(labelName)) {
    return NextResponse.redirect(
      new URL("/dashboard/workforce/integrations?error=invalid_linear_label", req.url),
      303,
    );
  }

  const existing = await readIntegrationConfig(org);
  await writeIntegrationConfig(org, {
    github: existing.github,
    slackActions: existing.slackActions,
    linear: { enabled, teamId, apiKeyReference, labelName },
  });

  void auditRecord({
    organizationId: ids.organization(org),
    actorUserId: ctx.userId ? ids.user(String(ctx.userId)) : undefined,
    action: "policy.update",
    outcome: "success",
    entityRef: "integration:linear",
    correlationId,
    detail: { integration: "linear", enabled, teamId, labelName },
  });

  return NextResponse.redirect(new URL("/dashboard/workforce/integrations?notice=saved", req.url), 303);
}
