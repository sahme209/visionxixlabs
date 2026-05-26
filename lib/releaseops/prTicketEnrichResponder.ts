/**
 * Phase 472 — PR ↔ change-ticket enrichment orchestrator.
 *
 * Loads recent PRs + every ChangeTicket for an org, runs each PR
 * through the Phase 465 linker, and writes back the ticket-side
 * linkedPrRecordIds[]. The link is stored on the ticket (not the PR)
 * because tickets are 1-many → PRs.
 */

import { linkPrToTickets, type CandidateTicket } from "./prTicketLinker";
import { isMissingTable } from "./releaseListResponder";
import type { ChangeTicketProvider } from "./providers/changeTicketProjectors";

/* ──────────────────────────────────────────────────────────────────
   Repo contract.
   ────────────────────────────────────────────────────────────── */

export interface EnrichPrRow {
  id: string;
  organizationId: string;
  title: string;
  /** PullRequestRecord doesn't carry the body today — Phase 452
   *  populates title only. We still scan title for keys. */
  body?: string | null;
}

export interface EnrichTicketRow {
  id: string;
  organizationId: string;
  provider: string;
  externalKey: string;
  linkedPrRecordIds: string[];
}

export interface PrTicketEnrichRepo {
  pullRequestRecord: {
    findMany(args: {
      where: { organizationId: string };
      orderBy: { updatedAt: "desc" };
      take?: number;
    }): Promise<EnrichPrRow[]>;
  };
  changeTicket: {
    findMany(args: {
      where: { organizationId: string };
    }): Promise<EnrichTicketRow[]>;
    update(args: {
      where: { id: string };
      data: { linkedPrRecordIds: string[]; updatedAt: Date };
    }): Promise<{ id: string }>;
  };
}

/* ──────────────────────────────────────────────────────────────────
   Input + output.
   ────────────────────────────────────────────────────────────── */

export interface BuildPrTicketEnrichInput {
  organizationId: string;
  /** Cap on PRs scanned this run. Defaults to 200. */
  prLimit?: number;
}

export type PrTicketEnrichBody =
  | {
      ok: true;
      data: {
        prsScanned: number;
        ticketsConsidered: number;
        ticketsUpdated: number;
        linksAdded: number;
        linksRemoved: number;
        unresolvedKeys: string[];
        completedAtIso: string;
      };
    }
  | { ok: false; error: string; hint?: string; correlationId?: string };

export interface ResponderResult { status: number; body: PrTicketEnrichBody }

/* ──────────────────────────────────────────────────────────────────
   Public surface.
   ────────────────────────────────────────────────────────────── */

export async function buildPrTicketEnrichResponse(
  repo: PrTicketEnrichRepo,
  input: BuildPrTicketEnrichInput,
  opts: { now?: Date; correlationId?: string } = {},
): Promise<ResponderResult> {
  try {
    const now = opts.now ?? new Date();
    const tickets = await repo.changeTicket.findMany({ where: { organizationId: input.organizationId } });
    const candidates: CandidateTicket[] = tickets.map((t) => ({
      id: t.id,
      provider: narrowProvider(t.provider),
      externalKey: t.externalKey,
    }));

    const prs = await repo.pullRequestRecord.findMany({
      where: { organizationId: input.organizationId },
      orderBy: { updatedAt: "desc" },
      take: input.prLimit ?? 200,
    });

    // Aggregate: per ticket, the set of PR ids that mention it.
    const newLinksByTicket = new Map<string, Set<string>>();
    const unresolvedSet = new Set<string>();

    for (const pr of prs) {
      const result = linkPrToTickets({
        prId: pr.id,
        prTitle: pr.title,
        prBody: pr.body ?? null,
        candidates,
      });
      for (const ticketId of result.matchedTicketIds) {
        if (!newLinksByTicket.has(ticketId)) newLinksByTicket.set(ticketId, new Set());
        newLinksByTicket.get(ticketId)!.add(pr.id);
      }
      for (const k of result.unresolvedExternalKeys) unresolvedSet.add(k);
    }

    // Diff against current ticket.linkedPrRecordIds and write back when changed.
    let ticketsUpdated = 0;
    let linksAdded = 0;
    let linksRemoved = 0;
    for (const ticket of tickets) {
      const next = Array.from(newLinksByTicket.get(ticket.id) ?? new Set<string>()).sort();
      const prev = ticket.linkedPrRecordIds.slice().sort();
      if (arraysEqual(next, prev)) continue;
      await repo.changeTicket.update({
        where: { id: ticket.id },
        data: { linkedPrRecordIds: next, updatedAt: now },
      });
      ticketsUpdated += 1;
      // Set diff for the counter.
      const prevSet = new Set(prev);
      const nextSet = new Set(next);
      for (const id of next) if (!prevSet.has(id)) linksAdded += 1;
      for (const id of prev) if (!nextSet.has(id)) linksRemoved += 1;
    }

    return {
      status: 200,
      body: {
        ok: true,
        data: {
          prsScanned: prs.length,
          ticketsConsidered: tickets.length,
          ticketsUpdated,
          linksAdded,
          linksRemoved,
          unresolvedKeys: Array.from(unresolvedSet).sort(),
          completedAtIso: now.toISOString(),
        },
      },
    };
  } catch (err) {
    if (isMissingTable(err)) {
      return {
        status: 503,
        body: { ok: false, error: "migration_pending", hint: "Phase 466 migration not yet applied." },
      };
    }
    return {
      status: 500,
      body: { ok: false, error: "internal_error", ...(opts.correlationId ? { correlationId: opts.correlationId } : {}) },
    };
  }
}

function narrowProvider(p: string): ChangeTicketProvider {
  return (p === "jira" || p === "linear" || p === "servicenow" || p === "other") ? p : "other";
}

function arraysEqual(a: ReadonlyArray<string>, b: ReadonlyArray<string>): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
