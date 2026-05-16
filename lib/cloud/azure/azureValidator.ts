/**
 * Azure connection validator.
 *
 * Format validation always runs (cheap, deterministic). Live mode runs a
 * `@azure/identity` ClientSecretCredential.getToken() (fully validates
 * tenant + client + secret against AAD) then calls the ARM REST API
 * `GET /subscriptions/{id}?api-version=2020-01-01` to confirm the
 * service principal has read access. SDK-version-agnostic — no
 * dependency on `arm-subscriptions` operation names.
 *
 * Live mode requires:
 *   - the feature flag says Azure live mode is allowed,
 *   - tenant + client + secret + subscription are set on the host env,
 *   - the user explicitly requested a live validation.
 *
 * Errors are classified into a typed outcome — `invalid_format`,
 * `permission_denied`, `auth_failure`, `not_found`, `network`, `other`.
 * Secrets never leave the module.
 *
 * Server-only.
 */

import "server-only";
import {
  requireAzureTenantId,
  requireAzureSubscriptionId,
} from "@/lib/security/validation";
import { isAxiomError } from "@/lib/errors/axiomErrors";
import type { AzureConnectionInput, AzureConnectionStatus } from "./azureConnection";
import { getAzureConfig, resolveAzureClientId, resolveAzureClientSecret } from "./azureConfig";

export type AzureValidationOutcome =
  | "valid_live"
  | "valid_format_only"
  | "invalid_format"
  | "permission_denied"
  | "auth_failure"
  | "not_found"
  | "network"
  | "live_disabled";

export interface AzureValidationResult {
  ok: boolean;
  outcome: AzureValidationOutcome;
  status: AzureConnectionStatus;
  validatedTenantId?: string;
  validatedSubscriptionId?: string;
  subscriptionDisplayName?: string;
  message: string;
  errorCode?: string;
  mode: "live" | "preview" | "expanding";
  /** Honest hints about what's missing for live mode. */
  missingRequirements?: string[];
  /** Limitations the caller should surface in UI. */
  limitations?: string[];
  /** A safe action label the UI can render. */
  safeNextAction?: { label: string; href: string };
}

export interface AzureValidateInput {
  input: AzureConnectionInput;
  requestLive: boolean;
}

const LIVE_CALL_TIMEOUT_MS = 8_000;

export async function validateAzureConnection(opts: AzureValidateInput): Promise<AzureValidationResult> {
  // 1) Format validation — always runs.
  try {
    requireAzureTenantId(opts.input.tenantId);
    requireAzureSubscriptionId(opts.input.subscriptionId);
  } catch (err) {
    return {
      ok: false,
      outcome: "invalid_format",
      status: "validation_failed",
      message: isAxiomError(err) ? err.userMessage : "Azure input is malformed.",
      errorCode: isAxiomError(err) ? err.code : "validation.malformed",
      mode: "expanding",
      safeNextAction: { label: "Open Azure setup", href: "/docs/azure-setup" },
    };
  }

  const cfg = getAzureConfig();

  // 2) Live mode disabled at the deployment level.
  if (cfg.mode === "disabled") {
    return {
      ok: true,
      outcome: "live_disabled",
      status: "not_configured",
      message: "Azure is disabled on this deployment (AZURE_SCAN_MODE=disabled).",
      mode: "expanding",
      limitations: ["AZURE_SCAN_MODE is set to disabled."],
      safeNextAction: { label: "Open Azure setup", href: "/docs/azure-setup" },
    };
  }

  // 3) Live requested but credentials not configured.
  if (opts.requestLive && cfg.mode !== "live") {
    const missing = listMissingAzureEnv();
    return {
      ok: true,
      outcome: "live_disabled",
      status: "validating",
      message: "Azure input is well-formed. Live validation requires host-side service principal credentials.",
      mode: cfg.mode,
      missingRequirements: missing,
      safeNextAction: { label: "Open Azure setup", href: "/docs/azure-setup" },
    };
  }

  // 4) Live call.
  if (opts.requestLive) {
    return await runLiveValidation(opts);
  }

  // 5) Format-only path.
  return {
    ok: true,
    outcome: "valid_format_only",
    status: "validating",
    message: "Azure input format validated. Live validation runs when the scan is started.",
    mode: cfg.mode,
    validatedTenantId: opts.input.tenantId,
    validatedSubscriptionId: opts.input.subscriptionId,
  };
}

// ---------------------------------------------------------------------------
// Live SDK call — dynamic import so non-Azure deployments don't pay the cost.
// ---------------------------------------------------------------------------

async function runLiveValidation(opts: AzureValidateInput): Promise<AzureValidationResult> {
  const clientId = resolveAzureClientId();
  const clientSecret = resolveAzureClientSecret();
  if (!clientId || !clientSecret) {
    return {
      ok: false,
      outcome: "auth_failure",
      status: "validation_failed",
      message: "Azure live validation requires AZURE_CLIENT_ID + AZURE_CLIENT_SECRET on the host.",
      errorCode: "azure.no_credentials",
      mode: "expanding",
      missingRequirements: listMissingAzureEnv(),
    };
  }

  try {
    const { ClientSecretCredential } = await import("@azure/identity");
    const credential = new ClientSecretCredential(opts.input.tenantId, clientId, clientSecret);

    // Step 1: acquire a token. Fully validates tenant + client + secret against AAD.
    const tokenResponse = await withTimeout(
      credential.getToken("https://management.azure.com/.default"),
      LIVE_CALL_TIMEOUT_MS,
      "credential.getToken",
    );
    if (!tokenResponse?.token) {
      return failure(opts, "auth_failure", "Azure credential returned no token.", "azure.no_token");
    }

    // Step 2: confirm the service principal can read the subscription.
    // Direct ARM REST call — SDK-version-agnostic.
    const subRes = await withTimeout(
      fetch(`https://management.azure.com/subscriptions/${encodeURIComponent(opts.input.subscriptionId)}?api-version=2020-01-01`, {
        headers: { Authorization: `Bearer ${tokenResponse.token}` },
      }),
      LIVE_CALL_TIMEOUT_MS,
      "arm.subscription.get",
    );

    if (subRes.status === 401 || subRes.status === 403) {
      return failure(
        opts,
        "permission_denied",
        "Service principal lacks read permission on the subscription (assign Reader at subscription scope).",
        "azure.access_denied",
      );
    }
    if (subRes.status === 404) {
      return failure(opts, "not_found", "Subscription was not found.", "azure.subscription_not_found");
    }
    if (!subRes.ok) {
      return failure(opts, "auth_failure", `ARM returned HTTP ${subRes.status}.`, "azure.arm_error");
    }

    const sub = (await subRes.json().catch(() => ({}))) as { subscriptionId?: string; displayName?: string };

    return {
      ok: true,
      outcome: "valid_live",
      status: "connected",
      validatedTenantId: opts.input.tenantId,
      validatedSubscriptionId: sub.subscriptionId ?? opts.input.subscriptionId,
      subscriptionDisplayName: sub.displayName,
      message: `Validated Azure subscription ${sub.displayName ?? sub.subscriptionId ?? opts.input.subscriptionId}.`,
      mode: "live",
    };
  } catch (err) {
    return classifyAzureError(err, opts);
  }
}

function classifyAzureError(err: unknown, opts: AzureValidateInput): AzureValidationResult {
  const code = errCode(err);
  const message = errMessage(err);

  if (code === "AADSTS7000215" || /invalid_client/i.test(message)) {
    return failure(opts, "auth_failure", "Azure rejected the client secret.", "azure.bad_secret");
  }
  if (code === "AADSTS90002" || code === "AADSTS50059" || /tenant/i.test(message)) {
    return failure(opts, "auth_failure", "Azure tenant id is invalid or the application is not registered there.", "azure.bad_tenant");
  }
  if (code === "AuthorizationFailed" || /AuthorizationFailed/i.test(message)) {
    return failure(opts, "permission_denied", "Service principal lacks read permission on the subscription.", "azure.access_denied");
  }
  if (code === "SubscriptionNotFound" || /not\s*found/i.test(message)) {
    return failure(opts, "not_found", "Subscription was not found.", "azure.subscription_not_found");
  }
  if (/ENOTFOUND|ECONNREFUSED|timeout/i.test(message)) {
    return failure(opts, "network", "Network error reaching Azure Management API.", "azure.network");
  }
  return failure(opts, "auth_failure", `Azure validation failed: ${redact(message)}`, "azure.live_failed");
}

function failure(opts: AzureValidateInput, outcome: AzureValidationOutcome, message: string, errorCode: string): AzureValidationResult {
  return {
    ok: false,
    outcome,
    status: outcome === "permission_denied" ? "permission_denied" : "validation_failed",
    message,
    errorCode,
    mode: "live",
    validatedTenantId: opts.input.tenantId,
    validatedSubscriptionId: opts.input.subscriptionId,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function listMissingAzureEnv(): string[] {
  const e = process.env;
  const missing: string[] = [];
  if (!e.AZURE_TENANT_ID)       missing.push("AZURE_TENANT_ID");
  if (!e.AZURE_CLIENT_ID)       missing.push("AZURE_CLIENT_ID");
  if (!e.AZURE_CLIENT_SECRET)   missing.push("AZURE_CLIENT_SECRET");
  if (!e.AZURE_SUBSCRIPTION_ID) missing.push("AZURE_SUBSCRIPTION_ID");
  return missing;
}

function errCode(err: unknown): string | undefined {
  if (err && typeof err === "object") {
    if ("code" in err) return String((err as { code?: string }).code);
    if ("errorCode" in err) return String((err as { errorCode?: string }).errorCode);
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
    .replace(/[0-9a-fA-F-]{36}/g, "***-uuid-***")
    .replace(/AZURE_CLIENT_SECRET=\S+/g, "AZURE_CLIENT_SECRET=***");
}

function withTimeout<T>(p: Promise<T>, ms: number, op: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${op} timed out after ${ms}ms`)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}
