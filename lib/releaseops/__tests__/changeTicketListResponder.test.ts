import { describe, expect, it } from "vitest";
import {
  buildChangeTicketListResponse,
  type ChangeTicketListRepo,
  type ChangeTicketRow,
} from "../changeTicketListResponder";

function makeRepo(): ChangeTicketListRepo & { _rows: ChangeTicketRow[] } {
  const rows: ChangeTicketRow[] = [];
  return {
    _rows: rows,
    changeTicket: {
      async findMany({ where, take }) {
        let filtered = rows.filter((r) => r.organizationId === where.organizationId);
        if (where.status) {
          const allowed = new Set(where.status.in);
          filtered = filtered.filter((r) => allowed.has(r.status as never));
        }
        if (where.provider) {
          const allowed = new Set(where.provider.in);
          filtered = filtered.filter((r) => allowed.has(r.provider as never));
        }
        const sorted = filtered.slice().sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
        return take ? sorted.slice(0, take) : sorted;
      },
    },
  };
}

function makeRow(over: Partial<ChangeTicketRow> = {}): ChangeTicketRow {
  return {
    id: "ticket_1",
    organizationId: "o",
    provider: "jira",
    externalKey: "PROJ-1",
    externalId: "10001",
    title: "Add SSO",
    ticketType: "story",
    status: "pending",
    priority: "normal",
    assigneeUserId: "u_a",
    reporterUserId: "u_r",
    labels: ["security"],
    webUrl: "https://example/browse/PROJ-1",
    linkedPrRecordIds: [],
    linkedReleaseIds: [],
    openedAt: new Date("2026-05-01T10:00:00Z"),
    closedAt: null,
    lastSyncedAt: new Date("2026-05-25T10:00:00Z"),
    createdAt: new Date("2026-05-01T10:00:00Z"),
    updatedAt: new Date("2026-05-20T10:00:00Z"),
    ...over,
  };
}

describe("buildChangeTicketListResponse", () => {
  it("empty org → 200 ok, summary buckets zeroed", async () => {
    const repo = makeRepo();
    const r = await buildChangeTicketListResponse(repo, "o", { now: new Date("2026-05-25T12:00:00Z") });
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.tickets).toEqual([]);
    expect(r.body.data.summary.total).toBe(0);
    expect(r.body.data.summary.byStatus.pending).toBe(0);
    expect(r.body.data.summary.byProvider.jira).toBe(0);
  });

  it("populated org → status + provider buckets reflect mix, unknown narrowed", async () => {
    const repo = makeRepo();
    repo._rows.push(makeRow({ id: "t1", status: "pending", updatedAt: new Date("2026-05-22") }));
    repo._rows.push(makeRow({ id: "t2", provider: "linear", externalKey: "ENG-1", status: "in_progress", updatedAt: new Date("2026-05-21") }));
    repo._rows.push(makeRow({ id: "t3", provider: "servicenow", externalKey: "CHG1", status: "implemented", priority: "high", updatedAt: new Date("2026-05-20") }));
    repo._rows.push(makeRow({ id: "t4", provider: "garbage", externalKey: "X", status: "weird", priority: "yolo", ticketType: "unknown_type", updatedAt: new Date("2026-05-19") }));

    const r = await buildChangeTicketListResponse(repo, "o");
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.tickets).toHaveLength(4);
    expect(r.body.data.summary.total).toBe(4);
    expect(r.body.data.summary.byStatus).toMatchObject({ pending: 1, in_progress: 1, implemented: 1, unknown: 1 });
    expect(r.body.data.summary.byProvider).toMatchObject({ jira: 1, linear: 1, servicenow: 1, unknown: 1 });
    expect(r.body.data.tickets[3].status).toBe("unknown");
    expect(r.body.data.tickets[3].provider).toBe("unknown");
    expect(r.body.data.tickets[3].ticketType).toBe("unknown");
    expect(r.body.data.tickets[3].priority).toBe("unknown");
  });

  it("status + provider filter narrow results", async () => {
    const repo = makeRepo();
    repo._rows.push(makeRow({ id: "t1", status: "pending", provider: "jira" }));
    repo._rows.push(makeRow({ id: "t2", status: "approved", provider: "jira", updatedAt: new Date("2026-05-22") }));
    repo._rows.push(makeRow({ id: "t3", status: "approved", provider: "linear", updatedAt: new Date("2026-05-21") }));
    const r = await buildChangeTicketListResponse(repo, "o", {
      statusFilter: ["approved"],
      providerFilter: ["jira"],
    });
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.tickets).toHaveLength(1);
    expect(r.body.data.tickets[0].id).toBe("t2");
  });

  it("take cap respected", async () => {
    const repo = makeRepo();
    for (let i = 0; i < 5; i++) {
      repo._rows.push(makeRow({ id: `t${i}`, updatedAt: new Date(2026, 4, 25 - i) }));
    }
    const r = await buildChangeTicketListResponse(repo, "o", { take: 2 });
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.tickets).toHaveLength(2);
  });

  it("link counts surface", async () => {
    const repo = makeRepo();
    repo._rows.push(makeRow({ linkedPrRecordIds: ["pr_1", "pr_2"], linkedReleaseIds: ["rel_1"] }));
    const r = await buildChangeTicketListResponse(repo, "o");
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.tickets[0].linkedPrCount).toBe(2);
    expect(r.body.data.tickets[0].linkedReleaseCount).toBe(1);
  });

  it("migration_pending degradation", async () => {
    const repo = makeRepo();
    repo.changeTicket.findMany = async () => {
      throw Object.assign(new Error("relation does not exist"), { code: "P2021" });
    };
    const r = await buildChangeTicketListResponse(repo, "o");
    expect(r.status).toBe(503);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("migration_pending");
  });
});
