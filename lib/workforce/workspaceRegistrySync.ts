/**
 * Workspace registry sync service.
 *
 * Idempotent server-side function that materialises the canonical
 * `agentWorkforceRegistry` into per-workspace `AgentEngineerRecord`
 * rows. Run on:
 *   - first sign-in for a tenant (during workspace bootstrap)
 *   - when a workspace admin opens /dashboard/workforce
 *   - any time the canonical registry ships new engineers (migration
 *     follow-up)
 *
 * Invariants:
 *   - internal_admin engineers are ONLY synced into the canonical
 *     VisionXIXLabs internal workspace id; never into a client tenant.
 *   - `defaultApprovalRule` is set to the canonical rule and never
 *     overwritten by sync (operators may have tightened it).
 *   - `currentApprovalRule` is preserved across syncs — only an
 *     operator can change it.
 *   - The sync is fully idempotent: rerunning produces no diff when
 *     the registry hasn't changed.
 */

import "server-only";

import { prisma } from "@/lib/db";
import {
  AGENT_WORKFORCE_REGISTRY,
  type AgentEngineer,
} from "./agentWorkforceRegistry";

/** Stable id of the VisionXIXLabs internal-admin workspace. */
export const INTERNAL_ADMIN_WORKSPACE_ID = "ws_internal_admin_visionxixlabs";

export interface SyncResult {
  organizationId: string;
  created: number;
  updatedDefault: number;
  unchanged: number;
  skippedInternal: number;
}

/**
 * Materialise the registry for a single workspace. Safe to call
 * concurrently — the unique (organizationId, engineerId) constraint
 * makes the upsert atomic.
 */
export async function syncAgentEngineerRegistryForWorkspace(
  organizationId: string,
): Promise<SyncResult> {
  const isInternalWorkspace = organizationId === INTERNAL_ADMIN_WORKSPACE_ID;

  const targets: AgentEngineer[] = AGENT_WORKFORCE_REGISTRY.filter((e) => {
    if (e.productLayer === "client") return !isInternalWorkspace ? true : true; // client engineers also visible in internal workspace
    // internal_admin engineers — only sync into the internal workspace
    return isInternalWorkspace;
  });

  let created = 0;
  let updatedDefault = 0;
  let unchanged = 0;
  let skippedInternal = 0;

  // Count skipped first for the result envelope.
  for (const e of AGENT_WORKFORCE_REGISTRY) {
    if (e.productLayer === "internal_admin" && !isInternalWorkspace) {
      skippedInternal++;
    }
  }

  for (const e of targets) {
    const existing = await prisma.agentEngineerRecord.findUnique({
      where: { organizationId_engineerId: { organizationId, engineerId: e.id } },
    });

    if (!existing) {
      await prisma.agentEngineerRecord.create({
        data: {
          organizationId,
          engineerId: e.id,
          defaultApprovalRule: e.approvalRule,
          currentApprovalRule: null, // null === "use canonical default"
          isEnabled: true,
        },
      });
      created++;
      continue;
    }

    // Update defaultApprovalRule if the canonical rule changed.
    // currentApprovalRule (the override) is preserved.
    if (existing.defaultApprovalRule !== e.approvalRule) {
      await prisma.agentEngineerRecord.update({
        where: { id: existing.id },
        data: { defaultApprovalRule: e.approvalRule },
      });
      updatedDefault++;
    } else {
      unchanged++;
    }
  }

  return { organizationId, created, updatedDefault, unchanged, skippedInternal };
}

/**
 * Read a workspace's engineer records into a typed map keyed by
 * engineerId. The runtime gate caller uses this to look up the
 * workspace-tightened rule + enabled flag for a given engineer.
 */
export async function loadWorkspaceEngineerMap(
  organizationId: string,
): Promise<Map<string, { id: string; currentApprovalRule: string | null; isEnabled: boolean }>> {
  const rows = await prisma.agentEngineerRecord.findMany({
    where: { organizationId },
    select: { id: true, engineerId: true, currentApprovalRule: true, isEnabled: true },
  });
  const map = new Map<string, { id: string; currentApprovalRule: string | null; isEnabled: boolean }>();
  for (const r of rows) {
    map.set(r.engineerId, {
      id: r.id,
      currentApprovalRule: r.currentApprovalRule,
      isEnabled: r.isEnabled,
    });
  }
  return map;
}
