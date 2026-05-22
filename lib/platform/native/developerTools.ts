/**
 * Developer Tooling — typed models.
 *
 * Foundation for the engineer-facing integration layer: IDE extensions,
 * CLI installations, local-repo bridge connections, agent tool access,
 * and per-tool usage. Pure types — persistence lands in a follow-up
 * Prisma migration so the schema stays under explicit review.
 */

import type { OrganizationId, UserId } from "@/lib/domain/ids";

// ---------------------------------------------------------------------------
// Tool taxonomy
// ---------------------------------------------------------------------------

export type DeveloperToolKind =
  | "vscode_extension"
  | "jetbrains_plugin"
  | "cli"
  | "desktop_app"
  | "local_repo_bridge"
  | "pipeline_helper"
  | "terraform_helper"
  | "docker_helper"
  | "kubernetes_helper";

export type ToolStatus =
  | "available"
  | "connected"
  | "not_connected"
  | "coming_soon"
  | "requires_desktop_app"
  | "requires_admin_approval"
  | "setup_incomplete";

export type SupportedOs = "macos" | "windows" | "linux";

export interface DeveloperToolIntegration {
  organizationId: OrganizationId;
  /** Stable id within this workspace. */
  id: string;
  kind: DeveloperToolKind;
  /** Human-readable label. */
  name: string;
  status: ToolStatus;
  /** Operating systems this tool is shipped for. */
  supportedOs: readonly SupportedOs[];
  /** Brief operator-readable purpose. */
  purpose: string;
  /** Required workspace permissions before this tool can run. */
  requiredPermissions: readonly string[];
  /** Agent ids that this tool exposes. */
  connectedAgentIds: readonly string[];
  /** ISO timestamps. */
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Session models — represent a live connection from an editor / cli / agent
// ---------------------------------------------------------------------------

export interface ExtensionSession {
  organizationId: OrganizationId;
  id: string;
  userId: UserId;
  /** "vscode" | "jetbrains" etc. */
  kind: "vscode" | "jetbrains";
  /** Workspace folder paths the user has explicitly approved. */
  approvedWorkspacePaths: readonly string[];
  /** OS reported by the extension. */
  os: SupportedOs;
  /** Extension version. */
  version: string;
  /** ISO timestamp of pairing. */
  pairedAt: string;
  /** ISO timestamp of most recent ping. */
  lastSeenAt: string;
  /** Pairing fingerprint (sha256 of device+version+nonce). */
  fingerprint: string;
}

export interface CLISession {
  organizationId: OrganizationId;
  id: string;
  userId: UserId;
  /** Hostname reported by the CLI. */
  hostname: string;
  os: SupportedOs;
  /** CLI version string. */
  version: string;
  /** Last command kind (status / connect / agent-ask / scan / etc.). Closed-union enforced at the boundary. */
  lastCommand?: string;
  pairedAt: string;
  lastSeenAt: string;
}

export interface LocalRepoConnection {
  organizationId: OrganizationId;
  id: string;
  /** Maps to an ExtensionSession or CLISession or DesktopSession. */
  sessionId: string;
  /** Local repo path — never sent without user approval. */
  localPath: string;
  /** Detected remote (e.g. github.com/sahme209/platform). */
  remote?: string;
  /** Detected default branch. */
  defaultBranch?: string;
  /** Closed-union scan-permission state. */
  scanScope: "selected_only" | "workspace_folder" | "full_repo" | "denied";
  approvedAt?: string;
}

// ---------------------------------------------------------------------------
// Agent tool access — closed-union of capabilities per agent
// ---------------------------------------------------------------------------

export type AgentToolPermission = "allowed" | "approval_required" | "blocked";

export interface AgentToolCapability {
  /** Action label rendered in the matrix UI. */
  action: string;
  read: AgentToolPermission;
  write: AgentToolPermission;
  /** Risk band — drives the UI tint and decides approval policy. */
  risk: "low" | "medium" | "high" | "critical";
  /** Whether the action requires the desktop app for safe local execution. */
  requiresDesktopApp: boolean;
}

export interface AgentToolAccess {
  organizationId: OrganizationId;
  agentId: string;
  /** Human-readable agent name. */
  agentName: string;
  /** Role label — "developer", "devops", "security", etc. */
  role: string;
  /** Per-tool capabilities. */
  perTool: ReadonlyArray<{
    toolKind: DeveloperToolKind;
    capabilities: readonly AgentToolCapability[];
  }>;
  /** Workspace scope this access matrix applies to. */
  workspaceScope: "this_workspace_only" | "all_workspaces_under_org";
  /** ISO timestamp of last sensitive use. */
  lastUsedAt?: string;
  /** Operator who supervises this agent — required by policy. */
  humanSupervisorUserId?: UserId;
}

export interface AgentToolUsage {
  organizationId: OrganizationId;
  agentId: string;
  toolKind: DeveloperToolKind;
  /** Closed-union of high-level operations. */
  operation: "read_context" | "scan" | "draft_change" | "execute" | "explain";
  /** Outcome verdict. */
  outcome: "success" | "blocked" | "awaiting_approval" | "failed";
  occurredAt: string;
  /** Optional correlation id stitching this usage into the audit fabric. */
  correlationId?: string;
}
