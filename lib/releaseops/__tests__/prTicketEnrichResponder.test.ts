import { describe, expect, it } from "vitest";
import {
  buildPrTicketEnrichResponse,
  type PrTicketEnrichRepo,
  type EnrichPrRow,
  type EnrichTicketRow,
} from "../prTicketEnrichResponder";

function makeRepo(): PrTicketEnrichRepo & {
  _prs: EnrichPrRow[];
  _tickets: Map<string, EnrichTicketRow>;
  _updates: Array<{ id: string; linkedPrRecordIds: string[] }>;
} {
  const prs: EnrichPrRow[] = [];
  const tickets = new Map<string, EnrichTicketRow>();
  const updates: Array<{ id: string; linkedPrRecordIds: string[] }> = [];
  return {
    _prs: prs, _tickets: tickets, _updates: updates,
    pullRequestRecord: {
      async findMany({ where, take }) {
        const filtered = prs.filter((p) => p.organizationId === where.organizationId);
        return take ? filtered.slice(0, take) : filtered;
      },
    },
    changeTicket: {
      async findMany({ where }) {
        return Array.from(tickets.values()).filter((t) => t.organizationId === where.organizationId);
      },
      async update({ where, data }) {
        updates.push({ id: where.id, linkedPrRecordIds: data.linkedPrRecordIds });
        const t = tickets.get(where.id);
        if (t) tickets.set(where.id, { ...t, linkedPrRecordIds: data.linkedPrRecordIds });
        return { id: where.id };
      },
    },
  };
}

const NOW = new Date("2026-05-25T12:00:00Z");

describe("buildPrTicketEnrichResponse", () => {
  it("empty org → 200 ok, zeros across the board", async () => {
    const repo = makeRepo();
    const r = await buildPrTicketEnrichResponse(repo, { organizationId: "o" }, { now: NOW });
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data).toMatchObject({
      prsScanned: 0, ticketsConsidered: 0, ticketsUpdated: 0, linksAdded: 0, linksRemoved: 0,
    });
  });

  it("matches Jira-style keys in PR titles + writes back per-ticket links", async () => {
    const repo = makeRepo();
    repo._prs.push({ id: "pr_1", organizationId: "o", title: "Add SSO for PROJ-1" });
    repo._prs.push({ id: "pr_2", organizationId: "o", title: "Refactor — closes PROJ-1 and PROJ-2" });
    repo._tickets.set("t_1", { id: "t_1", organizationId: "o", provider: "jira", externalKey: "PROJ-1", linkedPrRecordIds: [] });
    repo._tickets.set("t_2", { id: "t_2", organizationId: "o", provider: "jira", externalKey: "PROJ-2", linkedPrRecordIds: [] });

    const r = await buildPrTicketEnrichResponse(repo, { organizationId: "o" }, { now: NOW });
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.prsScanned).toBe(2);
    expect(r.body.data.ticketsConsidered).toBe(2);
    expect(r.body.data.ticketsUpdated).toBe(2);
    expect(r.body.data.linksAdded).toBe(3); // t_1 ← pr_1, pr_2 (+2); t_2 ← pr_2 (+1)
    expect(r.body.data.linksRemoved).toBe(0);
    expect(repo._updates).toHaveLength(2);
  });

  it("idempotent — second run with the same data writes nothing", async () => {
    const repo = makeRepo();
    repo._prs.push({ id: "pr_1", organizationId: "o", title: "PROJ-1" });
    repo._tickets.set("t_1", { id: "t_1", organizationId: "o", provider: "jira", externalKey: "PROJ-1", linkedPrRecordIds: ["pr_1"] });

    const r = await buildPrTicketEnrichResponse(repo, { organizationId: "o" }, { now: NOW });
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.ticketsUpdated).toBe(0);
    expect(repo._updates).toHaveLength(0);
  });

  it("removes a stale link when the PR no longer mentions the ticket", async () => {
    const repo = makeRepo();
    // PR title now mentions PROJ-2 only — the PROJ-1 association should drop.
    repo._prs.push({ id: "pr_1", organizationId: "o", title: "Fix for PROJ-2" });
    repo._tickets.set("t_1", { id: "t_1", organizationId: "o", provider: "jira", externalKey: "PROJ-1", linkedPrRecordIds: ["pr_1"] });
    repo._tickets.set("t_2", { id: "t_2", organizationId: "o", provider: "jira", externalKey: "PROJ-2", linkedPrRecordIds: [] });

    const r = await buildPrTicketEnrichResponse(repo, { organizationId: "o" }, { now: NOW });
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.linksAdded).toBe(1);
    expect(r.body.data.linksRemoved).toBe(1);
    expect(r.body.data.ticketsUpdated).toBe(2);
  });

  it("surfaces unresolved external keys when no candidate matches", async () => {
    const repo = makeRepo();
    repo._prs.push({ id: "pr_1", organizationId: "o", title: "Ref MISSING-99" });
    repo._tickets.set("t_1", { id: "t_1", organizationId: "o", provider: "jira", externalKey: "PROJ-1", linkedPrRecordIds: [] });

    const r = await buildPrTicketEnrichResponse(repo, { organizationId: "o" }, { now: NOW });
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.unresolvedKeys).toEqual(["MISSING-99"]);
  });

  it("503 migration_pending when ticket table missing", async () => {
    const repo = makeRepo();
    repo.changeTicket.findMany = async () => {
      throw Object.assign(new Error("relation does not exist"), { code: "P2021" });
    };
    const r = await buildPrTicketEnrichResponse(repo, { organizationId: "o" });
    expect(r.status).toBe(503);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("migration_pending");
  });
});
