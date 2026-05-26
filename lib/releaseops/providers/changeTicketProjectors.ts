/**
 * Phase 463 — change-ticket projectors.
 *
 * Pure functions mapping Jira / Linear / ServiceNow ticket payloads
 * to a single normalized ChangeTicket upsert shape. No I/O.
 *
 * Status normalization is provider-specific and lossy by design — the
 * normalized closed-union is the contract the rest of the platform
 * (release readiness, evidence packs) reads against.
 */

/* ──────────────────────────────────────────────────────────────────
   Closed-union strings.
   ────────────────────────────────────────────────────────────── */

export const ALL_CHANGE_TICKET_PROVIDERS = ["jira", "linear", "servicenow", "other"] as const;
export type ChangeTicketProvider = (typeof ALL_CHANGE_TICKET_PROVIDERS)[number];

export const ALL_CHANGE_TICKET_STATUSES = [
  "pending", "in_progress", "approved", "implemented", "rejected", "cancelled",
] as const;
export type ChangeTicketStatus = (typeof ALL_CHANGE_TICKET_STATUSES)[number];

export const ALL_CHANGE_TICKET_TYPES = [
  "story", "bug", "task", "change_request", "incident", "epic",
] as const;
export type ChangeTicketType = (typeof ALL_CHANGE_TICKET_TYPES)[number];

export const ALL_CHANGE_TICKET_PRIORITIES = [
  "trivial", "low", "normal", "high", "critical",
] as const;
export type ChangeTicketPriority = (typeof ALL_CHANGE_TICKET_PRIORITIES)[number];

/* ──────────────────────────────────────────────────────────────────
   Upsert input — the persistence layer's contract.
   ────────────────────────────────────────────────────────────── */

export interface UpsertChangeTicketInput {
  organizationId: string;
  provider: ChangeTicketProvider;
  externalKey: string;
  externalId: string | null;
  title: string;
  ticketType: ChangeTicketType;
  status: ChangeTicketStatus;
  priority: ChangeTicketPriority;
  assigneeUserId: string | null;
  reporterUserId: string | null;
  labels: string[];
  webUrl: string | null;
  linkedPrRecordIds: string[];
  linkedReleaseIds: string[];
  openedAt: Date | null;
  closedAt: Date | null;
  lastSyncedAt: Date;
}

/* ──────────────────────────────────────────────────────────────────
   Jira.
   ────────────────────────────────────────────────────────────── */

export interface JiraIssue {
  id: string;
  key: string;
  self?: string;
  fields: {
    summary: string;
    issuetype?: { name?: string | null } | null;
    status?: { name?: string | null; statusCategory?: { key?: string | null } | null } | null;
    priority?: { name?: string | null } | null;
    assignee?: { accountId?: string | null } | null;
    reporter?: { accountId?: string | null } | null;
    labels?: string[] | null;
    components?: Array<{ name?: string | null }> | null;
    created?: string | null;
    resolutiondate?: string | null;
  };
}

export function projectJiraIssue(
  issue: JiraIssue,
  ctx: { organizationId: string; browseBaseUrl?: string; now: Date },
): UpsertChangeTicketInput {
  const labels = [
    ...(issue.fields.labels ?? []),
    ...((issue.fields.components ?? []).map((c) => c.name).filter((s): s is string => Boolean(s))),
  ];
  return {
    organizationId: ctx.organizationId,
    provider: "jira",
    externalKey: issue.key,
    externalId: issue.id,
    title: issue.fields.summary,
    ticketType: mapJiraType(issue.fields.issuetype?.name ?? null),
    status: mapJiraStatus(
      issue.fields.status?.name ?? null,
      issue.fields.status?.statusCategory?.key ?? null,
    ),
    priority: mapJiraPriority(issue.fields.priority?.name ?? null),
    assigneeUserId: issue.fields.assignee?.accountId ?? null,
    reporterUserId: issue.fields.reporter?.accountId ?? null,
    labels,
    webUrl: ctx.browseBaseUrl ? `${ctx.browseBaseUrl.replace(/\/$/, "")}/browse/${issue.key}` : null,
    linkedPrRecordIds: [],
    linkedReleaseIds: [],
    openedAt: issue.fields.created ? new Date(issue.fields.created) : null,
    closedAt: issue.fields.resolutiondate ? new Date(issue.fields.resolutiondate) : null,
    lastSyncedAt: ctx.now,
  };
}

export function mapJiraType(name: string | null): ChangeTicketType {
  if (!name) return "task";
  const n = name.toLowerCase();
  if (n.includes("epic")) return "epic";
  if (n.includes("story") || n.includes("user story")) return "story";
  if (n.includes("bug") || n.includes("defect")) return "bug";
  if (n.includes("change")) return "change_request";
  if (n.includes("incident") || n.includes("outage")) return "incident";
  return "task";
}

export function mapJiraStatus(name: string | null, categoryKey: string | null): ChangeTicketStatus {
  // Prefer the explicit status name; fall back to the status category.
  const n = (name ?? "").toLowerCase();
  if (n.includes("approved") || n.includes("ready for")) return "approved";
  if (n.includes("rejected") || n.includes("won't do")) return "rejected";
  if (n.includes("cancel")) return "cancelled";
  if (n.includes("done") || n.includes("closed") || n.includes("resolved") || n.includes("deployed")) {
    return "implemented";
  }
  if (n.includes("progress") || n.includes("review") || n.includes("testing") || n.includes("qa")) {
    return "in_progress";
  }
  // Fall back to the category key — "done" / "indeterminate" / "new".
  const c = (categoryKey ?? "").toLowerCase();
  if (c === "done") return "implemented";
  if (c === "indeterminate") return "in_progress";
  return "pending";
}

export function mapJiraPriority(name: string | null): ChangeTicketPriority {
  if (!name) return "normal";
  const n = name.toLowerCase();
  // Check the most-specific tokens first — "lowest" contains "low",
  // and "highest" contains "high".
  if (n.includes("trivial") || n.includes("lowest")) return "trivial";
  if (n.includes("highest") || n.includes("critical") || n.includes("blocker")) return "critical";
  if (n.includes("high") || n.includes("major")) return "high";
  if (n.includes("low") || n.includes("minor")) return "low";
  return "normal";
}

/* ──────────────────────────────────────────────────────────────────
   Linear.
   ────────────────────────────────────────────────────────────── */

export interface LinearIssue {
  id: string;
  identifier: string;
  title: string;
  url?: string | null;
  priority?: number | null;
  state?: { name?: string | null; type?: string | null } | null;
  labels?: { nodes?: Array<{ name?: string | null }> } | null;
  assignee?: { id?: string | null } | null;
  creator?: { id?: string | null } | null;
  createdAt?: string | null;
  completedAt?: string | null;
  canceledAt?: string | null;
}

export function projectLinearIssue(
  issue: LinearIssue,
  ctx: { organizationId: string; now: Date },
): UpsertChangeTicketInput {
  const labels = (issue.labels?.nodes ?? [])
    .map((n) => n.name)
    .filter((s): s is string => Boolean(s));
  const completed = issue.completedAt ? new Date(issue.completedAt) : null;
  const cancelled = issue.canceledAt ? new Date(issue.canceledAt) : null;
  return {
    organizationId: ctx.organizationId,
    provider: "linear",
    externalKey: issue.identifier,
    externalId: issue.id,
    title: issue.title,
    ticketType: mapLinearType(issue.state?.type ?? null, labels),
    status: mapLinearStatus(issue.state?.type ?? null, !!cancelled),
    priority: mapLinearPriority(issue.priority ?? null),
    assigneeUserId: issue.assignee?.id ?? null,
    reporterUserId: issue.creator?.id ?? null,
    labels,
    webUrl: issue.url ?? null,
    linkedPrRecordIds: [],
    linkedReleaseIds: [],
    openedAt: issue.createdAt ? new Date(issue.createdAt) : null,
    closedAt: cancelled ?? completed,
    lastSyncedAt: ctx.now,
  };
}

export function mapLinearType(stateType: string | null, labels: ReadonlyArray<string>): ChangeTicketType {
  const ls = labels.map((l) => l.toLowerCase());
  if (ls.some((l) => l.includes("epic"))) return "epic";
  if (ls.some((l) => l.includes("bug") || l.includes("defect"))) return "bug";
  if (ls.some((l) => l.includes("incident") || l.includes("outage"))) return "incident";
  if (ls.some((l) => l.includes("change"))) return "change_request";
  if (ls.some((l) => l.includes("story"))) return "story";
  return "task";
}

export function mapLinearStatus(stateType: string | null, cancelled: boolean): ChangeTicketStatus {
  if (cancelled) return "cancelled";
  const t = (stateType ?? "").toLowerCase();
  if (t === "completed") return "implemented";
  if (t === "canceled") return "cancelled";
  if (t === "started" || t === "in_progress") return "in_progress";
  if (t === "unstarted") return "pending";
  if (t === "backlog") return "pending";
  if (t === "triage") return "pending";
  return "pending";
}

export function mapLinearPriority(p: number | null): ChangeTicketPriority {
  // Linear: 0=No priority, 1=Urgent, 2=High, 3=Medium, 4=Low
  switch (p) {
    case 1: return "critical";
    case 2: return "high";
    case 3: return "normal";
    case 4: return "low";
    default: return "normal";
  }
}

/* ──────────────────────────────────────────────────────────────────
   ServiceNow.
   ────────────────────────────────────────────────────────────── */

export interface ServiceNowChange {
  sys_id: string;
  number: string;
  short_description: string;
  type?: string | null;
  state?: string | null;
  approval?: string | null;
  priority?: string | null;
  assigned_to?: { value?: string | null } | string | null;
  opened_by?: { value?: string | null } | string | null;
  opened_at?: string | null;
  closed_at?: string | null;
  category?: string | null;
  cmdb_ci?: { value?: string | null; display_value?: string | null } | null;
}

export function projectServiceNowChange(
  ch: ServiceNowChange,
  ctx: { organizationId: string; instanceUrl?: string; now: Date },
): UpsertChangeTicketInput {
  const labels: string[] = [];
  if (ch.category) labels.push(ch.category);
  if (ch.cmdb_ci?.display_value) labels.push(ch.cmdb_ci.display_value);
  return {
    organizationId: ctx.organizationId,
    provider: "servicenow",
    externalKey: ch.number,
    externalId: ch.sys_id,
    title: ch.short_description,
    ticketType: mapServiceNowType(ch.type ?? null, ch.category ?? null),
    status: mapServiceNowStatus(ch.state ?? null, ch.approval ?? null),
    priority: mapServiceNowPriority(ch.priority ?? null),
    assigneeUserId: refValue(ch.assigned_to),
    reporterUserId: refValue(ch.opened_by),
    labels,
    webUrl: ctx.instanceUrl ? `${ctx.instanceUrl.replace(/\/$/, "")}/nav_to.do?uri=change_request.do?sys_id=${ch.sys_id}` : null,
    linkedPrRecordIds: [],
    linkedReleaseIds: [],
    openedAt: ch.opened_at ? new Date(ch.opened_at) : null,
    closedAt: ch.closed_at ? new Date(ch.closed_at) : null,
    lastSyncedAt: ctx.now,
  };
}

export function mapServiceNowType(type: string | null, category: string | null): ChangeTicketType {
  // ServiceNow change_request module is always change_request unless
  // explicitly tagged as an incident.
  const t = (type ?? "").toLowerCase();
  const c = (category ?? "").toLowerCase();
  if (t.includes("incident") || c.includes("incident")) return "incident";
  return "change_request";
}

export function mapServiceNowStatus(state: string | null, approval: string | null): ChangeTicketStatus {
  const s = (state ?? "").toLowerCase();
  const a = (approval ?? "").toLowerCase();
  // ServiceNow numeric states: -5 new, -4 assess, -3 authorize, -2 scheduled,
  // -1 implement, 0 review, 3 closed, 4 cancelled. Names are localized.
  if (s === "cancelled" || s === "canceled" || s === "4") return "cancelled";
  if (s === "closed" || s === "3" || s.includes("review")) return "implemented";
  if (s === "implement" || s === "-1" || s === "scheduled" || s === "-2") return "in_progress";
  if (a === "rejected") return "rejected";
  if (a === "approved" || s === "authorize" || s === "-3") return "approved";
  return "pending";
}

export function mapServiceNowPriority(p: string | null): ChangeTicketPriority {
  if (!p) return "normal";
  // ServiceNow priority strings: "1 - Critical", "2 - High", "3 - Moderate", "4 - Low", "5 - Planning".
  const n = p.toLowerCase();
  if (n.startsWith("1") || n.includes("critical")) return "critical";
  if (n.startsWith("2") || n.includes("high")) return "high";
  if (n.startsWith("4") || n.includes("low")) return "low";
  if (n.startsWith("5") || n.includes("planning")) return "trivial";
  return "normal";
}

function refValue(v: { value?: string | null } | string | null | undefined): string | null {
  if (!v) return null;
  if (typeof v === "string") return v.length > 0 ? v : null;
  return v.value ?? null;
}
