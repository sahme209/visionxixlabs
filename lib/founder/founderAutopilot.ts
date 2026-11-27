/**
 * Runs the founder autopilot once: reads the stored blueprint (or the default draft) and live
 * signals, plans changes, and saves them as a new version with a compare-and-set write, so a run
 * never overwrites an edit made at the same time. Paused autopilot and runs with nothing to do save
 * nothing. Founder-only callers or the cron secret only.
 */
import "server-only";
import { prisma } from "@/lib/db";
import { validateBlueprint, type Blueprint } from "./blueprint";
import { DEFAULT_BLUEPRINT } from "./defaultBlueprint";
import { readFounderSignals } from "./founderSignals";
import { AUTOPILOT_ACTOR, autopilotSummary, planAutopilot, type AutopilotAction } from "./autopilot";

const BLUEPRINT_ID = "company";
export type AutopilotRun =
  | { outcome: "applied"; version: number; actions: AutopilotAction[]; proposals: AutopilotAction[] }
  | { outcome: "nothing_to_do" | "paused"; version: number; actions: []; proposals: AutopilotAction[] }
  | { outcome: "changed_meanwhile" | "unreadable"; version: number; actions: []; proposals: [] };

export async function runFounderAutopilot(now = new Date()): Promise<AutopilotRun> {
  const row = await prisma.founderBlueprint.findUnique({ where: { id: BLUEPRINT_ID }, select: { document: true, version: true } });
  const version = row?.version ?? 0;
  let current: Blueprint = DEFAULT_BLUEPRINT;
  if (row) { const v = validateBlueprint(row.document); if (!v.ok) return { outcome: "unreadable", version, actions: [], proposals: [] }; current = v.blueprint; }
  if (current.autopilot.paused) return { outcome: "paused", version, actions: [], proposals: [] };
  const signals = await readFounderSignals(now);
  const plan = planAutopilot(current, signals, now);
  if (plan.actions.length === 0) return { outcome: "nothing_to_do", version, actions: [], proposals: plan.proposals };
  const valid = validateBlueprint(plan.next);
  if (!valid.ok) return { outcome: "unreadable", version, actions: [], proposals: [] };
  const summary = autopilotSummary(plan.actions);
  const saved = await prisma.$transaction(async (tx) => {
    const latest = await tx.founderBlueprint.findUnique({ where: { id: BLUEPRINT_ID }, select: { version: true } });
    if ((latest?.version ?? 0) !== version) return null;
    const nextVersion = version + 1;
    if (latest) {
      const r = await tx.founderBlueprint.updateMany({ where: { id: BLUEPRINT_ID, version }, data: { document: valid.blueprint as object, version: nextVersion, updatedByEmail: AUTOPILOT_ACTOR } });
      if (r.count !== 1) return null;
    } else {
      await tx.founderBlueprint.create({ data: { id: BLUEPRINT_ID, document: valid.blueprint as object, version: nextVersion, updatedByEmail: AUTOPILOT_ACTOR } });
    }
    await tx.founderBlueprintRevision.create({ data: { blueprintId: BLUEPRINT_ID, version: nextVersion, document: valid.blueprint as object, summary, savedByEmail: AUTOPILOT_ACTOR } });
    return nextVersion;
  });
  if (saved === null) return { outcome: "changed_meanwhile", version, actions: [], proposals: [] };
  return { outcome: "applied", version: saved, actions: plan.actions, proposals: plan.proposals };
}
