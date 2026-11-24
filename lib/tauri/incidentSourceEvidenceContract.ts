import {z} from "zod";

const repoSegment = /^(?!\.{1,2}$)[A-Za-z0-9_.-]{1,100}$/;
export const githubRepositoryName = z.string().refine(name => {
  const parts = name.split("/");
  return parts.length === 2 && parts.every(part => repoSegment.test(part));
});
export const githubCommit = z.string().regex(/^[0-9a-f]{40}$/i);
export const incidentWorkflowRunLimit = 5;
export const incidentWorkflowRun = z.object({
  runId: z.string().regex(/^[1-9]\d{0,29}$/),
  name: z.string().min(1).max(160),
  status: z.enum(["queued", "in_progress", "completed"]),
  conclusion: z.enum(["success", "failure", "cancelled", "skipped", "neutral", "timed_out", "action_required", "stale"]).nullable(),
  observedAt: z.string().datetime(),
}).strict();

const comparison = z.object({
  baselineCommit: githubCommit,
  baselineTag: z.string().max(120).nullable(),
}).strict();

export const incidentSourceEvidence = z.discriminatedUnion("state", [
  z.object({state: z.literal("unavailable")}).strict(),
  z.object({
    state: z.literal("recorded"),
    repository: githubRepositoryName,
    commit: githubCommit,
    runs: z.array(incidentWorkflowRun).max(incidentWorkflowRunLimit).nullable(),
    limited: z.boolean(),
    comparison: comparison.nullable(),
  }).strict(),
]);
export type IncidentSourceEvidence = z.infer<typeof incidentSourceEvidence>;

export function incidentWorkflowUrl(repository: string, runId: string) {
  return `https://github.com/${repository}/actions/runs/${runId}`;
}

export function incidentComparisonUrl(repository: string, baselineCommit: string, commit: string) {
  return `https://github.com/${repository}/compare/${baselineCommit}..${commit}`;
}
