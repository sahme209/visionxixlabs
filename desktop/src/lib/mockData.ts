/**
 * Realistic mock data for offline / preview mode.
 *
 * When the desktop can't reach the live workspace (cross-origin cookie
 * issues, no auth yet), we render the UI with mock data so first-time
 * users see what the product actually does — clearly labelled as
 * preview, never claimed as live.
 */

import type {
  ControlPlaneStateLite,
  RemediationPipelineLite,
  SimulationsBatchLite,
  OrchestrationListLite,
  SecurityScanLite,
} from "./desktopClient";

// ---------------------------------------------------------------------------
// Control plane
// ---------------------------------------------------------------------------

export const MOCK_CONTROL_PLANE: ControlPlaneStateLite = {
  tenantId: "demo-tenant",
  generatedAt: new Date().toISOString(),
  sourceMode: "preview",
  providers: [
    {
      provider: "aws",
      mode: "preview",
      connectionStatus: "preview",
      validationStatus: "preview",
      scanStatus: "preview",
      resourceCounts: { ec2: 24, s3: 12, rds: 4, iamRoles: 38, vpcs: 3 },
      topFindings: [{ ruleCode: "S3_PUBLIC_ACCESS", risk: "high", resourceRef: "s3.bucket.assets-prod" }],
      missingCapabilities: [],
      sourceMode: "preview",
      confidence: 0.6,
      nextAction: { label: "Connect AWS live", href: "/operator/onboarding" },
    },
    {
      provider: "azure",
      mode: "preview",
      connectionStatus: "preview",
      validationStatus: "preview",
      scanStatus: "preview",
      resourceCounts: { vms: 8, storage: 6, sql: 2, identity: 14 },
      topFindings: [{ ruleCode: "AZ_NSG_OPEN", risk: "medium", resourceRef: "nsg.prod-frontend" }],
      missingCapabilities: ["live_validation"],
      sourceMode: "preview",
      confidence: 0.5,
      nextAction: { label: "Connect Azure", href: "/operator/onboarding" },
    },
    {
      provider: "gcp",
      mode: "preview",
      connectionStatus: "preview",
      validationStatus: "preview",
      scanStatus: "preview",
      resourceCounts: { compute: 12, storage: 5, sql: 1 },
      topFindings: [{ ruleCode: "GCP_BUCKET_PUBLIC", risk: "high", resourceRef: "gcs.public-assets" }],
      missingCapabilities: ["live_validation"],
      sourceMode: "preview",
      confidence: 0.5,
      nextAction: { label: "Connect GCP", href: "/operator/onboarding" },
    },
  ],
  cloudInventory: {
    totalResources: 89,
    byProvider: { aws: 81, azure: 30, gcp: 18 },
  },
  securityPosture:    { score: 72, status: "warning", summary: "8 failing · 3 warning · preview signals across cloud + app", criticalItems: 8, warnings: 3, sourceMode: "preview" },
  costPosture:        { score: 55, status: "preview", summary: "Cost telemetry partial — Cost Explorer wiring pending.", criticalItems: 0, warnings: 0, sourceMode: "preview" },
  reliabilityPosture: { score: 60, status: "preview", summary: "Backup + replica signals pending.", criticalItems: 0, warnings: 0, sourceMode: "preview" },
  releaseOpsPosture:  { score: 82, status: "healthy", summary: "Grade B · 3 blocker(s)", criticalItems: 0, warnings: 3, sourceMode: "preview" },
  desktopPosture:     { score: 65, status: "warning", summary: "Desktop signing in progress.", criticalItems: 0, warnings: 1, sourceMode: "preview" },
  remediationPosture: { score: 80, status: "healthy", summary: "12 candidate(s) · 7 approval-gated", criticalItems: 0, warnings: 7, sourceMode: "preview" },
  simulationPosture:  { score: 75, status: "healthy", summary: "Twin-backed preflight on every candidate.", criticalItems: 0, warnings: 0, sourceMode: "preview" },
  approvalPosture:    { score: 50, status: "warning", summary: "5 approvals pending", criticalItems: 0, warnings: 5, sourceMode: "preview" },
  validationPosture:  { score: 88, status: "healthy", summary: "44/50 probes passing", criticalItems: 0, warnings: 0, sourceMode: "preview" },
  nextBestActions: [
    { id: "n1", title: "Connect AWS live",                  description: "Move from preview to live signals. Provision a read-only role.",                       category: "connect_provider", priority: 95, riskLevel: "high",   canRunNow: false, approvalRequired: false, route: "/operator/onboarding" },
    { id: "n2", title: "Resolve 8 failing security finding(s)", description: "Open Security Scanner. Each failing check has a typed remediation candidate.",     category: "review_finding",   priority: 90, riskLevel: "high",   canRunNow: true,  approvalRequired: false, route: "/dashboard/security-scanner" },
    { id: "n3", title: "5 approvals waiting for decision",  description: "Open Orchestration. Approve / reject one-click.",                                       category: "request_approval", priority: 88, riskLevel: "high",   canRunNow: true,  approvalRequired: true,  route: "/dashboard/orchestration" },
    { id: "n4", title: "Review 12 remediation candidates",  description: "Terraform + CLI + rollback + verification bundled per candidate.",                      category: "remediate",        priority: 82, riskLevel: "medium", canRunNow: true,  approvalRequired: false, route: "/dashboard/remediation" },
    { id: "n5", title: "Simulate top candidate",            description: "Preflight before any approval.",                                                         category: "simulate",         priority: 75, riskLevel: "low",    canRunNow: true,  approvalRequired: false, route: "/dashboard/simulations" },
    { id: "n6", title: "Connect GitHub for live ReleaseOps", description: "Live workflow + branch protection.",                                                    category: "connect_provider", priority: 70, riskLevel: "medium", canRunNow: false, approvalRequired: false, route: "/dashboard/integrations/github" },
  ],
  blockers: [
    { code: "config.broker_missing", detail: "AWS broker credentials missing; running in preview mode." },
    { code: "azure.live_validator",  detail: "Azure live validation pending @azure/identity wiring." },
  ],
  risks: [
    { code: "S3_PUBLIC_ACCESS",    detail: "Public S3 bucket detected" },
    { code: "AZ_NSG_OPEN",         detail: "Azure NSG with 0.0.0.0/0 ingress" },
    { code: "GCP_BUCKET_PUBLIC",   detail: "GCS bucket world-readable" },
  ],
};

// ---------------------------------------------------------------------------
// Remediation
// ---------------------------------------------------------------------------

export const MOCK_REMEDIATION: RemediationPipelineLite = {
  generatedAt: new Date().toISOString(),
  bundles: [
    {
      candidate: {
        id: "rem.aws.s3_public.001",
        title: "Block public access on s3.bucket.assets-prod",
        description: "Public S3 bucket detected with read-allow ACL. Restrict via block-public-access policy.",
        provider: "aws",
        riskLevel: "high",
        category: "security_hardening",
        impactSummary: "Removes anonymous read access. Verify CDN signed URLs first.",
        policyDecision: "requires_two_approvers",
        approvalRequirement: "two_approvers",
        desktopReviewEligibility: "eligible",
        status: "requires_approval",
        sourceMode: "preview",
      },
      readiness: {
        decision: "requires_approval",
        reason: "Approval required from security reviewer + production owner.",
        safeNextAction: { label: "Request approval", href: "/dashboard/orchestration" },
      },
      terraform: {
        fileName: "aws/s3_assets_prod_public_access.tf",
        hcl: `resource "aws_s3_bucket_public_access_block" "assets_prod" {\n  bucket                  = "assets-prod"\n  block_public_acls       = true\n  block_public_policy     = true\n  ignore_public_acls      = true\n  restrict_public_buckets = true\n}`,
        manualReviewRequired: false,
        explanation: "Blocks public access at the bucket boundary. Existing private objects are unaffected.",
      },
      cli: {
        cli: "aws",
        command: "aws s3api put-public-access-block --bucket assets-prod --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true",
        manualReviewRequired: false,
        explanation: "Blocks public access via the AWS CLI.",
      },
      rollback: {
        rollbackAvailable: true,
        rollbackComplexity: "moderate",
        rollbackSteps: [
          { ordinal: 1, detail: "Pause CloudFront if using signed URLs." },
          { ordinal: 2, detail: "Re-apply previous bucket policy from VCS history." },
          { ordinal: 3, detail: "Verify objects are readable via approved path only." },
        ],
      },
      verification: {
        manualOrAutomated: "automated",
        checks: [
          { ordinal: 1, title: "Block-public-access flags are all true", execution: "automated" },
          { ordinal: 2, title: "CloudFront / signed URL access still works", execution: "manual" },
        ],
      },
      finalStatus: "requires_approval",
    },
    {
      candidate: {
        id: "rem.azure.nsg.002",
        title: "Tighten Azure NSG public ingress on nsg.prod-frontend",
        description: "Network security group allows 0.0.0.0/0 on port 443. Replace with VPN CIDR.",
        provider: "azure",
        riskLevel: "medium",
        category: "security_hardening",
        impactSummary: "Replaces wide-open ingress with tighter CIDR list.",
        policyDecision: "requires_approval",
        approvalRequirement: "single_approver",
        desktopReviewEligibility: "eligible",
        status: "ready_for_review",
        sourceMode: "preview",
      },
      readiness: {
        decision: "preview_only",
        reason: "Azure live mode pending — simulation only.",
        safeNextAction: { label: "Open in desktop review", href: "/desktop/inbox" },
      },
      terraform:    { fileName: "azure/nsg_prod_frontend.tf", hcl: "# Azure NSG rule update (preview)", manualReviewRequired: false, explanation: "Tighten ingress per documented CIDR list." },
      cli:          { cli: "az", command: "az network nsg rule update --name allow-443 --nsg-name prod-frontend --resource-group prod --source-address-prefixes 10.0.0.0/8", manualReviewRequired: false, explanation: "Restrict source CIDR via Azure CLI." },
      rollback:     { rollbackAvailable: true,  rollbackComplexity: "trivial", rollbackSteps: [{ ordinal: 1, detail: "Re-apply previous NSG rule (0.0.0.0/0)." }] },
      verification: { manualOrAutomated: "automated", checks: [{ ordinal: 1, title: "Re-scan NSG and confirm no 0.0.0.0/0 rules", execution: "automated" }] },
      finalStatus: "ready_for_review",
    },
    {
      candidate: {
        id: "rem.gcp.bucket.003",
        title: "Remove allUsers viewer on gs://public-assets",
        description: "GCS bucket has allUsers binding granting storage.objectViewer. Restrict to authenticated access.",
        provider: "gcp",
        riskLevel: "high",
        category: "security_hardening",
        impactSummary: "Removes anonymous viewer binding. Confirm public-asset CDN serves through authenticated path first.",
        policyDecision: "requires_two_approvers",
        approvalRequirement: "two_approvers",
        desktopReviewEligibility: "eligible",
        status: "requires_approval",
        sourceMode: "preview",
      },
      readiness:    { decision: "preview_only", reason: "GCP live mode pending — simulation only.", safeNextAction: { label: "Open in desktop review", href: "/desktop/inbox" } },
      terraform:    { fileName: "gcp/bucket_public_assets.tf", hcl: "# Remove allUsers viewer binding (preview)", manualReviewRequired: false, explanation: "Removes allUsers viewer binding via google_storage_bucket_iam_member resource." },
      cli:          { cli: "gcloud", command: "gcloud storage buckets remove-iam-policy-binding gs://public-assets --member=allUsers --role=roles/storage.objectViewer", manualReviewRequired: false, explanation: "Removes the anonymous binding." },
      rollback:     { rollbackAvailable: true,  rollbackComplexity: "trivial", rollbackSteps: [{ ordinal: 1, detail: "Re-add the allUsers binding if rollback approved." }] },
      verification: { manualOrAutomated: "automated", checks: [{ ordinal: 1, title: "Re-scan IAM and confirm no allUsers binding", execution: "automated" }] },
      finalStatus: "requires_approval",
    },
  ],
  summary: { total: 12, approvalGated: 7, desktopEligible: 9, blocked: 2, byRisk: { low: 2, medium: 4, high: 5, critical: 1 } },
};

// ---------------------------------------------------------------------------
// Simulations
// ---------------------------------------------------------------------------

export const MOCK_SIMULATIONS: SimulationsBatchLite = {
  generatedAt: new Date().toISOString(),
  twinId: "twin.demo-tenant.preview",
  results: [
    {
      id: "sim.001",
      changeSetId: "cs.aws.s3_public.001",
      status: "preview_only",
      summary: "Preview-only · 1 resource directly affected · max risk high",
      delta: { security: "improved", risk: "improved" },
      impact: { directlyAffected: [{ resourceId: "s3.bucket.assets-prod", impactLevel: "high" }], indirectlyAffected: [{ resourceId: "iam.role.cdn-reader" }], overallImpact: "high" },
      rollbackFeasibility: "documented",
      blockers: [],
      approvalsRequired: [{ actionId: "act.001", reason: "Two approvers required for production change." }],
      safeNextAction: { label: "Request approval", href: "/dashboard/orchestration" },
      confidence: 0.78,
    },
    {
      id: "sim.002",
      changeSetId: "cs.azure.nsg.002",
      status: "preview_only",
      summary: "Preview-only · 2 resources affected · max risk medium",
      delta: { security: "improved", risk: "improved" },
      impact: { directlyAffected: [{ resourceId: "nsg.prod-frontend", impactLevel: "medium" }], indirectlyAffected: [{ resourceId: "vm.prod-frontend-a" }, { resourceId: "vm.prod-frontend-b" }], overallImpact: "medium" },
      rollbackFeasibility: "documented",
      blockers: [],
      approvalsRequired: [{ actionId: "act.002", reason: "Single approver required." }],
      safeNextAction: { label: "Request approval", href: "/dashboard/orchestration" },
      confidence: 0.71,
    },
  ],
  summary: { total: 12, simulated: 0, preview_only: 12, blocked: 0, unsafe: 0 },
};

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

export const MOCK_ORCHESTRATION: OrchestrationListLite = {
  generatedAt: new Date().toISOString(),
  orchestrations: [
    { id: "orc.001", title: "Block public S3 bucket assets-prod",      description: "AWS S3 public access remediation", provider: "aws",    stage: "approval_requested", status: "waiting_for_approval", riskLevel: "high",   sourceMode: "preview", safeNextAction: { label: "Decide", href: "/dashboard/orchestration" } },
    { id: "orc.002", title: "Tighten Azure NSG prod-frontend",          description: "Azure NSG ingress tighten",         provider: "azure",  stage: "simulated",          status: "preview_only",         riskLevel: "medium", sourceMode: "preview" },
    { id: "orc.003", title: "Remove allUsers on GCS public-assets",    description: "GCP bucket viewer removal",         provider: "gcp",    stage: "approval_requested", status: "waiting_for_approval", riskLevel: "high",   sourceMode: "preview" },
    { id: "orc.004", title: "Add branch protection on main · prod-api", description: "GitHub release governance",         provider: "github", stage: "planned",            status: "preview_only",         riskLevel: "medium", sourceMode: "preview" },
  ],
  approvals: [
    { id: "appr.001", sourceType: "security_finding", sourceId: "S3_PUBLIC_ACCESS", provider: "aws",    riskLevel: "high",   changeSummary: "Block public access on s3.bucket.assets-prod", status: "pending", expiresAt: new Date(Date.now() + 24*60*60*1000).toISOString(), approverRole: "two_approver_quorum" },
    { id: "appr.002", sourceType: "security_finding", sourceId: "GCP_BUCKET_PUBLIC",provider: "gcp",   riskLevel: "high",   changeSummary: "Remove allUsers on gs://public-assets",         status: "pending", expiresAt: new Date(Date.now() + 12*60*60*1000).toISOString(), approverRole: "two_approver_quorum" },
    { id: "appr.003", sourceType: "release_blocker",  sourceId: "branch.protection.main", provider: "github", riskLevel: "medium", changeSummary: "Add 2-approver branch protection on prod-api main", status: "pending", expiresAt: new Date(Date.now() + 48*60*60*1000).toISOString(), approverRole: "approver" },
  ],
  activeLocks: [
    { id: "lock.001", kind: "execution_plan", resourceRef: "s3.bucket.assets-prod", expiresAt: new Date(Date.now() + 5*60*1000).toISOString() },
  ],
  summary: { total: 12, approvalRequested: 5, blocked: 2, desktopReviewReady: 7 },
};

// ---------------------------------------------------------------------------
// Security scan
// ---------------------------------------------------------------------------

export const MOCK_SECURITY: SecurityScanLite = {
  generatedAt: new Date().toISOString(),
  results: [
    { id: "S3_PUBLIC_ACCESS",     title: "S3 bucket has public access",                description: "Bucket assets-prod allows anonymous read.",                              severity: "high",     category: "network_exposure",     scope: "cloud", provider: "aws",   status: "fail",    evidence: ["Block-public-access flags all false."], remediation: "Apply public-access-block configuration.", source: "preview" },
    { id: "AZ_NSG_OPEN",          title: "NSG allows 0.0.0.0/0 on 443",                description: "nsg.prod-frontend has wide-open ingress on HTTPS.",                       severity: "medium",   category: "network_exposure",     scope: "cloud", provider: "azure", status: "fail",    evidence: ["Inbound rule: 0.0.0.0/0 → 443."], remediation: "Restrict source CIDR to office / VPN ranges.", source: "preview" },
    { id: "GCP_BUCKET_PUBLIC",    title: "GCS bucket has allUsers binding",            description: "Bucket gs://public-assets has anonymous viewer.",                          severity: "high",     category: "network_exposure",     scope: "cloud", provider: "gcp",   status: "fail",    evidence: ["IAM binding: allUsers → storage.objectViewer."], remediation: "Remove the allUsers binding.", source: "preview" },
    { id: "IAM_OVERREACH_PROD",   title: "IAM role with wildcard actions",             description: "role.deploy-prod has '*' action on S3.",                                  severity: "medium",   category: "iam_overreach",        scope: "cloud", provider: "aws",   status: "warn",    evidence: ["s3:* on resource '*' detected."], remediation: "Scope actions to specific buckets + verbs.", source: "preview" },
    { id: "ENCRYPTION_MISSING",   title: "Encryption-at-rest not enforced",            description: "S3 bucket logs-archive lacks default encryption.",                         severity: "medium",   category: "encryption_at_rest",   scope: "cloud", provider: "aws",   status: "fail",    evidence: ["No SSE-S3 / SSE-KMS configured."], remediation: "Enable SSE-S3 default encryption.", source: "preview" },
    { id: "AUDIT_NO_TRAIL",       title: "CloudTrail multi-region not enabled",         description: "Only us-east-1 has trail enabled.",                                      severity: "medium",   category: "audit_gap",            scope: "cloud", provider: "aws",   status: "warn",    evidence: ["Trail count: 1 region of 6."], remediation: "Enable multi-region CloudTrail.", source: "preview" },
    { id: "DEPENDENCY_SCAN_OFF",  title: "Dependency scan not run on push",            description: "npm audit not enforced in CI.",                                          severity: "low",      category: "supply_chain",         scope: "supply_chain", status: "warn",    evidence: ["No npm audit step in CI workflow."], remediation: "Add a fail-on-high npm audit step.", source: "preview" },
    { id: "DESKTOP_UNSIGNED_WIN", title: "Windows desktop binary unsigned",            description: "Windows MSI / EXE not signed with EV cert.",                              severity: "low",      category: "desktop_distribution", scope: "desktop",        status: "preview", evidence: ["No WINDOWS_CERTIFICATE secret configured."], remediation: "Add a Windows EV cert in GitHub secrets.", source: "preview" },
    { id: "REDACTION_ACTIVE",     title: "Audit redaction pipeline active",            description: "Forbidden keys + values redacted in every diff.",                          severity: "info",     category: "app_boundary",         scope: "app",            status: "pass",    evidence: ["Forbidden key filter active."], source: "preview" },
    { id: "RBAC_PARTIAL",         title: "RBAC partially wired on routes",             description: "Some routes still trust session.user object structurally.",               severity: "info",     category: "app_boundary",         scope: "app",            status: "warn",    evidence: ["3 routes missing requireRole guard."], remediation: "Add role guard to flagged routes.", source: "preview" },
  ],
  summary: { total: 10, pass: 1, fail: 4, warn: 4, unknown: 0, preview: 1, score: 35 },
};
