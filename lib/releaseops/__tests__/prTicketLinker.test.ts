import { describe, expect, it } from "vitest";
import {
  linkPrToTickets,
  extractExternalKeys,
  inferProvider,
} from "../prTicketLinker";

describe("extractExternalKeys", () => {
  it("finds Jira-style keys in title + body", () => {
    expect(extractExternalKeys("Add SSO for PROJ-123 and PROJ-456")).toEqual(
      expect.arrayContaining(["PROJ-123", "PROJ-456"]),
    );
  });

  it("finds ServiceNow keys", () => {
    expect(extractExternalKeys("Implements CHG0012345 + CHG0099999")).toEqual(
      expect.arrayContaining(["CHG0012345", "CHG0099999"]),
    );
  });

  it("dedupes across multiple mentions", () => {
    expect(extractExternalKeys("PROJ-1 mentioned. See PROJ-1.")).toEqual(["PROJ-1"]);
  });

  it("ignores lowercase or malformed keys", () => {
    expect(extractExternalKeys("proj-1 and X-99999999")).toEqual([]);
  });

  it("empty string → empty list", () => {
    expect(extractExternalKeys("")).toEqual([]);
  });
});

describe("inferProvider", () => {
  it("CHG###### → servicenow", () => {
    expect(inferProvider("CHG0012345")).toBe("servicenow");
  });
  it("Other keys default to jira (Linear shares the pattern)", () => {
    expect(inferProvider("PROJ-1")).toBe("jira");
    expect(inferProvider("ENG-42")).toBe("jira");
  });
});

describe("linkPrToTickets", () => {
  it("resolves Jira + Linear + ServiceNow mentions to candidate ids", () => {
    const r = linkPrToTickets({
      prId: "pr_1",
      prTitle: "Hotfix for PROJ-1 and ENG-42",
      prBody: "Also relates to CHG0012345.",
      candidates: [
        { id: "t_jira", provider: "jira", externalKey: "PROJ-1" },
        { id: "t_linear", provider: "linear", externalKey: "ENG-42" },
        { id: "t_sn", provider: "servicenow", externalKey: "CHG0012345" },
        { id: "t_unrelated", provider: "jira", externalKey: "OTHER-99" },
      ],
    });
    expect(r.matchedTicketIds.sort()).toEqual(["t_jira", "t_linear", "t_sn"]);
    expect(r.unresolvedExternalKeys).toEqual([]);
  });

  it("surfaces unresolved keys when no candidate matches", () => {
    const r = linkPrToTickets({
      prId: "pr_1",
      prTitle: "Implements PROJ-999",
      prBody: null,
      candidates: [{ id: "t1", provider: "jira", externalKey: "PROJ-1" }],
    });
    expect(r.matchedTicketIds).toEqual([]);
    expect(r.unresolvedExternalKeys).toEqual(["PROJ-999"]);
  });

  it("records match reason per ticket", () => {
    const r = linkPrToTickets({
      prId: "pr_1",
      prTitle: "PROJ-1",
      prBody: null,
      candidates: [{ id: "t1", provider: "jira", externalKey: "PROJ-1" }],
    });
    expect(r.matchReasons["t1"]).toBe("PROJ-1");
  });

  it("case-insensitive matching against the candidate key", () => {
    const r = linkPrToTickets({
      prId: "pr_1",
      prTitle: "Done in CHG0012345",
      prBody: null,
      candidates: [{ id: "t1", provider: "servicenow", externalKey: "chg0012345" }],
    });
    expect(r.matchedTicketIds).toEqual(["t1"]);
  });

  it("empty PR text → empty matches and unresolved", () => {
    const r = linkPrToTickets({
      prId: "pr_1",
      prTitle: "Refactor only",
      prBody: "No ticket references here.",
      candidates: [{ id: "t1", provider: "jira", externalKey: "PROJ-1" }],
    });
    expect(r.matchedTicketIds).toEqual([]);
    expect(r.unresolvedExternalKeys).toEqual([]);
  });

  it("multiple PRs mentioning the same ticket all match the same id", () => {
    const candidates = [{ id: "t1", provider: "jira" as const, externalKey: "PROJ-1" }];
    const a = linkPrToTickets({ prId: "pr_a", prTitle: "PROJ-1", prBody: null, candidates });
    const b = linkPrToTickets({ prId: "pr_b", prTitle: "Fix PROJ-1", prBody: null, candidates });
    expect(a.matchedTicketIds).toEqual(["t1"]);
    expect(b.matchedTicketIds).toEqual(["t1"]);
  });
});
