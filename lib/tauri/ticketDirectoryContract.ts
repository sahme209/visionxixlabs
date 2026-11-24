import {z} from "zod";
import {incidentOwner} from "./incidentAssignmentContract";
import {incidentSourceEvidence} from "./incidentSourceEvidenceContract";

export const ticketDirectoryLimit = 80;
export const ticketDirectoryBodyLimit = 512 * 1024;
const id = z.string().min(1).max(256);
const instant = z.string().datetime();
const scope = {id, title: z.string().max(240)};
const incidentReleaseContext = z.object({
  application: z.string().min(1).max(120).nullable(),
  environment: z.string().min(1).max(120).nullable(),
}).strict();
export type IncidentReleaseContext = z.infer<typeof incidentReleaseContext>;

export const incidentTriagePriority = z.enum(["P0","P1","P2","P3"]);
export const incidentResponseTarget = z.object({
  deadline:instant, priority:incidentTriagePriority, decision:z.enum(["suggested","accepted","overridden"]),
}).strict();
export type IncidentResponseTarget = z.infer<typeof incidentResponseTarget>;

const record = z.discriminatedUnion("kind", [
  z.object({
    ...scope, kind: z.literal("change"), reference: z.string().max(120),
    provider: z.enum(["jira", "linear", "servicenow", "other", "unknown"]),
    type: z.enum(["story", "bug", "task", "change_request", "incident", "epic", "unknown"]),
    status: z.enum(["pending", "in_progress", "approved", "implemented", "rejected", "cancelled", "unknown"]),
    priority: z.enum(["trivial", "low", "normal", "high", "critical", "unknown"]),
    observedAt: instant, relatedReleases: z.number().int().nonnegative(),
  }),
  z.object({
    ...scope, kind: z.literal("incident"), releaseId: id, releaseContext: incidentReleaseContext.nullable().optional(),
    status: z.enum(["open", "mitigated", "resolved", "wont_fix", "unknown"]),
    severity: z.enum(["low", "medium", "high", "critical", "unknown"]),
    summary: z.string().max(600).nullable(), reportedAt: instant,
    mitigatedAt: instant.nullable(), resolvedAt: instant.nullable(), revision: instant.optional(), owner:incidentOwner.optional(), responseTarget:incidentResponseTarget.optional(),
  }),
]);
const source = z.object({state: z.enum(["available", "unavailable", "migration_pending"]), limited: z.boolean()});
export const ticketDirectorySchema = z.object({
  workspaceId: id, actorId: id,
  assignmentAvailable: z.boolean().optional(),
  sources: z.object({changes: source, incidents: source}),
  records: z.array(record).max(ticketDirectoryLimit * 2),
}).refine(data => {
  const seen = new Set<string>();
  const count = {changes: 0, incidents: 0};
  return data.records.every(row => {
    const key = `${row.kind}:${row.id}`;
    const group = row.kind === "change" ? "changes" : "incidents";
    if (seen.has(key) || data.sources[group].state !== "available" || ++count[group] > ticketDirectoryLimit) return false;
    seen.add(key);
    return true;
  });
});

export type TicketDirectory = z.infer<typeof ticketDirectorySchema>;
export type TicketRecord = TicketDirectory["records"][number];

export const ticketReleaseLinkLimit = 20;
export const ticketLinkId = z.string().regex(/^[A-Za-z0-9_-]{1,160}$/);
export const changeDraftSourceSchema = z.object({
  id: ticketLinkId,
  provider: z.enum(["jira", "servicenow"]),
  reference: z.string().min(1).max(120),
}).strict();
export type ChangeDraftSource = z.infer<typeof changeDraftSourceSchema>;

export const ticketReleaseLinksSchema = z.object({
  workspaceId: id,
  actorId: id,
  ticketId: ticketLinkId,
  incomplete: z.boolean(),
  releases: z.array(z.object({id: ticketLinkId, tag: z.string().max(120).nullable()}).strict()).max(ticketReleaseLinkLimit),
}).strict().refine(value => new Set(value.releases.map(release => release.id)).size === value.releases.length);

export type TicketReleaseLinks = z.infer<typeof ticketReleaseLinksSchema>;

const incidentEvidence = z.discriminatedUnion("state", [
  z.object({state: z.literal("missing")}).strict(),
  z.object({state: z.literal("unavailable")}).strict(),
  z.object({
    state: z.literal("recorded"),
    generatedAt: instant,
    branchCheckCount: z.number().int().nonnegative(),
    changeTicketCount: z.number().int().nonnegative(),
    readiness: z.object({score: z.number().int().min(0).max(100), evaluatedAt: instant.nullable()}).strict().nullable(),
  }).strict(),
]);
export type IncidentEvidence = z.infer<typeof incidentEvidence>;

const releaseCommit = z.string().regex(/^[a-f0-9]{40}([a-f0-9]{24})?$/i);
const incidentRecovery = z.discriminatedUnion("state", [
  z.object({state: z.literal("missing")}).strict(),
  z.object({state: z.literal("unavailable")}).strict(),
  z.object({
    state: z.literal("recorded"),
    releaseId: ticketLinkId,
    tag: z.string().max(120).nullable(),
    commit: releaseCommit,
  }).strict(),
]);
export type IncidentRecovery = z.infer<typeof incidentRecovery>;

export const incidentReleaseShape = z.object({
  workspaceId: id,
  actorId: id,
  incidentId: ticketLinkId,
  incidentStatus: z.enum(["open", "mitigated", "resolved", "wont_fix", "unknown"]),
  evidence: incidentEvidence.optional(),
  sources: incidentSourceEvidence.optional(),
  recovery: incidentRecovery.optional(),
  release: z.object({
    id: ticketLinkId,
    tag: z.string().max(120).nullable(),
    commit: releaseCommit.nullable(),
    status: z.enum(["draft", "ready", "deploying", "deployed", "rolled_back", "failed", "unknown"]),
  }).strict(),
}).strict();
export const incidentReleaseSchema = incidentReleaseShape.refine(value =>
  value.sources?.state !== "recorded" || value.sources.commit === value.release.commit);
export type IncidentRelease = z.infer<typeof incidentReleaseSchema>;

export const incidentActivityLimit = 20;
export const incidentActivityAction = z.enum(["mitigate", "resolve", "reopen", "wont_fix"]);
export const incidentActivitySchema = z.object({
  workspaceId: id,
  actorId: id,
  incidentId: ticketLinkId,
  releaseId: ticketLinkId,
  limited: z.boolean(),
  events: z.array(z.object({
    id: ticketLinkId,
    action: incidentActivityAction,
    recordedAt: instant,
  }).strict()).max(incidentActivityLimit),
}).strict().refine(data => new Set(data.events.map(event => event.id)).size === data.events.length);
export type IncidentActivity = z.infer<typeof incidentActivitySchema>;

const incidentTriageRecommendation = z.object({
  id: ticketLinkId,
  priority: incidentTriagePriority,
  suggestedTeam: z.string().min(1).max(80),
  rationale: z.string().max(1200),
  decision: z.enum(["pending", "accepted", "overridden", "dismissed"]),
  decidedAt: instant.nullable(),
  overridePriority: incidentTriagePriority.nullable(),
  generatedAt: instant,
}).strict().refine(row => (row.decision === "dismissed" || (row.decision === "pending") === (row.decidedAt === null)) &&
  (row.decision === "overridden") === (row.overridePriority !== null));

export const incidentTriageSchema = z.object({
  workspaceId: id,
  actorId: id,
  incidentId: ticketLinkId,
  releaseId: ticketLinkId,
  recommendation: incidentTriageRecommendation.nullable(),
}).strict();
export type IncidentTriage = z.infer<typeof incidentTriageSchema>;
