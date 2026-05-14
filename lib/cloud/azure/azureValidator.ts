/**
 * Azure connection validator.
 *
 * Pure-shape validation today — live SDK calls (`@azure/identity` +
 * `@azure/arm-subscriptions`) are wired behind a feature flag for the
 * upcoming production milestone. Until then the validator confirms the
 * input shape and returns a typed `valid_format_only` outcome instead of
 * fabricating success.
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

export type AzureValidationOutcome =
  | "valid_live"
  | "valid_format_only"
  | "invalid_format"
  | "permission_denied"
  | "live_disabled";

export interface AzureValidationResult {
  ok: boolean;
  outcome: AzureValidationOutcome;
  status: AzureConnectionStatus;
  validatedTenantId?: string;
  message: string;
  errorCode?: string;
  mode: "live" | "preview" | "expanding";
}

export interface AzureValidateInput {
  input: AzureConnectionInput;
  requestLive: boolean;
}

export async function validateAzureConnection(opts: AzureValidateInput): Promise<AzureValidationResult> {
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
    };
  }

  // Live mode placeholder — not yet wired. When the Azure SDK call is
  // added (using clientId + clientSecret via `@azure/identity`), this
  // branch will be reachable. Until then we honestly tag the response.
  if (opts.requestLive) {
    return {
      ok: true,
      outcome: "live_disabled",
      status: "validating",
      message:
        "Azure input is well-formed. Live Azure validation is in the expanding tier — adapter " +
        "ships once the host configures the Azure connector SDK pipeline.",
      mode: "expanding",
    };
  }

  return {
    ok: true,
    outcome: "valid_format_only",
    status: "validating",
    message: "Azure input format validated. Live validation runs when the scan is started.",
    mode: "preview",
  };
}
