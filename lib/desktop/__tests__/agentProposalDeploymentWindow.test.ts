import { describe, expect, it } from "vitest";
import { deploymentWindowText } from "../../../desktop/src/views/AgentChatView";

describe("deployment window on a pending Agent proposal", () => {
  it("explains a frozen environment and that approval would be refused", () => {
    const t = deploymentWindowText({ environment: "Production", status: "frozen", freezeReason: "Incident 42", until: "2026-11-27T16:00:00Z", nextOpen: null });
    expect(t).toMatch(/^Production is frozen \(Incident 42\) until .+\. Approving now would be refused at dispatch\.$/);
  });
  it("explains closed and unreadable windows, and says nothing when open", () => {
    expect(deploymentWindowText({ environment: "Prod", status: "outside_window", nextOpen: "2026-11-30T09:00:00Z" })).toMatch(/^Prod is outside its change window\. Approving now would be refused at dispatch\. Next opening /);
    expect(deploymentWindowText({ status: "refused_unreadable_rule" })).toMatch(/^This environment has a change window that cannot be read/);
    expect(deploymentWindowText({ status: "open" })).toBe("");
  });
});
