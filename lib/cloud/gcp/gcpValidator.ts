/**
 * Format validation for caller-selected GCP projects. Live validation remains
 * unavailable until a tenant-owned, project-bound authorization path exists.
 * Host credentials are never substituted for a caller's submitted identity.
 */

import "server-only";
import { requireGcpProjectId } from "@/lib/security/validation";
import { isAxiomError } from "@/lib/errors/axiomErrors";
import type { GcpConnectionInput, GcpConnectionStatus } from "./gcpConnection";
import { getGcpConfig } from "./gcpConfig";

export type GcpValidationOutcome =
  | "valid_live"
  | "valid_format_only"
  | "invalid_format"
  | "invalid_service_account_json"
  | "permission_denied"
  | "auth_failure"
  | "not_found"
  | "network"
  | "live_disabled";

export interface GcpValidationResult {
  ok: boolean;
  outcome: GcpValidationOutcome;
  status: GcpConnectionStatus;
  validatedProjectId?: string;
  projectDisplayName?: string;
  /** The service account email actually used for the live call (never the key). */
  serviceAccountEmail?: string;
  message: string;
  errorCode?: string;
  mode: "live" | "preview" | "expanding";
  /** Honest hints about what's missing for live mode. */
  missingRequirements?: string[];
  /** UI-surfaced limitations (e.g. missing SDK). */
  limitations?: string[];
  /** Safe action label. */
  safeNextAction?: { label: string; href: string };
}

export interface GcpValidateInput {
  input: GcpConnectionInput;
  requestLive: boolean;
}

export async function validateGcpConnection(opts: GcpValidateInput): Promise<GcpValidationResult> {
  // 1) Project id format
  try {
    requireGcpProjectId(opts.input.projectId);
  } catch (err) {
    return {
      ok: false,
      outcome: "invalid_format",
      status: "validation_failed",
      message: isAxiomError(err) ? err.userMessage : "GCP input is malformed.",
      errorCode: isAxiomError(err) ? err.code : "validation.malformed",
      mode: "expanding",
      safeNextAction: { label: "Open GCP setup", href: "/docs/gcp-setup" },
    };
  }

  // 2) Service account JSON shape (optional input, never logged).
  if (opts.input.serviceAccountKeyJson) {
    const jsonCheck = validateServiceAccountJson(opts.input.serviceAccountKeyJson, opts.input.projectId);
    if (!jsonCheck.ok) return jsonCheck;
  }

  const cfg = getGcpConfig();

  // 3) Live disabled at deployment level.
  if (cfg.mode === "disabled") {
    return {
      ok: true,
      outcome: "live_disabled",
      status: "not_configured",
      message: "GCP is disabled on this deployment (GCP_SCAN_MODE=disabled).",
      mode: "expanding",
      limitations: ["GCP_SCAN_MODE is set to disabled."],
      safeNextAction: { label: "Open GCP setup", href: "/docs/gcp-setup" },
    };
  }

  // Deployment credentials and submitted JSON shape are not tenant authority.
  // Fail closed rather than reading an arbitrary project with the host identity.
  if (opts.requestLive) {
    return {
      ok: false,
      outcome: "live_disabled",
      status: "not_configured",
      message: "GCP input is well-formed. Live validation needs a verified workspace connection for this project.",
      errorCode: "gcp.tenant_connection_required",
      mode: "expanding",
      missingRequirements: ["A verified tenant-owned GCP connection bound to the selected project."],
      limitations: ["Format validation does not verify project access. Host credentials are not used for customer-selected projects."],
      safeNextAction: { label: "Open GCP setup", href: "/docs/gcp-setup" },
    };
  }

  // 6) Format-only path.
  return {
    ok: true,
    outcome: "valid_format_only",
    status: "validating",
    validatedProjectId: opts.input.projectId,
    message: "GCP input format validated. No live connection or project access has been verified.",
    mode: cfg.mode,
  };
}

function validateServiceAccountJson(rawJson: string, expectedProjectId: string): GcpValidationResult {
  try {
    const parsed = JSON.parse(rawJson) as Record<string, unknown>;
    const required = ["type", "project_id", "private_key", "client_email", "private_key_id"];
    const missing = required.filter((k) => typeof parsed[k] !== "string");
    if (parsed.type !== "service_account" || missing.length > 0) {
      return {
        ok: false,
        outcome: "invalid_service_account_json",
        status: "validation_failed",
        message: `Service account JSON missing required fields: ${missing.join(", ")}.`,
        errorCode: "gcp.invalid_service_account_json",
        mode: "expanding",
      };
    }
    if (typeof parsed.project_id === "string" && parsed.project_id !== expectedProjectId) {
      return {
        ok: false,
        outcome: "invalid_service_account_json",
        status: "validation_failed",
        message: "Service account JSON project_id does not match the input projectId.",
        errorCode: "gcp.project_id_mismatch",
        mode: "expanding",
      };
    }
    return { ok: true, outcome: "valid_format_only", status: "validating", message: "Service account JSON shape valid.", mode: "preview" };
  } catch {
    return {
      ok: false,
      outcome: "invalid_service_account_json",
      status: "validation_failed",
      message: "Service account JSON could not be parsed.",
      errorCode: "gcp.json_parse_failed",
      mode: "expanding",
    };
  }
}
