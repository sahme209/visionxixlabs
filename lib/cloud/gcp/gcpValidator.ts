/**
 * GCP connection validator. Validates input shape + parses the service
 * account JSON without logging it.
 *
 * Live SDK calls are behind a feature flag for the next milestone.
 *
 * Server-only.
 */

import "server-only";
import { requireGcpProjectId } from "@/lib/security/validation";
import { isAxiomError } from "@/lib/errors/axiomErrors";
import type { GcpConnectionInput, GcpConnectionStatus } from "./gcpConnection";

export type GcpValidationOutcome =
  | "valid_live"
  | "valid_format_only"
  | "invalid_format"
  | "invalid_service_account_json"
  | "permission_denied"
  | "live_disabled";

export interface GcpValidationResult {
  ok: boolean;
  outcome: GcpValidationOutcome;
  status: GcpConnectionStatus;
  validatedProjectId?: string;
  message: string;
  errorCode?: string;
  mode: "live" | "preview" | "expanding";
}

export interface GcpValidateInput {
  input: GcpConnectionInput;
  requestLive: boolean;
}

export async function validateGcpConnection(opts: GcpValidateInput): Promise<GcpValidationResult> {
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
    };
  }

  // Validate the service account JSON shape *without* logging its contents.
  if (opts.input.serviceAccountKeyJson) {
    try {
      const parsed = JSON.parse(opts.input.serviceAccountKeyJson) as Record<string, unknown>;
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
      // Validate project id in JSON matches input.
      if (typeof parsed.project_id === "string" && parsed.project_id !== opts.input.projectId) {
        return {
          ok: false,
          outcome: "invalid_service_account_json",
          status: "validation_failed",
          message: "Service account JSON project_id does not match the input projectId.",
          errorCode: "gcp.project_id_mismatch",
          mode: "expanding",
        };
      }
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

  if (opts.requestLive) {
    return {
      ok: true,
      outcome: "live_disabled",
      status: "validating",
      message:
        "GCP input is well-formed. Live GCP validation is in the expanding tier — adapter ships " +
        "once the host configures the GCP connector SDK pipeline.",
      mode: "expanding",
    };
  }

  return {
    ok: true,
    outcome: "valid_format_only",
    status: "validating",
    validatedProjectId: opts.input.projectId,
    message: "GCP input format validated. Live validation runs when the scan is started.",
    mode: "preview",
  };
}
