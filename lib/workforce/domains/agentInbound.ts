/**
 * Agent inbound payload — Phase 642.
 *
 * Validates + persists a scan payload pushed by a customer-hosted
 * on-prem agent. Each payload represents one "scan run" against
 * one registered connector (Phase 641). Items in the payload are
 * persisted as one synthetic AiRationaleEnrichment row per scan
 * batch at targetKind=connector_scan_inventory, targetId=
 * <connectorSlug>:<scanId>.
 *
 * Why one row per batch (not one per item):
 *   · A typical vSphere scan returns 200-2000 VMs. Persisting
 *     each as a row would explode the AiRationaleEnrichment table.
 *   · The batch row holds counts + summary + serialized item refs;
 *     full per-item drill-down can ship with a Prisma model later.
 *
 * The downstream workforce engineers (compliance_framework,
 * dr_planner, workload_performance) can consume these batches by
 * the operator pasting them into the engineer's form. The
 * autonomous consumption path (engineer reads its workspace's
 * connector_scan_inventory directly) ships in a follow-up.
 *
 * Server-only.
 */

import "server-only";

import { prisma } from "@/lib/db";

export const CONNECTOR_SCAN_TARGET_KIND = "connector_scan_inventory";

export type ScanType = "inventory" | "compliance_findings" | "performance_metrics";

export interface InboundScanItem {
  /** Item identifier within the source platform — VM id, pod
   *  namespace/name, vmm cloud id, etc. */
  itemId: string;
  /** Short kind (e.g. "vmware.vm", "openshift.pod",
   *  "vmm.cloud"). Closed-union per platform when scanners ship. */
  itemKind: string;
  /** Free-form summary line for the UI. */
  summary: string;
  /** Optional severity for compliance_findings type. */
  severity?: "info" | "low" | "medium" | "high" | "critical";
}

export interface InboundScanPayload {
  /** Optional human-readable scan id from the agent. We sanitize
   *  for the targetId. */
  scanId?: string;
  scanType: ScanType;
  /** Items found this scan. Capped per request to keep the row
   *  small; agents that exceed should batch. */
  items: ReadonlyArray<InboundScanItem>;
  /** Optional opaque agent metadata (version, host, etc.) for the
   *  audit trail. */
  agentMeta?: Record<string, string>;
}

export type InboundError =
  | "invalid_scan_type"
  | "items_too_many"
  | "items_malformed"
  | "persist_failed";

export interface InboundResult {
  ok: boolean;
  slug: string | null;
  itemsPersisted: number;
  error: InboundError | null;
}

const MAX_ITEMS_PER_BATCH = 500;

function sanitizeScanId(raw: string | undefined): string {
  if (!raw || typeof raw !== "string") return Date.now().toString(36);
  return raw.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 60) || Date.now().toString(36);
}

function isValidScanType(s: string): s is ScanType {
  return s === "inventory" || s === "compliance_findings" || s === "performance_metrics";
}

function sanitizeItem(item: unknown): InboundScanItem | null {
  if (!item || typeof item !== "object") return null;
  const o = item as Record<string, unknown>;
  const itemId = typeof o.itemId === "string" ? o.itemId.slice(0, 200) : "";
  const itemKind = typeof o.itemKind === "string" ? o.itemKind.slice(0, 60) : "";
  const summary = typeof o.summary === "string" ? o.summary.slice(0, 400) : "";
  if (!itemId || !itemKind) return null;
  const severityRaw = o.severity;
  const severity =
    severityRaw === "info" || severityRaw === "low" || severityRaw === "medium" ||
    severityRaw === "high" || severityRaw === "critical"
      ? severityRaw
      : undefined;
  return { itemId, itemKind, summary, severity };
}

export async function acceptInboundScanPayload(
  organizationId: string,
  connectorSlug: string,
  payload: InboundScanPayload,
): Promise<InboundResult> {
  if (!isValidScanType(payload.scanType)) {
    return { ok: false, slug: null, itemsPersisted: 0, error: "invalid_scan_type" };
  }
  if (!Array.isArray(payload.items)) {
    return { ok: false, slug: null, itemsPersisted: 0, error: "items_malformed" };
  }
  if (payload.items.length > MAX_ITEMS_PER_BATCH) {
    return { ok: false, slug: null, itemsPersisted: 0, error: "items_too_many" };
  }
  const cleanItems: InboundScanItem[] = [];
  for (const raw of payload.items) {
    const item = sanitizeItem(raw);
    if (item) cleanItems.push(item);
  }
  const scanId = sanitizeScanId(payload.scanId);
  const slug = `${connectorSlug}:${payload.scanType}:${scanId}`;
  const severityCounts: Record<string, number> = { info: 0, low: 0, medium: 0, high: 0, critical: 0 };
  for (const it of cleanItems) {
    if (it.severity) severityCounts[it.severity] += 1;
  }
  const narrative = buildNarrative(connectorSlug, payload.scanType, cleanItems.length, severityCounts);

  const serializedPayload: string[] = [
    `connector|${connectorSlug}`,
    `scan_type|${payload.scanType}`,
    `scan_id|${scanId}`,
    `item_count|${cleanItems.length}`,
  ];
  for (const [sev, n] of Object.entries(severityCounts)) {
    if (n > 0) serializedPayload.push(`severity|${sev}|${n}`);
  }
  if (payload.agentMeta && typeof payload.agentMeta === "object") {
    for (const [k, v] of Object.entries(payload.agentMeta)) {
      if (typeof v !== "string") continue;
      const cleanKey = k.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40);
      if (!cleanKey) continue;
      serializedPayload.push(`agent_meta|${cleanKey}|${v.slice(0, 200)}`);
    }
  }
  // Per-item payload entries. Truncated when extremely large so the
  // JSONB column stays sane. The first 100 items get full detail;
  // the rest are item-counted only.
  for (let i = 0; i < Math.min(cleanItems.length, 100); i += 1) {
    const it = cleanItems[i];
    serializedPayload.push(`item|${it.itemKind}|${it.severity ?? "none"}|${it.itemId}|${it.summary}`);
  }
  if (cleanItems.length > 100) {
    serializedPayload.push(`truncated|${cleanItems.length - 100}`);
  }

  try {
    await prisma.aiRationaleEnrichment.upsert({
      where: {
        organizationId_targetKind_targetId: {
          organizationId,
          targetKind: CONNECTOR_SCAN_TARGET_KIND,
          targetId: slug,
        },
      },
      create: {
        organizationId,
        targetKind: CONNECTOR_SCAN_TARGET_KIND,
        targetId: slug,
        narrative,
        riskFactorsJson: [] as unknown as string[],
        nextActionsJson: serializedPayload as unknown as string[],
        outcome: cleanItems.length > 0 ? "ai_generated" : "fallback_rules",
        errorMessage: null,
        modelHint: null,
        engineVersion: "agent-inbound-v1",
      },
      update: {
        narrative,
        nextActionsJson: serializedPayload as unknown as string[],
      },
    });
    return { ok: true, slug, itemsPersisted: cleanItems.length, error: null };
  } catch (e) {
    console.warn(
      "[agentInbound] persist failed:",
      e instanceof Error ? e.message : e,
    );
    return { ok: false, slug, itemsPersisted: 0, error: "persist_failed" };
  }
}

function buildNarrative(
  connectorSlug: string,
  scanType: ScanType,
  itemCount: number,
  severityCounts: Record<string, number>,
): string {
  const parts: string[] = [];
  parts.push(`On-prem agent scan: ${connectorSlug} · ${scanType} · ${itemCount} item${itemCount === 1 ? "" : "s"}.`);
  if (scanType === "compliance_findings") {
    const sevSummary: string[] = [];
    for (const k of ["critical", "high", "medium", "low", "info"]) {
      if (severityCounts[k] > 0) sevSummary.push(`${severityCounts[k]} ${k}`);
    }
    if (sevSummary.length > 0) parts.push(`Severity: ${sevSummary.join(" · ")}.`);
  }
  return parts.join(" ");
}
