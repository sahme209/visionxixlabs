/**
 * POST /api/github/sync
 *
 * On-demand GitHub live read-only sync. Runs the live scanner when
 * configured, otherwise returns honest preview data. Audited.
 *
 * Read-only by construction — the scanner never mutates GitHub.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { runLiveGithubSync, summarizeLiveOutcome } from "@/lib/connectors/github/githubLiveScanner";
import { runPreviewGithubSync } from "@/lib/connectors/github/githubPreviewSync";
import { getGithubMode } from "@/lib/connectors/github/githubLiveClient";
import { apiFailure, apiSuccess } from "@/lib/api/dtoMappers";
import { AxiomErrors, httpStatusFor, toAxiomError } from "@/lib/errors/axiomErrors";
import { record as auditRecord } from "@/lib/audit/secureAudit";
import { loadAppEnv } from "@/lib/config/env";
import type { CorrelationId } from "@/lib/domain/ids";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const correlationId = `gh_sync_${Date.now().toString(36)}` as CorrelationId;
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated || !ctx.userId || !ctx.organizationId) {
      throw AxiomErrors.validation("auth.required", "Sign in required.");
    }

    // The live path below authenticates with a single operator-level
    // credential (GITHUB_PAT / GitHub App), not a per-tenant
    // GitHubInstallation token — it has no way to verify the caller
    // actually owns whatever org it's pointed at. Honoring a
    // client-supplied organization here would let any authenticated
    // tenant use Axiom's own shared credential to probe an arbitrary
    // GitHub org/account. The only real caller (RunGithubSyncPanel)
    // always sends an empty body, so the override has no legitimate
    // use; the org is always the operator-configured default.
    const env = loadAppEnv();
    const organization = env.githubDefaultOrg ?? "your-org";

    const mode = getGithubMode();

    await auditRecord({
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      action: "scan.start",
      outcome: "success",
      entityRef: `github:${organization}`,
      correlationId,
      detail: { mode, organization },
    });

    if (mode === "live") {
      const live = await runLiveGithubSync({ organization });
      const summary = summarizeLiveOutcome(live);

      await auditRecord({
        organizationId: ctx.organizationId,
        actorUserId: ctx.userId,
        action: live.source === "live" ? "scan.success" : "scan.success",
        outcome: live.source === "live" ? "success" : (live.repos.length === 0 ? "failure" : "success"),
        entityRef: `github:${organization}`,
        correlationId,
        detail: {
          mode,
          source: live.source,
          repoCount: summary.repoCount,
          workflowCount: summary.workflowCount,
          failingWorkflows: summary.failingWorkflows,
          limitations: live.limitations.length,
        },
        errorCode: live.repos.length === 0 ? "github.empty_inventory" : undefined,
      });

      return NextResponse.json(
        apiSuccess({
          mode,
          source: live.source,
          authenticatedLogin: live.authenticatedLogin,
          inventory: { repos: live.repos, workflows: live.workflows, protections: live.protections, durationMs: live.durationMs },
          summary,
          limitations: live.limitations,
          rateLimit: live.rateLimit,
        }),
        { status: 200 },
      );
    }

    // Preview path
    const preview = await runPreviewGithubSync({ organization });
    await auditRecord({
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      action: "scan.success",
      outcome: "success",
      entityRef: `github:${organization}`,
      correlationId,
      detail: { mode, source: "preview", repoCount: preview.repos.length },
    });

    return NextResponse.json(
      apiSuccess({
        mode,
        source: "preview" as const,
        inventory: preview,
        summary: {
          status: "preview" as const,
          repoCount: preview.repos.length,
          workflowCount: preview.workflows.length,
          failingWorkflows: preview.workflows.filter((w) => w.lastRunStatus === "failure").length,
        },
        limitations: [
          "GitHub live mode requires GITHUB_PAT (or GITHUB_APP_ID + GITHUB_PRIVATE_KEY) and GITHUB_SYNC_MODE=live.",
        ],
      }),
      { status: 200 },
    );
  } catch (err) {
    const axiomErr = toAxiomError(err);
    return NextResponse.json(apiFailure(axiomErr), { status: httpStatusFor(axiomErr.category) });
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> { return POST(request); }
