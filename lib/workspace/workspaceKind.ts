/**
 * Workspace-kind closed-union + isolation kernel — Phase 405.
 *
 * The platform now serves three distinct workspace contexts:
 *
 *   - "real"      — paying customer workspace. Real data, real
 *                   credentials, real billing. NEVER show demo data.
 *   - "sandbox"   — shared "/demo" workspace for prospects + new
 *                   users. Pre-populated with realistic mock data so
 *                   they can explore the platform without connecting
 *                   anything. NEVER drains real billing.
 *   - "internal"  — VisionXIXLabs's own admin/eval workspace
 *                   (ws_internal_admin_visionxixlabs). Used by the
 *                   eval cron + internal coding pipelines.
 *
 * Why a closed-union here:
 *   - assertNotDemoLeak() enforces "no demo data in real workspace"
 *     at the data-access layer. Any code touching workspace-scoped
 *     data should run through this kernel BEFORE rendering or saving.
 *   - One pure function decides the mode based on the workspace id;
 *     no DB lookup needed (id prefixes carry the kind).
 *
 * Pure / deterministic. No I/O.
 */

export type WorkspaceKind = "real" | "sandbox" | "internal";

/**
 * Resolve workspace-kind from the organizationId. Three known prefixes:
 *
 *   ws_sandbox_*           → "sandbox"  (demo/explore workspaces)
 *   ws_internal_*          → "internal" (VisionXIXLabs internal)
 *   * (anything else)      → "real"
 *
 * The kernel is deliberately conservative: anything NOT explicitly
 * marked sandbox/internal is treated as real, so accidentally-misnamed
 * workspaces can't fall through to demo behavior. Better to over-treat
 * as real than over-treat as demo.
 */
export function resolveWorkspaceKind(organizationId: string): WorkspaceKind {
  if (organizationId.startsWith("ws_sandbox_")) return "sandbox";
  if (organizationId.startsWith("ws_internal_")) return "internal";
  return "real";
}

/** True iff this workspace is the public sandbox/demo. */
export function isSandboxWorkspace(organizationId: string): boolean {
  return resolveWorkspaceKind(organizationId) === "sandbox";
}

/** True iff this workspace is a real paying customer. */
export function isRealWorkspace(organizationId: string): boolean {
  return resolveWorkspaceKind(organizationId) === "real";
}

/**
 * Throws when called with a real-workspace id from code that intends
 * to return demo data. Use this at every data-access boundary that
 * may render demo content:
 *
 *   if (showDemoData) assertNotDemoLeak(organizationId, "DashboardDemoCards");
 *
 * Phase 405 living-docs rule: when adding ANY new demo-data path,
 * call this guard at the entry point. The `surfaceName` shows up in
 * the audit trail if the assertion fires.
 */
export class DemoLeakError extends Error {
  readonly organizationId: string;
  readonly surfaceName: string;
  constructor(organizationId: string, surfaceName: string) {
    super(
      `Demo-data leak prevented: workspace "${organizationId}" is real but ` +
      `surface "${surfaceName}" tried to render demo content. ` +
      `Wrap the demo path in isSandboxWorkspace(orgId) === true.`,
    );
    this.name = "DemoLeakError";
    this.organizationId = organizationId;
    this.surfaceName = surfaceName;
  }
}

export function assertNotDemoLeak(organizationId: string, surfaceName: string): void {
  if (resolveWorkspaceKind(organizationId) === "real") {
    throw new DemoLeakError(organizationId, surfaceName);
  }
}

/**
 * Operator-readable description of the workspace kind. Used by the
 * portal's "you are in: [REAL / SANDBOX / INTERNAL]" badge so users
 * always know which context they're acting in.
 */
export function workspaceKindLabel(kind: WorkspaceKind): {
  label: string;
  tone: "real" | "sandbox" | "internal";
  description: string;
} {
  switch (kind) {
    case "real":
      return {
        label: "Live workspace",
        tone: "real",
        description: "Real data + real billing. Every action you take here affects production.",
      };
    case "sandbox":
      return {
        label: "Sandbox · demo data",
        tone: "sandbox",
        description: "Shared explore workspace. Everything here is example data; nothing is billed.",
      };
    case "internal":
      return {
        label: "Internal · VisionXIXLabs",
        tone: "internal",
        description: "Platform-internal workspace for evals + the team's own coding pipeline.",
      };
  }
}

/** Canonical sandbox workspace id. */
export const SANDBOX_WORKSPACE_ID = "ws_sandbox_public_demo";
