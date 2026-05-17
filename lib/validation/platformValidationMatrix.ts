/**
 * Platform validation matrix.
 *
 * Single internal source of truth for "what works end-to-end right now".
 * Each row carries a stable id, a typed status, the source file/route
 * that backs it, and an honest next-fix line. The Trust Center + Command
 * Center + a future QA report all read from here.
 *
 * No row claims "passing" without an evidence ref.
 */

export type ValidationStatus = "passing" | "partial" | "failing" | "preview" | "blocked";

export interface ValidationRow {
  id: string;
  area: "aws" | "azure" | "gcp" | "github" | "security_scanner" | "desktop" | "command_center" | "compliance" | "release" | "operating_loop";
  capability: string;
  status: ValidationStatus;
  /** Where the proof lives — module path, route, env var. */
  evidence: string;
  /** Optional honest blocker / next fix. */
  nextFix?: string;
}

export const VALIDATION_MATRIX: ValidationRow[] = [
  // AWS
  { id: "aws.format",       area: "aws",    capability: "Role ARN + External ID + region format validation",      status: "passing", evidence: "lib/cloud/aws/awsValidator.ts" },
  { id: "aws.live_sts",     area: "aws",    capability: "Live STS AssumeRole + GetCallerIdentity validation",     status: "partial", evidence: "lib/cloud/aws/awsValidator.ts", nextFix: "Requires AWS_CONNECTOR_BROKER_ACCESS_KEY_ID + AWS_CONNECTOR_BROKER_SECRET_ACCESS_KEY on host." },
  { id: "aws.preview_scan", area: "aws",    capability: "Preview scan returns snapshot + findings + recommendations", status: "passing", evidence: "lib/cloud/aws/awsPreviewScanner.ts" },
  { id: "aws.live_inventory",    area: "aws",  capability: "Live EC2 / S3 / RDS / VPC / SG read-only inventory (single region)", status: "passing", evidence: "lib/cloud/aws/awsLiveInventory.ts" },
  { id: "aws.multi_region",      area: "aws",  capability: "Multi-region read-only inventory — DescribeRegions + parallel per-region scans + merged snapshot", status: "passing", evidence: "lib/cloud/aws/awsMultiRegionInventory.ts" },
  { id: "aws.config_helper",     area: "aws",  capability: "AwsRuntimeConfig helper + missing-config hint (parallel to Azure/GCP)", status: "passing", evidence: "lib/cloud/aws/awsConfig.ts" },
  { id: "aws.ambient_connection",area: "aws",  capability: "/api/aws/scan accepts ambient AWS_ROLE_ARN + AWS_EXTERNAL_ID + AWS_REGION", status: "passing", evidence: "app/api/aws/scan/route.ts" },
  { id: "aws.scan_pipeline", area: "aws",   capability: "End-to-end pipeline w/ trace + evidence",                status: "passing", evidence: "lib/pipeline/cloudScanPipeline.ts" },
  { id: "aws.iam_trust",    area: "aws",    capability: "IAM trust policy A-F grader",                            status: "passing", evidence: "lib/cloud/iamTrustEvaluator.ts" },

  // Azure
  { id: "azure.format",     area: "azure",  capability: "Tenant + subscription id format validation",             status: "passing", evidence: "lib/cloud/azure/azureValidator.ts" },
  { id: "azure.live_sp",    area: "azure",  capability: "Live service principal validation via @azure/identity getToken + ARM REST", status: "passing", evidence: "lib/cloud/azure/azureValidator.ts", nextFix: "Requires AZURE_TENANT_ID + AZURE_CLIENT_ID + AZURE_CLIENT_SECRET + AZURE_SUBSCRIPTION_ID on host." },
  { id: "azure.preview",    area: "azure",  capability: "Preview snapshot + findings + recommendations",          status: "passing", evidence: "lib/cloud/azure/azurePreviewScanner.ts" },
  { id: "azure.config",     area: "azure",  capability: "Azure runtime config helper (mode + presence booleans)", status: "passing", evidence: "lib/cloud/azure/azureConfig.ts" },
  { id: "azure.scan_route", area: "azure",  capability: "POST /api/azure/scan — audited, preview-honest",         status: "passing", evidence: "app/api/azure/scan/route.ts" },
  { id: "azure.live_inventory", area: "azure", capability: "Live ARM resource inventory (VMs / Storage / VNet / NSG / SQL)", status: "blocked", evidence: "TBD — requires arm-compute + arm-storage + arm-network read traversal", nextFix: "Wire arm-* SDKs read-only behind getAzureConfig().mode === \"live\"." },

  // GCP
  { id: "gcp.format",       area: "gcp",    capability: "Project id + service account JSON shape validation",     status: "passing", evidence: "lib/cloud/gcp/gcpValidator.ts" },
  { id: "gcp.live_sa",      area: "gcp",    capability: "Live service account validation via @google-cloud/resource-manager", status: "partial", evidence: "lib/cloud/gcp/gcpValidator.ts", nextFix: "Live path imports @google-cloud/resource-manager dynamically — honest fallback when import fails. Requires GCP_PROJECT_ID + (GCP_SERVICE_ACCOUNT_JSON or GCP_CLIENT_EMAIL+GCP_PRIVATE_KEY)." },
  { id: "gcp.preview",      area: "gcp",    capability: "Preview snapshot + findings + recommendations",          status: "passing", evidence: "lib/cloud/gcp/gcpPreviewScanner.ts" },
  { id: "gcp.config",       area: "gcp",    capability: "GCP runtime config helper (mode + credential-format flag)", status: "passing", evidence: "lib/cloud/gcp/gcpConfig.ts" },
  { id: "gcp.scan_route",   area: "gcp",    capability: "POST /api/gcp/scan — audited, preview-honest",           status: "passing", evidence: "app/api/gcp/scan/route.ts" },
  { id: "gcp.live_inventory", area: "gcp", capability: "Live Compute / Storage / Firewall inventory",            status: "blocked", evidence: "TBD — requires @google-cloud/compute + @google-cloud/storage read traversal", nextFix: "Wire compute + storage SDKs read-only behind getGcpConfig().mode === \"live\"." },

  // GitHub
  { id: "gh.format",        area: "github", capability: "Owner / repo name format validation",                    status: "passing", evidence: "lib/connectors/github/githubValidator.ts" },
  { id: "gh.live_token",    area: "github", capability: "Live token validation via /user endpoint",               status: "passing", evidence: "lib/connectors/github/githubValidator.ts" },
  { id: "gh.oauth",         area: "github", capability: "OAuth sign-in (GitHub + Google) on /auth/signin",        status: "passing", evidence: "lib/auth.ts + GITHUB_CLIENT_ID set on Vercel" },
  { id: "gh.preview_sync",  area: "github", capability: "Preview repo + workflow + branch protection inventory",  status: "passing", evidence: "lib/connectors/github/githubPreviewSync.ts" },
  { id: "gh.live_sync",     area: "github", capability: "Live GitHub repo + workflow + branch-protection discovery", status: "passing", evidence: "lib/connectors/github/githubLiveScanner.ts", nextFix: "GitHub App flow (JWT + installation token) — PAT path is shipping." },

  // Security scanner
  { id: "sec.engine",       area: "security_scanner", capability: "Scanner engine produces typed check results",  status: "passing", evidence: "lib/securityScanner/securityScanner.ts" },
  { id: "sec.cloud_checks", area: "security_scanner", capability: "Cloud misconfiguration checks (preview-derived)", status: "preview", evidence: "lib/securityScanner/securityScanner.ts" },
  { id: "sec.app_checks",   area: "security_scanner", capability: "App / platform boundary checks",               status: "passing", evidence: "lib/securityScanner/securityScanner.ts" },
  { id: "sec.supply_chain", area: "security_scanner", capability: "Supply-chain checks",                          status: "passing", evidence: "lib/securityScanner/securityScanner.ts" },
  { id: "sec.desktop",      area: "security_scanner", capability: "Desktop distribution + execution checks",      status: "passing", evidence: "lib/securityScanner/securityScanner.ts" },

  // Desktop
  { id: "desk.shell",       area: "desktop", capability: "Tauri shell + React frontend",                          status: "passing", evidence: "desktop/" },
  { id: "desk.handoff",     area: "desktop", capability: "Signed handoff contract + validator (HMAC + nonce + TTL)", status: "passing", evidence: "lib/desktop/handoffContract.ts + handoffSigner.ts + handoffValidator.ts" },
  { id: "desk.signing",     area: "desktop", capability: "Code signing + notarization for macOS / Windows / Linux", status: "blocked", evidence: "lib/release/versionModel.ts", nextFix: "Apple Developer ID + Windows EV cert + Linux GPG required." },
  { id: "desk.downloads",   area: "desktop", capability: "Public binary distribution",                            status: "blocked", evidence: "lib/desktop/desktopDistribution.ts", nextFix: "Blocked on signing." },

  // Command Center
  { id: "cc.state_adapter", area: "command_center", capability: "Canonical CommandCenterState adapter",           status: "passing", evidence: "lib/platform/getCommandCenterState.ts" },
  { id: "cc.api_route",     area: "command_center", capability: "GET /api/command-center",                        status: "passing", evidence: "app/api/command-center/route.ts" },
  { id: "cc.dashboard_wired", area: "command_center", capability: "Dashboard pulls mode flags from /api/command-center", status: "passing", evidence: "app/dashboard/page.tsx" },

  // Compliance
  { id: "comp.registry",    area: "compliance", capability: "19 typed compliance controls",                        status: "passing", evidence: "lib/compliance/controlRegistry.ts" },
  { id: "comp.bundle",      area: "compliance", capability: "Evidence bundle export (JSON / NDJSON)",              status: "passing", evidence: "lib/compliance/evidenceBundle.ts" },
  { id: "comp.trust_center", area: "compliance", capability: "/dashboard/trust premium UI",                        status: "passing", evidence: "app/dashboard/trust/page.tsx" },

  // Release
  { id: "rel.web",          area: "release", capability: "Web app released on https://visionxixlabs.com",          status: "passing", evidence: "lib/release/versionModel.ts" },
  { id: "rel.desktop_pkg",  area: "release", capability: "Signed desktop binaries published",                       status: "blocked", evidence: "lib/release/versionModel.ts", nextFix: "Blocked on signing certificates." },

  // Remediation (filed under security_scanner area since it consumes scanner output today)
  { id: "rem.model",                area: "security_scanner", capability: "Remediation candidate model + state machine",       status: "passing", evidence: "lib/remediation/remediationModel.ts" },
  { id: "rem.planner",              area: "security_scanner", capability: "Remediation planner (security + releases + gaps → candidate)", status: "passing", evidence: "lib/remediation/remediationPlanner.ts" },
  { id: "rem.terraform_preview",    area: "security_scanner", capability: "Terraform preview generator (typed, no execution)", status: "partial", evidence: "lib/execution/terraformPreviewGenerator.ts", nextFix: "Expand HCL templates beyond S3 / SG / encryption / backup / branch protection." },
  { id: "rem.cli_preview",          area: "security_scanner", capability: "CLI preview generator (typed, no execution)",        status: "partial", evidence: "lib/execution/cliPreviewGenerator.ts", nextFix: "Add Azure / GCP / Terraform-Cloud CLI templates." },
  { id: "rem.rollback",             area: "security_scanner", capability: "Rollback plan generator (honest availability)",       status: "passing", evidence: "lib/execution/rollbackPlanGenerator.ts" },
  { id: "rem.verification",         area: "security_scanner", capability: "Verification checklist generator (typed)",            status: "passing", evidence: "lib/execution/verificationChecklist.ts" },
  { id: "rem.pipeline",             area: "security_scanner", capability: "Closed-loop remediation pipeline (no apply)",         status: "passing", evidence: "lib/remediation/remediationPipeline.ts" },
  { id: "rem.api_candidates",       area: "security_scanner", capability: "POST /api/remediation/candidates",                    status: "passing", evidence: "app/api/remediation/candidates/route.ts" },
  { id: "rem.api_plan",             area: "security_scanner", capability: "POST /api/remediation/plan",                          status: "passing", evidence: "app/api/remediation/plan/route.ts" },
  { id: "rem.api_readiness",        area: "security_scanner", capability: "POST /api/remediation/readiness",                     status: "passing", evidence: "app/api/remediation/readiness/route.ts" },
  { id: "rem.api_desktop_handoff",  area: "security_scanner", capability: "POST /api/remediation/desktop-handoff (preview only)", status: "preview", evidence: "app/api/remediation/desktop-handoff/route.ts" },
  { id: "rem.api_terraform",        area: "security_scanner", capability: "POST /api/execution/terraform-preview",               status: "passing", evidence: "app/api/execution/terraform-preview/route.ts" },
  { id: "rem.api_cli",              area: "security_scanner", capability: "POST /api/execution/cli-preview",                      status: "passing", evidence: "app/api/execution/cli-preview/route.ts" },
  { id: "rem.api_rollback",         area: "security_scanner", capability: "POST /api/execution/rollback-preview",                 status: "passing", evidence: "app/api/execution/rollback-preview/route.ts" },
  { id: "rem.api_verification",     area: "security_scanner", capability: "POST /api/execution/verification-checklist",          status: "passing", evidence: "app/api/execution/verification-checklist/route.ts" },
  { id: "rem.center_ui",            area: "command_center",   capability: "/dashboard/remediation Center UI",                    status: "passing", evidence: "app/dashboard/remediation/page.tsx" },

  // Digital Twin + Simulation
  { id: "sim.twin_model",           area: "command_center",   capability: "Digital twin model + types",                          status: "passing", evidence: "lib/digitalTwin/digitalTwinModel.ts" },
  { id: "sim.twin_builder",         area: "command_center",   capability: "Digital twin builder (overview + scan + readiness)",  status: "preview", evidence: "lib/digitalTwin/digitalTwinBuilder.ts", nextFix: "Wire live snapshot ingestion once provider live-scan is on." },
  { id: "sim.changeset",            area: "security_scanner", capability: "ChangeSet model + destructive-action guards",         status: "passing", evidence: "lib/simulation/changeSetModel.ts" },
  { id: "sim.diff_engine",          area: "security_scanner", capability: "Field diff with redaction (no secrets ever shown)",   status: "passing", evidence: "lib/simulation/diffEngine.ts" },
  { id: "sim.impact_analyzer",      area: "security_scanner", capability: "Blast-radius + dependency-impact analyzer (3-hop BFS)", status: "passing", evidence: "lib/simulation/impactAnalyzer.ts" },
  { id: "sim.execution_simulator",  area: "security_scanner", capability: "Execution simulator (in-memory twin mutation, no apply)", status: "passing", evidence: "lib/simulation/executionSimulator.ts" },
  { id: "sim.releaseops",           area: "release",          capability: "Release readiness simulator (typed score deltas)",     status: "passing", evidence: "lib/releaseops/releaseSimulation.ts" },
  { id: "sim.security",             area: "security_scanner", capability: "Security remediation simulator (per-finding delta)",   status: "passing", evidence: "lib/securityScanner/securitySimulation.ts" },
  { id: "sim.api_create",           area: "security_scanner", capability: "POST /api/simulations/create",                         status: "passing", evidence: "app/api/simulations/create/route.ts" },
  { id: "sim.api_by_id",            area: "security_scanner", capability: "GET /api/simulations/[id]",                            status: "passing", evidence: "app/api/simulations/[id]/route.ts" },
  { id: "sim.api_from_rem",         area: "security_scanner", capability: "POST /api/simulations/from-remediation",               status: "passing", evidence: "app/api/simulations/from-remediation/route.ts" },
  { id: "sim.api_twin_build",       area: "command_center",   capability: "POST /api/digital-twin/build",                         status: "passing", evidence: "app/api/digital-twin/build/route.ts" },
  { id: "sim.api_twin_current",     area: "command_center",   capability: "GET  /api/digital-twin/current (not persisted yet)",   status: "partial", evidence: "app/api/digital-twin/current/route.ts", nextFix: "Persist twins in Prisma so /current can return the latest stored one." },
  { id: "sim.center_ui",            area: "command_center",   capability: "/dashboard/simulations Center UI",                     status: "passing", evidence: "app/dashboard/simulations/page.tsx" },

  // Governed execution orchestration + approval operating system
  { id: "orc.model",                area: "command_center",   capability: "ExecutionOrchestration model + status / stage taxonomy", status: "passing", evidence: "lib/execution/orchestrationModel.ts" },
  { id: "orc.state_machine",        area: "command_center",   capability: "Orchestration state machine w/ refs + flag gates",       status: "passing", evidence: "lib/execution/executionStateMachine.ts" },
  { id: "orc.approval_model",       area: "command_center",   capability: "Typed ApprovalRequest model + TTL by risk",              status: "passing", evidence: "lib/approvals/approvalModel.ts" },
  { id: "orc.approval_policy",      area: "command_center",   capability: "Approval policy (10 strict rules) → role + quorum",      status: "passing", evidence: "lib/approvals/approvalPolicy.ts" },
  { id: "orc.approval_engine",      area: "command_center",   capability: "Approval engine (in-memory; Prisma swap-in ready)",      status: "preview", evidence: "lib/approvals/approvalEngine.ts", nextFix: "Persist approvals in Prisma (alongside lib/axiom/approvalCenter.ts plan-item store)." },
  { id: "orc.preflight",            area: "command_center",   capability: "Preflight engine (15 typed checks)",                     status: "passing", evidence: "lib/execution/preflightEngine.ts" },
  { id: "orc.locks",                area: "command_center",   capability: "Execution locks (in-memory; conflict-aware)",            status: "preview", evidence: "lib/execution/executionLocks.ts", nextFix: "Swap lock store to Prisma with row-level lock semantics." },
  { id: "orc.idempotency",          area: "command_center",   capability: "Idempotency store (in-memory; replay-aware)",            status: "preview", evidence: "lib/execution/executionIdempotency.ts", nextFix: "Swap idempotency store to Prisma." },
  { id: "orc.adapter_interface",    area: "command_center",   capability: "ExecutionAdapter interface + precheck",                  status: "passing", evidence: "lib/execution/executionAdapter.ts" },
  { id: "orc.preview_adapter",      area: "command_center",   capability: "PreviewExecutionAdapter (no-op)",                        status: "passing", evidence: "lib/execution/executionAdapter.ts" },
  { id: "orc.aws_adapter",          area: "aws",              capability: "AWS execution adapter skeleton (no execute)",            status: "preview", evidence: "lib/execution/executionAdapter.ts", nextFix: "Wire @aws-sdk for restrict / encrypt / tag operations behind feature flag." },
  { id: "orc.azure_adapter",        area: "azure",            capability: "Azure execution adapter skeleton",                       status: "preview", evidence: "lib/execution/executionAdapter.ts" },
  { id: "orc.gcp_adapter",          area: "gcp",              capability: "GCP execution adapter skeleton",                         status: "preview", evidence: "lib/execution/executionAdapter.ts" },
  { id: "orc.github_adapter",       area: "github",           capability: "GitHub ReleaseOps execution adapter skeleton",           status: "preview", evidence: "lib/execution/executionAdapter.ts" },
  { id: "orc.desktop_adapter",      area: "desktop",          capability: "Desktop review adapter (execute intentionally blocked)", status: "passing", evidence: "lib/execution/executionAdapter.ts" },
  { id: "orc.terraform_boundary",   area: "command_center",   capability: "Terraform plan / apply boundary (apply disabled)",      status: "passing", evidence: "lib/execution/terraformBoundary.ts" },
  { id: "orc.release_orchestrator", area: "release",          capability: "Release approval orchestrator (blocker → approval)",     status: "passing", evidence: "lib/releaseops/releaseApprovalOrchestrator.ts" },
  { id: "orc.security_orchestrator",area: "security_scanner", capability: "Security approval orchestrator (finding → approval)",    status: "passing", evidence: "lib/securityScanner/securityApprovalOrchestrator.ts" },
  { id: "orc.api_orchestration",    area: "command_center",   capability: "GET /api/orchestration",                                  status: "passing", evidence: "app/api/orchestration/route.ts" },
  { id: "orc.api_preflight",        area: "command_center",   capability: "POST /api/orchestration/preflight",                       status: "passing", evidence: "app/api/orchestration/preflight/route.ts" },
  { id: "orc.api_approvals",        area: "command_center",   capability: "GET / POST /api/orchestration/approvals",                 status: "passing", evidence: "app/api/orchestration/approvals/route.ts" },
  { id: "orc.api_decide",           area: "command_center",   capability: "POST /api/orchestration/approvals/[id]/decide",          status: "passing", evidence: "app/api/orchestration/approvals/[id]/decide/route.ts" },
  { id: "orc.api_locks",            area: "command_center",   capability: "GET /api/orchestration/locks",                            status: "passing", evidence: "app/api/orchestration/locks/route.ts" },
  { id: "orc.api_tf_boundary",      area: "command_center",   capability: "GET /api/orchestration/terraform-boundary",               status: "passing", evidence: "app/api/orchestration/terraform-boundary/route.ts" },
  { id: "orc.center_ui",            area: "command_center",   capability: "/dashboard/orchestration Center UI",                     status: "passing", evidence: "app/dashboard/orchestration/page.tsx" },

  // Control plane
  { id: "cp.model",                 area: "command_center",   capability: "ControlPlaneState model — providers/connectors/posture/inventory/actions", status: "passing", evidence: "lib/controlPlane/controlPlaneModel.ts" },
  { id: "cp.builder",               area: "command_center",   capability: "Control plane builder composes from canonical adapters",   status: "passing", evidence: "lib/controlPlane/controlPlaneBuilder.ts" },
  { id: "cp.next_action_engine",    area: "command_center",   capability: "Next-best-action engine (12 typed action templates)",     status: "passing", evidence: "lib/controlPlane/nextBestActionEngine.ts" },
  { id: "cp.safe_task_runner",      area: "command_center",   capability: "Safe task runner — strict allow-list, blocks destructive", status: "passing", evidence: "lib/controlPlane/safeTaskRunner.ts" },
  { id: "cp.autonomous_loop_v2",    area: "command_center",   capability: "Autonomous ops loop v2 — runs safe tasks, stops on approval", status: "passing", evidence: "lib/controlPlane/autonomousOpsLoop.ts" },
  { id: "cp.api_state",             area: "command_center",   capability: "GET /api/control-plane/state",                              status: "passing", evidence: "app/api/control-plane/state/route.ts" },
  { id: "cp.api_next_actions",      area: "command_center",   capability: "GET /api/control-plane/next-actions",                       status: "passing", evidence: "app/api/control-plane/next-actions/route.ts" },
  { id: "cp.api_refresh",           area: "command_center",   capability: "POST /api/control-plane/refresh",                           status: "passing", evidence: "app/api/control-plane/refresh/route.ts" },
  { id: "cp.api_validate",          area: "command_center",   capability: "POST /api/control-plane/validate (autonomous + deep)",     status: "passing", evidence: "app/api/control-plane/validate/route.ts" },
  { id: "cp.api_run_safe_task",     area: "command_center",   capability: "POST /api/control-plane/run-safe-task (allow-list)",       status: "passing", evidence: "app/api/control-plane/run-safe-task/route.ts" },
  { id: "cp.multi_cloud_ui",        area: "command_center",   capability: "/dashboard/multi-cloud operating view",                    status: "passing", evidence: "app/dashboard/multi-cloud/page.tsx" },

  // GitHub / ReleaseOps live wiring (Live GitHub ReleaseOps + AWS Inventory Phase)
  { id: "gh.live_client",           area: "github",       capability: "GitHub live REST client (native fetch, no octokit dep)",  status: "passing", evidence: "lib/connectors/github/githubLiveClient.ts" },
  { id: "gh.live_scanner",          area: "github",       capability: "GitHub read-only live scanner (repos / workflows / runs / branch protection)", status: "passing", evidence: "lib/connectors/github/githubLiveScanner.ts" },
  { id: "gh.preview_fallback",      area: "github",       capability: "Honest preview fallback when live unavailable",            status: "passing", evidence: "lib/releaseops/getReleaseOpsState.ts" },
  { id: "gh.api_sync",              area: "github",       capability: "POST /api/github/sync (live or preview)",                  status: "passing", evidence: "app/api/github/sync/route.ts" },
  { id: "relops.hybrid_state",      area: "command_center",   capability: "ReleaseOps live/preview hybrid state aggregator",          status: "passing", evidence: "lib/releaseops/getReleaseOpsState.ts" },
  { id: "relops.api_state",         area: "command_center",   capability: "GET /api/releaseops/state",                                 status: "passing", evidence: "app/api/releaseops/state/route.ts" },
  { id: "relops.api_scan",          area: "command_center",   capability: "POST /api/releaseops/scan (audited)",                       status: "passing", evidence: "app/api/releaseops/scan/route.ts" },
  { id: "gh.security_checks",       area: "security_scanner", capability: "GitHub / ReleaseOps security checks (branch protection, required checks, failing workflows)", status: "passing", evidence: "lib/securityScanner/securityScanner.ts:githubChecksFromState" },
  { id: "gh.audit_trace",           area: "security_scanner", capability: "Audit + trace wired on GitHub sync + ReleaseOps scan",     status: "passing", evidence: "app/api/github/sync/route.ts,app/api/releaseops/scan/route.ts" },
  { id: "gh.live_requires_pat",     area: "github",       capability: "GitHub live requires GITHUB_PAT (or App) + SYNC_MODE=live", status: "preview", evidence: "lib/config/providerModes.ts:getConnectorMode" },

  // AWS live inventory wiring (Live AWS Inventory Phase)
  { id: "aws.live_inv_module",      area: "aws",          capability: "AWS read-only live inventory module (STS + EC2 + S3 + RDS)", status: "passing", evidence: "lib/cloud/aws/awsLiveInventory.ts" },
  { id: "aws.hybrid_pipeline",      area: "aws",          capability: "Cloud scan pipeline calls live inventory when STS validates", status: "passing", evidence: "lib/pipeline/cloudScanPipeline.ts" },
  { id: "aws.live_findings",        area: "security_scanner", capability: "AWS findings emitted from live data (public SG, S3 PAB gap, RDS public)", status: "passing", evidence: "lib/cloud/aws/awsLiveInventory.ts" },
  { id: "aws.api_scan_live",        area: "aws",          capability: "POST /api/aws/scan returns honest live/preview source",   status: "passing", evidence: "app/api/aws/scan/route.ts" },
  { id: "aws.live_requires_broker", area: "aws",          capability: "AWS live requires broker creds + AWS_SCAN_MODE=live",     status: "preview", evidence: "lib/config/env.ts" },

  // Persistence promotions (Stabilization Phase)
  { id: "prisma.audit_record",      area: "command_center",   capability: "Prisma SecureAuditRecord model + adapter behind store factory", status: "passing", evidence: "lib/audit/auditStore.prisma.ts,prisma/schema.prisma" },
  { id: "prisma.memory_record",     area: "command_center",   capability: "Prisma OperationalMemoryRecord model + adapter behind getMemoryStore()", status: "passing", evidence: "lib/memory/memoryStore.prisma.ts" },
  { id: "prisma.desktop_session",   area: "command_center",   capability: "Prisma DesktopSessionRecord model + adapter (paste-flow pairing)", status: "passing", evidence: "lib/desktop/desktopSessionStore.prisma.ts" },
  { id: "prisma.handoff_record",    area: "command_center",   capability: "Prisma DesktopHandoffRecord model (storage TBD)",          status: "preview", evidence: "prisma/schema.prisma" },
  { id: "prisma.trace_span",        area: "command_center",   capability: "Prisma OperationTraceSpan model (storage TBD)",            status: "preview", evidence: "prisma/schema.prisma" },
  { id: "platform.store_factory",   area: "command_center",   capability: "Store factory selects Prisma vs in-memory by DATABASE_URL", status: "passing", evidence: "lib/platform/storeFactory.ts,instrumentation.ts" },

  // Desktop auth session model
  { id: "desk.session_token",       area: "command_center",   capability: "Desktop session HMAC token mint + verify",                  status: "passing", evidence: "lib/desktop/desktopToken.ts" },
  { id: "desk.session_store",       area: "command_center",   capability: "DesktopSessionStore interface + in-memory + Prisma adapter", status: "passing", evidence: "lib/desktop/desktopSession.ts" },
  { id: "desk.auth_policy",         area: "command_center",   capability: "Pairing policy (5-session cap, fingerprint validation)",   status: "passing", evidence: "lib/desktop/desktopAuthPolicy.ts" },
  { id: "desk.api_session",         area: "command_center",   capability: "POST/GET/DELETE /api/desktop/session",                      status: "passing", evidence: "app/api/desktop/session/route.ts" },
  { id: "desk.api_state",           area: "command_center",   capability: "GET /api/desktop/state (Bearer-authenticated)",             status: "passing", evidence: "app/api/desktop/state/route.ts" },
  { id: "desk.paste_flow_ui",       area: "command_center",   capability: "Desktop Settings pairing UI (paste token + connect)",       status: "passing", evidence: "desktop/src/views/SettingsView.tsx" },

  // ---------------------------------------------------------------------------
  // End-to-end operating loop wiring (Operating Loop Phase)
  // ---------------------------------------------------------------------------
  { id: "loop.model",            area: "operating_loop", capability: "OperatingLoopRun model — 16 canonical stages + status taxonomy", status: "passing", evidence: "lib/operatingLoop/operatingLoopModel.ts" },
  { id: "loop.builder",          area: "operating_loop", capability: "Operating loop builder queries existing subsystems (read-only)", status: "passing", evidence: "lib/operatingLoop/operatingLoopBuilder.ts" },
  { id: "loop.runner",           area: "operating_loop", capability: "Operating loop runner — safe-stage execution only, halts at approval / preflight / verification", status: "passing", evidence: "lib/operatingLoop/operatingLoopRunner.ts" },
  { id: "loop.api_state",        area: "operating_loop", capability: "GET /api/operating-loop/state (inspect-only)",                status: "passing", evidence: "app/api/operating-loop/state/route.ts" },
  { id: "loop.api_run",          area: "operating_loop", capability: "POST /api/operating-loop/run (all providers, audited)",       status: "passing", evidence: "app/api/operating-loop/run/route.ts" },
  { id: "loop.api_run_provider", area: "operating_loop", capability: "POST /api/operating-loop/run-provider (single provider, audited)", status: "passing", evidence: "app/api/operating-loop/run-provider/route.ts" },
  { id: "loop.aws",              area: "operating_loop", capability: "AWS loop: setup → validation → scan → snapshot → findings → ... → next_action", status: "passing", evidence: "lib/operatingLoop/operatingLoopBuilder.ts:buildStagesFor" },
  { id: "loop.azure",            area: "operating_loop", capability: "Azure loop: live validation, preview scan + findings, preview remediation", status: "partial",   evidence: "lib/operatingLoop/operatingLoopBuilder.ts", nextFix: "Live Azure ARM inventory ships next." },
  { id: "loop.gcp",              area: "operating_loop", capability: "GCP loop: live validation, preview scan + findings, preview remediation",   status: "partial",   evidence: "lib/operatingLoop/operatingLoopBuilder.ts", nextFix: "Live GCP Compute/Storage inventory ships next." },
  { id: "loop.github",           area: "operating_loop", capability: "GitHub/ReleaseOps loop: live scan + branch protection + workflow checks", status: "passing", evidence: "lib/operatingLoop/operatingLoopBuilder.ts" },
  { id: "loop.security",         area: "operating_loop", capability: "Security scanner loop: always-available cross-cutting scanner",          status: "passing", evidence: "lib/operatingLoop/operatingLoopBuilder.ts" },
  { id: "loop.desktop",          area: "operating_loop", capability: "Desktop loop: setup → token validation → review → no local apply",       status: "passing", evidence: "lib/operatingLoop/operatingLoopBuilder.ts" },
  { id: "loop.safety_contract",  area: "operating_loop", capability: "Runner refuses approval / preflight / verification stages — operator-only", status: "passing", evidence: "lib/operatingLoop/operatingLoopRunner.ts:haltConditions" },
  { id: "loop.audit_emission",   area: "operating_loop", capability: "Every runner pass writes a SecureAuditRecord with correlation id",        status: "passing", evidence: "lib/operatingLoop/operatingLoopRunner.ts" },

  // ---------------------------------------------------------------------------
  // Production readiness gauntlet (Readiness Phase)
  // ---------------------------------------------------------------------------
  { id: "readiness.model",           area: "operating_loop", capability: "ProductionReadinessReport model + scoring helpers",                    status: "passing", evidence: "lib/readiness/productionReadinessModel.ts" },
  { id: "readiness.runner",          area: "operating_loop", capability: "Production readiness runner aggregates matrix + loops + honesty + exhaustiveness", status: "passing", evidence: "lib/readiness/productionReadinessRunner.ts" },
  { id: "readiness.exhaustive",      area: "operating_loop", capability: "Exhaustiveness audit catches enum-cascade bugs at runtime + via vitest", status: "passing", evidence: "lib/readiness/exhaustivenessChecks.ts" },
  { id: "readiness.honesty",         area: "operating_loop", capability: "Product honesty scanner — flags 'Azure live'/'GCP live'/'book a call'/'fix applied' phrases", status: "passing", evidence: "lib/readiness/productHonestyChecks.ts" },
  { id: "readiness.api",             area: "operating_loop", capability: "GET /api/readiness returns ProductionReadinessReport",                  status: "passing", evidence: "app/api/readiness/route.ts" },
  { id: "readiness.test_exhaustive", area: "operating_loop", capability: "vitest: catches missing labels for new SecurityCheckCategory / Scope keys", status: "passing", evidence: "lib/readiness/__tests__/exhaustivenessChecks.test.ts" },
  { id: "readiness.test_honesty",    area: "operating_loop", capability: "vitest: product honesty scanner unit tests",                            status: "passing", evidence: "lib/readiness/__tests__/productHonestyChecks.test.ts" },
  { id: "readiness.test_model",      area: "operating_loop", capability: "vitest: scoring + category summary helpers",                            status: "passing", evidence: "lib/readiness/__tests__/productionReadinessModel.test.ts" },
  { id: "readiness.test_op_loop",    area: "operating_loop", capability: "vitest: operating loop model + rollupSourceMode invariants",            status: "passing", evidence: "lib/operatingLoop/__tests__/operatingLoopModel.test.ts" },

  // ---------------------------------------------------------------------------
  // Gap closure + production hardening
  // ---------------------------------------------------------------------------
  { id: "prisma.migration_stabilization", area: "command_center", capability: "Prisma migration creates 5 stabilization-phase tables (audit / memory / desktop session / handoff / trace span)", status: "passing", evidence: "prisma/migrations/20260516120000_add_observability_and_desktop_models/migration.sql" },
  { id: "cc.readiness_strip",             area: "command_center", capability: "Command Center renders ReadinessStrip from /api/readiness — overall score, totals, critical failures, top-3 fixes", status: "passing", evidence: "app/dashboard/command-center/page.tsx:ReadinessStrip" },
  { id: "honesty.product_copy_clean",     area: "operating_loop", capability: "Product copy audit clean — zero 'Azure live' / 'GCP live' / 'book a call' / 'fix applied' / 'autonomous execution' false claims across 8 product surfaces", status: "passing", evidence: "audit by lib/readiness/productHonestyChecks.ts run against app/page.tsx, dashboard pages, docs" },

  // ---------------------------------------------------------------------------
  // GitHub / ReleaseOps productionization
  // ---------------------------------------------------------------------------
  { id: "gh.config_helper",          area: "github", capability: "GithubRuntimeConfig helper — mode, authPreference, appId, installationId, missing-config hint", status: "passing", evidence: "lib/connectors/github/githubConfig.ts" },
  { id: "gh.app_auth",               area: "github", capability: "GitHub App auth path — JWT (RS256) + installation token mint + in-memory cache (5-min refresh)", status: "passing", evidence: "lib/connectors/github/githubAppAuth.ts" },
  { id: "gh.client_dual_auth",       area: "github", capability: "Live client transparently prefers App auth when configured, falls back to PAT",                  status: "passing", evidence: "lib/connectors/github/githubLiveClient.ts" },
  { id: "gh.deployment_env_discovery", area: "github", capability: "Deployment environment discovery — required reviewers, wait timer, branch policy",            status: "passing", evidence: "lib/connectors/github/githubLiveScanner.ts" },
  { id: "gh.app_enterprise_path",    area: "github", capability: "GitHub App is the preferred enterprise auth path (vs PAT for dev/preview)",                     status: "preview", evidence: "lib/connectors/github/githubConfig.ts:authPreference", nextFix: "Requires GITHUB_APP_ID + GITHUB_PRIVATE_KEY + GITHUB_INSTALLATION_ID on host." },

  // ---------------------------------------------------------------------------
  // Security scanner + vulnerability intelligence productionization
  // ---------------------------------------------------------------------------
  { id: "sec.vuln_model",          area: "security_scanner", capability: "Canonical SecurityFinding model + converter from SecurityCheckResult (additive — existing scanner untouched)", status: "passing", evidence: "lib/securityScanner/vulnerabilityModel.ts" },
  { id: "sec.compounded_reasoner", area: "security_scanner", capability: "Compounded-risk reasoner — exposed_compute_no_governance, public_db_audit_gap, broken_pipeline_no_approval", status: "passing", evidence: "lib/securityScanner/compoundedRiskReasoner.ts" },
  { id: "sec.test_vuln_model",     area: "security_scanner", capability: "vitest: SecurityFinding converter — category remap (incl. release_governance/pipeline_health), confidence, action flags", status: "passing", evidence: "lib/securityScanner/__tests__/vulnerabilityModel.test.ts" },
  { id: "sec.test_compounded",     area: "security_scanner", capability: "vitest: 3 compound patterns + negative cases + sourceMode rollup",                                                  status: "passing", evidence: "lib/securityScanner/__tests__/compoundedRiskReasoner.test.ts" },
  { id: "sec.evidence_required",   area: "security_scanner", capability: "Every SecurityFinding carries evidence array or a limitation explaining why none was collected",                    status: "passing", evidence: "lib/securityScanner/vulnerabilityModel.ts:toSecurityFinding" },
  { id: "sec.compounded_no_apply", area: "security_scanner", capability: "Compounded findings explicitly remediationEligible:false — point at constituents, never claim a fix",                status: "passing", evidence: "lib/securityScanner/compoundedRiskReasoner.ts" },

  // ---------------------------------------------------------------------------
  // Enterprise Trust Center + audit-evidence productionization
  // ---------------------------------------------------------------------------
  { id: "trust.api_summary",   area: "compliance", capability: "GET /api/trust/summary — composite controls + evidence + sourceMode rollup", status: "passing", evidence: "app/api/trust/summary/route.ts" },
  { id: "trust.api_controls",  area: "compliance", capability: "GET /api/trust/controls — control registry with status + evidence sources",  status: "passing", evidence: "app/api/trust/controls/route.ts" },
  { id: "trust.api_evidence",  area: "compliance", capability: "GET /api/trust/evidence — tenant-scoped evidence list w/ control + kind filters", status: "passing", evidence: "app/api/trust/evidence/route.ts" },
  { id: "trust.api_export",    area: "compliance", capability: "POST /api/trust/export — compliance bundle (9 kinds × JSON or NDJSON)",      status: "passing", evidence: "app/api/trust/export/route.ts" },
  { id: "trust.honest_labels", area: "compliance", capability: "No SOC 2 / ISO / 'fully compliant' claims — labels are 'audit-ready evidence' / 'control evidence'", status: "passing", evidence: "lib/compliance/controlRegistry.ts" },

  // ---------------------------------------------------------------------------
  // Axiom OS unification — one canonical state for the entire product
  // ---------------------------------------------------------------------------
  { id: "axiomos.model",          area: "operating_loop", capability: "AxiomOSState — typed unified shape over providers, postures, loops, evidence, next-actions", status: "passing", evidence: "lib/axiomOS/axiomOSModel.ts" },
  { id: "axiomos.builder",        area: "operating_loop", capability: "AxiomOS state builder — pure read-only composition over existing canonical builders, per-section error isolation", status: "passing", evidence: "lib/axiomOS/axiomOSStateBuilder.ts" },
  { id: "axiomos.api_state",      area: "operating_loop", capability: "GET /api/axiom-os/state — full AxiomOSState",                                                                  status: "passing", evidence: "app/api/axiom-os/state/route.ts" },
  { id: "axiomos.api_refresh",    area: "operating_loop", capability: "POST /api/axiom-os/refresh — audited rebuild",                                                                 status: "passing", evidence: "app/api/axiom-os/refresh/route.ts" },
  { id: "axiomos.api_actions",    area: "operating_loop", capability: "GET /api/axiom-os/next-actions — operator action surfaces only",                                              status: "passing", evidence: "app/api/axiom-os/next-actions/route.ts" },
  { id: "axiomos.api_safe_loop",  area: "operating_loop", capability: "POST /api/axiom-os/run-safe-loop — delegates to operating-loop runner, refuses approval / preflight / verify", status: "passing", evidence: "app/api/axiom-os/run-safe-loop/route.ts" },
  { id: "axiomos.safety_contract", area: "operating_loop", capability: "AxiomOS state always reports safetyStatus = approval_gated_no_destructive_execution",                          status: "passing", evidence: "lib/axiomOS/axiomOSModel.ts" },
  { id: "axiomos.ui_strip",        area: "operating_loop", capability: "Command Center AxiomOSStrip — overall status + readiness + trust + provider chips + critical blockers + top-4 next actions",  status: "passing", evidence: "app/dashboard/command-center/page.tsx:AxiomOSStrip" },
];

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

export interface ValidationSummary {
  total: number;
  passing: number;
  partial: number;
  failing: number;
  preview: number;
  blocked: number;
  /** 0..1 — passing = 1, partial = 0.6, preview = 0.4, blocked = 0.2, failing = 0. */
  score: number;
}

export function summarizeValidation(rows: ValidationRow[] = VALIDATION_MATRIX): ValidationSummary {
  let passing = 0, partial = 0, failing = 0, preview = 0, blocked = 0;
  for (const r of rows) {
    if (r.status === "passing") passing++;
    else if (r.status === "partial") partial++;
    else if (r.status === "failing") failing++;
    else if (r.status === "preview") preview++;
    else blocked++;
  }
  const denom = rows.length || 1;
  const score = (passing + partial * 0.6 + preview * 0.4 + blocked * 0.2) / denom;
  return { total: rows.length, passing, partial, failing, preview, blocked, score };
}

export function rowsByArea(area: ValidationRow["area"]): ValidationRow[] {
  return VALIDATION_MATRIX.filter((r) => r.area === area);
}

export const STATUS_LABEL: Record<ValidationStatus, string> = {
  passing: "Passing",
  partial: "Partial",
  failing: "Failing",
  preview: "Preview",
  blocked: "Blocked",
};
