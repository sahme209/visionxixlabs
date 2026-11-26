/**
 * Applies a workspace deployment freeze, or ends one early, against stored environments. Shared by the
 * cockpit route (owners and admins) and the API route (keys with freeze:start, start only). Each
 * environment is written compare-and-set on updatedAt inside one transaction: all or nothing.
 */
import "server-only";
import { Prisma } from "@/lib/prismaClient";
import { prisma } from "@/lib/db";
import { workspaceUnenrolled } from "@/lib/governance/intelligence/enrolledRefusal";
import { dispatchWebhookEvent } from "@/lib/webhooks/dispatchWebhookEvent";
import { addFreeze, endFreezeEarly } from "./deploymentFreeze";

const MAX_ENVIRONMENTS = 100;
type Row = { id: string; name: string; tier: string; changeWindowRuleJson: unknown; updatedAt: Date };
export type FreezeRequest = { action: "start"; scope: "production" | "all"; hours: number; reason: string } | { action: "end"; reason: string };
export type FreezeOutcome =
  | { ok: true; environments: string[]; skipped: string[]; endsAt: string | null }
  | { ok: false; error: "governance_configuration_mutation_unavailable" | "no_environments_to_freeze" | "no_matching_freeze" | "environments_changed"; skipped?: string[] };

export async function applyDeploymentFreeze(organizationId: string, request: FreezeRequest, now = new Date()): Promise<FreezeOutcome> {
  if (!await workspaceUnenrolled(organizationId)) return { ok: false, error: "governance_configuration_mutation_unavailable" };
  const rows = await prisma.environment.findMany({ where: { organizationId, ...(request.action === "start" && request.scope === "production" ? { tier: "prod" as never } : {}) }, take: MAX_ENVIRONMENTS, select: { id: true, name: true, tier: true, changeWindowRuleJson: true, updatedAt: true } }) as unknown as Row[];
  const endsAt = request.action === "start" ? new Date(now.getTime() + request.hours * 3_600_000).toISOString() : null;
  const writes: Array<{ row: Row; rule: unknown }> = []; const skipped: string[] = [];
  for (const row of rows) {
    if (request.action === "start") {
      const r = addFreeze(row.changeWindowRuleJson, { startUtc: now.toISOString(), endUtc: endsAt!, reason: request.reason }, now);
      if (r.ok) writes.push({ row, rule: r.rule }); else skipped.push(`${row.name}: ${r.error === "rule_unreadable" ? "its change window cannot be read, so deployments there are already refused" : "it already has 50 active or upcoming freezes"}`);
    } else {
      const r = endFreezeEarly(row.changeWindowRuleJson, request.reason, now);
      if (r.ok && r.ended > 0) writes.push({ row, rule: r.rule });
    }
  }
  if (!writes.length) return { ok: false, error: request.action === "start" ? "no_environments_to_freeze" : "no_matching_freeze", skipped };
  try {
    await prisma.$transaction(async (tx) => {
      for (const w of writes) {
        const res = await tx.environment.updateMany({ where: { id: w.row.id, organizationId, updatedAt: w.row.updatedAt }, data: { changeWindowRuleJson: w.rule === null ? Prisma.DbNull : (w.rule as Prisma.InputJsonValue) } });
        if (res.count !== 1) throw new Error("environments_changed");
      }
    });
  } catch (err) {
    if ((err as Error).message === "environments_changed") return { ok: false, error: "environments_changed" };
    throw err;
  }
  const names = writes.map((w) => w.row.name);
  try {
    await dispatchWebhookEvent({ organizationId, eventKind: request.action === "start" ? "deployment.freeze_started" : "deployment.freeze_ended", data: { reason: request.reason, environments: names, ...(request.action === "start" ? { scope: request.scope, endsAt } : {}) }, fireImmediately: true });
  } catch { /* best-effort: a webhook outage never undoes the freeze */ }
  return { ok: true, environments: names, skipped, endsAt };
}
