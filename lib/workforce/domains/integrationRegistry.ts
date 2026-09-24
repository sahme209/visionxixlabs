/**
 * Workspace integration registry — Phase 644.
 *
 * Per-workspace storage for the integrations the action layer
 * uses to actually DO something with engineer outputs. Without
 * this, engineers produce reports; with this, engineers produce
 * reports AND fire real actions (open a GitHub issue, send a
 * Slack message, file a Linear ticket).
 *
 * Each integration kind has:
 *   · An enabled flag (pause without deleting)
 *   · Configuration fields specific to the integration
 *   · A credential reference — actual secret retrieval happens at
 *     action time. We never store the credential itself.
 *
 * Stored as a per-workspace singleton at targetKind=
 * workforce_integration_config, targetId=workspaceId. Same
 * singleton pattern as slack-config / monitoring-webhook / tickLog.
 *
 * Server-only.
 */

import "server-only";

import { prisma } from "@/lib/db";

export const INTEGRATION_CONFIG_TARGET_KIND = "workforce_integration_config";

export interface GitHubIntegration {
  enabled: boolean;
  /** Repo in "owner/repo" format. */
  repo: string;
  /** Reference to where the PAT is stored. We accept either
   *  env://VAR_NAME (read from process.env at action time) or
   *  one of the secrets-manager prefixes (resolution is the
   *  customer's secrets-manager responsibility). */
  patReference: string;
  /** Label applied to every issue we open. */
  issueLabel: string;
}

export interface SlackActionIntegration {
  enabled: boolean;
  /** Distinct from the Phase 635 daily-digest webhook — this is
   *  for action notifications. Same hooks.slack.com SSRF guard. */
  webhookUrl: string;
}

export interface LinearIntegration {
  enabled: boolean;
  /** Linear team UUID. Required for issueCreate. */
  teamId: string;
  /** Reference to the API key. Linear personal API keys live anywhere
   *  the customer wants — env://, vault://, secretsmanager://. */
  apiKeyReference: string;
  /** Optional label applied to every issue we file. */
  labelName: string;
}

export interface IntegrationConfig {
  github: GitHubIntegration | null;
  slackActions: SlackActionIntegration | null;
  linear: LinearIntegration | null;
}

const EMPTY: IntegrationConfig = { github: null, slackActions: null, linear: null };

/** Recognized credential reference prefixes. We don't try to
 *  resolve them here — the action executor calls a resolver that
 *  handles each prefix at action time. */
export function isValidCredentialReference(ref: string): boolean {
  if (typeof ref !== "string" || ref.length === 0 || ref.length > 400) return false;
  return /^(env|vault|secretsmanager|azurekeyvault|gcpsecretmanager):\/?\/?[\w\-/.]+$/i.test(ref);
}

export function isValidGithubRepo(repo: string): boolean {
  if (typeof repo !== "string" || repo.length === 0 || repo.length > 200) return false;
  // owner/repo — alphanumerics, hyphens, underscores, dots.
  return /^[\w.-]+\/[\w.-]+$/.test(repo);
}

export function isValidLinearTeamId(id: string): boolean {
  if (typeof id !== "string" || id.length === 0 || id.length > 80) return false;
  // Linear team IDs are UUIDs. Accept UUID v4 shape; also allow the
  // short slug form Linear sometimes returns (3-12 lowercase chars).
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ||
    /^[a-z][a-z0-9]{2,11}$/.test(id);
}

export function isValidLinearLabel(label: string): boolean {
  if (typeof label !== "string") return false;
  return label.length >= 0 && label.length <= 64 && /^[\w .\-]*$/.test(label);
}

export function isValidSlackWebhookUrl(url: string): boolean {
  if (typeof url !== "string" || url.length === 0 || url.length > 400) return false;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname === "hooks.slack.com" &&
      u.pathname.startsWith("/services/");
  } catch {
    return false;
  }
}

export async function readIntegrationConfig(
  organizationId: string,
): Promise<IntegrationConfig> {
  try {
    const row = await prisma.aiRationaleEnrichment.findUnique({
      where: {
        organizationId_targetKind_targetId: {
          organizationId,
          targetKind: INTEGRATION_CONFIG_TARGET_KIND,
          targetId: organizationId,
        },
      },
      select: { nextActionsJson: true },
    });
    if (!row || !Array.isArray(row.nextActionsJson)) return EMPTY;
    const tags = new Map<string, string>();
    for (const e of row.nextActionsJson as unknown[]) {
      if (typeof e !== "string") continue;
      const idx = e.indexOf("|");
      if (idx === -1) continue;
      tags.set(e.slice(0, idx), e.slice(idx + 1));
    }
    const github: GitHubIntegration | null = tags.get("github_enabled") !== undefined
      ? {
          enabled: tags.get("github_enabled") !== "false",
          repo: tags.get("github_repo") ?? "",
          patReference: tags.get("github_pat_reference") ?? "",
          issueLabel: tags.get("github_issue_label") ?? "axiom-finding",
        }
      : null;
    const slackActions: SlackActionIntegration | null = tags.get("slack_actions_enabled") !== undefined
      ? {
          enabled: tags.get("slack_actions_enabled") !== "false",
          webhookUrl: tags.get("slack_actions_webhook_url") ?? "",
        }
      : null;
    const linear: LinearIntegration | null = tags.get("linear_enabled") !== undefined
      ? {
          enabled: tags.get("linear_enabled") !== "false",
          teamId: tags.get("linear_team_id") ?? "",
          apiKeyReference: tags.get("linear_api_key_reference") ?? "",
          labelName: tags.get("linear_label_name") ?? "axiom-finding",
        }
      : null;
    return { github, slackActions, linear };
  } catch {
    return EMPTY;
  }
}

export async function writeIntegrationConfig(
  organizationId: string,
  config: IntegrationConfig,
): Promise<void> {
  const payload: string[] = [];
  if (config.github) {
    payload.push(`github_enabled|${config.github.enabled ? "true" : "false"}`);
    payload.push(`github_repo|${config.github.repo}`);
    payload.push(`github_pat_reference|${config.github.patReference}`);
    payload.push(`github_issue_label|${config.github.issueLabel}`);
  }
  if (config.slackActions) {
    payload.push(`slack_actions_enabled|${config.slackActions.enabled ? "true" : "false"}`);
    payload.push(`slack_actions_webhook_url|${config.slackActions.webhookUrl}`);
  }
  if (config.linear) {
    payload.push(`linear_enabled|${config.linear.enabled ? "true" : "false"}`);
    payload.push(`linear_team_id|${config.linear.teamId}`);
    payload.push(`linear_api_key_reference|${config.linear.apiKeyReference}`);
    payload.push(`linear_label_name|${config.linear.labelName}`);
  }
  const enabledLines: string[] = [];
  if (config.github?.enabled) enabledLines.push(`github(${config.github.repo})`);
  if (config.slackActions?.enabled) enabledLines.push("slack");
  if (config.linear?.enabled) enabledLines.push(`linear(${config.linear.teamId})`);
  const narrative = `Integration config · ${enabledLines.length === 0 ? "none enabled" : enabledLines.join(" · ")}.`;

  await prisma.aiRationaleEnrichment.upsert({
    where: {
      organizationId_targetKind_targetId: {
        organizationId,
        targetKind: INTEGRATION_CONFIG_TARGET_KIND,
        targetId: organizationId,
      },
    },
    create: {
      organizationId,
      targetKind: INTEGRATION_CONFIG_TARGET_KIND,
      targetId: organizationId,
      narrative,
      riskFactorsJson: [] as unknown as string[],
      nextActionsJson: payload as unknown as string[],
      outcome: enabledLines.length > 0 ? "ai_generated" : "fallback_rules",
      errorMessage: null,
      modelHint: null,
      engineVersion: "integration-registry-v1",
    },
    update: {
      narrative,
      nextActionsJson: payload as unknown as string[],
    },
  });
}

/**
 * Pure env-var resolver. Kept synchronous + exported so the Phase
 * 645 tests can assert the lowercase-stripping contract without
 * touching the async dispatch path.
 */
export function resolveEnvReference(ref: string): string | null {
  if (!isValidCredentialReference(ref)) return null;
  if (!ref.toLowerCase().startsWith("env://")) return null;
  const varName = ref.slice("env://".length).replace(/[^A-Z0-9_]/g, "");
  if (!varName) return null;
  const v = process.env[varName];
  return v && v.length > 0 ? v : null;
}

export interface ResolveError {
  errorCode: "invalid_reference" | "env_unset" | "vault_unreachable" | "vault_unauthorized" | "vault_not_found" | "vault_no_value" | "aws_unreachable" | "aws_not_found" | "aws_no_value" | "scheme_not_wired";
  detail: string;
}

/**
 * Async credential resolution at action time.
 *
 * Supported schemes (Phase 647):
 *   · env://VAR_NAME   — process.env lookup (in-process)
 *   · vault://path     — HashiCorp Vault KV v2 read. Reads
 *                        VAULT_ADDR + VAULT_TOKEN from process.env.
 *                        Path is the KV v2 mount path; we hit
 *                        `{VAULT_ADDR}/v1/{path}` and pull `data.data.value`.
 *   · secretsmanager://name  — AWS Secrets Manager. Reads
 *                        AWS_REGION from process.env, uses the
 *                        default credential chain (IRSA / instance
 *                        profile / env / SSO). Returns SecretString.
 *
 * Not yet wired:
 *   · azurekeyvault:// — needs @azure/keyvault-secrets binding
 *   · gcpsecretmanager:// — needs @google-cloud/secret-manager package
 *
 * Returns the secret string on success, or a ResolveError describing
 * exactly what's broken so the action-executor row gives the operator
 * a clear path to fix it ("env var X is unset" / "vault returned 403"
 * / "AWS secret not found in region us-east-1").
 */
export async function resolveCredentialReferenceAsync(
  ref: string,
): Promise<{ ok: true; value: string } | { ok: false; error: ResolveError }> {
  if (!isValidCredentialReference(ref)) {
    return { ok: false, error: { errorCode: "invalid_reference", detail: "reference did not match an accepted scheme" } };
  }
  const lower = ref.toLowerCase();
  if (lower.startsWith("env://")) {
    const v = resolveEnvReference(ref);
    if (v !== null) return { ok: true, value: v };
    return { ok: false, error: { errorCode: "env_unset", detail: `env var named by ${ref} is unset or empty` } };
  }
  if (lower.startsWith("vault://")) {
    return resolveVault(ref);
  }
  if (lower.startsWith("secretsmanager://")) {
    return resolveAwsSecretsManager(ref);
  }
  return {
    ok: false,
    error: {
      errorCode: "scheme_not_wired",
      detail: `${ref.split(":")[0]}:// resolver not wired in this build — open an issue to request it`,
    },
  };
}

async function resolveVault(
  ref: string,
): Promise<{ ok: true; value: string } | { ok: false; error: ResolveError }> {
  const addr = process.env.VAULT_ADDR;
  const token = process.env.VAULT_TOKEN;
  if (!addr || !token) {
    return {
      ok: false,
      error: {
        errorCode: "vault_unauthorized",
        detail: "VAULT_ADDR or VAULT_TOKEN is unset in process.env",
      },
    };
  }
  const path = ref.slice("vault://".length).replace(/^\/+/, "");
  if (!path) {
    return { ok: false, error: { errorCode: "invalid_reference", detail: "vault path is empty" } };
  }
  const base = addr.replace(/\/+$/, "");
  const url = `${base}/v1/${path}`;
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "X-Vault-Token": token,
        Accept: "application/json",
        "User-Agent": "visionxixlabs-credential-resolver/1.0",
      },
      signal: AbortSignal.timeout(8_000),
    });
    if (res.status === 403 || res.status === 401) {
      return { ok: false, error: { errorCode: "vault_unauthorized", detail: `vault returned ${res.status}` } };
    }
    if (res.status === 404) {
      return { ok: false, error: { errorCode: "vault_not_found", detail: `vault path ${path} not found` } };
    }
    if (!res.ok) {
      return { ok: false, error: { errorCode: "vault_unreachable", detail: `vault returned ${res.status}` } };
    }
    const json = (await res.json().catch(() => null)) as
      | { data?: { data?: Record<string, unknown>; value?: unknown } }
      | null;
    // KV v2 nests under data.data.value; KV v1 puts it under data.value.
    const v2Value = json?.data?.data?.value;
    const v1Value = json?.data?.value;
    const value = typeof v2Value === "string" ? v2Value : typeof v1Value === "string" ? v1Value : null;
    if (!value) {
      return { ok: false, error: { errorCode: "vault_no_value", detail: "vault response did not include a string 'value' field" } };
    }
    return { ok: true, value };
  } catch (e) {
    return {
      ok: false,
      error: {
        errorCode: "vault_unreachable",
        detail: e instanceof Error ? e.message.slice(0, 200) : "unknown error",
      },
    };
  }
}

async function resolveAwsSecretsManager(
  ref: string,
): Promise<{ ok: true; value: string } | { ok: false; error: ResolveError }> {
  const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION;
  if (!region) {
    return {
      ok: false,
      error: { errorCode: "aws_unreachable", detail: "AWS_REGION / AWS_DEFAULT_REGION unset" },
    };
  }
  const secretId = ref.slice("secretsmanager://".length).replace(/^\/+/, "");
  if (!secretId) {
    return { ok: false, error: { errorCode: "invalid_reference", detail: "secretsmanager secret id is empty" } };
  }
  try {
    const { SecretsManagerClient, GetSecretValueCommand } = await import("@aws-sdk/client-secrets-manager");
    const client = new SecretsManagerClient({ region });
    const out = await client.send(new GetSecretValueCommand({ SecretId: secretId }));
    const v = out.SecretString;
    if (!v) {
      return {
        ok: false,
        error: { errorCode: "aws_no_value", detail: "AWS Secrets Manager returned no SecretString (binary secrets not supported here)" },
      };
    }
    return { ok: true, value: v };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/ResourceNotFoundException|not found/i.test(msg)) {
      return { ok: false, error: { errorCode: "aws_not_found", detail: `secret ${secretId} not found in ${region}` } };
    }
    return { ok: false, error: { errorCode: "aws_unreachable", detail: msg.slice(0, 200) } };
  }
}

/**
 * Deprecated synchronous resolver. Retained as a thin wrapper for
 * call sites we haven't migrated yet; new code should use
 * resolveCredentialReferenceAsync. Synchronous lookup only handles
 * env://.
 */
export function resolveCredentialReference(ref: string): string | null {
  return resolveEnvReference(ref);
}
