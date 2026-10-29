import { z } from "zod";

const timestamp = z.string().max(50).regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/).refine(value => Number.isFinite(Date.parse(value)));
const identifier = (max: number) => z.string().min(1).max(max).refine(value => value === value.trim() && !/[\0\r\n]/.test(value));
/** Selected evidence only; never carries approval, credentials, or an execution grant. */
export const releaseAirflowDependencySchema = z.object({
  connectionId: identifier(160),
  connectionUpdatedAt: timestamp,
  runs: z.array(z.object({ dagId: identifier(250), dagRunId: identifier(1000), logicalDate: timestamp }).strict()).min(1).max(25)
    .refine(runs => new Set(runs.map(run => JSON.stringify([run.dagId, run.dagRunId]))).size === runs.length),
}).strict();
export type ReleaseAirflowDependency = z.infer<typeof releaseAirflowDependencySchema>;
