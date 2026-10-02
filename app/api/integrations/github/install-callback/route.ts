/**
 * GET /api/integrations/github/install-callback — Phase 502.
 *
 * Called by GitHub after the user completes (or cancels) the App
 * install flow. Query params from GitHub:
 *   installation_id  — the new installation
 *   setup_action     — "install" | "update" | "request"
 *   state            — a short-lived, one-time workspace binding
 *
 * This handler consumes the browser state, captures the installation_id, then redirects back into
 * the lightweight web companion. The actual GitHub API account-info fetch (to enrich
 * accountLogin / accountType) lands in a follow-on phase that wires
 * the App's private key for installation-token minting; for now we
 * default to a synthesized login so the rest of the flow can ship.
 */

import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import {
  buildInstallationCaptureResponse,
  type GitHubInstallationRepo,
} from "@/lib/releaseops/githubInstallationResponder";
import { appendAuditEvent, type AuditEventRepo } from "@/lib/releaseops/auditEventResponder";
import {
  consumeTenantIntegrationAuthorization,
  type TenantConnectionRepo,
} from "@/lib/integrations/tenantConnectionRepo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest): Promise<Response> {
  const url = new URL(req.url);
  const installationId = url.searchParams.get("installation_id");
  const setupAction = url.searchParams.get("setup_action") ?? "install";
  const state = url.searchParams.get("state") ?? "";
  const authorization = await consumeTenantIntegrationAuthorization(
    prisma as unknown as TenantConnectionRepo,
    { state, provider: "github" },
  );

  if (!authorization.ok) {
    return NextResponse.redirect(new URL("/auth/success?integration=github&status=invalid_state", req.url));
  }

  // GitHub sends users here after a "request to install" flow even
  // when they don't have admin access to the org. We acknowledge but
  // do not persist.
  if (setupAction === "request") {
    return NextResponse.redirect(new URL("/auth/success?integration=github&status=approval_requested", req.url));
  }

  if (!installationId) {
    return NextResponse.redirect(new URL("/auth/success?integration=github&status=missing_installation", req.url));
  }

  const organizationId = authorization.attempt.organizationId;

  const r = await buildInstallationCaptureResponse(
    prisma as unknown as GitHubInstallationRepo,
    {
      organizationId,
      githubInstallationId: installationId,
      // Synthesized until Phase 503 wires the GitHub API enrichment.
      accountLogin: `gh-installation-${installationId}`,
      accountType: "Organization",
      repositorySelection: "selected",
      installedByUserId: authorization.attempt.initiatedByUserId,
      sourceFlow: setupAction,
      // State is a short-lived bearer secret. Never store it in callback metadata.
      rawCallbackJson: { installation_id: installationId, setup_action: setupAction },
    },
  );

  if (r.body.ok) {
    await appendAuditEvent(prisma as unknown as AuditEventRepo, {
      organizationId,
      kind: "github_installation.capture",
      subjectKind: "repository",
      subjectId: r.body.data.installation.id,
      summary: r.body.data.created
        ? `GitHub App installed (installation #${installationId})`
        : `GitHub App reactivated (installation #${installationId})`,
      actorUserId: authorization.attempt.initiatedByUserId,
    });
  }

  const status = r.body.ok ? "connected" : "error";
  const redirectUrl = new URL(`/auth/success?integration=github&status=${status}`, req.url);
  return NextResponse.redirect(redirectUrl);
}
