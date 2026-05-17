/**
 * AWS configuration helpers.
 *
 * Single source of truth for "is AWS live-capable on this deployment?",
 * mirroring the Azure + GCP helpers. Wraps the env loader so consumers
 * never read process.env directly.
 *
 * Hard rules:
 *  - Never returns broker access/secret keys. Callers receive only
 *    presence booleans + non-sensitive identifiers (role ARN, region).
 *  - Never logs credentials.
 */

import "server-only";

import { loadAppEnv } from "@/lib/config/env";

export type AwsMode = "live" | "preview" | "disabled";

export interface AwsRuntimeConfig {
  /** True when broker credentials are present in the host env. */
  brokerConfigured: boolean;
  /** Effective scan mode for AWS on this deployment. */
  mode: AwsMode;
  /** True when ambient AWS_ROLE_ARN + AWS_EXTERNAL_ID + region are set. */
  ambientConnectionConfigured: boolean;
  /** Honest ambient defaults — never the secret. */
  defaultRoleArn?: string;
  defaultExternalId?: string;
  defaultRegion?: string;
  defaultSessionDurationSec?: number;
}

const DEFAULT_SESSION_DURATION = 900;

export function getAwsConfig(): AwsRuntimeConfig {
  const env = loadAppEnv();
  const e = process.env;

  const defaultRoleArn = e.AWS_ROLE_ARN?.trim() || undefined;
  const defaultExternalId = e.AWS_EXTERNAL_ID?.trim() || undefined;
  const defaultRegion = e.AWS_REGION?.trim() || e.AWS_DEFAULT_REGION?.trim() || undefined;
  const sessDur = Number(e.AWS_SESSION_DURATION_SECONDS ?? "");
  const defaultSessionDurationSec =
    Number.isFinite(sessDur) && sessDur >= 900 && sessDur <= 43_200 ? sessDur : DEFAULT_SESSION_DURATION;

  const ambientConnectionConfigured = Boolean(defaultRoleArn && defaultExternalId && defaultRegion);

  let mode: AwsMode;
  if (env.awsScanMode === "disabled") mode = "disabled";
  else if (env.awsScanMode === "live" && env.awsBrokerConfigured) mode = "live";
  else mode = "preview";

  return {
    brokerConfigured: env.awsBrokerConfigured,
    mode,
    ambientConnectionConfigured,
    defaultRoleArn,
    defaultExternalId,
    defaultRegion,
    defaultSessionDurationSec,
  };
}

/**
 * Honest list of what's missing for live AWS — used by validators + the
 * operating-loop builder to surface a precise "set X on the host" hint.
 */
export function listMissingAwsConfig(): string[] {
  const cfg = getAwsConfig();
  const missing: string[] = [];
  if (!cfg.brokerConfigured) missing.push("AWS_CONNECTOR_BROKER_ACCESS_KEY_ID + AWS_CONNECTOR_BROKER_SECRET_ACCESS_KEY");
  if (!cfg.defaultRoleArn) missing.push("AWS_ROLE_ARN");
  if (!cfg.defaultExternalId) missing.push("AWS_EXTERNAL_ID");
  if (!cfg.defaultRegion) missing.push("AWS_REGION (or AWS_DEFAULT_REGION)");
  return missing;
}
