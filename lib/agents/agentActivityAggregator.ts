/**
 * Pure agent-activity aggregator.
 *
 * Folds a list of AgentBusMessage rows into a per-role / per-kind activity
 * report. No DB calls — fixture-driven so it can be unit tested without
 * Prisma. The route handler in /api/agents/activity does the DB read.
 */

import { AGENT_MESSAGE_KINDS, AGENT_ROLES, type AgentMessageKind, type AgentRole } from "./agentBusModel";

export interface ActivityRow {
  agent: AgentRole;
  /** Total messages this agent sent in the window. */
  sent: number;
  /** Most recent publishedAt ISO string for this agent (or null). */
  lastActiveAt: string | null;
  /** Breakdown of message kinds this agent emitted. */
  kindBreakdown: Partial<Record<AgentMessageKind, number>>;
}

export interface KindRow {
  kind: AgentMessageKind;
  count: number;
}

export interface ActivityReport {
  /** Messages considered. */
  totalMessages: number;
  /** Earliest publishedAt ISO in the window. */
  windowStart: string | null;
  /** Latest publishedAt ISO in the window. */
  windowEnd: string | null;
  /** Always full role list — quiet agents still show with sent=0. */
  agents: ActivityRow[];
  /** Always full kind list — quiet kinds still show with count=0. */
  kinds: KindRow[];
}

export interface RawBusRow {
  sender: string;
  kind: string;
  createdAt: Date | string;
}

const isoOf = (v: Date | string): string =>
  v instanceof Date ? v.toISOString() : new Date(v).toISOString();

export function buildActivityReport(rows: readonly RawBusRow[]): ActivityReport {
  const perAgent = new Map<AgentRole, { sent: number; last: string | null; breakdown: Map<AgentMessageKind, number> }>();
  const perKind = new Map<AgentMessageKind, number>();
  for (const role of AGENT_ROLES) perAgent.set(role, { sent: 0, last: null, breakdown: new Map() });
  for (const kind of AGENT_MESSAGE_KINDS) perKind.set(kind, 0);

  let earliest: string | null = null;
  let latest: string | null = null;
  let total = 0;

  for (const r of rows) {
    const sender = r.sender as AgentRole;
    const kind = r.kind as AgentMessageKind;
    if (!perAgent.has(sender) || !perKind.has(kind)) continue;
    total += 1;
    const iso = isoOf(r.createdAt);
    if (earliest === null || iso < earliest) earliest = iso;
    if (latest === null || iso > latest) latest = iso;

    const a = perAgent.get(sender)!;
    a.sent += 1;
    if (a.last === null || iso > a.last) a.last = iso;
    a.breakdown.set(kind, (a.breakdown.get(kind) ?? 0) + 1);

    perKind.set(kind, (perKind.get(kind) ?? 0) + 1);
  }

  const agents: ActivityRow[] = AGENT_ROLES.map((role) => {
    const a = perAgent.get(role)!;
    const breakdown: Partial<Record<AgentMessageKind, number>> = {};
    for (const [k, v] of a.breakdown) breakdown[k] = v;
    return { agent: role, sent: a.sent, lastActiveAt: a.last, kindBreakdown: breakdown };
  });
  const kinds: KindRow[] = AGENT_MESSAGE_KINDS.map((k) => ({ kind: k, count: perKind.get(k) ?? 0 }));

  return { totalMessages: total, windowStart: earliest, windowEnd: latest, agents, kinds };
}
