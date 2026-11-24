import { z } from "zod";

export const observedAirflowInstant = z.string().max(40).datetime({offset: true}).refine(value => Number.isFinite(Date.parse(value)));
const timing = z.object({
  startedAt: observedAirflowInstant.nullable(),
  endedAt: observedAirflowInstant.nullable(),
}).strict().refine(({startedAt, endedAt}) => !startedAt || !endedAt || Date.parse(startedAt) <= Date.parse(endedAt));

const runIdentity = z.object({
  dagId: z.string().min(1).max(250),
  dagRunId: z.string().min(1).max(1000),
}).strict();

const runObservation = runIdentity.extend({
  state: z.enum(["queued", "running", "success", "failed"]),
  timing: timing.optional(),
}).strict();

export type ReleaseBatchRunObservation = z.infer<typeof runObservation>;

const runBinding = z.object({
  requestId: z.string().min(1).max(160),
  version: z.number().int().positive(),
}).strict();

function uniqueRuns({runs}: {runs: Array<z.infer<typeof runIdentity>>}) {
  return new Set(runs.map(run => JSON.stringify([run.dagId, run.dagRunId]))).size === runs.length;
}

const observationsSchema = runBinding.extend({runs: z.array(runObservation).min(1).max(25)}).refine(uniqueRuns);
const declarationsSchema = runBinding.extend({runs: z.array(runIdentity).min(1).max(25)}).refine(uniqueRuns);
export type ReleaseBatchDeclarations = z.infer<typeof declarationsSchema>;

export function isReleaseBatchDeclarations(value: unknown, requestId: string | undefined, version: number): value is ReleaseBatchDeclarations {
  const result = declarationsSchema.safeParse(value);
  return result.success && result.data.requestId === requestId && result.data.version === version;
}

export type ReleaseBatchReadiness = (
  | { ready: true; requestVersion: number }
  | { ready: false; reason: "unavailable" | "changed" | "waiting" }
) & { observations?: z.infer<typeof observationsSchema>; declarations?: ReleaseBatchDeclarations };

export function isReleaseBatchReadiness(value: unknown, expectedVersion: number, requestId?: string): value is ReleaseBatchReadiness {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const result = value as Record<string, unknown>;
  const validAggregate = result.ready === true ? result.requestVersion === expectedVersion : result.ready === false
    && (result.reason === "unavailable" || result.reason === "changed" || result.reason === "waiting");
  if (!validAggregate) return false;
  if (result.declarations !== undefined) {
    if (result.ready !== false || result.reason !== "unavailable" || result.observations !== undefined) return false;
    return isReleaseBatchDeclarations(result.declarations, requestId, expectedVersion);
  }
  if (result.observations === undefined) return true;
  const observations = observationsSchema.safeParse(result.observations);
  if (!observations.success || observations.data.requestId !== requestId || observations.data.version !== expectedVersion) return false;
  const runs = observations.data.runs;
  if (runs.every(run => run.state === "success")) return result.ready === true;
  return result.ready === false && result.reason === (runs.some(run => run.state === "failed") ? "unavailable" : "waiting");
}

const releaseTaskPage = z.object({
  requestId: z.string().min(1).max(160),
  version: z.number().int().positive(),
  dagId: z.string().min(1).max(250),
  dagRunId: z.string().min(1).max(1000),
  offset: z.number().int().nonnegative(),
  totalEntries: z.number().int().nonnegative(),
  tasks: z.array(z.object({
    taskId: z.string().min(1).max(1024),
    mapIndex: z.number().int().min(-1),
    tryNumber: z.number().int().nonnegative(),
    state: z.string().max(100).nullable(),
    startedAt: observedAirflowInstant.nullable(),
    endedAt: observedAirflowInstant.nullable(),
  }).strict()).max(100),
}).strict();

export type ReleaseBatchTaskPage = z.infer<typeof releaseTaskPage>;

export function isReleaseBatchTaskPage(value: unknown, expected: Omit<ReleaseBatchTaskPage, "tasks" | "totalEntries">): value is ReleaseBatchTaskPage {
  const parsed = releaseTaskPage.safeParse(value);
  if (!parsed.success) return false;
  const page = parsed.data;
  return page.requestId === expected.requestId && page.version === expected.version && page.dagId === expected.dagId &&
    page.dagRunId === expected.dagRunId && page.offset === expected.offset &&
    (page.tasks.length === 0 || page.offset + page.tasks.length <= page.totalEntries) &&
    new Set(page.tasks.map(task => JSON.stringify([task.taskId, task.mapIndex]))).size === page.tasks.length;
}
