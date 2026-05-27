/**
 * GET /api/integrations/github/install-callback — Phase 502.
 *
 * Called by GitHub after the user completes (or cancels) the App
 * install flow. Query params from GitHub:
 *   installation_id  — the new installation
 *   setup_action     — "install" | "update" | "request"
 *   state            — the organizationId we embedded in the install URL
 *
 * This handler captures the installation_id, then redirects back into
 * the dashboard. The actual GitHub API account-info fetch (to enrich
 * accountLogin / accountType) lands in a follow-on phase that wires
 * the App's private key for installation-token minting; for now we
 * default to a synthesized login so the rest of the flow can ship.
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import {
  buildInstallationCaptureResponse,
  type GitHubInstallationRepo,
} from "@/lib/releaseops/githubInstallationResponder";
import { appendAuditEvent, type AuditEventRepo } from "@/lib/releaseops/auditEventResponder";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest): Promise<Response> {
  const url = new URL(req.url);
  const installationId = url.searchParams.get("installation_id");
  const setupAction = url.searchParams.get("setup_action") ?? "install";
  const state = url.searchParams.get("state") ?? "";

  // GitHub sends users here after a "request to install" flow even
  // when they don't have admin access to the org. We acknowledge but
  // do not persist.
  if (setupAction === "request") {
    return NextResponse.redirect(new URL("/dashboard/connector-setup?install_request=1", req.url));
  }

  if (!installationId) {
    return NextResponse.redirect(new URL("/dashboard/connector-setup?install_error=missing_installation_id", req.url));
  }

  const ctx = await currentContext();
  // Trust the `state` we embedded over the session context — the user
  // may complete the install in a different browser/session. Fall back
  // to ctx.organizationId if state was lost.
  const organizationId = state || ctx.organizationId || "";
  if (!organizationId) {
    return NextResponse.redirect(new URL("/dashboard/connector-setup?install_error=no_org_in_state", req.url));
  }

  const r = await buildInstallationCaptureResponse(
    prisma as unknown as GitHubInstallationRepo,
    {
      organizationId,
      githubInstallationId: installationId,
      // Synthesized until Phase 503 wires the GitHub API enrichment.
      accountLogin: `gh-installation-${installationId}`,
      accountType: "Organization",
      repositorySelection: "selected",
      ...(ctx.userId ? { installedByUserId: ctx.userId } : {}),
      sourceFlow: setupAction,
      rawCallbackJson: Object.fromEntries(url.searchParams.entries()),
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
      actorUserId: ctx.userId ?? null,
    });
  }

  const status = r.body.ok ? "ok" : "error";
  const redirectUrl = new URL(`/dashboard/connector-setup?install=${status}`, req.url);
  return NextResponse.redirect(redirectUrl);
}
