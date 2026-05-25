/**
 * Pure input-shape validation for cloud connectors.
 *
 * The real Azure/GCP/AWS validators live alongside their cloud SDK
 * imports — which makes them painful to unit-test in environments
 * where those SDKs' transitive deps aren't fully resolved (we hit
 * this with @azure/identity → jsonwebtoken → jws and with
 * @google-cloud/resource-manager → gaxios).
 *
 * The shape-validation half of each flow is pure JS though — GUID
 * regex, project-id regex, JSON parsing, presence checks. Lifting
 * that here gives us a regression-test surface that runs anywhere,
 * AND keeps the route handlers thin: they can call these helpers
 * first to fail fast on garbage payloads before invoking the SDK.
 *
 * No SDK imports. No I/O. Pure functions only.
 */

/* ──────────────────────────────────────────────────────────────────
   Azure — service principal JSON validation.

   The customer pastes the JSON output of
   `az ad sp create-for-rbac --sdk-auth`. We accept either the
   --sdk-auth key names (tenantId/subscriptionId/clientId/clientSecret)
   or the default az output (tenant/subscription/appId/password).
   ────────────────────────────────────────────────────────────── */

const GUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export type AzureCredsShape =
  | { ok: true;  tenantId: string; subscriptionId: string; clientId: string; clientSecret: string }
  | { ok: false; error: "missing_credentials" | "malformed_json" | "malformed_tenant_id" | "malformed_subscription_id" | "malformed_client_id" | "missing_client_secret"; hint: string };

interface AzureRawCreds {
  tenantId?: unknown; tenant?: unknown;
  subscriptionId?: unknown; subscription?: unknown;
  clientId?: unknown; appId?: unknown;
  clientSecret?: unknown; password?: unknown;
}

function strField(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export function parseAzureSpJson(raw: string): AzureCredsShape {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) {
    return { ok: false, error: "missing_credentials", hint: "Paste the entire JSON output from the az command — including the opening { and closing }." };
  }
  let parsed: AzureRawCreds;
  try {
    parsed = JSON.parse(trimmed) as AzureRawCreds;
  } catch {
    return { ok: false, error: "malformed_json", hint: "That doesn't look like valid JSON. Re-copy the entire output from Cloud Shell, including the braces." };
  }
  const tenantId       = strField(parsed.tenantId)       || strField(parsed.tenant);
  const subscriptionId = strField(parsed.subscriptionId) || strField(parsed.subscription);
  const clientId       = strField(parsed.clientId)       || strField(parsed.appId);
  const clientSecret   = strField(parsed.clientSecret)   || strField(parsed.password);

  if (!tenantId || !GUID_RE.test(tenantId)) {
    return { ok: false, error: "malformed_tenant_id", hint: "Tenant ID is missing or malformed. Re-run the az command and paste the full JSON." };
  }
  if (!subscriptionId || !GUID_RE.test(subscriptionId)) {
    return { ok: false, error: "malformed_subscription_id", hint: "Subscription ID is missing or malformed. Re-run the az command with the correct --scopes /subscriptions/<id>." };
  }
  if (!clientId || !GUID_RE.test(clientId)) {
    return { ok: false, error: "malformed_client_id", hint: "Client/app ID is missing. Re-run the az command and paste the full output." };
  }
  if (!clientSecret) {
    return { ok: false, error: "missing_client_secret", hint: "Client secret/password is missing. The az command should print it once — re-run if you lost it." };
  }
  return { ok: true, tenantId, subscriptionId, clientId, clientSecret };
}

/* ──────────────────────────────────────────────────────────────────
   GCP — service account JSON validation.

   The customer pastes the JSON key generated in Cloud Shell. We
   verify it's a service_account key with the four fields the SDK
   needs.
   ────────────────────────────────────────────────────────────── */

const GCP_PROJECT_RE = /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/;

export type GcpSaShape =
  | { ok: true;  projectId: string; clientEmail: string }
  | { ok: false; error: "missing_key" | "malformed_json" | "wrong_key_type" | "missing_project_id" | "missing_client_email" | "incomplete_key" | "malformed_project_id"; hint: string };

interface GcpRawKey {
  type?: unknown;
  project_id?: unknown;
  client_email?: unknown;
  private_key_id?: unknown;
  private_key?: unknown;
}

export function parseGcpSaJson(raw: string, opts: { requestedProjectId?: string } = {}): GcpSaShape {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) {
    return { ok: false, error: "missing_key", hint: "Paste the entire JSON key — including the opening { and closing }." };
  }
  let parsed: GcpRawKey;
  try {
    parsed = JSON.parse(trimmed) as GcpRawKey;
  } catch {
    return { ok: false, error: "malformed_json", hint: "That doesn't look like valid JSON. Re-copy the entire output from Cloud Shell, including the braces." };
  }
  if (parsed.type !== "service_account") {
    return { ok: false, error: "wrong_key_type", hint: "Expected a service-account key (type: \"service_account\"). Re-run the Cloud Shell tutorial and copy the new JSON." };
  }
  const fromJson = strField(parsed.project_id);
  const projectId = (opts.requestedProjectId ?? "").trim() || fromJson;
  const clientEmail = strField(parsed.client_email);
  const privateKeyId = strField(parsed.private_key_id);
  const privateKey = strField(parsed.private_key);

  if (!projectId) {
    return { ok: false, error: "missing_project_id", hint: "Service-account JSON has no project_id field. Re-run the Cloud Shell tutorial." };
  }
  if (!GCP_PROJECT_RE.test(projectId)) {
    return { ok: false, error: "malformed_project_id", hint: "Project ID must be 6–30 lowercase letters, digits, or hyphens, starting with a letter and ending with a letter or digit." };
  }
  if (!clientEmail) {
    return { ok: false, error: "missing_client_email", hint: "Service-account JSON has no client_email field." };
  }
  if (!privateKeyId || !privateKey) {
    return { ok: false, error: "incomplete_key", hint: "The JSON is missing private_key_id or private_key. Generate a fresh key in Cloud Shell." };
  }
  return { ok: true, projectId, clientEmail };
}
