/**
 * Monitoring webhook config — Phase 643.
 *
 * Stores per-workspace monitoring webhook configuration so the
 * customer can point their existing alerting tools (Datadog,
 * PagerDuty, Prometheus AlertManager, Grafana, Opsgenie, etc.)
 * at one URL and have alerts auto-fire workload_performance_engineer
 * analysis.
 *
 * Each config row holds:
 *   · webhookSecret — HMAC secret the customer configures in their
 *     alerting tool so we can verify the alert is genuine
 *   · provider — which alerting tool's payload shape to expect
 *     (closed union — we parse each provider's webhook format)
 *   · enabled — operator can pause without deleting the config
 *   · autoAnalyze — when true, every accepted alert auto-fires
 *     workload_performance_engineer; otherwise the alert is just
 *     persisted for the operator to review and decide
 *   · costCap — daily AI-spend ceiling for auto-analyze. Protects
 *     against alert storms turning into AI invoice blowouts.
 *
 * Singleton-per-workspace stored as an AiRationaleEnrichment row
 * at targetKind=workforce_monitoring_webhook, targetId=workspaceId
 * — same pattern as Phase 635 slack-config + Phase 622 tickLog.
 *
 * Server-only.
 */

import "server-only";

import { createHmac, timingSafeEqual, randomBytes } from "crypto";
import { prisma } from "@/lib/db";

export const MONITORING_WEBHOOK_TARGET_KIND = "workforce_monitoring_webhook";

export type WebhookProvider =
  | "datadog"
  | "prometheus_alertmanager"
  | "pagerduty"
  | "grafana"
  | "opsgenie"
  | "generic";

export interface MonitoringWebhookConfig {
  webhookSecret: string;
  provider: WebhookProvider;
  enabled: boolean;
  autoAnalyze: boolean;
  /** Daily AI-spend cap for auto-analyze in cents. 0 = no cap. */
  dailyCostCapCents: number;
}

export const PROVIDER_LABEL: Record<WebhookProvider, { label: string; signatureHeader: string; sampleNote: string }> = {
  datadog: {
    label: "Datadog",
    signatureHeader: "X-Datadog-Signature",
    sampleNote: "Configure under Monitors → Notify your team → @webhook-visionxixlabs",
  },
  prometheus_alertmanager: {
    label: "Prometheus AlertManager",
    signatureHeader: "X-Webhook-Signature",
    sampleNote: "Add a webhook_configs entry in alertmanager.yml with your shared secret",
  },
  pagerduty: {
    label: "PagerDuty",
    signatureHeader: "X-PagerDuty-Signature",
    sampleNote: "Add an Extension of type Generic Webhook to your service",
  },
  grafana: {
    label: "Grafana",
    signatureHeader: "X-Webhook-Signature",
    sampleNote: "Create a Webhook contact point and set the secret header",
  },
  opsgenie: {
    label: "Opsgenie",
    signatureHeader: "X-Opsgenie-Signature",
    sampleNote: "Configure an outbound integration with Webhook URL",
  },
  generic: {
    label: "Generic Webhook",
    signatureHeader: "X-Webhook-Signature",
    sampleNote: "POST any JSON. HMAC sign the raw body with your secret using SHA-256.",
  },
};

function isValidProvider(p: string): p is WebhookProvider {
  return p === "datadog" || p === "prometheus_alertmanager" || p === "pagerduty" ||
    p === "grafana" || p === "opsgenie" || p === "generic";
}

export function generateWebhookSecret(): string {
  return `vxl_whk_${randomBytes(24).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;
}

export async function readMonitoringWebhookConfig(
  organizationId: string,
): Promise<MonitoringWebhookConfig | null> {
  try {
    const row = await prisma.aiRationaleEnrichment.findUnique({
      where: {
        organizationId_targetKind_targetId: {
          organizationId,
          targetKind: MONITORING_WEBHOOK_TARGET_KIND,
          targetId: organizationId,
        },
      },
      select: { nextActionsJson: true },
    });
    if (!row || !Array.isArray(row.nextActionsJson)) return null;
    const tags = new Map<string, string>();
    for (const e of row.nextActionsJson as unknown[]) {
      if (typeof e !== "string") continue;
      const idx = e.indexOf("|");
      if (idx === -1) continue;
      tags.set(e.slice(0, idx), e.slice(idx + 1));
    }
    const webhookSecret = tags.get("webhook_secret");
    if (!webhookSecret) return null;
    const providerRaw = tags.get("provider") ?? "generic";
    const provider: WebhookProvider = isValidProvider(providerRaw) ? providerRaw : "generic";
    const dailyCostCapCentsRaw = Number(tags.get("daily_cost_cap_cents") ?? "0");
    return {
      webhookSecret,
      provider,
      enabled: tags.get("enabled") !== "false",
      autoAnalyze: tags.get("auto_analyze") === "true",
      dailyCostCapCents: Number.isFinite(dailyCostCapCentsRaw) ? Math.max(0, dailyCostCapCentsRaw) : 0,
    };
  } catch {
    return null;
  }
}

export async function writeMonitoringWebhookConfig(
  organizationId: string,
  config: MonitoringWebhookConfig,
): Promise<void> {
  const payload: string[] = [
    `webhook_secret|${config.webhookSecret}`,
    `provider|${config.provider}`,
    `enabled|${config.enabled ? "true" : "false"}`,
    `auto_analyze|${config.autoAnalyze ? "true" : "false"}`,
    `daily_cost_cap_cents|${config.dailyCostCapCents}`,
  ];
  await prisma.aiRationaleEnrichment.upsert({
    where: {
      organizationId_targetKind_targetId: {
        organizationId,
        targetKind: MONITORING_WEBHOOK_TARGET_KIND,
        targetId: organizationId,
      },
    },
    create: {
      organizationId,
      targetKind: MONITORING_WEBHOOK_TARGET_KIND,
      targetId: organizationId,
      narrative: `Monitoring webhook configured · provider=${config.provider} · enabled=${config.enabled} · auto_analyze=${config.autoAnalyze} · daily_cap=$${(config.dailyCostCapCents / 100).toFixed(2)}`,
      riskFactorsJson: [] as unknown as string[],
      nextActionsJson: payload as unknown as string[],
      outcome: "ai_generated",
      errorMessage: null,
      modelHint: null,
      engineVersion: "monitoring-webhook-config-v1",
    },
    update: {
      narrative: `Monitoring webhook configured · provider=${config.provider} · enabled=${config.enabled} · auto_analyze=${config.autoAnalyze} · daily_cap=$${(config.dailyCostCapCents / 100).toFixed(2)}`,
      nextActionsJson: payload as unknown as string[],
    },
  });
}

export async function deleteMonitoringWebhookConfig(organizationId: string): Promise<void> {
  try {
    await prisma.aiRationaleEnrichment.delete({
      where: {
        organizationId_targetKind_targetId: {
          organizationId,
          targetKind: MONITORING_WEBHOOK_TARGET_KIND,
          targetId: organizationId,
        },
      },
    });
  } catch {
    // already gone
  }
}

/**
 * Constant-time HMAC verification. Customer's alerting tool
 * computes HMAC-SHA256 of the raw body with the webhook_secret;
 * we recompute and compare.
 *
 * Returns true when signatures match; false otherwise. Used by the
 * /api/webhooks/monitoring route for inbound auth.
 */
export function verifyWebhookSignature(
  rawBody: string,
  providedSignature: string,
  secret: string,
): boolean {
  if (!providedSignature) return false;
  // Strip "sha256=" prefix some tools (PagerDuty, Datadog) include.
  const sig = providedSignature.replace(/^sha256=/i, "").trim();
  if (sig.length === 0) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  if (sig.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

/**
 * Look up the workspace whose webhook config matches a provided
 * signature for the given raw body. Necessary because the inbound
 * route has no NextAuth session — we must identify the workspace
 * from the signature itself.
 *
 * Scans all configured webhooks and finds the one whose secret
 * produces a matching signature. O(N) over workspaces with active
 * webhook configs; acceptable until we have thousands.
 *
 * Returns the matched organizationId + config, or null when no
 * workspace's secret matches.
 */
export async function findWorkspaceFromWebhookSignature(
  rawBody: string,
  providedSignature: string,
): Promise<{ organizationId: string; config: MonitoringWebhookConfig } | null> {
  try {
    const rows = await prisma.aiRationaleEnrichment.findMany({
      where: { targetKind: MONITORING_WEBHOOK_TARGET_KIND },
      select: { organizationId: true, nextActionsJson: true },
      take: 5000,
    });
    for (const r of rows) {
      const tags = new Map<string, string>();
      if (Array.isArray(r.nextActionsJson)) {
        for (const e of r.nextActionsJson as unknown[]) {
          if (typeof e !== "string") continue;
          const idx = e.indexOf("|");
          if (idx === -1) continue;
          tags.set(e.slice(0, idx), e.slice(idx + 1));
        }
      }
      const secret = tags.get("webhook_secret");
      if (!secret) continue;
      if (verifyWebhookSignature(rawBody, providedSignature, secret)) {
        const providerRaw = tags.get("provider") ?? "generic";
        return {
          organizationId: r.organizationId,
          config: {
            webhookSecret: secret,
            provider: isValidProvider(providerRaw) ? providerRaw : "generic",
            enabled: tags.get("enabled") !== "false",
            autoAnalyze: tags.get("auto_analyze") === "true",
            dailyCostCapCents: Number(tags.get("daily_cost_cap_cents") ?? "0") || 0,
          },
        };
      }
    }
    return null;
  } catch {
    return null;
  }
}
