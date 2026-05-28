import { describe, expect, it } from "vitest";
import {
  formatSlackPayload,
  shouldSendSignal,
  dispatchSlackPayload,
  isSlackSignalKind,
  type SlackConfigView,
  type SlackFetcher,
  type SlackSignal,
} from "../slackNotificationEngine";

function baseSignal(overrides: Partial<SlackSignal> = {}): SlackSignal {
  return {
    kind: "council_critical",
    title: "Block deploy — 2 blocking violations",
    summary: "Council recommends block_deploy with 92% agreement.",
    severity: "critical",
    ...overrides,
  };
}

describe("isSlackSignalKind", () => {
  it("accepts every closed-union value", () => {
    expect(isSlackSignalKind("council_critical")).toBe(true);
    expect(isSlackSignalKind("triage_auto_escalate")).toBe(true);
    expect(isSlackSignalKind("learning_loop_signal")).toBe(true);
    expect(isSlackSignalKind("remediation_p0")).toBe(true);
  });

  it("rejects unknown kinds", () => {
    expect(isSlackSignalKind("random")).toBe(false);
    expect(isSlackSignalKind("")).toBe(false);
  });
});

describe("formatSlackPayload", () => {
  it("builds a fallback text + blocks for critical signal", () => {
    const p = formatSlackPayload(baseSignal());
    expect(p.text).toContain("AGI council");
    expect(p.text).toContain("Block deploy");
    expect(p.text).toContain(":rotating_light:");
    expect(p.blocks.length).toBeGreaterThanOrEqual(2);
  });

  it("includes optional detail line when supplied", () => {
    const p = formatSlackPayload(baseSignal({ detail: "Two policy rules failed: PR review + signed commits." }));
    const detailBlock = p.blocks.find((b) => {
      const text = (b as { text?: { text?: string } }).text?.text;
      return typeof text === "string" && text.includes("Two policy rules");
    });
    expect(detailBlock).toBeDefined();
  });

  it("includes dashboard URL link when supplied", () => {
    const p = formatSlackPayload(baseSignal({ dashboardUrl: "https://app.example.com/dashboard/advisor-council" }));
    const serialized = JSON.stringify(p);
    expect(serialized).toContain("Open in dashboard");
    expect(serialized).toContain("dashboard/advisor-council");
  });

  it("includes subject reference when subjectKind+Id supplied", () => {
    const p = formatSlackPayload(baseSignal({ subjectKind: "release", subjectId: "rel_42" }));
    const serialized = JSON.stringify(p);
    expect(serialized).toContain("release");
    expect(serialized).toContain("rel_42");
  });

  it("applies channel override when opts.channel provided", () => {
    const p = formatSlackPayload(baseSignal(), { channel: "#deploys-critical" });
    expect(p.channel).toBe("#deploys-critical");
  });

  it("emoji adapts to severity", () => {
    const crit = formatSlackPayload(baseSignal({ severity: "critical" }));
    const high = formatSlackPayload(baseSignal({ severity: "high" }));
    const med  = formatSlackPayload(baseSignal({ severity: "medium" }));
    const low  = formatSlackPayload(baseSignal({ severity: "low" }));
    expect(crit.text).toContain(":rotating_light:");
    expect(high.text).toContain(":warning:");
    expect(med.text).toContain(":large_yellow_circle:");
    expect(low.text).toContain(":large_blue_circle:");
  });

  it("kind prefix matches the closed-union", () => {
    expect(formatSlackPayload(baseSignal({ kind: "triage_auto_escalate" })).text).toContain("Triage auto-escalate");
    expect(formatSlackPayload(baseSignal({ kind: "learning_loop_signal" })).text).toContain("Learning loop");
    expect(formatSlackPayload(baseSignal({ kind: "remediation_p0" })).text).toContain("Remediation");
  });
});

describe("shouldSendSignal", () => {
  function config(overrides: Partial<SlackConfigView> = {}): SlackConfigView {
    return {
      webhookUrl: "https://hooks.slack.com/services/xxx",
      enabled: true,
      enabledSignalKinds: null,
      defaultChannel: null,
      ...overrides,
    };
  }

  it("no config → skip", () => {
    expect(shouldSendSignal(baseSignal(), null)).toEqual({ shouldSend: false, reason: "no_config" });
  });

  it("disabled config → skip", () => {
    expect(shouldSendSignal(baseSignal(), config({ enabled: false }))).toEqual({ shouldSend: false, reason: "config_disabled" });
  });

  it("missing webhook URL → skip", () => {
    expect(shouldSendSignal(baseSignal(), config({ webhookUrl: "" }))).toEqual({ shouldSend: false, reason: "missing_webhook_url" });
  });

  it("null enabledSignalKinds → send all", () => {
    expect(shouldSendSignal(baseSignal(), config()).shouldSend).toBe(true);
  });

  it("empty enabledSignalKinds → send all (defensive)", () => {
    expect(shouldSendSignal(baseSignal(), config({ enabledSignalKinds: [] })).shouldSend).toBe(true);
  });

  it("kind in enabled list → send", () => {
    expect(
      shouldSendSignal(baseSignal(), config({ enabledSignalKinds: ["council_critical"] })).shouldSend,
    ).toBe(true);
  });

  it("kind not in enabled list → skip with kind_filtered", () => {
    expect(
      shouldSendSignal(baseSignal({ kind: "remediation_p0" }), config({ enabledSignalKinds: ["council_critical"] })),
    ).toEqual({ shouldSend: false, reason: "kind_filtered" });
  });
});

describe("dispatchSlackPayload", () => {
  const payload = formatSlackPayload(baseSignal());

  it("returns skipped_not_configured when URL empty", async () => {
    const fetcher: SlackFetcher = async () => ({ status: 200, ok: true, text: async () => "" });
    const out = await dispatchSlackPayload(payload, "", fetcher);
    expect(out.outcome).toBe("skipped_not_configured");
  });

  it("records sent + httpStatus on 2xx response", async () => {
    const fetcher: SlackFetcher = async () => ({ status: 200, ok: true, text: async () => "ok" });
    const out = await dispatchSlackPayload(payload, "https://hooks.slack.com/x", fetcher);
    expect(out.outcome).toBe("sent");
    expect(out.httpStatus).toBe(200);
  });

  it("records error + status + body snippet on non-2xx", async () => {
    const fetcher: SlackFetcher = async () => ({
      status: 403,
      ok: false,
      text: async () => "invalid_token",
    });
    const out = await dispatchSlackPayload(payload, "https://hooks.slack.com/x", fetcher);
    expect(out.outcome).toBe("error");
    expect(out.httpStatus).toBe(403);
    expect(out.errorMessage).toContain("invalid_token");
  });

  it("captures fetcher exceptions as error outcome", async () => {
    const fetcher: SlackFetcher = async () => { throw new Error("network down"); };
    const out = await dispatchSlackPayload(payload, "https://hooks.slack.com/x", fetcher);
    expect(out.outcome).toBe("error");
    expect(out.errorMessage).toContain("network down");
  });

  it("truncates large error bodies to 200 chars", async () => {
    const longBody = "x".repeat(500);
    const fetcher: SlackFetcher = async () => ({
      status: 500,
      ok: false,
      text: async () => longBody,
    });
    const out = await dispatchSlackPayload(payload, "https://hooks.slack.com/x", fetcher);
    expect(out.outcome).toBe("error");
    expect(out.errorMessage?.length).toBeLessThanOrEqual(200);
  });

  it("POSTs JSON to the webhook URL", async () => {
    let capturedUrl = "";
    let capturedBody = "";
    let capturedMethod = "";
    const fetcher: SlackFetcher = async (url, init) => {
      capturedUrl = url;
      capturedBody = init.body;
      capturedMethod = init.method;
      return { status: 200, ok: true, text: async () => "" };
    };
    await dispatchSlackPayload(payload, "https://hooks.slack.com/services/abc", fetcher);
    expect(capturedUrl).toBe("https://hooks.slack.com/services/abc");
    expect(capturedMethod).toBe("POST");
    expect(JSON.parse(capturedBody).text).toContain("AGI council");
  });
});
