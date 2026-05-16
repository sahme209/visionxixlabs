/**
 * GCP connection validator.
 *
 * Format validation always runs (cheap, deterministic). Live mode attempts
 * a `@google-cloud/resource-manager` ProjectsClient call to confirm the
 * service account can read the project metadata. The SDK accepts a
 * `service_account` JSON key directly so we never persist a separate auth
 * library.
 *
 * Honest fallback: when the SDK isn't reachable (dynamic import fails, or
 * credentials are missing on the host) we return a typed `live_disabled`
 * outcome with `missingRequirements` rather than fabricating success.
 *
 * Server-only.
 */

import "server-only";
import { requireGcpProjectId } from "@/lib/security/validation";
import { isAxiomError } from "@/lib/errors/axiomErrors";
import type { GcpConnectionInput, GcpConnectionStatus } from "./gcpConnection";
import {
  getGcpConfig,
  resolveGcpClientEmail,
  resolveGcpPrivateKey,
  resolveGcpServiceAccountJson,
} from "./gcpConfig";

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

const LIVE_CALL_TIMEOUT_MS = 8_000;

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

  // 4) Live requested but credentials missing.
  if (opts.requestLive && cfg.mode !== "live") {
    return {
      ok: true,
      outcome: "live_disabled",
      status: "validating",
      message: "GCP input is well-formed. Live validation requires host-side service account credentials.",
      mode: cfg.mode,
      missingRequirements: listMissingGcpEnv(),
      safeNextAction: { label: "Open GCP setup", href: "/docs/gcp-setup" },
    };
  }

  // 5) Live call.
  if (opts.requestLive) {
    return await runLiveValidation(opts);
  }

  // 6) Format-only path.
  return {
    ok: true,
    outcome: "valid_format_only",
    status: "validating",
    validatedProjectId: opts.input.projectId,
    message: "GCP input format validated. Live validation runs when the scan is started.",
    mode: cfg.mode,
  };
}

// ---------------------------------------------------------------------------
// Live SDK call
// ---------------------------------------------------------------------------

async function runLiveValidation(opts: GcpValidateInput): Promise<GcpValidationResult> {
  const credentials = resolveCredentialBlob();
  if (!credentials) {
    return {
      ok: false,
      outcome: "auth_failure",
      status: "validation_failed",
      message: "GCP live validation requires GCP_SERVICE_ACCOUNT_JSON or (GCP_CLIENT_EMAIL + GCP_PRIVATE_KEY) on the host.",
      errorCode: "gcp.no_credentials",
      mode: "expanding",
      missingRequirements: listMissingGcpEnv(),
    };
  }

  try {
    const mod: unknown = await import("@google-cloud/resource-manager").catch(() => undefined);
    if (!mod || typeof mod !== "object" || !("ProjectsClient" in mod)) {
      return {
        ok: false,
        outcome: "live_disabled",
        status: "validating",
        message: "@google-cloud/resource-manager not installed on the deployment — falling back to format validation.",
        errorCode: "gcp.sdk_missing",
        mode: "expanding",
        limitations: ["@google-cloud/resource-manager unavailable at runtime."],
        safeNextAction: { label: "Open GCP setup", href: "/docs/gcp-setup" },
      };
    }
    const { ProjectsClient } = mod as { ProjectsClient: new (opts: unknown) => { getProject: (req: { name: string }) => Promise<unknown[]> } };

    const client = new ProjectsClient({
      credentials,
      projectId: opts.input.projectId,
    });

    const response = await withTimeout(
      client.getProject({ name: `projects/${opts.input.projectId}` }),
      LIVE_CALL_TIMEOUT_MS,
      "projects.get",
    );

    const project = Array.isArray(response) ? (response[0] as { displayName?: string; projectId?: string } | undefined) : undefined;

    return {
      ok: true,
      outcome: "valid_live",
      status: "connected",
      validatedProjectId: project?.projectId ?? opts.input.projectId,
      projectDisplayName: project?.displayName,
      serviceAccountEmail: credentials.client_email,
      message: `Validated GCP project ${project?.displayName ?? project?.projectId ?? opts.input.projectId}.`,
      mode: "live",
    };
  } catch (err) {
    return classifyGcpError(err, opts);
  }
}

function classifyGcpError(err: unknown, opts: GcpValidateInput): GcpValidationResult {
  const code = errCode(err);
  const message = errMessage(err);

  // gRPC permission denied is code 7, NOT_FOUND is 5, UNAUTHENTICATED is 16
  if (code === "7" || /PERMISSION_DENIED/i.test(message)) {
    return failure(opts, "permission_denied", "Service account lacks read permission on the project.", "gcp.access_denied");
  }
  if (code === "16" || /UNAUTHENTICATED|invalid_grant/i.test(message)) {
    return failure(opts, "auth_failure", "GCP rejected the service account credentials.", "gcp.bad_credentials");
  }
  if (code === "5" || /NOT_FOUND/i.test(message)) {
    return failure(opts, "not_found", `Project ${opts.input.projectId} was not found.`, "gcp.project_not_found");
  }
  if (/ENOTFOUND|ECONNREFUSED|timeout|UNAVAILABLE/i.test(message)) {
    return failure(opts, "network", "Network error reaching Google Cloud Resource Manager.", "gcp.network");
  }
  return failure(opts, "auth_failure", `GCP validation failed: ${redact(message)}`, "gcp.live_failed");
}

function failure(opts: GcpValidateInput, outcome: GcpValidationOutcome, message: string, errorCode: string): GcpValidationResult {
  return {
    ok: false,
    outcome,
    status: outcome === "permission_denied" ? "permission_denied" : "validation_failed",
    message,
    errorCode,
    mode: "live",
    validatedProjectId: opts.input.projectId,
  };
}

// ---------------------------------------------------------------------------
// Credential resolution
// ---------------------------------------------------------------------------

interface GcpCredentialBlob {
  client_email: string;
  private_key: string;
}

function resolveCredentialBlob(): GcpCredentialBlob | undefined {
  // JSON blob takes precedence (matches how cloud functions typically inject).
  const json = resolveGcpServiceAccountJson();
  if (json) {
    try {
      const parsed = JSON.parse(json) as Record<string, unknown>;
      if (typeof parsed.client_email === "string" && typeof parsed.private_key === "string") {
        return { client_email: parsed.client_email, private_key: parsed.private_key };
      }
    } catch {
      return undefined;
    }
  }
  const email = resolveGcpClientEmail();
  const key   = resolveGcpPrivateKey();
  if (email && key) {
    return {
      client_email: email,
      // Common deployment gotcha: `\n` literal in env values needs unescaping.
      private_key: key.replace(/\\n/g, "\n"),
    };
  }
  return undefined;
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function listMissingGcpEnv(): string[] {
  const e = process.env;
  const missing: string[] = [];
  if (!e.GCP_PROJECT_ID) missing.push("GCP_PROJECT_ID");
  const hasSplit = e.GCP_CLIENT_EMAIL && e.GCP_PRIVATE_KEY;
  const hasJson  = e.GCP_SERVICE_ACCOUNT_JSON;
  if (!hasSplit && !hasJson) {
    missing.push("GCP_SERVICE_ACCOUNT_JSON  *or*  (GCP_CLIENT_EMAIL + GCP_PRIVATE_KEY)");
  }
  return missing;
}

function errCode(err: unknown): string | undefined {
  if (err && typeof err === "object") {
    if ("code" in err) return String((err as { code?: unknown }).code);
    if ("name" in err) return String((err as { name?: string }).name);
  }
  return undefined;
}

function errMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

function redact(s: string): string {
  return s
    .replace(/-----BEGIN [A-Z ]+-----[\s\S]+?-----END [A-Z ]+-----/g, "-----PRIVATE KEY REDACTED-----")
    .replace(/[a-z0-9-]+@[a-z0-9-]+\.iam\.gserviceaccount\.com/gi, "***@***.iam.gserviceaccount.com");
}

function withTimeout<T>(p: Promise<T>, ms: number, op: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${op} timed out after ${ms}ms`)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}
