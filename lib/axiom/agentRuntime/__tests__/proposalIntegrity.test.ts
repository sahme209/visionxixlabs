import { describe, expect, it } from "vitest";
import { agentActionDigest, approvalExpiry } from "../proposalIntegrity";

const base = { organizationId: "org-1", conversationId: "conv-1", proposedByUserId: "user-1", toolName: "commit_github_file" };

describe("agent proposal integrity", () => {
  it("is stable across object key ordering", () => {
    expect(agentActionDigest({ ...base, args: { branch: "main", nested: { b: 2, a: 1 } } }))
      .toBe(agentActionDigest({ ...base, args: { nested: { a: 1, b: 2 }, branch: "main" } }));
  });

  it("changes when protected action input changes", () => {
    expect(agentActionDigest({ ...base, args: { branch: "main" } }))
      .not.toBe(agentActionDigest({ ...base, args: { branch: "prod" } }));
  });

  it("creates a bounded approval window", () => {
    expect(approvalExpiry(new Date("2026-10-13T12:00:00Z"), 24).toISOString()).toBe("2026-10-14T12:00:00.000Z");
  });
});
