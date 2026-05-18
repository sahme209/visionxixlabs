/**
 * CI/CD Live Operations builder.
 *
 * Composes the canonical CicdOpsReport. Provider posture derives from
 * canonical state (GitHub live or preview; other providers preview
 * until SDK traversal lands). The Operation catalog is **static** —
 * it's the closed contract of "every CI/CD operation the platform
 * understands and how each one is gated".
 *
 * Adding a new operation requires:
 *   1. extending CicdOperationKind in the model (closed union)
 *   2. adding an entry here (TS exhaustiveness flags the gap)
 *   3. classifying it explicitly
 *
 * That's the entire mutation surface — every other piece of code
 * either reads from or refuses based on this table.
 */

import "server-only";

import { buildAxiomOSState } from "@/lib/axiomOS/axiomOSStateBuilder";
import { loadAppEnv } from "@/lib/config/env";
import { extractGithubActionsRuns } from "./githubActionsExtractor";
import { extractVercelDeployments } from "./vercelDeploymentsExtractor";
import type { OrganizationId, UserId } from "@/lib/domain/ids";
import type {
  CicdOperation,
  CicdOperationClassification,
  CicdOperationKind,
  CicdOpsReport,
  CicdProvider,
  CicdProviderPosture,
  CicdSourceMode,
  PipelineRun,
} from "./cicdOpsModel";

export interface BuildCicdOpsInput {
  tenantId: OrganizationId;
  actorUserId?: UserId;
}

export async function buildCicdOps(input: BuildCicdOpsInput): Promise<CicdOpsReport> {
  const env = loadAppEnv();
  const state = await buildAxiomOSState({ tenantId: input.tenantId, actorUserId: input.actorUserId });

  const githubMode = state.providers.find((p) => p.provider === "github")?.mode ?? "preview";

  // Try live GitHub Actions extraction.
  let ghActionsLive: Awaited<ReturnType<typeof extractGithubActionsRuns>> | null = null;
  if (githubMode === "live" && env.githubActionsExtractEnabled) {
    try {
      ghActionsLive = await extractGithubActionsRuns();
    } catch {
      ghActionsLive = null;
    }
  }

  // Try live Vercel deployments extraction.
  let vercelLive: Awaited<ReturnType<typeof extractVercelDeployments>> | null = null;
  if (env.vercelDeploymentsEnabled) {
    try {
      vercelLive = await extractVercelDeployments();
    } catch {
      vercelLive = null;
    }
  }

  const providers: CicdProviderPosture[] = [
    (() => {
      const base = providerPosture("github_actions", githubMode, {
        headline:
          githubMode === "live"
            ? "GitHub Actions live — workflow + branch protection inventory active."
            : "GitHub mode preview — connect GITHUB_TOKEN (or GitHub App) to unblock Actions surface.",
        missingRequirements: githubMode === "live" ? [] : ["GITHUB_TOKEN (or GitHub App installation token) with workflow:read"],
        sampleRunsWhenLive: 3,
      });
      if (ghActionsLive && ghActionsLive.mode === "live" && ghActionsLive.runs.length > 0) {
        return {
          ...base,
          mode: "live",
          configured: true,
          headline: `Live GitHub Actions — ${ghActionsLive.runs.length} recent run(s) ingested.`,
          recentRuns: ghActionsLive.runs,
        };
      }
      if (ghActionsLive && ghActionsLive.mode !== "live") {
        return {
          ...base,
          headline: `Actions extractor ${ghActionsLive.mode}: ${ghActionsLive.limitations[0] ?? "n/a"}`,
          missingRequirements: ghActionsLive.limitations,
        };
      }
      return base;
    })(),
    providerPosture("gitlab_ci", "preview", {
      headline: "GitLab CI preview — Connect via GITLAB_TOKEN to unblock live pipeline state.",
      missingRequirements: ["GITLAB_TOKEN with api scope", "GITLAB_BASE_URL (self-hosted only)"],
    }),
    (() => {
      // Re-use the aws_codepipeline posture slot to carry Vercel deployments
      // when the Vercel extractor is on. (Vercel is conceptually a pipeline
      // provider but we already have 7 in the closed union; keeping the model
      // stable matters more than adding a literal here.)
      const base = providerPosture("aws_codepipeline", "preview", {
        headline: vercelLive && vercelLive.mode === "live"
          ? "AWS CodePipeline preview · Vercel deployments piggyback in this slot"
          : "AWS CodePipeline preview — Once AWS mode is live, CodePipeline ListPipelines + GetPipelineExecution traversal wires here.",
        missingRequirements: ["AWS live mode (AWS_ROLE_ARN + AWS_EXTERNAL_ID)"],
      });
      if (vercelLive && vercelLive.mode === "live" && vercelLive.runs.length > 0) {
        return {
          ...base,
          mode: "partial_live" as const,
          configured: true,
          headline: `Live Vercel deployments — ${vercelLive.runs.length} recent (AWS CodePipeline still preview).`,
          recentRuns: vercelLive.runs,
        };
      }
      return base;
    })(),
    providerPosture("gcp_cloud_build", "preview", {
      headline: "GCP Cloud Build preview — projects.builds.list traversal wires once GCP mode is live.",
      missingRequirements: ["GCP live mode (GCP_PROJECT_ID + GCP_SERVICE_ACCOUNT_JSON)"],
    }),
    providerPosture("azure_devops", "preview", {
      headline: "Azure DevOps preview — Build runs + Release pipelines connect once Azure live mode is configured.",
      missingRequirements: ["AZURE_DEVOPS_PAT", "AZURE_DEVOPS_ORG"],
    }),
    providerPosture("circleci", "planned", {
      headline: "CircleCI on the roadmap — typed model lands here once we wire the API.",
      missingRequirements: ["CIRCLECI_TOKEN (planned)"],
    }),
    providerPosture("jenkins", "planned", {
      headline: "Jenkins on the roadmap — typed model lands here once we wire the API.",
      missingRequirements: ["JENKINS_URL + JENKINS_TOKEN (planned)"],
    }),
  ];

  // ---------------------------------------------------------------------------
  // Operation catalog — closed, exhaustive over CicdOperationKind
  // ---------------------------------------------------------------------------
  const operations: CicdOperation[] = [
    op("list_pipelines",           "readonly_allowed",      "List pipelines",            "Enumerate every pipeline the platform can see.",                            "Pure read.", "cicd:list_pipelines"),
    op("describe_run",             "readonly_allowed",      "Describe run",              "Fetch the canonical metadata for a single pipeline run.",                   "Pure read.", "cicd:describe_run"),
    op("fetch_logs",               "readonly_allowed",      "Fetch logs",                "Stream + redact pipeline logs through the canonical redactPayload.",        "Pure read with redaction at boundary.", "cicd:fetch_logs"),
    op("fetch_artifact_manifest",  "readonly_allowed",      "Fetch artifact manifest",   "Read SBOM + checksum + signing manifest for a build artifact.",            "Pure read.", "cicd:fetch_artifact_manifest"),
    op("trigger_workflow",         "policy_gated",          "Trigger workflow",          "Dispatch a workflow run.",                                                   "Gated by cicd.trigger_workflow policy.", "cicd:trigger_workflow", "cicd.trigger_workflow"),
    op("rerun_workflow",           "policy_gated",          "Re-run workflow",           "Re-run a failed or canceled workflow.",                                     "Gated by cicd.rerun_workflow policy.", "cicd:rerun_workflow", "cicd.rerun_workflow"),
    op("cancel_run",               "policy_gated",          "Cancel run",                "Cancel an in-flight pipeline run.",                                          "Gated by cicd.cancel_run policy.", "cicd:cancel_run", "cicd.cancel_run"),
    op("approve_environment",      "approval_required",     "Approve environment",       "Approve a workflow waiting on an environment gate.",                         "Requires explicit approval packet.", "cicd:approve_environment"),
    op("gate_deploy",              "approval_required",     "Gate deploy",               "Insert a manual gate into a deploy pipeline.",                               "Requires explicit approval packet.", "cicd:gate_deploy"),
    op("rollback_deploy",          "desktop_review_required","Rollback deploy",          "Trigger a documented rollback to the previous release tag.",                "Routes through desktop runtime for human verification.", "cicd:rollback_deploy"),
    op("promote_artifact",         "approval_required",     "Promote artifact",          "Promote a built artifact between channels (preview → beta → stable).",      "Requires explicit approval packet.", "cicd:promote_artifact"),
    op("force_merge",              "unsafe_never_automate", "Force merge",               "Force-merge a PR bypassing required reviews / status checks.",              "Hard-blocked at the type level — operator-only via provider console.", "cicd:force_merge"),
    op("delete_tag",               "unsafe_never_automate", "Delete tag",                "Delete a release tag from a remote.",                                        "Hard-blocked at the type level.", "cicd:delete_tag"),
    op("push_protected_ref",       "unsafe_never_automate", "Push protected ref",        "Push directly to a protected branch.",                                       "Hard-blocked at the type level.", "cicd:push_protected_ref"),
    op("rotate_signing_key",       "unsafe_never_automate", "Rotate signing key",        "Rotate the CI signing key.",                                                 "Hard-blocked at the type level — manual rotation through credential rotation gate (Phase 37).", "cicd:rotate_signing_key"),
    op("modify_workflow_yaml",     "unsafe_never_automate", "Modify workflow YAML",      "Edit a `.github/workflows/*.yml` file directly.",                            "Hard-blocked at the type level — operators submit via PR which goes through normal review.", "cicd:modify_workflow_yaml"),
  ];

  // Sanity: closed-union exhaustiveness check.
  assertExhaustiveOps(operations);

  // ---------------------------------------------------------------------------
  // Summary rollup
  // ---------------------------------------------------------------------------
  let runsTotal = 0, runsRunning = 0, runsFailed = 0, runsSuccess = 0;
  for (const p of providers) {
    runsTotal += p.recentRuns.length;
    for (const r of p.recentRuns) {
      if (r.status === "running") runsRunning++;
      else if (r.status === "failed" || r.status === "timed_out") runsFailed++;
      else if (r.status === "success") runsSuccess++;
    }
  }
  const liveProviderCount = providers.filter((p) => p.mode === "live").length;
  const opsReadonly = operations.filter((o) => o.classification === "readonly_allowed").length;
  const opsPolicyGated = operations.filter((o) => o.classification === "policy_gated").length;
  const opsApproval = operations.filter((o) => o.classification === "approval_required").length;
  const opsDesktop = operations.filter((o) => o.classification === "desktop_review_required").length;
  const opsUnsafe = operations.filter((o) => o.classification === "unsafe_never_automate").length;

  const overallSourceMode = liveProviderCount > 0 ? (liveProviderCount === providers.length ? "live" : "partial_live") : "preview";

  return {
    generatedAt: state.generatedAt,
    tenantId: String(input.tenantId),
    providers,
    operations,
    summary: {
      providerCount: providers.length,
      liveProviderCount,
      runsTotal, runsRunning, runsFailed, runsSuccess,
      operationsTotal: operations.length,
      operationsReadonly: opsReadonly,
      operationsPolicyGated: opsPolicyGated,
      operationsApprovalRequired: opsApproval,
      operationsDesktopReview: opsDesktop,
      operationsHardBlocked: opsUnsafe,
    },
    overallSourceMode,
    safetyContract: "cicd_ops_gated_no_unsafe_execution",
    limitations: [
      "Per-provider run inventory wires per SDK in follow-up phases. Until then, run counts may be zero — never fabricated.",
      "Mutation operations are typed + classified; actual execution always routes through the policy engine + autonomy loop + desktop runtime.",
    ],
    safeNextAction: { label: "Open Autonomy Cockpit", href: "/dashboard/autonomy" },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function providerPosture(
  provider: CicdProvider,
  rawMode: string,
  args: { headline: string; missingRequirements: string[]; sampleRunsWhenLive?: number },
): CicdProviderPosture {
  const mode = mapMode(rawMode);
  const recentRuns: PipelineRun[] = [];
  // We never invent runs — only declare provider posture honestly.
  return {
    provider,
    mode,
    configured: mode === "live" || mode === "partial_live",
    headline: args.headline,
    missingRequirements: args.missingRequirements,
    recentRuns,
    safeNextAction: provider === "github_actions"
      ? { label: "Open GitHub setup", href: "/dashboard/integrations/github" }
      : { label: "Open Sources", href: "/dashboard/sources" },
  };
}

function op(
  kind: CicdOperationKind,
  classification: CicdOperationClassification,
  label: string,
  description: string,
  rationale: string,
  auditEventKind: string,
  requiredPolicyId?: string,
): CicdOperation {
  return {
    kind, classification, label, description, rationale, auditEventKind, requiredPolicyId,
    evidenceRef: `cicd:${kind}`,
  };
}

function mapMode(m: string): CicdSourceMode {
  switch (m) {
    case "live":         return "live";
    case "partial_live": return "partial_live";
    case "preview":      return "preview";
    case "blocked":      return "blocked";
    case "disabled":     return "disabled";
    case "planned":      return "preview";
    default:             return "preview";
  }
}

function assertExhaustiveOps(ops: CicdOperation[]): void {
  const all: CicdOperationKind[] = [
    "list_pipelines", "describe_run", "fetch_logs", "fetch_artifact_manifest",
    "trigger_workflow", "rerun_workflow", "cancel_run", "approve_environment",
    "gate_deploy", "rollback_deploy", "promote_artifact",
    "force_merge", "delete_tag", "push_protected_ref", "rotate_signing_key",
    "modify_workflow_yaml",
  ];
  const present = new Set(ops.map((o) => o.kind));
  for (const k of all) {
    if (!present.has(k)) {
      throw new Error(`CicdOps catalog missing operation: ${k}`);
    }
  }
}
