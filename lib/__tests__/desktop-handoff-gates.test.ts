import { describe, expect, it } from "vitest";
import { canApply, canOpen, type InboxHandoff } from "../../desktop/src/lib/handoffInbox";

const handoff = (state: InboxHandoff["state"]): InboxHandoff => ({
  id: "hf_test",
  receivedAt: "2026-09-24T12:00:00.000Z",
  state,
  planLabel: "Test plan",
  approver: "test-approver",
  preparedAt: "2026-09-24T12:00:00.000Z",
  expiresAt: "2026-09-24T13:00:00.000Z",
  steps: 2,
  risk: "low",
  resources: 1,
});

describe("desktop handoff safety gates", () => {
  it("opens only ready or already-opened handoffs", () => {
    expect(canOpen(handoff("ready")).allow).toBe(true);
    expect(canOpen(handoff("opened_in_desktop")).allow).toBe(true);
    expect(canOpen(handoff("preparing")).allow).toBe(false);
    expect(canOpen(handoff("expired"))).toEqual({ allow: false, reason: "Bundle has expired." });
  });

  it("never enables apply in a build without the execution guard", () => {
    expect(canApply(handoff("ready")).allow).toBe(false);
    expect(canApply(handoff("opened_in_desktop")).reason).toMatch(/disabled/i);
  });
});

