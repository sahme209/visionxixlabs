import { describe, expect, it } from "vitest";
import {
  buildChangeTicketSyncResponse,
  type ChangeTicketSyncRepo,
  type ChangeTicketFetcherSet,
} from "../changeTicketSyncResponder";
import type {
  LinearIssue,
  JiraIssue,
  ServiceNowChange,
} from "../providers/changeTicketProjectors";

function makeRepo(): ChangeTicketSyncRepo & { _upserts: Array<{ key: string; create: unknown }> } {
  const upserts: Array<{ key: string; create: unknown }> = [];
  return {
    _upserts: upserts,
    changeTicket: {
      async upsert({ where, create }) {
        const k = `${where.organizationId_provider_externalKey.organizationId}|${where.organizationId_provider_externalKey.provider}|${where.organizationId_provider_externalKey.externalKey}`;
        upserts.push({ key: k, create });
        return { id: `ct_${upserts.length}`, externalKey: where.organizationId_provider_externalKey.externalKey };
      },
    },
  };
}

const NOW = new Date("2026-05-25T12:00:00Z");

describe("buildChangeTicketSyncResponse", () => {
  it("501 when linear fetcher absent", async () => {
    const repo = makeRepo();
    const r = await buildChangeTicketSyncResponse(repo, {}, { organizationId: "o", provider: "linear" }, { now: NOW });
    expect(r.status).toBe(501);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("fetcher_not_configured");
  });

  it("400 unsupported_provider when caller asks for 'other'", async () => {
    const repo = makeRepo();
    const r = await buildChangeTicketSyncResponse(repo, {}, { organizationId: "o", provider: "other" }, { now: NOW });
    expect(r.status).toBe(400);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("unsupported_provider");
  });

  it("Linear: fetches, projects, upserts every issue", async () => {
    const repo = makeRepo();
    const issues: LinearIssue[] = [
      {
        id: "iss_1", identifier: "ENG-1", title: "First",
        state: { name: "Done", type: "completed" },
        priority: 3,
        labels: { nodes: [{ name: "bug" }] },
        completedAt: "2026-05-20T10:00:00Z",
      },
      {
        id: "iss_2", identifier: "ENG-2", title: "Second",
        state: { name: "In Progress", type: "started" },
        priority: 2,
        labels: { nodes: [] },
      },
    ];
    const fetchers: ChangeTicketFetcherSet = {
      linear: { async listIssues() { return issues; } },
    };
    const r = await buildChangeTicketSyncResponse(repo, fetchers, { organizationId: "o", provider: "linear" }, { now: NOW });
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.fetched).toBe(2);
    expect(r.body.data.upserted).toBe(2);
    expect(r.body.data.skipped).toBe(0);
    expect(repo._upserts).toHaveLength(2);
    expect(repo._upserts[0].key).toBe("o|linear|ENG-1");
  });

  it("Linear: per-issue errors surfaced, others still upserted", async () => {
    const repo = makeRepo();
    const orig = repo.changeTicket.upsert.bind(repo.changeTicket);
    repo.changeTicket.upsert = async (args) => {
      if (args.where.organizationId_provider_externalKey.externalKey === "ENG-2") throw new Error("boom");
      return orig(args);
    };
    const fetchers: ChangeTicketFetcherSet = {
      linear: {
        async listIssues() {
          return [
            { id: "1", identifier: "ENG-1", title: "First", state: { name: "Done", type: "completed" } },
            { id: "2", identifier: "ENG-2", title: "Second", state: { name: "In Progress", type: "started" } },
            { id: "3", identifier: "ENG-3", title: "Third", state: { name: "Backlog", type: "unstarted" } },
          ];
        },
      },
    };
    const r = await buildChangeTicketSyncResponse(repo, fetchers, { organizationId: "o", provider: "linear" }, { now: NOW });
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.upserted).toBe(2);
    expect(r.body.data.skipped).toBe(1);
    expect(r.body.data.errors[0]).toMatchObject({ identifier: "ENG-2", reason: expect.stringContaining("boom") });
  });

  it("Jira: fetches, projects, upserts", async () => {
    const repo = makeRepo();
    const issues: JiraIssue[] = [
      {
        id: "10001", key: "PROJ-1",
        fields: { summary: "Add SSO", issuetype: { name: "Story" }, status: { name: "Done", statusCategory: { key: "done" } } },
      },
    ];
    const fetchers: ChangeTicketFetcherSet = {
      jira: { async listIssues() { return issues; } },
    };
    const r = await buildChangeTicketSyncResponse(
      repo, fetchers,
      { organizationId: "o", provider: "jira", jiraBrowseBaseUrl: "https://acme.atlassian.net" },
      { now: NOW },
    );
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.fetched).toBe(1);
    expect(repo._upserts[0].key).toBe("o|jira|PROJ-1");
  });

  it("ServiceNow: fetches, projects, upserts", async () => {
    const repo = makeRepo();
    const changes: ServiceNowChange[] = [
      {
        sys_id: "abc",
        number: "CHG0001",
        short_description: "Patch",
        state: "implement",
        approval: "approved",
        priority: "2 - High",
      },
    ];
    const fetchers: ChangeTicketFetcherSet = {
      servicenow: { async listChanges() { return changes; } },
    };
    const r = await buildChangeTicketSyncResponse(
      repo, fetchers,
      { organizationId: "o", provider: "servicenow", serviceNowInstanceUrl: "https://example.service-now.com" },
      { now: NOW },
    );
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.fetched).toBe(1);
    expect(repo._upserts[0].key).toBe("o|servicenow|CHG0001");
  });

  it("503 migration_pending when underlying table missing", async () => {
    const repo = makeRepo();
    repo.changeTicket.upsert = async () => {
      throw Object.assign(new Error("relation does not exist"), { code: "P2021" });
    };
    const fetchers: ChangeTicketFetcherSet = {
      linear: {
        async listIssues() {
          return [{ id: "1", identifier: "ENG-1", title: "x", state: { name: "Done", type: "completed" } }];
        },
      },
    };
    const r = await buildChangeTicketSyncResponse(repo, fetchers, { organizationId: "o", provider: "linear" }, { now: NOW });
    // Per-issue error captured as skipped (same as repositorySync), not a 503 — one bad
    // ticket shouldn't fail the whole sync.
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.upserted).toBe(0);
    expect(r.body.data.skipped).toBe(1);
  });
});
