/**
 * Phase 464 — change-ticket inbox responder.
 *
 * Read-only list of ChangeTicket rows for an org with filter support
 * for status + provider. Web and desktop consume the same shape.
 */

import { isMissingTable } from "./releaseListResponder";
import {
  ALL_CHANGE_TICKET_STATUSES,
  ALL_CHANGE_TICKET_PROVIDERS,
  ALL_CHANGE_TICKET_PRIORITIES,
  ALL_CHANGE_TICKET_TYPES,
  type ChangeTicketStatus,
  type ChangeTicketProvider,
  type ChangeTicketType,
  type ChangeTicketPriority,
} from "./providers/changeTicketProjectors";

/* ──────────────────────────────────────────────────────────────────
   Row + repo contract.
   ────────────────────────────────────────────────────────────── */

export interface ChangeTicketRow {
  id: string;
  organizationId: string;
  provider: string;
  externalKey: string;
  externalId: string | null;
  title: string;
  ticketType: string;
  status: string;
  priority: string;
  assigneeUserId: string | null;
  reporterUserId: string | null;
  labels: string[];
  webUrl: string | null;
  linkedPrRecordIds: string[];
  linkedReleaseIds: string[];
  openedAt: Date | null;
  closedAt: Date | null;
  lastSyncedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChangeTicketListRepo {
  changeTicket: {
    findMany(args: {
      where: { organizationId: string; status?: { in: ChangeTicketStatus[] }; provider?: { in: ChangeTicketProvider[] } };
      orderBy: { updatedAt: "desc" };
      take?: number;
    }): Promise<ChangeTicketRow[]>;
  };
}

/* ──────────────────────────────────────────────────────────────────
   Output.
   ────────────────────────────────────────────────────────────── */

export interface ChangeTicketListRow {
  id: string;
  provider: ChangeTicketProvider | "unknown";
  externalKey: string;
  title: string;
  ticketType: ChangeTicketType | "unknown";
  status: ChangeTicketStatus | "unknown";
  priority: ChangeTicketPriority | "unknown";
  assigneeUserId: string | null;
  labels: string[];
  webUrl: string | null;
  linkedPrCount: number;
  linkedReleaseCount: number;
  openedAtIso: string | null;
  closedAtIso: string | null;
  lastSyncedAtIso: string;
}

export type ChangeTicketListBody =
  | {
      ok: true;
      data: {
        generatedAt: string;
        tickets: ChangeTicketListRow[];
        summary: {
          total: number;
          byStatus: Record<ChangeTicketStatus | "unknown", number>;
          byProvider: Record<ChangeTicketProvider | "unknown", number>;
        };
      };
    }
  | { ok: false; error: string; hint?: string; correlationId?: string };

export interface ResponderResult { status: number; body: ChangeTicketListBody }

export interface BuildChangeTicketListOptions {
  now?: Date;
  correlationId?: string;
  statusFilter?: ReadonlyArray<ChangeTicketStatus>;
  providerFilter?: ReadonlyArray<ChangeTicketProvider>;
  take?: number;
}

/* ──────────────────────────────────────────────────────────────────
   Public surface.
   ────────────────────────────────────────────────────────────── */

export async function buildChangeTicketListResponse(
  repo: ChangeTicketListRepo,
  organizationId: string,
  opts: BuildChangeTicketListOptions = {},
): Promise<ResponderResult> {
  try {
    const now = opts.now ?? new Date();
    const where: {
      organizationId: string;
      status?: { in: ChangeTicketStatus[] };
      provider?: { in: ChangeTicketProvider[] };
    } = { organizationId };
    if (opts.statusFilter && opts.statusFilter.length > 0) {
      where.status = { in: Array.from(opts.statusFilter) };
    }
    if (opts.providerFilter && opts.providerFilter.length > 0) {
      where.provider = { in: Array.from(opts.providerFilter) };
    }
    const rows = await repo.changeTicket.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      ...(opts.take ? { take: opts.take } : {}),
    });

    const tickets: ChangeTicketListRow[] = rows.map((r) => ({
      id: r.id,
      provider: narrowProvider(r.provider),
      externalKey: r.externalKey,
      title: r.title,
      ticketType: narrowType(r.ticketType),
      status: narrowStatus(r.status),
      priority: narrowPriority(r.priority),
      assigneeUserId: r.assigneeUserId,
      labels: r.labels,
      webUrl: r.webUrl,
      linkedPrCount: r.linkedPrRecordIds.length,
      linkedReleaseCount: r.linkedReleaseIds.length,
      openedAtIso: r.openedAt ? r.openedAt.toISOString() : null,
      closedAtIso: r.closedAt ? r.closedAt.toISOString() : null,
      lastSyncedAtIso: r.lastSyncedAt.toISOString(),
    }));

    const byStatus: Record<ChangeTicketStatus | "unknown", number> = {
      pending: 0, in_progress: 0, approved: 0, implemented: 0, rejected: 0, cancelled: 0, unknown: 0,
    };
    const byProvider: Record<ChangeTicketProvider | "unknown", number> = {
      jira: 0, linear: 0, servicenow: 0, other: 0, unknown: 0,
    };
    for (const t of tickets) {
      byStatus[t.status] += 1;
      byProvider[t.provider] += 1;
    }

    return {
      status: 200,
      body: {
        ok: true,
        data: {
          generatedAt: now.toISOString(),
          tickets,
          summary: { total: tickets.length, byStatus, byProvider },
        },
      },
    };
  } catch (err) {
    if (isMissingTable(err)) {
      return {
        status: 503,
        body: { ok: false, error: "migration_pending", hint: "ChangeTicket table not yet migrated. Run the Phase 463 migration." },
      };
    }
    return {
      status: 500,
      body: { ok: false, error: "internal_error", ...(opts.correlationId ? { correlationId: opts.correlationId } : {}) },
    };
  }
}

function narrowStatus(s: string): ChangeTicketStatus | "unknown" {
  return (ALL_CHANGE_TICKET_STATUSES as readonly string[]).includes(s)
    ? (s as ChangeTicketStatus) : "unknown";
}
function narrowProvider(p: string): ChangeTicketProvider | "unknown" {
  return (ALL_CHANGE_TICKET_PROVIDERS as readonly string[]).includes(p)
    ? (p as ChangeTicketProvider) : "unknown";
}
function narrowType(t: string): ChangeTicketType | "unknown" {
  return (ALL_CHANGE_TICKET_TYPES as readonly string[]).includes(t)
    ? (t as ChangeTicketType) : "unknown";
}
function narrowPriority(p: string): ChangeTicketPriority | "unknown" {
  return (ALL_CHANGE_TICKET_PRIORITIES as readonly string[]).includes(p)
    ? (p as ChangeTicketPriority) : "unknown";
}
