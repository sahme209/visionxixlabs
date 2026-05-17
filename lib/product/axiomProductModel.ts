/**
 * Axiom canonical product model.
 *
 * Defines the 14 product surfaces that make up the Axiom ecosystem
 * (web + 3 desktop platforms + 10 sub-systems) and composes their
 * status from existing canonical builders.
 *
 * Hard rules:
 *  - This module does NOT replace any existing builder. It is a thin
 *    composition layer that produces one typed read for the whole
 *    product.
 *  - No SDK calls. No mutations. No fabricated status.
 *  - Every surface carries `sourceMode` + `limitations` + `safeNextAction`.
 *  - Desktop platforms (macOS / Windows / Linux) are first-class
 *    surfaces, never hidden as side features.
 */

import "server-only";

import { buildAxiomOSState } from "@/lib/axiomOS/axiomOSStateBuilder";
import { buildPlatformStatus, type PlatformStatusEntry } from "@/lib/desktop/desktopStateModel";
import { buildDesktopProductModel } from "@/lib/desktop/desktopProductModel";
import { loadAppEnv } from "@/lib/config/env";
import { CONTROL_REGISTRY, summarizeControls } from "@/lib/compliance/controlRegistry";
import { VALIDATION_MATRIX } from "@/lib/validation/platformValidationMatrix";
import type { OrganizationId, UserId } from "@/lib/domain/ids";

// ---------------------------------------------------------------------------
// Surface taxonomy — 14 canonical surfaces
// ---------------------------------------------------------------------------

export type AxiomSurfaceId =
  | "web_app"
  | "macos_app"
  | "windows_app"
  | "linux_app"
  | "cloud_connectors"
  | "releaseops_connectors"
  | "security_engine"
  | "remediation_engine"
  | "simulation_engine"
  | "approval_engine"
  | "desktop_review_workstation"
  | "trust_center"
  | "audit_evidence_layer"
  | "safe_autonomous_loop";

export type SurfaceStatus =
  | "launch_ready"
  | "pilot_ready"
  | "usable_with_limitations"
  | "preview"
  | "foundation"
  | "blocked"
  | "broken";

export type SurfaceSourceMode = "live" | "partial_live" | "preview" | "expanding" | "blocked" | "unknown";

export interface AxiomSurface {
  id: AxiomSurfaceId;
  /** Operator-facing label. */
  label: string;
  /** Short product role. */
  role: string;
  status: SurfaceStatus;
  sourceMode: SurfaceSourceMode;
  /** Real evidence pointing at file paths / matrix ids / routes. */
  evidence: string;
  /** Honest limitations the surface ships with today. */
  limitations: string[];
  /** Hard blockers (credentials / signing / etc.). */
  blockers: string[];
  /** Routes the surface exposes. */
  routes: string[];
  /** Safe operator next action. */
  safeNextAction?: { label: string; href: string };
}

export interface AxiomProductModel {
  tenantId: OrganizationId;
  generatedAt: string;
  /** Rolled-up product source mode. */
  overallSourceMode: SurfaceSourceMode;
  /** Composite roll-up of the 14 surface statuses. */
  overallStatus: SurfaceStatus;
  surfaces: AxiomSurface[];
  /** Per-platform desktop packaging status — first-class. */
  desktopPlatforms: PlatformStatusEntry[];
  /** Aggregated limitations + safety statement. */
  productLimitations: string[];
  safetyContract: "approval_gated_no_destructive_execution";
}

// ---------------------------------------------------------------------------
// Public entry
// ---------------------------------------------------------------------------

export interface BuildAxiomProductModelInput {
  tenantId: OrganizationId;
  actorUserId?: UserId;
}

export async function buildAxiomProductModel(input: BuildAxiomProductModelInput): Promise<AxiomProductModel> {
  const env = loadAppEnv();
  const axiomOS = await buildAxiomOSState({
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
  });
  const desktopPlatforms = buildPlatformStatus();
  const desktopProductModel = buildDesktopProductModel();
  const controlSummary = summarizeControls(CONTROL_REGISTRY);
  const matrixPassing = VALIDATION_MATRIX.filter((r) => r.status === "passing").length;

  const aws    = axiomOS.providers.find((p) => p.provider === "aws");
  const github = axiomOS.providers.find((p) => p.provider === "github");
  const azure  = axiomOS.providers.find((p) => p.provider === "azure");
  const gcp    = axiomOS.providers.find((p) => p.provider === "gcp");

  const macOSarm = desktopPlatforms.find((p) => p.platform === "macos-arm")!;
  const windows  = desktopPlatforms.find((p) => p.platform === "windows")!;
  const linux    = desktopPlatforms.find((p) => p.platform === "linux")!;

  const surfaces: AxiomSurface[] = [
    surface(
      "web_app",
      "Web platform",
      "Primary Axiom OS surface — Command Center, source connection, security, trust, readiness.",
      matrixPassing > 50 ? "pilot_ready" : "usable_with_limitations",
      "live",
      `${matrixPassing}+ validated matrix rows · /dashboard/* routes shipping`,
      [],
      [],
      ["/dashboard/command-center", "/dashboard/multi-cloud", "/dashboard/security-scanner", "/dashboard/trust", "/dashboard/releaseops"],
      { label: "Open Command Center", href: "/dashboard/command-center" },
    ),
    desktopSurface("macos_app", "macOS desktop app", macOSarm),
    desktopSurface("windows_app", "Windows desktop app", windows),
    desktopSurface("linux_app", "Linux desktop app", linux),
    surface(
      "cloud_connectors",
      "Cloud connectors (AWS / Azure / GCP)",
      "Read-only validators + scanners + normalized snapshots across AWS, Azure, GCP.",
      aws?.mode === "live" ? "pilot_ready" : "usable_with_limitations",
      rollupMode([aws?.mode, azure?.mode, gcp?.mode]),
      "lib/cloud/{aws,azure,gcp}/* — STS + @azure/identity + @google-cloud/resource-manager validators; AWS live multi-region inventory",
      ["Azure / GCP live inventory traversal still preview — validators are live."],
      [...new Set([
        ...(aws?.missingRequirements ?? []),
        ...(azure?.missingRequirements ?? []),
        ...(gcp?.missingRequirements ?? []),
      ])].slice(0, 5),
      ["/api/aws/validate", "/api/aws/scan", "/api/azure/validate", "/api/azure/scan", "/api/gcp/validate", "/api/gcp/scan"],
      { label: "Open Sources", href: "/dashboard/multi-cloud" },
    ),
    surface(
      "releaseops_connectors",
      "GitHub / ReleaseOps",
      "Live read-only repos / workflows / branch protection / deployment environments.",
      github?.mode === "live" ? "pilot_ready" : "usable_with_limitations",
      github?.mode === "live" ? "live" : "preview",
      "lib/connectors/github/{githubLiveClient,githubLiveScanner,githubAppAuth}.ts — App auth + PAT fallback + deployment env discovery",
      github?.mode === "live" ? [] : ["GitHub live mode requires PAT or App credentials."],
      github?.missingRequirements ?? [],
      ["/api/github/validate", "/api/github/sync", "/api/releaseops/state", "/api/releaseops/scan"],
      github?.safeNextAction ?? { label: "Connect GitHub", href: "/dashboard/integrations/github" },
    ),
    surface(
      "security_engine",
      "Security scanner + vulnerability intelligence",
      "Evidence-based findings across cloud / app / supply chain / desktop / GitHub. Compounded-risk reasoner.",
      "pilot_ready",
      "live",
      "lib/securityScanner/* — 14 categories, vulnerabilityModel.ts (canonical SecurityFinding), compoundedRiskReasoner.ts (3 patterns)",
      [],
      [],
      ["/api/security-scan"],
      { label: "Open security scanner", href: "/dashboard/security-scanner" },
    ),
    surface(
      "remediation_engine",
      "Remediation engine",
      "Generates remediation candidates from findings with Terraform / CLI previews + rollback plans + verification checklists.",
      "usable_with_limitations",
      "preview",
      "lib/remediation/{remediationPlanner,remediationPipeline}.ts + lib/execution/{terraformPreviewGenerator,cliPreviewGenerator,rollbackPlanGenerator,verificationChecklist}.ts",
      ["Counts populate when operator runs POST /api/remediation/plan."],
      [],
      ["/api/remediation/plan"],
      { label: "Open remediation", href: "/dashboard/remediation" },
    ),
    surface(
      "simulation_engine",
      "Simulation / digital twin",
      "In-memory simulator applies the change-set to a digital twin — provider-agnostic, no SDK calls.",
      "usable_with_limitations",
      "preview",
      "lib/simulation/executionSimulator.ts + diffEngine.ts + impactAnalyzer.ts + digitalTwinBuilder.ts",
      [],
      [],
      ["/api/simulations/create"],
      { label: "Open simulations", href: "/dashboard/simulations" },
    ),
    surface(
      "approval_engine",
      "Approval engine",
      "Approval requests for medium+ risk plans — auditable, expirable, role-aware. Operating loop refuses approval / preflight / verification.",
      "pilot_ready",
      "live",
      "lib/approvals/* + Prisma AxiomApprovalItem + operating-loop runner halt conditions",
      env.databaseUrlSet ? [] : ["Audit-store fallback to in-memory until DATABASE_URL set."],
      [],
      ["/api/approvals"],
      { label: "Open approvals", href: "/dashboard/orchestration/approvals" },
    ),
    surface(
      "desktop_review_workstation",
      "Desktop review workstation",
      desktopProductModel.role.replace(/_/g, " "),
      env.desktopHandoffSigningKeySet ? "pilot_ready" : "preview",
      env.desktopHandoffSigningKeySet ? "live" : "preview",
      "lib/desktop/* — session HMAC + handoff signature + Prisma adapter + 11 literal safety flags + 13 capability classifications",
      desktopProductModel.doesNotDo.slice(0, 3),
      env.desktopHandoffSigningKeySet ? [] : ["DESKTOP_HANDOFF_SIGNING_KEY not set — using NEXTAUTH_SECRET fallback."],
      ["/api/desktop/session", "/api/desktop/state", "/api/desktop/handoff", "/api/desktop/platform-status"],
      { label: "Open desktop install", href: "/desktop" },
    ),
    surface(
      "trust_center",
      "Trust Center",
      "Audit-ready evidence: control registry, evidence collector, security review packet, JSON / NDJSON bundle export.",
      "pilot_ready",
      "live",
      `${controlSummary.implemented}/${controlSummary.total} controls implemented · 9 typed ComplianceBundleKind exports`,
      ["No SOC 2 / ISO claims — Axiom provides audit-ready evidence, not certification."],
      [],
      ["/api/trust/summary", "/api/trust/controls", "/api/trust/evidence", "/api/trust/export"],
      { label: "Open Trust Center", href: "/dashboard/trust" },
    ),
    surface(
      "audit_evidence_layer",
      "Audit + evidence layer",
      "SecureAuditRecord + OperationalMemoryRecord + DesktopHandoffRecord persistence via Prisma when DATABASE_URL is set.",
      env.databaseUrlSet ? "pilot_ready" : "preview",
      env.databaseUrlSet ? "live" : "preview",
      "lib/audit/{secureAudit,auditStore.prisma,auditBundle}.ts + lib/platform/storeFactory.ts + instrumentation.ts",
      env.databaseUrlSet ? [] : ["DATABASE_URL not set — audit + memory are in-memory."],
      env.databaseUrlSet ? [] : ["DATABASE_URL"],
      ["/api/trust/summary", "/api/trust/export"],
      { label: "Open audit center", href: "/dashboard/audit" },
    ),
    surface(
      "safe_autonomous_loop",
      "Safe autonomous loop",
      "Operating-loop runner advances safe stages only — refuses approval / preflight / verification / desktop_review.",
      "pilot_ready",
      "live",
      "lib/operatingLoop/operatingLoopRunner.ts:haltConditions + lib/controlPlane/autonomousOpsLoop.ts",
      ["Loop never advances destructive paths — refuses by hard contract."],
      [],
      ["/api/operating-loop/run", "/api/axiom-os/run-safe-loop"],
      { label: "Run safe loop", href: "/api/axiom-os/run-safe-loop" },
    ),
  ];

  const overallSourceMode = rollupMode(surfaces.map((s) => s.sourceMode));
  const overallStatus = rollupStatus(surfaces.map((s) => s.status));

  const productLimitations = [
    "Execution is disabled by default — every change is approval-gated.",
    "Azure / GCP live inventory traversal is preview; validators are live.",
    "Compliance certifications (SOC 2 / ISO / HIPAA / PCI) are not claimed.",
    "Public desktop binary distribution: macOS signed + notarized, Windows EV pending, Linux GPG-signed package pending.",
    "Cost telemetry is not connected — no dollar savings claims.",
  ];

  return {
    tenantId: input.tenantId,
    generatedAt: new Date().toISOString(),
    overallSourceMode,
    overallStatus,
    surfaces,
    desktopPlatforms,
    productLimitations,
    safetyContract: "approval_gated_no_destructive_execution",
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function surface(
  id: AxiomSurfaceId,
  label: string,
  role: string,
  status: SurfaceStatus,
  sourceMode: SurfaceSourceMode,
  evidence: string,
  limitations: string[],
  blockers: string[],
  routes: string[],
  safeNextAction?: { label: string; href: string },
): AxiomSurface {
  return { id, label, role, status, sourceMode, evidence, limitations, blockers, routes, safeNextAction };
}

function desktopSurface(id: AxiomSurfaceId, label: string, p: PlatformStatusEntry): AxiomSurface {
  let status: SurfaceStatus;
  if (p.publiclyDownloadable) status = "pilot_ready";
  else if (p.signed) status = "usable_with_limitations";
  else status = "foundation";
  let sourceMode: SurfaceSourceMode;
  if (p.publiclyDownloadable) sourceMode = "live";
  else if (p.signed) sourceMode = "partial_live";
  else sourceMode = "preview";
  return {
    id,
    label,
    role: "Local review workstation — handoff inbox + Terraform / CLI / simulation review.",
    status,
    sourceMode,
    evidence: `Tauri 2 + React 19 build via GitHub Actions matrix · ${p.label}`,
    limitations: p.signed ? [] : ["Signing pipeline not yet activated for this platform."],
    blockers: p.blocker ? [p.blocker] : [],
    routes: ["/api/desktop/session", "/api/desktop/state", "/api/desktop/handoff", "/api/desktop/platform-status"],
    safeNextAction: p.safeNextAction,
  };
}

function rollupMode(modes: (string | undefined)[]): SurfaceSourceMode {
  const filtered = modes.filter((m): m is string => Boolean(m));
  if (filtered.length === 0) return "unknown";
  if (filtered.includes("blocked")) return "blocked";
  if (filtered.includes("preview") || filtered.includes("disabled")) return "preview";
  if (filtered.includes("partial_live") || filtered.includes("partial")) return "partial_live";
  if (filtered.includes("expanding")) return "expanding";
  if (filtered.every((m) => m === "live")) return "live";
  return "preview";
}

function rollupStatus(statuses: SurfaceStatus[]): SurfaceStatus {
  if (statuses.some((s) => s === "broken")) return "broken";
  if (statuses.some((s) => s === "blocked")) return "blocked";
  if (statuses.every((s) => s === "launch_ready" || s === "pilot_ready")) return "pilot_ready";
  if (statuses.some((s) => s === "pilot_ready" || s === "usable_with_limitations")) return "usable_with_limitations";
  if (statuses.every((s) => s === "preview" || s === "foundation")) return "preview";
  return "usable_with_limitations";
}
