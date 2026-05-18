/**
 * Integration Health checker.
 *
 * Pure read-only composition over the already-canonical AxiomOSState.
 * Builds one IntegrationHealthEntry per major source Axiom reads from
 * (AWS / Azure / GCP / GitHub / Desktop / Trust evidence / Audit /
 * Memory persistence). No SDK calls. Tenant-scoped via the
 * underlying state builder.
 *
 * Status logic:
 *   live mode + no missing config           → healthy
 *   partial_live                             → degraded
 *   preview / expanding / foundation         → preview
 *   blocked                                  → blocked
 *   disabled                                 → disabled
 *
 * Every entry surfaces honest missingConfig / missingPermissions /
 * limitations / safeNextAction.
 */

import "server-only";

import { buildAxiomOSState } from "@/lib/axiomOS/axiomOSStateBuilder";
import type { AxiomOSState, ProviderPosture } from "@/lib/axiomOS/axiomOSModel";
import type { OrganizationId, UserId } from "@/lib/domain/ids";
import {
  KIND_LABEL,
  rollupHealthSourceMode,
  rollupHealthStatus,
  type IntegrationHealthEntry,
  type IntegrationHealthReport,
  type IntegrationHealthSourceMode,
  type IntegrationHealthStatus,
  type IntegrationKind,
} from "./integrationHealthModel";

export interface BuildIntegrationHealthInput {
  tenantId: OrganizationId;
  actorUserId?: UserId;
}

// Re-export for callers that don't want to import from the model
// (route handlers, UI lite-types).
export type { IntegrationHealthEntry, IntegrationHealthReport };

// ---------------------------------------------------------------------------

export async function buildIntegrationHealthReport(
  input: BuildIntegrationHealthInput,
): Promise<IntegrationHealthReport> {
  const state = await buildAxiomOSState({
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
  });
  const generatedAt = state.generatedAt;

  const entries: IntegrationHealthEntry[] = [
    fromProvider(state, "aws"),
    fromProvider(state, "azure"),
    fromProvider(state, "gcp"),
    fromProvider(state, "github"),
    fromDesktop(state, generatedAt),
    fromTrustEvidence(state, generatedAt),
    fromAuditPersistence(state, generatedAt),
    fromMemoryPersistence(state, generatedAt),
  ];

  const summary = {
    total:    entries.length,
    healthy:  entries.filter((e) => e.status === "healthy").length,
    degraded: entries.filter((e) => e.status === "degraded").length,
    preview:  entries.filter((e) => e.status === "preview").length,
    blocked:  entries.filter((e) => e.status === "blocked").length,
    disabled: entries.filter((e) => e.status === "disabled").length,
  };

  return {
    generatedAt,
    tenantId: String(input.tenantId),
    overallStatus:     rollupHealthStatus(entries),
    overallSourceMode: rollupHealthSourceMode(entries),
    entries,
    summary,
    limitations: state.limitations,
    safeNextAction: {
      label: "Open Sources",
      href:  "/dashboard/sources",
    },
  };
}

// ---------------------------------------------------------------------------
// Per-source mappers
// ---------------------------------------------------------------------------

function fromProvider(state: AxiomOSState, providerId: "aws" | "azure" | "gcp" | "github"): IntegrationHealthEntry {
  const posture: ProviderPosture | undefined = state.providers.find((p) => p.provider === providerId);
  const loop = state.operatingLoops.find((l) => l.provider === providerId);
  const lastScannedAt = posture?.lastScannedAt;

  const status: IntegrationHealthStatus =
    !posture                              ? "unknown" :
    posture.mode === "live"               ? "healthy" :
    posture.mode === "partial_live"       ? "degraded" :
    posture.mode === "blocked"            ? "blocked" :
    posture.mode === "disabled"           ? "disabled" :
                                            "preview";

  const sourceMode: IntegrationHealthSourceMode =
    !posture                          ? "unknown"      :
    posture.mode === "live"           ? "live"         :
    posture.mode === "partial_live"   ? "partial_live" :
    posture.mode === "expanding"      ? "foundation"   :
    posture.mode === "preview"        ? "preview"      :
    posture.mode === "blocked"        ? "blocked"      :
    posture.mode === "disabled"       ? "disabled"     :
                                        "unknown";

  const failureReason = posture?.mode === "blocked" || posture?.mode === "disabled"
    ? posture.headline
    : undefined;

  return {
    id: providerId,
    label: KIND_LABEL[providerId],
    status,
    sourceMode,
    headline: posture?.headline ?? "Provider posture unavailable",
    lastCheckedAt: state.generatedAt,
    lastSuccessAt: status === "healthy" || status === "degraded" ? lastScannedAt : undefined,
    lastFailureAt: status === "blocked" ? state.generatedAt : undefined,
    failureReason,
    missingConfig: posture?.missingRequirements ?? [],
    missingPermissions: [],
    limitations: loop && loop.attentionRequiredCount > 0
      ? [`${loop.attentionRequiredCount} attention-required signal${loop.attentionRequiredCount === 1 ? "" : "s"} from the operating loop`]
      : [],
    safeNextAction: posture?.safeNextAction,
    setupRoute: setupRouteFor(providerId),
    evidenceRefs: [`axiomOS:providers[${providerId}]`, ...(loop ? [`operatingLoops[${providerId}]`] : [])],
  };
}

function fromDesktop(state: AxiomOSState, generatedAt: string): IntegrationHealthEntry {
  const d = state.desktopPosture;
  const status: IntegrationHealthStatus =
    d.sourceMode === "live"         ? "healthy"  :
    d.sourceMode === "partial_live" ? "degraded" :
    d.sourceMode === "preview"      ? "preview"  :
    d.sourceMode === "blocked"      ? "blocked"  :
    d.sourceMode === "disabled"     ? "disabled" :
                                      "preview";
  return {
    id: "desktop",
    label: KIND_LABEL.desktop,
    status,
    sourceMode: d.sourceMode as IntegrationHealthSourceMode,
    headline: d.data.binaryAvailable
      ? `Signing: ${d.data.signingStatus.replace(/_/g, " ")} · ${d.data.pairedSessions} paired session${d.data.pairedSessions === 1 ? "" : "s"}`
      : "Desktop runtime · no public binary yet · review workstation role",
    lastCheckedAt: generatedAt,
    missingConfig: [],
    missingPermissions: [],
    limitations: [
      ...d.limitations,
      "Local execution disabled by safety contract",
    ],
    safeNextAction: d.safeNextAction,
    setupRoute: "/dashboard/desktop",
    evidenceRefs: ["axiomOS:desktopPosture"],
  };
}

function fromTrustEvidence(state: AxiomOSState, generatedAt: string): IntegrationHealthEntry {
  const e = state.evidencePosture;
  const ratio = e.data.totalRecords > 0
    ? e.data.verifiedRecords / e.data.totalRecords
    : 0;
  const status: IntegrationHealthStatus =
    e.data.totalRecords === 0    ? "preview"  :
    ratio >= 0.7                  ? "healthy"  :
    ratio >= 0.3                  ? "degraded" :
                                    "preview";
  return {
    id: "trust_evidence",
    label: KIND_LABEL.trust_evidence,
    status,
    sourceMode: e.sourceMode as IntegrationHealthSourceMode,
    headline: e.data.totalRecords === 0
      ? "No evidence records collected yet"
      : `${e.data.totalRecords} record${e.data.totalRecords === 1 ? "" : "s"} · ${e.data.verifiedRecords} verified · ${Math.round(e.data.coverageScore * 100)}% coverage`,
    lastCheckedAt: generatedAt,
    missingConfig: [],
    missingPermissions: [],
    limitations: e.limitations,
    safeNextAction: { label: "Inspect evidence", href: "/dashboard/evidence" },
    setupRoute: "/dashboard/trust",
    evidenceRefs: ["axiomOS:evidencePosture"],
  };
}

function fromAuditPersistence(state: AxiomOSState, generatedAt: string): IntegrationHealthEntry {
  const a = state.auditPosture;
  const status: IntegrationHealthStatus =
    a.data.persistent ? "healthy" : "preview";
  return {
    id: "audit_persistence",
    label: KIND_LABEL.audit_persistence,
    status,
    sourceMode: a.sourceMode as IntegrationHealthSourceMode,
    headline: a.data.persistent
      ? `Audit log persistent · ${a.data.recentEventCount} recent event${a.data.recentEventCount === 1 ? "" : "s"}`
      : `Audit log in-memory · ${a.data.recentEventCount} recent event${a.data.recentEventCount === 1 ? "" : "s"} · DATABASE_URL required for durability`,
    lastCheckedAt: generatedAt,
    missingConfig: a.data.persistent ? [] : ["DATABASE_URL"],
    missingPermissions: [],
    limitations: a.limitations,
    safeNextAction: { label: "Open audit", href: "/dashboard/audit" },
    setupRoute: "/docs/architecture#persistence",
    evidenceRefs: ["axiomOS:auditPosture"],
  };
}

function fromMemoryPersistence(state: AxiomOSState, generatedAt: string): IntegrationHealthEntry {
  const m = state.memoryPosture;
  const status: IntegrationHealthStatus =
    m.data.persistent ? "healthy" : "preview";
  return {
    id: "memory_persistence",
    label: KIND_LABEL.memory_persistence,
    status,
    sourceMode: m.sourceMode as IntegrationHealthSourceMode,
    headline: m.data.persistent
      ? `Memory store persistent · ${m.data.recordCount} record${m.data.recordCount === 1 ? "" : "s"}`
      : `Memory store in-memory · ${m.data.recordCount} record${m.data.recordCount === 1 ? "" : "s"} · DATABASE_URL required for durability`,
    lastCheckedAt: generatedAt,
    missingConfig: m.data.persistent ? [] : ["DATABASE_URL"],
    missingPermissions: [],
    limitations: m.limitations,
    safeNextAction: { label: "Open memory", href: "/dashboard/memory" },
    setupRoute: "/docs/architecture#persistence",
    evidenceRefs: ["axiomOS:memoryPosture"],
  };
}

function setupRouteFor(providerId: IntegrationKind): string {
  switch (providerId) {
    case "aws":    return "/docs/aws-setup";
    case "azure":  return "/docs/azure-setup";
    case "gcp":    return "/docs/gcp-setup";
    case "github": return "/dashboard/integrations/github";
    default:       return "/dashboard/integrations";
  }
}
