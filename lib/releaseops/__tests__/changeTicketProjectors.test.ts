import { describe, expect, it } from "vitest";
import {
  projectJiraIssue,
  projectLinearIssue,
  projectServiceNowChange,
  mapJiraType,
  mapJiraStatus,
  mapJiraPriority,
  mapLinearType,
  mapLinearStatus,
  mapLinearPriority,
  mapServiceNowType,
  mapServiceNowStatus,
  mapServiceNowPriority,
} from "../providers/changeTicketProjectors";

const now = new Date("2026-05-25T12:00:00Z");

/* ──────────────────────────────────────────────────────────────────
   Jira.
   ────────────────────────────────────────────────────────────── */

describe("mapJiraType", () => {
  it("epic / story / bug / change / incident / fallback task", () => {
    expect(mapJiraType("Epic")).toBe("epic");
    expect(mapJiraType("Story")).toBe("story");
    expect(mapJiraType("Bug")).toBe("bug");
    expect(mapJiraType("Change Request")).toBe("change_request");
    expect(mapJiraType("Incident")).toBe("incident");
    expect(mapJiraType("Improvement")).toBe("task");
    expect(mapJiraType(null)).toBe("task");
  });
});

describe("mapJiraStatus", () => {
  it("name match wins over category", () => {
    expect(mapJiraStatus("Approved", "indeterminate")).toBe("approved");
    expect(mapJiraStatus("Rejected", "done")).toBe("rejected");
    expect(mapJiraStatus("Cancelled", "done")).toBe("cancelled");
    expect(mapJiraStatus("Done", null)).toBe("implemented");
    expect(mapJiraStatus("In Review", null)).toBe("in_progress");
  });
  it("falls back to category when name unknown", () => {
    expect(mapJiraStatus("Strange", "done")).toBe("implemented");
    expect(mapJiraStatus("Strange", "indeterminate")).toBe("in_progress");
    expect(mapJiraStatus("Strange", "new")).toBe("pending");
    expect(mapJiraStatus(null, null)).toBe("pending");
  });
});

describe("mapJiraPriority", () => {
  it("maps Jira priority strings", () => {
    expect(mapJiraPriority("Highest")).toBe("critical");
    expect(mapJiraPriority("High")).toBe("high");
    expect(mapJiraPriority("Medium")).toBe("normal");
    expect(mapJiraPriority("Low")).toBe("low");
    expect(mapJiraPriority("Lowest")).toBe("trivial");
    expect(mapJiraPriority(null)).toBe("normal");
  });
});

describe("projectJiraIssue", () => {
  it("projects full Jira issue payload", () => {
    const r = projectJiraIssue(
      {
        id: "10001",
        key: "PROJ-123",
        fields: {
          summary: "Add SSO",
          issuetype: { name: "Story" },
          status: { name: "In Review", statusCategory: { key: "indeterminate" } },
          priority: { name: "High" },
          assignee: { accountId: "u_a" },
          reporter: { accountId: "u_r" },
          labels: ["security", "sso"],
          components: [{ name: "auth-service" }],
          created: "2026-05-01T10:00:00Z",
          resolutiondate: null,
        },
      },
      { organizationId: "o", browseBaseUrl: "https://example.atlassian.net", now },
    );
    expect(r).toMatchObject({
      organizationId: "o",
      provider: "jira",
      externalKey: "PROJ-123",
      externalId: "10001",
      title: "Add SSO",
      ticketType: "story",
      status: "in_progress",
      priority: "high",
      assigneeUserId: "u_a",
      reporterUserId: "u_r",
      labels: ["security", "sso", "auth-service"],
      webUrl: "https://example.atlassian.net/browse/PROJ-123",
      linkedPrRecordIds: [],
      linkedReleaseIds: [],
      closedAt: null,
    });
    expect(r.openedAt).toEqual(new Date("2026-05-01T10:00:00Z"));
    expect(r.lastSyncedAt).toBe(now);
  });

  it("handles missing optional fields without throwing", () => {
    const r = projectJiraIssue(
      { id: "1", key: "X-1", fields: { summary: "Bare" } },
      { organizationId: "o", now },
    );
    expect(r.ticketType).toBe("task");
    expect(r.status).toBe("pending");
    expect(r.priority).toBe("normal");
    expect(r.labels).toEqual([]);
    expect(r.webUrl).toBeNull();
  });
});

/* ──────────────────────────────────────────────────────────────────
   Linear.
   ────────────────────────────────────────────────────────────── */

describe("mapLinearType", () => {
  it("picks the first matching label", () => {
    expect(mapLinearType("started", ["epic"])).toBe("epic");
    expect(mapLinearType("started", ["bug"])).toBe("bug");
    expect(mapLinearType("started", ["incident"])).toBe("incident");
    expect(mapLinearType("started", ["change"])).toBe("change_request");
    expect(mapLinearType("started", ["story"])).toBe("story");
    expect(mapLinearType("started", [])).toBe("task");
  });
});

describe("mapLinearStatus", () => {
  it("cancelled wins regardless of state", () => {
    expect(mapLinearStatus("started", true)).toBe("cancelled");
  });
  it("maps state types", () => {
    expect(mapLinearStatus("completed", false)).toBe("implemented");
    expect(mapLinearStatus("canceled", false)).toBe("cancelled");
    expect(mapLinearStatus("started", false)).toBe("in_progress");
    expect(mapLinearStatus("unstarted", false)).toBe("pending");
    expect(mapLinearStatus("backlog", false)).toBe("pending");
    expect(mapLinearStatus(null, false)).toBe("pending");
  });
});

describe("mapLinearPriority", () => {
  it("maps Linear numeric priority", () => {
    expect(mapLinearPriority(1)).toBe("critical");
    expect(mapLinearPriority(2)).toBe("high");
    expect(mapLinearPriority(3)).toBe("normal");
    expect(mapLinearPriority(4)).toBe("low");
    expect(mapLinearPriority(0)).toBe("normal");
    expect(mapLinearPriority(null)).toBe("normal");
  });
});

describe("projectLinearIssue", () => {
  it("projects Linear issue with cancellation precedence", () => {
    const r = projectLinearIssue(
      {
        id: "iss_1",
        identifier: "ENG-42",
        title: "Investigate login spike",
        url: "https://linear.app/foo/issue/ENG-42",
        priority: 2,
        state: { name: "In Progress", type: "started" },
        labels: { nodes: [{ name: "bug" }, { name: "auth" }] },
        assignee: { id: "u_a" },
        creator: { id: "u_c" },
        createdAt: "2026-05-10T08:00:00Z",
        canceledAt: "2026-05-20T10:00:00Z",
      },
      { organizationId: "o", now },
    );
    expect(r.provider).toBe("linear");
    expect(r.ticketType).toBe("bug");
    expect(r.status).toBe("cancelled");
    expect(r.priority).toBe("high");
    expect(r.labels).toEqual(["bug", "auth"]);
    expect(r.closedAt).toEqual(new Date("2026-05-20T10:00:00Z"));
  });

  it("uses completedAt when not cancelled", () => {
    const r = projectLinearIssue(
      {
        id: "iss_2",
        identifier: "ENG-43",
        title: "Ship feature",
        state: { name: "Done", type: "completed" },
        completedAt: "2026-05-22T10:00:00Z",
      },
      { organizationId: "o", now },
    );
    expect(r.status).toBe("implemented");
    expect(r.closedAt).toEqual(new Date("2026-05-22T10:00:00Z"));
  });
});

/* ──────────────────────────────────────────────────────────────────
   ServiceNow.
   ────────────────────────────────────────────────────────────── */

describe("mapServiceNowType", () => {
  it("incident vs change_request", () => {
    expect(mapServiceNowType("incident", null)).toBe("incident");
    expect(mapServiceNowType("normal", "Incident")).toBe("incident");
    expect(mapServiceNowType("normal", null)).toBe("change_request");
    expect(mapServiceNowType(null, null)).toBe("change_request");
  });
});

describe("mapServiceNowStatus", () => {
  it("respects approval rejection", () => {
    expect(mapServiceNowStatus("authorize", "rejected")).toBe("rejected");
    expect(mapServiceNowStatus("authorize", "approved")).toBe("approved");
  });
  it("maps numeric and named states", () => {
    expect(mapServiceNowStatus("cancelled", null)).toBe("cancelled");
    expect(mapServiceNowStatus("4", null)).toBe("cancelled");
    expect(mapServiceNowStatus("closed", null)).toBe("implemented");
    expect(mapServiceNowStatus("3", null)).toBe("implemented");
    expect(mapServiceNowStatus("review", null)).toBe("implemented");
    expect(mapServiceNowStatus("implement", null)).toBe("in_progress");
    expect(mapServiceNowStatus("-2", null)).toBe("in_progress");
    expect(mapServiceNowStatus("new", null)).toBe("pending");
  });
});

describe("mapServiceNowPriority", () => {
  it("maps numeric-prefixed priority strings", () => {
    expect(mapServiceNowPriority("1 - Critical")).toBe("critical");
    expect(mapServiceNowPriority("2 - High")).toBe("high");
    expect(mapServiceNowPriority("3 - Moderate")).toBe("normal");
    expect(mapServiceNowPriority("4 - Low")).toBe("low");
    expect(mapServiceNowPriority("5 - Planning")).toBe("trivial");
    expect(mapServiceNowPriority(null)).toBe("normal");
  });
});

describe("projectServiceNowChange", () => {
  it("projects a normal change request", () => {
    const r = projectServiceNowChange(
      {
        sys_id: "abc123",
        number: "CHG0012345",
        short_description: "Patch CVE",
        type: "normal",
        state: "implement",
        approval: "approved",
        priority: "2 - High",
        assigned_to: { value: "u_a" },
        opened_by: { value: "u_r" },
        opened_at: "2026-05-15T10:00:00Z",
        closed_at: null,
        category: "Security",
        cmdb_ci: { value: "ci_42", display_value: "api-gateway" },
      },
      { organizationId: "o", instanceUrl: "https://example.service-now.com", now },
    );
    expect(r.provider).toBe("servicenow");
    expect(r.externalKey).toBe("CHG0012345");
    expect(r.ticketType).toBe("change_request");
    expect(r.status).toBe("in_progress");
    expect(r.priority).toBe("high");
    expect(r.assigneeUserId).toBe("u_a");
    expect(r.labels).toEqual(["Security", "api-gateway"]);
    expect(r.webUrl).toBe("https://example.service-now.com/nav_to.do?uri=change_request.do?sys_id=abc123");
  });

  it("handles string-form references and absent instance url", () => {
    const r = projectServiceNowChange(
      {
        sys_id: "xyz",
        number: "CHG0001",
        short_description: "Bare",
        assigned_to: "u_a_plain_string",
        opened_by: "",
      },
      { organizationId: "o", now },
    );
    expect(r.assigneeUserId).toBe("u_a_plain_string");
    expect(r.reporterUserId).toBeNull();
    expect(r.webUrl).toBeNull();
    expect(r.status).toBe("pending");
  });
});
