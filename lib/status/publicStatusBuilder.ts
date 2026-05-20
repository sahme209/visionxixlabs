/**
 * Public status report builder.
 *
 * Produces a tenant-agnostic snapshot suitable for an unauthenticated
 * /status page. Components map to durable Prisma-row signals (writes
 * within the last 24h ⇒ "operational") + an in-memory cron health
 * snapshot + the AGI self-diagnostic.
 *
 * Hard rules:
 *   - Pure aggregation; no secrets in the response.
 *   - Per-component verdict ladder: operational | degraded | down.
 *   - DB failure on any component → that component returns 'unknown',
 *     not 'down'. We avoid false-alarming on transient DB blips.
 */

import "server-only";

import { prisma } from "@/lib/db";
import { CRON_CATALOG } from "@/lib/autonomy/cronHealthCatalog";
import { readCronHealth } from "@/lib/autonomy/cronHealthTracker";
import { runAgiSelfDiagnostic } from "@/lib/autonomy/agiSelfDiagnostic";

export type StatusVerdict = "operational" | "degraded" | "down" | "unknown";

export interface StatusComponent {
  id: string;
  label: string;
  verdict: StatusVerdict;
  detail: string;
}

export interface PublicStatusReport {
  generatedAt: string;
  overall: StatusVerdict;
  components: StatusComponent[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

export async function buildPublicStatus(): Promise<PublicStatusReport> {
  const components: StatusComponent[] = [];

  components.push(await checkAutonomyLoop());
  components.push(await checkOutboundChannel());
  components.push(await checkBillingPlane());
  components.push(checkCronSelfHeal());
  components.push(checkAgiSpine());

  const overall = rollUp(components);

  return {
    generatedAt: new Date().toISOString(),
    overall,
    components,
  };
}

async function checkAutonomyLoop(): Promise<StatusComponent> {
  try {
    const since = new Date(Date.now() - DAY_MS);
    const recent = await prisma.autonomyDecisionRationale.count({
      where: { createdAt: { gte: since } },
    });
    if (recent === 0) {
      return {
        id: "autonomy_loop",
        label: "Autonomy loop",
        verdict: "degraded",
        detail: "No rationale rows in the last 24h. Either the scheduler is off or no candidates surfaced.",
      };
    }
    return {
      id: "autonomy_loop",
      label: "Autonomy loop",
      verdict: "operational",
      detail: `${recent} candidate decision(s) recorded in the last 24h.`,
    };
  } catch {
    return { id: "autonomy_loop", label: "Autonomy loop", verdict: "unknown", detail: "Could not query rationale store." };
  }
}

async function checkOutboundChannel(): Promise<StatusComponent> {
  try {
    const since = new Date(Date.now() - DAY_MS);
    const rows = await prisma.outboundNotificationRecord.findMany({
      where: { createdAt: { gte: since } },
      select: { outcome: true },
      take: 1000,
    });
    if (rows.length === 0) {
      return {
        id: "outbound_channel",
        label: "Outbound notifications (Slack/Teams)",
        verdict: "operational",
        detail: "No send attempts in the last 24h — nothing to flag.",
      };
    }
    const failed = rows.filter((r) => r.outcome === "failed").length;
    const ratio = failed / rows.length;
    if (ratio >= 0.5) {
      return {
        id: "outbound_channel",
        label: "Outbound notifications (Slack/Teams)",
        verdict: "down",
        detail: `${failed}/${rows.length} sends failed in the last 24h.`,
      };
    }
    if (ratio >= 0.1) {
      return {
        id: "outbound_channel",
        label: "Outbound notifications (Slack/Teams)",
        verdict: "degraded",
        detail: `${failed}/${rows.length} sends failed in the last 24h.`,
      };
    }
    return {
      id: "outbound_channel",
      label: "Outbound notifications (Slack/Teams)",
      verdict: "operational",
      detail: `${rows.length - failed}/${rows.length} sends succeeded in the last 24h.`,
    };
  } catch {
    return { id: "outbound_channel", label: "Outbound notifications (Slack/Teams)", verdict: "unknown", detail: "Could not query notification record store." };
  }
}

async function checkBillingPlane(): Promise<StatusComponent> {
  try {
    await prisma.tenantBillingPlan.count();
    return {
      id: "billing_plane",
      label: "Billing + Stripe webhook",
      verdict: "operational",
      detail: "Billing tables reachable.",
    };
  } catch {
    return { id: "billing_plane", label: "Billing + Stripe webhook", verdict: "unknown", detail: "Billing-plan store unreachable." };
  }
}

function checkCronSelfHeal(): StatusComponent {
  let totalDown = 0;
  for (const cron of CRON_CATALOG) {
    const h = readCronHealth({ cronName: cron.id });
    if (h.consecutiveFailures >= 3) totalDown++;
  }
  if (totalDown === 0) {
    return {
      id: "cron_self_heal",
      label: "Cron schedulers",
      verdict: "operational",
      detail: `${CRON_CATALOG.length} cron(s) tracked. No self-heal skip in effect.`,
    };
  }
  if (totalDown >= CRON_CATALOG.length / 2) {
    return {
      id: "cron_self_heal",
      label: "Cron schedulers",
      verdict: "down",
      detail: `${totalDown} cron(s) are self-heal skipping (last 3 ticks errored).`,
    };
  }
  return {
    id: "cron_self_heal",
    label: "Cron schedulers",
    verdict: "degraded",
    detail: `${totalDown} of ${CRON_CATALOG.length} cron(s) currently skipping due to consecutive errors.`,
  };
}

function checkAgiSpine(): StatusComponent {
  try {
    const diag = runAgiSelfDiagnostic();
    if (diag.failCount === 0) {
      return {
        id: "agi_spine",
        label: "AGI loop spine",
        verdict: "operational",
        detail: `${diag.passCount}/${diag.totalChecks} self-diagnostic checks pass.`,
      };
    }
    return {
      id: "agi_spine",
      label: "AGI loop spine",
      verdict: diag.failCount >= 3 ? "down" : "degraded",
      detail: `${diag.failCount} of ${diag.totalChecks} self-diagnostic checks failing.`,
    };
  } catch {
    return { id: "agi_spine", label: "AGI loop spine", verdict: "unknown", detail: "Self-diagnostic threw." };
  }
}

function rollUp(components: StatusComponent[]): StatusVerdict {
  if (components.some((c) => c.verdict === "down")) return "down";
  if (components.some((c) => c.verdict === "degraded")) return "degraded";
  if (components.every((c) => c.verdict === "operational")) return "operational";
  return "unknown";
}
