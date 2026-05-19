/**
 * Multi-Cloud Security Findings builder.
 *
 * Runs AWS GuardDuty + Azure Defender for Cloud + GCP Security
 * Command Center in parallel and emits the unified
 * MultiCloudSecurityReport. Per-cloud failures isolated.
 */

import "server-only";

import { loadAppEnv } from "@/lib/config/env";
import { getAwsConfig } from "./aws/awsConfig";
import { getAzureConfig, resolveAzureClientId, resolveAzureClientSecret } from "./azure/azureConfig";
import { getGcpConfig, resolveGcpServiceAccountJson, resolveGcpPrivateKey, resolveGcpClientEmail } from "./gcp/gcpConfig";
import { resolveAwsCredentials } from "./aws/awsCredentialResolver";
import {
  emptySecurityCloudSection,
  summarizeFindings,
  type MultiCloudSecurityReport,
  type SecurityCloudSection,
  type SecurityFinding,
  type SecuritySeverity,
} from "./multiCloudSecurityModel";
import type { OrganizationId, UserId } from "@/lib/domain/ids";

const DEFAULT_TIMEOUT_MS = 12_000;

export interface BuildMultiCloudSecurityInput {
  tenantId: OrganizationId;
  actorUserId?: UserId;
}

export async function buildMultiCloudSecurity(input: BuildMultiCloudSecurityInput): Promise<MultiCloudSecurityReport> {
  const env = loadAppEnv();
  const generatedAt = new Date().toISOString();

  const [aws, azure, gcp] = await Promise.all([
    runAws(env),
    runAzure(env),
    runGcp(env),
  ]);

  const allFindings = [...aws.findings, ...azure.findings, ...gcp.findings];
  const enabledCount = [aws, azure, gcp].filter((s) => s.serviceEnabled).length;
  const totals = summarizeFindings(allFindings);

  const overallSourceMode = [aws.mode, azure.mode, gcp.mode].some((m) => m === "live")
    ? "live"
    : "preview";

  return {
    generatedAt,
    tenantId: String(input.tenantId),
    aws,
    azure,
    gcp,
    summary: {
      totalFindings: allFindings.length,
      criticalCount: totals.critical,
      highCount: totals.high,
      mediumCount: totals.medium,
      lowCount: totals.low,
      enabledCloudCount: enabledCount,
    },
    overallSourceMode,
    safetyContract: "multi_cloud_security_read_only",
    limitations: [
      enabledCount === 0
        ? "No cloud security service is enabled yet. Activate GuardDuty + Defender + SCC at the account/subscription/project level."
        : `${enabledCount} of 3 clouds reporting.`,
    ],
    safeNextAction: { label: "Open Risk Queue", href: "/dashboard/risks" },
  };
}

// ---------------------------------------------------------------------------
// AWS — GuardDuty
// ---------------------------------------------------------------------------

async function runAws(env: ReturnType<typeof loadAppEnv>): Promise<SecurityCloudSection> {
  const section = emptySecurityCloudSection("aws");
  const cfg = getAwsConfig();
  if (cfg.mode !== "live") {
    section.mode = "preview";
    section.limitations.push("AWS mode is not live.");
    return section;
  }
  const resolved = await resolveAwsCredentials({ sessionLabel: "security" });
  if (resolved.mode !== "ok") {
    section.mode = "blocked";
    section.limitations.push(resolved.reason);
    return section;
  }
  try {
    const { GuardDutyClient, ListDetectorsCommand, ListFindingsCommand, GetFindingsCommand } = await import("@aws-sdk/client-guardduty");
    const c = new GuardDutyClient({ region: resolved.region, credentials: resolved.credentials });
    const det = await withTimeout(c.send(new ListDetectorsCommand({})), DEFAULT_TIMEOUT_MS, "gd.list_detectors");
    const detectorId = (det.DetectorIds ?? [])[0];
    if (!detectorId) {
      section.mode = "live";
      section.serviceEnabled = false;
      section.limitations.push("GuardDuty not enabled in this region.");
      return section;
    }
    section.serviceEnabled = true;
    const listed = await withTimeout(c.send(new ListFindingsCommand({ DetectorId: detectorId, MaxResults: 50 })), DEFAULT_TIMEOUT_MS, "gd.list_findings");
    const ids = listed.FindingIds ?? [];
    if (ids.length > 0) {
      const detail = await withTimeout(c.send(new GetFindingsCommand({ DetectorId: detectorId, FindingIds: ids })), DEFAULT_TIMEOUT_MS, "gd.get_findings");
      for (const f of detail.Findings ?? []) {
        const score = f.Severity ?? 0;
        const severity: SecuritySeverity = score >= 7 ? "high" : score >= 4 ? "medium" : score > 0 ? "low" : "informational";
        section.findings.push({
          id: f.Id ?? "unknown",
          cloud: "aws",
          category: f.Type ?? "unknown",
          title: f.Title ?? f.Type ?? "GuardDuty finding",
          severity,
          state: "active",
          resourceId: f.Resource?.InstanceDetails?.InstanceId ?? f.Resource?.ResourceType ?? undefined,
          resourceType: f.Resource?.ResourceType ?? undefined,
          region: f.Region ?? resolved.region,
          firstSeenAt: f.CreatedAt ?? undefined,
          lastSeenAt: f.UpdatedAt ?? undefined,
        });
      }
    }
    section.mode = "live";
    section.total = section.findings.length;
    section.bySeverity = summarizeFindings(section.findings);
    return section;
  } catch (err) {
    section.mode = "blocked";
    section.limitations.push(`GuardDuty failed: ${redact(errMessage(err))}`);
    return section;
  }
}

// ---------------------------------------------------------------------------
// Azure — Defender for Cloud
// ---------------------------------------------------------------------------

async function runAzure(env: ReturnType<typeof loadAppEnv>): Promise<SecurityCloudSection> {
  const section = emptySecurityCloudSection("azure");
  const cfg = getAzureConfig();
  if (cfg.mode !== "live") {
    section.mode = "preview";
    section.limitations.push("Azure mode is not live.");
    return section;
  }
  const tenantId = env.azureTenantId;
  const subscriptionId = env.azureSubscriptionId;
  if (!tenantId || !subscriptionId) {
    section.mode = "blocked";
    section.limitations.push("Azure tenant + subscription required.");
    return section;
  }
  const clientId = resolveAzureClientId();
  const clientSecret = resolveAzureClientSecret();
  if (!clientId || !clientSecret) {
    section.mode = "blocked";
    section.limitations.push("Azure client id + secret required.");
    return section;
  }

  try {
    const { ClientSecretCredential } = await import("@azure/identity");
    const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);
    const { SecurityCenter } = await import("@azure/arm-security");
    const sc = new SecurityCenter(credential, subscriptionId);
    const items: SecurityFinding[] = [];
    await withTimeout((async () => {
      const iter = sc.alerts.list();
      for await (const raw of iter) {
        const a = raw as {
          name?: string;
          id?: string;
          alertDisplayName?: string;
          alertType?: string;
          severity?: string;
          status?: string;
          startTimeUtc?: string;
          timeGeneratedUtc?: string;
          resourceIdentifiers?: { azureResourceId?: string }[];
          properties?: { compromisedEntity?: string };
        };
        const severity = mapAzureSeverity(a.severity);
        const state = mapAzureStatus(a.status);
        items.push({
          id: a.id ?? a.name ?? "unknown",
          cloud: "azure",
          category: a.alertType ?? "unknown",
          title: a.alertDisplayName ?? a.alertType ?? "Defender alert",
          severity,
          state,
          resourceId: a.resourceIdentifiers?.[0]?.azureResourceId ?? a.properties?.compromisedEntity,
          firstSeenAt: a.startTimeUtc ?? undefined,
          lastSeenAt: a.timeGeneratedUtc ?? undefined,
        });
        if (items.length >= 100) return;
      }
    })(), DEFAULT_TIMEOUT_MS * 2, "defender.list_alerts");
    section.mode = "live";
    section.serviceEnabled = items.length > 0 || true; // best-effort — Defender is on by default for most subs
    section.findings = items;
    section.total = items.length;
    section.bySeverity = summarizeFindings(items);
    return section;
  } catch (err) {
    section.mode = "blocked";
    section.limitations.push(`Defender for Cloud failed: ${redact(errMessage(err))}`);
    return section;
  }
}

function mapAzureSeverity(v: string | undefined): SecuritySeverity {
  switch ((v ?? "").toLowerCase()) {
    case "high":          return "high";
    case "medium":        return "medium";
    case "low":           return "low";
    case "informational": return "informational";
    default:              return "unknown";
  }
}

function mapAzureStatus(v: string | undefined): SecurityFinding["state"] {
  switch ((v ?? "").toLowerCase()) {
    case "active":      return "active";
    case "inprogress":  return "in_progress";
    case "resolved":    return "resolved";
    case "dismissed":   return "dismissed";
    default:            return "unknown";
  }
}

// ---------------------------------------------------------------------------
// GCP — Security Command Center
// ---------------------------------------------------------------------------

async function runGcp(env: ReturnType<typeof loadAppEnv>): Promise<SecurityCloudSection> {
  const section = emptySecurityCloudSection("gcp");
  const cfg = getGcpConfig();
  if (cfg.mode !== "live") {
    section.mode = "preview";
    section.limitations.push("GCP mode is not live.");
    return section;
  }
  const projectId = env.gcpProjectId;
  if (!projectId) {
    section.mode = "blocked";
    section.limitations.push("GCP_PROJECT_ID required.");
    return section;
  }
  let key: { client_email?: string; private_key?: string } = {};
  try {
    const json = resolveGcpServiceAccountJson();
    if (json) key = JSON.parse(json);
    else key = { client_email: resolveGcpClientEmail(), private_key: resolveGcpPrivateKey() };
  } catch (err) {
    section.mode = "blocked";
    section.limitations.push(`GCP creds parse failed: ${redact(errMessage(err))}`);
    return section;
  }
  if (!key.client_email || !key.private_key) {
    section.mode = "blocked";
    section.limitations.push("GCP service account credentials missing.");
    return section;
  }

  try {
    const sccModule = await import("@google-cloud/security-center");
    const { SecurityCenterClient } = sccModule as { SecurityCenterClient: new (opts: unknown) => unknown };
    const client = new SecurityCenterClient({
      projectId,
      credentials: { client_email: key.client_email, private_key: key.private_key },
    }) as { listFindings: (req: { parent: string; pageSize?: number }) => Promise<[{ finding?: { name?: string; category?: string; severity?: string; state?: string; resourceName?: string; eventTime?: string; createTime?: string; externalUri?: string } }[]]> };

    const items: SecurityFinding[] = [];
    try {
      // GCP SCC uses parent format: organizations/{org}/sources/-/findings
      // For project-scoped: projects/{project}/sources/-/findings
      const [findingsResp] = await withTimeout(
        client.listFindings({
          parent: `projects/${projectId}/sources/-`,
          pageSize: 50,
        }),
        DEFAULT_TIMEOUT_MS,
        "scc.list_findings",
      );
      for (const row of findingsResp) {
        const f = row.finding ?? {};
        items.push({
          id: f.name ?? "unknown",
          cloud: "gcp",
          category: f.category ?? "unknown",
          title: f.category ?? "SCC finding",
          severity: mapGcpSeverity(f.severity),
          state: f.state === "ACTIVE" ? "active" : f.state === "INACTIVE" ? "resolved" : "unknown",
          resourceId: f.resourceName ?? undefined,
          firstSeenAt: f.createTime ?? undefined,
          lastSeenAt: f.eventTime ?? undefined,
          externalUrl: f.externalUri ?? undefined,
        });
        if (items.length >= 100) break;
      }
      section.serviceEnabled = true;
    } catch (err) {
      const msg = errMessage(err);
      if (/PERMISSION_DENIED|NOT_FOUND/i.test(msg)) {
        section.mode = "live";
        section.serviceEnabled = false;
        section.limitations.push("Security Command Center not enabled at the project level.");
        return section;
      }
      throw err;
    }
    section.mode = "live";
    section.findings = items;
    section.total = items.length;
    section.bySeverity = summarizeFindings(items);
    return section;
  } catch (err) {
    section.mode = "blocked";
    section.limitations.push(`Security Command Center failed: ${redact(errMessage(err))}`);
    return section;
  }
}

function mapGcpSeverity(v: string | undefined): SecuritySeverity {
  switch ((v ?? "").toUpperCase()) {
    case "CRITICAL": return "critical";
    case "HIGH":     return "high";
    case "MEDIUM":   return "medium";
    case "LOW":      return "low";
    default:         return "unknown";
  }
}

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}
function errMessage(e: unknown): string { return e instanceof Error ? e.message : String(e); }
function redact(msg: string): string {
  return msg
    .replace(/AKIA[0-9A-Z]{16}/g, "[redacted]")
    .replace(/[A-Za-z0-9+/=]{30,}/g, "[redacted]");
}
