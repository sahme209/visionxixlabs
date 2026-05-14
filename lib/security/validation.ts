/**
 * Input validation — every external input gets parsed before it touches a
 * database, a connector, or the AI context.
 *
 * Why hand-rolled validators instead of a runtime schema library: this layer
 * runs on every route and the platform doesn't yet have zod installed at the
 * library tier. These are small, deterministic, well-tested string checks
 * with explicit error codes — switching to zod later is a mechanical move.
 *
 * The validators throw AxiomError(category=validation) on failure so the
 * API guard turns them into uniform 400 responses.
 */

import { AxiomErrors } from "@/lib/errors/axiomErrors";

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

/** Trim and require non-empty. */
export function requireString(value: unknown, field: string, opts: { max?: number; min?: number } = {}): string {
  if (typeof value !== "string") {
    throw AxiomErrors.validation("validation.required", `Field "${field}" is required.`, { field });
  }
  const trimmed = value.trim();
  const min = opts.min ?? 1;
  const max = opts.max ?? 2048;
  if (trimmed.length < min) {
    throw AxiomErrors.validation("validation.too_short", `Field "${field}" must be at least ${min} characters.`, { field });
  }
  if (trimmed.length > max) {
    throw AxiomErrors.validation("validation.too_long", `Field "${field}" must be at most ${max} characters.`, { field });
  }
  return trimmed;
}

export function requireEnum<T extends string>(value: unknown, field: string, allowed: readonly T[]): T {
  const s = requireString(value, field);
  if (!(allowed as readonly string[]).includes(s)) {
    throw AxiomErrors.validation("validation.invalid_enum", `Field "${field}" must be one of: ${allowed.join(", ")}.`, { field });
  }
  return s as T;
}

export function requireBool(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw AxiomErrors.validation("validation.invalid_bool", `Field "${field}" must be a boolean.`, { field });
  }
  return value;
}

export function requireInt(value: unknown, field: string, opts: { min?: number; max?: number } = {}): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw AxiomErrors.validation("validation.invalid_int", `Field "${field}" must be an integer.`, { field });
  }
  if (opts.min !== undefined && value < opts.min) {
    throw AxiomErrors.validation("validation.below_min", `Field "${field}" must be ≥ ${opts.min}.`, { field });
  }
  if (opts.max !== undefined && value > opts.max) {
    throw AxiomErrors.validation("validation.above_max", `Field "${field}" must be ≤ ${opts.max}.`, { field });
  }
  return value;
}

export function optionalString(value: unknown, field: string, opts: { max?: number } = {}): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return requireString(value, field, opts);
}

// ---------------------------------------------------------------------------
// Cloud identifiers
// ---------------------------------------------------------------------------

const AWS_ACCOUNT_ID = /^\d{12}$/;
const AWS_ROLE_ARN   = /^arn:aws[a-zA-Z-]*:iam::\d{12}:role\/[A-Za-z0-9+=,.@_/-]{1,128}$/;
const AWS_EXTERNAL_ID = /^[A-Za-z0-9+=,.@:_/-]{2,1224}$/;
const AWS_REGION     = /^(?:us|eu|ap|sa|ca|me|af|cn)-(?:[a-z]+)-\d$/;

export function requireAwsAccountId(value: unknown, field = "awsAccountId"): string {
  const s = requireString(value, field);
  if (!AWS_ACCOUNT_ID.test(s)) {
    throw AxiomErrors.validation("validation.aws_account_id", "AWS account id must be 12 digits.", { field });
  }
  return s;
}

export function requireAwsRoleArn(value: unknown, field = "awsRoleArn"): string {
  const s = requireString(value, field);
  if (!AWS_ROLE_ARN.test(s)) {
    throw AxiomErrors.validation("validation.aws_role_arn", "AWS role ARN is malformed.", { field });
  }
  return s;
}

export function requireAwsExternalId(value: unknown, field = "externalId"): string {
  const s = requireString(value, field, { min: 2, max: 1224 });
  if (!AWS_EXTERNAL_ID.test(s)) {
    throw AxiomErrors.validation("validation.aws_external_id", "External ID contains invalid characters.", { field });
  }
  return s;
}

export function requireAwsRegion(value: unknown, field = "awsRegion"): string {
  const s = requireString(value, field);
  if (!AWS_REGION.test(s)) {
    throw AxiomErrors.validation("validation.aws_region", "AWS region is malformed (e.g. us-east-1).", { field });
  }
  return s;
}

// ---------------------------------------------------------------------------
// Azure / GCP identifiers
// ---------------------------------------------------------------------------

const UUID_V4_ISH    = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
const GCP_PROJECT_ID = /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/;

export function requireAzureTenantId(value: unknown, field = "azureTenantId"): string {
  const s = requireString(value, field);
  if (!UUID_V4_ISH.test(s)) {
    throw AxiomErrors.validation("validation.azure_tenant_id", "Azure tenant id must be a UUID.", { field });
  }
  return s;
}

export function requireAzureSubscriptionId(value: unknown, field = "azureSubscriptionId"): string {
  const s = requireString(value, field);
  if (!UUID_V4_ISH.test(s)) {
    throw AxiomErrors.validation("validation.azure_subscription_id", "Azure subscription id must be a UUID.", { field });
  }
  return s;
}

export function requireGcpProjectId(value: unknown, field = "gcpProjectId"): string {
  const s = requireString(value, field);
  if (!GCP_PROJECT_ID.test(s)) {
    throw AxiomErrors.validation("validation.gcp_project_id", "GCP project id must be lowercase 6-30 chars (letters, digits, hyphens).", { field });
  }
  return s;
}

// ---------------------------------------------------------------------------
// GitHub identifiers
// ---------------------------------------------------------------------------

const GITHUB_OWNER = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;
const GITHUB_REPO  = /^[A-Za-z0-9_.-]{1,100}$/;

export function requireGithubOwner(value: unknown, field = "owner"): string {
  const s = requireString(value, field);
  if (!GITHUB_OWNER.test(s)) {
    throw AxiomErrors.validation("validation.github_owner", "GitHub owner/org name is invalid.", { field });
  }
  return s;
}

export function requireGithubRepo(value: unknown, field = "repo"): string {
  const s = requireString(value, field);
  if (!GITHUB_REPO.test(s)) {
    throw AxiomErrors.validation("validation.github_repo", "GitHub repo name is invalid.", { field });
  }
  return s;
}

// ---------------------------------------------------------------------------
// Generic shapes
// ---------------------------------------------------------------------------

const ID_LIKE = /^[A-Za-z0-9_-]{1,128}$/;

export function requireId(value: unknown, field: string): string {
  const s = requireString(value, field);
  if (!ID_LIKE.test(s)) {
    throw AxiomErrors.validation("validation.invalid_id", `Field "${field}" contains invalid characters.`, { field });
  }
  return s;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function requireEmail(value: unknown, field = "email"): string {
  const s = requireString(value, field, { max: 256 });
  if (!EMAIL.test(s)) {
    throw AxiomErrors.validation("validation.email", "Invalid email address.", { field });
  }
  return s.toLowerCase();
}

const URL_LIKE = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;

export function requireHttpsUrl(value: unknown, field = "url"): string {
  const s = requireString(value, field, { max: 2048 });
  if (!URL_LIKE.test(s) || !s.toLowerCase().startsWith("https://")) {
    throw AxiomErrors.validation("validation.url", "Must be a valid https URL.", { field });
  }
  return s;
}

// ---------------------------------------------------------------------------
// Object parsing helpers
// ---------------------------------------------------------------------------

/** Safely read a property bag for parsing (rejects arrays / primitives). */
export function asRecord(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw AxiomErrors.validation("validation.invalid_body", "Request body must be a JSON object.");
  }
  return value as Record<string, unknown>;
}
