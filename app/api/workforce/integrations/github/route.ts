/** POST /api/workforce/integrations/github — Phase 644 — save GitHub integration. */

import { NextResponse } from "next/server";
import { requireContext } from "@/lib/auth/currentContext";
import {
  isValidCredentialReference,
  isValidGithubRepo,
  readIntegrationConfig,
  writeIntegrationConfig,
} from "@/lib/workforce/domains/integrationRegistry";
import { record as auditRecord } from "@/lib/audit/secureAudit";
import { id as ids } from "@/lib/domain/ids";
import type { CorrelationId } from "@/lib/domain/ids";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function s(v: FormDataEntryValue | null): string { return typeof v === "string" ? v : ""; }

function sanitizeLabel(raw: string): string {
  const cleaned = raw.replace(/[^\w.-]/g, "-").slice(0, 64);
  return cleaned.length > 0 ? cleaned : "axiom-finding";
}

export async function POST(req: Request) {
  const ctx = await requireContext();
  const org = String(ctx.organizationId);
  const f = await req.formData();
  const correlationId = `integration_github_${Date.now().toString(36)}` as CorrelationId;

  const repo = s(f.get("repo")).trim();
  const patReference = s(f.get("patReference")).trim();
  const issueLabel = sanitizeLabel(s(f.get("issueLabel")).trim());
  const enabled = s(f.get("enabled")) !== "false";

  if (!isValidGithubRepo(repo)) {
    return NextResponse.redirect(
      new URL("/dashboard/workforce/integrations?error=invalid_repo", req.url),
      303,
    );
  }
  if (!isValidCredentialReference(patReference)) {
    return NextResponse.redirect(
      new URL("/dashboard/workforce/integrations?error=invalid_pat_reference", req.url),
      303,
    );
  }

  const existing = await readIntegrationConfig(org);
  await writeIntegrationConfig(org, {
    github: { enabled, repo, patReference, issueLabel },
    slackActions: existing.slackActions,
  });

  void auditRecord({
    organizationId: ids.organization(org),
    actorUserId: ctx.userId ? ids.user(String(ctx.userId)) : undefined,
    action: "policy.update",
    outcome: "success",
    entityRef: "integration:github",
    correlationId,
    detail: { integration: "github", enabled, repo, issueLabel },
  });

  return NextResponse.redirect(new URL("/dashboard/workforce/integrations?notice=saved", req.url), 303);
}
